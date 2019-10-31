# Simple WebScoket client to receive Squawk RTP stream

## Overview
Squawk WebSocket client implementation for connecting to squawk and receiving RTP stream. This includes connecting to squawk WebSocket server and exchanging messages, mainly authentication and SDP negotiation, for receiving RTP stream on a specific IP:Port. You can review predefined message types and formats at https://docs.benzinga.io/benzinga/squawk-v2.html#using-rtp

## Prerequisites
1. [Java](https://www.oracle.com/technetwork/java/javase/downloads/index.html) >=1.8
2. [Maven](https://maven.apache.org/download.cgi)
3. API key for Benzinga Squawk. Contact Benzinga licensing team at  licensing@benzinga.com, if you don't have one.
4. Squawk WebSocket address. Contact Benzinga licensing team at  licensing@benzinga.com for that.
5. Publicly open and accessible IP:Port on your end.

## Installing and Executing

~~~bash
git clone https://github.com/Benzinga/benzinga-squawk-client.git
cd benzinga-squawk-client/examples/rtp-receiver
mvn clean install
java -jar target/rtp-receiver-0.0.1-jar-with-dependencies.jar
~~~

Please note that the execution is dependent on configuration, which can be done by either changing config values in `src/main/resources/application.conf` or setting environment variables. The configuration parameter in `application.conf` includes the following:

| Config parameter       |  Equivalent Env variable  | Description
| ------------- |-------------| -----
| bz.squawk.apiKey      | BZ_SQUAWK_APIKEY | API key received from Benzinga Licencing team 
| bz.squawk.room      | BZ_SQUAWK_ROOM | Room to join. It must be `PRO`
| bz.squawk.role      | BZ_SQUAWK_ROLE | Room to join. It must be `rtpreceiver`
| receiver.ip      | RECEIVER_IP | The IP address where you want to receive RTP stream. It must be publicly accessible IP
| receiver.port      | RECEIVER_PORT | An open port to receive RTP stream.

 
Please note that if you set the environment variable for a config parameter, then the `application.conf` value will be overridden by the env value. 

## Verifying 

Once the authentication and SDP negotiation is successful, you should start receiving stream at configured `IP:Port`. The generated SDP offer will be saved under `<USER_HOME>/Documents/bz-squawk-sdpoffer/inputAudio.sdp` You can use this file to verify the streaming. Open this file in VLC player (Media > Open File) and wait for the next squawk from the Benzinga team.