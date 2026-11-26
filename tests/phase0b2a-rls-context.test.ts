import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import type { Pool, PoolClient } from 'pg';

// Ensure test harness runs strictly offline with no Neon/Redis connections
delete process.env.DATABASE_URL;
delete process.env.POSTGRES_URL;
delete process.env.STAGING_DATABASE_URL;
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'phase0b2a-offline-test-jwt-secret-key-32bytes';

import {
  PgContextError,
  applyPgActorContext,
  createPublicFlowLookupActor,
  createPublicFlowSalonActor,
  derivePgActorFromAuthUser,
  findSalonByPublicCodeInPostgres,
  narrowPublicFlowSalonContext,
  persistPostgresSnapshotMirror,
  recordBookingInPostgres,
  setPgPoolOverrideForTests,
  validatePgActorContext,
  withPgTransaction,
} from '../server/postgresRepo.js';
import { setSalonBillingStatus, updateRetentionSettings } from '../server/conciergeEngine.js';
import { createApiApp } from '../server/app.js';
import { signSessionToken } from '../server/security.js';
import type { AuthUser } from '../src/types/auth.js';

interface RecordedQuery {
  text: string;
  params: unknown[];
  activeGucsAtExecution: Record<string, string>;
  activeScopedGucsAtExecution: Record<string, string>;
}

interface MockConnectionState {
  inTransaction: boolean;
  localGucs: Record<string, string>;
  scopedGucs: Record<string, string>;
}

