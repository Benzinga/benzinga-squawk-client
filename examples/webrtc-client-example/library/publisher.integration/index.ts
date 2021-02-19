import SquawkSDK, { PublisherCallback, SquawkJS, TransportConfig } from '@benzinga/benzinga-squawk-sdk'

class BenzingaPublisherIntegration {
  private _transportConfig = {
    maxRetry: 10000,
    serverAddress: 'wss://squawk-lb.zingbot.bz/ws/v4/squawk',
  } as TransportConfig
  private _client: SquawkJS

  async initializeSDK(apiKeyType: string, key: string, callback: PublisherCallback): Promise<any> {
    let builder = new SquawkSDK.Builder(this._transportConfig, callback)
    if (apiKeyType === 'api-key') builder = builder.withApiKey()
    else if (apiKeyType === 'token') builder = builder.withJWT()
    else {
      // default is session based
      builder = builder.withSession()
    }
    // debug is on
    this._client = builder.asBroadcaster().build()
    return this._client.initialize(key)
  }

  async startBroadcast(channelId: number, element: any): Promise<any> {
    return this._client.startBroadcasting(channelId, element)
  }

  async stopBroadcast(channelId: number): Promise<void> {
    return this._client.stopBroadcasting(channelId)
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

export { BenzingaPublisherIntegration }
