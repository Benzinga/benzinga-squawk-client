# Simple WebScoket client to receive Squawk RTP stream

## Overview
Squawk WebSocket client implementation for connecting to squawk and receiving RTP stream. This includes connecting to squawk WebSocket server and exchanging messages, mainly authentication and SDP negotiation, for receiving RTP stream on a specific IP:Port. You can review predefined message types and formats at https://docs.benzinga.io/benzinga/squawk-v2.html#using-rtp

## Prerequisites
1. [Java](https://www.oracle.com/technetwork/java/javase/downloads/index.html) >=1.8
2. [Maven](https://maven.apache.org/download.cgi)
3. API key for Benzinga Squawk. Contact Benzinga licensing team at  licensing@benzinga.com, if you don't have one.
4. Squawk WebSocket address. Contact Benzinga licensing team at  licensing@benzinga.com for that.
5. Publicly open and accessible IP and few ports, 5 should be enough, on your end. Multiple ports needed in case there are more than one broadcaster is active
6. [ffmpeg](https://www.ffmpeg.org/) command-line utility. It is for saving the incoming audio stream in a file using [StreamingSessionListener](src/main/java/com/benzinga/squawk/StreamingSessionListener.java). You can comment/remove that part from [SquawkWSClient](src/main/java/com/benzinga/squawk/SquawkWSClient.java) if you want to consume the incoming RTP differently.

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
| bz.squawk.addr        | BZ_SQUAWK_ADDR | Squawk websocket remote address
| bz.squawk.apiKey      | BZ_SQUAWK_APIKEY | API key received from Benzinga Licencing team 
| bz.squawk.room      | BZ_SQUAWK_ROOM | Room to join. It must be `PRO`
| bz.squawk.role      | BZ_SQUAWK_ROLE | Room to join. It must be `rtpreceiver`
| receiver.ip      | RECEIVER_IP | The IP address where you want to receive RTP stream. It must be publicly accessible IP
| receiver.ports      | RECEIVER_PORTS | Some open ports to receive RTP streams. It should be comma-separated int values. Need multiple ports opened in case of more than one broadcaster is active. Max 5 ports should be more than enough.

 Please note that if you set the environment variable for a config parameter, then the `application.conf` value will be overridden by the env values. 

## Verifying 

Once the authenticated and joined the room, there should be SDP negotiation when any Benzinga broadcaster joins in or right away if any active after joined room. SDP offer will use any available port from configured receiver.ports. On successful SDP negotiation, the generated SDP offer will be saved in a file named `input_audio_<broadcasterID>.sdp` under `<USER_HOME>/Documents/bz-squawk-sdpoffer`. So if there are multiple active broadcasters, there will be multiple files per broadcaster's session. You can use this file to verify the streaming. There are a couple of ways to do that.

- **Using ffmpeg:** This is the preferred way to verify the RTP stream. The idea is to dump the incoming RTP audio stream into the file and play it.

```
sudo ffmpeg -protocol_whitelist file,crypto,udp,rtp -acodec opus -i your-sdp-offer-file.sdp -acodec libopus out.ogg
```

And if you want an output file rotation with segments, for e.g. every 15 minutes

```
sudo ffmpeg -protocol_whitelist file,crypto,udp,rtp -acodec opus -i your-sdp-offer-file.sdp -acodec libopus -f segment -segment_atclocktime 1 -segment_time 900 -reset_timestamps 1 -strftime 1 out-%Y%m%dT%H%M.ogg
```
Keep the streaming ON for few minutes to receive several squawks. And then play the output file in any supported player.

- **Using VLC:**  Open the SDP offer file in the VLC player (Media > Open File) and wait for the next squawk from the Benzinga team. This option will probably work only if the VLC player is on the same machine where the stream is being delivered.


## Consuming the incoming streams

Consuming incoming stream mostly include forward/rebroadcast. The squawk RTP client provides [StreamingSessionListener](src/main/java/com/benzinga/squawk/StreamingSessionListener.java), which has callbacks `onBroadcasterJoined` and `onBroadcasterLeft`. It provides the associated [StreamingSession](src/main/java/com/benzinga/squawk/models/StreamingSession.java) for the broadcaster. It contains all the information required to consume/cutoff the stream.
