const WEEKDAY_TO_INDEX = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function assertRoomServiceOpen({ request, env, tenant, moduleKey = "room-service" }) {
  const hours = tenant.service_hours?.[moduleKey] || [];
  const now = getRequestDate(request, env);
  const status = evaluateServiceHours({
    serviceHours: hours,
    timezone: tenant.timezone || "America/Sao_Paulo",
    now,
  });

  return status;
}

export function evaluateServiceHours({ serviceHours = [], timezone = "America/Sao_Paulo", now = new Date() }) {
  const local = getLocalClock(now, timezone);
  const currentMinutes = local.hour * 60 + local.minute;
  const previousDay = (local.day_of_week + 6) % 7;
  const activeSlots = serviceHours.filter((slot) => !slot.is_closed && slot.opens_at && slot.closes_at);

  const activeSlot = activeSlots.find((slot) => {
    const start = clockToMinutes(slot.opens_at);
    const end = clockToMinutes(slot.closes_at);
    if (start === end && slot.day_of_week === local.day_of_week) return true;
    if (start < end) return slot.day_of_week === local.day_of_week && currentMinutes >= start && currentMinutes < end;
    if (slot.day_of_week === local.day_of_week && currentMinutes >= start) return true;
    return slot.day_of_week === previousDay && currentMinutes < end;
  });

  return {
    open: Boolean(activeSlot),
    active_slot: activeSlot || null,
    local,
    next_opening: findNextOpening(activeSlots, local.day_of_week, currentMinutes),
  };
}

export function getRequestDate(request, env) {
  const injected = request.headers.get("X-Fioreze-Test-Now");
  if (injected && String(env.ENVIRONMENT || "development") !== "production") {
    const date = new Date(injected);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return new Date();
}

export function getLocalClock(date, timezone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type) => parts.find((entry) => entry.type === type)?.value;
  return {
    day_of_week: WEEKDAY_TO_INDEX[part("weekday")] ?? date.getUTCDay(),
    hour: Number(part("hour") || 0),
    minute: Number(part("minute") || 0),
  };
}

export function clockToMinutes(value) {
  const [hour, minute] = String(value || "00:00").split(":").map((part) => Number.parseInt(part, 10) || 0);
  return Math.max(0, Math.min(23, hour)) * 60 + Math.max(0, Math.min(59, minute));
}

function findNextOpening(slots, currentDay, currentMinutes) {
  for (let offset = 0; offset <= 7; offset += 1) {
    const day = (currentDay + offset) % 7;
    const daySlots = slots
      .filter((slot) => slot.day_of_week === day)
      .sort((a, b) => clockToMinutes(a.opens_at) - clockToMinutes(b.opens_at));
    for (const slot of daySlots) {
      const start = clockToMinutes(slot.opens_at);
      if (offset > 0 || currentMinutes < start) {
        return { day_of_week: day, opens_at: slot.opens_at };
      }
    }
  }
  return null;
}
