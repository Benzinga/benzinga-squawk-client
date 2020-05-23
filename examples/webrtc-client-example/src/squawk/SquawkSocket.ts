import { Observable, Subscription } from 'rxjs';
import ReconnectingWebSocket from 'reconnecting-websocket';

import uuid from 'uuid/v4';
import BroadcastRoom from './BroadcastRoom';
import { OnMessageReceived, OnNotificationReceived } from '../App';

const PONG_AWAIT_TIME = 1000 * 120;
export enum RequestType {
  auth = 'auth',
  joinRoom = 'joinRoom',
  logout = 'logout',
  iceCandidate = 'iceCandidate',
  ping = 'ping',
  receiveMedia = 'receiveMedia',
  stopListening = 'stopListening',
}

export enum NotificationType {
  iceCandidate = 'iceCandidate',
  mediaOverride = 'mediaOverride',
  newPresenterArrived = 'newPresenterArrived',
  presenterLeft = 'presenterLeft',
}

export interface Presenter {
  userId: string;
  username: string;
}

export interface PresenterArrivedNotification {
  type: NotificationType.newPresenterArrived;
  user: Presenter;
}

export interface IceCandidateNotification {
  candidate: RTCIceCandidate;
  userId: string;
  type: NotificationType.iceCandidate;
}

export interface PresenterLeftNotification {
  type: NotificationType.presenterLeft;
  userId: string;
}

export interface MediaOverrideNotification {
  type: NotificationType.mediaOverride;
}

export type Notification =
  | IceCandidateNotification
  | MediaOverrideNotification
  | PresenterArrivedNotification  
  | PresenterLeftNotification;

export interface RpcRequest {
  type: RequestType;
  [key: string]: any;
}

export interface RpcResponse {
  id: string;
  type: string;
  error?: string;  
}

export type IceServers = RTCIceServer[];

export interface AuthResponse extends RpcResponse {
  iceServers: IceServers;
}

export interface SdpAnswerResponse extends RpcResponse {
  sdpAnswer: string;
}

export interface JoinRoomResponse extends RpcResponse {
  existingPresenters: Presenter[];
}

export interface ParticipantSocket {
  sendIceCandidate(candidate: RTCIceCandidate, userId: string): void;
  receiveMedia(sdpOffer: string, userId: string): void;
}

enum Room {
  BZINTERNAL = 'BZINTERNAL',
  PRO = 'PRO',
}

export type IncomingMessage = RpcResponse | Notification;

const parseResponse = (response: string): IncomingMessage => JSON.parse(response);

interface PendingRequest {
  resolve(res: RpcResponse): void;
  reject(err: Error): void;
}

const isResponse = (message: IncomingMessage): message is RpcResponse => 'id' in message;

const isNotification = (message: IncomingMessage): message is Notification => !('id' in message);

export default class SquawkSocket implements ParticipantSocket {

  private socket: ReconnectingWebSocket | null = null;
  private onMessageReceivedCallback: OnMessageReceived | null = null;
  private onNotificationReceivedCallback: OnNotificationReceived | null = null;

  static connect(onMessageReceivedCallback: OnMessageReceived, onNotificationReceivedCallback: OnNotificationReceived) {
    const squawkSocket = new SquawkSocket();
    squawkSocket.socket = new ReconnectingWebSocket('ws://my.site.com');
    squawkSocket.socket.addEventListener('open', () => {
      squawkSocket.joinRoom();
    });
    squawkSocket.socket.addEventListener('message', (message: MessageEvent) => {
      squawkSocket.onMessage(message);
    });
    squawkSocket.onMessageReceivedCallback = onMessageReceivedCallback;
    squawkSocket.onNotificationReceivedCallback = onNotificationReceivedCallback;;
    return squawkSocket;    
  }

  private request(request: RpcRequest): string {    
    const requestId = uuid();
    this.socket?.send(JSON.stringify({ ...request, id: requestId }));
    return requestId;
    //this.pendingRequests.set(requestId, { resolve, reject });
  }

  private joinRoom() {
    this.request({
      room: Room.PRO,
      type: RequestType.joinRoom,
    });
  }


  private onMessage(event: MessageEvent) {
    const message = parseResponse(event.data);
    if (isResponse(message)) {
      this.handleResponse(message);
    } else if(isNotification(message)) {
      this.handleNotification(message);
    }
  }

  private handleResponse(response: RpcResponse) {
    switch(response.type) {
      case RequestType.auth + "Response":
        if (response.error) {
          console.log("Error occured while authenticating : " + response.error);
          this.socket?.close();
          return;
        }
        this.onMessageReceivedCallback!(response);
        this.joinRoom();
        break;
      case RequestType.joinRoom + "Response":
        if (response.error) {
          console.log("Error occured while joining room : " + response.error);
          this.socket?.close();
          return;
        }
        break;      
      case RequestType.receiveMedia + "Response":
        break;
      case RequestType.ping + "Response":
        break;
    }
    const { existingPresenters: Presenter[] } = response.;
  }

  private handleNotification(notification: Notification) {
    notification.
  }
  
  receiveMedia(sdpOffer: string, userId: string) {
    
  }

  sendIceCandidate(candidate: RTCIceCandidate, userId: string) {
    
  }


}