import type { StoryStatus } from "./types";
export const statusLabels: Record<StoryStatus, string> = {
  idea: "Ideia", to_produce: "A produzir", producing: "Em produção", approval: "Aguardando aprovação",
  ready: "Pronto", scheduled: "Programado", published: "Publicado", cancelled: "Cancelado",
};
export const formatLabels = { photo: "Foto", video: "Vídeo", repost: "Repost", art: "Arte", text: "Texto", boomerang: "Boomerang", other: "Outro" };
export const objectiveLabels = { engagement: "Engajamento", relationship: "Relacionamento", conversion: "Conversão", information: "Informação", institutional: "Institucional", traffic: "Tráfego", promotion: "Divulgação" };
export const priorityLabels = { low: "Baixa", normal: "Normal", high: "Alta", urgent: "Urgente" };
export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] || char);
}
export function isoDate(date: Date): string { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
export function fromIso(value: string): Date { const [year, month, day] = value.split("-").map(Number); return new Date(year, month - 1, day); }
export function addDays(value: string, amount: number): string { const date = fromIso(value); date.setDate(date.getDate() + amount); return isoDate(date); }
export function weekStart(value: string): string { const date = fromIso(value); date.setDate(date.getDate() - (date.getDay() + 6) % 7); return isoDate(date); }
export function dateLabel(value: string, options: Intl.DateTimeFormatOptions): string { return new Intl.DateTimeFormat("pt-BR", options).format(fromIso(value)); }
export function option(value: string, label: string, selected = ""): string { return `<option value="${escapeHtml(value)}" ${value === selected ? "selected" : ""}>${escapeHtml(label)}</option>`; }
