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
  _retried?: boolean; // internal: marks a request already retried after refresh
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

  if (!payload) {
    throw new ApiRequestError(res.status, "INVALID_RESPONSE", "The server returned an unexpected response.");
  }
  if (!payload.ok) {
    throw new ApiRequestError(
      res.status,
      payload.error.code,
      payload.error.message,
      payload.error.fields,
    );
  }
  return payload.data;
}

/** Request with one automatic refresh-and-retry on session expiry. */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  try {
    return await rawRequest<T>(path, options);
  } catch (err) {
    const isAuthError = err instanceof ApiRequestError && err.status === 401;
    const alreadyRetrying = (options as { _retried?: boolean })._retried;
    if (isAuthError && !alreadyRetrying) {
      try {
        await rawRequest("/auth/refresh", { method: "POST" });
        return await rawRequest<T>(path, { ...options, _retried: true });
      } catch {
        // The session is truly over (no valid refresh cookie). Never leave the
        // user stuck on a silently broken page — send them to sign-in, with a
        // return path so they land back where they were. Auth pages are
        // excluded: a 401 there (e.g. a wrong password) is a normal outcome.
        if (typeof window !== "undefined") {
          const path = window.location.pathname;
          const onAuthPage = path.startsWith("/login") || path.startsWith("/register");
          if (!onAuthPage) {
            const next = encodeURIComponent(path + window.location.search);
            window.location.assign(`/login?next=${next}`);
          }
        }
      }
    }
    throw err;
  }
}

/** Multipart upload (property photos). Same CSRF handling as JSON calls. */
export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const headers: Record<string, string> = {};
  const csrf = readCookie("ev_csrf");
  if (csrf) headers["X-CSRF-Token"] = csrf;

  const res = await fetch(buildUrl(path), {
    method: "POST",
    headers,
    credentials: "include",
    body: formData,
  });
  const payload = (await res.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!payload) throw new ApiRequestError(res.status, "INVALID_RESPONSE", "The server returned an unexpected response.");
  if (!payload.ok) {
    throw new ApiRequestError(res.status, payload.error.code, payload.error.message, payload.error.fields);
  }
  return payload.data;
}
