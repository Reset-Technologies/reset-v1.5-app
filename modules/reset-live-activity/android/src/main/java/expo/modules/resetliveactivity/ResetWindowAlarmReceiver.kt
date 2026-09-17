package expo.modules.resetliveactivity

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Both stages of the boundary alarm land here.
 *
 *  - ARM  (inexact, ~30 min out): swap in the exact alarm clock.
 *  - FLIP (exact, on the boundary): change the card, or take it down.
 *
 * An empty phase means the Reset is over and the card goes away.
 */
class ResetWindowAlarmReceiver : BroadcastReceiver() {
  companion object {
    const val EXTRA_TRIGGER_AT = "triggerAt"
    const val EXTRA_PHASE = "phase"
    const val EXTRA_START_AT = "startAt"
    const val EXTRA_OPEN_AT = "openAt"
    const val EXTRA_LABEL = "label"
  }

  override fun onReceive(context: Context, intent: Intent) {
    val phase = intent.getStringExtra(EXTRA_PHASE).orEmpty()
    val startAt = intent.getLongExtra(EXTRA_START_AT, 0L)
    val openAt = intent.getLongExtra(EXTRA_OPEN_AT, 0L)
    val label = intent.getStringExtra(EXTRA_LABEL).orEmpty()

    when (intent.action) {
      ResetWindowNotification.ACTION_ARM ->
        ResetWindowNotification.armExact(
          context,
          intent.getLongExtra(EXTRA_TRIGGER_AT, 0L),
          phase,
          startAt,
          openAt,
          label,
        )

      ResetWindowNotification.ACTION_FLIP ->
        if (phase.isEmpty()) {
          ResetWindowNotification.clear(context)
        } else {
          // show() re-schedules the NEXT boundary on its way out, so the card
          // keeps stepping itself forward without the app ever running.
          ResetWindowNotification.show(context, phase, startAt, openAt, label)
        }
    }
  }
}
