package com.benzinga.squawk;

import java.io.BufferedWriter;
import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import org.java_websocket.client.WebSocketClient;
import org.java_websocket.drafts.Draft;
import org.java_websocket.handshake.ServerHandshake;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
  private static Config conf;  
  
  private static final String MESSAGE_TYPE_AUTH = "auth";
  private static final String MESSAGE_TYPE_JOIN_ROOM = "joinRoom";
  private static final String MESSAGE_TYPE_PING = "ping";  
  private static final String MESSAGE_TYPE_RECEIVE_MEDIA = "receiveMedia";
  private static final String MESSAGE_TYPE_LOGOUT = "logout";
  private static final String MESSAGE_TYPE_MEDIA_OVERRIDE = "mediaOverride";
  // The retry interval in seconds for reconnecting after WS connection closed unexpectedly.  
  private static final long CONNECTION_RETRY_INTERVAL = 20L;
  // For what period of time the client should keep retrying at CONNECTION_RETRY_INTERVAL
  private static final long RETRY_PERIOD = 60L * 15L;
    
  ScheduledExecutorService scheduledExecutorService;
    
  private boolean shouldRetryConnection = true;
  
  public SquawkWSClient(String serverURI) throws URISyntaxException {
    super(new URI(serverURI));        
    this.setConnectionLostTimeout(30);
  }
  
  public SquawkWSClient( URI serverUri , Draft draft ) {
    super( serverUri, draft );
    this.setConnectionLostTimeout(30);
  }

  public SquawkWSClient( URI serverURI ) {
    super( serverURI );
    this.setConnectionLostTimeout(30);
  }

  public SquawkWSClient( URI serverUri, Map<String, String> httpHeaders ) {
    super(serverUri, httpHeaders);
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
              log.info("Joined Room successful.");
              this.sendSdpOffer(sdpOffer());
              log.error("Authentication successful. Sending SDP Offer");              
            }
            break;
          case MESSAGE_TYPE_RECEIVE_MEDIA + "Response":
            if (msg.has("error")) {
              log.error("Failed to negotiate SDP. Error: {}", msg.get("error").getAsString());
              this.closeWS();
            } else {
              log.info("SDP negitiation successfull");
            }
            break;
          case MESSAGE_TYPE_MEDIA_OVERRIDE:  
            log.info("Received media-override message. Session ended. Looks like signed in from another session using same API key.");
            this.closeWS();
            break;           
          case MESSAGE_TYPE_PING + "Response":  
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
  
  private void sendSdpOffer(String sdpOffer) {
    log.info("Sending SDP Offer");
    JsonObject receiveMediaMessage = new JsonObject();
    receiveMediaMessage.addProperty("id", Generators.timeBasedGenerator().generate().toString());
    receiveMediaMessage.addProperty("type", MESSAGE_TYPE_RECEIVE_MEDIA);
    receiveMediaMessage.addProperty("sdpOffer", sdpOffer);
    this.send(receiveMediaMessage.toString());
  }
  
  private void sendLogoutMessage() {
    log.info("Sending Logout message");
    JsonObject logoutMessage = new JsonObject();
    logoutMessage.addProperty("id", Generators.timeBasedGenerator().generate().toString());
    logoutMessage.addProperty("type", MESSAGE_TYPE_LOGOUT);    
    this.send(logoutMessage.toString());
  }  
  
  private String sdpOffer() {
    if (conf.hasPath("receiver.sdpoffer.file") && !"<sdp_offer_file_path>".equals(conf.getString("receiver.sdpoffer.file"))) {
      return this.getSDPOffer(conf.getString("receiver.sdpoffer.file"));
    } else {
      log.info("Generating a sample SDP Offer using IP {} and Port {}", conf.getString("receiver.ip"), conf.getString("receiver.port"));
      log.info("If you want to use your SDP offer, then please set env RECEIVER_SDP_OFFER_FILE");
      String rtpSdpOffer = "v=0\n" + 
          "t=0 0\n" + 
          "m=audio " + conf.getString("receiver.port") + " RTP/AVP 98\n" + 
          "c=IN IP4 " + conf.getString("receiver.ip") + "\n" + 
          "a=recvonly\n" + 
          "a=rtpmap:98 opus/48000/2\n" + 
          "a=fmtp:98 stereo=0; sprop-stereo=0; useinbandfec=1";
      log.info("SDP Offer \n{}", rtpSdpOffer);
      this.writeSdpOffertoFile(rtpSdpOffer);
      return rtpSdpOffer;
    }
  } 
  
  private void writeSdpOffertoFile(String rtpSdpOffer) {
    String path = System.getProperty("user.home") + File.separator + "Documents";
    path += File.separator + "bz-squawk-sdpoffer";
    File customDir = new File(path);

    if (!customDir.exists()) {
      log.info(customDir + " created");
      customDir.mkdirs();    
    } 
        
    File sdpOfferfile = new File(customDir.getPath() + File.separator + "inputAudio.sdp");
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
  }
  
  private String getSDPOffer(String filePath) {
    String rtpSdpOffer = "";
    try
    {
      rtpSdpOffer = new String ( Files.readAllBytes( Paths.get(filePath) ) );
      log.info("SDP Offer from file \n{}", rtpSdpOffer);
    } 
    catch (IOException e) 
    {
      log.error("Error occured while reading the SDP offer from file" , e);
    }    
    return rtpSdpOffer;
  }
    
  public static void main( String[] args ) throws URISyntaxException {
    conf = ConfigFactory.load(); 
    log.info("Squawk Address : {}", conf.getString("bz.squawk.addr")); 
    SquawkWSClient c = new SquawkWSClient(conf.getString("bz.squawk.addr"));
    c.connect();  
    Runtime.getRuntime().addShutdownHook(new Thread() 
    { 
      public void run() 
      { 
        if (c.isOpen()) {
          log.info("Shutting down WebSocket Client!"); 
          c.sendLogoutMessage();
          c.close();
        }
      } 
    }); 
  }
}
