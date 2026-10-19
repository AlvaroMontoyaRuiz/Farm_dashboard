export function Card({ title, children, right }) {
  return (
    <section className="bg-white rounded-2xl border border-line shadow-panel p-5">
      {(title || right) && (
        <header className="flex items-center justify-between mb-3">
          {title && <h2 className="font-display font-semibold text-[17px] text-ink">{title}</h2>}
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, sub }) {
  return (
    <div className="bg-white rounded-2xl border border-line shadow-panel p-4">
      <div className="text-sm text-ink-soft">{label}</div>
      <div className="font-display text-2xl font-bold mt-1">{value}</div>
      {sub && <div className="text-xs text-ink-faint mt-1">{sub}</div>}
    </div>
  );
}
