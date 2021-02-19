import React, { ChangeEvent, forwardRef, useImperativeHandle, useRef, useState } from 'react'
import styles from './listener-demo.module.css'
import { AudioPlayer } from '../audio.player'
import { ViewStatus } from '../status'
import { PresenterState, RTCState, TransportState } from '@benzinga/benzinga-squawk-sdk'
import { BenzingaListenerIntegration } from '../../library/listener.integration'

interface Props {
  isInitialized: boolean
  sdkClient: BenzingaListenerIntegration
}
const SingleStreamListener = forwardRef(({ isInitialized, sdkClient }: Props, ref) => {
  const audioElement = useRef(null)
  const [streamId, setStreamId] = useState('0')
  const [remoteStream, setRemoteStream] = useState(null)
  const [isListening, setIsListening] = useState(false)
  const [rtcState, setRtcState] = useState(RTCState.closed)
  const [transportState, setTransportState] = useState(TransportState.disconnected)
  const [broadcasterState, setBroadcasterState] = useState(PresenterState.neutral)
  const [isMuted, setIsMuted] = useState(false)

  useImperativeHandle(ref, () => ({
    setIsListener(listening: boolean, channelId: number) {
      if (channelId !== parseInt(streamId, 10)) return
      setIsListening(listening)
    },
    setRemoteStream(stream: MediaStream, channelId: number) {
      if (channelId !== parseInt(streamId, 10)) return
      setRemoteStream(stream)
    },
    setRtcState(state: RTCState, channelId: number) {
      if (channelId !== parseInt(streamId, 10)) return
      setRtcState(state)
    },
    setTransportState(state: TransportState) {
      setTransportState(state)
    },
    setBroadcasterState(state: PresenterState, channelId: number) {
      if (channelId !== parseInt(streamId, 10)) return
      setBroadcasterState(state)
    },
  }))

  const _startListening = () => {
    const onSuccess = () => console.warn('Start listening')
    const onError = (e) => console.warn('Start listening failed', e)
    sdkClient
      .startListening(parseInt(streamId, 10), audioElement.current.getAudioElement().current)
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
  return (
    <div className={styles.container}>
      <div className={styles.sub_container}>
        <AudioPlayer ref={audioElement} stream={remoteStream} autoPlay={true} muted={false} />
      </div>
      <div className={styles.sub_container}>
        <div className={styles.name}>{'Channel ID'}</div>
        <div className={styles.details}>
          <input
            type="text"
            value={streamId}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setStreamId(e.currentTarget.value)}
          />
        </div>
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
  )
})

export { SingleStreamListener }
