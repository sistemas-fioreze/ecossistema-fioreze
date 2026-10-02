import { escapeHtml as e, option } from "./utils";
export function inputField(name: string, label: string, value: unknown, kind: "text" | "date" | "time" | "textarea" | "url" = "text", full = false, required = false): string {
  return `<label class="${full ? "full" : ""}"><span>${label}${required ? " *" : ""}</span>${kind === "textarea" ? `<textarea name="${name}" ${required ? "required" : ""}>${e(value)}</textarea>` : `<input name="${name}" type="${kind}" value="${e(value)}" ${required ? "required" : ""}>`}</label>`;
}
export function selectField(name: string, label: string, value: string | null | undefined, values: { id: string; name: string }[], required = false): string {
  return `<label><span>${label}${required ? " *" : ""}</span><select name="${name}" ${required ? "required" : ""}>${option("", required ? "Selecione" : "Não definido", value || "")}${values.map((item) => option(item.id, item.name, value || "")).join("")}</select></label>`;
}
export function formValues(form: HTMLFormElement, keys: string[]): Record<string, string | null> {
  const data = new FormData(form); const result: Record<string, string | null> = {};
  for (const key of keys) result[key] = String(data.get(key) || "").trim() || null;
  return result;
}
export function heading(eyebrow: string, title: string, subtitle: string, action: string, label: string): string {
  return `<div class="page-heading"><div><p class="eyebrow">${e(eyebrow)}</p><h1>${e(title)}</h1><p class="subtle">${e(subtitle)}</p></div><button class="button primary" data-action="${action}">+ ${e(label)}</button></div>`;
}
