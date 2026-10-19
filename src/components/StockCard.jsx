import { Link } from 'react-router-dom';
import { Panel, Meter, IconAlert, IconChevron } from './ui.jsx';
import { num, num2, bultosWord, shortDay, TYPE_LABEL, TYPE_COLOR } from '../lib/format.js';

// How urgent is this stock? Returns null when everything is fine.
export function stockStatus(s) {
  if (s.remaining < 0) return { label: 'Saldo negativo', hint: 'Hay más consumo registrado que ingresos. Revisa si falta registrar un ingreso.' };
  if (s.remaining === 0) return { label: 'Sin stock', hint: 'No quedan bultos en bodega.' };
  if (s.daysLeft !== null && s.daysLeft < 7) return { label: 'Stock bajo', hint: null };
  return null;
}

// One feed type: how much is left and how long it will last.
// `detailed` adds this month's in/out and the last delivery (Bultos page).
export default function StockCard({ type, data, detailed = false, linkTo }) {
  const color = TYPE_COLOR[type];
  const status = stockStatus(data);
  const daysText =
    data.remaining <= 0
      ? status?.hint
      : data.daysLeft === null
      ? 'Aún no hay consumo reciente para estimar cuánto durará.'
      : `Alcanza para unos ${data.daysLeft} ${data.daysLeft === 1 ? 'día' : 'días'} al ritmo actual (${num(data.avgDaily)} ${bultosWord(data.avgDaily)} por día).`;

  return (
    <Panel className="settle">
      <div className="flex items-center justify-between -mt-1">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full" style={{ background: color }} aria-hidden />
          <h2 className="font-display font-semibold text-[17px]">{TYPE_LABEL[type]}</h2>
        </div>
        {status && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-alert bg-alert-bg rounded-full px-2.5 py-1">
            <IconAlert width={14} height={14} />
            {status.label}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className={`font-display font-bold text-[44px] leading-none tracking-tight ${data.remaining < 0 ? 'text-alert' : ''}`}>
          {num(data.remaining)}
        </span>
        <span className="text-ink-soft font-medium">{bultosWord(data.remaining)} en bodega</span>
      </div>

      <p className="text-sm text-ink-soft mt-2 min-h-[2.5rem]">{daysText}</p>

      {data.daysLeft !== null && data.remaining > 0 && (
        <div className="mt-1">
          <Meter
            value={Math.min(data.daysLeft, 30)}
            max={30}
            color={status ? '#B4421E' : color}
            label={`Días de stock de ${TYPE_LABEL[type]}`}
          />
          <div className="flex justify-between text-xs text-ink-faint mt-1">
            <span>0 días</span>
            <span>30 días o más</span>
          </div>
        </div>
      )}

      <dl className="mt-4 pt-3 border-t border-line grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {detailed ? (
          <>
            <div>
              <dt className="text-ink-faint">Ingresaron este mes</dt>
              <dd className="font-semibold">{num(data.monthIn)}</dd>
            </div>
            <div>
              <dt className="text-ink-faint">Consumidos este mes</dt>
              <dd className="font-semibold">{num(data.monthOut)}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-ink-faint">Último ingreso</dt>
              <dd className="font-semibold">
                {data.lastLot ? `${shortDay(data.lastLot.date)}: ${num2(data.lastLot.bultos)} ${bultosWord(data.lastLot.bultos)}` : 'Sin ingresos registrados'}
              </dd>
            </div>
          </>
        ) : (
          <>
            <div>
              <dt className="text-ink-faint">Recibidos en total</dt>
              <dd className="font-semibold">{num(data.received)}</dd>
            </div>
            <div>
              <dt className="text-ink-faint">Consumidos en total</dt>
              <dd className="font-semibold">{num(data.consumed)}</dd>
            </div>
          </>
        )}
      </dl>

      {linkTo && (
        <Link to={linkTo} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-farm-green hover:underline">
          Ver movimientos
          <IconChevron width={16} height={16} />
        </Link>
      )}
    </Panel>
  );
}
