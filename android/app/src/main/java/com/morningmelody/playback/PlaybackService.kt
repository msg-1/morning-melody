package com.morningmelody.playback

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioManager
import android.media.RingtoneManager
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.annotation.OptIn
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.RawResourceDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.ShuffleOrder
import androidx.media3.session.CommandButton
import androidx.media3.session.DefaultMediaNotificationProvider
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService
import androidx.media3.session.SessionCommand
import androidx.media3.session.SessionError
import androidx.media3.session.SessionResult
import com.google.common.collect.ImmutableList
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture
import com.morningmelody.R
import com.morningmelody.db.MelodyDatabase
import com.morningmelody.db.SavedPlayback
import com.morningmelody.db.Track
import kotlin.math.roundToInt
import kotlin.random.Random

/**
 * Owns the single ExoPlayer. The app screen, notification, lock screen and alarm all drive this one
 * player through its MediaSession, which is what keeps them in sync.
 */
@OptIn(UnstableApi::class)
class PlaybackService : MediaSessionService() {
  private lateinit var player: ExoPlayer
  private lateinit var session: MediaSession
  private lateinit var db: MelodyDatabase
  private val handler = Handler(Looper.getMainLooper())

  /** Alarm stream level to put back when the alarm ends, or null if it was not changed. */
  private var savedAlarmVolume: Int? = null
  private var consecutiveErrors = 0
  private var playedSinceLoad = false

  private val saveTick =
    object : Runnable {
      override fun run() {
        savePosition()
        handler.postDelayed(this, SAVE_INTERVAL_MS)
      }
    }

  private val playerListener =
    object : Player.Listener {
      override fun onIsPlayingChanged(isPlaying: Boolean) {
        handler.removeCallbacks(saveTick)
        if (isPlaying) {
          consecutiveErrors = 0
          playedSinceLoad = true
          handler.postDelayed(saveTick, SAVE_INTERVAL_MS)
        } else {
          savePosition()
        }
      }

      override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) = savePosition()

      override fun onPlaybackStateChanged(playbackState: Int) {
        if (playbackState != Player.STATE_ENDED) return
        // Next time, "continue where it left off" should not land on the very end of the last song.
        val playlistId = PlaybackInfo.state.playlistId
        val firstTrack = player.takeIf { it.mediaItemCount > 0 }?.getMediaItemAt(0)?.mediaId?.toLongOrNull()
        if (playlistId != null && firstTrack != null) {
          db.savePlayback(SavedPlayback(playlistId, firstTrack, 0L))
        }
        // The playlist has run out. Nothing is left to control, for an alarm or for normal listening.
        handler.post { stopEverything() }
      }

      override fun onShuffleModeEnabledChanged(shuffleModeEnabled: Boolean) {
        if (shuffleModeEnabled) applyShuffleOrder()
        saveOptions()
      }

      override fun onRepeatModeChanged(repeatMode: Int) = saveOptions()

