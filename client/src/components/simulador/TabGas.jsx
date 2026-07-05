import { useState } from 'react';
import { api } from '../../lib/api.js';
import { numero } from '../../lib/format.js';
import FormulaDetails from '../FormulaDetails.jsx';

export default function TabGas() {
  const [form, setForm] = useState({ diametro_pulg: 20, longitud_km: 300, p1_psia: 1200, p2_psia: 600, eficiencia: 0.92 });
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState(null);

  async function calcular(e) {
    e.preventDefault();
    setError(null);
    try {
      const r = await api.simularGas(form);
      setResultado(r);
    } catch (err) {
      setError(err.message);
    }
  }

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: Number(v) }));
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="card space-y-4">
        <h3 className="font-semibold text-slate-800 text-sm">Capacidad de gasoducto — Weymouth simplificado</h3>
        <form onSubmit={calcular} className="space-y-3">
          <Campo label="Diámetro nominal (pulg)" value={form.diametro_pulg} onChange={(v) => set('diametro_pulg', v)} />
          <Campo label="Longitud (km)" value={form.longitud_km} onChange={(v) => set('longitud_km', v)} />
          <div className="grid grid-cols-2 gap-3">
            <Campo label="P1 (psia)" value={form.p1_psia} onChange={(v) => set('p1_psia', v)} />
            <Campo label="P2 (psia)" value={form.p2_psia} onChange={(v) => set('p2_psia', v)} />
          </div>
          <Campo label="Eficiencia (0-1)" value={form.eficiencia} onChange={(v) => set('eficiencia', v)} step="0.01" />
          <button className="w-full bg-acento text-white text-sm font-semibold py-2 rounded-lg hover:opacity-90">Calcular</button>
        </form>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <FormulaDetails>
          <p>Q = 433.5 × (Tb/Pb) × d^(8/3) × √((P1² − P2²) / (G × Tf × L × Z)) × E</p>
          <p>Tb=520°R, Pb=14.7 psia, G=0.65, Tf=530°R, Z=0.88. d = diámetro nominal − 0.5". L en millas (km×0.621371).</p>
        </FormulaDetails>
      </div>
      <div className="card flex flex-col gap-3">
        <h3 className="font-semibold text-slate-800 text-sm">Resultado</h3>
        {resultado ? (
          <div className="space-y-2">
            <Resultado label="Capacidad" value={`${numero(resultado.mmpcd)} MMpcd`} />
            <Resultado label="Equivalente" value={`${numero(resultado.mmm3d)} MMm³/d`} />
            <p className="text-xs text-slate-400 pt-2">Supuestos usados: P1={resultado.supuestos.P1} psia, P2={resultado.supuestos.P2} psia, d_interno={numero(resultado.supuestos.diametro_interno_pulg)}", L={numero(resultado.supuestos.longitud_millas)} mi.</p>
          </div>
        ) : (
          <p className="text-slate-400 text-sm">Ingresa los parámetros y presiona Calcular.</p>
        )}
      </div>
    </div>
  );
}

export function Campo({ label, value, onChange, step = '1' }) {
  return (
    <label className="block text-xs font-medium text-slate-500">
      {label}
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-acento/40"
      />
    </label>
  );
}

export function Resultado({ label, value }) {
  return (
    <div className="flex justify-between items-baseline bg-slate-50 rounded-lg px-3 py-2">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="font-bold text-slate-800">{value}</span>
    </div>
  );
}
