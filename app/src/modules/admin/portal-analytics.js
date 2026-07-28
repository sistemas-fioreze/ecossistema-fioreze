import { all, first } from "../../core/database.js";
import { badRequest } from "../../core/errors.js";
import { requestNow } from "../../core/time.js";
import { optionalString } from "../../core/validation.js";
import { requireAdminHotelAccess, requirePermission } from "../../services/admin-auth.js";

const ANALYTICS_PERMISSION = "portals.links.analytics";

export async function getAdminPortalAnalytics({ request, env, session, url }) {
  requirePermission(session, ANALYTICS_PERMISSION);
  const hotelId = optionalString(url.searchParams.get("hotel_id"), "hotel_id", { max: 80 }) || session.hotel_ids[0];
  requireAdminHotelAccess(session, hotelId);
  const period = analyticsPeriod(url, requestNow({ request, env }));
  const regionSearch = optionalString(url.searchParams.get("region"), "region", { max: 80 }).toLowerCase();
  const regionLike = regionSearch ? `%${regionSearch}%` : null;
  const params = [hotelId, period.from, period.to, regionLike, regionLike];
  const where = `hotel_id = ?
    AND visit_date BETWEEN ? AND ?
    AND (? IS NULL OR lower(coalesce(region, '')) LIKE ?)`;

  const [summary, dailyRows, pageRows, locationRows, hourlyRows, recentRows] = await Promise.all([
    first(
      env,
      `SELECT COUNT(DISTINCT visitor_hash) AS unique_visitors,
              coalesce(SUM(visit_count), 0) AS total_visits,
              MIN(first_visited_at) AS first_visit_at,
              MAX(last_visited_at) AS last_visit_at
         FROM portal_visit_visitors
        WHERE ${where}`,
      params,
    ),
    all(
      env,
      `SELECT visit_date,
              COUNT(DISTINCT visitor_hash) AS unique_visitors,
              coalesce(SUM(visit_count), 0) AS total_visits
         FROM portal_visit_visitors
        WHERE ${where}
        GROUP BY visit_date
        ORDER BY visit_date`,
      params,
    ),
    all(
      env,
      `SELECT page_key,
              COUNT(DISTINCT visitor_hash) AS unique_visitors,
              coalesce(SUM(visit_count), 0) AS total_visits,
              MAX(last_visited_at) AS last_visit_at
         FROM portal_visit_visitors
        WHERE ${where}
        GROUP BY page_key
        ORDER BY unique_visitors DESC, total_visits DESC, page_key`,
      params,
    ),
    all(
      env,
      `SELECT coalesce(country_code, 'Nao informado') AS country_code,
              coalesce(region, 'Nao informado') AS region,
              COUNT(DISTINCT visitor_hash) AS unique_visitors,
              coalesce(SUM(visit_count), 0) AS total_visits
         FROM portal_visit_visitors
        WHERE ${where}
        GROUP BY coalesce(country_code, 'Nao informado'), coalesce(region, 'Nao informado')
        ORDER BY unique_visitors DESC, total_visits DESC
        LIMIT 20`,
      params,
    ),
    all(
      env,
      `SELECT substr(first_visited_at, 12, 2) AS hour,
              COUNT(DISTINCT visitor_hash) AS unique_visitors,
              coalesce(SUM(visit_count), 0) AS total_visits
         FROM portal_visit_visitors
        WHERE ${where}
        GROUP BY substr(first_visited_at, 12, 2)
        ORDER BY hour`,
      params,
    ),
    all(
      env,
      `SELECT visit_date, page_key, country_code, region,
              MIN(first_visited_at) AS first_visit_at,
              MAX(last_visited_at) AS last_visit_at,
              COUNT(DISTINCT visitor_hash) AS unique_visitors,
              coalesce(SUM(visit_count), 0) AS total_visits
         FROM portal_visit_visitors
        WHERE ${where}
        GROUP BY visit_date, page_key, country_code, region
        ORDER BY last_visit_at DESC
        LIMIT 30`,
      params,
    ),
  ]);

  const uniqueVisitors = Number(summary?.unique_visitors || 0);
  const totalVisits = Number(summary?.total_visits || 0);
  return {
    analytics: {
      hotel_id: hotelId,
      period,
      unique_visitors: uniqueVisitors,
      total_visits: totalVisits,
      repeated_visits: Math.max(0, totalVisits - uniqueVisitors),
      first_visit_at: summary?.first_visit_at || null,
      last_visit_at: summary?.last_visit_at || null,
      daily: dailyRows.map(numberPortalRow),
      pages: pageRows.map(numberPortalRow),
      locations: locationRows.map(numberPortalRow),
      hourly: hourlyRows.map(numberPortalRow),
      recent: recentRows.map(numberPortalRow),
    },
  };
}

function analyticsPeriod(url, nowIso) {
  const to = dateParameter(url.searchParams.get("to"), "to") || nowIso.slice(0, 10);
  const fromDefault = new Date(`${to}T00:00:00.000Z`);
  fromDefault.setUTCDate(fromDefault.getUTCDate() - 29);
  const from = dateParameter(url.searchParams.get("from"), "from") || fromDefault.toISOString().slice(0, 10);
  if (from > to) throw badRequest("O início do período deve ser anterior ao fim.");
  const rangeDays = Math.floor((Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / 86400000);
  if (rangeDays > 365) throw badRequest("O período máximo para consulta é de 366 dias.");
  return { from, to };
}

function dateParameter(value, label) {
  if (value == null || value === "") return "";
  const normalized = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized) || Number.isNaN(Date.parse(`${normalized}T00:00:00.000Z`))) {
    throw badRequest(`${label} deve ser uma data válida.`);
  }
  return normalized;
}

function numberPortalRow(row) {
  return {
    ...row,
    unique_visitors: Number(row.unique_visitors || 0),
    total_visits: Number(row.total_visits || 0),
  };
}
