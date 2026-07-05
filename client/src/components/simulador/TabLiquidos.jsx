import { useState } from 'react';
import { api } from '../../lib/api.js';
import { numero } from '../../lib/format.js';
import FormulaDetails from '../FormulaDetails.jsx';
import { Campo, Resultado } from './TabGas.jsx';

const PRODUCTOS = ['crudo', 'reconstituido', 'refinados', 'glp', 'gasolina', 'diesel_oil', 'jet_fuel'];

export default function TabLiquidos() {
  const [form, setForm] = useState({ diametro_pulg: 10, dp_psi_milla: 25, producto: 'crudo' });
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState(null);

  async function calcular(e) {
    e.preventDefault();
    setError(null);
    try {
      setResultado(await api.simularLiquidos(form));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="card space-y-4">
        <h3 className="font-semibold text-slate-800 text-sm">Capacidad de líquidos — Hazen-Williams</h3>
        <form onSubmit={calcular} className="space-y-3">
          <Campo label="Diámetro nominal (pulg)" value={form.diametro_pulg} onChange={(v) => setForm((f) => ({ ...f, diametro_pulg: Number(v) }))} />
          <Campo label="ΔP (psi/milla)" value={form.dp_psi_milla} onChange={(v) => setForm((f) => ({ ...f, dp_psi_milla: Number(v) }))} />
          <label className="block text-xs font-medium text-slate-500">
            Producto
            <select
              value={form.producto}
              onChange={(e) => setForm((f) => ({ ...f, producto: e.target.value }))}
              className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            >
              {PRODUCTOS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <button className="w-full bg-acento text-white text-sm font-semibold py-2 rounded-lg hover:opacity-90">Calcular</button>
        </form>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <FormulaDetails>
          <p>Q_bpd = 0.148 × C × d^2.63 × (ΔP psi/milla)^0.54 × f_visc(producto)</p>
          <p>C=120 (agua equivalente). f_visc: crudo 0.85, reconstituido 0.75, refinados 0.95, GLP 1.0.</p>
        </FormulaDetails>
      </div>
      <div className="card flex flex-col gap-3">
        <h3 className="font-semibold text-slate-800 text-sm">Resultado</h3>
        {resultado ? (
          <Resultado label="Capacidad" value={`${numero(resultado.bpd)} BPD`} />
        ) : (
          <p className="text-slate-400 text-sm">Ingresa los parámetros y presiona Calcular.</p>
        )}
      </div>
    </div>
  );
}
