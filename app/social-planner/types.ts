export type StoryStatus = "idea" | "to_produce" | "producing" | "approval" | "ready" | "scheduled" | "published" | "cancelled";
export type StoryFormat = "photo" | "video" | "repost" | "art" | "text" | "boomerang" | "other";
export type StoryObjective = "engagement" | "relationship" | "conversion" | "information" | "institutional" | "traffic" | "promotion";
export type Priority = "low" | "normal" | "high" | "urgent";
export interface Hotel { id: string; name: string; short_name: string; instagram_username: string; active: number; sort_order: number }
export interface Category { id: string; name: string; active: number; sort_order: number }
export interface ContentPillar extends Category {}
export interface User { id: string; name: string }
export interface Campaign { id: string; name: string; description: string | null; start_date: string | null; end_date: string | null; status: string; story_count: number; published_count: number; hotel_count: number }
export interface StorySequence { id: string; title: string; description: string | null; story_count: number }
export interface Story {
  id: string; hotel_id: string; date: string; planned_time: string | null; sort_order: number;
  title: string; description: string | null; story_text: string | null;
  category_id: string | null; content_pillar_id: string | null; format: StoryFormat | null;
  objective: StoryObjective | null; status: StoryStatus; priority: Priority;
  cta: string | null; link: string | null; responsible_user_id: string | null;
  campaign_id: string | null; media_asset_id: string | null; asset_url: string | null;
  asset_type: string | null; thumbnail_url: string | null;
  sequence_group_id: string | null; sequence_position: number | null; sequence_title: string | null;
  notes: string | null; published_at: string | null; published_url: string | null;
  responsible_name: string | null; created_at: string; updated_at: string;
}
export type StoryInput = Partial<Omit<Story, "id" | "created_at" | "updated_at" | "asset_url" | "asset_type" | "thumbnail_url" | "responsible_name" | "sequence_title">>;
export interface StoryFilters { hotel_id: string; status: string; category_id: string; responsible_user_id: string; campaign_id: string; search: string }
