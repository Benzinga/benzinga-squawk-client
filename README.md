![alt text](https://raw.githubusercontent.com/Benzinga/benzinga-python-client/master/logo/Benzinga_Logo-navy.png)

# benzinga-squawk-client

## Overview
Squawk is a realtime broadcast service from Benzinga which includes important headlines, price movement, and rumors as stories develop to give traders and investors news in the fastest and most convenient form. This repo icludes sample applications, which aims to elaborate how you can connect to Squawk.


## Connecting to Squawk

One can connect to squawk in the following ways:

1. **Connect directly to squawk through WebRTC:** With this option, you can connect directly to squawk from your web application and hear it from WebRTC supported browsers. More Information can be found at https://docs.benzinga.io/benzinga/squawk-v3.html#using-webrtc

2. **Connect for receiving RTP stream:** This option is the right choice if you want to re-broadcast squawk through your media server to your users. More information can be found at https://docs.benzinga.io/benzinga/squawk-v3.html#using-rtp

The `examples` folder includes sample applications that demonstrate how you can connect to squawk. It contains both WebRTC and RTP client examples. For more detail please get in touch with Benzinga licensing team at licensing@benzinga.com