import hark, { Harker } from 'hark';
import kurentoUtils, { WebRtcPeer } from 'kurento-utils';

export interface SignalingChannel {
  sendIceCandidate(candidate: RTCIceCandidate): Promise<any>;
  sendSdpOffer(sdpOffer: string): Promise<any>;
}

export type onMediaStateChange = (receivingMedia: boolean) => void;

export class Peer {
  audioMonitor?: Harker;
  onMediaStateChange: onMediaStateChange;
  signalingChannel: SignalingChannel;
  webRtcPeer: WebRtcPeer;

  constructor({
    onMediaStateChange,
    signalingChannel,
    webRtcPeer,
  }: {
    onMediaStateChange: onMediaStateChange;
    signalingChannel: SignalingChannel;
    webRtcPeer: WebRtcPeer;
  }) {    
    this.onMediaStateChange = onMediaStateChange;
    this.signalingChannel = signalingChannel;
    this.webRtcPeer = webRtcPeer;
  }

  startMediaExchange() {
    return new Promise<string>((resolve, reject) => {
      this.webRtcPeer.generateOffer((error: string | undefined, sdpOffer: string) => {
        if (error) {
          reject(error);
        } else {
          resolve(sdpOffer);
        }
      });
    }).then(
      sdpOffer => this.sendMediaOffer(sdpOffer),
      err => {
        console.log('Failed to generate SDP offer', err);
        return Promise.reject(err);
      },
    );
  }

  getIceConnectionState() {
    return this.webRtcPeer.peerConnection.iceConnectionState;
  }

  addIceCandidate(candidate: RTCIceCandidate) {
    return this.webRtcPeer.addIceCandidate(candidate);
  }

  sendMediaOffer(sdpOffer: string) {
    return this.signalingChannel
      .sendSdpOffer(sdpOffer)
      .then(res => {
        console.log('Started broadcasting', res);
        console.log('Processing SDP answer', res.sdpAnswer);
        this.webRtcPeer.on('icecandidate', this.onIceCandidate);
        this.webRtcPeer.peerConnection.addEventListener('track', this.onTrack);
        return res;
      })
      .then(
        ({ sdpAnswer }) =>
          new Promise<void>((resolve, reject) => {
            this.webRtcPeer.processAnswer(sdpAnswer, (error: any) => {
              if (error) {
                reject(error);
              } else {
                resolve();
              }
            });
          }),
      );
  }

  onIceCandidate = (candidate: RTCIceCandidate) => {
    console.log('Received ice candidate', candidate);
    this.signalingChannel.sendIceCandidate(candidate).then(
      res => {
        console.log('broadcastIceCandidate response', res);
      },
      err => {
        console.log('Failed to broadcast ice candidate', err);
      },
    );
  };

  onTrack = (event: any) => {
    this.audioMonitor = hark(event.streams[0], { threshold: -70 });
    this.audioMonitor.on('speaking', () => {
      this.onMediaStateChange(true);
    });
    this.audioMonitor.on('stopped_speaking', () => {
      this.onMediaStateChange(false);
    });
  };

  dispose() {
    this.webRtcPeer.dispose();
    this.webRtcPeer.peerConnection.removeEventListener('track', this.onTrack);
    if (this.audioMonitor) {
      this.audioMonitor.stop();
    }
  }
}

//TODO: Look for a way to shape webrtc peer options (KurentoUtils does not have defined yet)
interface PeerOptions {
  onMediaStateChange: onMediaStateChange;
  options: object;
  receiveOnly: boolean;
  signalingChannel: SignalingChannel;  
}

export function createPeer({
  onMediaStateChange,
  options,
  receiveOnly = false,
  signalingChannel,  
}: PeerOptions): Promise<Peer> {
  return new Promise<any>((resolve, reject) => {
    const WebRtcPeer = receiveOnly
      ? kurentoUtils.WebRtcPeer.WebRtcPeerRecvonly
      : kurentoUtils.WebRtcPeer.WebRtcPeerSendrecv;

    // @ts-ignore
    const webrtcPeer = new WebRtcPeer(options, (error: any) => {
      // const webrtcPeer = new (WebRtcPeer as any)(options, (error: any) => {
      if (error) {
        reject(error);
      } else {
        resolve(webrtcPeer);
      }
    });
  }).then(webRtcPeer => new Peer({ onMediaStateChange, signalingChannel, webRtcPeer }));
}
