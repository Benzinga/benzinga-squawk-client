import { broadcasterDemo, broadcasterDemoDetails, keyOptionList, pageTitleBroadcaster } from '../../library/constants'
import React, { useRef, useState } from 'react'
import { useUnmount } from 'react-use'
import { BenzingaPublisherIntegration } from '../../library/publisher.integration'
import styles from './broadcaster-demo.module.css'
import { PublisherCallback, RTCState, TransportState } from '@benzinga/benzinga-squawk-sdk'
import { PageHead } from '../header'
import { DemoDetails } from '../demo.details'
import { AudioPlayer } from '../audio.player'
import { ClientDetails } from '../client.details'
import { ViewStatus } from '../status'

const Broadcaster = () => {
  const childAudioElement = useRef(null)
  const [streamId, setStreamId] = useState('1')
  const [apiKey, setApiKey] = useState('Your API Key')
  const [apiKeyType, setApiKeyType] = useState(keyOptionList[0].value)
  const [isMuted, setIsMuted] = useState(false)
  const [sdkClient] = useState(new BenzingaPublisherIntegration())
  const [rtcState, setRtcState] = useState(RTCState.closed)
  const [transportState, setTransportState] = useState(TransportState.disconnected)
  const [localStream, setLocalStream] = useState(null)

  // current SDK status
  const [isInitialized, setIsInitialized] = useState(false)
  const [isBroadcasting, setIsBroadcasting] = useState(false)

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
      setRtcState(RTCState.closed)
      setTransportState(TransportState.disconnected)
    }
    sdkClient.dispose().then(onSuccess).catch(onError).finally(misc)
  }
  const _startBroadcast = () => {
    const onSuccess = () => console.warn('Start broadcasting')
    const onError = (e) => console.warn('Start broadcasting failed', e)
    sdkClient
      .startBroadcast(parseInt(streamId, 10), childAudioElement.current.getAudioElement().current)
      .then(onSuccess)
      .catch(onError)
  }
  const _stopBroadcast = () => {
    const onSuccess = () => {
      setIsBroadcasting(false)
      // set rtc state to closed
      setRtcState(RTCState.closed)
      console.warn('Stop broadcasting')
    }
    const onError = (e) => console.warn('Stop broadcasting failed', e)
    sdkClient.stopBroadcast(parseInt(streamId, 10)).then(onSuccess).catch(onError)
  }
  const _toggleAudio = () => {
    sdkClient.toggleAudio(parseInt(streamId, 10), isMuted ? false : true)
    setIsMuted(isMuted ? false : true)
  }
  const sdkCallback = {
    onBroadcasterLeft(name: string, streamId: number, userId: string) {
      console.warn(`a broadcaster has left `, name, streamId, userId)
    },
    onBroadcastOverride() {
      console.warn('same broadcaster is joined from another session')
      // update broadcaster status
      setIsBroadcasting(false)
    },
    onLocalStream(e: MediaStream | undefined) {
      setLocalStream(e)
    },
    onNewBroadcaster(name: string, streamId: number, userId: string) {
      console.warn('a new broadcaster has joined', name, streamId, userId)
    },
    onRTCStateChange(rtcState: RTCState, channelId: number) {
      console.warn('rtc state has changed', rtcState, channelId)
      if (rtcState === RTCState.connected) {
        setIsBroadcasting(true)
      } else if (rtcState === RTCState.closed || rtcState === RTCState.failed) {
        // broadcaster is now disconnected. SDK will re-try automatically
      } else if (rtcState === RTCState.neutral) {
        // something in the middle. Kind if in progress state.
      }
      setRtcState(rtcState)
    },
    onTransportStateChange(transportState: TransportState) {
      console.warn('transport state has changed', transportState)
      if (transportState === TransportState.connected) {
        // transport is now connected and we can broadcast anytime. so update initialization state
        setIsInitialized(true)
      } else if (transportState === TransportState.disconnected) {
        // transport is now disconnected after maximum reconnect attempt reach.
        setIsInitialized(false)
      } else if (transportState === TransportState.neutral) {
        // something in the middle of connected or disconnecting. kind of in connecting/ retry state. we do nothing now
      }
      setTransportState(transportState)
    },
  } as PublisherCallback

  useUnmount(async () => {
    await sdkClient?.dispose()
  })
  return (
    <div className={styles.container}>
      <PageHead pageTitle={pageTitleBroadcaster} />
      <DemoDetails demoTitle={broadcasterDemo} demoInfo={broadcasterDemoDetails} />
      <div className={styles.sub_container}>
        <AudioPlayer ref={childAudioElement} stream={localStream} muted={true} autoPlay={true} />
        <ClientDetails
          showChannel={true}
          streamId={streamId}
          setStreamId={setStreamId}
          apiKey={apiKey}
          setApiKey={setApiKey}
          apiKeyType={apiKeyType}
          setApiKeyType={setApiKeyType}
        />
        <div className={styles.control_field_contain}>
          <button disabled={isInitialized} onClick={_initializeSDK}>
            {'Initialize SDK'}
          </button>
          <button disabled={!isInitialized} onClick={_disposeSDK}>
            {'Dispose SDK'}
          </button>
        </div>
        <div className={styles.control_field_contain}>
          <button disabled={!isInitialized || isBroadcasting} onClick={_startBroadcast}>
            {'Start Broadcast'}
          </button>
          <button disabled={!isInitialized || !isBroadcasting} onClick={_stopBroadcast}>
            {'Stop Broadcast'}
          </button>
          <button disabled={!isInitialized || !isBroadcasting} onClick={_toggleAudio}>
            {'Toggle Audio'}
          </button>
        </div>
        <ViewStatus
          isListener={false}
          channelId={streamId}
          rtcState={rtcState}
          transportState={transportState}
          isMuted={isMuted}
        />
      </div>
    </div>
  )
}

export { Broadcaster }
