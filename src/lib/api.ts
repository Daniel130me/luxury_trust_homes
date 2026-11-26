/**
 * API client for the ELVICTORIA Express backend.
 *
 * - All requests carry credentials (HTTP-only session cookies).
 * - Mutating requests attach the CSRF token from the readable cookie.
 * - A 401 triggers one silent refresh attempt, then the request is retried.
 *
 * Sandbox routing (NON-STANDARD, dev-only): the preview gateway exposes one
 * port, so API calls go to the same origin with ?XTransformPort=<backend
 * port> — the gateway forwards them to the Express server. Outside the
 * sandbox, NEXT_PUBLIC_API_BASE_URL points straight at the API origin.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const GATEWAY_PORT = process.env.NEXT_PUBLIC_API_GATEWAY_PORT ?? "";

export type ApiEnvelope<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; fields?: Record<string, string> } };

export class ApiRequestError extends Error {
  code: string;
  status: number;
  fields?: Record<string, string>;

  constructor(status: number, code: string, message: string, fields?: Record<string, string>) {
    super(message);
    this.code = code;
    this.status = status;
    this.fields = fields;
  }
}

function buildUrl(path: string, query?: Record<string, string | number | boolean | undefined>): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const params = new URLSearchParams();
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== "") params.set(key, String(value));
    }
  }
  const search = params.toString();
  let url = `${API_BASE_URL}/api${cleanPath}${search ? `?${search}` : ""}`;
  // Sandbox gateway: route to the backend port next to the frontend.
  if (GATEWAY_PORT) {
    url += `${search ? "&" : "?"}XTransformPort=${GATEWAY_PORT}`;
  }
  return url;
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

const MUTATION_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

type RequestOptions = {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  signal?: AbortSignal;
};

async function rawRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? "GET";
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (MUTATION_METHODS.has(method)) {
    const csrf = readCookie("ev_csrf");
    if (csrf) headers["X-CSRF-Token"] = csrf;
  }

  const res = await fetch(buildUrl(path, options.query), {
    method,
    headers,
    credentials: "include",
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });

  const payload = (await res.json().catch(() => null)) as ApiEnvelope<T> | null;
  return unwrapEnvelope(res.status, payload);
}

/**
 * Single-flight refresh: dashboards fire several requests at once, and when
 * the access token expires they all get a 401 together. Sending one
 * /auth/refresh per request made the backend see the same refresh token
 * presented several times. Every caller now awaits the same in-flight
 * refresh instead.
 */
let refreshInFlight: Promise<unknown> | null = null;

function refreshSession(): Promise<unknown> {
  if (!refreshInFlight) {
    refreshInFlight = rawRequest("/auth/refresh", { method: "POST" }).finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

/** Auth endpoints whose 401 is a normal answer, never a reason to refresh. */
const NO_REFRESH_PATHS = new Set(["/auth/login", "/auth/refresh", "/auth/register"]);

/**
 * Run a request; on a 401 (expired access token) refresh the session once
 * and run it again. Shared by JSON calls and uploads so both recover from
 * an expired session the same way.
 */
async function withSessionRetry<T>(path: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    const isAuthError = err instanceof ApiRequestError && err.status === 401;
    if (!isAuthError || NO_REFRESH_PATHS.has(path)) throw err;

    // The CSRF cookie only exists while a session does, so it tells a
    // signed-in user whose session just died apart from an anonymous
    // visitor (whose 401 is expected and must not bounce them to login).
    const hadSession = readCookie("ev_csrf") !== null;
    try {
      await refreshSession();
    } catch (refreshErr) {
      // Only a genuine auth rejection means the session is truly over.
      // A refresh that failed because the backend/DB is unavailable (5xx)
      // must NOT trigger the bounce: the user keeps their (still valid)
      // cookies and the original 401 surfaces as a retryable error —
      // otherwise every transient outage becomes a redirect loop.
      const sessionDead =
        refreshErr instanceof ApiRequestError &&
        (refreshErr.status === 401 || refreshErr.status === 403);
      if (sessionDead && hadSession) redirectToSignIn();
      throw err;
    }
    // Refresh worked: retry once. Errors from the retried request are the
    // request's own outcome (e.g. a 400 validation error) and propagate
    // unchanged — they say nothing about the session.
    return run();
  }
}

/** Request with one automatic refresh-and-retry on session expiry. */
export function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return withSessionRetry(path, () => rawRequest<T>(path, options));
}

/**
 * Send the user to sign-in with a return path so they land back where they
 * were. Auth pages are excluded: a 401 there is a normal outcome.
 */
function redirectToSignIn(): void {
  if (typeof window === "undefined") return;
  const current = window.location.pathname;
  const onAuthPage = current.startsWith("/login") || current.startsWith("/register");
  if (onAuthPage) return;
  const next = encodeURIComponent(current + window.location.search);
  window.location.assign(`/login?next=${next}`);
}

/** Turn an API envelope (or its absence) into data or an ApiRequestError. */
function unwrapEnvelope<T>(status: number, payload: ApiEnvelope<T> | null): T {
  if (!payload) {
    throw new ApiRequestError(status, "INVALID_RESPONSE", "The server returned an unexpected response.");
  }
  if (!payload.ok) {
    throw new ApiRequestError(status, payload.error.code, payload.error.message, payload.error.fields);
  }
  return payload.data;
}

export type UploadOptions = {
  /** Called with the fraction of the request body sent so far (0..1). */
  onProgress?: (fraction: number) => void;
};

/**
 * NON-STANDARD: uploads use XMLHttpRequest instead of fetch — fetch still
 * has no upload-progress events in browsers, and listing media (videos up
 * to the admin limit) needs a visible progress bar. Standard alternative:
 * fetch with a streaming request body, which browsers do not yet support
 * for progress reporting.
 */
function rawUpload<T>(path: string, formData: FormData, options: UploadOptions): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", buildUrl(path));
    xhr.withCredentials = true;
    const csrf = readCookie("ev_csrf");
    if (csrf) xhr.setRequestHeader("X-CSRF-Token", csrf);

    if (options.onProgress) {
      const report = options.onProgress;
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) report(event.loaded / event.total);
      };
    }
    xhr.onload = () => {
      let payload: ApiEnvelope<T> | null = null;
      try {
        payload = JSON.parse(xhr.responseText) as ApiEnvelope<T>;
      } catch {
        payload = null;
      }
      try {
        resolve(unwrapEnvelope(xhr.status, payload));
      } catch (err) {
        reject(err);
      }
    };
    xhr.onerror = () =>
      reject(new ApiRequestError(0, "NETWORK", "The upload was interrupted. Check your connection and try again."));
    xhr.send(formData);
  });
}

/**
 * Multipart upload (listing photos and video). Same CSRF handling and
 * session refresh as JSON calls, plus optional progress reporting.
 */
export function apiUpload<T>(path: string, formData: FormData, options: UploadOptions = {}): Promise<T> {
  return withSessionRetry(path, () => rawUpload<T>(path, formData, options));
}