function createMockSingleClientPool(options?: {
  publicLookupSalonId?: string | null;
}) {
  const queries: RecordedQuery[] = [];
  let connectCount = 0;
  let releaseCount = 0;

  const connState: MockConnectionState = {
    inTransaction: false,
    localGucs: {
      'app.current_user_role': '',
      'app.current_salon_id': '',
      'app.current_agent_id': '',
      'app.current_user_id': '',
    },
    scopedGucs: {},
  };

  const resetLocalGucs = () => {
    connState.inTransaction = false;
    connState.localGucs = {
      'app.current_user_role': '',
      'app.current_salon_id': '',
      'app.current_agent_id': '',
      'app.current_user_id': '',
    };
    connState.scopedGucs = {};
  };

  const client = {
    async query(text: string, params: unknown[] = []) {
      const normalizedSql = text.replace(/\s+/g, ' ').trim();
      const snapshotBefore = { ...connState.localGucs };
      const scopedBefore = { ...connState.scopedGucs };

      if (normalizedSql === 'BEGIN') {
        connState.inTransaction = true;
        queries.push({
          text: normalizedSql,
          params,
          activeGucsAtExecution: snapshotBefore,
          activeScopedGucsAtExecution: scopedBefore,
        });
        return { rows: [], rowCount: 0 };
      }

      if (normalizedSql === 'COMMIT' || normalizedSql === 'ROLLBACK') {
        queries.push({
          text: normalizedSql,
          params,
          activeGucsAtExecution: snapshotBefore,
          activeScopedGucsAtExecution: scopedBefore,
        });
        resetLocalGucs();
        return { rows: [], rowCount: 0 };
      }

      if (
        normalizedSql.includes("set_config('app.current_user_role'") &&
        normalizedSql.includes("set_config('app.current_salon_id'") &&
        normalizedSql.includes("set_config('app.current_agent_id'") &&
        normalizedSql.includes("set_config('app.current_user_id'")
      ) {
        assert.equal(
          connState.inTransaction,
          true,
          'set_config(..., true) must execute inside an active transaction'
        );
        connState.localGucs['app.current_user_role'] = String(params[0] ?? '');
        connState.localGucs['app.current_salon_id'] = String(params[1] ?? '');
        connState.localGucs['app.current_agent_id'] = String(params[2] ?? '');
        connState.localGucs['app.current_user_id'] = String(params[3] ?? '');
        queries.push({
          text: normalizedSql,
          params: [...params],
          activeGucsAtExecution: { ...connState.localGucs },
          activeScopedGucsAtExecution: { ...connState.scopedGucs },
        });
        return { rows: [], rowCount: 1 };
      }

      if (normalizedSql.includes("set_config('app.current_")) {
        assert.equal(
          connState.inTransaction,
          true,
          'scoped set_config(..., true) must execute inside an active transaction'
        );
        const matches = [...normalizedSql.matchAll(/set_config\('(app\.current_[a-z_]+)', \$(\d+), true\)/g)];
        for (const m of matches) {
          const idx = Number(m[2]) - 1;
          connState.scopedGucs[m[1]] = String(params[idx] ?? '');
        }
        queries.push({
          text: normalizedSql,
          params: [...params],
          activeGucsAtExecution: { ...connState.localGucs },
          activeScopedGucsAtExecution: { ...connState.scopedGucs },
        });
        return { rows: [], rowCount: 1 };
      }

      queries.push({
        text: normalizedSql,
        params: [...params],
        activeGucsAtExecution: snapshotBefore,
        activeScopedGucsAtExecution: scopedBefore,
      });

      if (normalizedSql.startsWith('SELECT id FROM salons WHERE public_code = $1')) {
        if (
          connState.localGucs['app.current_user_role'] === 'PUBLIC_FLOW' &&
          connState.scopedGucs['app.current_public_code'] !== String(params[0])
        ) {
          return { rows: [], rowCount: 0 };
        }
        if (!options?.publicLookupSalonId) {
          return { rows: [], rowCount: 0 };
        }
        return { rows: [{ id: options.publicLookupSalonId }], rowCount: 1 };
      }

      if (
        normalizedSql.includes('FROM salons') &&
        normalizedSql.includes('WHERE public_code = $1')
      ) {
        if (
          connState.localGucs['app.current_user_role'] === 'PUBLIC_FLOW' &&
          connState.scopedGucs['app.current_public_code'] !== String(params[0])
        ) {
          return { rows: [], rowCount: 0 };
        }
        if (!options?.publicLookupSalonId) {
          return { rows: [], rowCount: 0 };
        }
        return {
          rows: [
            {
              id: options.publicLookupSalonId,
              public_code: String(params[0]),
              salon_name: 'Mock Studio',
              salon_category: 'MENS',
              owner_auth_phone: '+923001112233',
              public_contact_phone: '+923001112233',
              public_whatsapp_phone: null,
              timezone_iana: 'Asia/Karachi',
              timezone_offset_hours: 5,
              currency_code: 'PKR',
              currency_symbol: 'PKR ',
              default_lang: 'en',
              enabled_langs: ['en', 'roman_ur', 'ur'],
              plan_tier: 'PRO++',
              monthly_booking_limit: 3000,
              billing_status: 'ACTIVE',
              whatsapp_addon_enabled: false,
              address: 'Test Blvd',
              google_maps_url: '',
              google_review_url: '',
            },
          ],
          rowCount: 1,
        };
      }

      if (normalizedSql.startsWith('SELECT upsert_public_booking_client(')) {
        connState.scopedGucs['app.current_client_id'] = 'cli-mock-1';
        return { rows: [{ id: 'cli-mock-1' }], rowCount: 1 };
      }
      if (normalizedSql.startsWith('INSERT INTO stylists')) {
        return { rows: [{ id: '00000000-0000-4000-8000-000000000001' }], rowCount: 1 };
      }
      if (normalizedSql.startsWith('SELECT id FROM bookings WHERE salon_id')) {
        return { rows: [], rowCount: 0 };
      }
      if (normalizedSql.startsWith('INSERT INTO bookings')) {
        return { rows: [{ id: String(params[0] || '00000000-0000-4000-8000-000000000002') }], rowCount: 1 };
      }
      if (normalizedSql.startsWith('SELECT increment_salon_monthly_booking_usage(')) {
        return { rows: [{ billable_bookings: 1 }], rowCount: 1 };
      }

      return { rows: [], rowCount: 1 };
    },
    release() {
      releaseCount += 1;
    },
  } as unknown as PoolClient;

  const pool = {
    async connect() {
      connectCount += 1;
      return client;
    },
  } as unknown as Pool;

  return {
    pool,
    client,
    queries,
    getConnectCount: () => connectCount,
    getReleaseCount: () => releaseCount,
    getCurrentGucs: () => ({ ...connState.localGucs }),
  };
}

