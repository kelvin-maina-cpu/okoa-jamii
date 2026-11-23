import { AdminLoginForm } from '@/components/auth/AdminLoginForm';

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 px-4">
      <div className="w-full max-w-md">
        <h1 className="mb-2 text-3xl font-extrabold text-teal-900">Okoa Jamii Administration</h1>
        <p className="mb-6 text-sm text-slate-600">
          Access is restricted to Community Leader, Security Officer, County Administrator and Super Administrator roles.
        </p>
        <AdminLoginForm />
      </div>
    </main>
  );
}
