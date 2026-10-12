import { Router } from 'express';
import * as controller from '../controllers/message.controller';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/async';
import {
  attachmentConfirmSchema,
  attachmentUploadSchema,
  editSchema,
  listSchema,
  messagesSchema,
  mutedSchema,
  sendSchema,
  startSchema,
  stickerUploadSchema,
} from '../validators/message.validator';

// Mounted at /api/v1 (D71, D73): one-to-one direct messages. Signed in only;
// there is nothing public about a conversation. Group channels are a separate
// thing.
const router = Router();

// A short-lived, single-use ticket to open the realtime socket (D72). Browsers
// never hold a token, so the socket cannot be opened with one.
router.post('/me/realtime-ticket', requireAuth, asyncHandler(controller.realtimeTicket));

router.get('/me/conversations', requireAuth, validate(listSchema, 'query'), asyncHandler(controller.list));
router.get('/me/conversations/unread', requireAuth, asyncHandler(controller.unread));
router.post('/conversations', requireAuth, validate(startSchema), asyncHandler(controller.start));
router.get('/hashers/:id/can-message', requireAuth, asyncHandler(controller.canMessage));

router.get('/conversations/:id', requireAuth, asyncHandler(controller.get));
router.get('/conversations/:id/messages', requireAuth, validate(messagesSchema, 'query'), asyncHandler(controller.messages));
router.post('/conversations/:id/messages', requireAuth, validate(sendSchema), asyncHandler(controller.send));
router.post('/conversations/:id/read', requireAuth, asyncHandler(controller.read));
router.post('/conversations/:id/accept', requireAuth, asyncHandler(controller.accept));
router.post('/conversations/:id/decline', requireAuth, asyncHandler(controller.decline));
router.put('/conversations/:id/mute', requireAuth, validate(mutedSchema), asyncHandler(controller.mute));
router.post('/conversations/:id/archive', requireAuth, asyncHandler(controller.archive));

// Editing inside the two-minute window (D73). There is no unsend.
router.patch('/messages/:id', requireAuth, validate(editSchema), asyncHandler(controller.edit));

// Photos, clips and voice notes: ask for a target, PUT the bytes, confirm.
router.post('/conversations/:id/uploads', requireAuth, validate(attachmentUploadSchema), asyncHandler(controller.requestUpload));
router.post('/dm-uploads/:id/confirm', requireAuth, validate(attachmentConfirmSchema), asyncHandler(controller.confirmUpload));

// Stickers: made from a picture, favourited, sent.
router.get('/me/stickers', requireAuth, asyncHandler(controller.listStickers));
router.post('/me/stickers', requireAuth, validate(stickerUploadSchema), asyncHandler(controller.requestStickerUpload));
router.post('/me/stickers/:id/confirm', requireAuth, asyncHandler(controller.confirmSticker));
router.delete('/me/stickers/:id', requireAuth, asyncHandler(controller.deleteSticker));
router.put('/me/stickers/:id/favorite', requireAuth, asyncHandler(controller.favoriteSticker));
router.delete('/me/stickers/:id/favorite', requireAuth, asyncHandler(controller.unfavoriteSticker));

export default router;