const FOUNDER_USER: AuthUser = {
  userId: 'usr-founder-1',
  userRole: 'FOUNDER',
  displayName: 'Founder',
  email: 'founder@workcraft.local',
  phone: '+923000000001',
  salonId: null,
  agentId: null,
};

const OWNER_USER: AuthUser = {
  userId: 'usr-salon-1',
  userRole: 'SALON_OWNER',
  displayName: 'Owner 1',
  email: 'owner1@workcraft.local',
  phone: '+923001112233',
  salonId: '1',
  allowedSalonIds: ['1'],
  agentId: null,
};

const AGENT_USER: AuthUser = {
  userId: 'usr-agent-1',
  userRole: 'AGENT',
  displayName: 'Agent 1',
  email: 'agent1@workcraft.local',
  phone: '+923002223344',
  salonId: null,
  agentId: 'agent-pk-1',
};

test.afterEach(() => {
  setPgPoolOverrideForTests(null);
});

test('1. Founder transaction sets exact migration-003 transaction-local GUCs', async () => {
  const mock = createMockSingleClientPool();
  setPgPoolOverrideForTests(mock.pool);

  const actor = derivePgActorFromAuthUser(FOUNDER_USER, { targetSalonId: '1' });
  assert.deepEqual(actor, {
    role: 'FOUNDER',
    salonId: null,
    agentId: null,
    userId: 'usr-founder-1',
  });

  await withPgTransaction(actor, async (client) => {
    await client.query('SELECT id FROM salons LIMIT 1');
  });

  assert.equal(mock.queries.length, 4);
  assert.equal(mock.queries[0].text, 'BEGIN');
  assert.match(mock.queries[1].text, /set_config\('app\.current_user_role', \$1, true\)/);
  assert.deepEqual(mock.queries[1].params, ['FOUNDER', '', '', 'usr-founder-1']);
  assert.equal(mock.queries[2].text, 'SELECT id FROM salons LIMIT 1');
  assert.deepEqual(mock.queries[2].activeGucsAtExecution, {
    'app.current_user_role': 'FOUNDER',
    'app.current_salon_id': '',
    'app.current_agent_id': '',
    'app.current_user_id': 'usr-founder-1',
  });
  assert.equal(mock.queries[3].text, 'COMMIT');
  assert.equal(mock.getReleaseCount(), 1);
});

test('2. Salon Owner derives scoped GUCs, blocks cross-tenant access, and cannot overwrite billing columns', async () => {
  const mock = createMockSingleClientPool();
  setPgPoolOverrideForTests(mock.pool);

  const ownerActor = derivePgActorFromAuthUser(OWNER_USER, { targetSalonId: '1' });
  assert.deepEqual(ownerActor, {
    role: 'SALON_OWNER',
    salonId: '1',
    agentId: null,
    userId: 'usr-salon-1',
  });

  // Cross-tenant derivation fails closed
  assert.throws(
    () => derivePgActorFromAuthUser(OWNER_USER, { targetSalonId: '2' }),
    (err: unknown) => err instanceof PgContextError && err.code === 'FORBIDDEN_TENANT'
  );

  await persistPostgresSnapshotMirror(
    {
      salonId: '1',
      publicCode: 'wc_test_1',
      salonName: 'Owner Updated Salon',
      ownerAuthPhone: '+923001112233',
      publicContactPhone: '+923001112233',
      timezoneIana: 'Asia/Karachi',
      currencyCode: 'PKR',
      currencySymbol: 'PKR ',
      planTier: 'CUSTOM',
      monthlyLimit: 99999,
      billingStatus: 'ACTIVE',
    },
    ownerActor
  );

  const insertQuery = mock.queries.find((q) => q.text.startsWith('INSERT INTO salons'));
  assert.ok(insertQuery, 'Expected INSERT INTO salons query');
  assert.deepEqual(insertQuery.activeGucsAtExecution, {
    'app.current_user_role': 'SALON_OWNER',
    'app.current_salon_id': '1',
    'app.current_agent_id': '',
    'app.current_user_id': 'usr-salon-1',
  });
  // SALON_OWNER ON CONFLICT UPDATE must NOT touch billing_status, package_tier, plan_tier, or monthly_booking_limit
  const conflictClause = insertQuery.text.split('ON CONFLICT (id) DO UPDATE SET')[1] || '';
  assert.equal(conflictClause.includes('billing_status'), false);
  assert.equal(conflictClause.includes('package_tier'), false);
  assert.equal(conflictClause.includes('plan_tier'), false);
  assert.equal(conflictClause.includes('monthly_booking_limit'), false);
  assert.equal(insertQuery.text.includes("'PENDING_ACTIVATION'"), true);
  // Initial INSERT tuple for SALON_OWNER clamps package/plan tier and booking limit to STARTER/750
  assert.equal(insertQuery.params[15], 'STARTER');
  assert.equal(insertQuery.params[16], 750);

  // Cross-tenant persist attempt with valid owner actor for salon '1' targeting salon '2' fails closed before connect
  const connectsBefore = mock.getConnectCount();
  await assert.rejects(
    () =>
      persistPostgresSnapshotMirror(
        {
          salonId: '2',
          publicCode: 'wc_test_2',
          salonName: 'Other Salon',
          ownerAuthPhone: '+923001112233',
          publicContactPhone: '+923001112233',
          timezoneIana: 'Asia/Karachi',
          currencyCode: 'PKR',
          currencySymbol: 'PKR ',
          planTier: 'STARTER',
          monthlyLimit: 750,
          billingStatus: 'ACTIVE',
        },
        ownerActor
      ),
    (err: unknown) => err instanceof PgContextError && err.code === 'FORBIDDEN_TENANT'
  );
  assert.equal(mock.getConnectCount(), connectsBefore);
});

