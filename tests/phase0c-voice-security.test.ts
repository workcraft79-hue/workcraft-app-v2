import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

// Ensure test harness runs strictly offline with no Neon/Redis/Gemini connections
delete process.env.DATABASE_URL;
delete process.env.POSTGRES_URL;
delete process.env.STAGING_DATABASE_URL;
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;
delete process.env.KV_REST_API_URL;
delete process.env.KV_REST_API_TOKEN;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'phase0c-voice-security-test-jwt-secret-32b';
process.env.GEMINI_API_KEY = '';

import { createApiApp } from '../server/app.js';
import vercelIndexHandler from '../server/vercelIndex.js';
import { SESSION_COOKIE_NAME, signSessionToken } from '../server/security.js';
import type { AuthUser } from '../src/types/auth.js';

const FOUNDER_USER: AuthUser = {
  userId: 'usr-founder-voice-test',
  userRole: 'FOUNDER',
  displayName: 'Founder Test',
  email: 'founder@workcraft.local',
  phone: '+923000000001',
  salonId: null,
  agentId: null,
};

const OWNER_USER: AuthUser = {
  userId: 'usr-owner-voice-test',
  userRole: 'SALON_OWNER',
  displayName: 'Owner Voice Test',
  email: 'owner@workcraft.local',
  phone: '+923001112233',
  salonId: '1',
  allowedSalonIds: ['1'],
  agentId: null,
};

const AGENT_USER: AuthUser = {
  userId: 'usr-agent-voice-test',
  userRole: 'AGENT',
  displayName: 'Agent Voice Test',
  email: 'agent@workcraft.local',
  phone: '+923002223344',
  salonId: null,
  agentId: 'agent-pk-1',
};

function backupDataFiles() {
  const dataDir = path.join(process.cwd(), '.data');
  const files = ['voice-inbox.json', 'ops-ledger.json', 'concierge-store.json'];
  const backups = new Map<string, string | null>();
  for (const name of files) {
    const full = path.join(dataDir, name);
    backups.set(full, fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : null);
  }
  return () => {
    for (const [full, content] of backups.entries()) {
      if (content !== null) {
        fs.writeFileSync(full, content, 'utf8');
      } else if (fs.existsSync(full)) {
        fs.unlinkSync(full);
      }
    }
  };
}

test('1. vercel.json routes /api/translate-voice through /api/index and standalone handler/bundle are removed', () => {
  const vercelJson = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'vercel.json'), 'utf8')
  ) as { rewrites?: Array<{ source: string; destination: string }> };

  const rewrites = vercelJson.rewrites || [];
  assert.equal(
    rewrites.some((r) => r.source === '/api/translate-voice'),
    false,
    'vercel.json must not bypass /api/(.*) with a standalone /api/translate-voice rewrite'
  );
  assert.equal(
    rewrites.some(
      (r) => r.source === '/api/(.*)' && r.destination === '/api/index?__wc_path=$1'
    ),
    true,
    'vercel.json must route all /api/* requests through /api/index?__wc_path=$1'
  );

  assert.equal(
    fs.existsSync(path.join(process.cwd(), 'server', 'vercelTranslateVoice.ts')),
    false,
    'Retired unauthenticated server/vercelTranslateVoice.ts must be deleted'
  );
  assert.equal(
    fs.existsSync(path.join(process.cwd(), 'api', 'translate-voice.mjs')),
    false,
    'Stale unauthenticated api/translate-voice.mjs bundle must be deleted'
  );
});

