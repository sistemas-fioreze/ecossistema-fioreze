import { requireAuthentication } from "../../middleware/authentication.js";
import { assertAdminMutationAllowed, requirePermission } from "../../services/admin-auth.js";
import { readJson } from "../../core/validation.js";
import { ok } from "../../core/responses.js";
import {
  createSequence, deleteStory, duplicateSequence, getStory, listCampaigns, listCategories, listHotels,
  listPillars, listSequences, listStories, listUsers, moveSequence, saveCampaign, saveStory,
} from "./repository.js";

const base = "/api/v1/admin/social-planner";

export function registerSocialPlannerRoutes(router) {
  const read = (handler) => async (context) => {
    const session = await requireAuthentication(context);
    requirePermission(session, "social-planner.read");
    return ok(await handler(context));
  };
  const write = (handler, status = 200) => async (context) => {
    const session = await requireAuthentication(context);
    requirePermission(session, "social-planner.write");
    assertAdminMutationAllowed(context);
    return ok(await handler(context), { status });
  };

  router.get(`${base}/hotels`, read(({ env }) => listHotels(env)));
  router.get(`${base}/categories`, read(({ env }) => listCategories(env)));
  router.get(`${base}/pillars`, read(({ env }) => listPillars(env)));
  router.get(`${base}/users`, read(({ env }) => listUsers(env)));
  router.get(`${base}/campaigns`, read(({ env }) => listCampaigns(env)));
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
  router.delete(`${base}/stories/:id`, write(({ env, params }) => deleteStory(env, params.id)));
}
