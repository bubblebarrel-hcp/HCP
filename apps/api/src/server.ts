import path from 'path';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { env } from './config/env';
import prisma from './config/prisma';
import { logger } from './utils/logger';
import { errorHandler, notFound } from './middleware/error';

import authRoutes from './routes/auth.routes';
import kennelRoutes from './routes/kennel.routes';
import adminRoutes from './routes/admin.routes';
import membershipRoutes from './routes/membership.routes';
import runRoutes from './routes/run.routes';
import trailRoutes from './routes/trail.routes';
import notificationRoutes from './routes/notification.routes';
import passportRoutes from './routes/passport.routes';
import mediaRoutes from './routes/media.routes';
import reportRoutes from './routes/report.routes';
import capsuleRoutes from './routes/capsule.routes';
import officerRoutes from './routes/officer.routes';
import reelRoutes from './routes/reel.routes';
import hareRoutes from './routes/hare.routes';
import postRoutes from './routes/post.routes';
import engagementRoutes from './routes/engagement.routes';
import followRoutes from './routes/follow.routes';
import profileRoutes from './routes/profile.routes';
import invitationRoutes from './routes/invitation.routes';
import searchRoutes from './routes/search.routes';
import { localRoot, storageDriver } from './services/storage.service';
import { startOutbox, stopOutbox } from './services/outbox.service';
import { startReminders, startTrailReleaseSweeper, stopReminders, stopTrailReleaseSweeper } from './services/reminder.service';

const app = express();

app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      // No Origin header: curl, a health probe, the mobile app, or a server-side
      // fetch from a Next app — none of which are browser cross-origin requests.
      if (!origin || env.corsOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`Origin not allowed: ${origin}`));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: '2mb' }));
app.use(
  morgan(env.isProduction ? 'combined' : 'dev', {
    stream: { write: (msg) => logger.http?.(msg.trim()) ?? logger.info(msg.trim()) },
  }),
);

// Health check sits above the rate limiter and needs no auth.
app.get('/api/v1/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.json({ success: true, data: { status: 'ok', database: 'up' } });
  } catch {
    return res
      .status(503)
      .json({ success: false, error: { message: 'Database unreachable', code: 'DB_DOWN' } });
  }
});

app.use(
  '/api/v1/auth',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: env.authRateLimit,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: { message: 'Too many attempts. Try again shortly.', code: 'RATE_LIMITED' },
    },
  }),
);

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/kennels', kennelRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1', membershipRoutes);
// Before runRoutes, or '/runs/needing-hares' is read as a run id (D44).
app.use('/api/v1', hareRoutes);
app.use('/api/v1', runRoutes);
app.use('/api/v1', trailRoutes);
app.use('/api/v1', notificationRoutes);
app.use('/api/v1', passportRoutes);
app.use('/api/v1', mediaRoutes);
app.use('/api/v1', reportRoutes);
app.use('/api/v1', capsuleRoutes);
app.use('/api/v1', officerRoutes);
// Reels and the community feed (D41, D42)
app.use('/api/v1', reelRoutes);
// Likes, comments, reshares, bookmarks, views and the follow graph (D50).
// After the routers that own '/kennels' and '/runs', so a kennel's own routes
// are tried before '/kennels/:slug/follow'.
// A hasher's written post (D51)
app.use('/api/v1', postRoutes);
app.use('/api/v1', engagementRoutes);
app.use('/api/v1', followRoutes);
app.use('/api/v1', profileRoutes);
app.use('/api/v1', invitationRoutes);
// Global search (Annex 08Q). After every router above so a more specific
// route always wins if a path ever collides.
app.use('/api/v1', searchRoutes);

// Local storage driver only: serve what was uploaded to disk. With R2 configured
// media is served from the bucket's own domain instead.
if (storageDriver === 'local') {
  app.use(
    '/uploads',
    express.static(localRoot, {
      maxAge: '1h',
      index: false,
      setHeaders(res) {
        // helmet defaults this to same-origin, which stops the web app on
        // another port from displaying these images. In production media comes
        // from the bucket's own domain and never passes through here.
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      },
    }),
  );
}

// Development only: the heavy seed (prisma/seed-heavy) draws its placeholder
// photos and clips into uploads/seed. When R2 is configured the block above is
// off and nothing else would serve them, and they must never be pushed into
// the real bucket. Only that one folder is exposed, and never in production.
if (storageDriver !== 'local' && !env.isProduction) {
  app.use(
    '/uploads/seed',
    express.static(path.join(localRoot, 'seed'), {
      maxAge: '1h',
      index: false,
      setHeaders(res) {
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      },
    }),
  );
}

app.use(notFound);
app.use(errorHandler);

const server = app.listen(env.port, () => {
  logger.info(`Shiggy Trails API listening on http://localhost:${env.port}/api/v1`);
  // Drains DomainEvent rows into notifications (D26).
  startOutbox();
  // Speaks up about dates nobody is haring (D45).
  startReminders();
  // A scheduled trail release lands even if nobody loads the page (D6/D12).
  startTrailReleaseSweeper();
});

async function shutdown(signal: string) {
  logger.info(`${signal} received — shutting down`);
  stopOutbox();
  stopReminders();
  stopTrailReleaseSweeper();
  server.close(() => {
    prisma.$disconnect().finally(() => process.exit(0));
  });
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

export default app;
