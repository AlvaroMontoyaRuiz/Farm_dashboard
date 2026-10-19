import { useState } from 'react';
import { api } from '../lib/api.js';

// Reusable delete button + confirmation modal. The user must type a reason
// and press confirm. The deletion goes to the deletion_log on the server.
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

  return (
    <>
      <button
        className="text-red-700 hover:text-red-900 text-xs underline"
        onClick={() => setOpen(true)}
      >
        {label}
      </button>
      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md p-5 shadow-lg">
            <h3 className="font-semibold text-lg">¿Eliminar este registro?</h3>
            <p className="text-sm text-farm-dark/70 mt-1">
              La acción quedará guardada en el historial de eliminados. Escribe un motivo
              (opcional pero recomendado).
            </p>
            <textarea
              className="w-full mt-3 border rounded p-2 text-sm"
              rows={3}
              placeholder="Motivo (ej: lo registré dos veces)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            {err && <div className="text-red-600 text-sm mt-2">{err}</div>}
            <div className="flex justify-end gap-2 mt-4">
              <button
                className="px-3 py-1.5 rounded border"
                onClick={() => setOpen(false)}
                disabled={busy}
              >
                Cancelar
              </button>
              <button
                className="px-3 py-1.5 rounded bg-red-600 text-white disabled:opacity-50"
                onClick={go}
                disabled={busy}
              >
                {busy ? 'Eliminando…' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
