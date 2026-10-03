import type { Campaign, Category, ContentPillar, Hotel, SocialChannel, Story, StoryChannelInput, StoryFilters, StoryInput, StorySequence, User } from "./types";

export interface StoryRepository {
  hotels(): Promise<Hotel[]>; categories(): Promise<Category[]>; pillars(): Promise<ContentPillar[]>;
  channels(): Promise<SocialChannel[]>;
  users(): Promise<User[]>; campaigns(): Promise<Campaign[]>; sequences(): Promise<StorySequence[]>;
  stories(start: string, end: string, filters: StoryFilters): Promise<Story[]>;
  story(id: string): Promise<Story>;
  create(input: StoryInput): Promise<Story>; update(id: string, input: StoryInput): Promise<Story>; remove(id: string): Promise<void>;
  saveChannels(id: string, channels: StoryChannelInput[]): Promise<Story>;
  createCampaign(input: Partial<Campaign>): Promise<Campaign>; updateCampaign(id: string, input: Partial<Campaign>): Promise<Campaign>;
  createSequence(title: string): Promise<StorySequence>; moveSequence(id: string, hotel_id: string, date: string): Promise<void>;
  duplicateSequence(id: string): Promise<{ sequence: StorySequence; stories: Story[] }>;
}

const base = "/api/v1/social-planner";
export async function request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(`${base}${path}`, {
    method, credentials: "same-origin",
    headers: { accept: "application/json", ...(body ? { "content-type": "application/json" } : {}), ...(method !== "GET" ? { "x-fioreze-admin-action": "erp-admin" } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.ok) throw new Error(payload.error?.message || "Não foi possível concluir a operação.");
  return payload.data as T;
}

export async function uploadRequest<T>(path: string, body: FormData): Promise<T> {
  const response = await fetch(`${base}${path}`, {
    method: "POST", credentials: "same-origin",
    headers: { accept: "application/json", "x-fioreze-admin-action": "erp-admin" }, body,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.ok) throw new Error(payload.error?.message || "Não foi possível enviar o arquivo.");
  return payload.data as T;
}

export const apiStoryRepository: StoryRepository = {
  hotels: () => request("/hotels"), categories: () => request("/categories"),
  pillars: () => request("/pillars"), channels: () => request("/channels"), users: () => request("/users"),
  campaigns: () => request("/campaigns"), sequences: () => request("/sequences"),
  stories: (start, end, filters) => {
    const params = new URLSearchParams({ start_date: start, end_date: end });
    for (const key of ["hotel_id", "status", "category_id", "responsible_user_id", "campaign_id"] as const) {
      if (filters[key] && filters[key] !== "all") params.set(key, filters[key]);
    }
    return request(`/stories?${params}`);
  },
  story: (id) => request(`/stories/${encodeURIComponent(id)}`),
  create: (input) => request("/stories", "POST", input),
  update: (id, input) => request(`/stories/${encodeURIComponent(id)}`, "PATCH", input),
  remove: (id) => request(`/stories/${encodeURIComponent(id)}`, "DELETE"),
  saveChannels: (id, channels) => request(`/stories/${encodeURIComponent(id)}/channels`, "PATCH", { channels }),
  createCampaign: (input) => request("/campaigns", "POST", input),
  updateCampaign: (id, input) => request(`/campaigns/${encodeURIComponent(id)}`, "PATCH", input),
  createSequence: (title) => request("/sequences", "POST", { title }),
  moveSequence: (id, hotel_id, date) => request(`/sequences/${encodeURIComponent(id)}/move`, "PATCH", { hotel_id, date }),
  duplicateSequence: (id) => request(`/sequences/${encodeURIComponent(id)}/duplicate`, "POST", {}),
};
