import { pageTitleBroadcaster } from '../library/constants'
import Head from 'next/head'
import React from 'react'
import { MultipleStreamListener } from '../components/multiple-listeners'

const MultipleListenerPage = () => (
  <div className="container">
    <Head>
      <title>{pageTitleBroadcaster}</title>
      <link rel="icon" href="/favicon.ico" />
    </Head>
    <MultipleStreamListener />
  </div>
)
export default MultipleListenerPage
