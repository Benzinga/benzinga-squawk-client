import React from 'react'
import TextTransition from 'react-text-transition'
import { PresenterState, RTCState, TransportState } from '@benzinga/benzinga-squawk-sdk'
import styles from './index.module.css'

export interface ViewStatusProps {
  transportState: TransportState
  rtcState: RTCState
  channelId: string
  broadcasterState?: PresenterState
  isListener: boolean
  isMuted: boolean
}

const ViewStatus = ({
  transportState,
  rtcState,
  broadcasterState,
  channelId,
  isListener,
  isMuted,
}: ViewStatusProps) => {
  return (
    <div className={styles.container}>
      <div className={styles.sub_container}>
        <div className={styles.name}>{'$Transport State : '}</div>
        <div className={styles.details}>
          <TextTransition text={transportState} />
        </div>
      </div>
      <div className={styles.sub_container}>
        <div className={styles.name}>{'$RTC State : '}</div>
        <div className={styles.details}>
          <TextTransition text={channelId} />
        </div>
        <div className={styles.details}>{'|'}</div>
        <div className={styles.details}>
          <TextTransition text={rtcState} />
        </div>
      </div>
      <div className={styles.sub_container}>
        <div className={styles.name}>{'$Audio State : '}</div>
        <div className={styles.details}>
          <TextTransition text={isMuted ? 'Muted' : 'Not Muted'} />
        </div>
      </div>
      {isListener && (
        <div className={styles.sub_container}>
          <div className={styles.name}>{'$Broadcaster State : '}</div>
          <div className={styles.details}>
            <TextTransition text={broadcasterState} />
          </div>
        </div>
      )}
    </div>
  )
}

export { ViewStatus }
