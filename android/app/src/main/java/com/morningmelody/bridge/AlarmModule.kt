package com.morningmelody.bridge

import android.app.NotificationManager
import android.app.TimePickerDialog
import android.content.ComponentName
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.text.format.DateFormat
import androidx.core.app.NotificationManagerCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.morningmelody.alarms.AlarmScheduler
import com.morningmelody.db.Alarm
import com.morningmelody.db.MelodyDatabase
import com.morningmelody.music.MusicScanner

/** Alarm editing plus the permissions and phone settings that alarms depend on. */
class AlarmModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  private val db get() = MelodyDatabase.get(reactApplicationContext)

  override fun getName() = NAME

  @ReactMethod
  fun listAlarms(promise: Promise) = settle(promise) { db.listAlarms().toArray { it.toMap() } }

  @ReactMethod
  fun getAlarm(id: Double, promise: Promise) = settle(promise) { db.getAlarm(id.toLong())?.toMap() }

  /** Saves and arms an alarm. Resolves with the alarm as stored, including its next ring time. */
  @ReactMethod
  fun saveAlarm(input: ReadableMap, promise: Promise) = settle(promise) {
    val alarm =
      Alarm(
        id = if (input.hasKey("id") && !input.isNull("id")) input.getDouble("id").toLong() else 0L,
        hour = input.getInt("hour"),
        minute = input.getInt("minute"),
        enabled = input.getBoolean("enabled"),
        repeatDays = input.getInt("repeatDays"),
        playlistId =
          if (input.hasKey("playlistId") && !input.isNull("playlistId")) {
            input.getDouble("playlistId").toLong()
          } else null,
        volume = input.getInt("volume"),
        startFromBeginning = input.getBoolean("startFromBeginning"),
        createdAt = 0L,
        nextTriggerAt = null,
      )
    val id = db.saveAlarm(alarm)
    val stored = db.getAlarm(id)!!
    if (stored.enabled) AlarmScheduler.schedule(reactApplicationContext, stored)
    else AlarmScheduler.cancel(reactApplicationContext, id)
    db.getAlarm(id)!!.toMap()
  }

  @ReactMethod
  fun setAlarmEnabled(id: Double, enabled: Boolean, promise: Promise) = settle(promise) {
    db.setAlarmEnabled(id.toLong(), enabled)
    val alarm = db.getAlarm(id.toLong())!!
    if (enabled) AlarmScheduler.schedule(reactApplicationContext, alarm)
    else AlarmScheduler.cancel(reactApplicationContext, alarm.id)
    db.getAlarm(id.toLong())!!.toMap()
  }

  @ReactMethod
  fun deleteAlarm(id: Double, promise: Promise) = settle(promise) {
    AlarmScheduler.cancel(reactApplicationContext, id.toLong())
    db.deleteAlarm(id.toLong())
    null
  }

  @ReactMethod
  fun rescheduleAll(promise: Promise) = settle(promise) {
    AlarmScheduler.rescheduleAll(reactApplicationContext)
    null
  }

  @ReactMethod
  fun scheduleTest(playlistId: Double, volume: Double, delayMs: Double, promise: Promise) =
    settle(promise) {
      AlarmScheduler.scheduleTest(
          reactApplicationContext,
          playlistId.toLong().takeIf { it > 0 },
          volume.toInt(),
          delayMs.toLong())
        .toDouble()
    }

  @ReactMethod
  fun pickTime(hour: Double, minute: Double, promise: Promise) {
    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      promise.resolve(null)
      return
    }
    activity.runOnUiThread {
      var settled = false
      val dialog =
        TimePickerDialog(
          activity,
          { _, h, m ->
            settled = true
            promise.resolve(
              Arguments.createMap().apply {
                putInt("hour", h)
                putInt("minute", m)
              })
          },
          hour.toInt(),
          minute.toInt(),
          DateFormat.is24HourFormat(activity))
      dialog.setOnDismissListener { if (!settled) promise.resolve(null) }
      dialog.show()
    }
  }

  @ReactMethod
  fun getSetupStatus(promise: Promise) = settle(promise) {
    val context = reactApplicationContext
    val power = context.getSystemService(PowerManager::class.java)
    Arguments.createMap().apply {
      putBoolean("music", MusicScanner.hasPermission(context))
      putBoolean("notifications", NotificationManagerCompat.from(context).areNotificationsEnabled())
      putBoolean("exactAlarms", AlarmScheduler.canScheduleExact(context))
      putBoolean("battery", power.isIgnoringBatteryOptimizations(context.packageName))
      putBoolean(
        "fullScreen",
        Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE ||
          context.getSystemService(NotificationManager::class.java).canUseFullScreenIntent())
      putBoolean("hasAutostartPage", autostartIntent() != null)
      putString("manufacturer", Build.MANUFACTURER)
    }
  }

  @ReactMethod
  fun openSetting(which: String, promise: Promise) = settle(promise) {
    val context = reactApplicationContext
    val packageUri = Uri.parse("package:${context.packageName}")
    val intent =
      when (which) {
        "exactAlarms" ->
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, packageUri)
          } else null
        "battery" -> Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, packageUri)
        "fullScreen" ->
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, packageUri)
          } else null
        "notifications" ->
          Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
            .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
        "autostart" -> autostartIntent()
        else -> null
      } ?: Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, packageUri)
    val starter = context.currentActivity
    if (starter != null) starter.startActivity(intent)
    else context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    null
  }

  /** Several manufacturers block background starts behind a private "autostart" page. */
  private fun autostartIntent(): Intent? {
    val packageManager = reactApplicationContext.packageManager
    return AUTOSTART_PAGES.map { (pkg, cls) -> Intent().setComponent(ComponentName(pkg, cls)) }
      .firstOrNull { it.resolveActivityInfo(packageManager, 0)?.exported == true }
  }

  companion object {
    const val NAME = "MelodyAlarms"
    private val AUTOSTART_PAGES =
      listOf(
        "com.miui.securitycenter" to "com.miui.permcenter.autostart.AutoStartManagementActivity",
        "com.coloros.safecenter" to "com.coloros.safecenter.permission.startup.StartupAppListActivity",
        "com.coloros.safecenter" to "com.coloros.safecenter.startupapp.StartupAppListActivity",
        "com.oppo.safe" to "com.oppo.safe.permission.startup.StartupAppListActivity",
        "com.vivo.permissionmanager" to "com.vivo.permissionmanager.activity.BgStartUpManagerActivity",
        "com.iqoo.secure" to "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity",
        "com.huawei.systemmanager" to "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity",
        "com.huawei.systemmanager" to "com.huawei.systemmanager.optimize.process.ProtectActivity",
        "com.oneplus.security" to "com.oneplus.security.chainlaunch.view.ChainLaunchAppListActivity",
        "com.letv.android.letvsafe" to "com.letv.android.letvsafe.AutobootManageActivity",
        "com.asus.mobilemanager" to "com.asus.mobilemanager.entry.FunctionActivity",
      )
  }
}
