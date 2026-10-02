const DEFAULT_OPTION_LABELS = {
  selection: "Sabor",
};

export function normalizePdvOptionDefinitions(options = []) {
  if (!Array.isArray(options)) return [];
  const keys = new Set();
  return options.map((option) => {
    const key = String(option?.key || "").trim();
    const values = [...new Set((Array.isArray(option?.values) ? option.values : [])
      .map((value) => String(value || "").trim())
      .filter(Boolean))];
    if (!key || keys.has(key) || !values.length) return null;
    keys.add(key);
    return {
      key,
      label: String(option?.label || DEFAULT_OPTION_LABELS[key] || "Escolha uma opção").trim(),
      required: option?.required !== false,
      values,
    };
  }).filter(Boolean);
}

export function validatePdvSelectedOptions(definitions = [], selectedOptions = {}) {
  const options = normalizePdvOptionDefinitions(definitions);
  const selected = selectedOptions && typeof selectedOptions === "object" && !Array.isArray(selectedOptions)
    ? selectedOptions
    : {};
  const allowedKeys = new Set(options.map((option) => option.key));
  if (Object.keys(selected).some((key) => !allowedKeys.has(key))) {
    throw new Error("A opção selecionada não pertence a este item.");
  }

  const normalized = {};
  for (const option of options) {
    const value = String(selected[option.key] || "").trim();
    if (option.required && !value) throw new Error(`${option.label} é obrigatório.`);
    if (value && !option.values.includes(value)) throw new Error(`Seleção inválida para ${option.label.toLowerCase()}.`);
    if (value) normalized[option.key] = value;
  }
  return normalized;
}

export function createPdvCartLineKey(productId, selectedOptions = {}) {
  const base = String(productId || "").trim();
  const optionKey = Object.entries(selectedOptions)
    .filter(([, value]) => String(value || "").trim())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value).trim())}`)
    .join("&");
  return optionKey ? `${base}::${optionKey}` : base;
}

export function describePdvSelectedOptions(selectedOptions = {}, definitions = []) {
  const labels = new Map(normalizePdvOptionDefinitions(definitions).map((option) => [option.key, option.label]));
  return Object.entries(selectedOptions || {})
    .filter(([, value]) => value != null && String(value).trim())
    .map(([key, value]) => ({
      label: summarizeOptionLabel(labels.get(key) || DEFAULT_OPTION_LABELS[key] || humanizeOptionKey(key)),
      value: String(value).trim(),
    }));
}

export function describeOrderItemOptions(snapshot = {}) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return [];
  const rows = [];
  const selections = snapshot.selections;
  if (Array.isArray(selections)) {
    selections.forEach((selection) => {
      if (!selection || typeof selection !== "object") return;
      const value = selection.option_name || selection.option || selection.value;
      if (!value) return;
      rows.push({
        label: String(selection.group_name || selection.group || selection.name || "Opção"),
        value: String(value),
      });
    });
  } else if (selections && typeof selections === "object") {
    rows.push(...describePdvSelectedOptions(selections));
  } else {
    rows.push(...describePdvSelectedOptions(Object.fromEntries(
      Object.entries(snapshot).filter(([key]) => !["note", "notes", "selections"].includes(key)),
    )));
  }
  const note = snapshot.note || snapshot.notes;
  if (note) rows.push({ label: "Observação", value: String(note) });
  return rows;
}

export function buildPdvOrderItems(lines = []) {
  return [...lines].map((line) => {
    const selectedOptions = validatePdvSelectedOptions(line.item?.options, line.selected_options);
    return {
      catalog_item_id: line.item.id,
      quantity: line.quantity,
      unit_price_cents: line.item.price_cents,
      ...(Object.keys(selectedOptions).length ? { selected_options: selectedOptions } : {}),
    };
  });
}

function humanizeOptionKey(key) {
  const value = String(key || "opção").replaceAll("_", " ").trim();
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : "Opção";
}

function summarizeOptionLabel(label) {
  const value = String(label || "Opção").replace(/^Escolha\s+(?:o|a|um|uma)\s+/i, "").trim();
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : "Opção";
}
