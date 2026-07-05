import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../../lib/api.js';
import { numero, moneda, porcentaje } from '../../lib/format.js';
import FormulaDetails from '../FormulaDetails.jsx';
import SensitivityMatrix from '../SensitivityMatrix.jsx';
import { Campo, Resultado } from './TabGas.jsx';

export default function TabFinanciero() {
  const [form, setForm] = useState({
    capex_usd_mm: 60,
    volumen_valor: 6,
    volumen_unidad: 'MMm3/d',
    utilizacion_pct: 80,
    tarifa: 2.1,
    tasa_pct: 10,
    horizonte: 25,
    opex_pct: 3.5,
  });
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState(null);

  async function calcular(e) {
    e.preventDefault();
    setError(null);
    try {
      const r = await api.simularFinanciero({
        capex_usd_mm: form.capex_usd_mm,
        volumen: { valor: form.volumen_valor, unidad: form.volumen_unidad },
        utilizacion_pct: form.utilizacion_pct,
        tarifa: form.tarifa,
        tasa_pct: form.tasa_pct,
        horizonte: form.horizonte,
        opex_pct: form.opex_pct,
      });
      setResultado(r);
    } catch (err) {
      setError(err.message);
    }
  }

  const flujoAcumulado = resultado
    ? resultado.flujo.reduce((acc, v, i) => {
        const prev = i > 0 ? acc[i - 1].acumulado : 0;
        acc.push({ anio: i, acumulado: prev + v });
        return acc;
      }, [])
    : [];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <div className="card space-y-4">
        <h3 className="font-semibold text-slate-800 text-sm">Evaluación financiera</h3>
        <form onSubmit={calcular} className="space-y-3">
          <Campo label="CAPEX (US$ MM)" value={form.capex_usd_mm} onChange={(v) => setForm((f) => ({ ...f, capex_usd_mm: Number(v) }))} />
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Volumen de diseño" value={form.volumen_valor} onChange={(v) => setForm((f) => ({ ...f, volumen_valor: Number(v) }))} />
            <label className="block text-xs font-medium text-slate-500">
              Unidad
              <select
                value={form.volumen_unidad}
                onChange={(e) => setForm((f) => ({ ...f, volumen_unidad: e.target.value }))}
                className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="MMpcd">MMpcd</option>
                <option value="MMm3/d">MMm³/d</option>
                <option value="BPD">BPD</option>
              </select>
            </label>
          </div>
          <Campo label="Utilización (%)" value={form.utilizacion_pct} onChange={(v) => setForm((f) => ({ ...f, utilizacion_pct: Number(v) }))} />
          <Campo label="Tarifa (US$/MPC o US$/bbl)" value={form.tarifa} onChange={(v) => setForm((f) => ({ ...f, tarifa: Number(v) }))} step="0.01" />
          <div className="grid grid-cols-3 gap-3">
            <Campo label="Tasa (%)" value={form.tasa_pct} onChange={(v) => setForm((f) => ({ ...f, tasa_pct: Number(v) }))} />
            <Campo label="Horizonte (años)" value={form.horizonte} onChange={(v) => setForm((f) => ({ ...f, horizonte: Number(v) }))} />
            <Campo label="OPEX (% CAPEX)" value={form.opex_pct} onChange={(v) => setForm((f) => ({ ...f, opex_pct: Number(v) }))} step="0.1" />
          </div>
          <button className="w-full bg-acento text-white text-sm font-semibold py-2 rounded-lg hover:opacity-90">Evaluar</button>
        </form>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <FormulaDetails>
          <p>Ingresos = volumen_diseño × utilización × tarifa × factor_conversión_anual.</p>
          <p>VAN con tasa parametrizable; TIR por bisección (−50% a 100%); LCOT = (CAPEX anualizado + OPEX) / volumen anual.</p>
        </FormulaDetails>
      </div>

      <div className="space-y-4">
        {resultado && (
          <>
            <div className="card grid grid-cols-2 gap-3">
              <Resultado label="VAN" value={moneda(resultado.van_mm_usd * 1e6)} />
              <Resultado label="TIR" value={resultado.tir_pct != null ? porcentaje(resultado.tir_pct) : 'No converge'} />
              <Resultado label="Payback simple" value={resultado.payback_anios != null ? `${resultado.payback_anios} años` : '—'} />
              <Resultado label="Payback descontado" value={resultado.payback_descontado_anios != null ? `${resultado.payback_descontado_anios} años` : '—'} />
              <Resultado label="LCOT" value={resultado.lcot_usd != null ? `US$ ${numero(resultado.lcot_usd)}` : '—'} />
            </div>
            <div className="card">
              <h4 className="font-semibold text-slate-800 text-sm mb-2">Flujo acumulado</h4>
              <div style={{ height: 200 }}>
                <ResponsiveContainer>
                  <LineChart data={flujoAcumulado}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="anio" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v) => moneda(v)} />
                    <Line type="monotone" dataKey="acumulado" stroke="#0e7490" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card">
              <h4 className="font-semibold text-slate-800 text-sm mb-2">Matriz de sensibilidad TIR (5×5)</h4>
              <SensitivityMatrix sensibilidad={resultado.sensibilidad} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
