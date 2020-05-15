package com.benzinga.squawk.models;

public class Response {  
  private String id;
  private String type;

  public Response(String id, String type) {
    this.id = id;
    this.type = type + "Response";
  }

  public String getId() {
    return id;
  }

  public String getType() {
    return type;
  }  
  
}
