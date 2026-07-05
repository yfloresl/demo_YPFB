const BASE = '/api';

async function req(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(body.error || `Error ${res.status}`);
  }
  return res.json();
}

export const api = {
  resumenRed: () => req('/red/resumen'),
  ductos: () => req('/ductos'),
  ducto: (id) => req(`/ductos/${id}`),
  ductoSeries: (id, metrica, escenario) => req(`/ductos/${id}/series?metrica=${metrica}&escenario=${escenario}`),
  estaciones: () => req('/estaciones'),
  estacion: (id) => req(`/estaciones/${id}`),
  pozos: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return req(`/pozos${qs ? `?${qs}` : ''}`);
  },
  pozo: (id) => req(`/pozos/${id}`),
  corredores: () => req('/corredores'),
  proyectos: () => req('/proyectos'),
  proyecto: (id) => req(`/proyectos/${id}`),
  simularGas: (body) => req('/simulador/gas', { method: 'POST', body: JSON.stringify(body) }),
  simularLiquidos: (body) => req('/simulador/liquidos', { method: 'POST', body: JSON.stringify(body) }),
  simularFinanciero: (body) => req('/simulador/financiero', { method: 'POST', body: JSON.stringify(body) }),
  simularNuevoDucto: (body) => req('/simulador/nuevo-ducto', { method: 'POST', body: JSON.stringify(body) }),
  simularStandby: (body) => req('/simulador/estacion-standby', { method: 'POST', body: JSON.stringify(body) }),
};
