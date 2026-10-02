import { assertAdminMutationAllowed } from "../../services/admin-auth.js";
import {
  createSocialPlannerUser,
  getCurrentSocialPlannerSession,
  listSocialPlannerUsers,
  loginSocialPlanner,
  logoutSocialPlanner,
  requireSocialPlannerPermission,
  resetSocialPlannerUserPassword,
  SOCIAL_PLANNER_PERMISSIONS,
  toSocialPlannerSessionPayload,
  updateSocialPlannerUser,
} from "../../services/social-planner-auth.js";
import { readJson } from "../../core/validation.js";
import { ok } from "../../core/responses.js";
import {
  createSequence, deleteStory, duplicateSequence, getStory, listCampaigns, listCategories, listHotels,
  listChannels, listPillars, listPlannerMedia, listSequences, listStories, listUsers, moveSequence, saveCampaign,
  saveStory, saveStoryChannels,
} from "./repository.js";
import {
  deletePost, deleteVisit, deleteVisitItem, getPost, getSettings, getVisit,
  linkVisitMedia, listPosts, listVisits, savePost, saveSettings, saveVisit,
  saveVisitItem, unlinkVisitMedia,
} from "./marketing-repository.js";
import {
  completeGoogleCalendarConnection, disconnectGoogleCalendar, getCalendarConnectionStatus,
  removeVisitCalendarEvents, startGoogleCalendarConnection, syncVisitCalendars,
} from "../../services/social-planner-calendar.js";
import {
  completeAsanaConnection, disconnectAsana, getAsanaConnectionStatus, getAsanaSetup,
  listAsanaCalendarTasks, saveAsanaProjectMappings, selectAsanaWorkspace, startAsanaConnection,
} from "../../services/social-planner-asana.js";

const base = "/api/v1/social-planner";

