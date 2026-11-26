import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import type { Pool, PoolClient } from 'pg';

// Strictly offline: no Neon PostgreSQL or Upstash Redis connections
delete process.env.DATABASE_URL;
delete process.env.POSTGRES_URL;
delete process.env.STAGING_DATABASE_URL;
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'phase0c-offline-test-jwt-secret-key-32bytes';

import {
  BookingLifecycleError,
  cancelBookingByAccessToken,
  completeAppointmentAndRecordVisit,
  getAvailableSlotsAndBarbers,
  getBookingByAccessToken,
  rescheduleAppointmentByOwner,
  rescheduleBookingByAccessToken,
  updateAppointmentStatus,
} from '../server/conciergeEngine.js';
import {
  PgContextError,
  type PgBookingStatus,
  createPublicFlowSalonActor,
  derivePgActorFromAuthUser,
  setPgPoolOverrideForTests,
} from '../server/postgresRepo.js';
import { createApiApp } from '../server/app.js';
import { signSessionToken } from '../server/security.js';
import type { AuthUser } from '../src/types/auth.js';

interface DbSalon {
  id: string;
  public_code: string;
  salon_name: string;
  public_contact_phone: string;
  public_whatsapp_phone: string | null;
  whatsapp_phone: string;
  timezone_offset_hours: number;
  currency_symbol: string;
  default_lang: string;
  address: string;
  google_maps_url: string;
  google_review_url: string;
  operating_hours: Record<string, unknown>;
}

interface DbStylist {
  id: string;
  salon_id: string;
  name: string;
  chair_label: string;
  active: boolean;
}

interface DbClient {
  id: string;
  salon_id: string;
  name: string;
  phone: string;
  phone_e164: string;
  preferred_language: string | null;
  preferred_lang: string | null;
  birth_date: string;
  last_completed_visit_at: string | null;
  total_visits: number;
}

interface DbBooking {
  id: string;
  salon_id: string;
  client_id: string;
  stylist_id: string;
  booking_ref: string;
  services_snapshot: Array<{ id?: string; name: string; price?: number; durationMins?: number }>;
  total_price: number;
  total_duration_mins: number;
  starts_at: string;
  ends_at: string;
  status: PgBookingStatus;
  source: string;
  deal_id: string | null;
  idempotency_key: string | null;
  proof_hash: string;
  completed_at: string | null;
  created_at: string;
}

interface DbAccessToken {
  id: string;
  token_hash: string;
  booking_id: string;
  salon_id: string;
  expires_at: string;
  revoked_at: string | null;
}

interface DbStylistLeave {
  id: string;
  salon_id: string;
  stylist_id: string;
  lock_type: string;
  starts_at: string;
  ends_at: string;
  reason: string;
}

interface DbAuditRow {
  id: string;
  salon_id: string;
  booking_id: string;
  actor_type: 'CUSTOMER' | 'OWNER' | 'SYSTEM';
  action: 'CREATED' | 'RESCHEDULED' | 'CANCELED' | 'IN_CHAIR' | 'COMPLETED';
  previous_state: Record<string, unknown> | null;
  new_state: Record<string, unknown> | null;
  created_at: string;
}

interface DbCounterNotification {
  id: string;
  salon_id: string;
  booking_id: string;
  event_type: string;
  title: string;
  speech_text: string;
}

interface DbUsageMonthly {
  salon_id: string;
  billing_month: string;
  billable_bookings: number;
}

interface DbStateSnapshot {
  salons: DbSalon[];
  stylists: DbStylist[];
  clients: DbClient[];
  bookings: DbBooking[];
  bookingAccessTokens: DbAccessToken[];
  stylistLeaves: DbStylistLeave[];
  bookingAuditLog: DbAuditRow[];
  counterNotifications: DbCounterNotification[];
  usageMonthly: DbUsageMonthly[];
}

function makeBookingToken(publicCode: string, secretSuffix = 'testsecret1234567890'): string {
  return `wcbt_${Buffer.from(publicCode, 'utf8').toString('base64url')}.${secretSuffix}`;
}

function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
}

