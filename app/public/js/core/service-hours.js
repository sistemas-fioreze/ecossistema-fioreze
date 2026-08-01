const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function formatRoomServiceHours(serviceHours = []) {
  const active = serviceHours
    .filter((slot) => !slot.is_closed && slot.opens_at && slot.closes_at)
    .sort((a, b) => Number(a.day_of_week) - Number(b.day_of_week) || String(a.opens_at).localeCompare(String(b.opens_at)));
  const days = new Map();

  for (const slot of active) {
    const day = Number(slot.day_of_week);
    if (!Number.isInteger(day) || day < 0 || day > 6) continue;
    if (!days.has(day)) days.set(day, []);
    days.get(day).push(`${formatTime(slot.opens_at)} às ${formatTime(slot.closes_at)}`);
  }

  const commonWindow = [...new Set(days.get(0) || [])]
    .find((window) => Array.from({ length: 7 }, (_, day) => days.get(day)?.includes(window)).every(Boolean));
  if (commonWindow) return `O Room Service opera diariamente das ${commonWindow}.`;

  if (days.size) {
    const schedule = [...days.entries()]
      .map(([day, windows]) => `${DAY_NAMES[day]} ${windows.join(" e ")}`)
      .join(" · ");
    return `Horários do Room Service: ${schedule}.`;
  }

  return "Consulte a recepção para confirmar o horário de funcionamento do Room Service.";
}

function formatTime(value) {
  return String(value || "").slice(0, 5);
}
