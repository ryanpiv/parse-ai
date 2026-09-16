import ui from '../../../styles/ui.module.css'

export type PageHeaderProps = {
    title: string
    subtitle?: string
}

/** Consistent page heading: title + optional one-line subtitle. */
const PageHeader = ({ title, subtitle }: PageHeaderProps) => {
    return (
        <div className={ui.hdr}>
            <div>
                <div className={ui.logo}>{title}</div>
                {subtitle ? <div className={ui.logoSub}>{subtitle}</div> : null}
            </div>
        </div>
    )
}

export default PageHeader
