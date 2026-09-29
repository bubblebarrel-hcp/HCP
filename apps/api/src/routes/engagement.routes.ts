import { Router } from 'express';
import * as controller from '../controllers/engagement.controller';
import { optionalAuth, requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/async';
import {
  addCommentSchema,
  bookmarkSchema,
  bookmarksQuery,
  commentsQuery,
  editCommentSchema,
  listQuery,
  removeCommentSchema,
  reshareSchema,
  subjectParams,
} from '../validators/engagement.validator';

// Mounted at /api/v1. Likes, comments, reshares, bookmarks and views (D50).
//
// One set of routes for every kind of content, addressed as
// `/engagement/:subject/:id` where `:subject` is `reels`, `reports`, `photos`,
// `runs`, `capsules` or `comments`. The alternative — the same six verbs bolted
// onto each of five routers — is five chances to get trail secrecy wrong.
//
// Reading is signed-out-friendly throughout; every act needs a session.
const router = Router();

const subject = validate(subjectParams, 'params');

router.get('/engagement/:subject/:id', optionalAuth, subject, asyncHandler(controller.get));

router.post('/engagement/:subject/:id/like', requireAuth, subject, asyncHandler(controller.like));
router.delete('/engagement/:subject/:id/like', requireAuth, subject, asyncHandler(controller.unlike));
router.get(
  '/engagement/:subject/:id/likes',
  optionalAuth,
  subject,
  validate(listQuery, 'query'),
  asyncHandler(controller.likes),
);

// A bookmark is private, so there is no list of who saved something.
router.post(
  '/engagement/:subject/:id/bookmark',
  requireAuth,
  subject,
  validate(bookmarkSchema),
  asyncHandler(controller.bookmark),
);
router.delete('/engagement/:subject/:id/bookmark', requireAuth, subject, asyncHandler(controller.unbookmark));

router.post(
  '/engagement/:subject/:id/reshare',
  requireAuth,
  subject,
  validate(reshareSchema),
  asyncHandler(controller.reshare),
);
router.delete('/engagement/:subject/:id/reshare', requireAuth, subject, asyncHandler(controller.unreshare));
router.get(
  '/engagement/:subject/:id/reshares',
  optionalAuth,
  subject,
  validate(listQuery, 'query'),
  asyncHandler(controller.reshares),
);

router.get(
  '/engagement/:subject/:id/comments',
  optionalAuth,
  subject,
  validate(commentsQuery, 'query'),
  asyncHandler(controller.comments),
);
router.post(
  '/engagement/:subject/:id/comments',
  requireAuth,
  subject,
  validate(addCommentSchema),
  asyncHandler(controller.addComment),
);

// A view of something you cannot see is not a view, so this resolves the
// subject like everything else. Signed out counts as an anonymous open.
router.post('/engagement/:subject/:id/views', optionalAuth, subject, asyncHandler(controller.countView));

// Comments are addressed by their own id once they exist, because a reply
// thread does not need to restate what it hangs from.
router.get('/comments/:commentId/replies', optionalAuth, validate(listQuery, 'query'), asyncHandler(controller.replies));
router.patch('/comments/:commentId', requireAuth, validate(editCommentSchema), asyncHandler(controller.editComment));
router.delete('/comments/:commentId', requireAuth, asyncHandler(controller.deleteComment));
// Moderation: the kennel's media moderators, or platform staff for content that
// belongs to no kennel — the same division reels use.
router.post(
  '/comments/:commentId/remove',
  requireAuth,
  validate(removeCommentSchema),
  asyncHandler(controller.removeComment),
);

router.get('/me/bookmarks', requireAuth, validate(bookmarksQuery, 'query'), asyncHandler(controller.myBookmarks));

export default router;