test('3. Agent transaction derives agent GUCs and enforces assigned_agent_id on insert', async () => {
  const mock = createMockSingleClientPool();
  setPgPoolOverrideForTests(mock.pool);

  const agentActor = derivePgActorFromAuthUser(AGENT_USER);
  assert.deepEqual(agentActor, {
    role: 'AGENT',
    salonId: null,
    agentId: 'agent-pk-1',
    userId: 'usr-agent-1',
  });

  await persistPostgresSnapshotMirror(
    {
      salonId: 'salon-agent-new',
      publicCode: 'wc_agent_new',
      salonName: 'Agent Signed Salon',
      ownerAuthPhone: '+923009998877',
      publicContactPhone: '+923009998877',
      timezoneIana: 'Asia/Karachi',
      currencyCode: 'PKR',
      currencySymbol: 'PKR ',
      planTier: 'PRO',
      monthlyLimit: 1500,
      billingStatus: 'ACTIVE',
    },
    agentActor
  );

  const insertQuery = mock.queries.find((q) => q.text.startsWith('INSERT INTO salons'));
  assert.ok(insertQuery);
  assert.deepEqual(insertQuery.activeGucsAtExecution, {
    'app.current_user_role': 'AGENT',
    'app.current_salon_id': '',
    'app.current_agent_id': 'agent-pk-1',
    'app.current_user_id': 'usr-agent-1',
  });
  assert.equal(insertQuery.text.includes('assigned_agent_id'), true);
  assert.equal(insertQuery.text.includes('ON CONFLICT (id) DO NOTHING'), true);
  assert.equal(insertQuery.params[15], 'STARTER');
  assert.equal(insertQuery.params[16], 750);
  assert.equal(insertQuery.params[insertQuery.params.length - 1], 'agent-pk-1');
});

