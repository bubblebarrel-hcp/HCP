import dotenv from 'dotenv';

dotenv.config();

// Read and validate every environment variable once, at boot. A misconfigured
// service should fail to start, not fail on the first request that needs the
// value.
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

const nodeEnv = optional('NODE_ENV', 'development');

export function validateRuntimeConfig(config: {
  isProduction: boolean;
  appBaseUrl: string;
  email: { from: string; configured: boolean; apiKey?: string };
  r2: { configured: boolean; publicBaseUrl: string };
}) {
  if (!config.isProduction) return;

  if (!config.appBaseUrl.startsWith('https://')) {
    throw new Error('APP_BASE_URL must use https:// in production.');
  }

  const fromAddress = config.email.from.match(/<([^>]+)>/)?.[1] ?? config.email.from;
  const senderDomain = fromAddress.split('@')[1]?.toLowerCase();

  if (config.email.configured && senderDomain === 'resend.dev') {
    throw new Error(
      'EMAIL_FROM cannot use a Resend dev sender in production. Set a verified domain such as onboarding@shiggytrails.com.',
    );
  }

  if (config.r2.configured && !config.r2.publicBaseUrl) {
    throw new Error('R2_PUBLIC_BASE_URL is required in production when R2 is configured.');
  }

  if (config.r2.publicBaseUrl && !/^https:\/\//i.test(config.r2.publicBaseUrl)) {
    throw new Error('R2_PUBLIC_BASE_URL must use an https:// URL in production.');
  }
}

export const env = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  port: Number(optional('PORT', '5010')),

  databaseUrl: required('DATABASE_URL'),

  jwtAccessSecret: required('JWT_ACCESS_SECRET'),
  jwtRefreshSecret: required('JWT_REFRESH_SECRET'),
  jwtAccessExpiresIn: optional('JWT_ACCESS_EXPIRES_IN', '15m'),
  jwtRefreshExpiresIn: optional('JWT_REFRESH_EXPIRES_IN', '30d'),

  // FR-ID-005. AES-256-GCM key for PersonProfile's most sensitive columns
  // (utils/field-crypto.ts). 32 bytes, hex-encoded (64 hex characters).
  // Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  personEncryptionKey: required('PERSON_ENCRYPTION_KEY'),

  // Comma-separated: web and admin in dev, two real domains in production.
  // Shiggy Trails uses 3010/3011 so it can run alongside other local projects.
  corsOrigins: optional('CORS_ORIGINS', 'http://localhost:3010,http://localhost:3011')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),

  // A production-tight auth limit locks up a local QA pass, where a handful of
  // login attempts is normal and a 429 reads as an auth bug.
  authRateLimit: Number(process.env.AUTH_RATE_LIMIT ?? (nodeEnv === 'production' ? 20 : 1000)),

  logLevel: optional('LOG_LEVEL', nodeEnv === 'production' ? 'info' : 'debug'),

  // Where the web app lives, for links inside emails.
  appBaseUrl: optional('APP_BASE_URL', 'http://localhost:3010'),
  apiBaseUrl: optional('API_BASE_URL', `http://localhost:${optional('PORT', '5010')}`),

  // Cloudflare R2 (S3-compatible). Without these, media falls back to local disk
  // so development works before the bucket exists. See CODEX/PROVIDERS.md.
  r2: {
    accountId: process.env.R2_ACCOUNT_ID ?? '',
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
    bucket: process.env.R2_BUCKET ?? '',
    // The public domain serving the bucket, e.g. https://media.hcp.example
    publicBaseUrl: (process.env.R2_PUBLIC_BASE_URL ?? '').replace(/\/$/, ''),
    configured: Boolean(
      process.env.R2_ACCOUNT_ID &&
        process.env.R2_ACCESS_KEY_ID &&
        process.env.R2_SECRET_ACCESS_KEY &&
        process.env.R2_BUCKET,
    ),
  },

  // Resend. Without a key, notifications stay in-app only and say so.
  email: {
    apiKey: process.env.RESEND_API_KEY ?? '',
    from: optional('EMAIL_FROM', 'Shiggy Trails <onboarding@resend.dev>'),
    replyTo: process.env.EMAIL_REPLY_TO ?? '',
    configured: Boolean(process.env.RESEND_API_KEY),
  },

  media: {
    maxUploadBytes: Number(optional('MEDIA_MAX_BYTES', String(25 * 1024 * 1024))),
  },

  // Expo push (D12). There is no key to obtain: Expo accepts a send from
  // anyone holding a valid push token, so this is on unless it is switched off.
  // EXPO_ACCESS_TOKEN is optional and only matters once "enhanced security" is
  // turned on for the Expo project, which makes an unsigned send fail.
  push: {
    enabled: optional('PUSH_ENABLED', 'true') !== 'false',
    accessToken: process.env.EXPO_ACCESS_TOKEN ?? '',
  },

  // Telling the web app to drop a cached public page. Next's time-based ISR
  // refreshes a page whose data changed, but a page whose data *disappeared*
  // keeps serving its last good render, so an archived kennel stays readable at
  // its old URL until something evicts it explicitly. Without a secret this
  // stays off and public pages fall back to the 60s window.
  revalidate: {
    url: optional('WEB_REVALIDATE_URL', `${optional('APP_BASE_URL', 'http://localhost:3010')}/api/revalidate`),
    secret: process.env.REVALIDATE_SECRET ?? '',
    configured: Boolean(process.env.REVALIDATE_SECRET),
  },

  // Seed credentials, with dev fallbacks so a fresh clone can log in.
  seedAdminEmail: optional('SEED_ADMIN_EMAIL', 'admin@hcp.test'),
  seedAdminPassword: optional('SEED_ADMIN_PASSWORD', 'OnOn2026!'),
  seedUserEmail: optional('SEED_USER_EMAIL', 'hasher@hcp.test'),
  seedUserPassword: optional('SEED_USER_PASSWORD', 'OnOn2026!'),
};

validateRuntimeConfig(env);

export type Env = typeof env;
