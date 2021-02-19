import Head from 'next/head'
import React from 'react'

export interface headerProps {
  pageTitle: string
}
const PageHead = ({ pageTitle }: headerProps) => (
  <Head>
    <title>{pageTitle}</title>
    <link rel="icon" href="/favicon.ico" />
    <script async type="text/javascript" src="/console-log.js"></script>
  </Head>
)

export { PageHead }
