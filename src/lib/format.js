// Formatting helpers. Everything user-facing is Spanish (Colombia).

const nf1 = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 });

export const num = (n) => nf1.format(Number(n || 0));
export const num2 = (n) => nf2.format(Number(n || 0));
export const signed = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + nf2.format(Math.abs(Number(n || 0)));

export const bultosWord = (n) => (Math.abs(Number(n)) === 1 ? 'bulto' : 'bultos');

export const TYPE_LABEL = { levante: 'Levante', finalizador: 'Finalizador' };
export const TYPE_COLOR = { levante: '#1F7A4D', finalizador: '#D98A00' };

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// 'YYYY-MM-DD' -> Date at noon local time (avoids off-by-one from timezones)
const dayDate = (s) => new Date(s + 'T12:00:00');

export const longDay = (s) => cap(dayDate(s).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }));
export const shortDay = (s) => dayDate(s).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }).replace('.', '');
export const weekdayShort = (s) => dayDate(s).toLocaleDateString('es-CO', { weekday: 'short' }).replace('.', '');
export const dayNumber = (s) => String(Number(s.slice(8, 10)));

// Today's date as the farm sees it (browser clock, local zone) 'YYYY-MM-DD'
export function localToday() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

// The API stores timestamps as UTC 'YYYY-MM-DD HH:MM:SS'
export function parseTs(ts) {
  if (!ts) return null;
  return new Date(String(ts).replace(' ', 'T') + 'Z');
}

export function timeLabel(d) {
  return d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }).replace(/\s?([ap])\.?\s?m\.?/i, ' $1. m.');
}

// "11:52 a. m." today · "Ayer 3:20 p. m." · "17 oct"
export function whenLabel(ts) {
  const d = parseTs(ts);
  if (!d || isNaN(d)) return '';
  const now = new Date();
  const sameDay = (a, b) => a.toDateString() === b.toDateString();
  const yesterday = new Date(now.getTime() - 86400000);
  if (sameDay(d, now)) return timeLabel(d);
  if (sameDay(d, yesterday)) return 'Ayer ' + timeLabel(d);
  return shortDay(d.toISOString().slice(0, 10));
}

// Weights
export const kgLabel = (n) => `${num2(n)} kg`;

// Feed-conversion scale (conversión alimenticia): up to 2.5 good, 2.6–3.0 regular, above 3.0 bad.
export const RATING = {
  buena: { label: 'Buena', icon: '✓', cls: 'bg-[#E3EFE8] text-farm-green' },
  regular: { label: 'Regular', icon: '!', cls: 'bg-[#FFF1D6] text-[#8A5A00]' },
  mala: { label: 'Mala', icon: '✕', cls: 'bg-alert-bg text-alert' },
};
export const RATING_SCALE = 'Buena: hasta 2,5 · Regular: 2,6 a 3,0 · Mala: más de 3,0';
