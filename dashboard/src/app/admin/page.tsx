export default function AdminHomePage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-teal-900">Operations Overview</h1>
      <p className="mt-2 text-slate-700">
        Authentication and role-based access are active. Incident operations views become available according to assigned permissions.
      </p>
      <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Demo mode: operational data shown in this prototype must be treated as test data only.
      </div>
    </div>
  );
}
