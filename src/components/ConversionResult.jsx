import { RATING, RATING_SCALE, num, num2, fix2 } from '../lib/format.js';

// The answer shown right after an exit is saved.
export default function ConversionResult({ c, corralName, onClose }) {
  if (!c) return null;
  const r = c.rating ? RATING[c.rating] : null;
  const animals = `${c.animals} ${c.animals === 1 ? 'animal' : 'animales'}`;
  let headline;
  let detail;
  if (c.fcr != null) {
    headline = fix2(c.fcr);
    detail = (
      <>
        {animals} de {corralName} comieron <b>{num(c.feedKg)} kg</b> de alimento y ganaron <b>{num(c.gainKg)} kg</b>
        {c.initialKg != null && <> (de {num(c.initialKg)} a {num(c.finalKg)} kg)</>}
        {c.days > 0 && <> en {c.days} {c.days === 1 ? 'día' : 'días'}</>}.
      </>
    );
  } else if (c.reason === 'sin_ganancia') {
    headline = '—';
    detail = <>{animals} no ganaron peso: salieron con {num(c.finalKg)} kg y entraron con {num(c.initialKg)} kg. Revisa los pesos.</>;
  } else if (c.reason === 'sin_consumo') {
    headline = '—';
    detail = <>No hay alimento registrado para estos animales, así que no se puede calcular la conversión.</>;
  } else {
    headline = '—';
    detail = <>Falta el peso de entrada de algunos animales de este corral, así que no se puede calcular la conversión.</>;
  }

  return (
    <div className={`rounded-2xl p-4 ${r ? r.cls : 'bg-field text-ink'}`} role="status">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold">Conversión alimenticia de esta salida</p>
        {onClose && (
          <button type="button" onClick={onClose} className="-mt-1 -mr-1 h-10 w-10 rounded-lg text-xl leading-none hover:bg-black/5" aria-label="Cerrar">
            ×
          </button>
        )}
      </div>
      <div className="flex items-baseline gap-3 mt-1">
        <span className="font-display font-bold text-[40px] leading-none">{headline}</span>
        {r && (
          <span className="text-lg font-semibold">
            <span aria-hidden>{r.icon} </span>
            {r.label}
          </span>
        )}
      </div>
      <p className="text-sm mt-2 text-ink">{detail}</p>
      {c.initialKg != null && (
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-3 text-sm">
          <Metric label="Alimento consumido" value={`${num(c.feedKg)} kg`} hint="Bultos de Consumo × kg por bulto" />
          <Metric label="Peso de entrada" value={`${num(c.initialKg)} kg`} hint={`${animals} al entrar`} />
          <Metric label="Peso registrado en la salida" value={`${num(c.finalKg)} kg`} hint={`${animals} al salir`} />
          <Metric label="Peso ganado" value={`${num(c.gainKg)} kg`} hint="Salida − entrada" />
          <Metric label="Conversión" value={c.fcr != null ? fix2(c.fcr) : '—'} hint="Alimento ÷ peso ganado" />
          {c.dailyGainKg != null && <Metric label="Ganancia diaria" value={`${num2(c.dailyGainKg)} kg`} hint="Por animal por día" />}
        </dl>
      )}
      {c.fcr != null && c.fcr < 2 && <p className="text-sm mt-1 text-ink">Es una conversión muy baja: verifica que los pesos estén bien.</p>}
      <p className="text-xs mt-3 text-ink-soft">{RATING_SCALE}</p>
    </div>
  );
}

function Metric({ label, value, hint }) {
  return (
    <div className="rounded-xl bg-white/70 px-3 py-2">
      <dt className="text-xs text-ink-soft">{label}</dt>
      <dd className="font-display font-bold text-lg text-ink leading-tight">{value}</dd>
      <dd className="text-xs text-ink-faint">{hint}</dd>
    </div>
  );
}
