export const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const moneyFormat = new Intl.NumberFormat('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const money = (n) => `$${moneyFormat.format(n ?? 0)}`;
export const pct = (n) => `${Math.round((n ?? 0) * 1000) / 10}%`;
export const monthLabel = (m) => `${MONTHS[m.month - 1]} ${m.year}`;
export const shortMonth = (m) => MONTHS[m.month - 1].slice(0, 3);

// Acepta "1.234,56", "1234.56" o "1234,5".
export function parseMoney(text) {
  const clean = String(text).trim().replace(/\s/g, '');
  if (!clean) return null;
  const normalized = clean.includes(',') ? clean.replace(/\./g, '').replace(',', '.') : clean;
  const n = Number(normalized);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

export function currentYearMonth() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export function shiftMonth({ year, month }, delta) {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}
