import fastStringify from 'fast-json-stable-stringify';
import ServerSocket, { BaseConnectionState } from './ServerSocket';

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

interface RpcResponse {
  id: string;
  error?: string;
}

export type IceServers = RTCIceServer[];

export interface AuthResponse {
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

const parseResponse = (response: string): IncomingMessage => JSON.parse(response);

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
    socket.connect(window.env.SQUAWK_ADDR);
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

  authenticate(key: string, email: string, role: string): Promise<AuthResponse> {
    return this.request({
      key,
      name: email,
      role,
      type: RequestType.auth,
    });
  }

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
