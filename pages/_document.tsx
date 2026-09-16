import { Html, Head, Main, NextScript } from 'next/document'

const Document = () => {
    return (
        <Html lang="en">
            <Head>
                <link rel="icon" href="/favicon.ico" sizes="32x32" />
                <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
                <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
            </Head>
            <body>
                <script
                    dangerouslySetInnerHTML={{
                        __html: `try{var v=localStorage.getItem('parse-analyzer-vibe');if(v==='classic'||v==='light')document.documentElement.setAttribute('data-vibe',v)}catch(e){}`,
                    }}
                />
                <Main />
                <NextScript />
            </body>
        </Html>
    )
}

export default Document
