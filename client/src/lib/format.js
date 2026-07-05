const nf = new Intl.NumberFormat('es-BO', { maximumFractionDigits: 1 });
const nfEntero = new Intl.NumberFormat('es-BO', { maximumFractionDigits: 0 });
const nfMoneda = new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'USD', maximumFractionDigits: 1 });

export function numero(v) {
  if (v == null || Number.isNaN(v)) return '—';
  return nf.format(v);
}
export function entero(v) {
  if (v == null || Number.isNaN(v)) return '—';
  return nfEntero.format(v);
}
export function moneda(v) {
  if (v == null || Number.isNaN(v)) return '—';
  return nfMoneda.format(v);
}
export function porcentaje(v, decimales = 1) {
  if (v == null || Number.isNaN(v)) return '—';
  return `${v.toLocaleString('es-BO', { maximumFractionDigits: decimales })}%`;
}

export const COLOR_TIPO = {
  gasoducto: '#dc2626',
  oleoducto: '#16a34a',
  poliducto: '#2563eb',
  propuesta: '#d97706',
};

export const TIPO_LABEL = {
  gasoducto: 'Gasoducto',
  oleoducto: 'Oleoducto',
  poliducto: 'Poliducto',
};