function createStatefulMockPgPool(initial?: Partial<DbStateSnapshot>) {
  let state: DbStateSnapshot = {
    salons: structuredClone(
      initial?.salons || [
        {
          id: '1',
          public_code: 'wc_7k9m2p4x8q2a',
          salon_name: 'WorkCraft Salon 1',
          public_contact_phone: '+923001112233',
          public_whatsapp_phone: '+923001112233',
          whatsapp_phone: '+923001112233',
          timezone_offset_hours: 5,
          currency_symbol: 'PKR ',
          default_lang: 'en',
          address: 'DHA Phase 5, Lahore',
          google_maps_url: 'https://maps.google.com/?q=DHA+Lahore',
          google_review_url: 'https://g.page/r/test-review',
          operating_hours: {
            monThuOpen: '11:00 AM',
            monThuClose: '11:00 PM',
            monThuClosed: false,
            fridayOpen: '11:00 AM',
            fridayClose: '11:30 PM',
            fridayBreakStart: '01:00 PM',
            fridayBreakEnd: '02:30 PM',
            fridayClosed: false,
            satSunOpen: '10:30 AM',
            satSunClose: '11:30 PM',
            satSunClosed: false,
          },
        },
        {
          id: '2',
          public_code: 'wc_3r8v5n2w9c4j',
          salon_name: 'WorkCraft Salon 2',
          public_contact_phone: '+923004445566',
          public_whatsapp_phone: '+923004445566',
          whatsapp_phone: '+923004445566',
          timezone_offset_hours: 5,
          currency_symbol: 'PKR ',
          default_lang: 'en',
          address: 'Gulberg III, Lahore',
          google_maps_url: 'https://maps.google.com/?q=Gulberg+Lahore',
          google_review_url: 'https://g.page/r/test-review-2',
          operating_hours: {},
        },
      ]
    ),
    stylists: structuredClone(
      initial?.stylists || [
        { id: 'sty-1', salon_id: '1', name: 'Master Aslam', chair_label: 'Chair 1', active: true },
        { id: 'sty-2', salon_id: '1', name: 'Tariq Mehmood', chair_label: 'Chair 2', active: true },
        { id: 'sty-3', salon_id: '2', name: 'Ali Raza', chair_label: 'Chair 1', active: true },
      ]
    ),
    clients: structuredClone(
      initial?.clients || [
        {
          id: 'cli-1',
          salon_id: '1',
          name: 'Hamza Khan',
          phone: '+923001234567',
          phone_e164: '+923001234567',
          preferred_language: 'en',
          preferred_lang: 'en',
          birth_date: '05-14',
          last_completed_visit_at: null,
          total_visits: 1,
        },
        {
          id: 'cli-2',
          salon_id: '2',
          name: 'Zainab',
          phone: '+923007778899',
          phone_e164: '+923007778899',
          preferred_language: 'en',
          preferred_lang: 'en',
          birth_date: '',
          last_completed_visit_at: null,
          total_visits: 0,
        },
      ]
    ),
    bookings: structuredClone(initial?.bookings || []),
    bookingAccessTokens: structuredClone(initial?.bookingAccessTokens || []),
    stylistLeaves: structuredClone(initial?.stylistLeaves || []),
    bookingAuditLog: structuredClone(initial?.bookingAuditLog || []),
    counterNotifications: structuredClone(initial?.counterNotifications || []),
    usageMonthly: structuredClone(
      initial?.usageMonthly || [{ salon_id: '1', billing_month: '2026-12', billable_bookings: 1 }]
    ),
  };

  let txBackup: DbStateSnapshot | null = null;
  let inTx = false;
  let connectCount = 0;
  let releaseCount = 0;
  let seq = 100;
  let gucs: Record<string, string> = {
    'app.current_user_role': '',
    'app.current_salon_id': '',
    'app.current_agent_id': '',
    'app.current_user_id': '',
  };
  let scopedGucs: Record<string, string> = {};

  const queries: Array<{
    text: string;
    params: unknown[];
    gucs: Record<string, string>;
    scopedGucs: Record<string, string>;
  }> = [];
  let failOnQuerySubstring: string | null = null;
  let simulateOverlapOnBookingUpdate = false;

  const canSeeSalonRow = (salonId: string, table: string): boolean => {
    const role = gucs['app.current_user_role'];
    const scopedSalon = gucs['app.current_salon_id'];
    if (role === 'FOUNDER') return true;
    if (role === 'SALON_OWNER') return Boolean(scopedSalon) && salonId === scopedSalon;
    if (role === 'PUBLIC_FLOW') {
      if (table === 'salons_public_lookup') return true;
      return Boolean(scopedSalon) && salonId === scopedSalon;
    }
    return false;
  };

  const joinBookingRow = (b: DbBooking) => {
    const s = state.salons.find((x) => x.id === b.salon_id)!;
    const c = state.clients.find((x) => x.id === b.client_id)!;
    const st = state.stylists.find((x) => x.id === b.stylist_id)!;
    return {
      id: b.id,
      salon_id: b.salon_id,
      salon_public_code: s.public_code,
      salon_name: s.salon_name,
      public_contact_phone: s.public_contact_phone,
      public_whatsapp_phone: s.public_whatsapp_phone,
      whatsapp_phone: s.whatsapp_phone,
      timezone_offset_hours: s.timezone_offset_hours,
      currency_symbol: s.currency_symbol,
      default_lang: s.default_lang,
      address: s.address,
      google_maps_url: s.google_maps_url,
      google_review_url: s.google_review_url,
      client_id: b.client_id,
      client_name: c.name,
      client_phone: c.phone_e164 || c.phone,
      preferred_language: c.preferred_lang || c.preferred_language,
      stylist_id: b.stylist_id,
      stylist_name: st.name,
      booking_ref: b.booking_ref,
      services_snapshot: b.services_snapshot,
      total_price: b.total_price,
      total_duration_mins: b.total_duration_mins,
      starts_at: b.starts_at,
      ends_at: b.ends_at,
      status: b.status,
      source: b.source,
      deal_id: b.deal_id,
      idempotency_key: b.idempotency_key,
      proof_hash: b.proof_hash,
      completed_at: b.completed_at,
      created_at: b.created_at,
    };
  };

  const client = {
    async query(text: string, params: unknown[] = []) {
      const sql = text.replace(/\s+/g, ' ').trim();
      queries.push({ text: sql, params: [...params], gucs: { ...gucs }, scopedGucs: { ...scopedGucs } });

      if (sql === 'BEGIN') {
        inTx = true;
        txBackup = structuredClone(state);
        return { rows: [], rowCount: 0 };
      }
      if (sql === 'COMMIT') {
        txBackup = null;
        inTx = false;
        gucs = {
          'app.current_user_role': '',
          'app.current_salon_id': '',
          'app.current_agent_id': '',
          'app.current_user_id': '',
        };
        scopedGucs = {};
        return { rows: [], rowCount: 0 };
      }
      if (sql === 'ROLLBACK') {
        if (txBackup) state = txBackup;
        txBackup = null;
        inTx = false;
        gucs = {
          'app.current_user_role': '',
          'app.current_salon_id': '',
          'app.current_agent_id': '',
          'app.current_user_id': '',
        };
        scopedGucs = {};
        return { rows: [], rowCount: 0 };
      }

      if (sql.includes("set_config('app.current_user_role'")) {
        assert.equal(inTx, true, 'set_config must run inside transaction');
        gucs['app.current_user_role'] = String(params[0] ?? '');
        gucs['app.current_salon_id'] = String(params[1] ?? '');
        gucs['app.current_agent_id'] = String(params[2] ?? '');
        gucs['app.current_user_id'] = String(params[3] ?? '');
        return { rows: [], rowCount: 1 };
      }

      if (sql.includes("set_config('app.current_")) {
        assert.equal(inTx, true, 'scoped set_config must run inside transaction');
        const matches = [...sql.matchAll(/set_config\('(app\.current_[a-z_]+)', \$(\d+), true\)/g)];
        for (const m of matches) {
          const idx = Number(m[2]) - 1;
          scopedGucs[m[1]] = String(params[idx] ?? '');
        }
        return { rows: [], rowCount: 1 };
      }

      if (failOnQuerySubstring && sql.includes(failOnQuerySubstring)) {
        throw new Error(`Simulated DB failure on: ${failOnQuerySubstring}`);
      }

      if (sql.startsWith('SELECT id FROM salons WHERE public_code = $1')) {
        const code = String(params[0]);
        if (
          gucs['app.current_user_role'] === 'PUBLIC_FLOW' &&
          scopedGucs['app.current_public_code'] !== code
        ) {
          return { rows: [], rowCount: 0 };
        }
        const found = state.salons.find((s) => s.public_code === code);
        return found ? { rows: [{ id: found.id }], rowCount: 1 } : { rows: [], rowCount: 0 };
      }

      if (sql.startsWith('SELECT id, public_code, timezone_offset_hours, operating_hours FROM salons WHERE id = $1')) {
        const salonId = String(params[0]);
        const found = state.salons.find((s) => s.id === salonId && canSeeSalonRow(s.id, 'salons'));
        return found ? { rows: [found], rowCount: 1 } : { rows: [], rowCount: 0 };
      }

      if (sql.includes('FROM salons WHERE public_code = $1')) {
        const code = String(params[0]);
        if (
          gucs['app.current_user_role'] === 'PUBLIC_FLOW' &&
          scopedGucs['app.current_public_code'] !== code
        ) {
          return { rows: [], rowCount: 0 };
        }
        const found = state.salons.find((s) => s.public_code === code);
        return found ? { rows: [found], rowCount: 1 } : { rows: [], rowCount: 0 };
      }

      if (sql.startsWith('SELECT id, name, chair_label, active FROM stylists WHERE salon_id = $1')) {
        const salonId = String(params[0]);
        const rows = state.stylists.filter(
          (st) => st.salon_id === salonId && canSeeSalonRow(st.salon_id, 'stylists')
        );
        return { rows, rowCount: rows.length };
      }

      if (sql.includes('FROM services sv')) {
        return { rows: [], rowCount: 0 };
      }

      if (sql.includes('FROM get_public_stylist_busy_blocks(')) {
        const salonId = String(params[0]);
        const winStart = new Date(String(params[1])).getTime();
        const winEnd = new Date(String(params[2])).getTime();
        const excludeId = params[3] ? String(params[3]) : null;
        if (!canSeeSalonRow(salonId, 'bookings')) {
          throw new Error('Tenant mismatch for stylist busy block lookup');
        }
        const rows = state.bookings
          .filter((b) => {
            if (b.salon_id !== salonId) return false;
            if (b.status !== 'CONFIRMED' && b.status !== 'IN_CHAIR') return false;
            if (excludeId && (b.id === excludeId || b.booking_ref === excludeId)) return false;
            return new Date(b.ends_at).getTime() > winStart && new Date(b.starts_at).getTime() < winEnd;
          })
          .map((b) => {
            const st = state.stylists.find((x) => x.id === b.stylist_id)!;
            return {
              stylist_id: b.stylist_id,
              stylist_name: st.name,
              starts_at: b.starts_at,
              ends_at: b.ends_at,
              status: b.status,
              total_duration_mins: b.total_duration_mins,
            };
          });
        return { rows, rowCount: rows.length };
      }

      if (sql.includes('FROM bookings b JOIN stylists st ON st.id = b.stylist_id WHERE b.salon_id = $1')) {
        if (gucs['app.current_user_role'] === 'PUBLIC_FLOW') {
          throw new Error('RLS denied direct PUBLIC_FLOW bookings scan in availability');
        }
        const salonId = String(params[0]);
        const winStart = new Date(String(params[1])).getTime();
        const winEnd = new Date(String(params[2])).getTime();
        const excludeId = params[3] ? String(params[3]) : null;
        const rows = state.bookings
          .filter((b) => {
            if (!canSeeSalonRow(b.salon_id, 'bookings')) return false;
            if (b.salon_id !== salonId) return false;
            if (b.status !== 'CONFIRMED' && b.status !== 'IN_CHAIR') return false;
            if (excludeId && (b.id === excludeId || b.booking_ref === excludeId)) return false;
            return new Date(b.ends_at).getTime() > winStart && new Date(b.starts_at).getTime() < winEnd;
          })
          .map((b) => {
            const st = state.stylists.find((x) => x.id === b.stylist_id)!;
            return {
              id: b.id,
              booking_ref: b.booking_ref,
              stylist_id: b.stylist_id,
              stylist_name: st.name,
              starts_at: b.starts_at,
              ends_at: b.ends_at,
              status: b.status,
              total_duration_mins: b.total_duration_mins,
            };
          });
        return { rows, rowCount: rows.length };
      }

      if (sql.includes('FROM stylist_leaves sl')) {
        const salonId = String(params[0]);
        const winStart = new Date(String(params[1])).getTime();
        const winEnd = new Date(String(params[2])).getTime();
        const rows = state.stylistLeaves
          .filter((lv) => {
            if (!canSeeSalonRow(lv.salon_id, 'stylist_leaves')) return false;
            if (lv.salon_id !== salonId) return false;
            return new Date(lv.ends_at).getTime() > winStart && new Date(lv.starts_at).getTime() < winEnd;
          })
          .map((lv) => {
            const st = state.stylists.find((x) => x.id === lv.stylist_id)!;
            return {
              id: lv.id,
              stylist_id: lv.stylist_id,
              stylist_name: st.name,
              lock_type: lv.lock_type,
              starts_at: lv.starts_at,
              ends_at: lv.ends_at,
              reason: lv.reason,
            };
          });
        return { rows, rowCount: rows.length };
      }

      if (sql.includes('FROM booking_access_tokens bat JOIN bookings b')) {
        const tokenHash = String(params[0]);
        const salonId = String(params[1]);
        const isPublic = gucs['app.current_user_role'] === 'PUBLIC_FLOW';
        const tok = state.bookingAccessTokens.find(
          (t) =>
            t.token_hash === tokenHash &&
            t.salon_id === salonId &&
            canSeeSalonRow(t.salon_id, 'booking_access_tokens') &&
            (!isPublic || (scopedGucs['app.current_token_hash'] === t.token_hash && !t.revoked_at && new Date(t.expires_at).getTime() > Date.now()))
        );
        if (!tok) return { rows: [], rowCount: 0 };
        const bk = state.bookings.find(
          (b) => b.id === tok.booking_id && b.salon_id === tok.salon_id && canSeeSalonRow(b.salon_id, 'bookings')
        );
        if (!bk) return { rows: [], rowCount: 0 };
        return {
          rows: [
            {
              token_id: tok.id,
              revoked_at: tok.revoked_at,
              expires_at: tok.expires_at,
              ...joinBookingRow(bk),
            },
          ],
          rowCount: 1,
        };
      }

      if (sql.includes('FROM bookings b JOIN salons s') && sql.includes('(b.booking_ref = $2 OR b.id::text = $2)')) {
        const salonId = String(params[0]);
        const refOrId = String(params[1]);
        const bk = state.bookings.find(
          (b) =>
            b.salon_id === salonId &&
            (b.booking_ref === refOrId || b.id === refOrId) &&
            canSeeSalonRow(b.salon_id, 'bookings')
        );
        return bk ? { rows: [joinBookingRow(bk)], rowCount: 1 } : { rows: [], rowCount: 0 };
      }

      if (sql.includes('FROM bookings b JOIN salons s') && sql.includes('WHERE b.id = $1 AND b.salon_id = $2')) {
        const id = String(params[0]);
        const salonId = String(params[1]);
        const isPublic = gucs['app.current_user_role'] === 'PUBLIC_FLOW';
        const hasValidPublicTok =
          isPublic &&
          Boolean(scopedGucs['app.current_token_hash']) &&
          state.bookingAccessTokens.some(
            (t) =>
              t.booking_id === id &&
              t.salon_id === salonId &&
              t.token_hash === scopedGucs['app.current_token_hash'] &&
              !t.revoked_at &&
              new Date(t.expires_at).getTime() > Date.now()
          );
        const bk = state.bookings.find(
          (b) =>
            b.id === id &&
            b.salon_id === salonId &&
            canSeeSalonRow(b.salon_id, 'bookings') &&
            (!isPublic || hasValidPublicTok)
        );
        return bk ? { rows: [joinBookingRow(bk)], rowCount: 1 } : { rows: [], rowCount: 0 };
      }

      if (sql.includes('FROM bookings b JOIN salons s') && sql.includes('WHERE b.salon_id = $1 ORDER BY')) {
        const salonId = String(params[0]);
        const rows = state.bookings
          .filter((b) => b.salon_id === salonId && canSeeSalonRow(b.salon_id, 'bookings'))
          .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime())
          .map(joinBookingRow);
        return { rows, rowCount: rows.length };
      }

      if (sql.startsWith('SELECT id, salon_id, booking_id, actor_type, action, new_state, created_at FROM booking_audit_log')) {
        const salonId = String(params[0]);
        const rows = state.bookingAuditLog
          .filter((a) => a.salon_id === salonId && canSeeSalonRow(a.salon_id, 'booking_audit_log'))
          .slice()
          .reverse();
        return { rows, rowCount: rows.length };
      }

      if (sql.startsWith('INSERT INTO stylists')) {
        const salonId = String(params[0]);
        const name = String(params[1]);
        if (!canSeeSalonRow(salonId, 'stylists')) throw new Error('RLS denied stylists insert');
        let st = state.stylists.find((x) => x.salon_id === salonId && x.name === name);
        if (!st) {
          st = { id: `sty-${++seq}`, salon_id: salonId, name, chair_label: '', active: true };
          state.stylists.push(st);
        } else {
          st.active = true;
        }
        return { rows: [{ id: st.id }], rowCount: 1 };
      }

      if (sql.startsWith('UPDATE bookings SET stylist_id = $1')) {
        if (simulateOverlapOnBookingUpdate) {
          const err = new Error('conflicting key value violates exclusion constraint "bookings_no_stylist_overlap"') as Error & {
            code: string;
          };
          err.code = '23P01';
          throw err;
        }
        const [stylistId, startsAt, endsAt, bookingId, salonId] = params as [
          string,
          string,
          string,
          string,
          string,
        ];
        if (!canSeeSalonRow(salonId, 'bookings')) throw new Error('RLS denied bookings update');
        const bk = state.bookings.find((b) => b.id === bookingId && b.salon_id === salonId);
        if (!bk) return { rows: [], rowCount: 0 };

        // Enforce bookings_no_stylist_overlap in mock DB
        const nextStart = new Date(startsAt).getTime();
        const nextEnd = new Date(endsAt).getTime();
        const clash = state.bookings.find(
          (other) =>
            other.id !== bk.id &&
            other.salon_id === salonId &&
            other.stylist_id === stylistId &&
            (other.status === 'CONFIRMED' || other.status === 'IN_CHAIR') &&
            new Date(other.ends_at).getTime() > nextStart &&
            new Date(other.starts_at).getTime() < nextEnd
        );
        if (clash) {
          const err = new Error('exclusion constraint bookings_no_stylist_overlap') as Error & { code: string };
          err.code = '23P01';
          throw err;
        }

        bk.stylist_id = stylistId;
        bk.starts_at = startsAt;
        bk.ends_at = endsAt;
        return { rows: [], rowCount: 1 };
      }

      if (sql.startsWith("UPDATE bookings SET status = 'CANCELED'")) {
        const [bookingId, salonId] = params as [string, string];
        if (!canSeeSalonRow(salonId, 'bookings')) throw new Error('RLS denied bookings cancel');
        const bk = state.bookings.find((b) => b.id === bookingId && b.salon_id === salonId);
        if (bk) bk.status = 'CANCELED';
        return { rows: [], rowCount: bk ? 1 : 0 };
      }

      if (sql.startsWith("UPDATE bookings SET status = 'COMPLETED'")) {
        const [nowIso, bookingId, salonId] = params as [string, string, string];
        if (!canSeeSalonRow(salonId, 'bookings')) throw new Error('RLS denied bookings complete');
        const bk = state.bookings.find((b) => b.id === bookingId && b.salon_id === salonId);
        if (bk) {
          bk.status = 'COMPLETED';
          bk.completed_at = bk.completed_at || nowIso;
        }
        return { rows: [], rowCount: bk ? 1 : 0 };
      }

      if (sql.startsWith('UPDATE bookings SET status = $1')) {
        const [nextStatus, nowIso, bookingId, salonId] = params as [
          PgBookingStatus,
          string,
          string,
          string,
        ];
        if (!canSeeSalonRow(salonId, 'bookings')) throw new Error('RLS denied bookings status update');
        const bk = state.bookings.find((b) => b.id === bookingId && b.salon_id === salonId);
        if (bk) {
          bk.status = nextStatus;
          if (nextStatus === 'COMPLETED' && !bk.completed_at) {
            bk.completed_at = nowIso;
          }
        }
        return { rows: [], rowCount: bk ? 1 : 0 };
      }

      if (sql.startsWith('UPDATE booking_access_tokens SET expires_at = $1')) {
        const [expiresAt, tokenId, salonId] = params as [string, string, string];
        if (!canSeeSalonRow(salonId, 'booking_access_tokens')) throw new Error('RLS denied token update');
        const tok = state.bookingAccessTokens.find((t) => t.id === tokenId && t.salon_id === salonId);
        if (tok) tok.expires_at = expiresAt;
        return { rows: [], rowCount: tok ? 1 : 0 };
      }

      if (sql.startsWith('UPDATE clients SET last_completed_visit_at = $1')) {
        const [nowIso, clientId, salonId] = params as [string, string, string];
        if (!canSeeSalonRow(salonId, 'clients')) throw new Error('RLS denied clients update');
        const cli = state.clients.find((c) => c.id === clientId && c.salon_id === salonId);
        if (cli) {
          cli.last_completed_visit_at = nowIso;
          cli.total_visits += 1;
        }
        return { rows: [], rowCount: cli ? 1 : 0 };
      }

      if (sql.startsWith('UPDATE clients SET name = COALESCE')) {
        const [name, birthDate, alreadyCompleted, nowIso, clientId, salonId] = params as [
          string,
          string,
          boolean,
          string,
          string,
          string,
        ];
        if (!canSeeSalonRow(salonId, 'clients')) throw new Error('RLS denied clients update');
        const cli = state.clients.find((c) => c.id === clientId && c.salon_id === salonId)!;
        if (name) cli.name = name;
        if (birthDate) cli.birth_date = birthDate;
        if (!alreadyCompleted) {
          cli.last_completed_visit_at = nowIso;
          cli.total_visits += 1;
        }
        return {
          rows: [
            {
              id: cli.id,
              salon_id: cli.salon_id,
              name: cli.name,
              phone: cli.phone_e164 || cli.phone,
              preferred_language: cli.preferred_lang || cli.preferred_language,
              birth_date: cli.birth_date,
              last_completed_visit_at: cli.last_completed_visit_at,
              total_visits: cli.total_visits,
            },
          ],
          rowCount: 1,
        };
      }

      if (sql.startsWith('INSERT INTO clients')) {
        const [id, salonId, name, phone, lang, birthDate, nowIso] = params as [
          string,
          string,
          string,
          string,
          string,
          string,
          string,
        ];
        if (!canSeeSalonRow(salonId, 'clients')) throw new Error('RLS denied clients insert');
        let cli = state.clients.find((c) => c.salon_id === salonId && c.phone_e164 === phone);
        if (cli) {
          if (name) cli.name = name;
          if (birthDate) cli.birth_date = birthDate;
          cli.last_completed_visit_at = nowIso;
          cli.total_visits += 1;
        } else {
          cli = {
            id,
            salon_id: salonId,
            name,
            phone,
            phone_e164: phone,
            preferred_language: lang,
            preferred_lang: lang,
            birth_date: birthDate || '',
            last_completed_visit_at: nowIso,
            total_visits: 1,
          };
          state.clients.push(cli);
        }
        return {
          rows: [
            {
              id: cli.id,
              salon_id: cli.salon_id,
              name: cli.name,
              phone: cli.phone_e164,
              preferred_language: cli.preferred_lang,
              birth_date: cli.birth_date,
              last_completed_visit_at: cli.last_completed_visit_at,
              total_visits: cli.total_visits,
            },
          ],
          rowCount: 1,
        };
      }

      if (sql.startsWith('INSERT INTO bookings (')) {
        const [
          salonId,
          clientId,
          stylistId,
          bookingRef,
          servicesJson,
          price,
          startsAt,
          endsAt,
          proofHash,
          nowIso,
        ] = params as [string, string, string, string, string, number, string, string, string, string];
        if (!canSeeSalonRow(salonId, 'bookings')) throw new Error('RLS denied bookings insert');
        const newBk: DbBooking = {
          id: `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`,
          salon_id: salonId,
          client_id: clientId,
          stylist_id: stylistId,
          booking_ref: bookingRef,
          services_snapshot: JSON.parse(servicesJson),
          total_price: price,
          total_duration_mins: 35,
          starts_at: startsAt,
          ends_at: endsAt,
          status: 'COMPLETED',
          source: 'OWNER_WALKIN',
          deal_id: null,
          idempotency_key: null,
          proof_hash: proofHash,
          completed_at: nowIso,
          created_at: nowIso,
        };
        state.bookings.push(newBk);
        return { rows: [{ id: newBk.id }], rowCount: 1 };
      }

      if (sql.startsWith('INSERT INTO booking_audit_log')) {
        const salonId = String(params[0]);
        const bookingId = String(params[1]);
        let actorType: 'CUSTOMER' | 'OWNER' | 'SYSTEM' = 'OWNER';
        let action: 'CREATED' | 'RESCHEDULED' | 'CANCELED' | 'IN_CHAIR' | 'COMPLETED' = 'CREATED';
        let prevJson = '{}';
        let nextJson = '{}';

        if (params.length === 4) {
          actorType = sql.includes("'CUSTOMER'")
            ? 'CUSTOMER'
            : sql.includes("'SYSTEM'")
            ? 'SYSTEM'
            : 'OWNER';
          action = sql.includes("'RESCHEDULED'")
            ? 'RESCHEDULED'
            : sql.includes("'CANCELED'")
            ? 'CANCELED'
            : sql.includes("'COMPLETED'")
            ? 'COMPLETED'
            : sql.includes("'IN_CHAIR'")
            ? 'IN_CHAIR'
            : 'CREATED';
          prevJson = String(params[2] || '{}');
          nextJson = String(params[3] || '{}');
        } else if (params.length === 5) {
          actorType = sql.includes("'CUSTOMER'")
            ? 'CUSTOMER'
            : sql.includes("'SYSTEM'")
            ? 'SYSTEM'
            : 'OWNER';
          action = String(params[2]) as typeof action;
          prevJson = String(params[3] || '{}');
          nextJson = String(params[4] || '{}');
        } else {
          actorType = String(params[2]) as typeof actorType;
          action = String(params[3]) as typeof action;
          prevJson = String(params[4] || '{}');
          nextJson = String(params[5] || '{}');
        }

        if (!canSeeSalonRow(salonId, 'booking_audit_log')) throw new Error('RLS denied audit insert');
        state.bookingAuditLog.push({
          id: `aud-${++seq}`,
          salon_id: salonId,
          booking_id: bookingId,
          actor_type: actorType,
          action,
          previous_state: JSON.parse(prevJson),
          new_state: JSON.parse(nextJson),
          created_at: new Date().toISOString(),
        });
        return { rows: [], rowCount: 1 };
      }

      if (sql.startsWith('INSERT INTO counter_notifications')) {
        const salonId = String(params[0]);
        const bookingId = String(params[1]);
        const eventType =
          params.length === 4
            ? sql.includes("'CANCELED'")
              ? 'CANCELED'
              : 'RESCHEDULED'
            : String(params[2]);
        const title = String(params.length === 4 ? params[2] : params[3]);
        const speechText = String(params.length === 4 ? params[3] : params[4]);
        if (!canSeeSalonRow(salonId, 'counter_notifications')) throw new Error('RLS denied notification insert');
        state.counterNotifications.push({
          id: `notif-${++seq}`,
          salon_id: salonId,
          booking_id: bookingId,
          event_type: eventType,
          title,
          speech_text: speechText,
        });
        return { rows: [], rowCount: 1 };
      }

      throw new Error(`Unhandled SQL in Phase 0C mock Pool: ${sql}`);
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
    queries,
    getState: () => state,
    getConnectCount: () => connectCount,
    getReleaseCount: () => releaseCount,
    getCurrentGucs: () => ({ ...gucs }),
    setFailOnQuerySubstring: (sub: string | null) => {
      failOnQuerySubstring = sub;
    },
    setSimulateOverlapOnBookingUpdate: (flag: boolean) => {
      simulateOverlapOnBookingUpdate = flag;
    },
  };
}

