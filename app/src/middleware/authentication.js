import { getCurrentAdminSession } from "../services/admin-auth.js";

export async function requireAuthentication({ request, env }) {
  return getCurrentAdminSession({ request, env, required: true });
}
