import SquawkSDK, { ListenerCallback, SquawkJS, TransportConfig } from '@benzinga/benzinga-squawk-sdk'

class BenzingaListenerIntegration {
  private _transportConfig = {
    connectionTimeoutInMs: 15000,
    requestTimeoutInMs: 15000,
    serverAddress: 'wss://squawk-lb.zingbot.bz/ws/v4/squawk',
  } as TransportConfig
  private _client: SquawkJS

  async initializeSDK(apiKeyType: string, key: string, callback: ListenerCallback): Promise<any> {
    let builder = new SquawkSDK.Builder({
      maxRetry: 10000,
      maxRetryIntervalInMs: 15000,
      retryIntervalBackoffInMs: 15000,
      retryIntervalInMs: 15000,
    },this._transportConfig, callback)
    if (apiKeyType === 'api-key') builder = builder.withApiKey()
    else if (apiKeyType === 'token') builder = builder.withJWT()
    else {
      // default is session based
      builder = builder.withSession()
    }
    // debug is on
    this._client = builder.asListener().build()
    return this._client.initialize(key)
  }

  async startListening(channelId: number, element: any): Promise<any> {
    return this._client.subscribeChannel(channelId, element)
  }

  async stopListening(channelId: number): Promise<void> {
    return this._client.unsubscribeChannel(channelId)
  }

  async getAvailableStream(): Promise<any> {
    return this._client.getAvailableChannels()
  }

  toggleAudio(channelId: number, makeMute: boolean): void {
    if (makeMute) this._client.muteChannel(channelId)
    else this._client.unMuteChannel(channelId)
  }

  async dispose(): Promise<void> {
    try {
      await this._client?.stop()
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(e)
    } finally {
      this._client = undefined
    }
  }
}

export { BenzingaListenerIntegration }
