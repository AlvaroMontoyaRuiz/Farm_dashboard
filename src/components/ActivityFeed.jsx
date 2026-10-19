import { IconBag, IconPaw, IconIn } from './ui.jsx';
import { num2, bultosWord, whenLabel, TYPE_LABEL } from '../lib/format.js';

function describe(a) {
  const who = a.who || 'Alguien';
  const q = num2(a.qty);
  const type = TYPE_LABEL[a.sub]?.toLowerCase();
  if (a.kind === 'consumo') return { icon: <IconBag />, text: (<><b>{who}</b> dio <b>{q} {bultosWord(a.qty)}</b> de {type} en {a.corral}</>) };
  if (a.kind === 'ingreso') return { icon: <IconIn />, text: (<><b>{who}</b> recibió <b>{q} {bultosWord(a.qty)}</b> de {type}</>) };
  const n = Number(a.qty);
  const animals = n === 1 ? 'animal' : 'animales';
  return a.sub === 'ingreso'
    ? { icon: <IconPaw />, text: (<><b>{who}</b> ingresó <b>{n} {animals}</b> a {a.corral}</>) }
    : { icon: <IconPaw />, text: (<><b>{who}</b> sacó <b>{n} {animals}</b> de {a.corral}</>) };
}

export default function ActivityFeed({ items }) {
  if (!items.length) {
    return (
      <p className="text-sm text-ink-soft py-4">
        Todavía no hay actividad. Cuando registres un consumo, un ingreso de bultos o un movimiento de animales, lo verás aquí.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-line">
      {items.slice(0, 7).map((a, i) => {
        const d = describe(a);
        return (
          <li key={i} className="flex gap-3 py-2.5 first:pt-0">
            <span className="mt-0.5 w-8 h-8 shrink-0 rounded-full bg-field grid place-items-center text-ink-soft">{d.icon}</span>
            <div className="min-w-0">
              <p className="text-sm leading-snug [&_b]:font-semibold">{d.text}</p>
              <p className="text-xs text-ink-faint mt-0.5">{whenLabel(a.ts)}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
