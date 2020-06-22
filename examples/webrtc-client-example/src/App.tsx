import React, { Component} from 'react';
import {ReactComponent as Logo} from './assets/Benzinga-logo-navy.svg';
import { equals, forEach } from 'ramda';
import './App.css';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import SquawkSocket, {RequestType, Notification, AuthResponseNotification, NotificationType, PresenterArrivedNotification, IceCandidateNotification, PresenterLeftNotification } from './sockets/SquawkSocket';
import BroadcastRoom from './squawk/BroadcastRoom';
import { isNull } from 'ramda-adjunct';

// @ts-ignore import needed to better handle WebRtc spec changes for all browsers
import adapter from 'webrtc-adapter';
import { Subscription } from 'rxjs';

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

const pingInterval = 1000 * 25;

export class App extends Component<Props, State> {
  socket: SquawkSocket | null = null;
  broadcastRoom: BroadcastRoom | null = null;
  subscriptions: [Subscription, Subscription] | null = null;
  pingTimer: number | null = null;

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
  };

  setVolume = () => {
    if (this.broadcastRoom) {
      const { volumeLevel } = this.state;
      this.broadcastRoom.setVolume(volumeLevel);
    }
  };

  toggleRoomMute = () => {
    if (this.broadcastRoom) {
      const { isMuted } = this.state;
      this.broadcastRoom.toggleMute(isMuted);
    }
  };
  
  toggleMute = () => {
    this.setState((prevState: State) => {
      if (!prevState) {
        return { isMuted: false };
      }
      return { isMuted: !prevState.isMuted };
    }, this.toggleRoomMute);
  };

  handleMediaOverride() {
    if (this.broadcastRoom) {
      console.log('Media override');
      this.broadcastRoom.dispose();
      alert("Squawk audio stopped! This account started playing from another session.")
      this.disconnectWithError('This account started playing from another session');
    }
  }

  joinRoom = () => {
    console.log('Joining room');
    return this.socket!.joinRoom('PRO').then(
      res => {
        const { volumeLevel } = this.state;
        forEach(presenter => {
          this.broadcastRoom!.addParticipant(presenter, volumeLevel, this.state.isMuted);
        }, res.existingPresenters);
      },
      error => {
        console.log('Not able to join room for the following reason:', error);
        return Promise.reject(error);
      },
    );
  };

  connect = () => {
    this.socket = SquawkSocket.connect();
    if (this.broadcastRoom) {
      this.broadcastRoom.dispose();
    }
    this.broadcastRoom = new BroadcastRoom({ socket: this.socket, onMediaStateChange: this.handleMediaStateChange });
    this.subscriptions = [
      this.socket.notifications$.subscribe(this.handleMessage.bind(this)),
      // skip first `disconnected` event
      this.socket.squawkConnectionStatus$!.subscribe(
        this.handleConnectionChange.bind(this),
        err => err,
        () => {
          this.disconnect();
        },
      ),
    ];
    this.setVolume();
  }
  
  handleConnectionChange = (status: number) => {
    if (equals(status, 1)) {
      console.log('Squawk connected');
      if (this.broadcastRoom) {
        this.broadcastRoom.dispose();
      }
      this.broadcastRoom = new BroadcastRoom({ socket: this.socket!, onMediaStateChange: this.handleMediaStateChange });
      this.startPing();
      this.startListening();
    } else if (equals(status, 0)) {
      console.log('Squawk disconnected');
      this.setDisconnected();
    }
  };

  setDisconnected() {
    this.stopPing();
    if (this.broadcastRoom) {
      this.broadcastRoom.dispose();
    }
    this.setState(prevState => {
      if (equals(prevState.connectionState, ConnectionState.stopped)) {
        return null;
      }
      return {
        connectionState: ConnectionState.disconnected,
        connectionError: 'Unable to connect. Retrying...',
      };
    });
  }

  stopPing() {
    if (isNull(this.pingTimer)) {
      return;
    }

    window.clearTimeout(this.pingTimer);
    this.pingTimer = null;
  }
  
  startPing = () => {
    this.pingTimer = window.setTimeout(() => {
      if (this.socket) {
        this.socket
          .ping()
          .then(this.startPing)
          .catch(error => {
            console.log('Failed to ping', error);
          });
      }
    }, pingInterval);
  };

  startConnect = () => {
    this.setState({ connectionState: ConnectionState.connecting, connectionError: null }, this.connect);
  };

  disconnectWithError(error: string) {
    this.setState({ connectionState: ConnectionState.stopped, connectionError: error }, this.disconnect);
  }

  startDisconnect = () => {
    this.setState({ connectionState: ConnectionState.stopped }, this.disconnect);
  };

  startListening = () => {
    if (!this.broadcastRoom) {
      console.log('Failed to start listening, no broadcastRoom available');
      this.disconnectWithError('WebRTC failed');
      return;
    }
    this.broadcastRoom.startListening().then(
      () => {
        this.setState({ connectionState: ConnectionState.joined });
      },
      error => {
        console.log('Failed to start listening', error);
        this.disconnectWithError('WebRTC failed');
      },
    );
  };

  handleMediaStateChange = (receivingMedia: boolean) => {
    this.setState({
      connectionState: receivingMedia ? ConnectionState.receivingMedia : ConnectionState.joined,
    });
  };

  handleMessage = (message: Notification) => {    
    if (isNull(message)) {
      return;
    }
    if (!this.broadcastRoom) {
      console.log('No broadcast room available');
      return;
    }    
    switch (message.type) {
      case RequestType.auth + "Response":
        if (!this.broadcastRoom) {
          throw new Error('Broadcast room not available');
        }
        message = message as AuthResponseNotification;
        this.broadcastRoom.setIceServers(message.iceServers); 
        this.joinRoom();
        break;
      case NotificationType.newPresenterArrived:
        console.log('New presenter arrived', message);
        const { volumeLevel, isMuted } = this.state;
        message = message as PresenterArrivedNotification;
        this.broadcastRoom.addParticipant(message.user, volumeLevel, isMuted);
        break;

      case NotificationType.iceCandidate:
        message = message as IceCandidateNotification;
        this.broadcastRoom.addIceCandidate(message);
        break;

      case NotificationType.presenterLeft:
        message = message as PresenterLeftNotification;
        console.log('Presenter left', message.userId);
        this.broadcastRoom.removeParticipant(message.userId);
        break;

      case NotificationType.mediaOverride:
        this.handleMediaOverride();
        break;

      default:
        console.log('Unrecognized message', message);
        break;
    }
  };

  disconnect = () => {
    if (this.socket) {
      this.socket.logout().then(
        response => {
          console.log('Stopped listening', response);
        },
        error => {
          console.log('Failed to stop listening', error);
        },
      );
      this.socket.disconnect();
    }
    if (this.broadcastRoom) {
      this.broadcastRoom.dispose();
    }
    this.close();
  }

  close() {
    if (this.subscriptions) {
      forEach(subscription => {
        subscription.unsubscribe();
      }, this.subscriptions);
    }
    this.stopPing();
    if (this.socket) {
      this.socket.close();
    }
    this.setState({
      connectionState: ConnectionState.stopped,
    });
  }

  renderStatusBar() {
    let currentStatus = "Disconnected/Stopped";
    switch (this.state.connectionState) {
      case ConnectionState.connecting:
        currentStatus = "Connecting...";
        break;
      case ConnectionState.joined:
      case ConnectionState.connected:  
        currentStatus = "Connected";
        break;
      case ConnectionState.receivingMedia:
        currentStatus = "Receiving Squawk Audio";
        break;
      case ConnectionState.stopped:
      case ConnectionState.disconnected:    
        currentStatus = "Disconnected/Stopped";
        break;
    }
    return (
      <div>
        <label>Status: </label>
        {currentStatus}
      </div>
    )
  }

  componentWillUnmount() {
    this.disconnect();
  }
  
  renderPlayToggle() {    
    switch (this.state.connectionState) {
      case ConnectionState.joined:
      case ConnectionState.connected:  
      case ConnectionState.receivingMedia:
        return (
          <div className="pointer" onClick={this.startDisconnect}>
            <svg className="bi bi-pause-fill" width="2em" height="2em" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <path d="M5.5 3.5A1.5 1.5 0 017 5v6a1.5 1.5 0 01-3 0V5a1.5 1.5 0 011.5-1.5zm5 0A1.5 1.5 0 0112 5v6a1.5 1.5 0 01-3 0V5a1.5 1.5 0 011.5-1.5z"/>
            </svg>
          </div>
        );

      case ConnectionState.stopped:
        return (
          <div className="pointer" onClick={this.connect}>
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
            <a href="https://www.benzinga.com/apis/cloud-product/benzinga-squawk/" target="blank">Benzinga Squawk</a> is built on top of WebRTC. This is a sample WebRTC client. To know more about APIs please visit <a href="https://docs.benzinga.io/benzinga/squawk-v3.html#using-webrtc" target="blank">docs</a>.
          </p>
          <div id="squawk-box">                       
              {this.renderPlayToggle()} 
              <div onClick={this.setVolume}>
                <svg className="bi bi-volume-mute-fill" width="2em" height="2em" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" d="M6.717 3.55A.5.5 0 017 4v8a.5.5 0 01-.812.39L3.825 10.5H1.5A.5.5 0 011 10V6a.5.5 0 01.5-.5h2.325l2.363-1.89a.5.5 0 01.529-.06zm7.137 1.596a.5.5 0 010 .708l-4 4a.5.5 0 01-.708-.708l4-4a.5.5 0 01.708 0z" clipRule="evenodd"/>
                  <path fillRule="evenodd" d="M9.146 5.146a.5.5 0 000 .708l4 4a.5.5 0 00.708-.708l-4-4a.5.5 0 00-.708 0z" clipRule="evenodd"/>
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
                  <path fillRule="evenodd" d="M6.717 3.55A.5.5 0 017 4v8a.5.5 0 01-.812.39L3.825 10.5H1.5A.5.5 0 011 10V6a.5.5 0 01.5-.5h2.325l2.363-1.89a.5.5 0 01.529-.06z" clipRule="evenodd"/>
                </svg> 
              </div>
              <div className="share-button" onClick={this.toggleMute}>
                <span>{isMuted ? 'UNMUTE' : 'MUTE'}</span>
              </div>
          </div>
          {this.renderStatusBar()}
        </div>
        
      </div>
    );
  }
}
