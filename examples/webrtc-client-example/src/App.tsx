import React, { Component} from 'react';
import logo from './logo.svg';
import {ReactComponent as Logo} from './assets/Benzinga-logo-navy.svg';
import { equals, forEach } from 'ramda';
import './App.css';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import SquawkSocket, { IncomingMessage, RequestType, RpcResponse, Notification, AuthResponse, JoinRoomResponse } from './squawk/SquawkSocket';
import BroadcastRoom from './squawk/BroadcastRoom';

// @ts-ignore import needed to better handle WebRtc spec changes for all browsers
import adapter from 'webrtc-adapter';

enum ConnectionState {
  stopped,
  connecting,
  connected,
  joined,
  receivingMedia,
  disconnected,
}

interface Props {}

interface State {
  readonly connectionState: ConnectionState;
  readonly connectionError: string | null;
  readonly isMuted: boolean;
  readonly volumeLevel: number;
}

const pingInterval = 25 * 1000;

const getStatusText = (connectionState: ConnectionState, error: string | null) => {
  if (error) {
    return error;
  }
  switch (connectionState) {
    case ConnectionState.stopped:
    default:
      return 'Stopped';

    case ConnectionState.connecting:
      return 'Connecting...';

    case ConnectionState.connected:
    case ConnectionState.joined:
      return 'Connected. Waiting for audio...';

    case ConnectionState.receivingMedia:
      return 'Connected. Receiving audio...';
  }
};

export type OnMessageReceived = (message: RpcResponse) => void;
export type OnNotificationReceived = (message: Notification) => void;

export class App extends Component<Props, State> {
  socket: SquawkSocket | null = null;
  broadcastRoom: BroadcastRoom | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      connectionState: ConnectionState.stopped,
      connectionError: null,
      isMuted: false,
      volumeLevel: 1,
    };
  }

  onVolumeChange = (value: number) => {
    this.setState({ volumeLevel: value }, this.setVolume);
    console.log("volume : " + value);
  };

  setVolume = () => {
    console.log("set volume");
  };

  connect = () => {
    this.socket = SquawkSocket.connect(this.onMessageReceived, this.onNotificationReceived);
    this.broadcastRoom = new BroadcastRoom(this.socket);
    this.setVolume();
    console.log("Connect called")
  }

  onMessageReceived = (response: RpcResponse) => {
    switch(response.type) {
      case RequestType.auth + "Response":
        const authResponse = response as AuthResponse;
        if (!this.broadcastRoom) {
          throw new Error('Broadcast room not available');
        }
        this.broadcastRoom.setIceServers(authResponse.iceServers);
        break;
      case RequestType.joinRoom + "Response":   
        const { volumeLevel } = this.state;
        const joinRoomResponse = response as JoinRoomResponse;
        forEach(presenter => {
          this.broadcastRoom!.addParticipant(presenter, volumeLevel, this.state.isMuted);
        }, joinRoomResponse.existingPresenters);     
        break;      
      case RequestType.receiveMedia + "Response":
        break;
      case RequestType.ping + "Response":
        break;
    }
  }

  onNotificationReceived = (notification: Notification) => {
    switch(notification.type) {

    }
  }

  disconnect = () => {
    console.log("Disconnect called")
  }

  renderPlayToggle() {    
    switch (this.state.connectionState) {
      case ConnectionState.joined:
      case ConnectionState.connected:  
      case ConnectionState.receivingMedia:
        return (
          <div onClick={this.disconnect}>
            <svg className="bi bi-pause-fill" width="1em" height="1em" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <path d="M5.5 3.5A1.5 1.5 0 017 5v6a1.5 1.5 0 01-3 0V5a1.5 1.5 0 011.5-1.5zm5 0A1.5 1.5 0 0112 5v6a1.5 1.5 0 01-3 0V5a1.5 1.5 0 011.5-1.5z"/>
            </svg>
          </div>
        );

      case ConnectionState.stopped:
        return (
          <div onClick={this.connect}>
            <svg className="bi bi-play-fill" width="2em" height="2em" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <path d="M11.596 8.697l-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 010 1.393z"/>
            </svg>
          </div>
        );
    }
  }

  render () {
    const { isMuted, volumeLevel } = this.state;
    return (
      <div className="App">
        <div id="bz3-header-menu">
        <div id="bz-logo">
          <a href="www.benzinga.com"><Logo />
          </a>
        </div>
        </div>
        <div id="content">
          <p>
            <a href="https://www.benzinga.com/apis/cloud-product/benzinga-squawk/" target="blank">Benzinga Squawk</a> is built on top of WebRTC. This is a sample WebRTC client. To know more about APIs please visit <a href="https://docs.benzinga.io/benzinga/squawk-v3.html" target="blank">docs</a>.
          </p>
          <div id="squawk-box">
            {/* <div className="controls">
              <a href="javascript:void(0)" className="audio-control">Play</a>
              <a href="javascript:void(0)" className="audio-control">Stop</a>
              <a href="javascript:void(0)" className="audio-control">Mute</a>
            </div> */}
            
              {this.renderPlayToggle()} 
              <div onClick={this.setVolume}>
                <svg className="bi bi-volume-mute-fill" width="2em" height="2em" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                  <path fill-rule="evenodd" d="M6.717 3.55A.5.5 0 017 4v8a.5.5 0 01-.812.39L3.825 10.5H1.5A.5.5 0 011 10V6a.5.5 0 01.5-.5h2.325l2.363-1.89a.5.5 0 01.529-.06zm7.137 1.596a.5.5 0 010 .708l-4 4a.5.5 0 01-.708-.708l4-4a.5.5 0 01.708 0z" clip-rule="evenodd"/>
                  <path fill-rule="evenodd" d="M9.146 5.146a.5.5 0 000 .708l4 4a.5.5 0 00.708-.708l-4-4a.5.5 0 00-.708 0z" clip-rule="evenodd"/>
                </svg>
              </div>
              <Slider
                className="Slider-track"
                max={1}
                min={0}
                onChange={this.onVolumeChange}              
                step={0.01}
                tipFormatter={null}
                value={volumeLevel}
              />
              <div onClick={this.setVolume}>
                <svg className="bi bi-volume-up-fill" width="2em" height="2em" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                  <path d="M11.536 14.01A8.473 8.473 0 0014.026 8a8.473 8.473 0 00-2.49-6.01l-.708.707A7.476 7.476 0 0113.025 8c0 2.071-.84 3.946-2.197 5.303l.708.707z"/>
                  <path d="M10.121 12.596A6.48 6.48 0 0012.025 8a6.48 6.48 0 00-1.904-4.596l-.707.707A5.483 5.483 0 0111.025 8a5.483 5.483 0 01-1.61 3.89l.706.706z"/>
                  <path d="M8.707 11.182A4.486 4.486 0 0010.025 8a4.486 4.486 0 00-1.318-3.182L8 5.525A3.489 3.489 0 019.025 8 3.49 3.49 0 018 10.475l.707.707z"/>
                  <path fill-rule="evenodd" d="M6.717 3.55A.5.5 0 017 4v8a.5.5 0 01-.812.39L3.825 10.5H1.5A.5.5 0 011 10V6a.5.5 0 01.5-.5h2.325l2.363-1.89a.5.5 0 01.529-.06z" clip-rule="evenodd"/>
                </svg> 
              </div>
            
            
            {/* <audio controls id="squawk-audio"/> */}
          </div>
        </div>
        
      </div>
    );
  }
}
