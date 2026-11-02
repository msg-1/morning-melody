package com.morningmelody.bridge

import android.app.Activity
import android.content.Intent
import android.net.Uri
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.morningmelody.music.MusicScanner
import java.util.concurrent.Executors

class MusicLibraryModule(context: ReactApplicationContext) :
  ReactContextBaseJavaModule(context), ActivityEventListener {
  private val worker = Executors.newSingleThreadExecutor()
  private var pickPromise: Promise? = null

  init {
    context.addActivityEventListener(this)
  }

  override fun getName() = NAME

  @ReactMethod
  fun hasPermission(promise: Promise) = settle(promise) { MusicScanner.hasPermission(reactApplicationContext) }

  @ReactMethod
  fun scan(promise: Promise) {
    worker.execute { settle(promise) { MusicScanner.scan(reactApplicationContext) } }
  }

  /** Opens Android's own file picker. Resolves with the number of files added. */
  @ReactMethod
  fun pickFiles(promise: Promise) {
    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      promise.reject("E_NO_ACTIVITY", "The app is not on screen")
      return
    }
    pickPromise = promise
    val intent =
      Intent(Intent.ACTION_OPEN_DOCUMENT)
        .addCategory(Intent.CATEGORY_OPENABLE)
        .setType("audio/*")
        .putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
    activity.startActivityForResult(intent, REQUEST_PICK)
  }

  override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
    if (requestCode != REQUEST_PICK) return
    val promise = pickPromise ?: return
    pickPromise = null
    if (resultCode != Activity.RESULT_OK || data == null) {
      promise.resolve(0)
      return
    }
    val uris = ArrayList<Uri>()
    data.data?.let { uris.add(it) }
    data.clipData?.let { clip -> for (i in 0 until clip.itemCount) uris.add(clip.getItemAt(i).uri) }
    worker.execute {
      val context = reactApplicationContext
      var added = 0
      for (uri in uris.distinct()) {
        val ok =
          runCatching {
            // Keeps access to the file after a reboot, which an alarm depends on.
            context.contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
            MusicScanner.addPickedFile(context, uri)
          }
        if (ok.isSuccess) added++
      }
      promise.resolve(added)
    }
  }

  override fun onNewIntent(intent: Intent) = Unit

  override fun invalidate() {
    reactApplicationContext.removeActivityEventListener(this)
    worker.shutdown()
    super.invalidate()
  }

  companion object {
    const val NAME = "MelodyMusicLibrary"
    private const val REQUEST_PICK = 4101
  }
}
