package expo.modules.resetliveactivity

import android.app.NotificationManager
import android.content.Context
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Android half of the Live Activity module. Implements the SAME native surface
 * as the iOS one (`isSupported` / `sync` / `end`) so `index.ts` and everything
 * above it — including `syncWindowLiveActivity` — stay platform-agnostic.
 */
class ResetLiveActivityModule : Module() {
  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "No react context" }

  override fun definition() = ModuleDefinition {
    Name("ResetLiveActivity")

    Function("isSupported") {
      val manager = context.getSystemService(NotificationManager::class.java)
      manager != null && manager.areNotificationsEnabled()
    }

    AsyncFunction("sync") { phase: String, startAtMs: Double, openAtMs: Double, windowLabel: String ->
      val manager = context.getSystemService(NotificationManager::class.java)
        ?: return@AsyncFunction "unavailable"
      if (!manager.areNotificationsEnabled()) return@AsyncFunction "disabled"

      // Android has no "is there an activity running" query, so we track
      // whether OUR notification is currently posted to tell started from
      // updated. The JS layer already suppresses unchanged content.
      val existing = manager.activeNotifications.any {
        it.id == ResetWindowNotification.NOTIFICATION_ID
      }
      ResetWindowNotification.show(
        context,
        phase,
        startAtMs.toLong(),
        openAtMs.toLong(),
        windowLabel,
      )
      if (existing) "updated" else "started"
    }

    AsyncFunction("end") {
      ResetWindowNotification.clear(context)
    }
  }
}
