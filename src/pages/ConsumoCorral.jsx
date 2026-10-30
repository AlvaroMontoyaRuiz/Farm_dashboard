import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { Segmented, Skeleton } from '../components/ui.jsx';
import { num, num2, FOOD_TYPES, TYPE_LABEL, TYPE_COLOR } from '../lib/format.js';

const EPS = 1e-9;
const zero = () => Object.fromEntries(FOOD_TYPES.map((t) => [t, 0]));
const bultoWord = (n) => (Math.abs(n) === 1 ? 'bulto' : 'bultos');

// One corral, one card per type of bulto, with a big − and + for tablets.
// The buttons only PREPARE the feeding; nothing is saved until the worker presses "Confirmar".
// A corral can be fed several times a day: every confirmation is its own record.
export default function ConsumoCorral({ user }) {
  const { corralId } = useParams();
  const navigate = useNavigate();
  const isAdmin = user.role === 'admin';
  const [data, setData] = useState(null);
  const [step, setStep] = useState(1);
  const [pending, setPending] = useState(zero); // unconfirmed change per type (+ adds, − takes off)
  const [msg, setMsg] = useState(null); // { ok: bool, text }
  const [saving, setSaving] = useState(false);
  const [leaveTo, setLeaveTo] = useState(null); // address the person tried to open with unconfirmed taps
  const savingRef = useRef(false);

  const changes = FOOD_TYPES.filter((t) => Math.abs(pending[t]) > EPS);
  const hasPending = changes.length > 0;

  const load = useCallback(async () => {
    try {
      setData(await api.get(`/api/consumption/today?corralId=${corralId}`));
    } catch (e) {
      setMsg({ ok: false, text: e.message });
    }
  }, [corralId]);

  useEffect(() => {
    setData(null);
    setPending(zero());
    setMsg(null);
    setLeaveTo(null);
    load();
  }, [load]);

  // Do not lose unconfirmed taps by accident: closing the tab asks, and opening another page asks inline.
  useEffect(() => {
    if (!hasPending) return undefined;
    const onUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    const onClick = (e) => {
      const a = e.target.closest && e.target.closest('a[href]');
      if (!a || a.target === '_blank' || a.closest('[data-keep-pending]')) return;
      const href = a.getAttribute('href');
      if (!href || !href.startsWith('/')) return;
      e.preventDefault();
      e.stopPropagation();
      setLeaveTo(href);
    };
    window.addEventListener('beforeunload', onUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [hasPending]);

  // how many bultos this person may still take off a type (counting what is already prepared)
  const removable = (t) => {
    const x = data.types[t];
    return (isAdmin ? x.today : x.mine) + pending[t];
  };
  const available = (t) => data.types[t].stock - pending[t]; // in storage after what is prepared

  function tap(t, sign) {
    if (saving) return;
    const label = TYPE_LABEL[t].toLowerCase();
    if (sign > 0 && available(t) < step - EPS) {
      setMsg({ ok: false, text: available(t) <= EPS ? `No hay bultos de ${label} en bodega.` : `En bodega solo quedan ${num2(available(t))} ${bultoWord(available(t))} de ${label}.` });
      return;
    }
    if (sign < 0 && removable(t) < step - EPS) {
      const x = data.types[t];
      setMsg({
        ok: false,
        text:
          !isAdmin && x.today > x.mine + EPS
            ? `Solo puedes quitar lo que tú registraste de ${label}.`
            : `No hay nada más que quitar de ${label}.`,
      });
      return;
    }
    setMsg(null);
    setPending((p) => ({ ...p, [t]: Math.round((p[t] + sign * step) * 2) / 2 }));
  }

  function undo() {
    setPending(zero());
    setMsg(null);
    setLeaveTo(null);
  }

  async function confirm() {
    if (savingRef.current || !hasPending) return;
    savingRef.current = true;
    setSaving(true);
    setMsg(null);
    setLeaveTo(null);
    const done = [];
    try {
      for (const t of changes) {
        const delta = pending[t];
        let r;
        try {
          r = await api.post('/api/consumption/adjust', { corralId: Number(corralId), foodType: t, delta, separate: true });
        } catch (e) {
          // what was already saved stays saved; the rest stays prepared so it can be fixed and confirmed again
          setMsg({
            ok: false,
            text: `${done.length ? 'Se guardó una parte. ' : 'No se guardó. '}${TYPE_LABEL[t]}: ${e.message}`,
          });
          await load();
          return;
        }
        done.push(`${delta > 0 ? '+' : '−'}${num2(Math.abs(delta))} ${TYPE_LABEL[t].toLowerCase()}`);
        setData(r);
        setPending((p) => ({ ...p, [t]: 0 }));
      }
      const name = data?.corral?.name || 'el corral';
      setMsg({ ok: true, text: `Guardado en ${name}: ${done.join(' · ')}.` });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const c = data?.corral;
  const summary = changes.map((t) => `${pending[t] > 0 ? '+' : '−'}${num2(Math.abs(pending[t]))} ${TYPE_LABEL[t].toLowerCase()}`).join(' · ');

  return (
    <div className="space-y-5 pb-4">
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
        <p className="text-sm text-ink-soft mt-2">
          Toca <b>+</b> o <b>−</b> en cada tipo de bulto y, cuando termines de alimentar, presiona <b>Confirmar</b>. Si alimentas otra vez más tarde, repite y confirma de nuevo.
        </p>
      </div>

      <div aria-live="polite" className="min-h-[24px] text-[15px]">
        {msg && <p className={msg.ok ? 'text-farm-green font-medium' : 'text-alert font-medium'} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}
      </div>

      {leaveTo && (
        <div className="rounded-xl bg-alert-bg text-alert px-4 py-3 flex flex-wrap items-center gap-3" role="alert" data-keep-pending>
          <span className="font-medium flex-1 min-w-[200px]">Tienes cambios sin confirmar ({summary}). Si sales, se pierden.</span>
          <button type="button" className="btn btn-quiet" onClick={() => setLeaveTo(null)}>Seguir aquí</button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => {
              const to = leaveTo;
              setPending(zero());
              setLeaveTo(null);
              navigate(to);
            }}
          >
            Salir sin guardar
          </button>
        </div>
      )}

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
            const p = pending[t];
            const shown = Math.max(0, x.today + p);
            const left = available(t);
            const plusOff = left < step - EPS;
            const minusOff = removable(t) < step - EPS;
            return (
              <section
                key={t}
                className={`rounded-2xl border bg-white shadow-panel p-4 sm:p-5 ${Math.abs(p) > EPS ? 'border-[#D9A441]' : 'border-line'}`}
                aria-label={TYPE_LABEL[t]}
              >
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                  <h2 className="flex items-center gap-2 font-display font-semibold text-[21px]">
                    <span className="inline-block w-3.5 h-3.5 rounded-full" style={{ background: TYPE_COLOR[t] }} aria-hidden />
                    {TYPE_LABEL[t]}
                  </h2>
                  <p className={`text-sm ${left <= EPS ? 'text-alert font-semibold' : 'text-ink-soft'}`}>
                    {left <= EPS ? 'Sin bultos en bodega' : `En bodega: ${num2(left)} ${left === 1 ? 'bulto' : 'bultos'}`}
                  </p>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => tap(t, -1)}
                    aria-disabled={minusOff || saving}
                    aria-label={`Quitar ${step === 1 ? '1 bulto' : 'medio bulto'} de ${TYPE_LABEL[t].toLowerCase()}`}
                    className={`w-[84px] h-[84px] sm:w-[96px] sm:h-[96px] shrink-0 rounded-2xl border-2 border-line bg-white text-ink text-[44px] leading-none font-light select-none active:scale-95 active:bg-field transition ${
                      minusOff || saving ? 'opacity-35' : ''
                    }`}
                  >
                    −
                  </button>

                  <div className="text-center min-w-0">
                    <div className="font-display font-bold text-[56px] sm:text-[64px] leading-none">{num2(shown)}</div>
                    <div className="text-sm text-ink-soft mt-1">
                      {shown === 1 ? 'bulto' : 'bultos'} hoy
                      {x.kgPerBulto && shown > 0 ? ` · ${num(shown * x.kgPerBulto)} kg` : ''}
                    </div>
                    {Math.abs(p) > EPS && (
                      <div className="mt-1.5 inline-block rounded-full bg-[#FBF1DA] text-[#7A5410] text-[13px] font-semibold px-2.5 py-0.5">
                        {p > 0 ? '+' : '−'}{num2(Math.abs(p))} sin confirmar
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => tap(t, 1)}
                    aria-disabled={plusOff || saving}
                    aria-label={`Agregar ${step === 1 ? '1 bulto' : 'medio bulto'} de ${TYPE_LABEL[t].toLowerCase()}`}
                    className={`w-[84px] h-[84px] sm:w-[96px] sm:h-[96px] shrink-0 rounded-2xl bg-farm-green text-white text-[44px] leading-none font-light select-none active:scale-95 active:bg-[#19673f] transition ${
                      plusOff || saving ? 'opacity-35' : ''
                    }`}
                  >
                    +
                  </button>
                </div>

                {!isAdmin && x.today > x.mine + EPS && (
                  <p className="text-xs text-ink-faint mt-3 text-center">
                    {x.mine > 0 ? `Tú registraste ${num2(x.mine)}; ` : ''}otra persona registró {num2(x.today - x.mine)}. Solo puedes quitar lo tuyo.
                  </p>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* stays at the bottom of the screen so the tablet never has to scroll to find it */}
      <div
        className="sticky bottom-3 z-10 rounded-2xl border border-line bg-white shadow-panel p-3 sm:p-4 flex flex-wrap items-center gap-x-3 gap-y-2"
        data-keep-pending
        role="group"
        aria-label="Confirmar alimentación"
      >
        <p className={`basis-full sm:basis-auto sm:flex-1 text-[15px] ${hasPending ? 'text-ink font-semibold' : 'text-ink-faint'}`}>
          {hasPending ? `Por confirmar: ${summary}` : 'Aún no has preparado nada. Toca + o − arriba.'}
        </p>
        <button type="button" className="btn btn-quiet !min-h-[56px] px-5 flex-1 sm:flex-none" onClick={undo} disabled={!hasPending || saving}>
          Deshacer
        </button>
        <button
          type="button"
          className="btn btn-primary !min-h-[56px] px-8 text-[18px] flex-[2] sm:flex-none"
          onClick={confirm}
          disabled={!hasPending || saving || !data}
        >
          {saving ? 'Guardando…' : 'Confirmar'}
        </button>
      </div>

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
