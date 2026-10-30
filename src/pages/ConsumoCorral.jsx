import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { Segmented, Skeleton } from '../components/ui.jsx';
import { num, num2, FOOD_TYPES, TYPE_LABEL, TYPE_COLOR } from '../lib/format.js';

// One corral, one card per type of bulto, with a big − and + for tablets.
// + adds to today's feeding, − takes off. The number shown is what the corral got today.
export default function ConsumoCorral({ user }) {
  const { corralId } = useParams();
  const isAdmin = user.role === 'admin';
  const [data, setData] = useState(null);
  const [step, setStep] = useState(1);
  const [msg, setMsg] = useState(null); // { ok: bool, text }
  const inflight = useRef(0);
  const latest = useRef({}); // newest tap per type

  const load = useCallback(async () => {
    try {
      setData(await api.get(`/api/consumption/today?corralId=${corralId}`));
    } catch (e) {
      setMsg({ ok: false, text: e.message });
    }
  }, [corralId]);

  useEffect(() => {
    setData(null);
    load();
  }, [load]);

  async function tap(type, sign) {
    const delta = sign * step;
    const word = (n) => (Math.abs(n) === 1 ? 'bulto' : 'bultos');
    // show the new number right away; the server answer replaces it
    setData((d) => {
      const t = d.types[type];
      return { ...d, types: { ...d.types, [type]: { ...t, today: Math.max(0, t.today + delta), mine: Math.max(0, t.mine + delta), stock: t.stock - delta } } };
    });
    setMsg(null);
    const my = (latest.current[type] = (latest.current[type] || 0) + 1);
    inflight.current += 1;
    try {
      const r = await api.post('/api/consumption/adjust', { corralId: Number(corralId), foodType: type, delta });
      if (latest.current[type] === my) setData(r);
      setMsg({
        ok: true,
        text:
          delta > 0
            ? `Agregaste ${num2(delta)} ${word(delta)} de ${TYPE_LABEL[type].toLowerCase()}.`
            : `Quitaste ${num2(-delta)} ${word(delta)} de ${TYPE_LABEL[type].toLowerCase()}.`,
      });
    } catch (e) {
      setMsg({ ok: false, text: e.message });
      load();
    } finally {
      inflight.current -= 1;
      if (inflight.current === 0) load(); // settle on what the server really has
    }
  }

  const c = data?.corral;

  return (
    <div className="space-y-5">
      <div>
        <Link to="/consumo/corrales" className="inline-flex items-center gap-1.5 min-h-[44px] -ml-1 px-2 rounded-lg text-[15px] font-semibold text-farm-green hover:bg-field">
          <span aria-hidden>←</span> Todos los corrales
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 mt-1">
          <div>
            <h1 className="font-display font-bold text-[32px] leading-tight">{c ? c.name : 'Corral'}</h1>
            <p className="text-ink-soft">
              {c ? (c.animals > 0 ? `${num(c.animals)} ${c.animals === 1 ? 'animal' : 'animales'}` : 'Este corral no tiene animales registrados') : ' '}
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-ink-soft">
            <span id="paso">Cada toque</span>
            <Segmented
              label="Cantidad por toque"
              large
              value={step}
              onChange={setStep}
              options={[{ value: 1, label: '1 bulto' }, { value: 0.5, label: '½ bulto' }]}
            />
          </div>
        </div>
      </div>

      <div aria-live="polite" className="min-h-[24px] text-[15px]">
        {msg && <p className={msg.ok ? 'text-farm-green font-medium' : 'text-alert font-medium'} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}
      </div>

      {!data ? (
        <div className="space-y-4">
          {FOOD_TYPES.map((t) => (
            <Skeleton key={t} className="h-36" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {FOOD_TYPES.map((t) => {
            const x = data.types[t];
            const mineOnly = !isAdmin;
            const removable = mineOnly ? x.mine : x.today;
            const noStock = x.stock < step - 1e-9;
            return (
              <section key={t} className="rounded-2xl border border-line bg-white shadow-panel p-4 sm:p-5" aria-label={TYPE_LABEL[t]}>
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                  <h2 className="flex items-center gap-2 font-display font-semibold text-[21px]">
                    <span className="inline-block w-3.5 h-3.5 rounded-full" style={{ background: TYPE_COLOR[t] }} aria-hidden />
                    {TYPE_LABEL[t]}
                  </h2>
                  <p className={`text-sm ${x.stock <= 0 ? 'text-alert font-semibold' : 'text-ink-soft'}`}>
                    {x.stock <= 0 ? 'Sin bultos en bodega' : `En bodega: ${num(x.stock)} ${x.stock === 1 ? 'bulto' : 'bultos'}`}
                  </p>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => tap(t, -1)}
                    disabled={removable <= 0}
                    aria-label={`Quitar ${step === 1 ? '1 bulto' : 'medio bulto'} de ${TYPE_LABEL[t].toLowerCase()}`}
                    className="w-[84px] h-[84px] sm:w-[96px] sm:h-[96px] shrink-0 rounded-2xl border-2 border-line bg-white text-ink text-[44px] leading-none font-light select-none active:scale-95 active:bg-field disabled:opacity-35 disabled:active:scale-100 transition"
                  >
                    −
                  </button>

                  <div className="text-center min-w-0">
                    <div className="font-display font-bold text-[56px] sm:text-[64px] leading-none">{num2(x.today)}</div>
                    <div className="text-sm text-ink-soft mt-1">
                      {x.today === 1 ? 'bulto' : 'bultos'} hoy
                      {x.kgPerBulto && x.today > 0 ? ` · ${num(x.today * x.kgPerBulto)} kg` : ''}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => tap(t, 1)}
                    disabled={noStock}
                    aria-label={`Agregar ${step === 1 ? '1 bulto' : 'medio bulto'} de ${TYPE_LABEL[t].toLowerCase()}`}
                    className="w-[84px] h-[84px] sm:w-[96px] sm:h-[96px] shrink-0 rounded-2xl bg-farm-green text-white text-[44px] leading-none font-light select-none active:scale-95 active:bg-[#19673f] disabled:opacity-35 disabled:active:scale-100 transition"
                  >
                    +
                  </button>
                </div>

                {mineOnly && x.today > x.mine + 1e-9 && (
                  <p className="text-xs text-ink-faint mt-3 text-center">
                    {x.mine > 0 ? `Tú registraste ${num2(x.mine)}; ` : ''}otra persona registró {num2(x.today - x.mine)}. Solo puedes quitar lo tuyo.
                  </p>
                )}
              </section>
            );
          })}
        </div>
      )}

      {isAdmin && (
        <p className="text-sm text-ink-soft">
          <Link className="font-semibold text-farm-green underline underline-offset-2" to={`/consumo?corral=${corralId}`}>
            Registro detallado de este corral
          </Link>{' '}
          (otra fecha, nota).
        </p>
      )}
    </div>
  );
}
