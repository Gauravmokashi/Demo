// Same-origin by default: Next.js rewrites /api to the backend (see next.config.mjs), which keeps the
// SameSite=Strict session cookie working when frontend and API are deployed separately.
export const apiBase = (process.env.NEXT_PUBLIC_API_URL || '/api').replace(/\/$/, '');

export const SESSION_EXPIRED_MESSAGE = 'Your session has expired. Please sign in again.';

export class UnauthorizedError extends Error {
  constructor() {
    super(SESSION_EXPIRED_MESSAGE);
    this.name = 'UnauthorizedError';
  }
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

type RequestOptions = RequestInit & {
  /** Message shown when the API gives no usable error message. */
  fallbackMessage?: string;
  /** Login treats 401 as "wrong credentials", not "session expired". */
  sessionRequired?: boolean;
};

export async function apiRequest(path: string, options: RequestOptions = {}): Promise<Response> {
  const { fallbackMessage = 'Request failed.', sessionRequired = true, ...init } = options;
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    credentials: 'include',
    headers: init.body ? { 'Content-Type': 'application/json', ...init.headers } : init.headers,
  });
  if (response.status === 401 && sessionRequired) throw new UnauthorizedError();
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const message = Array.isArray(body?.message) ? body.message.join(' ') : body?.message;
    throw new ApiError(typeof message === 'string' ? message : fallbackMessage, response.status);
  }
  return response;
}

export async function apiJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await apiRequest(path, options);
  return (await response.json()) as T;
}

export function toQueryString(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && String(value).trim() !== '') query.set(key, String(value).trim());
  }
  return query.toString();
}
