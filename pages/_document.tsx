import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en">
      <Head />
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html:
              `try{var v=localStorage.getItem('parse-analyzer-vibe');if(v&&v!=='classic')document.documentElement.setAttribute('data-vibe',v)}catch(e){}`,
          }}
        />
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
