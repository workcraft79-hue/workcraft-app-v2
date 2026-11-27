import test from 'node:test';
import assert from 'node:assert/strict';
import type { Pool, PoolClient } from 'pg';

delete process.env.DATABASE_URL;
delete process.env.POSTGRES_URL;
delete process.env.STAGING_DATABASE_URL;
process.env.NODE_ENV = 'test';

import {
  derivePgActorFromAuthUser,
  findSalonByPublicCodeInPostgres,
  getBookingByAccessTokenFromPostgres,
  normalizeClientPreferredLang,
  normalizeEnabledClientLangs,
  persistPostgresSnapshotMirror,
  setPgPoolOverrideForTests,
} from '../server/postgresRepo.js';
import type { AuthUser } from '../src/types/auth.js';
import type { ClientPreferredLang } from '../src/types/concierge.js';

const ALL_NINE_LOCALES: ClientPreferredLang[] = [
  'en',
  'roman_ur',
  'ur',
  'ar',
  'it',
  'ru',
  'fr',
  'de',
  'es',
];

const FOUNDER_USER: AuthUser = {
  userId: 'usr-founder-locale-test',
  userRole: 'FOUNDER',
  displayName: 'Founder',
  email: 'founder@workcraft.local',
  phone: '+923000000001',
  salonId: null,
  agentId: null,
};

test.afterEach(() => {
  setPgPoolOverrideForTests(null);
});

test('1. normalizeClientPreferredLang and normalizeEnabledClientLangs preserve all 9 locales and strip unsupported codes', () => {
  for (const locale of ALL_NINE_LOCALES) {
    assert.equal(normalizeClientPreferredLang(locale), locale);
  }
  assert.equal(normalizeClientPreferredLang('xx_invalid', 'en'), 'en');
  assert.equal(normalizeClientPreferredLang(null, 'fr'), 'fr');

  assert.deepEqual(
    normalizeEnabledClientLangs([...ALL_NINE_LOCALES, 'invalid', 'it', 123]),
    ALL_NINE_LOCALES
  );
});

test('2. findSalonByPublicCodeInPostgres preserves all 5 European locales (it, ru, fr, de, es) alongside en, roman_ur, ur, ar', async () => {
  for (const locale of ['it', 'ru', 'fr', 'de', 'es'] as const) {
    const client = {
      async query(text: string) {
        const sql = text.replace(/\s+/g, ' ').trim();
        if (sql.includes('FROM salons') && sql.includes('WHERE public_code = $1')) {
          return {
            rows: [
              {
                id: `salon-${locale}`,
                public_code: `wc_${locale}_01`,
                salon_name: `Salon ${locale.toUpperCase()}`,
                salon_category: 'LADIES',
                owner_auth_phone: '+39061234567',
                public_contact_phone: '+39061234567',
                public_whatsapp_phone: null,
                timezone_iana: 'Europe/Rome',
                timezone_offset_hours: 1,
                currency_code: 'EUR',
                currency_symbol: '€',
                default_lang: locale,
                enabled_langs: [locale, 'en', 'fr', 'de', 'es', 'ru', 'it', 'ur', 'roman_ur', 'ar'],
                plan_tier: 'PRO',
                monthly_booking_limit: 1500,
                billing_status: 'ACTIVE',
                whatsapp_addon_enabled: false,
                address: 'Via Roma 1',
                google_maps_url: '',
                google_review_url: '',
              },
            ],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 1 };
      },
      release() {},
    } as unknown as PoolClient;

    const pool = {
      async connect() {
        return client;
      },
    } as unknown as Pool;

    setPgPoolOverrideForTests(pool);
    const result = await findSalonByPublicCodeInPostgres(`wc_${locale}_01`);
    assert.ok(result, `Expected salon lookup result for locale ${locale}`);
    assert.equal(result.defaultLang, locale);
    for (const expected of ALL_NINE_LOCALES) {
      assert.equal(
        result.enabledLangs.includes(expected),
        true,
        `Expected enabledLangs to preserve ${expected}`
      );
    }
  }
});

test('3. persistPostgresSnapshotMirror and getBookingByAccessTokenFromPostgres preserve European locales without downgrading to en', async () => {
  const capturedQueries: Array<{ text: string; params: unknown[] }> = [];
  const client = {
    async query(text: string, params: unknown[] = []) {
      const sql = text.replace(/\s+/g, ' ').trim();
      capturedQueries.push({ text: sql, params: [...params] });
      if (sql.startsWith('SELECT id FROM salons WHERE public_code = $1')) {
        return { rows: [{ id: 'salon-es' }], rowCount: 1 };
      }
      if (sql.includes('FROM booking_access_tokens bat')) {
        return {
          rows: [
            {
              revoked_at: null,
              expires_at: new Date(Date.now() + 3600_000).toISOString(),
              id: '00000000-0000-4000-8000-000000000099',
              salon_id: 'salon-es',
              salon_public_code: 'wc_es_01',
              salon_name: 'Salon Madrid',
              public_contact_phone: '+34600111222',
              public_whatsapp_phone: null,
              whatsapp_phone: '+34600111222',
              timezone_offset_hours: 1,
              currency_symbol: '€',
              default_lang: 'es',
              address: 'Calle Mayor 1',
              google_maps_url: '',
              google_review_url: '',
              client_id: 'cli-es-1',
              client_name: 'Carlos',
              client_phone: '+34600999888',
              preferred_language: 'de',
              stylist_id: '00000000-0000-4000-8000-000000000010',
              stylist_name: 'Mateo',
              booking_ref: 'BK-ES-1',
              services_snapshot: [{ name: 'Haircut', price: 35, durationMins: 30 }],
              total_price: 35,
              total_duration_mins: 30,
              starts_at: '2026-12-01T10:00:00.000Z',
              ends_at: '2026-12-01T10:30:00.000Z',
              status: 'CONFIRMED',
              source: 'QR',
              deal_id: null,
              idempotency_key: null,
              proof_hash: 'hash-es-1',
              completed_at: null,
              created_at: '2026-12-01T09:00:00.000Z',
            },
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 1 };
    },
    release() {},
  } as unknown as PoolClient;

  const pool = {
    async connect() {
      return client;
    },
  } as unknown as Pool;

  setPgPoolOverrideForTests(pool);

  await persistPostgresSnapshotMirror(
    {
      salonId: 'salon-es',
      publicCode: 'wc_es_01',
      salonName: 'Salon Madrid',
      ownerAuthPhone: '+34600111222',
      publicContactPhone: '+34600111222',
      timezoneIana: 'Europe/Madrid',
      currencyCode: 'EUR',
      currencySymbol: '€',
      defaultLang: 'es',
      enabledLangs: ['es', 'de', 'fr', 'it', 'ru', 'en', 'bogus'],
      planTier: 'PRO',
      monthlyLimit: 1500,
      billingStatus: 'ACTIVE',
    },
    derivePgActorFromAuthUser(FOUNDER_USER)
  );

  const insertQuery = capturedQueries.find((q) => q.text.startsWith('INSERT INTO salons'));
  assert.ok(insertQuery);
  assert.equal(insertQuery.params[13], 'es');
  assert.deepEqual(insertQuery.params[14], ['es', 'de', 'fr', 'it', 'ru', 'en']);

  const encodedPublicCode = Buffer.from('wc_es_01', 'utf8').toString('base64url');
  const booking = await getBookingByAccessTokenFromPostgres(`wcbt_${encodedPublicCode}.raw_es_secret_123456`);
  assert.ok(booking);
  assert.equal(booking.defaultLang, 'es');
  assert.equal(booking.preferredLanguage, 'de');
});
