import { request, uploadRequest } from "./repository";
import type { AsanaSetup, AsanaTask, AsanaTaskDetail, AsanaTaskInput, BlogInput, BlogPost, CalendarConnectionStatus, Visit, VisitInput, VisitItem } from "./types";

function range(path: string, start?: string, end?: string, filters: Record<string, string> = {}) {
  const query = new URLSearchParams();
  if (start && end) { query.set("start_date", start); query.set("end_date", end); }
  for (const [key, value] of Object.entries(filters)) if (value && value !== "all") query.set(key, value);
  return `${path}${query.size ? `?${query}` : ""}`;
}
export const marketingRepository = {
  settings: () => request<{ display_name: string }>("/settings"),
  saveSettings: (display_name: string) => request<{ display_name: string }>("/settings", "PATCH", { display_name }),
  visits: (start: string, end: string, filters: Record<string, string> = {}) => request<Visit[]>(range("/visits", start, end, filters)),
  visit: (id: string) => request<Visit>(`/visits/${encodeURIComponent(id)}`),
  createVisit: (input: VisitInput) => request<Visit>("/visits", "POST", input),
  updateVisit: (id: string, input: VisitInput) => request<Visit>(`/visits/${encodeURIComponent(id)}`, "PATCH", input),
  deleteVisit: (id: string) => request(`/visits/${encodeURIComponent(id)}`, "DELETE"),
  createItem: (visitId: string, input: Partial<VisitItem>) => request<VisitItem>(`/visits/${encodeURIComponent(visitId)}/items`, "POST", input),
  updateItem: (visitId: string, id: string, input: Partial<VisitItem>) => request<VisitItem>(`/visits/${encodeURIComponent(visitId)}/items/${encodeURIComponent(id)}`, "PATCH", input),
  deleteItem: (visitId: string, id: string) => request(`/visits/${encodeURIComponent(visitId)}/items/${encodeURIComponent(id)}`, "DELETE"),
  linkMedia: (visitId: string, media_asset_id: string) => request<Visit>(`/visits/${encodeURIComponent(visitId)}/media`, "POST", { media_asset_id }),
  unlinkMedia: (visitId: string, mediaId: string) => request(`/visits/${encodeURIComponent(visitId)}/media/${encodeURIComponent(mediaId)}`, "DELETE"),
  calendarStatus: () => request<CalendarConnectionStatus>("/calendar/status"),
  connectCalendar: () => request<{ authorization_url: string; expires_at: string }>("/calendar/google/connect", "POST", {}),
  disconnectCalendar: () => request<{ disconnected: boolean }>("/calendar/google/connection", "DELETE"),
  syncVisitCalendar: (visitId: string) => request<{ configured: boolean; synced: number; failed: number; skipped: number }>(`/visits/${encodeURIComponent(visitId)}/calendar-sync`, "POST", {}),
  asanaSetup: () => request<AsanaSetup>("/asana/setup"),
  connectAsana: () => request<{ authorization_url: string; expires_at: string }>("/asana/connect", "POST", {}),
  disconnectAsana: () => request<{ disconnected: boolean }>("/asana/connection", "DELETE"),
  selectAsanaWorkspace: (workspace_gid: string) => request<AsanaSetup>("/asana/workspace", "PATCH", { workspace_gid }),
  saveAsanaProjects: (mappings: { hotel_id: string; project_gid: string | null }[]) => request<AsanaSetup>("/asana/projects", "PATCH", { mappings }),
  asanaTasks: (start: string, end: string, hotelId = "all") => request<AsanaTask[]>(range("/asana/tasks", start, end, { hotel_id: hotelId })),
  asanaTask: (id: string) => request<AsanaTaskDetail>(`/asana/tasks/${encodeURIComponent(id)}`),
  updateAsanaTask: (id: string, input: AsanaTaskInput) => request<AsanaTaskDetail>(`/asana/tasks/${encodeURIComponent(id)}`, "PATCH", input),
  posts: (start?: string, end?: string, filters: Record<string, string> = {}) => request<BlogPost[]>(range("/blog-posts", start, end, filters)),
  post: (id: string) => request<BlogPost>(`/blog-posts/${encodeURIComponent(id)}`),
  createPost: (input: BlogInput) => request<BlogPost>("/blog-posts", "POST", input),
  updatePost: (id: string, input: BlogInput) => request<BlogPost>(`/blog-posts/${encodeURIComponent(id)}`, "PATCH", input),
  deletePost: (id: string) => request(`/blog-posts/${encodeURIComponent(id)}`, "DELETE"),
  uploadPostDocument: (id: string, file: File) => { const body = new FormData(); body.set("file", file); return uploadRequest<BlogPost>(`/blog-posts/${encodeURIComponent(id)}/document`, body); },
  removePostDocument: (id: string) => request<BlogPost>(`/blog-posts/${encodeURIComponent(id)}/document`, "DELETE"),
};
