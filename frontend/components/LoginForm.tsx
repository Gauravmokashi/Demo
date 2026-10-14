'use client';

import { FormEvent, useState } from 'react';

export function LoginForm({ onLogin, message }: { onLogin: (email: string, password: string) => Promise<void>; message: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const shownError = error || message;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setLoading(true);
    setError('');
    try {
      await onLogin(String(form.get('email')), String(form.get('password')));
      formElement.reset();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Sign-in failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#f3f5f1] px-5 py-10 text-[#182520]">
      <section className="w-full max-w-md border-y border-[#cfd8cf] bg-white px-7 py-9 sm:px-9">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase text-[#52745e]"><span className="h-2 w-2 rounded-full bg-[#548c67]" /> ACME People Operations</div>
        <h1 className="text-3xl font-semibold">HR manager sign in</h1>
        <p className="mt-2 text-sm text-[#65726a]">Sign in to access salary and employee records.</p>
        {shownError && <div className="mt-5 border-l-4 border-[#b45140] bg-[#f7e7e3] px-3 py-2 text-sm text-[#763b31]" role="alert">{shownError}</div>}
        <form className="mt-6 space-y-4" onSubmit={submit}>
          <label className="block text-sm font-medium">Work email
            <input className="filter-control mt-1 w-full px-3" name="email" type="email" autoComplete="username" maxLength={320} required />
          </label>
          <label className="block text-sm font-medium">Password
            <input className="filter-control mt-1 w-full px-3" name="password" type="password" autoComplete="current-password" minLength={12} maxLength={72} required />
          </label>
          <button className="primary-button w-full" type="submit" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button>
        </form>
      </section>
    </main>
  );
}