export function registerSocialPlannerRoutes(router) {
  router.post(`${base}/login`, async ({ request, env }) => {
    const { session, headers } = await loginSocialPlanner({ request, env });
    return ok(toSocialPlannerSessionPayload(session), { headers });
  });
  router.post(`${base}/logout`, async ({ request, env }) => {
    const { headers } = await logoutSocialPlanner({ request, env });
    return ok({ logged_out: true }, { headers });
  });
  router.get(`${base}/session`, async ({ request, env }) => {
    const session = await getCurrentSocialPlannerSession({ request, env });
    return ok(toSocialPlannerSessionPayload(session));
  });

  const read = (handler) => async (context) => {
    const session = await getCurrentSocialPlannerSession(context);
    requireSocialPlannerPermission(session, SOCIAL_PLANNER_PERMISSIONS.read);
    return ok(await handler({ ...context, session }));
  };
  const write = (handler, status = 200) => async (context) => {
    const session = await getCurrentSocialPlannerSession(context);
    requireSocialPlannerPermission(session, SOCIAL_PLANNER_PERMISSIONS.write);
    assertAdminMutationAllowed(context);
    return ok(await handler({ ...context, session }), { status });
  };
  const accountWrite = (handler) => async (context) => {
    const session = await getCurrentSocialPlannerSession(context);
    requireSocialPlannerPermission(session, SOCIAL_PLANNER_PERMISSIONS.read);
    assertAdminMutationAllowed(context);
    return ok(await handler({ ...context, session }));
  };

  router.get(`${base}/hotels`, read(({ env }) => listHotels(env)));
  router.get(`${base}/categories`, read(({ env }) => listCategories(env)));
  router.get(`${base}/pillars`, read(({ env }) => listPillars(env)));
  router.get(`${base}/channels`, read(({ env }) => listChannels(env)));
  router.get(`${base}/users`, read(({ env }) => listUsers(env)));
  router.get(`${base}/user-management`, read(({ env, session }) => listSocialPlannerUsers({ env, session })));
  router.post(`${base}/user-management`, write(({ request, env, session }) => createSocialPlannerUser({ request, env, session }), 201));
  router.patch(`${base}/user-management/:id`, write(({ request, env, session, params }) => updateSocialPlannerUser({ request, env, session, userId: params.id })));
  router.patch(`${base}/user-management/:id/password`, write(({ request, env, session, params }) => resetSocialPlannerUserPassword({ request, env, session, userId: params.id })));
  router.get(`${base}/campaigns`, read(({ env }) => listCampaigns(env)));
  router.get(`${base}/media`, read(({ env, url }) => listPlannerMedia(env, url.searchParams.get("hotel_id"))));
  router.post(`${base}/campaigns`, write(async ({ env, request }) => saveCampaign(env, await readJson(request)), 201));
  router.patch(`${base}/campaigns/:id`, write(async ({ env, request, params }) => saveCampaign(env, await readJson(request), params.id)));
  router.get(`${base}/sequences`, read(({ env }) => listSequences(env)));
  router.post(`${base}/sequences`, write(async ({ env, request }) => createSequence(env, await readJson(request)), 201));
  router.patch(`${base}/sequences/:id/move`, write(async ({ env, request, params }) => moveSequence(env, params.id, await readJson(request))));
  router.post(`${base}/sequences/:id/duplicate`, write(({ env, params }) => duplicateSequence(env, params.id), 201));
  router.get(`${base}/stories`, read(({ env, url }) => listStories(env, url.searchParams)));
  router.get(`${base}/stories/:id`, read(({ env, params }) => getStory(env, params.id)));
  router.post(`${base}/stories`, write(async ({ env, request }) => saveStory(env, await readJson(request)), 201));
  router.patch(`${base}/stories/:id`, write(async ({ env, request, params }) => saveStory(env, await readJson(request), params.id)));
  router.patch(`${base}/stories/:id/channels`, write(async ({ env, request, params }) => saveStoryChannels(env, params.id, (await readJson(request)).channels)));
  router.delete(`${base}/stories/:id`, write(({ env, params }) => deleteStory(env, params.id)));
  router.get(`${base}/settings`, read(({ env }) => getSettings(env)));
  router.patch(`${base}/settings`, write(async ({ env, request }) => saveSettings(env, await readJson(request))));
  router.get(`${base}/visits`, read(({ env, url }) => listVisits(env, url.searchParams)));
  router.get(`${base}/visits/:id`, read(({ env, params }) => getVisit(env, params.id)));
  router.post(`${base}/visits`, write(async ({ env, request, ctx }) => {
    const visit = await saveVisit(env, await readJson(request));
    ctx?.waitUntil(syncVisitCalendars({ env, visitId: visit.id }));
    return visit;
  }, 201));
  router.patch(`${base}/visits/:id`, write(async ({ env, request, params, ctx }) => {
    const visit = await saveVisit(env, await readJson(request), params.id);
    ctx?.waitUntil(syncVisitCalendars({ env, visitId: visit.id }));
    return visit;
  }));
  router.delete(`${base}/visits/:id`, write(async ({ env, params }) => {
    await removeVisitCalendarEvents({ env, visitId: params.id });
    return deleteVisit(env, params.id);
  }));
  router.post(`${base}/visits/:id/calendar-sync`, write(({ env, params }) => syncVisitCalendars({ env, visitId: params.id })));
  router.post(`${base}/visits/:id/items`, write(async ({ env, request, params }) => saveVisitItem(env, params.id, await readJson(request)), 201));
  router.patch(`${base}/visits/:id/items/:itemId`, write(async ({ env, request, params }) => saveVisitItem(env, params.id, await readJson(request), params.itemId)));
  router.delete(`${base}/visits/:id/items/:itemId`, write(({ env, params }) => deleteVisitItem(env, params.id, params.itemId)));
  router.post(`${base}/visits/:id/media`, write(async ({ env, request, params }) => linkVisitMedia(env, params.id, (await readJson(request)).media_asset_id), 201));
  router.delete(`${base}/visits/:id/media/:mediaId`, write(({ env, params }) => unlinkVisitMedia(env, params.id, params.mediaId)));
  router.get(`${base}/blog-posts`, read(({ env, url }) => listPosts(env, url.searchParams)));
  router.get(`${base}/blog-posts/:id`, read(({ env, params }) => getPost(env, params.id)));
  router.post(`${base}/blog-posts`, write(async ({ env, request }) => savePost(env, await readJson(request)), 201));
  router.patch(`${base}/blog-posts/:id`, write(async ({ env, request, params }) => savePost(env, await readJson(request), params.id)));
  router.delete(`${base}/blog-posts/:id`, write(({ env, params }) => deletePost(env, params.id)));

  router.get(`${base}/calendar/status`, read(({ env, session }) => getCalendarConnectionStatus({ env, session })));
  router.post(`${base}/calendar/google/connect`, accountWrite(({ request, env, session }) => startGoogleCalendarConnection({ request, env, session })));
  router.get(`${base}/calendar/google/callback`, async ({ request, env }) => {
    const session = await getCurrentSocialPlannerSession({ request, env });
    requireSocialPlannerPermission(session, SOCIAL_PLANNER_PERMISSIONS.read);
    const origin = new URL(request.url).origin;
    try {
      await completeGoogleCalendarConnection({ request, env, session });
      return Response.redirect(`${origin}/socialplanner/settings?calendar=connected`, 302);
    } catch {
      return Response.redirect(`${origin}/socialplanner/settings?calendar=error`, 302);
    }
  });
  router.delete(`${base}/calendar/google/connection`, accountWrite(({ env, session }) => disconnectGoogleCalendar({ env, session })));

  router.get(`${base}/asana/status`, read(({ env, session }) => getAsanaConnectionStatus({ env, session })));
  router.get(`${base}/asana/setup`, read(({ env, session }) => getAsanaSetup({ env, session })));
  router.get(`${base}/asana/tasks`, read(({ env, session, url }) => listAsanaCalendarTasks({ env, session, searchParams: url.searchParams })));
  router.post(`${base}/asana/connect`, accountWrite(({ request, env, session }) => startAsanaConnection({ request, env, session })));
  router.get(`${base}/asana/callback`, async ({ request, env }) => {
    const session = await getCurrentSocialPlannerSession({ request, env });
    requireSocialPlannerPermission(session, SOCIAL_PLANNER_PERMISSIONS.read);
    const origin = new URL(request.url).origin;
    try {
      await completeAsanaConnection({ request, env, session });
      return Response.redirect(`${origin}/socialplanner/asana-calendar?asana=connected`, 302);
    } catch {
      return Response.redirect(`${origin}/socialplanner/asana-calendar?asana=error`, 302);
    }
  });
  router.patch(`${base}/asana/workspace`, accountWrite(async ({ request, env, session }) => selectAsanaWorkspace({ env, session, input: await readJson(request) })));
  router.patch(`${base}/asana/projects`, accountWrite(async ({ request, env, session }) => saveAsanaProjectMappings({ env, session, input: await readJson(request) })));
  router.delete(`${base}/asana/connection`, accountWrite(({ env, session }) => disconnectAsana({ env, session })));
}
