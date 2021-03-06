import React from 'react'
import Head from 'next/head'
import { pageTitleBroadcaster, sdkDemo } from '../../library/constants'
import Link from 'next/link'
import styles from './home.module.css'

const HomeContainer = () => {
  return (
    <div className={styles.container}>
      <Head>
        <title>{pageTitleBroadcaster}</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className={styles.title}>{sdkDemo}</div>
      <div className={styles.demo_list_container}>
        <div className={styles.demo_container}>
          <Link href={'/broadcaster-demo'}>
            <a className={styles.demo_link}>{'Broadcaster demo'}</a>
          </Link>
        </div>
        <div className={styles.demo_container}>
          <Link href={'/listener-demo'}>
            <a className={styles.demo_link}>{'Listener demo'}</a>
          </Link>
        </div>
        <div className={styles.demo_container}>
          <Link href={'/multiple-listener-demo'}>
            <a className={styles.demo_link}>{'Multiple listeners demo'}</a>
          </Link>
        </div>
      </div>
    </div>
  )
}

export { HomeContainer }
