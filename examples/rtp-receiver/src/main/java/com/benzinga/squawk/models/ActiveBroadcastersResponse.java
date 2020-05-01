package com.benzinga.squawk.models;

import java.util.List;

public class ActiveBroadcastersResponse extends Response {
 
  private List<Broadcaster> broadcasters;

  public ActiveBroadcastersResponse(String id, String type, List<Broadcaster> broadcasters) {
    super(id, type);
    this.broadcasters = broadcasters;
  }

  public List<Broadcaster> getExistingBroadcasters() {
    return broadcasters;
  }  
  
}