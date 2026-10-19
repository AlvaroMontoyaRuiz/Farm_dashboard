import { useState } from 'react';
import { api } from '../lib/api.js';

// Delete button + confirmation dialog. The reason is optional; the deletion is
// always copied to the deletion log on the server. On phones the dialog slides
// up from the bottom so the buttons stay within thumb reach.
export default function ConfirmDelete({ table, id, label = 'Eliminar', onDeleted }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function go() {
    setBusy(true);
    setErr('');
    try {
      await api.del(`/api/record/${table}/${id}`, { reason });
      setOpen(false);
      setReason('');
      onDeleted && onDeleted();
    } catch (e) {
      setErr(e.message || 'Ocurrió un error.');
    } finally {
      setBusy(false);
    }
  }

  function close() {
    if (busy) return;
    setOpen(false);
    setErr('');
  }

  return (
    <>
      <button type="button" className="btn-link-danger" onClick={() => setOpen(true)}>
        {label}
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 bg-ink/50 flex items-end sm:items-center justify-center sm:p-4"
          onClick={close}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="del-title"
            className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 shadow-panel text-left"
            style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="del-title" className="font-display font-bold text-xl">¿Eliminar este registro?</h3>
            <p className="text-ink-soft mt-1.5">
              Quedará guardado en el historial de eliminados. Escribe un motivo (opcional, pero recomendado).
            </p>
            <textarea
              className="field mt-4 py-3"
              rows={3}
              placeholder="Motivo (ej: lo registré dos veces)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            {err && (
              <p role="alert" className="mt-3 rounded-xl bg-alert-bg text-alert text-sm px-3.5 py-2.5">
                {err}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3 mt-5">
              <button className="btn btn-quiet" onClick={close} disabled={busy}>
                Cancelar
              </button>
              <button className="btn btn-danger" onClick={go} disabled={busy}>
                {busy ? 'Eliminando…' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
