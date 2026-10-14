export const AUTH_COOKIE_NAME = 'acme_session';
export const AUTH_COOKIE_MAX_AGE_MS = 15 * 60 * 1000;
export const AUTH_JWT_ISSUER = 'acme-salary-management';
export const AUTH_JWT_AUDIENCE = 'acme-salary-management';

const AUTH_COOKIE_BASE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/api',
};

export function requireJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new Error('JWT_SECRET must be configured with at least 32 bytes.');
  }
  return secret;
}

export function authCookieOptions() {
  return {
    ...AUTH_COOKIE_BASE_OPTIONS,
    maxAge: AUTH_COOKIE_MAX_AGE_MS,
  };
}

export function authCookieClearOptions() {
  return AUTH_COOKIE_BASE_OPTIONS;
}
