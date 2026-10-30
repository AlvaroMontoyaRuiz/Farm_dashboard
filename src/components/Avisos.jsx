import { Link } from 'react-router-dom';
import { Panel, IconAlert, IconCheck, IconChevron } from './ui.jsx';
import { num, FOOD_TYPES, TYPE_LABEL, TYPE_COLOR } from '../lib/format.js';

// Notifications for the administrator (top of the Panel):
//   - any type of bulto below the limit (40) in storage: buy more before it runs out
//   - requests to move animals waiting for approval
// A type that has never been bought is not reported.
export default function Avisos({ stock, limit, pending }) {
  const low = FOOD_TYPES.filter((t) => stock[t].received > 0 && stock[t].remaining < limit);
  const count = low.length + (pending > 0 ? 1 : 0);

  if (count === 0) {
    return (
      <section className="rounded-2xl border border-line bg-white shadow-panel px-5 py-3.5 flex items-center gap-2.5 text-sm text-ink-soft" aria-label="Avisos">
        <IconCheck className="text-farm-green shrink-0" />
        <span>
          <b className="text-ink">Sin avisos.</b> Hay {limit} bultos o más de cada tipo y no hay solicitudes por aprobar.
        </span>
      </section>
    );
  }

  return (
    <Panel title={`Avisos (${count})`} subtitle="Lo que necesita tu atención" className="border-alert/30">
      <ul className="space-y-2.5">
        {low.map((t) => {
          const s = stock[t];
          const none = s.remaining <= 0;
          return (
            <li key={t} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-alert-bg px-4 py-3">
              <IconAlert className="text-alert shrink-0" />
              <p className="text-[15px] text-ink flex-1 min-w-[220px]">
                <span className="inline-block w-2.5 h-2.5 rounded-full mr-1.5" style={{ background: TYPE_COLOR[t] }} aria-hidden />
                {none ? (
                  <>
                    <b>Sin bultos de {TYPE_LABEL[t].toLowerCase()}.</b> Compra más cuanto antes.
                  </>
                ) : (
                  <>
                    <b>
                      Quedan {num(s.remaining)} {s.remaining === 1 ? 'bulto' : 'bultos'} de {TYPE_LABEL[t].toLowerCase()}
                    </b>{' '}
                    (menos de {limit}). Compra más antes de que se acaben.
                    {s.daysLeft !== null && <> Alcanza para unos {s.daysLeft} {s.daysLeft === 1 ? 'día' : 'días'}.</>}
                  </>
                )}
              </p>
              <Link to="/inventario?tab=ingresos" className="btn btn-quiet !min-h-[40px] px-4 whitespace-nowrap">
                Registrar ingreso
              </Link>
            </li>
          );
        })}

        {pending > 0 && (
          <li className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-field px-4 py-3">
            <IconChevron className="text-ink-soft shrink-0" />
            <p className="text-[15px] text-ink flex-1 min-w-[220px]">
              <b>
                {pending} {pending === 1 ? 'solicitud de traslado espera' : 'solicitudes de traslado esperan'} tu aprobación.
              </b>
            </p>
            <Link to="/solicitudes" className="btn btn-primary !min-h-[40px] px-4 whitespace-nowrap">
              Ver solicitudes
            </Link>
          </li>
        )}
      </ul>
    </Panel>
  );
}
