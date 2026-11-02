package com.morningmelody.playback

import java.util.concurrent.CopyOnWriteArraySet

/** What the player itself cannot tell us. Shared in-process between the service and its observers. */
object PlaybackInfo {
  data class State(
    val playlistId: Long? = null,
    val playlistName: String? = null,
    val isAlarm: Boolean = false,
    val fallback: Boolean = false,
    val skippedSongs: Int = 0,
  )

  private val listeners = CopyOnWriteArraySet<(State) -> Unit>()

  @Volatile
  var state: State = State()
    set(value) {
      field = value
      listeners.forEach { it(value) }
    }

  fun addListener(listener: (State) -> Unit) {
    listeners.add(listener)
  }

  fun removeListener(listener: (State) -> Unit) {
    listeners.remove(listener)
  }
}