test('4. Public Flow uses lookup context then narrows app.current_salon_id before tenant writes', async () => {
  const mock = createMockSingleClientPool({ publicLookupSalonId: 'salon-public-42' });
  setPgPoolOverrideForTests(mock.pool);

  const found = await findSalonByPublicCodeInPostgres('wc_studio42');
  assert.equal(found?.id, 'salon-public-42');
  const lookupSetConfig = mock.queries[1];
  assert.deepEqual(lookupSetConfig.params, ['PUBLIC_FLOW', '', '', '']);

  mock.queries.length = 0;

  const booked = await recordBookingInPostgres({
    salonPublicCode: 'wc_studio42',
    bookingRef: 'BK-WEB-0042',
    clientName: 'Ali Raza',
    clientPhoneE164: '+923001234567',
    preferredLang: 'en',
    stylistName: 'Ustad Tariq',
    servicesSnapshot: [{ id: 'svc-1', name: 'Haircut', price: 1000, durationMins: 30 }],
    totalPrice: 1000,
    totalDurationMins: 30,
    startsAtIso: '2026-12-01T10:00:00.000Z',
    endsAtIso: '2026-12-01T10:30:00.000Z',
    source: 'WEB_QR',
    idempotencyKey: 'idem-42',
    proofHash: 'hash-42',
    billingMonth: '2026-12',
    monthlyLimit: 3000,
    accessTokenHash: 'tokhash-42',
    accessTokenExpiresAtIso: '2026-12-08T10:30:00.000Z',
  });
  assert.equal(booked.ok, true);

  // Verify initial lookup had empty salon_id, then narrowPublicFlowSalonContext set salon-public-42 before client/booking writes
  const salonLookupQuery = mock.queries.find((q) =>
    q.text.startsWith('SELECT id FROM salons WHERE public_code = $1')
  );
  assert.deepEqual(salonLookupQuery?.activeGucsAtExecution, {
    'app.current_user_role': 'PUBLIC_FLOW',
    'app.current_salon_id': '',
    'app.current_agent_id': '',
    'app.current_user_id': '',
  });
  assert.equal(salonLookupQuery?.activeScopedGucsAtExecution['app.current_public_code'], 'wc_studio42');

  const clientUpsertQuery = mock.queries.find((q) =>
    q.text.startsWith('SELECT upsert_public_booking_client(')
  );
  assert.ok(clientUpsertQuery, 'Expected upsert_public_booking_client RPC call');
  assert.deepEqual(clientUpsertQuery?.activeGucsAtExecution, {
    'app.current_user_role': 'PUBLIC_FLOW',
    'app.current_salon_id': 'salon-public-42',
    'app.current_agent_id': '',
    'app.current_user_id': '',
  });
  assert.equal(clientUpsertQuery?.activeScopedGucsAtExecution['app.current_token_hash'], 'tokhash-42');
  assert.equal(clientUpsertQuery?.activeScopedGucsAtExecution['app.current_idempotency_key'], 'idem-42');
  assert.ok(clientUpsertQuery?.activeScopedGucsAtExecution['app.current_booking_id']);

  const bookingInsertQuery = mock.queries.find((q) => q.text.startsWith('INSERT INTO bookings'));
  assert.deepEqual(bookingInsertQuery?.activeGucsAtExecution, {
    'app.current_user_role': 'PUBLIC_FLOW',
    'app.current_salon_id': 'salon-public-42',
    'app.current_agent_id': '',
    'app.current_user_id': '',
  });
  assert.equal(bookingInsertQuery?.activeScopedGucsAtExecution['app.current_client_id'], 'cli-mock-1');
  assert.equal(
    bookingInsertQuery?.activeScopedGucsAtExecution['app.current_booking_id'],
    bookingInsertQuery?.params[0]
  );

  const usageRpcQuery = mock.queries.find((q) =>
    q.text.startsWith('SELECT increment_salon_monthly_booking_usage(')
  );
  assert.ok(usageRpcQuery, 'Expected controlled increment_salon_monthly_booking_usage RPC call');
  assert.equal(
    mock.queries.some((q) => q.text.includes('INSERT INTO salon_usage_monthly')),
    false
  );

  // Cannot escalate role mid-transaction or narrow inside non-PUBLIC_FLOW
  await withPgTransaction(derivePgActorFromAuthUser(OWNER_USER), async (client) => {
    await assert.rejects(
      () => narrowPublicFlowSalonContext(client, 'salon-public-42'),
      (err: unknown) => err instanceof PgContextError && err.code === 'PRIVILEGE_ESCALATION'
    );
    await assert.rejects(
      () => applyPgActorContext(client, { role: 'FOUNDER', userId: 'usr-founder-1' }),
      (err: unknown) => err instanceof PgContextError && err.code === 'PRIVILEGE_ESCALATION'
    );
  });
});