test('2. Vercel index rewrite path enforces 401 auth on /api/translate-voice', async () => {
  const restoreFiles = backupDataFiles();
  const server = http.createServer((req, res) => {
    vercelIndexHandler(req, res);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));

  try {
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const res = await fetch(`${baseUrl}/api/index?__wc_path=translate-voice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Test unauthenticated bypass', targetLocale: 'ur-PK' }),
    });
    assert.equal(res.status, 401);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    restoreFiles();
  }
});

test('3. /api/translate-voice enforces auth, role RBAC, same-origin CSRF, fail-closed prod config, validation, and rate limits', async () => {
  const restoreFiles = backupDataFiles();
  const app = createApiApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));

  const prevNodeEnv = process.env.NODE_ENV;
  const prevJwtSecret = process.env.JWT_SECRET;
  const prevDbUrl = process.env.DATABASE_URL;

  try {
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const hostHeader = `127.0.0.1:${address.port}`;

    // A. Unauthenticated caller -> 401
    const unauthRes = await fetch(`${baseUrl}/api/translate-voice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Hello', targetLocale: 'ur-PK' }),
    });
    assert.equal(unauthRes.status, 401);

    // B. AGENT role -> 403 Forbidden (only FOUNDER and SALON_OWNER are authorized)
    const agentJwt = signSessionToken(AGENT_USER);
    const agentRes = await fetch(`${baseUrl}/api/translate-voice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${agentJwt}`,
      },
      body: JSON.stringify({ text: 'Agent should be blocked', targetLocale: 'ur-PK' }),
    });
    assert.equal(agentRes.status, 403);

    // C. Cookie-authenticated SALON_OWNER with mismatched Origin -> 403 CSRF rejection
    const ownerJwt = signSessionToken(OWNER_USER);
    const csrfRes = await fetch(`${baseUrl}/api/translate-voice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(ownerJwt)}`,
        Origin: 'https://evil-attacker.example',
        Host: hostHeader,
      },
      body: JSON.stringify({ text: 'Cross-origin attempt', targetLocale: 'en-US' }),
    });
    assert.equal(csrfRes.status, 403);

    // D. Fail closed (503) in production when JWT_SECRET is missing or short
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgres://offline-check:5432/workcraft_test';
    process.env.JWT_SECRET = 'short';
    const prodMissingJwtRes = await fetch(`${baseUrl}/api/translate-voice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerJwt}`,
      },
      body: JSON.stringify({ text: 'Prod check', targetLocale: 'en-US' }),
    });
    assert.equal(prodMissingJwtRes.status, 503);

    // E. Fail closed (503) in production when Redis rate limiter is unconfigured even with valid JWT
    process.env.JWT_SECRET = prevJwtSecret;
    const prodMissingRedisRes = await fetch(`${baseUrl}/api/translate-voice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerJwt}`,
      },
      body: JSON.stringify({ text: 'Prod limiter check', targetLocale: 'en-US' }),
    });
    assert.equal(prodMissingRedisRes.status, 503);

    // Restore non-production test env for deterministic local checks
    process.env.NODE_ENV = 'test';
    delete process.env.DATABASE_URL;

    // F. Input validation & clean error codes (never turns malformed JSON or >3MB audio into 500)
    const malformedJsonRes = await fetch(`${baseUrl}/api/translate-voice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerJwt}`,
      },
      body: '{not-valid-json',
    });
    assert.equal(malformedJsonRes.status, 400);

    const emptyPayloadRes = await fetch(`${baseUrl}/api/translate-voice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerJwt}`,
      },
      body: JSON.stringify({ text: '   ' }),
    });
    assert.equal(emptyPayloadRes.status, 400);

    const oversizedAudioRes = await fetch(`${baseUrl}/api/translate-voice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerJwt}`,
      },
      body: JSON.stringify({
        audioBase64: 'A'.repeat(3 * 1024 * 1024 + 8),
      }),
    });
    assert.equal(oversizedAudioRes.status, 413);

    // G. Authorized SALON_OWNER text request succeeds (sanitizing HTML/script tags)
    const okRes = await fetch(`${baseUrl}/api/translate-voice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerJwt}`,
      },
      body: JSON.stringify({
        text: '<script>alert(1)</script>Please confirm 4pm booking',
        targetLocale: 'en-US',
      }),
    });
    assert.equal(okRes.status, 200);
    const okBody = (await okRes.json()) as { transcript?: string; translatedText?: string };
    assert.equal(okBody.transcript, 'Please confirm 4pm booking');
    assert.equal(okBody.translatedText, 'Please confirm 4pm booking');

    // H. Rate limit enforcement (>30 requests within 300s window returns 429 + Retry-After)
    // Uses audio-only payload with GEMINI_API_KEY='' so each iteration completes deterministically offline without TTS socket waits
    const founderJwt = signSessionToken(FOUNDER_USER);
    let saw429 = false;
    let retryAfterHeader = '';
    for (let i = 0; i < 32; i++) {
      const rlRes = await fetch(`${baseUrl}/api/translate-voice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${founderJwt}`,
        },
        body: JSON.stringify({
          audioBase64: 'UklGRg==',
          audioMimeType: 'audio/webm',
          targetLocale: 'ur-PK',
        }),
      });
      if (rlRes.status === 429) {
        saw429 = true;
        retryAfterHeader = rlRes.headers.get('retry-after') || '';
        break;
      }
      assert.equal(rlRes.status, 503);
    }
    assert.equal(saw429, true, 'Expected 429 after exceeding 30 requests in window');
    assert.ok(Number(retryAfterHeader) > 0, 'Expected positive Retry-After header on 429 response');
  } finally {
    process.env.NODE_ENV = prevNodeEnv;
    process.env.JWT_SECRET = prevJwtSecret;
    if (prevDbUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = prevDbUrl;
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
    restoreFiles();
  }
});
