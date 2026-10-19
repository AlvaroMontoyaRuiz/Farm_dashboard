// Tiny fetch wrapper. All API calls go through here so cookies travel.
// Also translates server error codes into Spanish messages for the UI.

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
  not_enough_animals: 'No hay suficientes animales en el corral para esa salida.',
  bad_table: 'Tabla no válida.',
  bad_id: 'ID no válido.',
  not_found: 'El registro no existe.',
  not_your_record: 'Solo puedes eliminar los registros que creaste.',
  db_binding_missing:
    'La base de datos no está conectada al proyecto (falta el binding "DB" en Cloudflare).',
  db_not_initialized:
    'La base de datos está vacía: faltan las tablas. Hay que ejecutar las migraciones.',
  server_error: 'Error interno del servidor. Intenta de nuevo.',
};

export function translateError(code) {
  if (!code) return 'Ocurrió un error.';
  return ERRORS_ES[code] || `Error: ${code}`;
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
    const err = new Error(translateError(code));
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
