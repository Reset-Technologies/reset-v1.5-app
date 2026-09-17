package expo.modules.resetliveactivity

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * The Android counterpart of the iOS Live Activity: one ongoing notification
 * that sits on the lock screen for the life of a Reset.
 *
 * 🔑 The timer is drawn by the SYSTEM, not by us. `setUsesChronometer` +
 * `setWhen` make Android tick the clock itself, which is what lets the card
 * stay correct while the app is killed — the same property `Text(timerInterval:)`
 * gives us on iOS. We never post an update just to advance a number.
 *
 * 🔑 We cannot reproduce the iOS card. A promoted notification must use a
 * system template and is barred from custom RemoteViews, so Android draws the
 * container and we supply title, text, an icon and a progress bar.
 */
object ResetWindowNotification {
  const val CHANNEL_ID = "reset_window"
  const val NOTIFICATION_ID = 4210 // "14:10"

  const val PHASE_EATING = "eating"
  const val PHASE_RESET = "reset"

  const val ACTION_ARM = "expo.modules.resetliveactivity.ARM"
  const val ACTION_FLIP = "expo.modules.resetliveactivity.FLIP"

  /**
   * How long before the boundary we swap the cheap inexact alarm for the exact
   * one. Doze rate-limits `setAndAllowWhileIdle` to roughly one firing every 9
   * minutes, so 30 leaves ample margin for the arm to land in time.
   */
  private const val ARM_LEAD_MS = 30 * 60 * 1000L

  fun show(
    context: Context,
    phase: String,
    startAtMs: Long,
    openAtMs: Long,
    windowLabel: String,
  ) {
    ensureChannel(context)
    val manager = context.getSystemService(NotificationManager::class.java) ?: return
    manager.notify(NOTIFICATION_ID, build(context, phase, startAtMs, openAtMs, windowLabel))
    scheduleBoundary(context, phase, startAtMs, openAtMs, windowLabel)
  }

  fun clear(context: Context) {
    context.getSystemService(NotificationManager::class.java)?.cancel(NOTIFICATION_ID)
    cancelBoundary(context)
  }

  private fun build(
    context: Context,
    phase: String,
    startAtMs: Long,
    openAtMs: Long,
    windowLabel: String,
  ): Notification {
    val reset = phase == PHASE_RESET
    // Counting UP from the start once the Reset is running, DOWN to it while
    // the eating window is still open — mirrors the iOS card exactly.
    val base = startAtMs
    val title = if (reset) "You're in your Reset" else "Eating window open"
    val text =
      if (reset) "$windowLabel Window · Eating window opens at ${clock(openAtMs)}"
      else "$windowLabel Window · Your Reset starts at ${clock(startAtMs)}"

    val builder = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(smallIcon(context))
      .setContentTitle(title)
      .setContentText(text)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setShowWhen(true)
      .setWhen(base)
      .setUsesChronometer(true)
      .setChronometerCountDown(!reset)
      .setContentIntent(openApp(context))
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)

    // Android 16's "Live Update": promotes the notification to the lock screen
    // and a status-bar chip for the life of the task. 🔑 There is no platform
    // setter for this — `Notification.FLAG_PROMOTED_ONGOING` is read-only and
    // set BY the system — so the request goes through NotificationCompat
    // (androidx.core 1.16+; we resolve 1.17). On older Android it is a no-op
    // and the card degrades to an ordinary ongoing notification, which still
    // sits on the lock screen and still ticks.
    builder.setRequestPromotedOngoing(true)

    // A progress bar the member can read at a glance: how far through the
    // Reset they are, start → eating window opens. Same quantity the iOS ring
    // shows. The system draws it; we only supply the number.
    val span = (openAtMs - startAtMs).toFloat()
    if (span > 0f) {
      val elapsed = (System.currentTimeMillis() - startAtMs).toFloat()
      val pct = ((elapsed / span) * 100f).toInt().coerceIn(0, 100)
      builder.setStyle(
        NotificationCompat.ProgressStyle()
          .addProgressSegment(NotificationCompat.ProgressStyle.Segment(100))
          .setProgress(pct)
      )
    }