const OWNER_SALON_1: AuthUser = {
  userId: 'usr-owner-1',
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

const STORE_FILE = path.join(process.cwd(), '.data', 'concierge-store.json');
let storeSnapshotBeforeTests: string | null = null;
let hadStoreBeforeTests = false;

test.before(() => {
  hadStoreBeforeTests = fs.existsSync(STORE_FILE);
  storeSnapshotBeforeTests = hadStoreBeforeTests ? fs.readFileSync(STORE_FILE, 'utf8') : null;
});

test.afterEach(() => {
  setPgPoolOverrideForTests(null);
});

test.after(() => {
  if (hadStoreBeforeTests && storeSnapshotBeforeTests !== null) {
    fs.writeFileSync(STORE_FILE, storeSnapshotBeforeTests, 'utf8');
  } else if (!hadStoreBeforeTests && fs.existsSync(STORE_FILE)) {
    fs.unlinkSync(STORE_FILE);
  }
});

test('1. Owner rescheduling updates PostgreSQL booking, audit log, and counter notification without changing quota', async () => {
  const bkUuid = '00000000-0000-4000-8000-000000000101';
  const mock = createStatefulMockPgPool({
    bookings: [
      {
        id: bkUuid,
        salon_id: '1',
        client_id: 'cli-1',
        stylist_id: 'sty-1',
        booking_ref: 'BK-WEB-101',
        services_snapshot: [{ id: 'svc-1', name: 'Classic Haircut', price: 1200, durationMins: 35 }],
        total_price: 1200,
        total_duration_mins: 35,
        starts_at: '2026-12-03T07:00:00.000Z', // 12:00 PM UTC+5 (Thursday)
        ends_at: '2026-12-03T07:35:00.000Z',
        status: 'CONFIRMED',
        source: 'WEB_QR',
        deal_id: null,
        idempotency_key: null,
        proof_hash: 'proof-101',
        completed_at: null,
        created_at: '2026-12-01T10:00:00.000Z',
      },
    ],
  });
  setPgPoolOverrideForTests(mock.pool);

  const actor = derivePgActorFromAuthUser(OWNER_SALON_1, { targetSalonId: '1' });
  const result = await rescheduleAppointmentByOwner(
    '1',
    'BK-WEB-101',
    { appointmentDate: '2026-12-03', timeSlot: '04:00 PM', barberName: 'Tariq Mehmood' },
    actor
  );

  assert.equal(result.ok, true);
  assert.equal(result.statusCode, 200);
  assert.equal(result.appointment?.barberName, 'Tariq Mehmood');
  assert.equal(result.appointment?.timeSlot, '04:00 PM');

  const pgBooking = mock.getState().bookings.find((b) => b.id === bkUuid)!;
  assert.equal(pgBooking.stylist_id, 'sty-2');
  assert.equal(pgBooking.starts_at, '2026-12-03T11:00:00.000Z');
  assert.equal(pgBooking.ends_at, '2026-12-03T11:35:00.000Z');
  assert.equal(mock.getState().usageMonthly[0].billable_bookings, 1);
  assert.equal(mock.getState().bookingAuditLog.length, 1);
  assert.equal(mock.getState().bookingAuditLog[0].actor_type, 'OWNER');
  assert.equal(mock.getState().bookingAuditLog[0].action, 'RESCHEDULED');
  assert.equal(mock.getState().counterNotifications.length, 1);
  assert.ok(mock.queries.some((q) => q.text.includes('FOR UPDATE OF b')));
});

test('2. Public access-token lookup & rescheduling narrow PUBLIC_FLOW context and reject tampered/legacy tokens', async () => {
  const bkUuid = '00000000-0000-4000-8000-000000000102';
  const rawToken = makeBookingToken('wc_7k9m2p4x8q2a');
  const mock = createStatefulMockPgPool({
    bookings: [
      {
        id: bkUuid,
        salon_id: '1',
        client_id: 'cli-1',
        stylist_id: 'sty-1',
        booking_ref: 'BK-WEB-102',
        services_snapshot: [{ id: 'svc-1', name: 'Classic Haircut', price: 1200, durationMins: 35 }],
        total_price: 1200,
        total_duration_mins: 35,
        starts_at: '2026-12-03T07:00:00.000Z',
        ends_at: '2026-12-03T07:35:00.000Z',
        status: 'CONFIRMED',
        source: 'WEB_LINK',
        deal_id: null,
        idempotency_key: null,
        proof_hash: 'proof-102',
        completed_at: null,
        created_at: '2026-12-01T10:00:00.000Z',
      },
    ],
    bookingAccessTokens: [
      {
        id: 'tok-102',
        token_hash: hashToken(rawToken),
        booking_id: bkUuid,
        salon_id: '1',
        expires_at: '2026-12-10T07:35:00.000Z',
        revoked_at: null,
      },
    ],
  });
  setPgPoolOverrideForTests(mock.pool);

  // Lookup succeeds via PUBLIC_FLOW narrowing
  const loaded = await getBookingByAccessToken(rawToken);
  assert.ok(loaded);
  assert.equal(loaded.bookingRef, 'BK-WEB-102');
  assert.equal(loaded.googleReviewUrl, null); // Not completed yet

  // Tampered salon prefix or legacy opaque token fails closed (404)
  assert.equal(await getBookingByAccessToken(makeBookingToken('wc_3r8v5n2w9c4j')), null);
  assert.equal(await getBookingByAccessToken('legacy-opaque-token-without-prefix'), null);

  // Reschedule via token
  const res = await rescheduleBookingByAccessToken(rawToken, {
    appointmentDate: '2026-12-03',
    timeSlot: '05:00 PM',
    barberName: 'Tariq Mehmood',
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.ok, true);
  assert.equal(res.booking?.timeSlot, '05:00 PM');
  assert.equal(res.booking?.barberName, 'Tariq Mehmood');

  const pgBooking = mock.getState().bookings.find((b) => b.id === bkUuid)!;
  assert.equal(pgBooking.starts_at, '2026-12-03T12:00:00.000Z');
  assert.equal(pgBooking.stylist_id, 'sty-2');
  assert.equal(mock.getState().usageMonthly[0].billable_bookings, 1);
  assert.equal(mock.getState().bookingAuditLog[0].actor_type, 'CUSTOMER');
  assert.equal(mock.getState().bookingAuditLog[0].action, 'RESCHEDULED');

  // Verify token query executed with narrowed PUBLIC_FLOW salon_id='1' and scoped token_hash GUC
  const tokQuery = mock.queries.find((q) => q.text.includes('FROM booking_access_tokens bat'));
  assert.equal(tokQuery?.gucs['app.current_user_role'], 'PUBLIC_FLOW');
  assert.equal(tokQuery?.gucs['app.current_salon_id'], '1');
  assert.equal(tokQuery?.scopedGucs['app.current_token_hash'], hashToken(rawToken));
  assert.ok(
    mock.queries.some((q) => q.text.includes('FROM get_public_stylist_busy_blocks(')),
    'Expected PUBLIC_FLOW availability reschedule check to use get_public_stylist_busy_blocks()'
  );
});

test('3. Public access-token cancellation frees slot, preserves quota, leaves canceled view intact, and blocks completed cancel', async () => {
  const bkActiveId = '00000000-0000-4000-8000-000000000103';
  const bkDoneId = '00000000-0000-4000-8000-000000000104';
  const activeToken = makeBookingToken('wc_7k9m2p4x8q2a', 'active-secret-token-1234');
  const doneToken = makeBookingToken('wc_7k9m2p4x8q2a', 'done-secret-token-123456');

  const mock = createStatefulMockPgPool({
    bookings: [
      {
        id: bkActiveId,
        salon_id: '1',
        client_id: 'cli-1',
        stylist_id: 'sty-1',
        booking_ref: 'BK-WEB-103',
        services_snapshot: [{ id: 'svc-1', name: 'Classic Haircut', price: 1200, durationMins: 35 }],
        total_price: 1200,
        total_duration_mins: 35,
        starts_at: '2026-12-03T07:00:00.000Z',
        ends_at: '2026-12-03T07:35:00.000Z',
        status: 'CONFIRMED',
        source: 'WEB_LINK',
        deal_id: null,
        idempotency_key: null,
        proof_hash: 'proof-103',
        completed_at: null,
        created_at: '2026-12-01T10:00:00.000Z',
      },
      {
        id: bkDoneId,
        salon_id: '1',
        client_id: 'cli-1',
        stylist_id: 'sty-2',
        booking_ref: 'BK-WEB-104',
        services_snapshot: [{ id: 'svc-1', name: 'Classic Haircut', price: 1200, durationMins: 35 }],
        total_price: 1200,
        total_duration_mins: 35,
        starts_at: '2026-12-03T09:00:00.000Z',
        ends_at: '2026-12-03T09:35:00.000Z',
        status: 'COMPLETED',
        source: 'WEB_LINK',
        deal_id: null,
        idempotency_key: null,
        proof_hash: 'proof-104',
        completed_at: '2026-12-03T09:35:00.000Z',
        created_at: '2026-12-01T10:00:00.000Z',
      },
    ],
    bookingAccessTokens: [
      {
        id: 'tok-103',
        token_hash: hashToken(activeToken),
        booking_id: bkActiveId,
        salon_id: '1',
        expires_at: '2026-12-10T07:35:00.000Z',
        revoked_at: null,
      },
      {
        id: 'tok-104',
        token_hash: hashToken(doneToken),
        booking_id: bkDoneId,
        salon_id: '1',
        expires_at: '2026-12-10T09:35:00.000Z',
        revoked_at: null,
      },
    ],
  });
  setPgPoolOverrideForTests(mock.pool);

  // Completed booking cannot be canceled (409)
  const deniedCancel = await cancelBookingByAccessToken(doneToken, 'Too late');
  assert.equal(deniedCancel.statusCode, 409);
  assert.equal(deniedCancel.ok, false);

  // Active booking cancels cleanly
  const canceled = await cancelBookingByAccessToken(activeToken, 'Flight delayed');
  assert.equal(canceled.statusCode, 200);
  assert.equal(canceled.ok, true);
  assert.equal(canceled.booking?.status, 'CANCELED');
  assert.equal(mock.getState().usageMonthly[0].billable_bookings, 1);
  assert.equal(mock.getState().bookingAuditLog[0].action, 'CANCELED');
  assert.equal(mock.getState().counterNotifications[0].event_type, 'CANCELED');

  // Portal still loads CANCELED state cleanly
  const viewedAfter = await getBookingByAccessToken(activeToken);
  assert.equal(viewedAfter?.status, 'CANCELED');

  // Slot 12:00 PM for Master Aslam is now free again
  const avail = await getAvailableSlotsAndBarbers({
    salonId: '1',
    date: '2026-12-03',
    durationMins: 35,
    actor: createPublicFlowSalonActor('1'),
  });
  const noonSlot = avail.slots.find((s) => s.timeSlot === '12:00 PM');
  const aslamNoon = noonSlot?.barbers.find((b) => b.name === 'Master Aslam');
  assert.equal(aslamNoon?.available, true);
});

test('4. Appointment completion and visit recording atomically updates Postgres booking + client visits (including walk-ins and idempotency)', async () => {
  const bkUuid = '00000000-0000-4000-8000-000000000105';
  const mock = createStatefulMockPgPool({
    bookings: [
      {
        id: bkUuid,
        salon_id: '1',
        client_id: 'cli-1',
        stylist_id: 'sty-1',
        booking_ref: 'BK-WEB-105',
        services_snapshot: [{ id: 'svc-1', name: 'Skin Fade', price: 1500, durationMins: 35 }],
        total_price: 1500,
        total_duration_mins: 35,
        starts_at: '2026-12-03T07:00:00.000Z',
        ends_at: '2026-12-03T07:35:00.000Z',
        status: 'IN_CHAIR',
        source: 'WEB_QR',
        deal_id: null,
        idempotency_key: null,
        proof_hash: 'proof-105',
        completed_at: null,
        created_at: '2026-12-01T10:00:00.000Z',
      },
    ],
  });
  setPgPoolOverrideForTests(mock.pool);

  const actor = derivePgActorFromAuthUser(OWNER_SALON_1, { targetSalonId: '1' });

  // Complete existing booking -> total_visits increments 1 -> 2
  const done1 = await completeAppointmentAndRecordVisit(
    '1',
    {
      appointmentId: 'BK-WEB-105',
      clientName: 'Hamza Khan',
      clientPhone: '+923001234567',
      barberName: 'Master Aslam',
      service: 'Skin Fade',
      price: 1500,
      timeSlot: '12:00 PM',
      birthDate: '05-14',
    },
    actor
  );
  assert.equal(done1.appointment.status, 'COMPLETED');
  assert.equal(done1.client.totalVisits, 2);
  assert.ok(done1.client.lastCompletedVisitAt);
  assert.equal(mock.getState().clients.find((c) => c.id === 'cli-1')?.total_visits, 2);

  // Idempotent retry on same completed booking does NOT double-increment visits
  const doneRetry = await completeAppointmentAndRecordVisit(
    '1',
    {
      appointmentId: 'BK-WEB-105',
      clientName: 'Hamza Khan',
      clientPhone: '+923001234567',
      barberName: 'Master Aslam',
      service: 'Skin Fade',
      price: 1500,
      timeSlot: '12:00 PM',
    },
    actor
  );
  assert.equal(doneRetry.client.totalVisits, 2);

  // Ad-hoc walk-in completion inserts new client + booking atomically
  const walkin = await completeAppointmentAndRecordVisit(
    '1',
    {
      appointmentId: 'WALKIN-900',
      clientName: 'Bilal Ahmed',
      clientPhone: '+923009998811',
      barberName: 'Tariq Mehmood',
      service: 'Beard Trim',
      price: 800,
      timeSlot: '01:00 PM',
    },
    actor
  );
  assert.equal(walkin.appointment.status, 'COMPLETED');
  assert.equal(walkin.client.totalVisits, 1);
  assert.equal(mock.getState().bookings.some((b) => b.booking_ref === 'WALKIN-900'), true);
});

test('5. Appointment status transitions enforce lifecycle state machine in PostgreSQL', async () => {
  const bkId = '00000000-0000-4000-8000-000000000106';
  const bkCanceledId = '00000000-0000-4000-8000-000000000107';
  const mock = createStatefulMockPgPool({
    bookings: [
      {
        id: bkId,
        salon_id: '1',
        client_id: 'cli-1',
        stylist_id: 'sty-1',
        booking_ref: 'BK-WEB-106',
        services_snapshot: [{ name: 'Haircut', price: 1000, durationMins: 35 }],
        total_price: 1000,
        total_duration_mins: 35,
        starts_at: '2026-12-03T07:00:00.000Z',
        ends_at: '2026-12-03T07:35:00.000Z',
        status: 'CONFIRMED',
        source: 'WEB_LINK',
        deal_id: null,
        idempotency_key: null,
        proof_hash: 'proof-106',
        completed_at: null,
        created_at: '2026-12-01T10:00:00.000Z',
      },
      {
        id: bkCanceledId,
        salon_id: '1',
        client_id: 'cli-1',
        stylist_id: 'sty-2',
        booking_ref: 'BK-WEB-107',
        services_snapshot: [{ name: 'Haircut', price: 1000, durationMins: 35 }],
        total_price: 1000,
        total_duration_mins: 35,
        starts_at: '2026-12-03T08:00:00.000Z',
        ends_at: '2026-12-03T08:35:00.000Z',
        status: 'CANCELED',
        source: 'WEB_LINK',
        deal_id: null,
        idempotency_key: null,
        proof_hash: 'proof-107',
        completed_at: null,
        created_at: '2026-12-01T10:00:00.000Z',
      },
    ],
  });
  setPgPoolOverrideForTests(mock.pool);
  const actor = derivePgActorFromAuthUser(OWNER_SALON_1, { targetSalonId: '1' });

  const inChair = await updateAppointmentStatus('1', 'BK-WEB-106', 'IN_CHAIR', actor);
  assert.equal(inChair.ok, true);
  if (inChair.ok) assert.equal(inChair.appointment.status, 'IN_CHAIR');

  const completed = await updateAppointmentStatus('1', 'BK-WEB-106', 'COMPLETED', actor);
  assert.equal(completed.ok, true);
  if (completed.ok) {
    assert.equal(completed.appointment.status, 'COMPLETED');
    assert.equal(mock.getState().clients.find((c) => c.id === 'cli-1')?.total_visits, 2);
  }

  // Invalid transitions from COMPLETED
  const reopenCompleted = await updateAppointmentStatus('1', 'BK-WEB-106', 'CONFIRMED', actor);
  assert.equal(reopenCompleted.ok, false);
  if (!reopenCompleted.ok) assert.equal(reopenCompleted.statusCode, 409);

  const cancelCompleted = await updateAppointmentStatus('1', 'BK-WEB-106', 'CANCELED', actor);
  assert.equal(cancelCompleted.ok, false);
  if (!cancelCompleted.ok) assert.equal(cancelCompleted.statusCode, 409);

  // Invalid transition from CANCELED
  const reopenCanceled = await updateAppointmentStatus('1', 'BK-WEB-107', 'COMPLETED', actor);
  assert.equal(reopenCanceled.ok, false);
  if (!reopenCanceled.ok) assert.equal(reopenCanceled.statusCode, 409);
});

test('6. Availability calculation uses PostgreSQL bookings & leaves authoritatively and blocks conflicting reschedules', async () => {
  const mock = createStatefulMockPgPool({
    bookings: [
      {
        id: '00000000-0000-4000-8000-000000000108',
        salon_id: '1',
        client_id: 'cli-1',
        stylist_id: 'sty-1',
        booking_ref: 'BK-WEB-108',
        services_snapshot: [{ name: 'Haircut', price: 1000, durationMins: 40 }],
        total_price: 1000,
        total_duration_mins: 40,
        starts_at: '2026-12-04T06:00:00.000Z', // 11:00 AM UTC+5 (Friday)
        ends_at: '2026-12-04T06:40:00.000Z',
        status: 'CONFIRMED',
        source: 'WEB_LINK',
        deal_id: null,
        idempotency_key: null,
        proof_hash: 'proof-108',
        completed_at: null,
        created_at: '2026-12-01T10:00:00.000Z',
      },
      {
        id: '00000000-0000-4000-8000-000000000109',
        salon_id: '1',
        client_id: 'cli-1',
        stylist_id: 'sty-2',
        booking_ref: 'BK-WEB-109',
        services_snapshot: [{ name: 'Haircut', price: 1000, durationMins: 35 }],
        total_price: 1000,
        total_duration_mins: 35,
        starts_at: '2026-12-04T11:00:00.000Z', // 04:00 PM UTC+5
        ends_at: '2026-12-04T11:35:00.000Z',
        status: 'CONFIRMED',
        source: 'WEB_LINK',
        deal_id: null,
        idempotency_key: null,
        proof_hash: 'proof-109',
        completed_at: null,
        created_at: '2026-12-01T10:00:00.000Z',
      },
    ],
    stylistLeaves: [
      {
        id: 'lv-1',
        salon_id: '1',
        stylist_id: 'sty-2',
        lock_type: 'LEAVE',
        starts_at: '2026-12-04T05:00:00.000Z', // 10:00 AM UTC+5
        ends_at: '2026-12-04T08:00:00.000Z', // 01:00 PM UTC+5
        reason: 'Morning Leave',
      },
    ],
  });
  setPgPoolOverrideForTests(mock.pool);

  const avail = await getAvailableSlotsAndBarbers({
    salonId: '1',
    date: '2026-12-04', // Friday -> has 01:00 PM - 02:30 PM prayer break
    durationMins: 35,
    actor: createPublicFlowSalonActor('1'),
  });
  assert.equal(avail.isOpen, true);
  // 01:00 PM and 01:30 PM overlap Friday Prayer Break -> excluded
  assert.equal(avail.slots.some((s) => s.timeSlot === '01:00 PM'), false);
  assert.equal(avail.slots.some((s) => s.timeSlot === '01:30 PM'), false);
  // At 11:00 AM: Master Aslam is booked in Postgres AND Tariq Mehmood is on leave -> 11:00 AM omitted (0 available)
  assert.equal(avail.slots.some((s) => s.timeSlot === '11:00 AM'), false);
  // At 04:00 PM: Tariq Mehmood is booked, Master Aslam is available
  const slot4pm = avail.slots.find((s) => s.timeSlot === '04:00 PM');
  assert.ok(slot4pm);
  assert.equal(slot4pm.barbers.find((b) => b.name === 'Tariq Mehmood')?.available, false);
  assert.equal(slot4pm.barbers.find((b) => b.name === 'Master Aslam')?.available, true);

  // Attempting to reschedule BK-WEB-108 onto Tariq Mehmood at 04:00 PM fails with 409 conflict
  const actor = derivePgActorFromAuthUser(OWNER_SALON_1, { targetSalonId: '1' });
  const conflictRes = await rescheduleAppointmentByOwner(
    '1',
    'BK-WEB-108',
    { appointmentDate: '2026-12-04', timeSlot: '04:00 PM', barberName: 'Tariq Mehmood' },
    actor
  );
  assert.equal(conflictRes.ok, false);
  assert.equal(conflictRes.statusCode, 409);
});

test('7 & 8. Cross-tenant access and missing/invalid identities fail closed across service functions and Express routes', async () => {
  const mock = createStatefulMockPgPool();
  setPgPoolOverrideForTests(mock.pool);

  const owner1Actor = derivePgActorFromAuthUser(OWNER_SALON_1, { targetSalonId: '1' });
  const agentActor = derivePgActorFromAuthUser(AGENT_USER);

  // Cross-tenant SALON_OWNER ('1') targeting salon '2' -> 0 DB connections
  await assert.rejects(
    () =>
      rescheduleAppointmentByOwner(
        '2',
        'BK-2',
        { appointmentDate: '2026-12-03', timeSlot: '04:00 PM' },
        owner1Actor
      ),
    (err: unknown) => err instanceof PgContextError && err.code === 'FORBIDDEN_TENANT'
  );
  await assert.rejects(
    () => updateAppointmentStatus('2', 'BK-2', 'COMPLETED', owner1Actor),
    (err: unknown) => err instanceof PgContextError && err.code === 'FORBIDDEN_TENANT'
  );
  await assert.rejects(
    () =>
      completeAppointmentAndRecordVisit(
        '2',
        {
          appointmentId: 'BK-2',
          clientName: 'Test',
          clientPhone: '+923001112233',
          barberName: 'Ali Raza',
          service: 'Cut',
          price: 1000,
          timeSlot: '12:00 PM',
        },
        owner1Actor
      ),
    (err: unknown) => err instanceof PgContextError && err.code === 'FORBIDDEN_TENANT'
  );
  await assert.rejects(
    () =>
      getAvailableSlotsAndBarbers({
        salonId: '2',
        date: '2026-12-03',
        actor: owner1Actor,
      }),
    (err: unknown) => err instanceof PgContextError && err.code === 'FORBIDDEN_TENANT'
  );

  // Missing identity or AGENT role -> fail closed with 0 DB connections
  await assert.rejects(
    () => updateAppointmentStatus('1', 'BK-1', 'COMPLETED', undefined as never),
    (err: unknown) => err instanceof PgContextError && err.code === 'MISSING_IDENTITY'
  );
  await assert.rejects(
    () => updateAppointmentStatus('1', 'BK-1', 'COMPLETED', agentActor),
    (err: unknown) => err instanceof PgContextError && err.code === 'PRIVILEGE_ESCALATION'
  );
  await assert.rejects(
    () => getAvailableSlotsAndBarbers({ salonId: '1', date: '2026-12-03', actor: agentActor }),
    (err: unknown) => err instanceof PgContextError && err.code === 'PRIVILEGE_ESCALATION'
  );
  assert.equal(mock.getConnectCount(), 0);

  // Express HTTP route checks (cross-tenant 403 + spoofed req.query/req.body ignored)
  const app = createApiApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  try {
    const addr = server.address();
    assert.ok(addr && typeof addr === 'object');
    const baseUrl = `http://127.0.0.1:${addr.port}`;
    const ownerJwt = signSessionToken(OWNER_SALON_1);

    const crossRes = await fetch(`${baseUrl}/api/salons/2/appointments/BK-2/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerJwt}` },
      body: JSON.stringify({ status: 'COMPLETED' }),
    });
    assert.equal(crossRes.status, 403);
    assert.equal(mock.getConnectCount(), 0);

    // Spoofed FOUNDER/salonId=2 in query+body on owned salon '1' route still uses JWT SALON_OWNER('1')
    const spoofRes = await fetch(
      `${baseUrl}/api/salons/1/appointments/complete?role=FOUNDER&salonId=2`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerJwt}` },
        body: JSON.stringify({
          role: 'FOUNDER',
          salonId: '2',
          appointmentId: 'WALKIN-HTTP-1',
          clientName: 'HTTP Walkin',
          clientPhone: '+923005556677',
          barberName: 'Master Aslam',
          service: 'Haircut',
          price: 1000,
          timeSlot: '02:00 PM',
        }),
      }
    );
    assert.equal(spoofRes.status, 200);
    const setCfg = mock.queries.find((q) => q.text.includes("set_config('app.current_user_role'"));
    assert.deepEqual(setCfg?.params, ['SALON_OWNER', '1', '', 'usr-owner-1']);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('9. Mid-transaction failure triggers ROLLBACK and leaves PostgreSQL bookings/visits untouched (no KV fallback)', async () => {
  const bkUuid = '00000000-0000-4000-8000-000000000110';
  const mock = createStatefulMockPgPool({
    bookings: [
      {
        id: bkUuid,
        salon_id: '1',
        client_id: 'cli-1',
        stylist_id: 'sty-1',
        booking_ref: 'BK-WEB-110',
        services_snapshot: [{ name: 'Haircut', price: 1200, durationMins: 35 }],
        total_price: 1200,
        total_duration_mins: 35,
        starts_at: '2026-12-03T07:00:00.000Z',
        ends_at: '2026-12-03T07:35:00.000Z',
        status: 'CONFIRMED',
        source: 'WEB_LINK',
        deal_id: null,
        idempotency_key: null,
        proof_hash: 'proof-110',
        completed_at: null,
        created_at: '2026-12-01T10:00:00.000Z',
      },
    ],
  });
  setPgPoolOverrideForTests(mock.pool);
  mock.setFailOnQuerySubstring('INSERT INTO booking_audit_log');

  const actor = derivePgActorFromAuthUser(OWNER_SALON_1, { targetSalonId: '1' });

  // completeAppointmentAndRecordVisit fails closed with 503 BookingLifecycleError and rolls back clients + bookings updates
  await assert.rejects(
    () =>
      completeAppointmentAndRecordVisit(
        '1',
        {
          appointmentId: 'BK-WEB-110',
          clientName: 'Hamza Khan',
          clientPhone: '+923001234567',
          barberName: 'Master Aslam',
          service: 'Haircut',
          price: 1200,
          timeSlot: '12:00 PM',
        },
        actor
      ),
    (err: unknown) => err instanceof BookingLifecycleError && err.statusCode === 503
  );

  assert.equal(mock.queries[mock.queries.length - 1].text, 'ROLLBACK');
  assert.equal(mock.getState().bookings[0].status, 'CONFIRMED');
  assert.equal(mock.getState().clients.find((c) => c.id === 'cli-1')?.total_visits, 1);
  assert.deepEqual(mock.getCurrentGucs(), {
    'app.current_user_role': '',
    'app.current_salon_id': '',
    'app.current_agent_id': '',
    'app.current_user_id': '',
  });
});

test('10. Concurrent exclusion violation (23P01) rolls back cleanly and returns 409 conflict without corrupting state', async () => {
  const bkUuid = '00000000-0000-4000-8000-000000000111';
  const rawToken = makeBookingToken('wc_7k9m2p4x8q2a', 'concurrent-secret-9999');
  const mock = createStatefulMockPgPool({
    bookings: [
      {
        id: bkUuid,
        salon_id: '1',
        client_id: 'cli-1',
        stylist_id: 'sty-1',
        booking_ref: 'BK-WEB-111',
        services_snapshot: [{ name: 'Haircut', price: 1200, durationMins: 35 }],
        total_price: 1200,
        total_duration_mins: 35,
        starts_at: '2026-12-03T07:00:00.000Z',
        ends_at: '2026-12-03T07:35:00.000Z',
        status: 'CONFIRMED',
        source: 'WEB_LINK',
        deal_id: null,
        idempotency_key: null,
        proof_hash: 'proof-111',
        completed_at: null,
        created_at: '2026-12-01T10:00:00.000Z',
      },
    ],
    bookingAccessTokens: [
      {
        id: 'tok-111',
        token_hash: hashToken(rawToken),
        booking_id: bkUuid,
        salon_id: '1',
        expires_at: '2026-12-10T07:35:00.000Z',
        revoked_at: null,
      },
    ],
  });
  setPgPoolOverrideForTests(mock.pool);
  mock.setSimulateOverlapOnBookingUpdate(true);

  const tokenRes = await rescheduleBookingByAccessToken(rawToken, {
    appointmentDate: '2026-12-03',
    timeSlot: '04:00 PM',
    barberName: 'Tariq Mehmood',
  });
  assert.equal(tokenRes.statusCode, 409);
  assert.equal(tokenRes.ok, false);
  assert.equal(mock.queries[mock.queries.length - 1].text, 'ROLLBACK');
  assert.equal(mock.getState().bookings[0].starts_at, '2026-12-03T07:00:00.000Z');
  assert.equal(mock.getState().bookings[0].stylist_id, 'sty-1');
  assert.equal(mock.getState().bookingAuditLog.length, 0);
});
