package com.morningmelody.alarms

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.util.Log
import com.morningmelody.MainActivity
import com.morningmelody.db.Alarm
import com.morningmelody.db.MelodyDatabase
import java.time.ZonedDateTime

object AlarmScheduler {
  private const val TAG = "AlarmScheduler"
  const val ACTION_FIRE = "com.morningmelody.action.FIRE_ALARM"
  const val EXTRA_ALARM_ID = "alarmId"
  const val EXTRA_PLAYLIST_ID = "playlistId"
  const val EXTRA_VOLUME = "volume"
  private const val TEST_ALARM_ID = -1L

  fun canScheduleExact(context: Context): Boolean =
    Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
      context.getSystemService(AlarmManager::class.java).canScheduleExactAlarms()

  /** Arms one alarm for its next occurrence and returns that time in epoch milliseconds. */
  fun schedule(context: Context, alarm: Alarm): Long {
    val trigger =
      nextTrigger(ZonedDateTime.now(), alarm.hour, alarm.minute, alarm.repeatDays)
        .toInstant()
        .toEpochMilli()
    arm(context, trigger, firePendingIntent(context, alarm.id, null, 0))
    MelodyDatabase.get(context).setAlarmNextTrigger(alarm.id, trigger)
    return trigger
  }

  fun cancel(context: Context, alarmId: Long) {
    val manager = context.getSystemService(AlarmManager::class.java)
    manager.cancel(firePendingIntent(context, alarmId, null, 0))
    MelodyDatabase.get(context).setAlarmNextTrigger(alarmId, null)
  }

  /**
   * Re-arms everything from the database. Called after boot, time and timezone changes, app updates
   * and on every app start, which also repairs the damage of a force stop. A one-time alarm whose
   * moment passed while the phone could not ring is switched off rather than ringing a day late.
   */
  fun rescheduleAll(context: Context) {
    val db = MelodyDatabase.get(context)
    val now = System.currentTimeMillis()
    for (alarm in db.listAlarms()) {
      if (!alarm.enabled) continue
      val missedOneTime = alarm.repeatDays == 0 && (alarm.nextTriggerAt ?: Long.MAX_VALUE) < now
      if (missedOneTime) {
        db.setAlarmEnabled(alarm.id, false)
        cancel(context, alarm.id)
      } else {
        schedule(context, alarm)
      }
    }
  }

  /** Runs the real alarm path, including the lock screen, without saving an alarm. */
  fun scheduleTest(context: Context, playlistId: Long?, volume: Int, delayMs: Long): Long {
    val trigger = System.currentTimeMillis() + delayMs
    arm(context, trigger, firePendingIntent(context, TEST_ALARM_ID, playlistId, volume))
    return trigger
  }

  private fun arm(context: Context, triggerAt: Long, operation: PendingIntent) {
    val manager = context.getSystemService(AlarmManager::class.java)
    try {
      if (canScheduleExact(context)) {
        // setAlarmClock is exempt from Doze and shows the alarm icon in the status bar.
        manager.setAlarmClock(AlarmManager.AlarmClockInfo(triggerAt, showPendingIntent(context)), operation)
        return
      }
    } catch (error: SecurityException) {
      Log.w(TAG, "Exact alarm refused", error)
    }
    // Reached only when the user revoked the exact alarm permission; the setup screen warns about it.
    manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, operation)
  }

  private fun firePendingIntent(
    context: Context,
    alarmId: Long,
    playlistId: Long?,
    volume: Int,
  ): PendingIntent {
    val intent =
      Intent(context, AlarmReceiver::class.java)
        .setAction(ACTION_FIRE)
        .setData(Uri.parse("morningmelody://alarm/$alarmId"))
        .putExtra(EXTRA_ALARM_ID, alarmId)
        .putExtra(EXTRA_VOLUME, volume)
    if (playlistId != null) intent.putExtra(EXTRA_PLAYLIST_ID, playlistId)
    return PendingIntent.getBroadcast(
      context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  private fun showPendingIntent(context: Context): PendingIntent =
    PendingIntent.getActivity(
      context,
      0,
      Intent(context, MainActivity::class.java),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
}
