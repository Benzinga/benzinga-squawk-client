package com.benzinga.squawk.models;

public class StreamingSession {
  private Broadcaster broadcaster;  
  private int receiverPort;
  private String sdpOffer;
  private String sdpAnswer;
  
  public StreamingSession(Broadcaster broadcaster, int receiverPort, String sdpOffer) {
    this.broadcaster = broadcaster;
    this.receiverPort = receiverPort;
    this.sdpOffer = sdpOffer;
  }

  public String getSdpOffer() {
    return sdpOffer;
  }

  public void setSdpOffer(String sdpOffer) {
    this.sdpOffer = sdpOffer;
  }

  public String getSdpAnswer() {
    return sdpAnswer;
  }

  public void setSdpAnswer(String sdpAnswer) {
    this.sdpAnswer = sdpAnswer;
  }
  
  public Broadcaster getBroadcaster() {
    return broadcaster;
  }

  public int getReceiverPort() {
    return receiverPort;
  } 
  
}
