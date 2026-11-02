package com.morningmelody.alarms

import android.app.ForegroundServiceStartNotAllowedException
import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.PowerManager
import android.util.Log
import androidx.core.content.ContextCompat
import com.morningmelody.db.MelodyDatabase
import com.morningmelody.playback.AlarmNotifications
import com.morningmelody.playback.PlaybackService

/** Entry point when AlarmManager fires. No JavaScript is involved from here on. */
class AlarmReceiver : BroadcastReceiver() {

  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != AlarmScheduler.ACTION_FIRE) return

    // The system only holds the CPU awake until onReceive returns, which can be before the service
    // has started, so hold a short wake lock of our own to bridge the gap.
    context
      .getSystemService(PowerManager::class.java)
      .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "MorningMelody:alarmStart")
      .acquire(WAKE_LOCK_TIMEOUT_MS)

    val alarmId = intent.getLongExtra(AlarmScheduler.EXTRA_ALARM_ID, -1L)
    val start = Intent(context, PlaybackService::class.java).setAction(PlaybackService.ACTION_START_ALARM)

    if (alarmId < 0) {
      if (intent.hasExtra(AlarmScheduler.EXTRA_PLAYLIST_ID)) {
        start.putExtra(
          PlaybackService.EXTRA_PLAYLIST_ID, intent.getLongExtra(AlarmScheduler.EXTRA_PLAYLIST_ID, -1L))
      }
      start.putExtra(PlaybackService.EXTRA_VOLUME, intent.getIntExtra(AlarmScheduler.EXTRA_VOLUME, 70))
      start.putExtra(PlaybackService.EXTRA_FROM_BEGINNING, true)
    } else {
      val db = MelodyDatabase.get(context)
      val alarm = db.getAlarm(alarmId)
      if (alarm == null || !alarm.enabled) return

      // Arm the next occurrence before anything else can go wrong with playback.
      if (alarm.repeatDays != 0) {
        AlarmScheduler.schedule(context, alarm)
      } else {
        db.setAlarmEnabled(alarm.id, false)
        db.setAlarmNextTrigger(alarm.id, null)
      }

      if (alarm.playlistId != null) start.putExtra(PlaybackService.EXTRA_PLAYLIST_ID, alarm.playlistId)
      start.putExtra(PlaybackService.EXTRA_VOLUME, alarm.volume)
      start.putExtra(PlaybackService.EXTRA_FROM_BEGINNING, alarm.startFromBeginning)
    }

    try {
      ContextCompat.startForegroundService(context, start)
    } catch (error: Exception) {
      val refused =
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
          error is ForegroundServiceStartNotAllowedException
      if (!refused) throw error
      // Rare, but a phone can refuse. Ask for a tap, which is allowed to start the music.
      Log.w(TAG, "System refused to start playback from the background", error)
      val notification = AlarmNotifications.buildTapToStart(context, start)
      context
        .getSystemService(NotificationManager::class.java)
        .notify(AlarmNotifications.ALARM_NOTIFICATION_ID, notification)
    }
  }

  companion object {
    private const val TAG = "AlarmReceiver"
    private const val WAKE_LOCK_TIMEOUT_MS = 15_000L
  }
}
