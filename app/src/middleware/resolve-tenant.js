import { resolveTenantBySlug } from "../core/tenant.js";

export async function resolveTenant(env, hotelSlug) {
  return resolveTenantBySlug(env, hotelSlug);
}
