import { Router } from 'express';
import * as controller from '../controllers/report.controller';
import { optionalAuth, requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/async';
import {
  aiDraftDecisionSchema,
  commentSchema,
  contributorSchema,
  createStorySchema,
  listReportsQuery,
  reportActionSchema,
  restoreRevisionSchema,
  reviseSchema,
  startDraftSchema,
  updateDraftSchema,
  updateStorySchema,
} from '../validators/report.validator';

// Mounted at /api/v1. Scribe Studio: the story timeline a run collects, and the
// Trail Report the Scribe shapes from it.
const router = Router();

// The public archive. Anonymous readers see reports of runs they could see.
router.get('/reports', optionalAuth, validate(listReportsQuery, 'query'), asyncHandler(controller.listPublished));
router.get('/reports/:id', optionalAuth, asyncHandler(controller.detail));

// One report per run (BR-SCRIBE-002), so the run is how you find it.
router.get('/runs/:runId/report', optionalAuth, asyncHandler(controller.forRun));
router.post('/runs/:runId/report', requireAuth, validate(startDraftSchema), asyncHandler(controller.startDraft));

router.patch('/reports/:id', requireAuth, validate(updateDraftSchema), asyncHandler(controller.updateDraft));
router.post('/reports/:id/actions/:action', requireAuth, validate(reportActionSchema), asyncHandler(controller.transition));
router.post('/reports/:id/revise', requireAuth, validate(reviseSchema), asyncHandler(controller.revise));
router.post('/reports/:id/ai-draft', requireAuth, asyncHandler(controller.requestAiDraft));
router.post(
  '/reports/:id/ai-draft/:suggestionId/decision',
  requireAuth,
  validate(aiDraftDecisionSchema),
  asyncHandler(controller.decideAiDraft),
);

router.get('/reports/:id/revisions', requireAuth, asyncHandler(controller.listRevisions));
router.get('/reports/:id/revisions/:version', requireAuth, asyncHandler(controller.getRevision));
router.post(
  '/reports/:id/revisions/:version/restore',
  requireAuth,
  validate(restoreRevisionSchema),
  asyncHandler(controller.restoreRevision),
);

router.post('/reports/:id/contributors', requireAuth, validate(contributorSchema), asyncHandler(controller.addContributor));
router.delete('/reports/:id/contributors/:userId/:role', requireAuth, asyncHandler(controller.removeContributor));

router.get('/reports/:id/comments', requireAuth, asyncHandler(controller.listComments));
router.post('/reports/:id/comments', requireAuth, validate(commentSchema), asyncHandler(controller.addComment));
router.post('/reports/:id/comments/:commentId/resolve', requireAuth, asyncHandler(controller.resolveComment));

// Story timeline (FR-STORY-001 to 004).
router.get('/runs/:runId/story', requireAuth, asyncHandler(controller.timeline));
router.post('/runs/:runId/story', requireAuth, validate(createStorySchema), asyncHandler(controller.createStory));
router.patch('/story/:storyId', requireAuth, validate(updateStorySchema), asyncHandler(controller.updateStory));
router.delete('/story/:storyId', requireAuth, asyncHandler(controller.removeStory));

export default router;
