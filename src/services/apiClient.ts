import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

export const API_BASE_URL: string =
  Constants.expoConfig?.extra?.apiBaseUrl ||
  (__DEV__ ? "http://192.168.1.217:3003" : "http://localhost:3003");

const TOKEN_KEYS = {
  access: "@reset_access_token",
  refresh: "@reset_refresh_token",
  deviceId: "@reset_device_id",
};

export class AuthExpiredError extends Error {
  constructor() {
    super("Session expired");
    this.name = "AuthExpiredError";
  }
}

// Token storage helpers
export async function storeTokens(
  accessToken: string,
  refreshToken?: string,
  deviceId?: string,
) {
  const pairs: [string, string][] = [[TOKEN_KEYS.access, accessToken]];
  if (refreshToken) pairs.push([TOKEN_KEYS.refresh, refreshToken]);
  if (deviceId) pairs.push([TOKEN_KEYS.deviceId, deviceId]);
  await AsyncStorage.multiSet(pairs);
}

export async function getTokens() {
  const [[, access], [, refresh], [, deviceId]] =
    await AsyncStorage.multiGet([TOKEN_KEYS.access, TOKEN_KEYS.refresh, TOKEN_KEYS.deviceId]);
  return {
    accessToken: access ?? null,
    refreshToken: refresh ?? null,
    deviceId: deviceId ?? null,
  };
}

export async function clearTokens() {
  await AsyncStorage.multiRemove([TOKEN_KEYS.access, TOKEN_KEYS.refresh, TOKEN_KEYS.deviceId]);
}

// Mutex for token refresh
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const { accessToken } = await getTokens();
  if (!accessToken) throw new AuthExpiredError();

  const res = await fetch(`${API_BASE_URL}/api/token/refresh`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    // Only clear tokens on 401 (truly invalid token).
    // Other errors (network, 5xx) shouldn't wipe the session.
    if (res.status === 401) {
      await clearTokens();
    }
    throw new AuthExpiredError();
  }

  const data = await res.json();
  await storeTokens(data.accessToken, data.refreshToken);
  return data.accessToken;
}

// Main API client
export async function apiClient<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const { accessToken, deviceId } = await getTokens();


  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  // Only set Content-Type for requests with a body — Fastify rejects
  // Content-Type: application/json with an empty body.
  if (options.body) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }

  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }
  if (deviceId) {
    headers["reset_user_device_id_v1"] = deviceId;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401 && accessToken) {

    // Try to refresh the token
    try {
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken();
      }
      const newToken = await refreshPromise;

      refreshPromise = null;

      // Retry original request with new token
      headers["Authorization"] = `Bearer ${newToken}`;
      const retryRes = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers,
      });

      if (!retryRes.ok) {
        const error = await retryRes.json().catch(() => ({}));
        throw new Error(error.message || `Request failed: ${retryRes.status}`);
      }
      return retryRes.json();
    } catch (err) {
      refreshPromise = null;
      if (err instanceof AuthExpiredError) throw err;
      throw err;
    }
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || `Request failed: ${res.status}`);
  }

  return res.json();
}
