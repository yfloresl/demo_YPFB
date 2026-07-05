export default function KpiCard({ label, value, sub, icon: Icon, accent = 'text-acento' }) {
  return (
    <div className="card flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</span>
        {Icon && <Icon size={18} className={accent} />}
      </div>
      <span className="text-2xl font-bold text-slate-800">{value}</span>
      {sub && <span className="text-xs text-slate-400">{sub}</span>}
    </div>
  );
}
