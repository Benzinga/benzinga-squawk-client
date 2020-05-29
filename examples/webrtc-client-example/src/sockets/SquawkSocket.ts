import fastStringify from 'fast-json-stable-stringify';
import ServerSocket, { BaseConnectionState, WebSocketPayload } from './ServerSocket';

import { equals, filter as ramdaFilter, includes } from 'ramda';
import { Observable, Subscription } from 'rxjs';
import { filter, map, timeout } from 'rxjs/operators';

import uuid from 'uuid/v4';

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
  authResponse = "authResponse"
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
  | PresenterLeftNotification
  | AuthResponseNotification;

export interface RpcRequest {
  type: RequestType;
  [key: string]: any;
}

interface RpcResponse {
  id: string;
  error?: string;
}

export type IceServers = RTCIceServer[];

export interface AuthResponseNotification {
  type: NotificationType.authResponse;
  iceServers: IceServers;
}

export interface SdpAnswerResponse {
  sdpAnswer: string;
}

export interface ParticipantSocket {
  sendIceCandidate(candidate: RTCIceCandidate, userId: string): Promise<void>;
  receiveMedia(sdpOffer: string, userId: string): Promise<SdpAnswerResponse>;
}

type IncomingMessage = RpcResponse | Notification;

const parseResponse = (response: WebSocketPayload): IncomingMessage => JSON.parse(response as string);

interface PendingRequest {
  resolve(res: RpcResponse): void;
  reject(err: Error): void;
}

const isResponse = (message: IncomingMessage): message is RpcResponse => 'id' in message;

const isNotification = (message: IncomingMessage): message is Notification => 'type' in message;

export default class SquawkSocket extends ServerSocket implements ParticipantSocket {
  private incomingMessages$!: Observable<IncomingMessage>;
  notifications$!: Observable<Notification>;
  private pendingRequests = new Map<string, PendingRequest>();
  private subscription: Subscription | null = null;
  private pongSubscription: Subscription | null = null;
  private lastPingIds: string[] = [];
  private ignoreTimeout = false;
  private statusSubscription: Subscription | null = null;

  static connect() {
    const socket = new SquawkSocket();
    socket.connect(window.env.SQUAWK_ADDR + "?jwt=" + window.env.JWT_TOKEN);
    //socket.connect("ws://localhost:8080/webrtc?jwt=eyJ0eXAiOiJKV1QiLCJraWQiOiJieiIsImFsZyI6IlJTMjU2In0.eyJraWQiOiJieiIsImlzcyI6InRyYWRldG9vbC5jb20iLCJzdWIiOiJkZDFhMjcyMC0xOTQyLTM3ZTktOWE4Ni1lNjgwMmM2NWI5Y2UiLCJpYXQiOjE1ODgwOTg3NjQsIm5iZiI6MTU4ODA5ODY0NCwiZXhwIjoxNTg4MDk4ODg0fQ.JDQwb18w84vqVGA0GySgi65yERSUn8S4jL9x4Tw7MFw3Qeb9lSSu8r4LuDU9CFmmoAk_RkTf6b058ho3IjirB4d3OXVxQOHD0wc1UOxY0Z6d3dO4i_DQ2pi70zxfC3oEvIIsuSrFUndLuiDZruKH1NcPUsJF47FW_nMpPO2c9GVnusXo5eKcvGvNzb4cxjS66_bOIK_bsPw6XvZUDw_DmgooXTXYwWLiAmSs28SFALsG78oIHli6kc9jk-AVyP5ZCXBf_s1gvqrBCrM0JKiGwv5WjrbDoDG4amgssW3I-lZfGHh4_unvDf87MO7cfLX6EvUpYM8VTVvBNyUaQK1A_Q");
    return socket;
  }

  connect(url: string) {
    super.connect(url);
    this.incomingMessages$ = this.messages$!.pipe(map(parseResponse));
    this.pongSubscription = this.incomingMessages$!.pipe(
      filter(isResponse),
      filter(val => (includes(val.id, this.lastPingIds) ? true : false)),
      timeout(PONG_AWAIT_TIME),
    ).subscribe(
      val => {
        this.lastPingIds = ramdaFilter(item => !equals(item, val.id), this.lastPingIds);
      },
      _ => {
        if (!this.ignoreTimeout) {
          this.disconnect();
        }
      },
    );
    this.statusSubscription = this.connectionStatus$.subscribe(msg => {
      this.ignoreTimeout = equals(msg, BaseConnectionState.disconnected) ? true : false;
    });
    this.notifications$ = this.incomingMessages$.pipe(filter(isNotification));
    this.subscription = this.incomingMessages$.pipe(filter(isResponse)).subscribe(this.handleResponse.bind(this));
  }

  disconnect() {
    super.disconnect();
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
    if (this.pongSubscription) {
      this.pongSubscription.unsubscribe();
      this.pongSubscription = null;
    }
    if (this.statusSubscription) {
      this.statusSubscription.unsubscribe();
      this.statusSubscription = null;
    }
  }

  private handleResponse = (response: RpcResponse) => {
    const pendingRequest = this.pendingRequests.get(response.id);
    if (!pendingRequest) {
      return;
    }
    this.pendingRequests.delete(response.id);

    if (response.error) {
      pendingRequest.reject(new Error(response.error));
    } else {
      pendingRequest.resolve(response);
    }
  };

  joinRoom(room: string): Promise<{ existingPresenters: Presenter[] }> {
    return this.request({
      room,
      type: RequestType.joinRoom,
    });
  }

  stopListening() {
    return this.request({ type: RequestType.stopListening });
  }

  receiveMedia(sdpOffer: string, userId: string): Promise<SdpAnswerResponse> {
    return this.request({
      sdpOffer,
      userId,
      type: RequestType.receiveMedia,
    });
  }

  sendIceCandidate(candidate: RTCIceCandidate, userId: string): Promise<void> {
    return this.request({
      candidate,
      userId,
      type: RequestType.iceCandidate,
    });
  }

  ping() {
    return this.request({ type: RequestType.ping });
  }

  logout() {
    return this.request({ type: RequestType.logout });
  }

  private request(request: RpcRequest): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      const requestId = uuid();
      if (equals(request.type, RequestType.ping)) {
        this.lastPingIds = [...this.lastPingIds.slice(1), requestId];
      }
      this.send(fastStringify({ ...request, id: requestId }));
      this.pendingRequests.set(requestId, { resolve, reject });
    });
  }

  close() {
    this.pendingRequests.clear();
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
    if (this.pongSubscription) {
      this.pongSubscription.unsubscribe();
      this.pongSubscription = null;
    }
    if (this.statusSubscription) {
      this.statusSubscription.unsubscribe();
      this.statusSubscription = null;
    }
  }
}
