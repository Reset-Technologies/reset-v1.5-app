import { apiClient } from "./apiClient";

/**
 * Notify the backend that the app has been opened.
 * Cancels any pending re-engagement pushes (PRD §19.2 Action Paths).
 * Fire-and-forget — errors are swallowed.
 *
 * RES-221 — also refreshes the stored timezone. Scheduled notifications fire on
 * the member's local clock, and until now the server mostly had no timezone at
 * all: it was dropped at signup, and returning legacy members arrive with a
 * stale fixed offset or nothing. Sending it on every foreground also means a
 * member who moves or travels self-corrects.
 */
export async function notifyAppOpened(): Promise<void> {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    await apiClient("/api/notifications/app-opened", {
      method: "POST",
      body: JSON.stringify({ timezone }),
    });
  } catch {
    // Non-blocking. If the user isn't authenticated, the server will 401 and
    // we simply skip — there are no re-engagement pushes scheduled for an
    // anonymous user anyway.
  }
}
