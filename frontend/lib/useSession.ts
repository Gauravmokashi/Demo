'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiJson, SESSION_EXPIRED_MESSAGE, UnauthorizedError } from './api';
import { AuthUser } from './types';

// Refresh shortly before the 15-minute token expires, but only if the user was recently active,
// so an unattended screen still signs itself out.
const REFRESH_LEAD_MS = 60 * 1000;
const IDLE_LIMIT_MS = 10 * 60 * 1000;

function isUsable(user: AuthUser | undefined): user is AuthUser {
  const expiresAt = Date.parse(user?.expiresAt ?? '');
  return Boolean(user) && Number.isFinite(expiresAt) && expiresAt > Date.now();
}

export function useSession() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [message, setMessage] = useState('');
  const lastActivity = useRef(0);

  const expire = useCallback((reason = SESSION_EXPIRED_MESSAGE) => {
    setUser(null);
    setMessage(reason);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    apiJson<{ user: AuthUser }>('/auth/me', { signal: controller.signal, fallbackMessage: 'Could not verify your sign-in.' })
      .then((result) => {
        if (isUsable(result.user)) setUser(result.user);
        else expire();
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted || reason instanceof UnauthorizedError) return;
        setMessage(reason instanceof Error ? reason.message : 'Could not verify your sign-in.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setChecking(false);
      });
    return () => controller.abort();
  }, [expire]);

  useEffect(() => {
    if (!user) return;
    const markActive = () => {
      lastActivity.current = Date.now();
    };
    markActive();
    window.addEventListener('pointerdown', markActive);
    window.addEventListener('keydown', markActive);
    return () => {
      window.removeEventListener('pointerdown', markActive);
      window.removeEventListener('keydown', markActive);
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const expiresAt = Date.parse(user.expiresAt);
    let expiryTimer: number | undefined;
    const refreshTimer = window.setTimeout(async () => {
      if (Date.now() - lastActivity.current < IDLE_LIMIT_MS) {
        try {
          const result = await apiJson<{ user: AuthUser }>('/auth/refresh', { method: 'POST' });
          if (isUsable(result.user)) {
            setUser(result.user);
            return;
          }
        } catch (reason) {
          if (reason instanceof UnauthorizedError) {
            expire();
            return;
          }
        }
      }
      expiryTimer = window.setTimeout(() => expire(), Math.max(0, expiresAt - Date.now()));
    }, Math.max(0, expiresAt - Date.now() - REFRESH_LEAD_MS));

    return () => {
      window.clearTimeout(refreshTimer);
      window.clearTimeout(expiryTimer);
    };
  }, [user, expire]);

  const login = useCallback(async (email: string, password: string) => {
    setMessage('');
    const result = await apiJson<{ user: AuthUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      sessionRequired: false,
      fallbackMessage: 'Sign-in failed.',
    });
    if (!isUsable(result.user)) throw new Error('Sign-in response did not contain a valid session.');
    setUser(result.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiJson('/auth/logout', { method: 'POST', sessionRequired: false });
    } catch {
      // The local session is cleared regardless; the cookie expires on its own.
    } finally {
      setUser(null);
      setMessage('');
    }
  }, []);

  return { user, checking, message, login, logout, expire };
}
