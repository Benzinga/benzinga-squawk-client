import { QueueingSubject } from 'queueing-subject';
import { equals } from 'ramda';
import { BehaviorSubject, Observable, Subject, Subscription } from 'rxjs';
import makeWebSocketObservable, {
  GetWebSocketResponses,
  normalClosureMessage,
} from 'rxjs-websockets';
import { delay, filter, retryWhen, share, switchMap } from 'rxjs/operators';

export enum BaseConnectionState {
  disconnected,
  connected,
  default,
}

export default class ServerSocket {
  private inputStream$: QueueingSubject<string> = new QueueingSubject<string>();
  private errors$: Subject<Event> = new Subject<Event>();
  messages$: Observable<string> | null = null;;
  messagesSubscription: Subscription | null = null;
  connectionStatus$: BehaviorSubject<number> = new BehaviorSubject(BaseConnectionState.default);
    
  connect(url: string) {

    if (this.messages$) {
      return;
    }
    
    this.connectionStatus$ = new BehaviorSubject(BaseConnectionState.default);
    this.inputStream$ = new QueueingSubject<string>();

    const socket$ = makeWebSocketObservable(url);

    this.messages$ = socket$.pipe(
      switchMap((getResponses: GetWebSocketResponses<string>) => {
        this.connectionStatus$.next(BaseConnectionState.connected);
        return getResponses(this.inputStream$);
      }),
      retryWhen(errors => {
        errors.subscribe(this.errors$);        
        this.connectionStatus$.next(BaseConnectionState.disconnected);
        return errors.pipe(
                filter(err => !equals(err.message, normalClosureMessage)),
                delay(1000));
      }),
      share(),
    );

    this.errors$.subscribe(_ => this.connectionStatus$.next(BaseConnectionState.disconnected));

    this.messagesSubscription = this.messages$!.subscribe(
      _ => {
        return;
      },
      (error: Error) => {
        const { message } = error
        this.connectionStatus$.next(BaseConnectionState.disconnected);
        if (message !== normalClosureMessage) {          
          console.log('Squawk socket was disconnected due to error:', message)
        }
      },
      () => {
        // The clean termination only happens in response to the last
        // subscription to the observable being unsubscribed, any
        // other closure is considered an error.
        this.connectionStatus$.next(BaseConnectionState.disconnected);
        console.log('Squawk socket connection was closed in response to the user')
      },
    )
  }
  
  protected disconnect() {
    const localSub = this.connectionStatus$.subscribe(msg => {
      if (equals(msg, BaseConnectionState.connected)) {
        this.connectionStatus$.complete();
      }
    });
    localSub.unsubscribe();
    if (this.messagesSubscription) {
      this.messagesSubscription.unsubscribe();
    }
    this.messages$ = null;
  }

  protected send(message: string) {
    try {
      this.inputStream$.next(message);
    } catch (error) {
      console.log("Message send error: ", error);
    }
  }
}
