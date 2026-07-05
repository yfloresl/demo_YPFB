import { useMemo, useState } from 'react';

export default function DataTable({ columns, data, initialSort = null, rowKey = (r) => r.id }) {
  const [sort, setSort] = useState(initialSort);

  const sorted = useMemo(() => {
    if (!sort) return data;
    const { key, dir } = sort;
    return [...data].sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'string') return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return dir === 'asc' ? av - bv : bv - av;
    });
  }, [data, sort]);

  function toggleSort(key) {
    setSort((s) => {
      if (!s || s.key !== key) return { key, dir: 'desc' };
      return { key, dir: s.dir === 'desc' ? 'asc' : 'desc' };
    });
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[600px]">
        <thead>
          <tr className="border-b border-slate-200">
            {columns.map((c) => (
              <th
                key={c.key}
                onClick={() => c.sortable !== false && toggleSort(c.key)}
                className={`text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap ${
                  c.sortable !== false ? 'cursor-pointer select-none hover:text-slate-700' : ''
                }`}
              >
                {c.label} {sort?.key === c.key ? (sort.dir === 'asc' ? '▲' : '▼') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={rowKey(row)} className="border-b border-slate-100 hover:bg-slate-50">
              {columns.map((c) => (
                <td key={c.key} className="py-2 px-3 whitespace-nowrap">
                  {c.render ? c.render(row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {sorted.length === 0 && <p className="text-center text-slate-400 text-sm py-6">Sin resultados.</p>}
    </div>
  );
}
