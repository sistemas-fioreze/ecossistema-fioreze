import { notFoundError } from "../core/errors.js";
import { getHotelModule } from "../core/tenant.js";

export async function requireEnabledModule(env, hotelId, moduleKey) {
  const module = await getHotelModule(env, hotelId, moduleKey);
  if (!module || !module.enabled) {
    throw notFoundError("Modulo indisponivel para este hotel.");
  }
  return module;
}
