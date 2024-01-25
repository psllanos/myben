import express from 'express'
import cors from 'cors'
import * as Sentry from '@sentry/node'
import * as SentryTracing from '@sentry/tracing'
import { BullQueue } from '@maybe-finance/server/shared'
import logger from './app/lib/logger'
import prisma from './app/lib/prisma'
import {
    accountConnectionProcessor,
    accountProcessor,
    institutionService,
    queueService,
    securityPricingProcessor,
    userProcessor,
    emailProcessor,
    workerErrorHandlerService,
} from './app/lib/di'
import env from './env'
import { cleanUpOutdatedJobs } from './utils'

// Defaults from quickstart - https://docs.sentry.io/platforms/node/
Sentry.init({
    dsn: env.NX_SENTRY_DSN,
    environment: env.NX_SENTRY_ENV,
    maxValueLength: 8196,
    integrations: [
        new Sentry.Integrations.Http({ tracing: true }),
        new SentryTracing.Integrations.Postgres(),
        new SentryTracing.Integrations.Prisma({ client: prisma }),
    ],
    tracesSampleRate: 1.0,
})

const syncUserQueue = queueService.getQueue('sync-user')
const syncConnectionQueue = queueService.getQueue('sync-account-connection')
const syncAccountQueue = queueService.getQueue('sync-account')
const syncSecurityQueue = queueService.getQueue('sync-security')
const purgeUserQueue = queueService.getQueue('purge-user')
const syncInstitutionQueue = queueService.getQueue('sync-institution')
const sendEmailQueue = queueService.getQueue('send-email')

syncUserQueue.process(
    'sync-user',
    async (job) => {
        await userProcessor.sync(job.data)
    },
    { concurrency: 4 }
)

syncAccountQueue.process(
    'sync-account',
    async (job) => {
        await accountProcessor.sync(job.data)
    },
    { concurrency: 4 }
)

/**
 * sync-account-connection queue
 */
syncConnectionQueue.process(
    'sync-connection',
    async (job) => {
        await accountConnectionProcessor.sync(job.data, async (progress) => {
            try {
                await job.progress(progress)
            } catch (e) {
                logger.warn('Failed to update SYNC_CONNECTION job progress', job.data)
            }
        })
    },
    { concurrency: 4 }
)

/**
 * sync-security queue
 */
syncSecurityQueue.process(
    'sync-all-securities',
    async () => await securityPricingProcessor.syncAll()
)

/**
 * sync-us-stock-ticker queue
 */
syncSecurityQueue.process(
    'sync-us-stock-tickers',
    async () => await securityPricingProcessor.syncUSStockTickers()
)

/**
 * purge-user queue
 */
purgeUserQueue.process(
    'purge-user',
    async (job) => {
        await userProcessor.delete(job.data)
    },
    { concurrency: 4 }
)

/**
 * sync-all-securities queue
 */

// If no securities exist, sync them immediately
// Otherwise, schedule the job to run every 24 hours
// Use same jobID to prevent duplicates and rate limiting
syncSecurityQueue.cancelJobs().then(() => {
    prisma.security
        .count({
            where: {
                providerName: 'polygon',
            },
        })
        .then((count) => {
            if (count === 0) {
                syncSecurityQueue.add('sync-us-stock-tickers', {}, {})
            } else {
                syncSecurityQueue.add(
                    'sync-us-stock-tickers',
                    {},
                    {
                        repeat: { cron: '0 */24 * * *' }, // Run every 24 hours
                        jobId: Date.now().toString(),
                    }
                )
            }
            // Do not run if on the free tier (rate limits)
            if (env.NX_POLYGON_TIER !== 'basic') {
                syncSecurityQueue.add(
                    'sync-all-securities',
                    {},
                    {
                        repeat: { cron: '*/5 * * * *' }, // Run every 5 minutes
                        jobId: Date.now().toString(),
                    }
                )
            }
        })
})

/**
 * sync-institution queue
 */
syncInstitutionQueue.process(
    'sync-plaid-institutions',
    async () => await institutionService.sync('PLAID')
)

syncInstitutionQueue.process(
    'sync-teller-institutions',
    async () => await institutionService.sync('TELLER')
)

syncInstitutionQueue.add(
    'sync-plaid-institutions',
    {},
    {
        repeat: { cron: '0 */24 * * *' }, // Run every 24 hours
        jobId: Date.now().toString(),
    }
)

syncInstitutionQueue.add(
    'sync-teller-institutions',
    {},
    {
        repeat: { cron: '0 */24 * * *' }, // Run every 24 hours
        jobId: Date.now().toString(),
    }
)

/**
 * send-email queue
 */
sendEmailQueue.process('send-email', async (job) => await emailProcessor.send(job.data))

if (env.STRIPE_API_KEY) {
    sendEmailQueue.add(
        'send-email',
        { type: 'trial-reminders' },
        { repeat: { cron: '0 */12 * * *' } } // Run every 12 hours
    )
}

// Fallback - usually triggered by errors not handled (or thrown) within the Bull event handlers (see above)
process.on(
    'uncaughtException',
    async (error) =>
        await workerErrorHandlerService.handleWorkersError({ variant: 'unhandled', error })
)

// Fallback - usually triggered by errors not handled (or thrown) within the Bull event handlers (see above)
process.on(
    'unhandledRejection',
    async (error) =>
        await workerErrorHandlerService.handleWorkersError({ variant: 'unhandled', error })
)

// Replace any jobs that have changed cron schedules and ensures only
// one repeatable jobs for each type is running
const queues = [syncSecurityQueue, syncInstitutionQueue]
cleanUpOutdatedJobs(queues)

const app = express()

app.use(cors())

// Make sure that at least 1 of the queues is ready and Redis is connected properly
app.get('/health', (_req, res, _next) => {
    syncConnectionQueue
        .isHealthy()
        .then((isHealthy) => {
            if (isHealthy) {
                res.status(200).json({ success: true, message: 'Queue is healthy' })
            } else {
                res.status(500).json({ success: false, message: 'Queue is not healthy' })
            }
        })
        .catch((err) => {
            console.log(err)
            res.status(500).json({ success: false, message: 'Queue health check failed' })
        })
})

const server = app.listen(env.NX_PORT, () => {
    logger.info(`Worker health server started on port ${env.NX_PORT}`)
})

async function onShutdown() {
    logger.info('[shutdown.start]')

    await new Promise((resolve) => server.close(resolve))

    // shutdown queues
    try {
        await Promise.allSettled(
            queueService.allQueues
                .filter((q): q is BullQueue => q instanceof BullQueue)
                .map((q) => q.queue.close())
        )
    } catch (error) {
        logger.error('[shutdown.error]', error)
    } finally {
        logger.info('[shutdown.complete]')
        process.exitCode = 0
    }
}

process.on('SIGINT', onShutdown)
process.on('SIGTERM', onShutdown)
process.on('exit', (code) => logger.info(`[exit] code=${code}`))

logger.info(`🚀 worker started`)
