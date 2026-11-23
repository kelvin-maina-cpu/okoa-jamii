"use client";

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export function AdminLoginForm() {
  const router = useRouter();
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!emailOrPhone.trim() || !password) {
      setError('Email/phone and password are required.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/session/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailOrPhone: emailOrPhone.trim(), password }),
      });

      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(data.error || 'Unable to login');
        return;
      }

      router.replace('/admin');
      router.refresh();
    } catch {
      setError('Network error while logging in.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <label className="mb-1 block text-sm font-semibold text-slate-800">Email or phone</label>
        <input
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-teal-700 focus:outline-none"
          value={emailOrPhone}
          onChange={(event) => setEmailOrPhone(event.target.value)}
          autoComplete="username"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-semibold text-slate-800">Password</label>
        <div className="flex gap-2">
          <input
            type={showPassword ? 'text' : 'password'}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-teal-700 focus:outline-none"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700"
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>

      {error ? <p className="text-sm font-medium text-rose-700">{error}</p> : null}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-teal-800 px-4 py-2 font-semibold text-white transition hover:bg-teal-900 disabled:opacity-70"
      >
        {loading ? 'Signing in...' : 'Sign In'}
      </button>

      <p className="text-xs text-slate-500">
        Forgot password is not yet available in this prototype. Use approved admin support channels.
      </p>
    </form>
  );
}
