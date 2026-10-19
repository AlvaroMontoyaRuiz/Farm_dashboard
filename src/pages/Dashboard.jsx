import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { Panel, Segmented, Meter, LegendDot, Skeleton, IconRefresh, IconCheck } from '../components/ui.jsx';
import StockCard from '../components/StockCard.jsx';
import ConsumptionChart from '../components/ConsumptionChart.jsx';
import CorralGrid from '../components/CorralGrid.jsx';
import ActivityFeed from '../components/ActivityFeed.jsx';
import { num, bultosWord, longDay, timeLabel, TYPE_COLOR } from '../lib/format.js';

export default function Dashboard({ user }) {
  const isAdmin = user?.role === 'admin';
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [range, setRange] = useState(14);
  const [updated, setUpdated] = useState(null);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      setD(await api.get('/api/dashboard'));
      setErr('');
      setUpdated(new Date());
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000); // keep the panel fresh while it stays open
    return () => clearInterval(t);
  }, [load]);

  if (!d) {
    return err ? (
      <Panel>
        <p className="font-semibold">No se pudo cargar el panel.</p>
        <p className="text-sm text-ink-soft mt-1">{err}</p>
        <button onClick={load} className="mt-3 px-3 py-1.5 rounded-lg bg-farm-green text-white text-sm font-medium">Reintentar</button>
      </Panel>
    ) : (
      <div className="space-y-5" aria-busy="true">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-28" />
        <div className="grid md:grid-cols-2 gap-5"><Skeleton className="h-64" /><Skeleton className="h-64" /></div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  const pendingCount = d.activeCorrales - d.fedCorrales;
  const trend = d.trend.slice(-range);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-[30px] leading-tight">Panel</h1>
          <p className="text-ink-soft">{longDay(d.today)}</p>
        </div>
        <div className="flex items-center gap-3 text-sm text-ink-soft">
          {updated && <span>Actualizado {timeLabel(updated)}</span>}
          <button
            onClick={load}
            disabled={busy}
            aria-label="Actualizar datos"
            className="w-9 h-9 grid place-items-center rounded-full bg-white border border-line hover:border-ink-faint disabled:opacity-60"
          >
            <IconRefresh className={busy ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>
      {err && <p className="text-sm text-alert">No se pudo actualizar: {err}</p>}

      {/* Summary strip: one instrument, three readings */}
      <section className="bg-white rounded-2xl border border-line shadow-panel grid sm:grid-cols-3 sm:divide-x divide-y sm:divide-y-0 divide-line settle">
        <div className="p-5">
          <p className="text-sm text-ink-soft">Animales</p>
          <p className="font-display font-bold text-[40px] leading-none mt-1.5">{num(d.totalAnimals)}</p>
          <p className="text-sm text-ink-soft mt-2">en {d.activeCorrales} de {d.corrales.length} corrales</p>
        </div>

        <div className="p-5">
          <p className="text-sm text-ink-soft">Alimentados hoy</p>
          <p className="font-display font-bold text-[40px] leading-none mt-1.5">
            {d.fedCorrales}
            <span className="text-ink-faint text-[24px] font-semibold"> de {d.activeCorrales}</span>
          </p>
          <div className="mt-3">
            <Meter value={d.fedCorrales} max={d.activeCorrales || 1} color="#17261D" label="Corrales alimentados hoy" />
          </div>
          <p className={`text-sm mt-2 flex items-center gap-1 ${pendingCount > 0 ? 'text-ink-soft' : 'text-farm-green font-medium'}`}>
            {pendingCount > 0 ? (
              `Faltan ${pendingCount} ${pendingCount === 1 ? 'corral' : 'corrales'}`
            ) : d.activeCorrales > 0 ? (
              <><IconCheck width={16} height={16} /> Todos alimentados</>
            ) : (
              'No hay corrales con animales'
            )}
          </p>
        </div>

        <div className="p-5">
          <p className="text-sm text-ink-soft">Consumo de hoy</p>
          <p className="font-display font-bold text-[40px] leading-none mt-1.5">
            {num(d.todayConsumption.total)}
            <span className="text-ink-faint text-[20px] font-semibold"> {bultosWord(d.todayConsumption.total)}</span>
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5">
            <LegendDot color={TYPE_COLOR.levante}>Levante <b className="text-ink font-semibold">{num(d.todayConsumption.levante)}</b></LegendDot>
            <LegendDot color={TYPE_COLOR.finalizador}>Finalizador <b className="text-ink font-semibold">{num(d.todayConsumption.finalizador)}</b></LegendDot>
          </div>
          <p className="text-sm text-ink-soft mt-1.5">
            {d.avgDailyConsumption > 0 ? `Promedio diario: ${num(d.avgDailyConsumption)} ${bultosWord(d.avgDailyConsumption)}` : 'Aún sin promedio'}
          </p>
        </div>
      </section>

      {/* Stock */}
      <div className="grid md:grid-cols-2 gap-5">
        <StockCard type="levante" data={d.stock.levante} linkTo={isAdmin ? '/inventario?tab=movimientos' : undefined} />
        <StockCard type="finalizador" data={d.stock.finalizador} linkTo={isAdmin ? '/inventario?tab=movimientos' : undefined} />
      </div>

      {/* Trend + activity */}
      <div className="grid lg:grid-cols-3 gap-5">
        <Panel
          className="lg:col-span-2"
          title="Consumo diario"
          subtitle="Bultos entregados por día"
          action={
            <Segmented
              label="Período"
              value={range}
              onChange={setRange}
              options={[{ value: 7, label: '7 días' }, { value: 14, label: '14 días' }, { value: 30, label: '30 días' }]}
            />
          }
        >
          <ConsumptionChart data={trend} />
        </Panel>

        <Panel title="Actividad reciente" subtitle="Lo último que registró el equipo">
          <ActivityFeed items={d.activity} />
        </Panel>
      </div>

      {/* Corrales */}
      <Panel title="Corrales" subtitle="Toca un corral para registrar su consumo">
        <CorralGrid corrales={d.corrales} />
      </Panel>
    </div>
  );
}
