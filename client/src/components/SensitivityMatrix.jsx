function colorTir(tir) {
  if (tir == null) return 'bg-slate-100 text-slate-400';
  if (tir >= 12) return 'bg-green-100 text-green-800';
  if (tir >= 8) return 'bg-amber-100 text-amber-800';
  return 'bg-red-100 text-red-800';
}

export default function SensitivityMatrix({ sensibilidad }) {
  if (!sensibilidad) return null;
  const { deltas_utilizacion_pct, deltas_tarifa_pct, tir_pct } = sensibilidad;
  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-collapse w-full min-w-[420px]">
        <thead>
          <tr>
            <th className="p-2 text-slate-400 font-medium">Util. \ Tarifa</th>
            {deltas_tarifa_pct.map((d) => (
              <th key={d} className="p-2 text-slate-500 font-semibold">
                {d > 0 ? `+${d}%` : `${d}%`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {deltas_utilizacion_pct.map((dUtil, i) => (
            <tr key={dUtil}>
              <td className="p-2 font-semibold text-slate-500">{dUtil > 0 ? `+${dUtil}%` : `${dUtil}%`}</td>
              {tir_pct[i].map((v, j) => (
                <td key={j} className={`p-2 text-center font-semibold rounded ${colorTir(v)}`}>
                  {v != null ? `${v}%` : '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[11px] text-slate-400 mt-2">Celdas: TIR (%) — verde ≥12%, amarillo 8-12%, rojo &lt;8%.</p>
    </div>
  );
}
