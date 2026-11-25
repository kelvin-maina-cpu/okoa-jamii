"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AuthUser, Permission } from '@/types/auth';

interface SessionResponse {
  user: AuthUser;
  permissions: Permission[];
}

const items: { label: string; href: string; permission: Permission }[] = [
  { label: 'Incidents', href: '/admin', permission: 'viewIncidents' },
  { label: 'Community Alerts', href: '/admin/alerts', permission: 'publishCommunityAlerts' },
  { label: 'Analytics', href: '/admin/analytics', permission: 'viewAnalytics' },
  { label: 'Audit Log', href: '/admin/audit', permission: 'viewAuditLogs' },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<SessionResponse | null>(null);

  useEffect(() => {
    const loadSession = async () => {
      const response = await fetch('/api/session/me', { cache: 'no-store' });
      if (!response.ok) {
        router.replace('/login?reason=unauthorized');
        return;
      }
      const data = (await response.json()) as SessionResponse;
      setSession(data);
      setLoading(false);
    };

    loadSession().catch(() => {
      router.replace('/login?reason=unauthorized');
    });
  }, [router]);

  const permittedItems = useMemo(() => {
    if (!session) return [];
    return items.filter((item) => session.permissions.includes(item.permission));
  }, [session]);

  const logout = async () => {
    await fetch('/api/session/logout', { method: 'POST' });
    router.replace('/login');
  };

  if (loading || !session) {
    return <main className="grid min-h-screen place-items-center bg-slate-100 text-slate-700">Loading secure session...</main>;
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 p-4 md:grid-cols-[250px_1fr]">
        <aside className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-bold text-teal-900">Okoa Jamii Admin</h2>
          <p className="mt-1 text-sm text-slate-600">{session.user.fullName}</p>
          <p className="text-xs text-slate-500">{session.user.role}</p>

          <nav className="mt-5 space-y-1">
            {permittedItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-lg px-3 py-2 text-sm font-medium ${
                    active ? 'bg-teal-800 text-white' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <button
            onClick={logout}
            className="mt-6 w-full rounded-lg bg-rose-700 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-800"
          >
            Logout
          </button>
        </aside>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">{children}</section>
      </div>
    </div>
  );
}
