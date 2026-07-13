const DAY_LABELS = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
const WEEKDAY_TO_INDEX = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function evaluateServiceStatus({ serviceHours = [], timezone = "America/Sao_Paulo", operationMode = "automatic", now = new Date() }) {
  const local = getLocalClock(now, timezone);
  const currentMinutes = local.hour * 60 + local.minute;
  const previousDay = (local.day_of_week + 6) % 7;
  const activeSlots = serviceHours.filter((slot) => !slot.is_closed && slot.opens_at && slot.closes_at);

  const openSlot = activeSlots.find((slot) => {
    const start = clockToMinutes(slot.opens_at);
    const end = clockToMinutes(slot.closes_at);
    if (start === end && slot.day_of_week === local.day_of_week) return true;
    if (start < end) return slot.day_of_week === local.day_of_week && currentMinutes >= start && currentMinutes < end;
    if (slot.day_of_week === local.day_of_week && currentMinutes >= start) return true;
    return slot.day_of_week === previousDay && currentMinutes < end;
  });

  const todaySlots = activeSlots
    .filter((slot) => slot.day_of_week === local.day_of_week)
    .sort((a, b) => clockToMinutes(a.opens_at) - clockToMinutes(b.opens_at));

  const mode = ["forced_open", "forced_closed"].includes(operationMode) ? operationMode : "automatic";
  const scheduleOpen = Boolean(openSlot);
  return {
    open: mode === "forced_open" || (mode === "automatic" && scheduleOpen),
    schedule_open: scheduleOpen,
    mode,
    source: mode === "automatic" ? "schedule" : "manual_override",
    active_slot: openSlot || null,
    local,
    today_slots: todaySlots,
    today_text: describeToday(todaySlots),
    next_opening: findNextOpening(activeSlots, local.day_of_week, currentMinutes),
  };
}

export function describeServiceStatus(status) {
  if (status.open) {
    return {
      label: status.mode === "forced_open" ? "Aberto manualmente" : "Aberto agora",
      detail: status.mode === "forced_open"
        ? "A unidade liberou pedidos manualmente."
        : status.active_slot
        ? `Pedidos ate ${status.active_slot.closes_at}.`
        : "Pedidos disponiveis agora.",
    };
  }
  return {
    label: status.mode === "forced_closed" ? "Fechado manualmente" : "Fechado agora",
    detail: status.mode === "forced_closed"
      ? "A unidade pausou novos pedidos temporariamente."
      : status.next_opening
      ? `Proxima abertura: ${status.next_opening.label}.`
      : "Pedidos indisponiveis no momento.",
  };
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

function describeToday(slots) {
  if (!slots.length) return "Hoje nao ha horario configurado para pedidos.";
  return `Hoje: ${slots.map((slot) => `${slot.opens_at} as ${slot.closes_at}`).join(" e ")}.`;
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
        const prefix = offset === 0 ? "hoje" : DAY_LABELS[day];
        return { day_of_week: day, opens_at: slot.opens_at, label: `${prefix} as ${slot.opens_at}` };
      }
    }
  }
  return null;
}
