import { QueueingSubject } from 'queueing-subject';
import { equals } from 'ramda';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import websocketConnect from 'rxjs-websockets';
import { delay, filter, map, retryWhen, share, switchMap } from 'rxjs/operators';

const NORMAL_CLOSE_ERROR = 'Normal closure';
export enum SpecialMessages {
  forceReconnect = 'forceReconnect',
}
type WebSocketPayload = string | ArrayBuffer | Blob;

export type GetWebSocketResponses<T = WebSocketPayload> = (input$: Observable<WebSocketPayload>) => Observable<T>;

export enum BaseConnectionState {
  disconnected,
  connected,
  default,
}

export default class ServerSocket {
  private inputStream$: QueueingSubject<string> = new QueueingSubject<string>();
  private errors$: Subject<Event> = new Subject<Event>();
  messages$: Observable<string> | null = null;
  connectionStatus$: BehaviorSubject<number> = new BehaviorSubject(0);

  protected connect(url: string) {
    if (this.messages$) {
      return;
    }

    if (process.env.MOCK_SOCKETS) {
      this.messages$ = this.inputStream$.asObservable().pipe(share());
      this.connectionStatus$.next(BaseConnectionState.disconnected);
      this.connectionStatus$.next(BaseConnectionState.connected);

      return;
    }

    const socket$ = websocketConnect(url, {
      protocols: [],
    });

    const messages$ = socket$.pipe(
      switchMap((getResponses: GetWebSocketResponses<string>) => {
        this.connectionStatus$.next(BaseConnectionState.connected);
        return getResponses(this.inputStream$);
      }),
      map(val => {
        if (equals(val, SpecialMessages.forceReconnect)) {
          throw val;
        }
        return val;
      }),
      share(),
    );

    const retriedMessages$ = messages$.pipe(
      retryWhen(errors$ => {
        errors$.subscribe(this.errors$);
        this.connectionStatus$.next(BaseConnectionState.disconnected);
        return errors$.pipe(
          filter(err => !equals(err.message, NORMAL_CLOSE_ERROR)),
          delay(1000),
        );
      }),
    );
    this.errors$.subscribe(_ => this.connectionStatus$.next(BaseConnectionState.disconnected));

    this.messages$ = retriedMessages$.pipe(share());

    this.messages$!.subscribe(
      _ => {
        return;
      },
      (_: Error) => {
        this.connectionStatus$.next(BaseConnectionState.disconnected);
      },
      () => {
        this.connectionStatus$.next(BaseConnectionState.disconnected);
      },
    );

    this.connectionStatus$.next(BaseConnectionState.disconnected);
  }

  errorStream$(): Observable<Event> {
    return this.errors$.asObservable();
  }

  protected disconnect() {
    const localSub = this.connectionStatus$.subscribe(msg => {
      if (equals(msg, BaseConnectionState.connected)) {
        this.connectionStatus$.complete();
      }
    });
    localSub.unsubscribe();
  }

  protected send(message: string) {
    try {
      this.inputStream$.next(message);
    } catch (error) {
      console.log("Message send error: ", error);
    }
  }
}
