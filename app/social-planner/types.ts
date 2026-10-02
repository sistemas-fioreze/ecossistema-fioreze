export type StoryStatus = "idea" | "to_produce" | "producing" | "approval" | "ready" | "scheduled" | "published" | "cancelled";
export type StoryFormat = "photo" | "video" | "repost" | "art" | "text" | "boomerang" | "other";
export type StoryObjective = "engagement" | "relationship" | "conversion" | "information" | "institutional" | "traffic" | "promotion";
export type Priority = "low" | "normal" | "high" | "urgent";
export interface Hotel { id: string; name: string; short_name: string; instagram_username: string; active: number; sort_order: number }
export interface Category { id: string; name: string; active: number; sort_order: number }
export interface ContentPillar extends Category {}
export interface User { id: string; name: string }
export interface SocialChannel { id: string; platform_key: string; platform_name: string; placement_key: string; display_name: string; sort_order: number }
export interface StoryChannel { channel_id: string; platform_key: string; platform_name: string; placement_key: string; display_name: string; source_channel_id: string | null; adapted_text: string | null; planned_at: string | null; status: StoryStatus; published_at: string | null; published_url: string | null }
export interface Campaign { id: string; name: string; description: string | null; start_date: string | null; end_date: string | null; status: string; story_count: number; published_count: number; visit_count: number; article_count: number; hotel_count: number }
export interface StorySequence { id: string; title: string; description: string | null; story_count: number }
export interface Story {
  id: string; hotel_id: string; date: string; planned_time: string | null; sort_order: number;
  title: string; description: string | null; story_text: string | null;
  category_id: string | null; content_pillar_id: string | null; format: StoryFormat | null;
  objective: StoryObjective | null; status: StoryStatus; priority: Priority;
  cta: string | null; link: string | null; responsible_user_id: string | null;
  campaign_id: string | null; media_asset_id: string | null; asset_url: string | null;
  asset_type: string | null; thumbnail_url: string | null;
  sequence_group_id: string | null; sequence_position: number | null; sequence_title: string | null; source_visit_id: string | null;
  notes: string | null; published_at: string | null; published_url: string | null;
  channels?: StoryChannel[]; channel_names?: string | null; channel_ids?: string | null;
  responsible_name: string | null; created_at: string; updated_at: string;
}
export type StoryChannelInput = Pick<StoryChannel, "channel_id" | "source_channel_id" | "adapted_text" | "planned_at" | "status" | "published_at" | "published_url">;
export type StoryInput = Partial<Omit<Story, "id" | "created_at" | "updated_at" | "asset_url" | "asset_type" | "thumbnail_url" | "responsible_name" | "sequence_title">>;
export interface StoryFilters { hotel_id: string; status: string; category_id: string; responsible_user_id: string; campaign_id: string; search: string }
export type VisitStatus = "planned" | "confirmed" | "in_progress" | "completed" | "cancelled";
export interface VisitItem { id: string; visit_id: string; title: string; description: string | null; content_type: string | null; category_id: string | null; required: number; completed: number; sort_order: number }
export interface Visit { id: string; hotel_id: string; hotel_name: string; date: string; start_time: string | null; end_time: string | null; title: string; description: string | null; responsible_user_id: string | null; responsible_user_ids: string[]; responsible_name: string | null; responsible_names: string | null; assignees?: User[]; status: VisitStatus; priority: Priority; campaign_id: string | null; notes: string | null; completed_at: string | null; item_count: number; completed_item_count: number; items?: VisitItem[]; media_assets?: { id: string; public_url: string; mime_type: string; alt_text: string | null }[]; stories?: { id: string; title: string; date: string; status: StoryStatus }[]; calendar_events?: { planner_user_id: string; user_name: string; sync_status: string; last_synced_at: string | null; last_error: string | null }[]; created_at: string; updated_at: string }
export type VisitInput = Partial<Pick<Visit, "hotel_id" | "date" | "start_time" | "end_time" | "title" | "description" | "responsible_user_id" | "responsible_user_ids" | "status" | "priority" | "campaign_id" | "notes" | "completed_at">>;
export interface CalendarConnectionStatus { provider: "google"; configured: boolean; connected: boolean; connection: { account_email: string | null; calendar_id: string; status: string; connected_at: string; updated_at: string; last_sync_at: string | null; last_error: string | null } | null }
export interface AsanaConnectionStatus { provider: "asana"; configured: boolean; connected: boolean; can_manage_tasks: boolean; connection: { account_name: string | null; account_email: string | null; workspace_gid: string | null; workspace_name: string | null; status: string; connected_at: string; updated_at: string; last_sync_at: string | null; last_error: string | null } | null }
export interface AsanaWorkspace { gid: string; name: string }
export interface AsanaProject { gid: string; name: string; permalink_url?: string | null }
export interface AsanaUnitMapping { hotel_id: string; hotel_name: string; expected_project_name: string; project_gid: string | null; project_name: string | null; match_status: "matched" | "missing" | "unavailable" }
export interface AsanaSetup extends AsanaConnectionStatus { workspaces: AsanaWorkspace[]; projects: AsanaProject[]; units: AsanaUnitMapping[]; error?: string }
export interface AsanaTask { gid: string; name: string; completed: boolean; start_date: string | null; end_date: string | null; due_at: string | null; has_start_date: boolean; permalink_url: string | null; assignee_name: string | null; section_name: string | null; hotel_id: string; hotel_name: string; project_gid: string; project_name: string }
export interface AsanaTaskDetail extends AsanaTask { notes: string; completed_at: string | null; start_on: string | null; due_on: string | null; modified_at: string | null; assignee_gid: string | null }
export type AsanaTaskInput = Partial<Pick<AsanaTaskDetail, "name" | "notes" | "completed" | "start_on" | "due_on">>;
export type BlogStatus = "idea" | "briefing" | "writing" | "review" | "ready" | "scheduled" | "published" | "archived";
export interface BlogPost { id: string; title: string; slug: string; summary: string | null; briefing: string | null; category_id: string | null; hotel_id: string | null; hotel_name: string | null; campaign_id: string | null; author_user_id: string | null; author_name: string | null; main_keyword: string | null; secondary_keywords: string | null; meta_description: string | null; planned_publish_date: string | null; status: BlogStatus; published_at: string | null; published_url: string | null; notes: string | null; created_at: string; updated_at: string }
export type BlogInput = Partial<Pick<BlogPost, "title" | "slug" | "summary" | "briefing" | "category_id" | "hotel_id" | "campaign_id" | "author_user_id" | "main_keyword" | "secondary_keywords" | "meta_description" | "planned_publish_date" | "status" | "published_at" | "published_url" | "notes">>;
