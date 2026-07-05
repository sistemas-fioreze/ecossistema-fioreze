import { all, first } from "./database.js";

export async function getPublicFeatures(env, hotelId) {
  return all(
    env,
    `SELECT f.feature_key, f.module_key, hf.enabled, hf.config_json
       FROM hotel_features hf
       JOIN features f ON f.feature_key = hf.feature_key
      WHERE hf.hotel_id = ?
        AND hf.enabled = 1
        AND f.status = 'active'
        AND f.is_public = 1
      ORDER BY f.feature_key`,
    [hotelId],
  );
}

export async function isFeatureEnabled(env, hotelId, featureKey) {
  const row = await first(
    env,
    `SELECT hf.enabled
       FROM hotel_features hf
       JOIN features f ON f.feature_key = hf.feature_key
      WHERE hf.hotel_id = ?
        AND hf.feature_key = ?
        AND hf.enabled = 1
        AND f.status = 'active'
      LIMIT 1`,
    [hotelId, featureKey],
  );
  return Boolean(row?.enabled);
}
