package com.morningmelody

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.morningmelody.alarms.AlarmScheduler

class MainActivity : ReactActivity() {

  override fun onCreate(savedInstanceState: android.os.Bundle?) {
    // Not savedInstanceState: react-native-screens cannot rebuild its fragments, so restoring them
    // after Android kills the app in the background crashes on reopening.
    super.onCreate(null)
    // A force stop silently cancels alarms, so re-arm them whenever the app is opened. This must not
    // move to Application.onCreate: that also runs when an alarm wakes the process, and would switch
    // off a one-time alarm just before its receiver reads it.
    AlarmScheduler.rescheduleAll(this)
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "MorningMelody"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
