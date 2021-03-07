import { pageTitleBroadcaster } from '../library/constants'
import Head from 'next/head'
import React from 'react'
import { Listener } from '../components/listener'

const ListenerDemo = () => (
  <div className="container">
    <Head>
      <title>{pageTitleBroadcaster}</title>
      <link rel="icon" href="/favicon.ico" />
    </Head>
    <Listener />
  </div>
)
export default ListenerDemo
