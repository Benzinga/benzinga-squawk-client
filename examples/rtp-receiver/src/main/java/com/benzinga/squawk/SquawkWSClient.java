package com.benzinga.squawk;

import java.io.BufferedWriter;
import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.HashMap;
import java.util.Map;
import java.util.Stack;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import org.java_websocket.client.WebSocketClient;
import org.java_websocket.handshake.ServerHandshake;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import com.benzinga.squawk.models.ActiveBroadcastersResponse;
import com.benzinga.squawk.models.Broadcaster;
import com.benzinga.squawk.models.StreamingSession;
import com.fasterxml.uuid.Generators;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonObject;
import com.typesafe.config.Config;
import com.typesafe.config.ConfigFactory;

/**
 * Class {@code SquawkWSClient} is the Web Socket client,
 * which connects to squawk WS and do message exchanges for
 * authentication, SDP negotiation, logout etc
 *
 */
public class SquawkWSClient extends WebSocketClient {
   
  private static final Logger log = LoggerFactory.getLogger(SquawkWSClient.class);
  private final Gson gson = new GsonBuilder().create();
  private final Config conf;  
  
  private final StreamingSessionListener sessionListener;
  
  private static final String MESSAGE_TYPE_AUTH = "auth";
  private static final String MESSAGE_TYPE_JOIN_ROOM = "joinRoom";
  private static final String MESSAGE_TYPE_PING = "ping";  
  private static final String MESSAGE_TYPE_RECEIVE_MEDIA = "receiveMedia";
  private static final String MESSAGE_TYPE_LOGOUT = "logout";
  private static final String MESSAGE_TYPE_MEDIA_OVERRIDE = "mediaOverride";
  private static final String MESSAGE_TYPE_NEW_PRESENTER_ARRIVED = "newPresenterArrived";  
  private static final String MESSAGE_TYPE_PRESENTER_LEFT = "presenterLeft";
  
  // The retry interval in seconds for reconnecting after WS connection closed unexpectedly.  
  private static final long CONNECTION_RETRY_INTERVAL = 20L;
  // For what period of time the client should keep retrying at CONNECTION_RETRY_INTERVAL
  private static final long RETRY_PERIOD = 60L * 15L;
    
  ScheduledExecutorService scheduledExecutorService;
  
  private final Stack<Integer> availablePorts = new Stack<Integer>();
  private Map<String, StreamingSession> activeStreams = new HashMap<String, StreamingSession>();

  // Map of messageId:broadcasterId of sdp offer
  private Map<String, String> pendingSdpAnswers = new HashMap<String, String>();
    
  private boolean shouldRetryConnection = true;
  
  public SquawkWSClient(String serverURI, Config conf, StreamingSessionListener sessionListener) throws URISyntaxException {
    super(new URI(serverURI));        
    this.conf = conf;
    this.availablePorts.addAll(conf.getIntList("receiver.ports"));
    this.sessionListener = sessionListener;
    this.setConnectionLostTimeout(30);
  }
  
  public SquawkWSClient(URI serverURI, Config conf, StreamingSessionListener sessionListener) {
      super( serverURI );
      this.conf = conf;
      this.availablePorts.addAll(conf.getIntList("receiver.ports"));
      this.sessionListener = sessionListener;
      this.setConnectionLostTimeout(30);
  }

  public SquawkWSClient(URI serverUri, Map<String, String> httpHeaders, Config conf, StreamingSessionListener sessionListener) {
      super(serverUri, httpHeaders);
      this.conf = conf;
      this.availablePorts.addAll(conf.getIntList("receiver.ports"));
      this.sessionListener = sessionListener;
      this.setConnectionLostTimeout(30);
  }

  @Override
  public void onOpen( ServerHandshake handshakedata ) {
      log.info("WebSocket connection opened");    
      if (null != scheduledExecutorService && !scheduledExecutorService.isShutdown()) {        
        scheduledExecutorService.shutdownNow();
        // To start retrying when next time it disconnect
        shouldRetryConnection = true;
      }
      sendAuthMessage();
  }

