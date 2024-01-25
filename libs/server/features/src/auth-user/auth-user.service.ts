import type { AuthUser, PrismaClient, Prisma } from '@prisma/client'
import type { Logger } from 'winston'
import bcrypt from 'bcrypt'

export interface IAuthUserService {
    get(id: AuthUser['id']): Promise<AuthUser>
    delete(id: AuthUser['id']): Promise<AuthUser>
}

export class AuthUserService implements IAuthUserService {
    constructor(private readonly logger: Logger, private readonly prisma: PrismaClient) {}

    async get(id: AuthUser['id']) {
        return await this.prisma.authUser.findUniqueOrThrow({
            where: { id },
        })
    }

    async getByEmail(email: AuthUser['email']) {
        if (!email) throw new Error('No email provided')
        return await this.prisma.authUser.findUnique({
            where: { email },
        })
    }

    async updatePassword(id: AuthUser['id'], oldPassword: string, newPassword: string) {
        const authUser = await this.get(id)
        const isMatch = await bcrypt.compare(oldPassword, authUser.password!)
        if (!isMatch) {
            throw new Error('Could not reset password')
        } else {
            const hashedPassword = await bcrypt.hash(newPassword, 10)
            return await this.prisma.authUser.update({
                where: { id },
                data: { password: hashedPassword },
            })
        }
    }

    async create(data: Prisma.AuthUserCreateInput & { firstName: string; lastName: string }) {
        const authUser = await this.prisma.authUser.create({ data: { ...data } })
        return authUser
    }

    async delete(id: AuthUser['id']) {
        const authUser = await this.get(id)

        this.logger.info(`Removing user ${authUser.id} from Prisma`)
        const user = await this.prisma.authUser.delete({ where: { id } })
        return user
    }
}
