import assert from 'node:assert/strict';
import test from 'node:test';

import { validateRuntimeConfig } from './env';

test('production config rejects resend.dev sender domains', () => {
  assert.throws(
    () =>
      validateRuntimeConfig({
        isProduction: true,
        appBaseUrl: 'https://shiggytrails.com',
        email: {
          from: 'Shiggy Trails <onboarding@resend.dev>',
          configured: true,
          apiKey: 'test-key',
        },
        r2: {
          configured: true,
          publicBaseUrl: 'https://media.shiggytrails.com',
        },
      }),
    /EMAIL_FROM cannot use a Resend dev sender in production/i,
  );
});

test('production config accepts verified custom-domain sender and media URL', () => {
  assert.doesNotThrow(() =>
    validateRuntimeConfig({
      isProduction: true,
      appBaseUrl: 'https://shiggytrails.com',
      email: {
        from: 'Shiggy Trails <onboarding@shiggytrails.com>',
        configured: true,
        apiKey: 'test-key',
      },
      r2: {
        configured: true,
        publicBaseUrl: 'https://media.shiggytrails.com',
      },
    }),
  );
});
