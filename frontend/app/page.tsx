'use client';

import { Dashboard } from '@/components/Dashboard';
import { LoginForm } from '@/components/LoginForm';
import { useSession } from '@/lib/useSession';

export default function HomePage() {
  const session = useSession();

  if (session.checking) {
    return <main className="grid min-h-screen place-items-center bg-[#f3f5f1] text-sm text-[#65726a]">Checking your session…</main>;
  }
  if (!session.user) return <LoginForm onLogin={session.login} message={session.message} />;
  return <Dashboard user={session.user} onLogout={session.logout} onUnauthorized={session.expire} />;
}
