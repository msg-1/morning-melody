package com.morningmelody.bridge

import android.content.ComponentName
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.WritableMap
import androidx.core.content.ContextCompat
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.google.common.util.concurrent.ListenableFuture
import com.google.common.util.concurrent.MoreExecutors
import com.morningmelody.db.MelodyDatabase
import com.morningmelody.playback.PlaybackInfo
import com.morningmelody.playback.PlaybackService

/**
 * JavaScript's remote control. It holds a MediaController, the same kind of client the notification
 * and lock screen use, so every control acts on one shared player. Song previews use a separate small
 * player so they cannot disturb a saved playlist position.
 */
class AudioModule(context: ReactApplicationContext) :
  ReactContextBaseJavaModule(context), LifecycleEventListener {
  private val main = Handler(Looper.getMainLooper())
  private var controllerFuture: ListenableFuture<MediaController>? = null
  private var controller: MediaController? = null
  private var preview: ExoPlayer? = null

  private val ticker =
    object : Runnable {
      override fun run() {
        emitState()
        if (controller?.isPlaying == true) main.postDelayed(this, TICK_MS)
      }
    }

  private val playerListener =
    object : Player.Listener {
      override fun onEvents(player: Player, events: Player.Events) {
        main.removeCallbacks(ticker)
        ticker.run()
      }
    }

  private val infoListener: (PlaybackInfo.State) -> Unit = { main.post { emitState() } }

  init {
    context.addLifecycleEventListener(this)
    PlaybackInfo.addListener(infoListener)
  }

  override fun getName() = NAME

  private fun withController(promise: Promise?, action: (MediaController) -> Any?) {
    main.post {
      val existing = controller
      if (existing != null && existing.isConnected) {
        settleOptional(promise) { action(existing) }
        return@post
      }
      val future = controllerFuture?.takeIf { !it.isDone } ?: connect()
      future.addListener(
        {
          try {
            val connected = future.get()
            settleOptional(promise) { action(connected) }
          } catch (error: Exception) {
            controllerFuture = null
            promise?.reject("E_PLAYER", error.message, error)
          }
        },
        ContextCompat.getMainExecutor(reactApplicationContext))
    }
  }

  private fun connect(): ListenableFuture<MediaController> {
    val context = reactApplicationContext
    controllerFuture?.let { MediaController.releaseFuture(it) }
    val token = SessionToken(context, ComponentName(context, PlaybackService::class.java))
    val future = MediaController.Builder(context, token).buildAsync()
    controllerFuture = future
    future.addListener(
      {
        val connected = runCatching { future.get() }.getOrNull() ?: return@addListener
        connected.addListener(playerListener)
        controller = connected
      },
      ContextCompat.getMainExecutor(context))
    return future
  }

  private fun settleOptional(promise: Promise?, block: () -> Any?) {
    try {
      val result = block()
      promise?.resolve(result)
    } catch (error: Exception) {
      promise?.reject("E_PLAYER", error.message, error)
    }
  }

  @ReactMethod
  fun getState(promise: Promise) = withController(promise) { snapshot(it) }

  /** Loads a playlist and starts it, optionally at a chosen song. */
  @ReactMethod
  fun playPlaylist(playlistId: Double, trackId: Double, promise: Promise) {
    stopPreviewNow()
    withController(null) { player ->
      val args =
        Bundle().apply {
          putLong(PlaybackService.ARG_PLAYLIST_ID, playlistId.toLong())
          if (trackId > 0) putLong(PlaybackService.ARG_TRACK_ID, trackId.toLong())
        }
      val result = player.sendCustomCommand(PlaybackService.COMMAND_LOAD_PLAYLIST, args)
      result.addListener(
        {
          val code = runCatching { result.get().resultCode }.getOrDefault(-1)
          promise.resolve(code == 0)
        },
        MoreExecutors.directExecutor())
    }
  }

  /** Picks up where the last playlist left off. Resolves false when there is nothing to resume. */
  @ReactMethod
  fun resumeLast(promise: Promise) {
    withController(null) { player ->
      val result = player.sendCustomCommand(PlaybackService.COMMAND_RESTORE, Bundle.EMPTY)
      result.addListener(
        {
          val code = runCatching { result.get().resultCode }.getOrDefault(-1)
          promise.resolve(code == 0)
        },
        MoreExecutors.directExecutor())
    }
  }

  @ReactMethod
  fun hasSavedPlayback(promise: Promise) = settle(promise) {
    MelodyDatabase.get(reactApplicationContext).loadPlayback() != null
  }

  @ReactMethod
  fun play() = withController(null) { it.play() }

  @ReactMethod
  fun pause() = withController(null) { it.pause() }

  @ReactMethod
  fun next() = withController(null) { it.seekToNext() }

  @ReactMethod
  fun previous() = withController(null) { it.seekToPrevious() }

  @ReactMethod
  fun seekTo(positionMs: Double) = withController(null) { it.seekTo(positionMs.toLong()) }

  @ReactMethod
  fun stop() = withController(null) {
    it.sendCustomCommand(PlaybackService.COMMAND_STOP, Bundle.EMPTY)
  }

  @ReactMethod
  fun setShuffle(enabled: Boolean) = withController(null) { it.shuffleModeEnabled = enabled }

  @ReactMethod
  fun setRepeat(enabled: Boolean) = withController(null) {
    it.repeatMode = if (enabled) Player.REPEAT_MODE_ALL else Player.REPEAT_MODE_OFF
  }

  /** Plays a short clip of each song in order. Resolves false if none of them can be played. */
  @ReactMethod
  fun preview(trackIds: ReadableArray, promise: Promise) {
    val db = MelodyDatabase.get(reactApplicationContext)
    val items =
      trackIds.toLongList().mapNotNull { db.getTrack(it) }.map { track ->
        MediaItem.Builder()
          .setMediaId(track.id.toString())
          .setUri(track.localUri)
          .setClippingConfiguration(
            MediaItem.ClippingConfiguration.Builder().setEndPositionMs(PREVIEW_CLIP_MS).build())
          .build()
      }
    main.post {
      stopPreviewNow()
      if (items.isEmpty()) {
        promise.resolve(false)
        return@post
      }
      controller?.pause()
      val player =
        ExoPlayer.Builder(reactApplicationContext)
          .setAudioAttributes(AudioAttributes.DEFAULT, true)
          .build()
      player.addListener(
        object : Player.Listener {
          override fun onPlaybackStateChanged(playbackState: Int) {
            if (playbackState == Player.STATE_ENDED) {
              stopPreviewNow()
              emitPreviewEnded(null)
            }
          }

          override fun onPlayerError(error: PlaybackException) {
            stopPreviewNow()
            emitPreviewEnded("That song could not be played")
          }
        })
      player.setMediaItems(items)
      player.prepare()
      player.play()
      preview = player
      promise.resolve(true)
    }
  }

  @ReactMethod
  fun stopPreview() {
    main.post { stopPreviewNow() }
  }

  private fun stopPreviewNow() {
    preview?.release()
    preview = null
  }

  private fun emitPreviewEnded(message: String?) {
    val map = Arguments.createMap().apply { putString("message", message) }
    reactApplicationContext.emitDeviceEvent(EVENT_PREVIEW_ENDED, map)
  }

  private fun emitState() {
    val player = controller ?: return
    if (reactApplicationContext.hasActiveReactInstance()) {
      reactApplicationContext.emitDeviceEvent(EVENT_STATE, snapshot(player))
    }
  }

  private fun snapshot(player: MediaController): WritableMap {
    val info = PlaybackInfo.state
    val metadata = player.mediaMetadata
    val hasQueue = player.mediaItemCount > 0
    val duration = player.duration.takeIf { it != C.TIME_UNSET } ?: 0L
    return Arguments.createMap().apply {
      putBoolean("hasQueue", hasQueue)
      putBoolean("isPlaying", player.isPlaying)
      putBoolean("playWhenReady", player.playWhenReady)
      putBoolean("isLoading", player.playbackState == Player.STATE_BUFFERING)
      putString("title", metadata.title?.toString())
      putString("artist", metadata.artist?.toString())
      putString("album", metadata.albumTitle?.toString())
      putString("artworkUri", metadata.artworkUri?.toString())
      putDouble("positionMs", player.currentPosition.toDouble())
      putDouble("durationMs", duration.toDouble())
      putInt("index", player.currentMediaItemIndex)
      putInt("count", player.mediaItemCount)
      putBoolean("shuffle", player.shuffleModeEnabled)
      putBoolean("repeat", player.repeatMode == Player.REPEAT_MODE_ALL)
      if (info.playlistId != null) putDouble("playlistId", info.playlistId.toDouble())
      else putNull("playlistId")
      putString("playlistName", info.playlistName)
      putBoolean("isAlarm", info.isAlarm)
      putBoolean("fallback", info.fallback)
      putInt("skippedSongs", info.skippedSongs)
    }
  }

  // Required by RN's event emitter contract.
  @ReactMethod fun addListener(eventName: String) = Unit

  @ReactMethod fun removeListeners(count: Double) = Unit

  override fun onHostResume() {
    withController(null) { emitState() }
  }

  override fun onHostPause() {
    main.post { stopPreviewNow() }
  }

  override fun onHostDestroy() = Unit

  override fun invalidate() {
    PlaybackInfo.removeListener(infoListener)
    reactApplicationContext.removeLifecycleEventListener(this)
    main.post {
      main.removeCallbacks(ticker)
      stopPreviewNow()
      controller?.removeListener(playerListener)
      controller = null
      controllerFuture?.let { MediaController.releaseFuture(it) }
      controllerFuture = null
    }
    super.invalidate()
  }

  companion object {
    const val NAME = "MelodyAudio"
    const val EVENT_STATE = "MelodyPlaybackState"
    const val EVENT_PREVIEW_ENDED = "MelodyPreviewEnded"
    private const val TICK_MS = 1000L
    private const val PREVIEW_CLIP_MS = 15_000L
  }
}
