![alt text](https://raw.githubusercontent.com/Benzinga/benzinga-python-client/master/logo/Benzinga_Logo-navy.png)

# benzinga-squawk-client

## Overview
Squawk is a realtime broadcast service from Benzinga which includes important headlines, price movement, and rumors as stories develop to give traders and investors news in the fastest and most convenient form. This repo icludes sample applications, which aims to elaborate how you can connect to Squawk.

This particular demo contains WebRTC demo using Squawk WebRTC SDK. 

### [API documentation](https://www.npmjs.com/package/@benzinga/benzinga-squawk-sdk)

### How to run the demo ?

 - You need a valid Session, API Key, or JWT in order to run the demo. Please visit [the core API doc](https://docs.benzinga.io/benzinga/squawk-v4.html#Authenticate) on how to get a valid key
 - Install npm package
    - `npm ci`
 - Run the demo
    - `npm run dev`
 - Access the demo page from your browser ( Chrome recommended ) 
    - [http://localhost:3000/](http://localhost:3000/)


### About integrations
 - If you want to look into the core example implementation, you can visit directly
   - [listener core](/examples/webrtc-client-example/library/listener.integration/index.ts)
     - [react-integration](/examples/webrtc-client-example/components/listener/index.ts)
   - [broadcaster core](/examples/webrtc-client-example/library/publisher.integration/index.ts)
     - [react-integration](/examples/webrtc-client-example/components/broadcaster/index.ts)
