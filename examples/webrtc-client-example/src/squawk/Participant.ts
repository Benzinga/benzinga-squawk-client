import { IceServers, ParticipantSocket } from './SquawkSocket';
import { createPeer, onMediaStateChange, Peer, SignalingChannel } from './Peer';

export class Participant {
  audio: HTMLAudioElement;
  peer: Peer | null = null;
  signalingChannel: SignalingChannel;
  socket: ParticipantSocket;
  userId: string;
  username: string;
  
  constructor({
    isMuted,
    socket,
    userId,
    username,
    volume,    
  }: {
    isMuted: boolean;
    socket: ParticipantSocket;
    userId: string;
    username: string;
    volume: number;    
  }) {
    this.audio = document.createElement('audio');
    this.audio.autoplay = true;
    this.audio.controls = false;
    this.audio.muted = isMuted;
    this.audio.volume = volume;
    this.userId = userId;
    this.username = username;
    this.socket = socket;        
    this.signalingChannel = {
      sendSdpOffer(sdpOffer: string) {
        return socket.receiveMedia(sdpOffer, userId);
      },

      sendIceCandidate(candidate: RTCIceCandidate) {
        return socket.sendIceCandidate(candidate, userId);
      },
    };
  }

  startListening(iceServers: IceServers, onMediaStateChange: onMediaStateChange) {
    const peerOptions = {
      onMediaStateChange,
      options: {
        remoteVideo: this.audio,
        mediaConstraints: {
          audio: true,
          video: false,
        },
        configuration: {
          iceServers,
        },
      },
      receiveOnly: true,
      signalingChannel: this.signalingChannel,
    };
    return createPeer(peerOptions).then(peer => {
      this.peer = peer;
      return this.peer.startMediaExchange();
    });
  }

  addIceCandidate(candidate: RTCIceCandidate) {
    if (this.peer) {
      return this.peer.addIceCandidate(candidate);
    }
  }

  setVolume(volume: number) {
    this.audio.volume = volume;
  }

  toggleMute(isMuted: boolean) {
    this.audio.muted = isMuted;
  }

  dispose() {
    if (this.peer) {
      this.peer.dispose();
      this.peer = null;
    }
    this.audio!.remove();
  }
}
