package com.benzinga.squawk;

import com.benzinga.squawk.models.StreamingSession;

/**
 * Callbacks on event of a new Broadcaster joins or leave *
 */
public interface StreamingSessionListener {
  
  /**
   * 
   * @param streamingSession {@link StreamingSession} of new broadcaster
   */
   public void onBroadcasterJoined(StreamingSession streamingSession);
   
   /**
    * 
    * @param streamingSession {@link StreamingSession} of broadcaster left
    */
   public void onBroadcasterLeft(StreamingSession streamingSession);
}