    return builder.build()
  }

  /**
   * Flips the card at the exact moment the phase changes, for a member who
   * never opens the app.
   *
   * 🔑 TWO-STAGE, and the reason is the only way to get exact timing on Android
   * without asking for anything:
   *
   *  1. an INEXACT alarm 30 minutes out (`setAndAllowWhileIdle`) — free, no
   *     permission, Doze may delay it by ~9 min, which the lead absorbs;
   *  2. that one arms `setAlarmClock` for the real boundary — exact to the
   *     second and exempt from Doze, because the system treats an alarm clock
   *     as a user-visible commitment.
   *
   * 🔴 Stage 2 only runs when `canScheduleExactAlarms()` says we may.
   * `setAlarmClock` is NOT permission-free — it sits behind the same
   * `SCHEDULE_EXACT_ALARM` gate as `setExact`, which Android 14+ denies by
   * default. Verified on an Android 16 S24: the call is refused with
   * "lost permission to set exact alarms" and, because the notification is
   * already posted by then, it fails completely silently. When we can't have
   * it, we fall back to a single inexact alarm on the boundary — the card is
   * then up to ~9 minutes late to change its label in Doze, while the
   * system-drawn timer stays correct throughout.
   *
   * 🔴 That commitment is exactly why we only arm it for the last half hour:
   * an alarm clock puts an alarm icon in the status bar and its time on the
   * lock screen, and Android shows the SOONEST one. Armed all day it would sit
   * there permanently and could mask the member's real morning alarm — a
   * silent alarm that never rings and isn't in their Clock app. Half an hour
   * before a flip is a fair price; all night is not.
   *
   * The exact-alarm permissions are not an option here: `SCHEDULE_EXACT_ALARM`
   * is denied by default on Android 14+, and `USE_EXACT_ALARM` is restricted by
   * Play policy to alarm/clock/calendar apps, which we are not.
   */
  private fun scheduleBoundary(
    context: Context,
    phase: String,
    startAtMs: Long,
    openAtMs: Long,
    windowLabel: String,
  ) {
    val alarms = context.getSystemService(AlarmManager::class.java) ?: return
    val reset = phase == PHASE_RESET
    // While eating, the next event is the Reset starting. While resetting, it
    // is the eating window opening — at which point the card comes down, which
    // an empty phase encodes.
    val triggerAt = if (reset) openAtMs else startAtMs
    val nextPhase = if (reset) "" else PHASE_RESET
    val now = System.currentTimeMillis()
    if (triggerAt <= now) return

    cancelBoundary(context)

    val flip = pending(context, ACTION_FLIP, triggerAt, nextPhase, startAtMs, openAtMs, windowLabel)
    if (!alarms.canScheduleExactAlarms()) {
      // No exact alarms for us: one inexact alarm on the boundary itself.
      alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, flip)
      return
    }

    val armAt = triggerAt - ARM_LEAD_MS
    if (armAt > now) {
      alarms.setAndAllowWhileIdle(
        AlarmManager.RTC_WAKEUP,
        armAt,
        pending(context, ACTION_ARM, triggerAt, nextPhase, startAtMs, openAtMs, windowLabel),
      )
    } else {
      // Already inside the lead (e.g. the app synced 10 minutes before the
      // flip) — skip straight to the exact alarm.
      armExact(context, triggerAt, nextPhase, startAtMs, openAtMs, windowLabel)
    }
  }

  /** Stage 2: the exact, Doze-exempt alarm for the boundary itself. */
  fun armExact(
    context: Context,
    triggerAt: Long,
    nextPhase: String,
    startAtMs: Long,
    openAtMs: Long,
    windowLabel: String,
  ) {
    val alarms = context.getSystemService(AlarmManager::class.java) ?: return
    if (triggerAt <= System.currentTimeMillis()) return
    val flip = pending(context, ACTION_FLIP, triggerAt, nextPhase, startAtMs, openAtMs, windowLabel)
    // Re-checked here, not just at schedule time: the member can revoke
    // "Alarms & reminders" in the half hour between the two stages.
    if (!alarms.canScheduleExactAlarms()) {
      alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, flip)
      return
    }
    alarms.setAlarmClock(
      AlarmManager.AlarmClockInfo(triggerAt, openApp(context)),
      flip,
    )
  }

  private fun cancelBoundary(context: Context) {
    val alarms = context.getSystemService(AlarmManager::class.java) ?: return
    // PendingIntent equality ignores extras, so matching on the action alone is
    // enough to find and cancel whichever stage is outstanding.
    alarms.cancel(pending(context, ACTION_ARM, 0L, "", 0L, 0L, ""))
    alarms.cancel(pending(context, ACTION_FLIP, 0L, "", 0L, 0L, ""))
  }

  private fun pending(
    context: Context,
    action: String,
    triggerAt: Long,
    nextPhase: String,
    startAtMs: Long,
    openAtMs: Long,
    windowLabel: String,
  ): PendingIntent {
    val intent = Intent(context, ResetWindowAlarmReceiver::class.java).apply {
      this.action = action
      putExtra(ResetWindowAlarmReceiver.EXTRA_TRIGGER_AT, triggerAt)
      putExtra(ResetWindowAlarmReceiver.EXTRA_PHASE, nextPhase)
      putExtra(ResetWindowAlarmReceiver.EXTRA_START_AT, startAtMs)
      putExtra(ResetWindowAlarmReceiver.EXTRA_OPEN_AT, openAtMs)
      putExtra(ResetWindowAlarmReceiver.EXTRA_LABEL, windowLabel)
    }
    return PendingIntent.getBroadcast(
      context,
      NOTIFICATION_ID,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  private fun openApp(context: Context): PendingIntent? {
    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
      ?: return null
    return PendingIntent.getActivity(
      context,
      0,
      launch,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  /**
   * An Android notification icon must be a flat alpha-only silhouette — the
   * system tints it and masks everything else to white. Resolved by NAME so a
   * designer can drop in `notification_icon` later without touching Kotlin;
   * until then we fall back to the app icon.
   */
  private fun smallIcon(context: Context): Int {
    val named = context.resources.getIdentifier("notification_icon", "drawable", context.packageName)
    return if (named != 0) named else context.applicationInfo.icon
  }

  private fun clock(atMs: Long): String =
    SimpleDateFormat("h:mma", Locale.getDefault()).format(Date(atMs)).lowercase(Locale.getDefault())

  private fun ensureChannel(context: Context) {
    val manager = context.getSystemService(NotificationManager::class.java) ?: return
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return
    // IMPORTANCE_LOW keeps every update silent — the card changes several times
    // a night and none of it is worth a sound. 🔴 It must not be IMPORTANCE_MIN:
    // Android 16 refuses to promote a MIN-importance notification.
    val channel = NotificationChannel(
      CHANNEL_ID,
      "Reset Window",
      NotificationManager.IMPORTANCE_LOW,
    ).apply {
      description = "Your Reset on the lock screen"
      setShowBadge(false)
    }
    manager.createNotificationChannel(channel)
  }
}
