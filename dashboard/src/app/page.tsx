import Link from 'next/link';

export default function Home() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 px-4">
      <section className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-4xl font-black text-teal-900">Okoa Jamii Dashboard</h1>
        <p className="mt-4 text-slate-700">
          Administrative access is protected by backend authentication and role-based permissions.
        </p>
        <p className="mt-2 text-sm text-slate-600">
          Citizens cannot access this interface. Use an authorized administrative account to continue.
        </p>
        <div className="mt-6 flex gap-3">
          <Link href="/login" className="rounded-lg bg-teal-800 px-4 py-2 font-semibold text-white hover:bg-teal-900">
            Go to Admin Login
          </Link>
          <Link href="/admin" className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50">
            Open Admin Area
          </Link>
        </div>
      </section>
    </main>
  );
}
