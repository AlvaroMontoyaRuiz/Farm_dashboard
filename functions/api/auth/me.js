import { requireUser, json } from '../../_lib/auth.js';

export const onRequestGet = async ({ request, env }) => {
  try {
    const user = await requireUser(request, env);
    return json({ user });
  } catch (resp) {
    return resp;
  }
};
