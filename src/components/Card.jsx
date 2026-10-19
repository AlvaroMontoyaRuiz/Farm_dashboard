export function Card({ title, children, right }) {
  return (
    <section className="bg-white rounded-lg shadow-sm border border-farm-sand/40 p-4">
      {(title || right) && (
        <header className="flex items-center justify-between mb-3">
          {title && <h2 className="font-semibold text-farm-dark">{title}</h2>}
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, sub }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-farm-sand/40 p-4">
      <div className="text-xs uppercase tracking-wide text-farm-dark/60">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
      {sub && <div className="text-xs text-farm-dark/60 mt-1">{sub}</div>}
    </div>
  );
}
