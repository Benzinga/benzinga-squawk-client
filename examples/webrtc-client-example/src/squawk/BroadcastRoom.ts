import SquawkSocket, { IceServers, Presenter } from '../sockets/SquawkSocket';
import { Participant } from './Participant';
import { onMediaStateChange } from './Peer';
import { map } from 'ramda';

interface BroadcastRoomOptions {
  onMediaStateChange: onMediaStateChange;
  socket: SquawkSocket;
}

export default class BroadcastRoom {
  participants = new Map<string, Participant>();
  socket: SquawkSocket;
  onMediaStateChange: onMediaStateChange;
  activeBroadcasters = new Set<string>();
  listening: boolean = false;
  iceServers: IceServers = [];

  constructor({ socket, onMediaStateChange }: BroadcastRoomOptions) {
    this.onMediaStateChange = onMediaStateChange;
    this.socket = socket;
  }

  addIceCandidate({ userId, candidate }: { userId: string; candidate: RTCIceCandidate }) {
    const participant = this.participants.get(userId);
    if (participant) {
      participant.addIceCandidate(candidate);
    } else {
      console.log('addIceCandidate: failed to find participant', userId);
    }
  }

  addParticipant = ({ userId, username }: Presenter, volume: number, isMuted: boolean) => {
    if (this.participants.has(userId)) {
      console.log('Participant already exists', userId);
      return;
    }
    const participant = new Participant({ isMuted, userId, username, socket: this.socket, volume });
    this.participants.set(userId, participant);
    if (this.listening) {
      this.listenFrom(participant);
    }
  };

  private listenFrom = (participant: Participant) => {
    return participant
      .startListening(this.iceServers, this.handleMediaStateChange.bind(this, participant.userId))
      .catch(error => {
        console.log('Failed to start listening', error);
        // TODO propagate
      });
  };

  private handleMediaStateChange(userId: string, receivingMedia: boolean) {
    if (receivingMedia) {
      this.activeBroadcasters.add(userId);
    } else {
      this.activeBroadcasters.delete(userId);
    }
    this.onMediaStateChange(this.activeBroadcasters.size > 0);
  }

  setIceServers(iceServers: IceServers) {
    this.iceServers = iceServers;
  }

  startListening() {
    this.listening = true;
    return Promise.all(map(this.listenFrom, [...this.participants.values()]));
  }

  stopListening() {
    const wasListening = this.participants.size > 0;
    this.dispose();
    if (wasListening) {
      return this.socket.stopListening();
    }
    return Promise.resolve();
  }

  removeParticipant(userId: string) {
    const participant = this.participants.get(userId);
    if (participant) {
      participant.dispose();
      this.participants.delete(userId);
      if (this.activeBroadcasters.has(userId)) {
        this.handleMediaStateChange(userId, false);
      }
    } else {
      console.log('Failed to find participant', userId);
    }
  }

  setVolume(volume: number) {
    this.participants.forEach(participant => {
      participant.setVolume(volume);
    });
  }

  toggleMute(isMuted: boolean) {
    map(participant => participant.toggleMute(isMuted), [...this.participants.values()]);
  }

  dispose() {
    this.listening = false;
    this.activeBroadcasters.clear();
    this.participants.forEach(participant => {
      participant.dispose();
    });
    this.participants.clear();
  }
}
