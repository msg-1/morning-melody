package com.morningmelody.playback

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import com.morningmelody.R
import com.morningmelody.alarms.AlarmActivity

object AlarmNotifications {
  const val ALARM_NOTIFICATION_ID = 2001
  private const val ALARM_CHANNEL = "morning_alarm"

  private fun ensureChannel(context: Context) {
    val channel =
      NotificationChannel(ALARM_CHANNEL, "Alarms", NotificationManager.IMPORTANCE_HIGH).apply {
        description = "Shows the Stop button when an alarm goes off"
        // The music is the sound.
        setSound(null, null)
        setBypassDnd(true)
        lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      }
    context.getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
  }

  /** Lights up the screen with [AlarmActivity]; on an unlocked phone it appears as a banner. */
  fun buildRinging(context: Context, title: String): Notification {
    ensureChannel(context)
    val stop =
      PendingIntent.getService(
        context,
        1,
        Intent(context, PlaybackService::class.java).setAction(PlaybackService.ACTION_STOP),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    return base(context, title, "Good morning", activityIntent(context, null))
      .setOngoing(true)
      .addAction(0, "Stop alarm", stop)
      .build()
  }

  /** Fallback for when Android refuses to start playback in the background. */
  fun buildTapToStart(context: Context, start: Intent): Notification {
    ensureChannel(context)
    return base(context, "Your alarm", "Tap to start your morning music", activityIntent(context, start))
      .setAutoCancel(true)
      .setDefaults(Notification.DEFAULT_SOUND or Notification.DEFAULT_VIBRATE)
      .build()
  }

  private fun base(context: Context, title: String, text: String, fullScreen: PendingIntent) =
    NotificationCompat.Builder(context, ALARM_CHANNEL)
      .setSmallIcon(R.drawable.ic_notification)
      .setContentTitle(title)
      .setContentText(text)
      .setCategory(NotificationCompat.CATEGORY_ALARM)
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setContentIntent(fullScreen)
      .setFullScreenIntent(fullScreen, true)

  private fun activityIntent(context: Context, start: Intent?): PendingIntent {
    val intent =
      Intent(context, AlarmActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    if (start != null) intent.putExtra(AlarmActivity.EXTRA_START_SERVICE, start)
    return PendingIntent.getActivity(
      context, 2, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }
}