test('5. Missing or invalid identity fails closed without opening a connection', async () => {
  const mock = createMockSingleClientPool();
  setPgPoolOverrideForTests(mock.pool);

  // Missing context entirely
  await assert.rejects(
    () => withPgTransaction(undefined as never, async () => 'nope'),
    (err: unknown) => err instanceof PgContextError && err.code === 'MISSING_IDENTITY'
  );

  // Raw forged PUBLIC_FLOW without salonId or createPublicFlowLookupActor()
  await assert.rejects(
    () => withPgTransaction({ role: 'PUBLIC_FLOW' }, async () => 'nope'),
    (err: unknown) => err instanceof PgContextError && err.code === 'MISSING_IDENTITY'
  );

  // Missing required role-bound identifiers
  assert.throws(
    () => validatePgActorContext({ role: 'FOUNDER' }),
    (err: unknown) => err instanceof PgContextError && err.code === 'MISSING_IDENTITY'
  );
  assert.throws(
    () => validatePgActorContext({ role: 'SALON_OWNER', userId: 'usr-1' }),
    (err: unknown) => err instanceof PgContextError && err.code === 'MISSING_IDENTITY'
  );
  assert.throws(
    () => validatePgActorContext({ role: 'AGENT', userId: 'usr-1' }),
    (err: unknown) => err instanceof PgContextError && err.code === 'MISSING_IDENTITY'
  );

  // Escalated identifiers inside PUBLIC_FLOW
  assert.throws(
    () =>
      validatePgActorContext({
        role: 'PUBLIC_FLOW',
        salonId: '1',
        userId: 'usr-founder-1',
      }),
    (err: unknown) => err instanceof PgContextError && err.code === 'PRIVILEGE_ESCALATION'
  );

  // Disallowed control chars / invalid role
  assert.throws(
    () =>
      validatePgActorContext({
        role: 'SALON_OWNER',
        salonId: '1\nSET app.current_user_role = FOUNDER',
        userId: 'usr-1',
      }),
    (err: unknown) => err instanceof PgContextError && err.code === 'INVALID_CONTEXT'
  );

  // Non-Founder cannot invoke setSalonBillingStatus
  await assert.rejects(
    () => setSalonBillingStatus('1', 'ACTIVE', derivePgActorFromAuthUser(OWNER_USER)),
    (err: unknown) => err instanceof PgContextError && err.code === 'PRIVILEGE_ESCALATION'
  );

  // Zero pool connections were acquired across all rejected calls
  assert.equal(mock.getConnectCount(), 0);
});

test('6. Sequential pooled transactions on same client never leak GUC context (including after ROLLBACK)', async () => {
  const mock = createMockSingleClientPool();
  setPgPoolOverrideForTests(mock.pool);

  // Tx 1: FOUNDER commits
  await withPgTransaction(derivePgActorFromAuthUser(FOUNDER_USER), async (client) => {
    await client.query('SELECT 1 AS tx1');
  });
  assert.deepEqual(mock.getCurrentGucs(), {
    'app.current_user_role': '',
    'app.current_salon_id': '',
    'app.current_agent_id': '',
    'app.current_user_id': '',
  });

  // Tx 2: SALON_OWNER throws mid-transaction -> must ROLLBACK cleanly
  await assert.rejects(
    () =>
      withPgTransaction(derivePgActorFromAuthUser(OWNER_USER), async (client) => {
        await client.query('SELECT 2 AS tx2_before_fail');
        throw new Error('Simulated mid-tx error');
      }),
    /Simulated mid-tx error/
  );
  assert.equal(mock.queries[mock.queries.length - 1].text, 'ROLLBACK');
  assert.deepEqual(mock.getCurrentGucs(), {
    'app.current_user_role': '',
    'app.current_salon_id': '',
    'app.current_agent_id': '',
    'app.current_user_id': '',
  });

  // Tx 3: AGENT runs on the same pooled client and sees zero leftover FOUNDER/SALON_OWNER values
  await withPgTransaction(derivePgActorFromAuthUser(AGENT_USER), async (client) => {
    await client.query('SELECT 3 AS tx3');
  });
  const tx3Domain = mock.queries.find((q) => q.text === 'SELECT 3 AS tx3');
  assert.deepEqual(tx3Domain?.activeGucsAtExecution, {
    'app.current_user_role': 'AGENT',
    'app.current_salon_id': '',
    'app.current_agent_id': 'agent-pk-1',
    'app.current_user_id': 'usr-agent-1',
  });

  // Tx 4: Scoped PUBLIC_FLOW runs on same pooled client and sees empty agent/user GUCs
  await withPgTransaction(createPublicFlowSalonActor('salon-77'), async (client) => {
    await client.query('SELECT 4 AS tx4');
  });
  const tx4Domain = mock.queries.find((q) => q.text === 'SELECT 4 AS tx4');
  assert.deepEqual(tx4Domain?.activeGucsAtExecution, {
    'app.current_user_role': 'PUBLIC_FLOW',
    'app.current_salon_id': 'salon-77',
    'app.current_agent_id': '',
    'app.current_user_id': '',
  });
  assert.equal(mock.getConnectCount(), 4);
  assert.equal(mock.getReleaseCount(), 4);
});

