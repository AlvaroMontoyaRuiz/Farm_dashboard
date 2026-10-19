// Tiny fetch wrapper. All API calls go through here so cookies travel.
// Also translates server error codes into Spanish messages for the UI.

import { num, bultosWord, shortDay, TYPE_LABEL } from './format.js';

const ERRORS_ES = {
  not_authenticated: 'Debes iniciar sesión.',
  invalid_session: 'Tu sesión ya no es válida. Vuelve a iniciar sesión.',
  session_expired: 'Tu sesión expiró. Vuelve a iniciar sesión.',
  admin_only: 'Solo el administrador puede hacer esto.',
  invalid_credentials: 'Usuario o contraseña incorrectos.',
  missing_credentials: 'Faltan datos de usuario o contraseña.',
  invalid_json: 'La solicitud no es válida.',
  already_initialized: 'Los usuarios ya fueron creados. No se puede volver a configurar.',
  admin_required: 'Debes definir un administrador.',
  too_many_workers: 'Máximo 3 trabajadores.',
  password_too_short: 'La contraseña debe tener al menos 6 caracteres.',
  bad_type: 'Tipo de comida inválido.',
  bad_food_type: 'Tipo de comida inválido.',
  bad_quantity: 'Cantidad inválida.',
  bad_bultos: 'Cantidad de bultos inválida.',
  bad_movement: 'Tipo de movimiento inválido.',
  corral_required: 'Debes seleccionar un corral.',
  // These four get the numbers from the server, so the message says exactly what is available.
  not_enough_stock: (d) => {
    const t = (TYPE_LABEL[d.foodType] || 'alimento').toLowerCase();
    return d.available > 0
      ? `Solo quedan ${num(d.available)} ${bultosWord(d.available)} de ${t} en bodega.`
      : `No hay bultos de ${t} en bodega. El administrador debe registrar un ingreso.`;
  },
  not_enough_animals: (d) =>
    d.available > 0
      ? `Solo hay ${num(d.available)} ${d.available === 1 ? 'animal' : 'animales'} en ${d.corral || 'este corral'}.`
      : `${d.corral || 'Este corral'} no tiene animales para sacar.`,
  breaks_history: (d) =>
    d.scope === 'animals'
      ? `Con esa fecha, ${d.corral || 'el corral'} quedaría con animales negativos el ${shortDay(d.date)}.`
      : `Con esa fecha, el inventario de ${(TYPE_LABEL[d.foodType] || 'alimento').toLowerCase()} quedaría en negativo el ${shortDay(d.date)}.`,
  would_go_negative: (d) =>
    d.scope === 'animals'
      ? 'No se puede eliminar este ingreso de animales: ya salieron animales de ese corral y quedaría en negativo.'
      : `No se puede eliminar este ingreso: esos bultos ya se consumieron y el inventario de ${(TYPE_LABEL[d.foodType] || 'alimento').toLowerCase()} quedaría en negativo.`,
  bad_date: 'La fecha no es válida.',
  corral_not_found: 'El corral no existe.',
  bad_table: 'Tabla no válida.',
  bad_id: 'ID no válido.',
  not_found: 'El registro no existe.',
  not_your_record: 'Solo puedes eliminar los registros que creaste.',
  db_binding_missing:
    'La base de datos no está conectada al proyecto (falta el binding "DB" en Cloudflare).',
  db_not_initialized:
    'La base de datos está vacía: faltan las tablas. Hay que ejecutar las migraciones.',
  db_needs_update:
    'La base de datos necesita una actualización. Ejecuta: npm run db:remote:update',
  bad_weight: 'Escribe el peso total del grupo en kg.',
  weight_implausible: (d) =>
    `Ese peso parece incorrecto: serían ${num(d.perAnimal)} kg por animal. Escribe el peso TOTAL del grupo, no el de un animal.`,
  bad_kg_per_bulto: 'Los kg por bulto deben ser un número mayor que 0.',
  server_error: 'Error interno del servidor. Intenta de nuevo.',
};

export function translateError(code, data) {
  if (!code) return 'Ocurrió un error.';
  const m = ERRORS_ES[code];
  if (typeof m === 'function') return m(data || {});
  return m || `Error: ${code}`;
}

async function request(method, path, body) {
  const res = await fetch(path, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const code = data?.error || `HTTP_${res.status}`;
    const err = new Error(translateError(code, data));
    err.status = res.status;
    err.code = code;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  get: (p) => request('GET', p),
  post: (p, b) => request('POST', p, b),
  del: (p, b) => request('DELETE', p, b),
};
