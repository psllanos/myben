import { IndexTabs } from '@maybe-finance/design-system'
import { useRef } from 'react'
import { RiArticleLine, RiMicLine } from 'react-icons/ri'
import {
    ExplainerExternalLink,
    ExplainerInfoBlock,
    ExplainerSection,
} from '@maybe-finance/client/shared'

export function SectorAllocation(): JSX.Element {
    const scrollContainer = useRef<HTMLDivElement>(null)

    const definition = useRef<HTMLDivElement>(null)
    const howAreWeGettingThisValue = useRef<HTMLDivElement>(null)
    const learnMore = useRef<HTMLDivElement>(null)

    return (
        <div className="flex flex-col w-full h-full">
            <h5 className="px-4 font-display font-bold text-2xl">Sector allocation</h5>
            <div className="shrink-0 px-4 py-3">
                <IndexTabs
                    scrollContainer={scrollContainer}
                    sections={[
                        { name: 'Definition', elementRef: definition },
                        {
                            name: 'How are we getting this value?',
                            elementRef: howAreWeGettingThisValue,
                        },
                        {
                            name: 'Learn more',
                            elementRef: learnMore,
                        },
                    ]}
                />
            </div>
            <div ref={scrollContainer} className="grow px-4 pb-16 basis-px custom-gray-scroll">
                <ExplainerSection title="Definition" ref={definition}>
                    The sector allocation shows what % of your portfolio is in stocks in comparison
                    to other asset classes. There are a few different methods of allocation and
                    there&rsquo;s no right or wrong answer as it&rsquo;s always dependent on the
                    investor&rsquo;s attributes and their risk tolerance.
                    <ExplainerInfoBlock title="TL;DR">
                        % of stocks vs. % of other assets
                    </ExplainerInfoBlock>
                </ExplainerSection>

                <ExplainerSection
                    title="How are we getting this value?"
                    ref={howAreWeGettingThisValue}
                >
                    Is what you&rsquo;re probably asking when seeing that number. Well, below is the
                    formula we use:
                    <ExplainerInfoBlock title="Formula">
                        <span className="font-mono italic">
                            Total stock holdings / portfolio value, Total non-stock holdings /
                            portfolio value
                        </span>
                    </ExplainerInfoBlock>
                </ExplainerSection>

                <ExplainerSection title="Learn more" ref={learnMore}>
                    <ExplainerExternalLink
                        icon={RiArticleLine}
                        href="https://maybe.co/articles/equities-as-an-asset-class"
                    >
                        Article from the Maybe blog on making equity investing part of your
                        portfolio
                    </ExplainerExternalLink>
                    <ExplainerExternalLink
                        icon={RiMicLine}
                        href="https://maybe.co/podcast/11-how-can-i-match-my-investment-retirement-portfolio-with-my-risk-tolerance"
                    >
                        Podcast episode on matching your portfolio with your risk tolerance
                    </ExplainerExternalLink>
                </ExplainerSection>
            </div>
        </div>
    )
}
