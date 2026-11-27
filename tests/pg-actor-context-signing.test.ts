import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import type { Pool, PoolClient } from 'pg';

import {
  createPublicFlowLookupActor,
  setPgPoolOverrideForTests,
  withPgTransaction,
} from '../server/postgresRepo.js';

function makeCapturePool(calls: Array<{ sql: string; params?: unknown[] }>): Pool {
  const client = {
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ sql: String(sql), params });
      return { rows: [], rowCount: 0 };
    },
    release: () => undefined,
  };
  return {
    connect: async () => client as unknown as PoolClient,
  } as unknown as Pool;
}

test('PostgreSQL transactions attach a signed actor envelope and all public-flow scopes', async () => {
  const previousSecret = process.env.PG_ACTOR_CONTEXT_SECRET;
  const secret = crypto.randomBytes(32).toString('hex');
  process.env.PG_ACTOR_CONTEXT_SECRET = secret;
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  setPgPoolOverrideForTests(makeCapturePool(calls));

  try {
    await withPgTransaction(createPublicFlowLookupActor(), async () => undefined);
    const contextCall = calls.find((call) => call.sql.includes('app.actor_context_payload'));
    assert.ok(contextCall, 'transaction must write the signed actor envelope');
    assert.equal(contextCall.params?.length, 12);

    const payload = String(contextCall.params?.[4] || '');
    const signature = String(contextCall.params?.[5] || '');
    const expected = crypto.createHmac('sha256', Buffer.from(secret, 'hex')).update(payload, 'utf8').digest('hex');
    assert.equal(signature, expected, 'actor signature must match the exact serialized payload');

    const claims = JSON.parse(payload) as Record<string, unknown>;
    assert.equal(claims.v, 1);
    assert.equal(claims.kid, 'v1');
    assert.equal(claims.role, 'PUBLIC_FLOW');
    assert.equal(claims.salonId, '');
    assert.equal(claims.userId, '');
    assert.equal(claims.agentId, '');
    assert.equal(typeof claims.exp, 'number');
    assert.equal(typeof claims.iat, 'number');
    assert.equal(typeof claims.nonce, 'string');

    const forgedPayload = payload.replace('"role":"PUBLIC_FLOW"', '"role":"FOUNDER"');
    const forgedExpected = crypto.createHmac('sha256', Buffer.from(secret, 'hex')).update(forgedPayload, 'utf8').digest('hex');
    assert.notEqual(forgedExpected, signature, 'changing a role claim must invalidate the signature');
  } finally {
    setPgPoolOverrideForTests(null);
    if (previousSecret === undefined) delete process.env.PG_ACTOR_CONTEXT_SECRET;
    else process.env.PG_ACTOR_CONTEXT_SECRET = previousSecret;
  }
});

test('PostgreSQL transactions fail closed when the RLS signing secret is missing', async () => {
  const previousSecret = process.env.PG_ACTOR_CONTEXT_SECRET;
  delete process.env.PG_ACTOR_CONTEXT_SECRET;
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  setPgPoolOverrideForTests(makeCapturePool(calls));

  try {
    await assert.rejects(
      withPgTransaction(createPublicFlowLookupActor(), async () => undefined),
      /PG_ACTOR_CONTEXT_SECRET/
    );
    assert.ok(calls.some((call) => call.sql === 'ROLLBACK'));
  } finally {
    setPgPoolOverrideForTests(null);
    if (previousSecret !== undefined) process.env.PG_ACTOR_CONTEXT_SECRET = previousSecret;
  }
});
