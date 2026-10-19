import { useState } from 'react';

// Shared frame for Login and Setup: centered card on the field background.
export function AuthShell({ title, subtitle, children, wide = false }) {
  return (
    <div className="min-h-full flex flex-col items-center px-4 py-8 sm:py-14">
      <div className="mb-6 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-ink text-white mb-3" aria-hidden>
          <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 21V9" />
            <path d="M12 9c0-3 2-5 5-5 0 3-2 5-5 5Z" />
            <path d="M12 13c0-3-2-5-5-5 0 3 2 5 5 5Z" />
            <path d="M12 17c0-2.5 1.6-4 4-4 0 2.5-1.6 4-4 4Z" />
          </svg>
        </div>
        <div className="font-display font-bold text-[22px] leading-tight">Inventario Finca</div>
      </div>

      <div className={`w-full ${wide ? 'max-w-3xl' : 'max-w-md'} bg-white rounded-2xl border border-line shadow-panel p-5 sm:p-8`}>
        <h1 className="font-display font-bold text-[26px] leading-tight">{title}</h1>
        {subtitle && <p className="text-ink-soft mt-1 mb-6">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}

// Password input with a show/hide button big enough for a finger.
export function PasswordField({ id, value, onChange, autoComplete, placeholder, label }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        className="field pr-24"
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        placeholder={placeholder}
        aria-label={label}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-pressed={show}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 h-10 px-3 rounded-lg text-sm font-semibold text-farm-green hover:bg-field"
      >
        {show ? 'Ocultar' : 'Mostrar'}
      </button>
    </div>
  );
}