  @Override
  public void onMessage( String message ) {
      log.info("Message Received {}", message);
      JsonObject msg = gson.fromJson(message, JsonObject.class);
        switch (msg.get("type").getAsString()) {
          case MESSAGE_TYPE_AUTH + "Response":
            if (msg.has("error")) {
              log.error("Authentication failed {}", msg.get("error").getAsString());
              this.closeWS();
            } else {
              log.info("Authentication successful. Joining Room.");
              this.sendJoinRoomMessage();              
            }
            break;
          case MESSAGE_TYPE_JOIN_ROOM + "Response":
            if (msg.has("error")) {
              log.error("Joining Room failed {}", msg.get("error").getAsString());
              this.closeWS();
            } else {
              log.info("Joined Room successful. Should connect if any active broadcaster found.");
              ActiveBroadcastersResponse activeBcasterResp = gson.fromJson(msg, ActiveBroadcastersResponse.class);
              activeBcasterResp.getExistingBroadcasters().forEach((broadcaster) -> {
                this.sendSdpOffer(generateSdpOffer(broadcaster), broadcaster);
              });              
            }
            break;  
          case MESSAGE_TYPE_RECEIVE_MEDIA + "Response":
            if (msg.has("error")) {
              log.error("Failed to negotiate SDP. Error: {}", msg.get("error").getAsString());
              this.closeWS();
            } else {
              String userId = this.pendingSdpAnswers.remove(msg.get("id").getAsString());
              this.activeStreams.get(userId).setSdpAnswer(msg.get("sdpAnswer").getAsString());
              sessionListener.onBroadcasterJoined(this.activeStreams.get(userId));
              log.info("SDP negitiation successfull");
            }
            break;
          case MESSAGE_TYPE_NEW_PRESENTER_ARRIVED:
            Broadcaster broadcaster = gson.fromJson(msg.get("user").getAsJsonObject(), Broadcaster.class);
            this.sendSdpOffer(generateSdpOffer(broadcaster), broadcaster);
            break;
          case MESSAGE_TYPE_PRESENTER_LEFT:
            String userId = msg.get("userId").getAsString();
            StreamingSession endedSession = this.activeStreams.remove(userId);
            sessionListener.onBroadcasterLeft(endedSession);
            endedSession.getSdpOfferFile().delete();
            availablePorts.push(endedSession.getReceiverPort());
            break;
          case MESSAGE_TYPE_MEDIA_OVERRIDE:  
            log.info("Received media-override message. Session ended. Looks like signed in from another session using same API key/token.");
            this.closeWS();
            break;           
          case MESSAGE_TYPE_PING:  
            log.info("Pong Received");
            break;         
        }     
  }

  @Override
  public void onClose( int code, String reason, boolean remote ) {
      log.info( "Connection closed by " + ( remote ? "remote peer" : "us" ) + " Code: " + code + " Reason: " + reason );
      if (this.shouldRetryConnection) {    
        scheduledExecutorService = Executors.newScheduledThreadPool(1);        
        scheduledExecutorService.scheduleAtFixedRate(
            () -> {
              log.info("Retrying connecting the Sqauwk");
              this.reconnect();
            },
            CONNECTION_RETRY_INTERVAL, 
            CONNECTION_RETRY_INTERVAL, 
            TimeUnit.SECONDS);        
        scheduledExecutorService.schedule(
            () -> {  
              System.out.println("Not able to re-connect to Squawk. Stopping retries." );               
              scheduledExecutorService.shutdown();
            }, 
            RETRY_PERIOD,TimeUnit.SECONDS);
        // To stop starting any new retry scheduler as the one scheduler is started
        shouldRetryConnection = false;
      }
  }

  @Override
  public void onError( Exception ex ) {
    log.error("Error occured: ", ex);      
  }
  
  @Override
  public void sendPing() {
    log.info("Sending ping");
    JsonObject pingObj = new JsonObject();
    pingObj.addProperty("id", Generators.timeBasedGenerator().generate().toString());
    pingObj.addProperty("type", MESSAGE_TYPE_PING);
    this.send(pingObj.toString());
  }

  private void closeWS() {
    log.info("Closing WebSocket connection.");
    this.shouldRetryConnection= false;
    this.activeStreams.clear();
    this.close();
  }
  
  private void sendAuthMessage() {
    log.info("Authenticating");
    JsonObject authObj = new JsonObject();
    authObj.addProperty("id", Generators.timeBasedGenerator().generate().toString());
    authObj.addProperty("role", conf.getString("bz.squawk.role"));
    authObj.addProperty("type", MESSAGE_TYPE_AUTH);
    authObj.addProperty("apikey", conf.getString("bz.squawk.apiKey"));    
    this.send(authObj.toString());    
  }
  
  private void sendJoinRoomMessage() {
    String room = conf.getString("bz.squawk.room");
    log.info("Joining Room: {}" , room);
    JsonObject authObj = new JsonObject();
    authObj.addProperty("id", Generators.timeBasedGenerator().generate().toString());
    authObj.addProperty("type", MESSAGE_TYPE_JOIN_ROOM);
    authObj.addProperty("room", conf.getString("bz.squawk.room"));
    this.send(authObj.toString());
  }
  
  private void sendSdpOffer(String sdpOffer, Broadcaster broadcaster) {
    log.info("Sending SDP Offer");
    JsonObject receiveMediaMessage = new JsonObject();
    String messageId = Generators.timeBasedGenerator().generate().toString();
    receiveMediaMessage.addProperty("id", messageId);
    receiveMediaMessage.addProperty("type", MESSAGE_TYPE_RECEIVE_MEDIA);
    receiveMediaMessage.addProperty("sdpOffer", sdpOffer);
    receiveMediaMessage.addProperty("userId", broadcaster.getUserId());
    this.pendingSdpAnswers.put(messageId, broadcaster.getUserId());
    this.send(receiveMediaMessage.toString());
  }
  
