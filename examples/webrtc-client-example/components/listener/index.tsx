import { keyOptionList, listenerDemo, listenerDemoDetails, pageTitleListener } from '../../library/constants'
import React, { useRef, useState } from 'react'
import { useUnmount } from 'react-use'
import { BenzingaListenerIntegration } from '../../library/listener.integration'
import styles from './listener-demo.module.css'
import { ListenerCallback, PresenterState, RTCState, TransportState } from '@benzinga/benzinga-squawk-sdk'
import { PageHead } from '../header'
import { DemoDetails } from '../demo.details'
import { AudioPlayer } from '../audio.player'
import { ClientDetails } from '../client.details'
import { ViewStatus } from '../status'

const Listener = () => {
  const childAudioElement = useRef(null)
  const [streamId, setStreamId] = useState('1')
  const [apiKey, setApiKey] = useState('Your API Key')
  const [apiKeyType, setApiKeyType] = useState(keyOptionList[0].value)
  const [isMuted, setIsMuted] = useState(false)
  const [sdkClient] = useState(new BenzingaListenerIntegration())
  const [rtcState, setRtcState] = useState(RTCState.closed)
  const [transportState, setTransportState] = useState(TransportState.disconnected)
  const [remoteStream, setRemoteStream] = useState(null)
  const [broadcasterState, setBroadcasterState] = useState(PresenterState.neutral)
  const [broadcasterAudioLevel, setBroadcasterAudioLevel] = useState(0)

  // current SDK status
  const [isInitialized, setIsInitialized] = useState(false)
  const [isListening, setIsListening] = useState(false)

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
  const _startListening = () => {
    const onSuccess = () => console.warn('Start listening')
    const onError = (e) => console.warn('Start listening failed', e)
    sdkClient
      .startListening(parseInt(streamId, 10), childAudioElement.current.getAudioElement().current)
      .then(onSuccess)
      .catch(onError)
  }
  const _stopListening = () => {
    const onSuccess = () => {
      setIsListening(false)
      // set rtc state to closed
      setRtcState(RTCState.closed)
      console.warn('Stop listening')
    }
    const onError = (e) => console.warn('Stop listening failed', e)
    sdkClient.stopListening(parseInt(streamId, 10)).then(onSuccess).catch(onError)
  }
  const _toggleAudio = () => {
    sdkClient.toggleAudio(parseInt(streamId, 10), isMuted ? false : true)
    setIsMuted(isMuted ? false : true)
  }
  const sdkCallback = {
    onMediaOverride(_: number) {
      console.warn('same listener is joined from another session')
      // update listener status
      setIsListening(false)
    },
    onRemoteStream(e: MediaStream | undefined, _: number) {
      setRemoteStream(e)
    },
    onRTCStateChange(rtcState: RTCState, channelId: number) {
      console.warn('rtc state has changed', rtcState, channelId)
      if (rtcState === RTCState.connected) {
        setIsListening(true)
      } else if (rtcState === RTCState.closed || rtcState === RTCState.failed) {
        // listener is now disconnected. SDK will re-try automatically
      } else if (rtcState === RTCState.neutral) {
        // something in the middle. Kind if in progress state.
      }
      setRtcState(rtcState)
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
      setTransportState(transportState)
    },
    onPresenterStateChange(presenterState: PresenterState, channelId: number) {
      console.warn('->', presenterState, channelId)
      setBroadcasterState(presenterState)
    },
  } as ListenerCallback

  useUnmount(async () => {
    await sdkClient?.dispose()
  })
  return (
    <div className={styles.container}>
      <PageHead pageTitle={pageTitleListener} />
      <DemoDetails demoTitle={listenerDemo} demoInfo={listenerDemoDetails} />
      <div className={styles.sub_container}>
        <AudioPlayer ref={childAudioElement} stream={remoteStream} autoPlay={true} muted={false} />
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
          <button disabled={!isInitialized || isListening} onClick={_startListening}>
            {'Start Listening'}
          </button>
          <button disabled={!isInitialized || !isListening} onClick={_stopListening}>
            {'Stop Listening'}
          </button>
          <button disabled={!isInitialized || !isListening} onClick={_toggleAudio}>
            {'Toggle Audio'}
          </button>
        </div>
        <ViewStatus
          isListener={true}
          channelId={streamId}
          rtcState={rtcState}
          transportState={transportState}
          isMuted={isMuted}
          broadcasterState={broadcasterState}
        />
      </div>
    </div>
  )
}

export { Listener }
