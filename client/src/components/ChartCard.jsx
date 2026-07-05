export default function ChartCard({ title, subtitle, actions, children, className = '' }) {
  return (
    <div className={`card flex flex-col gap-3 ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-slate-800 text-sm">{title}</h3>
          {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
        </div>
        {actions}
      </div>
      <div style={{ height: 220 }} className="w-full">
        {children}
      </div>
    </div>
  );
}