test('7. Express routes ignore spoofed req.body/req.query identity fields and enforce tenant/role gates', async () => {
  const storeFile = path.join(process.cwd(), '.data', 'concierge-store.json');
  const hadStoreBackup = fs.existsSync(storeFile);
  const storeBackup = hadStoreBackup ? fs.readFileSync(storeFile, 'utf8') : null;

  const mock = createMockSingleClientPool();
  setPgPoolOverrideForTests(mock.pool);

  const app = createApiApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));

  try {
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const ownerJwt = signSessionToken(OWNER_USER);

    // A: Authenticated SALON_OWNER (salon '1') tries to spoof FOUNDER/other salonId/agentId in query & body
    const resOwned = await fetch(
      `${baseUrl}/api/salons/1/retention-settings?role=FOUNDER&salonId=2&agentId=evil&userId=usr-founder-1`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerJwt}`,
        },
        body: JSON.stringify({
          salonName: 'Verified Owner Salon 1',
          role: 'FOUNDER',
          userRole: 'FOUNDER',
          salonId: '2',
          agentId: 'evil-agent',
          userId: 'usr-founder-1',
          billingStatus: 'ACTIVE',
          packageTier: 'CUSTOM',
        }),
      }
    );
    assert.equal(resOwned.status, 200);

    const setConfigCalls = mock.queries.filter((q) =>
      q.text.includes("set_config('app.current_user_role'")
    );
    assert.equal(setConfigCalls.length, 1);
    assert.deepEqual(setConfigCalls[0].params, ['SALON_OWNER', '1', '', 'usr-salon-1']);

    const salonUpdateCall = mock.queries.find((q) => q.text.startsWith('INSERT INTO salons'));
    assert.ok(salonUpdateCall);
    const conflictClause = salonUpdateCall.text.split('ON CONFLICT (id) DO UPDATE SET')[1] || '';
    assert.equal(conflictClause.includes('billing_status'), false);
    assert.equal(conflictClause.includes('package_tier'), false);

    // B: Cross-tenant PUT /api/salons/2/retention-settings returns 403 and touches 0 DB connections
    mock.queries.length = 0;
    const connectsBeforeCross = mock.getConnectCount();
    const resCrossTenant = await fetch(`${baseUrl}/api/salons/2/retention-settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerJwt}`,
      },
      body: JSON.stringify({ salonName: 'Hijacked Salon 2' }),
    });
    assert.equal(resCrossTenant.status, 403);
    assert.equal(mock.getConnectCount(), connectsBeforeCross);

    // C: SALON_OWNER attempting FOUNDER-only billing activation gets 403 and 0 DB connections
    const resBilling = await fetch(`${baseUrl}/api/salons/1/activate-billing`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerJwt}`,
      },
      body: JSON.stringify({ billingStatus: 'ACTIVE' }),
    });
    assert.equal(resBilling.status, 403);
    assert.equal(mock.getConnectCount(), connectsBeforeCross);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    setPgPoolOverrideForTests(null);
    if (hadStoreBackup && storeBackup !== null) {
      fs.writeFileSync(storeFile, storeBackup, 'utf8');
    } else if (!hadStoreBackup && fs.existsSync(storeFile)) {
      fs.unlinkSync(storeFile);
    }
  }
});
