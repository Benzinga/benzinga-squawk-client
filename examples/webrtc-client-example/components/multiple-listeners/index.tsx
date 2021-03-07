import {
  keyOptionList,
  multipleListenerDemo,
  multipleListenerDemoDetails,
  pageTitleListener,
} from '../../library/constants'
import React, { useRef, useState } from 'react'
import { BenzingaListenerIntegration } from '../../library/listener.integration'
import styles from './listener-demo.module.css'
import { PageHead } from '../header'
import { DemoDetails } from '../demo.details'
import { ClientDetails } from '../client.details'
import { ListenerCallback, PresenterState, RTCState, TransportState } from '@benzinga/benzinga-squawk-sdk'
import { SingleStreamListener } from './single-stream-listener'

const MultipleStreamListener = () => {
  const [apiKey, setApiKey] = useState('Your API Key')
  const [apiKeyType, setApiKeyType] = useState(keyOptionList[0].value)
  const [sdkClient] = useState(new BenzingaListenerIntegration())
  const listeners = [useRef(null), useRef(null)]

  // current SDK status
  const [isInitialized, setIsInitialized] = useState(false)

  const _initializeSDK = () => {
    const onSuccess = () => console.warn('SDK initialized')
    const onError = (e) => console.warn('SDK initialization failed', e)
    sdkClient.initializeSDK(apiKeyType, apiKey, sdkCallback).then(onSuccess).catch(onError)
  }
  const _disposeSDK = () => {
    const onSuccess = () => console.warn('SDK disposed')
    const onError = (e) => console.warn('SDK disposed failed', e)
    const misc = () => {
      setIsInitialized(false)
    }
    sdkClient.dispose().then(onSuccess).catch(onError).finally(misc)
  }
  const sdkCallback = {
    onRemoteStream(e: MediaStream | undefined, channelId: number) {
      console.warn('got remote stream from', channelId)
      listeners.forEach((currentListener) => currentListener.current.setRemoteStream(e, channelId))
    },
    onTransportStateChange(transportState: TransportState) {
      console.warn('transport state has changed', transportState)
      if (transportState === TransportState.connected) {
        // transport is now connected and we can listen anytime. so update initialization state
        setIsInitialized(true)
      } else if (transportState === TransportState.disconnected) {
        // transport is now disconnected after maximum reconnect attempt reach.
        setIsInitialized(false)
      } else if (transportState === TransportState.neutral) {
        // something in the middle of connected or disconnecting. kind of in connecting/ retry state. we do nothing now
      }
      listeners.forEach((currentListener) => currentListener.current.setTransportState(transportState))
    },
    onPresenterStateChange(presenterState: PresenterState, channelId: number) {
      listeners.forEach((currentListener) => currentListener.current.setBroadcasterState(presenterState, channelId))
    },
    onMediaOverride(channelId: number) {
      console.warn('same listener is joined from another session', channelId)
      listeners.forEach((currentListener) => currentListener.current.setIsListener(false, channelId))
    },
    onRTCStateChange(rtcState: RTCState, channelId: number) {
      console.warn('rtc state has changed', rtcState, channelId)
      if (rtcState === RTCState.connected) {
        listeners.forEach((currentListener) => currentListener.current.setIsListener(true, channelId))
      } else if (rtcState === RTCState.closed || rtcState === RTCState.failed) {
        // listener is now disconnected. SDK will re-try automatically
      } else if (rtcState === RTCState.neutral) {
        // something in the middle. Kind if in progress state.
      }
      listeners.forEach((currentListener) => currentListener.current.setRtcState(rtcState, channelId))
    },
  } as ListenerCallback

  return (
    <div className={styles.container}>
      <PageHead pageTitle={pageTitleListener} />
      <DemoDetails demoTitle={multipleListenerDemo} demoInfo={multipleListenerDemoDetails} />
      <div className={styles.sub_container}>
        <ClientDetails
          showChannel={false}
          apiKey={apiKey}
          setApiKey={setApiKey}
          apiKeyType={apiKeyType}
          setApiKeyType={setApiKeyType}
        />
      </div>
      <div className={styles.control_field_contain}>
        <div className={styles.control_field_contain}>
          <button disabled={isInitialized} onClick={_initializeSDK}>
            {'Initialize SDK'}
          </button>
          <button disabled={!isInitialized} onClick={_disposeSDK}>
            {'Dispose SDK'}
          </button>
        </div>
        <div className={styles.control_field_contain} style={{ flex: '1' }}>
          <SingleStreamListener ref={listeners[0]} isInitialized={isInitialized} sdkClient={sdkClient} />
        </div>
        <div className={styles.control_field_contain} style={{ flex: '1' }}>
          <SingleStreamListener ref={listeners[1]} isInitialized={isInitialized} sdkClient={sdkClient} />
        </div>
      </div>
    </div>
  )
}

export { MultipleStreamListener }
