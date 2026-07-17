import { apiClient, storeTokens, clearTokens, API_BASE_URL } from "./apiClient";
import * as BrazeService from "./braze";

export interface AuthUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  phoneNumber?: string | null;
  avatarUrl?: string | null;
  timezone?: string | null;
  createdAt?: string;
}

export async function registerWithEmail(
  email: string,
  password: string,
  timezone?: string,
  firstName?: string,
  lastName?: string,
): Promise<AuthUser> {
  const data = await apiClient("/api/auth/register/email", {
    method: "POST",
    body: JSON.stringify({ email, password, firstName, lastName, timezone }),
  });

  // Register endpoint returns {id, email, firstName, lastName, token, deviceId}
  await storeTokens(data.token, undefined, data.deviceId);

  BrazeService.changeUser(data.id);
  if (data.email) BrazeService.setUserAttributes({ email: data.email, firstName: data.firstName, lastName: data.lastName });

  return {
    id: data.id,
    email: data.email,
    firstName: data.firstName,
    lastName: data.lastName,
  };
}

export async function loginWithEmail(
  email: string,
  password: string,
): Promise<AuthUser> {
  const data = await apiClient("/api/auth/login/email/password", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  await storeTokens(data.token, undefined, data.deviceId);

  // Fetch full user data (including createdAt) from /me endpoint
  const user = await fetchMe();
  BrazeService.changeUser(user.id);
  return user;
}

export async function loginWithApple(idToken: string): Promise<AuthUser> {
  const data = await apiClient("/api/auth/apple", {
    method: "POST",
    body: JSON.stringify({ idToken, platform: "react-native" }),
  });

  // Apple endpoint returns {user, accessToken, refreshToken, platform}
  await storeTokens(data.accessToken, data.refreshToken);

  BrazeService.changeUser(data.user.id);
  if (data.user.email) BrazeService.setUserAttributes({ email: data.user.email, firstName: data.user.name });

  return {
    id: data.user.id,
    email: data.user.email ?? null,
    firstName: data.user.name ?? null,
    lastName: null,
    avatarUrl: data.user.avatarUrl ?? null,
  };
}

export async function loginWithGoogle(idToken: string): Promise<AuthUser> {
  const data = await apiClient("/api/auth/google", {
    method: "POST",
    body: JSON.stringify({ idToken, platform: "react-native" }),
  });

  // Google endpoint returns {user, accessToken, refreshToken, platform}
  await storeTokens(data.accessToken, data.refreshToken);

  BrazeService.changeUser(data.user.id);
  if (data.user.email) BrazeService.setUserAttributes({ email: data.user.email, firstName: data.user.name });

  return {
    id: data.user.id,
    email: data.user.email ?? null,
    firstName: data.user.name ?? null,
    lastName: null,
    avatarUrl: data.user.avatarUrl ?? null,
  };
}

export async function fetchMe(): Promise<AuthUser> {
  const data = await apiClient("/api/auth/me");

  return {
    id: data.user.id,
    email: data.user.email,
    firstName: data.user.firstName,
    lastName: data.user.lastName,
    phoneNumber: data.user.phoneNumber,
    avatarUrl: data.user.avatarUrl,
    timezone: data.user.timezone,
    createdAt: data.user.createdAt,
  };
}

// ── Password reset (forgot password) ──────────────────────────────────────
// A three-step, code-based flow the user runs entirely in-app while logged
// out: (1) request a code by email, (2) verify the code for a short-lived
// reset token, (3) set a new password with that token.

/**
 * Step 1 — email the user a 4-digit verification code. The backend always
 * responds success (even for unknown/non-email accounts) so this never
 * reveals whether an account exists. Throws on the 60s resend cooldown (429).
 */
export async function sendPasswordResetCode(email: string): Promise<void> {
  await apiClient("/api/auth/forgot-password/send-code", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

/**
 * Step 2 — verify the 4-digit code and receive a short-lived reset token.
 * Throws ("Invalid or expired code") on a wrong or timed-out code.
 */
export async function verifyPasswordResetCode(
  email: string,
  code: string,
): Promise<string> {
  const data = await apiClient("/api/auth/forgot-password/verify-code", {
    method: "POST",
    body: JSON.stringify({ email, code }),
  });
  return data.resetToken;
}

/**
 * Step 3 — set the new password using the reset token. This endpoint
 * authenticates with the reset token (not the stored session token — the user
 * is logged out here), so we use a raw fetch to guarantee the reset token is
 * the Authorization header rather than letting apiClient inject a stale
 * session token.
 */
export async function resetPassword(
  resetToken: string,
  newPassword: string,
  confirmPassword: string,
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/auth/forgot-password/reset`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resetToken}`,
    },
    body: JSON.stringify({ newPassword, confirmPassword }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || `Request failed: ${res.status}`);
  }
}

export async function logout(): Promise<void> {
  try {
    await apiClient("/api/auth/logout", { method: "POST" });
  } catch {
    // Best effort — clear tokens regardless
  }
  BrazeService.wipeData();
  await clearTokens();
}

/**
 * Permanently delete the authenticated user's account and all their data
 * (Apple Guideline 5.1.1(v)). Unlike logout, this MUST confirm the server
 * succeeded before we tear down the local session — the caller only wipes
 * local state / signs out when this resolves. If the request fails it throws,
 * and the caller keeps the user signed in so they know deletion did not happen.
 */
export async function deleteAccount(): Promise<void> {
  // Let errors propagate — the caller must not sign out on failure.
  await apiClient("/api/auth/me", { method: "DELETE" });

  // Server delete succeeded — now tear down every local trace of the account.
  BrazeService.wipeData();
  await clearTokens();
}
