import { forbidden } from "../core/errors.js";
import { isFeatureEnabled } from "../core/feature-flags.js";

export async function requireFeature(env, hotelId, featureKey) {
  const enabled = await isFeatureEnabled(env, hotelId, featureKey);
  if (!enabled) {
    throw forbidden("Feature indisponivel para este hotel.");
  }
}
