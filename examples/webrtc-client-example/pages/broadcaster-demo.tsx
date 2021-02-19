import { Broadcaster } from '../components/broadcaster'
import { pageTitleBroadcaster } from '../library/constants'
import Head from 'next/head'
import React from 'react'

const BroadcasterPage = () => (
  <div className="container">
    <Head>
      <title>{pageTitleBroadcaster}</title>
      <link rel="icon" href="/favicon.ico" />
    </Head>
    <Broadcaster />
  </div>
)
export default BroadcasterPage
