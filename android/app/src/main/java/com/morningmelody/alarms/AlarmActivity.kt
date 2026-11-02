package com.morningmelody.alarms

import android.app.NotificationManager
import android.content.ComponentName
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.content.IntentCompat
import androidx.media3.common.Player
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.google.common.util.concurrent.ListenableFuture
import com.google.common.util.concurrent.MoreExecutors
import com.morningmelody.playback.AlarmNotifications
import com.morningmelody.playback.PlaybackInfo
import com.morningmelody.playback.PlaybackService
import java.text.DateFormat
import java.util.Date

/** The screen that lights up over the lock screen. Follows the Now Playing design from Penpot. */
class AlarmActivity : AppCompatActivity() {
  private var controllerFuture: ListenableFuture<MediaController>? = null
  private var controller: MediaController? = null
  private lateinit var songView: TextView
  private lateinit var detailView: TextView
  private lateinit var pauseButton: TextView
  private lateinit var nextButton: TextView

  private val infoListener: (PlaybackInfo.State) -> Unit = { state ->
    if (!state.isAlarm) finish() else refresh()
  }

  private val playerListener =
    object : Player.Listener {
      override fun onEvents(player: Player, events: Player.Events) = refresh()
    }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    setContentView(buildContent())

    // Reached from the "tap to start" fallback when the system refused a background start.
    val pendingStart = IntentCompat.getParcelableExtra(intent, EXTRA_START_SERVICE, Intent::class.java)
    if (pendingStart != null) {
      getSystemService(NotificationManager::class.java).cancel(AlarmNotifications.ALARM_NOTIFICATION_ID)
      ContextCompat.startForegroundService(this, pendingStart)
    } else if (!PlaybackInfo.state.isAlarm) {
      // Opened from a stale notification after the alarm already ended.
      finish()
    }
  }

  override fun onStart() {
    super.onStart()
    PlaybackInfo.addListener(infoListener)
    val token = SessionToken(this, ComponentName(this, PlaybackService::class.java))
    val future = MediaController.Builder(this, token).buildAsync()
    controllerFuture = future
    future.addListener(
      {
        controller = runCatching { future.get() }.getOrNull()
        controller?.addListener(playerListener)
        refresh()
      },
      MoreExecutors.directExecutor())
  }

  override fun onStop() {
    PlaybackInfo.removeListener(infoListener)
    controller?.removeListener(playerListener)
    controller = null
    controllerFuture?.let { MediaController.releaseFuture(it) }
    controllerFuture = null
    super.onStop()
  }

  private fun refresh() {
    val player = controller
    val state = PlaybackInfo.state
    songView.text = player?.mediaMetadata?.title?.toString() ?: "Your morning music"
    detailView.text =
      if (state.fallback) "Your songs could not be found, so a gentle chime is playing"
      else state.playlistName ?: ""
    pauseButton.text = if (player?.playWhenReady == false) "Play" else "Pause"
    nextButton.visibility =
      if (!state.fallback && player?.hasNextMediaItem() == true) View.VISIBLE else View.GONE
  }

  private fun buildContent(): View {
    val root =
      LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        gravity = Gravity.CENTER_HORIZONTAL
        setBackgroundColor(CREAM)
        setPadding(dp(24), dp(72), dp(24), dp(40))
      }
    root.addView(label("Good morning", 30f, INK, BOLD))
    root.addView(
      label(DateFormat.getTimeInstance(DateFormat.SHORT).format(Date()), 54f, SAGE, BOLD).apply {
        setPadding(0, dp(12), 0, dp(12))
      })
    root.addView(View(this), LinearLayout.LayoutParams(0, 0, 1f))
    songView = label("Your morning music", 26f, INK, BOLD)
    detailView = label("", 19f, MUTED, REGULAR).apply { setPadding(0, dp(8), 0, 0) }
    root.addView(songView)
    root.addView(detailView)
    root.addView(View(this), LinearLayout.LayoutParams(0, 0, 1f))

    pauseButton =
      button("Pause", SAGE, Color.WHITE) {
        val player = controller ?: return@button
        if (player.playWhenReady) player.pause() else player.play()
      }
    root.addView(pauseButton)
    root.addView(View(this), LinearLayout.LayoutParams(0, dp(16)))
    nextButton = button("Next song", SOFT, INK) { controller?.seekToNext() }
    root.addView(nextButton)
    root.addView(View(this), LinearLayout.LayoutParams(0, dp(16)))
    root.addView(
      button("Stop alarm", STOP_BACKGROUND, STOP_TEXT) {
        startService(
          Intent(this, PlaybackService::class.java).setAction(PlaybackService.ACTION_STOP))
        finish()
      })
    return root
  }

  private fun label(text: String, sizeSp: Float, color: Int, font: String) =
    TextView(this).apply {
      this.text = text
      gravity = Gravity.CENTER
      setTextColor(color)
      setTextSize(TypedValue.COMPLEX_UNIT_SP, sizeSp)
      typeface = Typeface.createFromAsset(assets, "fonts/$font.ttf")
    }

  private fun button(text: String, background: Int, color: Int, onClick: () -> Unit) =
    label(text, 24f, color, BOLD).apply {
      minHeight = dp(84)
      layoutParams =
        LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
      this.background =
        GradientDrawable().apply {
          setColor(background)
          cornerRadius = dp(20).toFloat()
        }
      isClickable = true
      setOnClickListener { onClick() }
    }

  private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()

  companion object {
    const val EXTRA_START_SERVICE = "startService"
    private const val BOLD = "Inter_700Bold"
    private const val REGULAR = "Inter_400Regular"
    private val CREAM = Color.parseColor("#F4F1E8")
    private val INK = Color.parseColor("#26352D")
    private val MUTED = Color.parseColor("#5A665C")
    private val SAGE = Color.parseColor("#55745D")
    private val SOFT = Color.parseColor("#E5EBDD")
    private val STOP_BACKGROUND = Color.parseColor("#F0E4D7")
    private val STOP_TEXT = Color.parseColor("#8A583E")
  }
}