      override fun onPlayerError(error: PlaybackException) = handlePlayerError(error)
    }

  override fun onCreate() {
    super.onCreate()
    db = MelodyDatabase.get(this)
    player =
      ExoPlayer.Builder(this)
        .setAudioAttributes(MEDIA_ATTRIBUTES, true)
        .setHandleAudioBecomingNoisy(true)
        .setWakeMode(C.WAKE_MODE_LOCAL)
        .build()
    player.addListener(playerListener)

    val openApp =
      PendingIntent.getActivity(
        this,
        0,
        Intent(Intent.ACTION_VIEW, Uri.parse("morningmelody://now-playing")).setPackage(packageName),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

    setMediaNotificationProvider(
      DefaultMediaNotificationProvider.Builder(this).build().apply {
        setSmallIcon(R.drawable.ic_notification)
      })

    session =
      MediaSession.Builder(this, player)
        .setCallback(SessionCallback())
        .setSessionActivity(openApp)
        .setMediaButtonPreferences(
          ImmutableList.of(
            CommandButton.Builder(CommandButton.ICON_STOP)
              .setDisplayName("Stop")
              .setSessionCommand(COMMAND_STOP)
              .setSlots(CommandButton.SLOT_OVERFLOW)
              .build()))
        .build()
  }

  override fun onGetSession(controllerInfo: MediaSession.ControllerInfo) = session

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_START_ALARM -> {
        // Android gives a service started from the background 5 seconds to call startForeground,
        // and a missing song must not be able to crash an alarm, so do it before anything else.
        goForegroundNow()
        startAlarm(
          if (intent.hasExtra(EXTRA_PLAYLIST_ID)) intent.getLongExtra(EXTRA_PLAYLIST_ID, -1L) else null,
          intent.getIntExtra(EXTRA_VOLUME, 70),
          intent.getBooleanExtra(EXTRA_FROM_BEGINNING, true))
        return START_NOT_STICKY
      }
      ACTION_STOP -> {
        stopEverything()
        return START_NOT_STICKY
      }
    }
    return super.onStartCommand(intent, flags, startId)
  }

  private fun goForegroundNow() {
    val manager = getSystemService(NotificationManager::class.java)
    manager.createNotificationChannel(
      NotificationChannel(STARTING_CHANNEL, "Starting music", NotificationManager.IMPORTANCE_LOW))
    val notification =
      NotificationCompat.Builder(this, STARTING_CHANNEL)
        .setSmallIcon(R.drawable.ic_notification)
        .setContentTitle("Morning Melody")
        .setContentText("Starting your music")
        .build()
    // Same id as the media notification, which replaces this one as soon as music starts.
    ServiceCompat.startForeground(
      this,
      DefaultMediaNotificationProvider.DEFAULT_NOTIFICATION_ID,
      notification,
      ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
  }

  private fun startAlarm(playlistId: Long?, volume: Int, fromBeginning: Boolean) {
    savePosition()
    switchToAlarmAudio(volume)

    val playlist = playlistId?.let { db.getPlaylist(it) }
    val loaded = playlist != null && load(playlist.id, null, 0L, fromBeginning, isAlarm = true)
    if (!loaded) startFallbackSound()

    val notification =
      AlarmNotifications.buildRinging(this, playlist?.name?.takeIf { loaded } ?: "Your alarm")
    val notifications = getSystemService(NotificationManager::class.java)
    // Android only launches a full-screen intent for a new notification, not for an update, so a
    // leftover one would leave the screen dark.
    notifications.cancel(AlarmNotifications.ALARM_NOTIFICATION_ID)
    notifications.notify(AlarmNotifications.ALARM_NOTIFICATION_ID, notification)
    player.play()
  }

  /**
   * Loads a playlist into the player. Returns false if none of its songs can be opened. Unreadable
   * songs are skipped here rather than failing during playback.
   */
  private fun load(
    playlistId: Long,
    startTrackId: Long?,
    startPositionMs: Long,
    fromBeginning: Boolean,
    isAlarm: Boolean,
  ): Boolean {
    val playlist = db.getPlaylist(playlistId) ?: return false
    val all = db.playlistTracks(playlistId)
    val playable = all.filter { isReadable(it) }
    if (playable.isEmpty()) return false

    val resumeId = startTrackId ?: if (fromBeginning) null else playlist.resumeTrackId
    val found = playable.indexOfFirst { it.id == resumeId }
    val index = found.coerceAtLeast(0)
    val position =
      when {
        found < 0 -> 0L
        startTrackId != null -> startPositionMs
        else -> playlist.resumePositionMs
      }

    playedSinceLoad = false

    player.setMediaItems(playable.map { it.toMediaItem() }, index, position)
    player.repeatMode = if (playlist.repeat) Player.REPEAT_MODE_ALL else Player.REPEAT_MODE_OFF
    player.shuffleModeEnabled = playlist.shuffle
    if (playlist.shuffle) applyShuffleOrder()
    player.prepare()

    PlaybackInfo.state =
      PlaybackInfo.State(
        playlistId = playlist.id,
        playlistName = playlist.name,
        isAlarm = isAlarm,
        skippedSongs = all.size - playable.size)
    return true
  }

  /** Whatever happened to the songs, an alarm must still make a sound. */
  private fun startFallbackSound() {
    consecutiveErrors = 0
    Log.w(TAG, "No playable song for this alarm, using the fallback sound")
    val metadata =
      MediaMetadata.Builder().setTitle("Morning alarm").setArtist("Morning Melody").build()
    val items = ArrayList<MediaItem>()
    val systemTone =
      RingtoneManager.getActualDefaultRingtoneUri(this, RingtoneManager.TYPE_ALARM)
        ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
    if (systemTone != null) {
      items.add(MediaItem.Builder().setUri(systemTone).setMediaMetadata(metadata).build())
    }
    items.add(
      MediaItem.Builder()
        .setUri(RawResourceDataSource.buildRawResourceUri(R.raw.gentle_chime))
        .setMediaMetadata(metadata)
        .build())
    player.shuffleModeEnabled = false
    player.repeatMode = Player.REPEAT_MODE_ONE
    player.setMediaItems(items, 0, 0L)
    player.prepare()
    PlaybackInfo.state = PlaybackInfo.State(isAlarm = true, fallback = true)
  }

  private fun handlePlayerError(error: PlaybackException) {
    Log.w(TAG, "Playback error: ${error.errorCodeName}", error)
    player.currentMediaItem?.mediaId?.toLongOrNull()?.let { db.setTrackAvailable(it, false) }
    consecutiveErrors++
    val state = PlaybackInfo.state
    val hasNext =
      player.hasNextMediaItem() || (player.repeatMode == Player.REPEAT_MODE_ALL && player.mediaItemCount > 1)
    when {
      hasNext && consecutiveErrors < player.mediaItemCount -> {
        player.seekToNextMediaItem()
        player.prepare()
        player.play()
      }
      state.isAlarm && !state.fallback && !playedSinceLoad -> {
        startFallbackSound()
        player.play()
      }
      else -> stopEverything()
    }
  }

  private fun switchToAlarmAudio(volumePercent: Int) {
    player.setAudioAttributes(ALARM_ATTRIBUTES, true)
    player.setHandleAudioBecomingNoisy(false)
    val audio = getSystemService(AudioManager::class.java)
    try {
      if (savedAlarmVolume == null) savedAlarmVolume = audio.getStreamVolume(AudioManager.STREAM_ALARM)
      val max = audio.getStreamMaxVolume(AudioManager.STREAM_ALARM)
      val level = (max * volumePercent / 100f).roundToInt().coerceIn(1, max)
      audio.setStreamVolume(AudioManager.STREAM_ALARM, level, 0)
    } catch (error: SecurityException) {
      // Do Not Disturb can forbid volume changes. The alarm then rings at the phone's own level.
      Log.w(TAG, "Could not set alarm volume", error)
    }
  }

  private fun switchToMediaAudio() {
    player.setAudioAttributes(MEDIA_ATTRIBUTES, true)
    player.setHandleAudioBecomingNoisy(true)
    savedAlarmVolume?.let {
      runCatching {
        getSystemService(AudioManager::class.java).setStreamVolume(AudioManager.STREAM_ALARM, it, 0)
      }
    }
    savedAlarmVolume = null
  }

  /** Ends only the "alarm" part: lock screen and alarm audio. Used when the playlist runs out. */
  private fun endAlarmSession() {
    switchToMediaAudio()
    getSystemService(NotificationManager::class.java).cancel(AlarmNotifications.ALARM_NOTIFICATION_ID)
    PlaybackInfo.state = PlaybackInfo.state.copy(isAlarm = false)
  }

  private fun stopEverything() {
    savePosition()
    handler.removeCallbacks(saveTick)
    player.stop()
    player.clearMediaItems()
    endAlarmSession()
    PlaybackInfo.state = PlaybackInfo.State()
    ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  private fun savePosition() {
    if (player.playbackState == Player.STATE_ENDED) return
    val playlistId = PlaybackInfo.state.playlistId ?: return
    val trackId = player.currentMediaItem?.mediaId?.toLongOrNull() ?: return
    db.savePlayback(SavedPlayback(playlistId, trackId, player.currentPosition))
  }

  private fun saveOptions() {
    val state = PlaybackInfo.state
    val playlistId = state.playlistId ?: return
    db.setPlaylistOptions(
      playlistId, player.shuffleModeEnabled, player.repeatMode == Player.REPEAT_MODE_ALL)
  }

  /** Keeps the current song first so that shuffling never cuts the rest of the playlist short. */
  private fun applyShuffleOrder() {
    val count = player.mediaItemCount
    if (count < 2) return
    val current = player.currentMediaItemIndex
    val rest = (0 until count).filter { it != current }.shuffled()
    val seed = Random.nextLong()
    player.setShuffleOrder(
      ShuffleOrder.DefaultShuffleOrder((listOf(current) + rest).toIntArray(), seed))
  }

  private fun isReadable(track: Track): Boolean {
    val readable =
      runCatching {
          contentResolver.openAssetFileDescriptor(Uri.parse(track.localUri), "r")?.close()
          true
        }
        .getOrDefault(false)
    if (readable != track.available) db.setTrackAvailable(track.id, readable)
    return readable
  }

  override fun onDestroy() {
    savePosition()
    handler.removeCallbacks(saveTick)
    if (PlaybackInfo.state.isAlarm) endAlarmSession()
    PlaybackInfo.state = PlaybackInfo.State()
    session.release()
    player.release()
    super.onDestroy()
  }

  private inner class SessionCallback : MediaSession.Callback {
    override fun onConnect(
      session: MediaSession,
      controller: MediaSession.ControllerInfo,
    ): MediaSession.ConnectionResult {
      val commands =
        MediaSession.ConnectionResult.DEFAULT_SESSION_COMMANDS.buildUpon()
          .add(COMMAND_STOP)
          .add(COMMAND_LOAD_PLAYLIST)
          .add(COMMAND_RESTORE)
          .build()
      return MediaSession.ConnectionResult.AcceptedResultBuilder(session)
        .setAvailableSessionCommands(commands)
        .build()
    }

    override fun onPlayerCommandRequest(
      session: MediaSession,
      controller: MediaSession.ControllerInfo,
      playerCommand: Int,
    ): Int {
      // Headsets and other apps can send a plain stop, which must end an alarm like our Stop does.
      if (playerCommand == Player.COMMAND_STOP) handler.post { stopEverything() }
      return SessionResult.RESULT_SUCCESS
    }

    override fun onCustomCommand(
      session: MediaSession,
      controller: MediaSession.ControllerInfo,
      customCommand: SessionCommand,
      args: Bundle,
    ): ListenableFuture<SessionResult> {
      val ok =
        when (customCommand.customAction) {
          COMMAND_STOP.customAction -> {
            stopEverything()
            true
          }
          COMMAND_LOAD_PLAYLIST.customAction -> {
            leaveAlarmIfRinging()
            val trackId = if (args.containsKey(ARG_TRACK_ID)) args.getLong(ARG_TRACK_ID) else null
            load(args.getLong(ARG_PLAYLIST_ID), trackId, 0L, true, isAlarm = false).also {
              if (it) player.play()
            }
          }
          COMMAND_RESTORE.customAction -> {
            val saved = db.loadPlayback()
            saved != null &&
              load(saved.playlistId, saved.trackId, saved.positionMs, false, isAlarm = false).also {
                if (it) player.play()
              }
          }
          else -> false
        }
      val code = if (ok) SessionResult.RESULT_SUCCESS else SessionError.ERROR_BAD_VALUE
      return Futures.immediateFuture(SessionResult(code))
    }

    override fun onPlaybackResumption(
      mediaSession: MediaSession,
      controller: MediaSession.ControllerInfo,
      isForPlayback: Boolean,
    ): ListenableFuture<MediaSession.MediaItemsWithStartPosition> {
      val saved = db.loadPlayback()
      if (saved != null && load(saved.playlistId, saved.trackId, saved.positionMs, false, isAlarm = false)) {
        val items = (0 until player.mediaItemCount).map { player.getMediaItemAt(it) }
        return Futures.immediateFuture(
          MediaSession.MediaItemsWithStartPosition(
            items, player.currentMediaItemIndex, player.currentPosition))
      }
      return Futures.immediateFailedFuture(UnsupportedOperationException("Nothing to resume"))
    }

    private fun leaveAlarmIfRinging() {
      if (PlaybackInfo.state.isAlarm) endAlarmSession()
    }
  }

  companion object {
    private const val TAG = "PlaybackService"
    private const val SAVE_INTERVAL_MS = 5_000L
    private const val STARTING_CHANNEL = "starting_music"

    const val ACTION_START_ALARM = "com.morningmelody.action.START_ALARM"
    const val ACTION_STOP = "com.morningmelody.action.STOP"
    const val EXTRA_PLAYLIST_ID = "playlistId"
    const val EXTRA_VOLUME = "volume"
    const val EXTRA_FROM_BEGINNING = "fromBeginning"

    const val ARG_PLAYLIST_ID = "playlistId"
    const val ARG_TRACK_ID = "trackId"
    val COMMAND_STOP = SessionCommand("com.morningmelody.command.STOP", Bundle.EMPTY)
    val COMMAND_LOAD_PLAYLIST = SessionCommand("com.morningmelody.command.LOAD_PLAYLIST", Bundle.EMPTY)
    val COMMAND_RESTORE = SessionCommand("com.morningmelody.command.RESTORE", Bundle.EMPTY)

    private val MEDIA_ATTRIBUTES =
      AudioAttributes.Builder()
        .setUsage(C.USAGE_MEDIA)
        .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
        .build()

    // The alarm stream rings through silent mode and has its own volume.
    private val ALARM_ATTRIBUTES =
      AudioAttributes.Builder()
        .setUsage(C.USAGE_ALARM)
        .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
        .build()

    private fun Track.toMediaItem(): MediaItem {
      val metadata =
        MediaMetadata.Builder()
          .setTitle(title)
          .setArtist(artist)
          .setAlbumTitle(album)
          .setArtworkUri(artworkUri?.let(Uri::parse))
          .build()
      return MediaItem.Builder()
        .setMediaId(id.toString())
        .setUri(localUri)
        .setMediaMetadata(metadata)
        .build()
    }
  }
}
