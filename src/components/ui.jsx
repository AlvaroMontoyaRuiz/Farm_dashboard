// Small shared UI pieces for the Panel and Bultos pages.

export function Panel({ title, subtitle, action, children, className = '', pad = true }) {
  return (
    <section className={`bg-white rounded-2xl border border-line shadow-panel ${className}`}>
      {(title || action) && (
        <header className={`flex flex-wrap items-start justify-between gap-x-3 gap-y-2 ${pad ? 'px-5 pt-4 pb-1' : 'px-5 pt-4 pb-3'}`}>
          <div>
            {title && <h2 className="font-display font-semibold text-[17px] leading-tight text-ink">{title}</h2>}
            {subtitle && <p className="text-sm text-ink-soft mt-0.5">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={pad ? 'px-5 pb-5 pt-3' : ''}>{children}</div>
    </section>
  );
}

// Segmented control: options = [{value,label}]
export function Segmented({ value, onChange, options, label }) {
  return (
    <div role="group" aria-label={label} className="inline-flex bg-field rounded-full p-0.5 text-sm">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1 rounded-full font-medium whitespace-nowrap transition-colors ${
            value === o.value ? 'bg-white text-ink shadow-sm' : 'text-ink-soft hover:text-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Meter({ value, max = 1, color = '#1F7A4D', label }) {
  const pct = Math.max(0, Math.min(1, max > 0 ? value / max : 0)) * 100;
  return (
    <div
      className="h-2 rounded-full bg-[#E7ECE2] overflow-hidden"
      role="meter"
      aria-label={label}
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: pct + '%', background: color }} />
    </div>
  );
}

export function LegendDot({ color, children }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-ink-soft">
      <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: color }} aria-hidden />
      {children}
    </span>
  );
}

export function Skeleton({ className = '' }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

/* ---------- icons (inline, 20px, currentColor) ---------- */
const base = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

export const IconCheck = (p) => (<svg {...base} {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>);
export const IconCircle = (p) => (<svg {...base} {...p}><circle cx="12" cy="12" r="7.5" /></svg>);
export const IconRefresh = (p) => (<svg {...base} {...p}><path d="M20 11a8 8 0 10-2.3 5.7" /><path d="M20 4v7h-7" /></svg>);
export const IconChevron = (p) => (<svg {...base} {...p}><path d="M9 6l6 6-6 6" /></svg>);
export const IconAlert = (p) => (<svg {...base} {...p}><path d="M12 4l9 16H3L12 4z" /><path d="M12 10v4M12 17.5v.01" /></svg>);
export const IconBag = (p) => (<svg {...base} {...p}><path d="M6 8h12l1 12H5L6 8z" /><path d="M9 8V6a3 3 0 016 0v2" /></svg>);
export const IconPaw = (p) => (<svg {...base} {...p}><circle cx="7" cy="9" r="1.6" /><circle cx="12" cy="6.5" r="1.6" /><circle cx="17" cy="9" r="1.6" /><path d="M12 11.5c-3 0-5 2.5-5 4.5 0 1.6 1.4 2.5 3 2.5 1 0 1.4-.4 2-.4s1 .4 2 .4c1.6 0 3-.9 3-2.5 0-2-2-4.5-5-4.5z" /></svg>);
export const IconIn = (p) => (<svg {...base} {...p}><path d="M12 4v12M7 11l5 5 5-5M5 20h14" /></svg>);
