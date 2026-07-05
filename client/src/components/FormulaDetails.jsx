export default function FormulaDetails({ titulo = 'Ver metodología', children }) {
  return (
    <details className="text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 open:pb-3">
      <summary className="cursor-pointer font-medium text-slate-600 select-none">{titulo}</summary>
      <div className="mt-2 text-slate-500 space-y-1.5 leading-relaxed">{children}</div>
    </details>
  );
}