  private void sendLogoutMessage() {
    log.info("Sending Logout message");
    JsonObject logoutMessage = new JsonObject();
    logoutMessage.addProperty("id", Generators.timeBasedGenerator().generate().toString());
    logoutMessage.addProperty("type", MESSAGE_TYPE_LOGOUT);    
    this.send(logoutMessage.toString());
  }  
  
  private String generateSdpOffer(Broadcaster broadcaster) {    
    int port = availablePorts.pop();
    log.info("Generating an SDP Offer using IP {} and Port {} for connecting to broadcaster {}", conf.getString("receiver.ip"), port, broadcaster.getUsername());
    String rtpSdpOffer = "v=0\n" + 
        "t=0 0\n" + 
        "m=audio " + port + " RTP/AVP 98\n" + 
        "c=IN IP4 " + conf.getString("receiver.ip") + "\n" + 
        "a=recvonly\n" + 
        "a=rtpmap:98 opus/48000/2\n" + 
        "a=fmtp:98 stereo=0; sprop-stereo=0; useinbandfec=1";
    log.info("SDP Offer \n{}", rtpSdpOffer);
    File sdpOfferFilePath = this.writeSdpOffertoFile(rtpSdpOffer, broadcaster.getUserId());
    StreamingSession streamingSession = new StreamingSession(broadcaster, port, rtpSdpOffer, sdpOfferFilePath);
    activeStreams.put(broadcaster.getUserId(), streamingSession);
    return rtpSdpOffer;    
  } 
  

  /**
   * 
   * Write the SDP offer to a file with appending broadcaster id to file name
   * @param rtpSdpOffer
   * @param broadcasterId
   * @return File path
   */
  private File writeSdpOffertoFile(String rtpSdpOffer, String broadcasterId) {
    String path = System.getProperty("user.home") + File.separator + "Documents";
    path += File.separator + "bz-squawk-sdpoffers";
    File customDir = new File(path);

    if (!customDir.exists()) {
      log.info(customDir + " created");
      customDir.mkdirs();    
    } 
        
    File sdpOfferfile = new File(customDir.getPath() + File.separator + "input_audio_" + broadcasterId + ".sdp");
    BufferedWriter writer;
    try {
      writer = new BufferedWriter(new FileWriter(sdpOfferfile));
      writer.write(rtpSdpOffer);     
      writer.close();
      log.info("SDP Offer input file created at {}", sdpOfferfile.getPath());
      log.info("You can open this file in VLC to play live squawk audio stream");
    } catch (IOException e) {
      log.error("Error occured while writting the SDP offer to file" , e);
    }
    return sdpOfferfile;
  }
      
  public static void main( String[] args ) throws URISyntaxException {
    Map<String, Process> activeFfpmegProcesses = new HashMap<String, Process>();
    Config conf = ConfigFactory.load(); 
    log.info("Squawk Address : {}", conf.getString("bz.squawk.addr")); 
    SquawkWSClient c = new SquawkWSClient(conf.getString("bz.squawk.addr"), conf, new StreamingSessionListener(){
    
      @Override
      public void onBroadcasterLeft(StreamingSession streamingSession) {
        
        // disconnect the stream
        log.info("Broadcaster: {} left. Incoming stream on port {} cutoff.", streamingSession.getBroadcaster().getUsername(), streamingSession.getReceiverPort());
        
        // stopping ffmpeg to save the stream
        Process p =activeFfpmegProcesses.remove(streamingSession.getBroadcaster().getUserId());
        p.destroy();
        
      }
    
      @Override
      public void onBroadcasterJoined(StreamingSession streamingSession) {
        
        // connect stream further        
        log.info("New broadcaster: {} joined. Incoming stream on port {}", streamingSession.getBroadcaster().getUsername(), streamingSession.getReceiverPort());
        
        // starting ffmpeg to save the stream
        String outputFile = System.getProperty("user.home") + "/out_" + streamingSession.getBroadcaster().getUserId() + ".ogg";
        String ffmpegCmd = "ffmpeg -protocol_whitelist file,crypto,udp,rtp -acodec opus -i " 
                            + streamingSession.getSdpOfferFile().getPath() 
                            + " -acodec libopus " 
                            + outputFile;
        
        
        try {
          Process p = Runtime.getRuntime().exec(ffmpegCmd);
          activeFfpmegProcesses.put(streamingSession.getBroadcaster().getUserId(), p);
          log.info("Incoming stream being saved into file {}", outputFile);
        } catch (IOException e) {
          log.error("Unable to record and save incoming RTP stream", e);
        }
        
      }
    }); 
    c.connect();  
    Runtime.getRuntime().addShutdownHook(new Thread() 
    { 
      public void run() 
      { 
        if (c.isOpen()) {
          log.info("Shutting down WebSocket Client!"); 
          c.sendLogoutMessage();
          c.closeWS();
        }
      } 
    }); 
  }
}
