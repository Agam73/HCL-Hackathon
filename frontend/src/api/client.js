/**
 * The one place the frontend talks to the backend.
 *
 * - Unwraps the API's { success, data, meta } envelope and throws ApiError on failure.
 * - Sends the signed-in user's token, and when it has expired (401) swaps the
 *   refresh token for a new one and retries once.
 * - Keeps a separate, memory-only session for the admin portal, which signs in
 *   by device (no login screen) and must never overwrite a shopper's session.
 *
 * Session storage keys are the ones the login pages already use:
 *   auth_token, auth_refresh_token, auth_user
 */
export const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api/v1').replace(/\/$/, '');

export class ApiError extends Error {
  constructor({ status, code, message, details }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// ---------------------------------------------------------------- session
export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('auth_user')) ?? null;
  } catch {
    return null;
  }
}

/** True only for a session the backend issued (the old mock tokens do not count). */
export function isSignedIn() {
  const token = localStorage.getItem('auth_token');
  return Boolean(token) && !token.startsWith('mock-jwt-token') && Boolean(getStoredUser());
}

/** Save what POST /auth/login, /auth/register or /auth/refresh returned. */
export function saveSession({ user, token, refreshToken }) {
  localStorage.setItem('auth_token', token);
  if (refreshToken) localStorage.setItem('auth_refresh_token', refreshToken);
  if (user) localStorage.setItem('auth_user', JSON.stringify(user));
  window.dispatchEvent(new Event('auth-state-changed'));
}

export function saveUser(user) {
  localStorage.setItem('auth_user', JSON.stringify(user));
  window.dispatchEvent(new Event('auth-state-changed'));
}

export function clearSession() {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('auth_refresh_token');
  localStorage.removeItem('auth_user');
  window.dispatchEvent(new Event('auth-state-changed'));
}

// ---------------------------------------------------------------- transport
function toQueryString(params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '' || value === false) continue;
    search.set(key, Array.isArray(value) ? value.join(',') : String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

async function send(path, { method = 'GET', body, params, signal, headers = {} }, token) {
  let response;
  try {
    response = await fetch(`${API_URL}${path}${toQueryString(params)}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError({
      status: 0,
      code: 'NETWORK_ERROR',
      message: 'Cannot reach the server. Is the backend running on port 8080?',
    });
  }
  const json = response.status === 204 ? null : await response.json().catch(() => null);
  return { response, json };
}

function toError(response, json) {
  return new ApiError({
    status: response.status,
    code: json?.error?.code ?? 'HTTP_ERROR',
    message: json?.error?.message ?? `Request failed (${response.status})`,
    details: json?.error?.details,
  });
}

/**
 * @param session { getToken, refresh } - refresh() returns true when a new token was obtained
 */
function createApi(session) {
  async function request(path, options = {}) {
    const useAuth = options.auth !== false;
    let { response, json } = await send(path, options, useAuth ? session.getToken() : null);

    if (response.status === 401 && useAuth && (await session.refresh())) {
      ({ response, json } = await send(path, options, session.getToken()));
    }
    if (!response.ok) throw toError(response, json);
    return json ?? { data: null };
  }

  return {
    request,
    get: async (path, params, options) => (await request(path, { ...options, params })).data,
    /** For paged endpoints: { items, meta }. */
    getPage: async (path, params, options) => {
      const { data, meta } = await request(path, { ...options, params });
      return { items: data, meta };
    },
    post: async (path, body, options) =>
      (await request(path, { ...options, method: 'POST', body })).data,
    patch: async (path, body, options) =>
      (await request(path, { ...options, method: 'PATCH', body })).data,
    delete: async (path, options) => (await request(path, { ...options, method: 'DELETE' })).data,
  };
}

// ---------------------------------------------------------------- signed-in user
// Refresh tokens are single-use, so parallel 401s must share one refresh call.
let userRefresh = null;

function refreshUserSession() {
  const refreshToken = localStorage.getItem('auth_refresh_token');
  if (!refreshToken) return Promise.resolve(false);
  userRefresh ??= send('/auth/refresh', { method: 'POST', body: { refreshToken } }, null)
    .then(({ response, json }) => {
      if (!response.ok || !json?.data?.token) {
        clearSession(); // the session is over: the route guards send the user to /login
        return false;
      }
      saveSession(json.data);
      return true;
    })
    .catch(() => false)
    .finally(() => {
      userRefresh = null;
    });
  return userRefresh;
}

export const api = createApi({
  getToken: () => localStorage.getItem('auth_token'),
  refresh: refreshUserSession,
});

export async function login(email, password) {
  const data = await api.post('/auth/login', { email, password }, { auth: false });
  saveSession(data);
  return data.user;
}

export async function register(details) {
  const data = await api.post('/auth/register', details, { auth: false });
  saveSession(data);
  return data.user;
}

export async function logout() {
  const refreshToken = localStorage.getItem('auth_refresh_token');
  clearSession();
  if (refreshToken) {
    // Best effort: the local session is already gone either way.
    await api.post('/auth/logout', { refreshToken }, { auth: false }).catch(() => {});
  }
}

// ---------------------------------------------------------------- admin portal
// Admin PCs are physically locked, so the portal has no login: the backend
// hands an ADMIN session to requests from an authorised machine and refuses
// everyone else. Held in memory only; every page load asks again.
let adminSession = null; // { token, refreshToken, user }
let adminStart = null;

export function startAdminSession() {
  adminStart ??= (async () => {
    const user = getStoredUser();
    // An ADMIN who signed in with a password can use that session directly.
    if (isSignedIn() && user?.role === 'ADMIN') {
      adminSession = { token: localStorage.getItem('auth_token'), refreshToken: localStorage.getItem('auth_refresh_token'), user };
      return user;
    }
    // Sending a non-admin's token makes the backend refuse, even on an admin PC.
    const { response, json } = await send(
      '/auth/admin-device',
      { method: 'POST' },
      isSignedIn() ? localStorage.getItem('auth_token') : null
    );
    if (!response.ok) throw toError(response, json);
    adminSession = json.data;
    return adminSession.user;
  })().catch((err) => {
    adminStart = null;
    throw err;
  });
  return adminStart;
}

export const adminApi = createApi({
  getToken: () => adminSession?.token ?? null,
  refresh: async () => {
    adminStart = null;
    try {
      await startAdminSession();
      return true;
    } catch {
      return false;
    }
  },
});
