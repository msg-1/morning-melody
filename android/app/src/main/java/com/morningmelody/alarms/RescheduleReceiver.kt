package com.morningmelody.alarms

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Android forgets all alarms on reboot and they must be recomputed when the clock changes. */
class RescheduleReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    AlarmScheduler.rescheduleAll(context)
  }
}
