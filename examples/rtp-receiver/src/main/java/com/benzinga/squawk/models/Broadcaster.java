package com.benzinga.squawk.models;

public class Broadcaster {
  private String userId;
  private String username;

  public Broadcaster(String userId, String username) {
    this.userId = userId;
    this.username = username;
  }

  public String getUserId() {
    return userId;
  }

  public String getUsername() {
    return username;
  }  
   
}
