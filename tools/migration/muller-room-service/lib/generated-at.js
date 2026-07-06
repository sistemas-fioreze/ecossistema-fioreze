const ISO_UTC_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/;

export function normalizeGeneratedAtArg(rawValue, { required = false } = {}) {
  const missing = rawValue == null || rawValue === false;
  if (missing) {
    if (required) throw new Error("Informe --generated-at=<ISO-8601 UTC> ao gerar SQL executavel com --before-state.");
    return {
      generatedAt: new Date().toISOString(),
      generatedAtSource: "automatic-local",
      generatedAtExplicit: false,
    };
  }

  const value = Array.isArray(rawValue) ? rawValue.at(-1) : rawValue;
  if (value === true || String(value).trim() === "") {
    throw new Error("Valor de --generated-at invalido. Use um timestamp ISO-8601 UTC, por exemplo 2026-07-06T20:00:00.000Z.");
  }

  return {
    generatedAt: normalizeIsoUtcTimestamp(String(value)),
    generatedAtSource: "explicit-cli",
    generatedAtExplicit: true,
  };
}

export function normalizeIsoUtcTimestamp(value) {
  const match = ISO_UTC_PATTERN.exec(String(value).trim());
  if (!match) {
    throw new Error("Valor de --generated-at invalido. Use ISO-8601 UTC com hora completa e timezone UTC.");
  }

  const [, yearText, monthText, dayText, hourText, minuteText, secondText, , fractionText, timezone] = match;
  if (timezone !== "Z" && timezone !== "+00:00" && timezone !== "-00:00") {
    throw new Error("Valor de --generated-at deve representar UTC; offsets diferentes de zero nao sao aceitos.");
  }

  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const millisecond = fractionText ? Number(fractionText.padEnd(3, "0")) : 0;
  const timestamp = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  const date = new Date(timestamp);

  if (
    !Number.isFinite(timestamp) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    date.getUTCHours() !== hour ||
    date.getUTCMinutes() !== minute ||
    date.getUTCSeconds() !== second ||
    date.getUTCMilliseconds() !== millisecond
  ) {
    throw new Error("Valor de --generated-at invalido. A data UTC informada nao existe.");
  }

  return date.toISOString();
}
