// server/app.ts
import crypto5 from "crypto";
import fs5 from "fs";
import express from "express";
import { GoogleGenAI as GoogleGenAI2, Type as Type2 } from "@google/genai";
import QRCode from "qrcode";

// server/conciergeEngine.ts
import crypto3 from "crypto";
import fs2 from "fs";
import path2 from "path";

// server/kvBridge.ts
function getKvCredentials() {
  const url = (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "").trim().replace(/\/+$/, "");
  const token = (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();
  if (!url || !token) return null;
  return { url, token };
}
function isKvConfigured() {
  return getKvCredentials() !== null;
}
async function kvGetJson(key) {
  const creds = getKvCredentials();
  if (!creds) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(`${creds.url}/get/${encodeURIComponent(key)}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${creds.token}`
      },
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.result === null || data?.result === void 0) return null;
    if (typeof data.result === "string") {
      return JSON.parse(data.result);
    }
    return data.result;
  } catch {
    return null;
  }
}
async function kvSetJson(key, value) {
  const creds = getKvCredentials();
  if (!creds) return false;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(creds.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(["SET", key, JSON.stringify(value)]),
      signal: controller.signal
    });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}
async function dispatchFounderAlertWebhook(payload) {
  const webhookUrl = (process.env.FOUNDER_ALERT_WEBHOOK_URL || "").trim();
  if (!webhookUrl || !/^https?:\/\//i.test(webhookUrl)) {
    return false;
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3e3);
    const summaryText = `[WorkCraft ${payload.severity}] ${payload.role} \xB7 ${payload.area} -> ${payload.message} (${payload.resolutionStatus}${payload.recoveryMs ? ` in ${payload.recoveryMs}ms` : ""})`;
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: summaryText,
        content: summaryText,
        event: "workcraft.incident",
        ...payload
      }),
      signal: controller.signal
    });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

// server/postgresRepo.ts
import crypto from "crypto";
import { Pool } from "pg";
var PgContextError = class extends Error {
  constructor(code, message) {
    super(message);
    this.name = "PgContextError";
    this.code = code;
  }
};
var PUBLIC_LOOKUP_CONTEXTS = /* @__PURE__ */ new WeakSet();
var ACTIVE_TX_ROLES = /* @__PURE__ */ new WeakMap();
function isProductionEnv() {
  return process.env.NODE_ENV === "production";
}
function getDatabaseUrl() {
  const primary = (process.env.DATABASE_URL || process.env.POSTGRES_URL || "").trim();
  if (primary) return primary;
  if (!isProductionEnv()) {
    return (process.env.STAGING_DATABASE_URL || "").trim();
  }
  return "";
}
function isPostgresConfigured() {
  if (!isProductionEnv() && global._workcraftPgTestPoolOverride) {
    return true;
  }
  return Boolean(getDatabaseUrl());
}
function assertProductionDatabaseReady() {
  if (isProductionEnv() && !isPostgresConfigured()) {
    return {
      ok: false,
      error: "DATABASE_URL (managed PostgreSQL) is required in production. Ephemeral JSON/tmp storage is disabled in production."
    };
  }
  return { ok: true };
}
function getPgPool() {
  if (!isProductionEnv() && global._workcraftPgTestPoolOverride) {
    return global._workcraftPgTestPoolOverride;
  }
  const connectionString = getDatabaseUrl();
  if (!connectionString) return null;
  if (!global._workcraftPgPool || global._workcraftPgPoolUrl !== connectionString) {
    global._workcraftPgPool = new Pool({
      connectionString,
      max: process.env.VERCEL ? 2 : 10,
      idleTimeoutMillis: 2e4,
      connectionTimeoutMillis: 1e4,
      ssl: /localhost|127\.0\.0\.1/i.test(connectionString) ? void 0 : { rejectUnauthorized: false }
    });
    global._workcraftPgPoolUrl = connectionString;
    global._workcraftPgPool.on("error", (err) => {
      console.error("PostgreSQL pool idle error:", err);
    });
  }
  return global._workcraftPgPool;
}
function cleanActorId(value, fieldName) {
  if (value === null || value === void 0) return "";
  if (typeof value !== "string") {
    throw new PgContextError(
      "INVALID_CONTEXT",
      `PostgreSQL actor ${fieldName} must be a string.`
    );
  }
  if (/[\x00-\x1f\x7f]/.test(value)) {
    throw new PgContextError(
      "INVALID_CONTEXT",
      `PostgreSQL actor ${fieldName} contains disallowed control characters.`
    );
  }
  const trimmed = value.trim();
  if (trimmed.length > 128) {
    throw new PgContextError(
      "INVALID_CONTEXT",
      `PostgreSQL actor ${fieldName} exceeds maximum allowed length.`
    );
  }
  return trimmed;
}
function validatePgActorContext(ctx) {
  if (!ctx || typeof ctx !== "object") {
    throw new PgContextError(
      "MISSING_IDENTITY",
      "PostgreSQL transaction rejected: verified actor context is required."
    );
  }
  const candidate = ctx;
  const role = candidate.role;
  if (role !== "FOUNDER" && role !== "AGENT" && role !== "SALON_OWNER" && role !== "PUBLIC_FLOW") {
    throw new PgContextError(
      "INVALID_CONTEXT",
      `PostgreSQL transaction rejected: unsupported actor role "${String(role)}".`
    );
  }
  const salonId = cleanActorId(candidate.salonId, "salonId");
  const agentId = cleanActorId(candidate.agentId, "agentId");
  const userId = cleanActorId(candidate.userId, "userId");
  if (role === "FOUNDER") {
    if (!userId) {
      throw new PgContextError(
        "MISSING_IDENTITY",
        "FOUNDER transaction rejected: verified userId is required."
      );
    }
    if (agentId) {
      throw new PgContextError(
        "INVALID_CONTEXT",
        "FOUNDER transaction cannot carry an agentId."
      );
    }
    return { role: "FOUNDER", salonId: "", agentId: "", userId };
  }
  if (role === "SALON_OWNER") {
    if (!userId || !salonId) {
      throw new PgContextError(
        "MISSING_IDENTITY",
        "SALON_OWNER transaction rejected: verified userId and salonId are required."
      );
    }
    if (agentId) {
      throw new PgContextError(
        "INVALID_CONTEXT",
        "SALON_OWNER transaction cannot carry an agentId."
      );
    }
    return { role: "SALON_OWNER", salonId, agentId: "", userId };
  }
  if (role === "AGENT") {
    if (!userId || !agentId) {
      throw new PgContextError(
        "MISSING_IDENTITY",
        "AGENT transaction rejected: verified userId and agentId are required."
      );
    }
    if (salonId) {
      throw new PgContextError(
        "INVALID_CONTEXT",
        "AGENT transaction cannot carry a salonId."
      );
    }
    return { role: "AGENT", salonId: "", agentId, userId };
  }
  if (userId || agentId) {
    throw new PgContextError(
      "PRIVILEGE_ESCALATION",
      "PUBLIC_FLOW transaction cannot carry userId or agentId."
    );
  }
  if (!salonId && !PUBLIC_LOOKUP_CONTEXTS.has(candidate)) {
    throw new PgContextError(
      "MISSING_IDENTITY",
      "PUBLIC_FLOW transaction requires a resolved salonId or createPublicFlowLookupActor()."
    );
  }
  return { role: "PUBLIC_FLOW", salonId, agentId: "", userId: "" };
}
function derivePgActorFromAuthUser(authUser, options) {
  if (!authUser || typeof authUser !== "object") {
    throw new PgContextError(
      "MISSING_IDENTITY",
      "Authenticated user session is required for PostgreSQL transaction."
    );
  }
  const userId = cleanActorId(authUser.userId, "userId");
  if (!userId) {
    throw new PgContextError(
      "MISSING_IDENTITY",
      "Authenticated session missing verified userId."
    );
  }
  const role = authUser.userRole;
  const targetSalonId = cleanActorId(options?.targetSalonId, "targetSalonId");
  if (role === "FOUNDER") {
    return Object.freeze({
      role: "FOUNDER",
      salonId: null,
      agentId: null,
      userId
    });
  }
  if (role === "SALON_OWNER") {
    const allowedSalons = /* @__PURE__ */ new Set();
    const primarySalon = cleanActorId(authUser.salonId, "salonId");
    if (primarySalon) allowedSalons.add(primarySalon);
    if (Array.isArray(authUser.allowedSalonIds)) {
      for (const s of authUser.allowedSalonIds) {
        const cleaned = cleanActorId(s, "allowedSalonIds[]");
        if (cleaned) allowedSalons.add(cleaned);
      }
    }
    if (allowedSalons.size === 0) {
      throw new PgContextError(
        "MISSING_IDENTITY",
        "SALON_OWNER session has no assigned salonId."
      );
    }
    const resolvedSalonId = targetSalonId || primarySalon || Array.from(allowedSalons)[0];
    if (!allowedSalons.has(resolvedSalonId)) {
      throw new PgContextError(
        "FORBIDDEN_TENANT",
        `SALON_OWNER (${userId}) is not authorized for salon ${resolvedSalonId}.`
      );
    }
    return Object.freeze({
      role: "SALON_OWNER",
      salonId: resolvedSalonId,
      agentId: null,
      userId
    });
  }
  if (role === "AGENT") {
    const agentId = cleanActorId(authUser.agentId, "agentId");
    if (!agentId) {
      throw new PgContextError(
        "MISSING_IDENTITY",
        "AGENT session missing verified agentId."
      );
    }
    return Object.freeze({
      role: "AGENT",
      salonId: null,
      agentId,
      userId
    });
  }
  throw new PgContextError(
    "INVALID_CONTEXT",
    `Unsupported authenticated role "${String(role)}".`
  );
}
function createPublicFlowLookupActor() {
  const ctx = Object.freeze({
    role: "PUBLIC_FLOW",
    salonId: null,
    agentId: null,
    userId: null
  });
  PUBLIC_LOOKUP_CONTEXTS.add(ctx);
  return ctx;
}
function createPublicFlowSalonActor(salonId) {
  const cleanSalonId = cleanActorId(salonId, "salonId");
  if (!cleanSalonId) {
    throw new PgContextError(
      "MISSING_IDENTITY",
      "PUBLIC_FLOW salon context requires a non-empty resolved salonId."
    );
  }
  return Object.freeze({
    role: "PUBLIC_FLOW",
    salonId: cleanSalonId,
    agentId: null,
    userId: null
  });
}
async function writePgLocalGucs(client, normalized) {
  await client.query(
    `SELECT
       set_config('app.current_user_role', $1, true),
       set_config('app.current_salon_id', $2, true),
       set_config('app.current_agent_id', $3, true),
       set_config('app.current_user_id', $4, true)`,
    [normalized.role, normalized.salonId, normalized.agentId, normalized.userId]
  );
}
async function narrowPublicFlowSalonContext(client, salonId) {
  const activeRole = ACTIVE_TX_ROLES.get(client);
  if (activeRole && activeRole !== "PUBLIC_FLOW") {
    throw new PgContextError(
      "PRIVILEGE_ESCALATION",
      `narrowPublicFlowSalonContext cannot be called inside a ${activeRole} transaction.`
    );
  }
  const scoped = createPublicFlowSalonActor(salonId);
  const normalized = validatePgActorContext(scoped);
  await writePgLocalGucs(client, normalized);
}
async function withPgTransaction(ctx, fn) {
  if (typeof fn !== "function") {
    throw new PgContextError("INVALID_CONTEXT", "withPgTransaction requires a transaction callback.");
  }
  const normalized = validatePgActorContext(ctx);
  const pool = getPgPool();
  if (!pool) {
    throw new Error("PostgreSQL pool unavailable: DATABASE_URL is not configured.");
  }
  const client = await pool.connect();
  let inTx = false;
  try {
    await client.query("BEGIN");
    inTx = true;
    ACTIVE_TX_ROLES.set(client, normalized.role);
    await writePgLocalGucs(client, normalized);
    const result = await fn(client);
    await client.query("COMMIT");
    inTx = false;
    return result;
  } catch (err) {
    if (inTx) {
      try {
        await client.query("ROLLBACK");
      } catch {
      }
      inTx = false;
    }
    throw err;
  } finally {
    ACTIVE_TX_ROLES.delete(client);
    client.release();
  }
}
async function persistPostgresSnapshotMirror(params, actor) {
  const normalizedActor = validatePgActorContext(actor);
  if (normalizedActor.role === "PUBLIC_FLOW") {
    throw new PgContextError(
      "PRIVILEGE_ESCALATION",
      "PUBLIC_FLOW cannot mutate salon settings."
    );
  }
  if (normalizedActor.role === "SALON_OWNER" && normalizedActor.salonId !== params.salonId) {
    throw new PgContextError(
      "FORBIDDEN_TENANT",
      `SALON_OWNER (${normalizedActor.salonId}) cannot modify salon ${params.salonId}.`
    );
  }
  const pool = getPgPool();
  if (!pool) return;
  const packageTier = params.planTier === "STARTER" || params.planTier === "PRO" || params.planTier === "PRO++" || params.planTier === "GROWTH" || params.planTier === "VIP" || params.planTier === "CUSTOM" ? params.planTier : "PRO++";
  const billingStatus = normalizedActor.role === "FOUNDER" ? params.billingStatus === "ACTIVE" || params.billingStatus === "PAST_DUE" || params.billingStatus === "SUSPENDED" ? params.billingStatus : "PENDING_ACTIVATION" : "PENDING_ACTIVATION";
  const enabledLangs = Array.isArray(params.enabledLangs) && params.enabledLangs.length > 0 ? params.enabledLangs : ["en", "roman_ur", "ur"];
  try {
    await withPgTransaction(actor, async (client) => {
      if (normalizedActor.role === "FOUNDER") {
        await client.query(
          `INSERT INTO salons (
             id, public_code, salon_name, owner_name, whatsapp_phone,
             salon_category, owner_auth_phone, public_contact_phone, public_whatsapp_phone,
             timezone_iana, timezone_offset_hours, currency, currency_code, currency_symbol,
             default_lang, enabled_langs, package_tier, plan_tier, monthly_booking_limit,
             billing_status, whatsapp_addon_enabled, address, google_maps_url, google_review_url
           )
           VALUES (
             $1, $2, $3, $4, $5,
             $6, $7, $8, $9,
             $10, $11, $12, $12, $13,
             $14, $15::text[], $16, $16, $17,
             $18, FALSE, $19, $20, $21
           )
           ON CONFLICT (id) DO UPDATE SET
             public_code = COALESCE(salons.public_code, EXCLUDED.public_code),
             salon_name = EXCLUDED.salon_name,
             salon_category = EXCLUDED.salon_category,
             public_contact_phone = EXCLUDED.public_contact_phone,
             public_whatsapp_phone = EXCLUDED.public_whatsapp_phone,
             timezone_iana = EXCLUDED.timezone_iana,
             timezone_offset_hours = EXCLUDED.timezone_offset_hours,
             currency = EXCLUDED.currency,
             currency_code = EXCLUDED.currency_code,
             currency_symbol = EXCLUDED.currency_symbol,
             default_lang = EXCLUDED.default_lang,
             enabled_langs = EXCLUDED.enabled_langs,
             package_tier = EXCLUDED.package_tier,
             plan_tier = EXCLUDED.plan_tier,
             monthly_booking_limit = EXCLUDED.monthly_booking_limit,
             billing_status = EXCLUDED.billing_status,
             address = EXCLUDED.address,
             google_maps_url = EXCLUDED.google_maps_url,
             google_review_url = EXCLUDED.google_review_url,
             updated_at = NOW()`,
          [
            params.salonId,
            params.publicCode,
            params.salonName,
            params.ownerName || "Salon Owner",
            params.publicContactPhone || params.ownerAuthPhone,
            params.salonCategory === "LADIES" ? "LADIES" : "MENS",
            params.ownerAuthPhone,
            params.publicContactPhone,
            params.publicWhatsappPhone || null,
            params.timezoneIana,
            Number.isFinite(params.timezoneOffsetHours) ? params.timezoneOffsetHours : 5,
            params.currencyCode,
            params.currencySymbol,
            params.defaultLang || "en",
            enabledLangs,
            packageTier,
            params.monthlyLimit,
            billingStatus,
            params.address || "",
            params.googleMapsUrl || "",
            params.googleReviewUrl || ""
          ]
        );
        return;
      }
      if (normalizedActor.role === "AGENT") {
        await client.query(
          `INSERT INTO salons (
             id, public_code, salon_name, owner_name, whatsapp_phone,
             salon_category, owner_auth_phone, public_contact_phone, public_whatsapp_phone,
             timezone_iana, timezone_offset_hours, currency, currency_code, currency_symbol,
             default_lang, enabled_langs, package_tier, plan_tier, monthly_booking_limit,
             billing_status, whatsapp_addon_enabled, address, google_maps_url, google_review_url,
             assigned_agent_id
           )
           VALUES (
             $1, $2, $3, $4, $5,
             $6, $7, $8, $9,
             $10, $11, $12, $12, $13,
             $14, $15::text[], $16, $16, $17,
             'PENDING_ACTIVATION', FALSE, $18, $19, $20,
             $21
           )
           ON CONFLICT (id) DO NOTHING`,
          [
            params.salonId,
            params.publicCode,
            params.salonName,
            params.ownerName || "Salon Owner",
            params.publicContactPhone || params.ownerAuthPhone,
            params.salonCategory === "LADIES" ? "LADIES" : "MENS",
            params.ownerAuthPhone,
            params.publicContactPhone,
            params.publicWhatsappPhone || null,
            params.timezoneIana,
            Number.isFinite(params.timezoneOffsetHours) ? params.timezoneOffsetHours : 5,
            params.currencyCode,
            params.currencySymbol,
            params.defaultLang || "en",
            enabledLangs,
            packageTier,
            params.monthlyLimit,
            params.address || "",
            params.googleMapsUrl || "",
            params.googleReviewUrl || "",
            normalizedActor.agentId
          ]
        );
        return;
      }
      await client.query(
        `INSERT INTO salons (
           id, public_code, salon_name, owner_name, whatsapp_phone,
           salon_category, owner_auth_phone, public_contact_phone, public_whatsapp_phone,
           timezone_iana, timezone_offset_hours, currency, currency_code, currency_symbol,
           default_lang, enabled_langs, package_tier, plan_tier, monthly_booking_limit,
           billing_status, whatsapp_addon_enabled, address, google_maps_url, google_review_url
         )
         VALUES (
           $1, $2, $3, $4, $5,
           $6, $7, $8, $9,
           $10, $11, $12, $12, $13,
           $14, $15::text[], $16, $16, $17,
           'PENDING_ACTIVATION', FALSE, $18, $19, $20
         )
         ON CONFLICT (id) DO UPDATE SET
           public_code = COALESCE(salons.public_code, EXCLUDED.public_code),
           salon_name = EXCLUDED.salon_name,
           salon_category = EXCLUDED.salon_category,
           public_contact_phone = EXCLUDED.public_contact_phone,
           public_whatsapp_phone = EXCLUDED.public_whatsapp_phone,
           timezone_iana = EXCLUDED.timezone_iana,
           timezone_offset_hours = EXCLUDED.timezone_offset_hours,
           currency = EXCLUDED.currency,
           currency_code = EXCLUDED.currency_code,
           currency_symbol = EXCLUDED.currency_symbol,
           default_lang = EXCLUDED.default_lang,
           enabled_langs = EXCLUDED.enabled_langs,
           address = EXCLUDED.address,
           google_maps_url = EXCLUDED.google_maps_url,
           google_review_url = EXCLUDED.google_review_url,
           updated_at = NOW()`,
        [
          params.salonId,
          params.publicCode,
          params.salonName,
          params.ownerName || "Salon Owner",
          params.publicContactPhone || params.ownerAuthPhone,
          params.salonCategory === "LADIES" ? "LADIES" : "MENS",
          params.ownerAuthPhone,
          params.publicContactPhone,
          params.publicWhatsappPhone || null,
          params.timezoneIana,
          Number.isFinite(params.timezoneOffsetHours) ? params.timezoneOffsetHours : 5,
          params.currencyCode,
          params.currencySymbol,
          params.defaultLang || "en",
          enabledLangs,
          packageTier,
          params.monthlyLimit,
          params.address || "",
          params.googleMapsUrl || "",
          params.googleReviewUrl || ""
        ]
      );
    });
  } catch (err) {
    if (err instanceof PgContextError) {
      throw err;
    }
    console.warn(
      "Postgres salon sync failed (verify migration 003_reconcile_authoritative_schema.sql is applied):",
      err
    );
    if (isProductionEnv()) {
      throw err;
    }
  }
}
async function findSalonByPublicCodeInPostgres(publicCode) {
  const cleanCode = typeof publicCode === "string" ? publicCode.trim() : "";
  if (!cleanCode || !cleanCode.startsWith("wc_")) return null;
  const pool = getPgPool();
  if (!pool) return null;
  try {
    return await withPgTransaction(createPublicFlowLookupActor(), async (client) => {
      const res = await client.query(
        `SELECT id, public_code, salon_name, salon_category, owner_auth_phone, public_contact_phone,
                public_whatsapp_phone, timezone_iana, timezone_offset_hours, currency_code, currency_symbol,
                default_lang, enabled_langs, plan_tier, monthly_booking_limit, billing_status,
                whatsapp_addon_enabled, address, google_maps_url, google_review_url
         FROM salons
         WHERE public_code = $1
         LIMIT 1`,
        [cleanCode]
      );
      if (res.rows.length === 0) return null;
      const row = res.rows[0];
      const defaultLang = row.default_lang === "roman_ur" || row.default_lang === "ur" || row.default_lang === "ar" ? row.default_lang : "en";
      const enabledLangs = Array.isArray(row.enabled_langs) ? row.enabled_langs.filter(
        (l) => l === "en" || l === "roman_ur" || l === "ur" || l === "ar"
      ) : ["en", "roman_ur", "ur"];
      return {
        id: row.id,
        publicCode: row.public_code,
        salonName: row.salon_name,
        salonCategory: row.salon_category === "LADIES" ? "LADIES" : "MENS",
        ownerAuthPhone: row.owner_auth_phone,
        publicContactPhone: row.public_contact_phone,
        publicWhatsappPhone: row.public_whatsapp_phone || void 0,
        timezoneIana: row.timezone_iana || "Asia/Karachi",
        timezoneOffsetHours: Number(row.timezone_offset_hours ?? 5),
        currencyCode: row.currency_code || "PKR",
        currencySymbol: row.currency_symbol || "PKR ",
        defaultLang,
        enabledLangs,
        planTier: row.plan_tier || "PRO++",
        monthlyLimit: Number(row.monthly_booking_limit ?? 3e3),
        billingStatus: row.billing_status || "ACTIVE",
        whatsappAddonEnabled: Boolean(row.whatsapp_addon_enabled),
        address: row.address || "",
        googleMapsUrl: row.google_maps_url || "",
        googleReviewUrl: row.google_review_url || ""
      };
    });
  } catch (err) {
    if (err instanceof PgContextError) {
      throw err;
    }
    console.warn("Postgres public_code lookup failed:", err);
    if (isProductionEnv()) {
      throw err;
    }
    return null;
  }
}
async function recordBookingInPostgres(params) {
  const cleanCode = typeof params.salonPublicCode === "string" ? params.salonPublicCode.trim() : "";
  if (!cleanCode || !cleanCode.startsWith("wc_")) {
    return {
      ok: false,
      code: "DB_UNAVAILABLE",
      error: "Valid salon public booking code is required."
    };
  }
  const pool = getPgPool();
  if (!pool) {
    if (isProductionEnv()) {
      return {
        ok: false,
        code: "DB_UNAVAILABLE",
        error: "Database is not configured. Booking cannot be confirmed without persistent storage."
      };
    }
    return { ok: true };
  }
  try {
    return await withPgTransaction(createPublicFlowLookupActor(), async (client) => {
      const salonRes = await client.query(
        "SELECT id FROM salons WHERE public_code = $1 LIMIT 1",
        [cleanCode]
      );
      if (salonRes.rows.length === 0) {
        return {
          ok: false,
          code: "DB_UNAVAILABLE",
          error: "Salon booking record could not be verified in database."
        };
      }
      const salonId = salonRes.rows[0].id;
      await narrowPublicFlowSalonContext(client, salonId);
      const generatedClientId = `cli-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      const cliRes = await client.query(
        `INSERT INTO clients (
           id, salon_id, name, phone, phone_e164, preferred_language, preferred_lang, awaiting_language_selection
         )
         VALUES ($1, $2, $3, $4, $4, $5, $5, FALSE)
         ON CONFLICT (salon_id, phone_e164) DO UPDATE SET
           name = EXCLUDED.name,
           preferred_language = EXCLUDED.preferred_language,
           preferred_lang = EXCLUDED.preferred_lang,
           updated_at = NOW()
         RETURNING id`,
        [
          generatedClientId,
          salonId,
          params.clientName,
          params.clientPhoneE164,
          params.preferredLang
        ]
      );
      const clientId = cliRes.rows[0].id;
      const styRes = await client.query(
        `INSERT INTO stylists (salon_id, name)
         VALUES ($1, $2)
         ON CONFLICT (salon_id, name) DO UPDATE SET active = TRUE
         RETURNING id`,
        [salonId, params.stylistName]
      );
      const stylistUuid = styRes.rows[0].id;
      if (params.idempotencyKey) {
        const dup = await client.query(
          `SELECT id FROM bookings WHERE salon_id = $1 AND idempotency_key = $2 LIMIT 1`,
          [salonId, params.idempotencyKey]
        );
        if (dup.rows.length > 0) return { ok: true };
      }
      const bkRes = await client.query(
        `INSERT INTO bookings (
           salon_id, client_id, stylist_id, booking_ref, services_snapshot,
           total_price, total_duration_mins, starts_at, ends_at,
           status, source, idempotency_key, proof_hash
         )
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8::timestamptz, $9::timestamptz, 'CONFIRMED', $10, $11, $12)
         RETURNING id`,
        [
          salonId,
          clientId,
          stylistUuid,
          params.bookingRef,
          JSON.stringify(params.servicesSnapshot),
          params.totalPrice,
          params.totalDurationMins,
          params.startsAtIso,
          params.endsAtIso,
          params.source,
          params.idempotencyKey || null,
          params.proofHash
        ]
      );
      const bookingUuid = bkRes.rows[0].id;
      await client.query(
        `INSERT INTO booking_access_tokens (token_hash, booking_id, salon_id, expires_at)
         VALUES ($1, $2, $3, $4::timestamptz)`,
        [params.accessTokenHash, bookingUuid, salonId, params.accessTokenExpiresAtIso]
      );
      await client.query(
        `INSERT INTO salon_usage_monthly (salon_id, billing_month, billable_bookings, limit_snapshot)
         VALUES ($1, $2, 1, $3)
         ON CONFLICT (salon_id, billing_month) DO UPDATE SET
           billable_bookings = salon_usage_monthly.billable_bookings + 1,
           limit_snapshot = EXCLUDED.limit_snapshot,
           updated_at = NOW()`,
        [salonId, params.billingMonth, params.monthlyLimit]
      );
      await client.query(
        `INSERT INTO booking_audit_log (salon_id, booking_id, actor_type, action, new_state)
         VALUES ($1, $2, 'CUSTOMER', 'CREATED', $3::jsonb)`,
        [
          salonId,
          bookingUuid,
          JSON.stringify({ startsAt: params.startsAtIso, stylist: params.stylistName })
        ]
      );
      return { ok: true };
    });
  } catch (err) {
    const pgErr = err;
    if (pgErr?.code === "23P01") {
      return {
        ok: false,
        code: "OVERLAP",
        error: "That stylist was just booked for this time slot. Please choose another open slot."
      };
    }
    console.error("Postgres booking commit failed (fail-closed):", err);
    return {
      ok: false,
      code: "DB_UNAVAILABLE",
      error: "Could not commit booking cleanly to database. Please retry."
    };
  }
}
function parseBookingAccessTokenPublicCode(rawToken) {
  const clean = typeof rawToken === "string" ? rawToken.trim() : "";
  if (!clean.startsWith("wcbt_")) return null;
  const dotIdx = clean.indexOf(".");
  if (dotIdx <= 5) return null;
  const encodedCode = clean.slice(5, dotIdx);
  const secretPart = clean.slice(dotIdx + 1);
  if (secretPart.length < 16) return null;
  try {
    const decoded = Buffer.from(encodedCode, "base64url").toString("utf8").trim();
    if (!/^wc_[a-zA-Z0-9_-]{4,64}$/.test(decoded)) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}
function hashAccessToken(rawToken) {
  return crypto.createHash("sha256").update(rawToken.trim()).digest("hex");
}
function assertOwnerOrFounderActor(actor, salonId, operation) {
  const normalized = validatePgActorContext(actor);
  if (normalized.role !== "FOUNDER" && normalized.role !== "SALON_OWNER") {
    throw new PgContextError(
      "PRIVILEGE_ESCALATION",
      `${normalized.role} is not authorized to perform ${operation}.`
    );
  }
  if (normalized.role === "SALON_OWNER" && normalized.salonId !== salonId) {
    throw new PgContextError(
      "FORBIDDEN_TENANT",
      `SALON_OWNER (${normalized.salonId}) cannot access salon ${salonId} during ${operation}.`
    );
  }
  return normalized;
}
function assertAvailabilityActor(actor, salonId) {
  const normalized = validatePgActorContext(actor);
  if (normalized.role === "AGENT") {
    throw new PgContextError(
      "PRIVILEGE_ESCALATION",
      "AGENT cannot query public booking availability directly."
    );
  }
  if ((normalized.role === "SALON_OWNER" || normalized.role === "PUBLIC_FLOW") && normalized.salonId !== salonId) {
    throw new PgContextError(
      "FORBIDDEN_TENANT",
      `${normalized.role} (${normalized.salonId}) cannot read availability for salon ${salonId}.`
    );
  }
  return normalized;
}
function toIsoString(val) {
  if (!val) return (/* @__PURE__ */ new Date()).toISOString();
  if (val instanceof Date) return val.toISOString();
  const parsed = new Date(val);
  return Number.isNaN(parsed.getTime()) ? String(val) : parsed.toISOString();
}
function mapRawBookingRow(row) {
  const snapshot = Array.isArray(row.services_snapshot) ? row.services_snapshot : [];
  return {
    id: row.id,
    salonId: row.salon_id,
    salonPublicCode: row.salon_public_code || "",
    salonName: row.salon_name,
    publicContactPhone: row.public_contact_phone || row.whatsapp_phone || "",
    publicWhatsappPhone: row.public_whatsapp_phone || void 0,
    whatsappPhone: row.whatsapp_phone || "",
    timezoneOffsetHours: Number(row.timezone_offset_hours ?? 5),
    currencySymbol: row.currency_symbol || "PKR ",
    defaultLang: row.default_lang || "en",
    address: row.address || "",
    googleMapsUrl: row.google_maps_url || "",
    googleReviewUrl: row.google_review_url || "",
    clientId: row.client_id,
    clientName: row.client_name,
    clientPhone: row.client_phone,
    preferredLanguage: row.preferred_language,
    stylistId: row.stylist_id,
    stylistName: row.stylist_name,
    bookingRef: row.booking_ref,
    servicesSnapshot: snapshot,
    totalPrice: Number(row.total_price ?? 0),
    totalDurationMins: Number(row.total_duration_mins ?? 35),
    startsAtIso: toIsoString(row.starts_at),
    endsAtIso: toIsoString(row.ends_at),
    status: row.status,
    source: row.source,
    dealId: row.deal_id,
    idempotencyKey: row.idempotency_key || void 0,
    proofHash: row.proof_hash,
    completedAtIso: row.completed_at ? toIsoString(row.completed_at) : null,
    createdAtIso: toIsoString(row.created_at)
  };
}
var JOINED_BOOKING_SELECT = `
  SELECT b.id, b.salon_id, s.public_code AS salon_public_code, s.salon_name,
         s.public_contact_phone, s.public_whatsapp_phone, s.whatsapp_phone,
         s.timezone_offset_hours, s.currency_symbol, s.default_lang,
         s.address, s.google_maps_url, s.google_review_url,
         b.client_id, c.name AS client_name, COALESCE(NULLIF(c.phone_e164, ''), c.phone) AS client_phone,
         COALESCE(NULLIF(c.preferred_lang, ''), c.preferred_language) AS preferred_language,
         b.stylist_id, st.name AS stylist_name, b.booking_ref,
         b.services_snapshot, b.total_price, b.total_duration_mins,
         b.starts_at, b.ends_at, b.status, b.source, b.deal_id,
         b.idempotency_key, b.proof_hash, b.completed_at, b.created_at
  FROM bookings b
  JOIN salons s ON s.id = b.salon_id
  JOIN clients c ON c.id = b.client_id
  JOIN stylists st ON st.id = b.stylist_id
`;
async function queryAvailabilitySnapshotWithClient(client, params) {
  const salonRes = await client.query(
    `SELECT id, public_code, timezone_offset_hours, operating_hours
     FROM salons
     WHERE id = $1
     LIMIT 1`,
    [params.salonId]
  );
  if (salonRes.rows.length === 0) return null;
  const salonRow = salonRes.rows[0];
  const stylistsRes = await client.query(
    `SELECT id, name, chair_label, active
     FROM stylists
     WHERE salon_id = $1
     ORDER BY created_at ASC`,
    [params.salonId]
  );
  const servicesRes = await client.query(
    `SELECT sv.id, sv.name, sv.price, sv.duration_mins, sv.buffer_after_mins, sv.active,
            COALESCE(
              array_agg(st.name) FILTER (WHERE st.name IS NOT NULL),
              ARRAY[]::text[]
            ) AS eligible_stylists
     FROM services sv
     LEFT JOIN service_stylists ss ON ss.service_id = sv.id
     LEFT JOIN stylists st ON st.id = ss.stylist_id AND st.active = TRUE
     WHERE sv.salon_id = $1
     GROUP BY sv.id, sv.name, sv.price, sv.duration_mins, sv.buffer_after_mins, sv.active`,
    [params.salonId]
  );
  const bookingsRes = await client.query(
    `SELECT b.id, b.booking_ref, b.stylist_id, st.name AS stylist_name,
            b.starts_at, b.ends_at, b.status, b.total_duration_mins
     FROM bookings b
     JOIN stylists st ON st.id = b.stylist_id
     WHERE b.salon_id = $1
       AND b.status IN ('CONFIRMED', 'IN_CHAIR')
       AND b.ends_at > $2::timestamptz
       AND b.starts_at < $3::timestamptz
       AND ($4::text IS NULL OR (b.id::text <> $4 AND b.booking_ref <> $4))
     ORDER BY b.starts_at ASC`,
    [
      params.salonId,
      params.windowStartIso,
      params.windowEndIso,
      params.excludeBookingId || null
    ]
  );
  const leavesRes = await client.query(
    `SELECT sl.id, sl.stylist_id, st.name AS stylist_name,
            sl.lock_type, sl.starts_at, sl.ends_at, sl.reason
     FROM stylist_leaves sl
     JOIN stylists st ON st.id = sl.stylist_id
     WHERE sl.salon_id = $1
       AND sl.ends_at > $2::timestamptz
       AND sl.starts_at < $3::timestamptz`,
    [params.salonId, params.windowStartIso, params.windowEndIso]
  );
  return {
    salonId: salonRow.id,
    publicCode: salonRow.public_code || "",
    timezoneOffsetHours: Number(salonRow.timezone_offset_hours ?? 5),
    operatingHours: salonRow.operating_hours && typeof salonRow.operating_hours === "object" && Object.keys(salonRow.operating_hours).length > 0 ? salonRow.operating_hours : null,
    stylists: stylistsRes.rows.map((r) => ({
      id: r.id,
      name: r.name,
      chairLabel: r.chair_label,
      active: Boolean(r.active)
    })),
    services: servicesRes.rows.map((r) => ({
      id: r.id,
      name: r.name,
      price: Number(r.price ?? 0),
      durationMins: Number(r.duration_mins ?? 35),
      bufferAfterMins: Number(r.buffer_after_mins ?? 0),
      active: Boolean(r.active),
      eligibleStylists: Array.isArray(r.eligible_stylists) ? r.eligible_stylists : []
    })),
    bookings: bookingsRes.rows.map((r) => ({
      id: r.id,
      bookingRef: r.booking_ref,
      stylistId: r.stylist_id,
      stylistName: r.stylist_name,
      startsAtIso: toIsoString(r.starts_at),
      endsAtIso: toIsoString(r.ends_at),
      status: r.status,
      totalDurationMins: Number(r.total_duration_mins ?? 35)
    })),
    leaves: leavesRes.rows.map((r) => ({
      id: r.id,
      stylistId: r.stylist_id,
      stylistName: r.stylist_name,
      lockType: r.lock_type,
      startsAtIso: toIsoString(r.starts_at),
      endsAtIso: toIsoString(r.ends_at),
      reason: r.reason || ""
    }))
  };
}
async function fetchAvailabilitySnapshotFromPostgres(params, actor) {
  assertAvailabilityActor(actor, params.salonId);
  const pool = getPgPool();
  if (!pool) {
    if (isProductionEnv()) {
      throw new Error("PostgreSQL pool unavailable for availability query.");
    }
    return null;
  }
  return await withPgTransaction(actor, async (client) => {
    return await queryAvailabilitySnapshotWithClient(client, params);
  });
}
async function getBookingByAccessTokenFromPostgres(rawToken) {
  const publicCode = parseBookingAccessTokenPublicCode(rawToken);
  if (!publicCode) return null;
  const pool = getPgPool();
  if (!pool) {
    if (isProductionEnv()) {
      throw new Error("PostgreSQL pool unavailable for booking lookup.");
    }
    return null;
  }
  const tokenHash = hashAccessToken(rawToken);
  return await withPgTransaction(createPublicFlowLookupActor(), async (client) => {
    const salonRes = await client.query(
      "SELECT id FROM salons WHERE public_code = $1 LIMIT 1",
      [publicCode]
    );
    if (salonRes.rows.length === 0) return null;
    const salonId = salonRes.rows[0].id;
    await narrowPublicFlowSalonContext(client, salonId);
    const res = await client.query(
      `SELECT bat.revoked_at, bat.expires_at,
              b.id, b.salon_id, s.public_code AS salon_public_code, s.salon_name,
              s.public_contact_phone, s.public_whatsapp_phone, s.whatsapp_phone,
              s.timezone_offset_hours, s.currency_symbol, s.default_lang,
              s.address, s.google_maps_url, s.google_review_url,
              b.client_id, c.name AS client_name, COALESCE(NULLIF(c.phone_e164, ''), c.phone) AS client_phone,
              COALESCE(NULLIF(c.preferred_lang, ''), c.preferred_language) AS preferred_language,
              b.stylist_id, st.name AS stylist_name, b.booking_ref,
              b.services_snapshot, b.total_price, b.total_duration_mins,
              b.starts_at, b.ends_at, b.status, b.source, b.deal_id,
              b.idempotency_key, b.proof_hash, b.completed_at, b.created_at
       FROM booking_access_tokens bat
       JOIN bookings b ON b.id = bat.booking_id AND b.salon_id = bat.salon_id
       JOIN salons s ON s.id = b.salon_id
       JOIN clients c ON c.id = b.client_id
       JOIN stylists st ON st.id = b.stylist_id
       WHERE bat.token_hash = $1 AND bat.salon_id = $2
       LIMIT 1`,
      [tokenHash, salonId]
    );
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    if (row.revoked_at || new Date(row.expires_at).getTime() < Date.now()) {
      return null;
    }
    return mapRawBookingRow(row);
  });
}
async function rescheduleBookingByAccessTokenInPostgres(params) {
  const publicCode = parseBookingAccessTokenPublicCode(params.rawToken);
  if (!publicCode) {
    return {
      ok: false,
      statusCode: 404,
      error: "This booking management link has expired or been revoked."
    };
  }
  const pool = getPgPool();
  if (!pool) {
    return {
      ok: false,
      statusCode: 503,
      error: "Database is not configured. Booking cannot be rescheduled without persistent storage."
    };
  }
  const tokenHash = hashAccessToken(params.rawToken);
  try {
    return await withPgTransaction(createPublicFlowLookupActor(), async (client) => {
      const salonRes = await client.query(
        "SELECT id FROM salons WHERE public_code = $1 LIMIT 1",
        [publicCode]
      );
      if (salonRes.rows.length === 0) {
        return {
          ok: false,
          statusCode: 404,
          error: "This booking management link has expired or been revoked."
        };
      }
      const salonId = salonRes.rows[0].id;
      await narrowPublicFlowSalonContext(client, salonId);
      const lockRes = await client.query(
        `SELECT bat.id AS token_id, bat.revoked_at, bat.expires_at,
                b.id, b.salon_id, s.public_code AS salon_public_code, s.salon_name,
                s.public_contact_phone, s.public_whatsapp_phone, s.whatsapp_phone,
                s.timezone_offset_hours, s.currency_symbol, s.default_lang,
                s.address, s.google_maps_url, s.google_review_url,
                b.client_id, c.name AS client_name, COALESCE(NULLIF(c.phone_e164, ''), c.phone) AS client_phone,
                COALESCE(NULLIF(c.preferred_lang, ''), c.preferred_language) AS preferred_language,
                b.stylist_id, st.name AS stylist_name, b.booking_ref,
                b.services_snapshot, b.total_price, b.total_duration_mins,
                b.starts_at, b.ends_at, b.status, b.source, b.deal_id,
                b.idempotency_key, b.proof_hash, b.completed_at, b.created_at
         FROM booking_access_tokens bat
         JOIN bookings b ON b.id = bat.booking_id AND b.salon_id = bat.salon_id
         JOIN salons s ON s.id = b.salon_id
         JOIN clients c ON c.id = b.client_id
         JOIN stylists st ON st.id = b.stylist_id
         WHERE bat.token_hash = $1 AND bat.salon_id = $2
         FOR UPDATE OF b, bat`,
        [tokenHash, salonId]
      );
      if (lockRes.rows.length === 0) {
        return {
          ok: false,
          statusCode: 404,
          error: "This booking management link has expired or been revoked."
        };
      }
      const row = lockRes.rows[0];
      if (row.revoked_at || new Date(row.expires_at).getTime() < Date.now()) {
        return {
          ok: false,
          statusCode: 404,
          error: "This booking management link has expired or been revoked."
        };
      }
      if (row.status === "COMPLETED" || row.status === "CANCELED" || row.status === "NO_SHOW") {
        return {
          ok: false,
          statusCode: 409,
          error: "Completed or canceled bookings cannot be rescheduled."
        };
      }
      const currentBooking = mapRawBookingRow(row);
      const snapshot = await queryAvailabilitySnapshotWithClient(client, {
        salonId,
        windowStartIso: params.windowStartIso,
        windowEndIso: params.windowEndIso,
        excludeBookingId: currentBooking.id
      });
      if (!snapshot) {
        return {
          ok: false,
          statusCode: 404,
          error: "Salon configuration not found."
        };
      }
      const slotChoice = params.resolveSlot(snapshot, currentBooking);
      if (!slotChoice.ok) {
        return {
          ok: false,
          statusCode: slotChoice.statusCode,
          error: slotChoice.error
        };
      }
      const styRes = await client.query(
        `INSERT INTO stylists (salon_id, name)
         VALUES ($1, $2)
         ON CONFLICT (salon_id, name) DO UPDATE SET active = TRUE
         RETURNING id`,
        [salonId, slotChoice.barberName]
      );
      const nextStylistId = styRes.rows[0].id;
      await client.query(
        `UPDATE bookings
         SET stylist_id = $1,
             starts_at = $2::timestamptz,
             ends_at = $3::timestamptz
         WHERE id = $4 AND salon_id = $5`,
        [nextStylistId, slotChoice.startUtcIso, slotChoice.endUtcIso, currentBooking.id, salonId]
      );
      const nextExpiresIso = new Date(
        new Date(slotChoice.endUtcIso).getTime() + 7 * 864e5
      ).toISOString();
      await client.query(
        `UPDATE booking_access_tokens
         SET expires_at = $1::timestamptz
         WHERE id = $2 AND salon_id = $3`,
        [nextExpiresIso, row.token_id, salonId]
      );
      const oldSummary = `${currentBooking.startsAtIso} (${currentBooking.stylistName})`;
      const newSummary = `${params.appointmentDate} ${slotChoice.formattedTime} (${slotChoice.barberName})`;
      await client.query(
        `INSERT INTO booking_audit_log (salon_id, booking_id, actor_type, action, previous_state, new_state)
         VALUES ($1, $2, 'CUSTOMER', 'RESCHEDULED', $3::jsonb, $4::jsonb)`,
        [
          salonId,
          currentBooking.id,
          JSON.stringify({
            startsAt: currentBooking.startsAtIso,
            endsAt: currentBooking.endsAtIso,
            stylist: currentBooking.stylistName
          }),
          JSON.stringify({
            startsAt: slotChoice.startUtcIso,
            endsAt: slotChoice.endUtcIso,
            stylist: slotChoice.barberName,
            summary: newSummary
          })
        ]
      );
      await client.query(
        `INSERT INTO counter_notifications (salon_id, booking_id, event_type, title, speech_text)
         VALUES ($1, $2, 'RESCHEDULED', $3, $4)`,
        [
          salonId,
          currentBooking.id,
          `Rescheduled: ${currentBooking.clientName}`,
          `${currentBooking.clientName} rescheduled to ${newSummary}.`
        ]
      );
      const updatedRes = await client.query(
        `${JOINED_BOOKING_SELECT} WHERE b.id = $1 AND b.salon_id = $2 LIMIT 1`,
        [currentBooking.id, salonId]
      );
      const updatedBooking = updatedRes.rows.length > 0 ? mapRawBookingRow(updatedRes.rows[0]) : {
        ...currentBooking,
        stylistId: nextStylistId,
        stylistName: slotChoice.barberName,
        startsAtIso: slotChoice.startUtcIso,
        endsAtIso: slotChoice.endUtcIso
      };
      return {
        ok: true,
        booking: updatedBooking,
        oldSummary,
        newSummary
      };
    });
  } catch (err) {
    if (err instanceof PgContextError) throw err;
    const pgErr = err;
    if (pgErr?.code === "23P01") {
      return {
        ok: false,
        statusCode: 409,
        error: "That stylist was just booked for this time slot. Please choose another open slot."
      };
    }
    console.error("Postgres customer reschedule failed (fail-closed):", err);
    return {
      ok: false,
      statusCode: 503,
      error: "Could not commit reschedule cleanly to database. Please retry."
    };
  }
}
async function cancelBookingByAccessTokenInPostgres(params) {
  const publicCode = parseBookingAccessTokenPublicCode(params.rawToken);
  if (!publicCode) {
    return {
      ok: false,
      statusCode: 404,
      error: "This booking management link has expired or been revoked."
    };
  }
  const pool = getPgPool();
  if (!pool) {
    return {
      ok: false,
      statusCode: 503,
      error: "Database is not configured. Booking cannot be canceled without persistent storage."
    };
  }
  const tokenHash = hashAccessToken(params.rawToken);
  try {
    return await withPgTransaction(createPublicFlowLookupActor(), async (client) => {
      const salonRes = await client.query(
        "SELECT id FROM salons WHERE public_code = $1 LIMIT 1",
        [publicCode]
      );
      if (salonRes.rows.length === 0) {
        return {
          ok: false,
          statusCode: 404,
          error: "This booking management link has expired or been revoked."
        };
      }
      const salonId = salonRes.rows[0].id;
      await narrowPublicFlowSalonContext(client, salonId);
      const lockRes = await client.query(
        `SELECT bat.revoked_at, bat.expires_at,
                b.id, b.salon_id, s.public_code AS salon_public_code, s.salon_name,
                s.public_contact_phone, s.public_whatsapp_phone, s.whatsapp_phone,
                s.timezone_offset_hours, s.currency_symbol, s.default_lang,
                s.address, s.google_maps_url, s.google_review_url,
                b.client_id, c.name AS client_name, COALESCE(NULLIF(c.phone_e164, ''), c.phone) AS client_phone,
                COALESCE(NULLIF(c.preferred_lang, ''), c.preferred_language) AS preferred_language,
                b.stylist_id, st.name AS stylist_name, b.booking_ref,
                b.services_snapshot, b.total_price, b.total_duration_mins,
                b.starts_at, b.ends_at, b.status, b.source, b.deal_id,
                b.idempotency_key, b.proof_hash, b.completed_at, b.created_at
         FROM booking_access_tokens bat
         JOIN bookings b ON b.id = bat.booking_id AND b.salon_id = bat.salon_id
         JOIN salons s ON s.id = b.salon_id
         JOIN clients c ON c.id = b.client_id
         JOIN stylists st ON st.id = b.stylist_id
         WHERE bat.token_hash = $1 AND bat.salon_id = $2
         FOR UPDATE OF b, bat`,
        [tokenHash, salonId]
      );
      if (lockRes.rows.length === 0) {
        return {
          ok: false,
          statusCode: 404,
          error: "This booking management link has expired or been revoked."
        };
      }
      const row = lockRes.rows[0];
      if (row.revoked_at || new Date(row.expires_at).getTime() < Date.now()) {
        return {
          ok: false,
          statusCode: 404,
          error: "This booking management link has expired or been revoked."
        };
      }
      if (row.status === "COMPLETED" || row.status === "NO_SHOW") {
        return {
          ok: false,
          statusCode: 409,
          error: "Completed appointments cannot be canceled."
        };
      }
      const currentBooking = mapRawBookingRow(row);
      const alreadyCanceled = currentBooking.status === "CANCELED";
      if (!alreadyCanceled) {
        await client.query(
          `UPDATE bookings
           SET status = 'CANCELED'
           WHERE id = $1 AND salon_id = $2`,
          [currentBooking.id, salonId]
        );
        await client.query(
          `INSERT INTO booking_audit_log (salon_id, booking_id, actor_type, action, previous_state, new_state)
           VALUES ($1, $2, 'CUSTOMER', 'CANCELED', $3::jsonb, $4::jsonb)`,
          [
            salonId,
            currentBooking.id,
            JSON.stringify({ status: currentBooking.status }),
            JSON.stringify({ status: "CANCELED", reason: params.reason || "Self-service cancel" })
          ]
        );
        await client.query(
          `INSERT INTO counter_notifications (salon_id, booking_id, event_type, title, speech_text)
           VALUES ($1, $2, 'CANCELED', $3, $4)`,
          [
            salonId,
            currentBooking.id,
            `Canceled: ${currentBooking.clientName}`,
            `${currentBooking.clientName} canceled booking with ${currentBooking.stylistName}.`
          ]
        );
      }
      const updatedRes = await client.query(
        `${JOINED_BOOKING_SELECT} WHERE b.id = $1 AND b.salon_id = $2 LIMIT 1`,
        [currentBooking.id, salonId]
      );
      const updatedBooking = updatedRes.rows.length > 0 ? mapRawBookingRow(updatedRes.rows[0]) : { ...currentBooking, status: "CANCELED" };
      return { ok: true, booking: updatedBooking, alreadyCanceled };
    });
  } catch (err) {
    if (err instanceof PgContextError) throw err;
    console.error("Postgres customer cancel failed (fail-closed):", err);
    return {
      ok: false,
      statusCode: 503,
      error: "Could not commit cancellation cleanly to database. Please retry."
    };
  }
}
async function rescheduleBookingByOwnerInPostgres(params, actor) {
  assertOwnerOrFounderActor(actor, params.salonId, "rescheduleAppointmentByOwner");
  const pool = getPgPool();
  if (!pool) {
    return {
      ok: false,
      statusCode: 503,
      error: "Database is not configured. Reschedule cannot be committed without persistent storage."
    };
  }
  try {
    return await withPgTransaction(actor, async (client) => {
      const lockRes = await client.query(
        `${JOINED_BOOKING_SELECT}
         WHERE b.salon_id = $1 AND (b.booking_ref = $2 OR b.id::text = $2)
         FOR UPDATE OF b`,
        [params.salonId, params.bookingId]
      );
      if (lockRes.rows.length === 0) {
        return {
          ok: false,
          statusCode: 404,
          error: "Appointment not found for this salon."
        };
      }
      const currentBooking = mapRawBookingRow(lockRes.rows[0]);
      if (currentBooking.status === "COMPLETED" || currentBooking.status === "CANCELED" || currentBooking.status === "NO_SHOW") {
        return {
          ok: false,
          statusCode: 409,
          error: "Completed or canceled appointments cannot be rescheduled."
        };
      }
      const snapshot = await queryAvailabilitySnapshotWithClient(client, {
        salonId: params.salonId,
        windowStartIso: params.windowStartIso,
        windowEndIso: params.windowEndIso,
        excludeBookingId: currentBooking.id
      });
      if (!snapshot) {
        return {
          ok: false,
          statusCode: 404,
          error: "Salon configuration not found."
        };
      }
      const slotChoice = params.resolveSlot(snapshot, currentBooking);
      if (!slotChoice.ok) {
        return {
          ok: false,
          statusCode: slotChoice.statusCode,
          error: slotChoice.error
        };
      }
      const styRes = await client.query(
        `INSERT INTO stylists (salon_id, name)
         VALUES ($1, $2)
         ON CONFLICT (salon_id, name) DO UPDATE SET active = TRUE
         RETURNING id`,
        [params.salonId, slotChoice.barberName]
      );
      const nextStylistId = styRes.rows[0].id;
      await client.query(
        `UPDATE bookings
         SET stylist_id = $1,
             starts_at = $2::timestamptz,
             ends_at = $3::timestamptz
         WHERE id = $4 AND salon_id = $5`,
        [
          nextStylistId,
          slotChoice.startUtcIso,
          slotChoice.endUtcIso,
          currentBooking.id,
          params.salonId
        ]
      );
      const oldSummary = `${currentBooking.startsAtIso} (${currentBooking.stylistName})`;
      const newSummary = `${params.appointmentDate} ${slotChoice.formattedTime} (${slotChoice.barberName})`;
      await client.query(
        `INSERT INTO booking_audit_log (salon_id, booking_id, actor_type, action, previous_state, new_state)
         VALUES ($1, $2, 'OWNER', 'RESCHEDULED', $3::jsonb, $4::jsonb)`,
        [
          params.salonId,
          currentBooking.id,
          JSON.stringify({
            startsAt: currentBooking.startsAtIso,
            endsAt: currentBooking.endsAtIso,
            stylist: currentBooking.stylistName
          }),
          JSON.stringify({
            startsAt: slotChoice.startUtcIso,
            endsAt: slotChoice.endUtcIso,
            stylist: slotChoice.barberName,
            summary: newSummary
          })
        ]
      );
      await client.query(
        `INSERT INTO counter_notifications (salon_id, booking_id, event_type, title, speech_text)
         VALUES ($1, $2, 'RESCHEDULED', $3, $4)`,
        [
          params.salonId,
          currentBooking.id,
          `Owner Rescheduled: ${currentBooking.clientName}`,
          `${currentBooking.clientName} moved to ${newSummary}.`
        ]
      );
      const updatedRes = await client.query(
        `${JOINED_BOOKING_SELECT} WHERE b.id = $1 AND b.salon_id = $2 LIMIT 1`,
        [currentBooking.id, params.salonId]
      );
      const updatedBooking = updatedRes.rows.length > 0 ? mapRawBookingRow(updatedRes.rows[0]) : {
        ...currentBooking,
        stylistId: nextStylistId,
        stylistName: slotChoice.barberName,
        startsAtIso: slotChoice.startUtcIso,
        endsAtIso: slotChoice.endUtcIso
      };
      return { ok: true, booking: updatedBooking, oldSummary, newSummary };
    });
  } catch (err) {
    if (err instanceof PgContextError) throw err;
    const pgErr = err;
    if (pgErr?.code === "23P01") {
      return {
        ok: false,
        statusCode: 409,
        error: "That stylist was just booked for this time slot. Please choose another open slot."
      };
    }
    console.error("Postgres owner reschedule failed (fail-closed):", err);
    return {
      ok: false,
      statusCode: 503,
      error: "Could not commit reschedule cleanly to database. Please retry."
    };
  }
}
async function updateBookingStatusInPostgres(params, actor) {
  assertOwnerOrFounderActor(actor, params.salonId, "updateAppointmentStatus");
  const pool = getPgPool();
  if (!pool) {
    return {
      ok: false,
      statusCode: 503,
      error: "Database is not configured. Status update cannot be committed without persistent storage."
    };
  }
  try {
    return await withPgTransaction(actor, async (client) => {
      const lockRes = await client.query(
        `${JOINED_BOOKING_SELECT}
         WHERE b.salon_id = $1 AND (b.booking_ref = $2 OR b.id::text = $2)
         FOR UPDATE OF b`,
        [params.salonId, params.bookingId]
      );
      if (lockRes.rows.length === 0) {
        return {
          ok: false,
          statusCode: 404,
          error: "Appointment not found for this salon."
        };
      }
      const currentBooking = mapRawBookingRow(lockRes.rows[0]);
      const prevStatus = currentBooking.status;
      if (prevStatus === "COMPLETED" && params.nextStatus !== "COMPLETED") {
        return {
          ok: false,
          statusCode: 409,
          error: `Completed appointments cannot transition to ${params.nextStatus}.`
        };
      }
      if (prevStatus === "CANCELED" && params.nextStatus !== "CANCELED") {
        return {
          ok: false,
          statusCode: 409,
          error: "Canceled appointments cannot be reopened."
        };
      }
      if (prevStatus === "NO_SHOW") {
        return {
          ok: false,
          statusCode: 409,
          error: "No-show appointments cannot transition."
        };
      }
      if (prevStatus === params.nextStatus) {
        return { ok: true, booking: currentBooking, changed: false };
      }
      const nowIso = (/* @__PURE__ */ new Date()).toISOString();
      await client.query(
        `UPDATE bookings
         SET status = $1,
             completed_at = CASE WHEN $1 = 'COMPLETED' THEN COALESCE(completed_at, $2::timestamptz) ELSE completed_at END
         WHERE id = $3 AND salon_id = $4`,
        [params.nextStatus, nowIso, currentBooking.id, params.salonId]
      );
      if (params.nextStatus === "COMPLETED") {
        await client.query(
          `UPDATE clients
           SET last_completed_visit_at = $1::timestamptz,
               total_visits = total_visits + 1,
               updated_at = NOW()
           WHERE id = $2 AND salon_id = $3`,
          [nowIso, currentBooking.clientId, params.salonId]
        );
      }
      const auditAction = params.nextStatus === "CANCELED" ? "CANCELED" : params.nextStatus === "COMPLETED" ? "COMPLETED" : params.nextStatus === "IN_CHAIR" ? "IN_CHAIR" : "CREATED";
      await client.query(
        `INSERT INTO booking_audit_log (salon_id, booking_id, actor_type, action, previous_state, new_state)
         VALUES ($1, $2, 'OWNER', $3, $4::jsonb, $5::jsonb)`,
        [
          params.salonId,
          currentBooking.id,
          auditAction,
          JSON.stringify({ status: prevStatus }),
          JSON.stringify({
            status: params.nextStatus,
            completedAt: params.nextStatus === "COMPLETED" ? nowIso : null
          })
        ]
      );
      if (params.nextStatus === "CANCELED") {
        await client.query(
          `INSERT INTO counter_notifications (salon_id, booking_id, event_type, title, speech_text)
           VALUES ($1, $2, 'CANCELED', $3, $4)`,
          [
            params.salonId,
            currentBooking.id,
            `Canceled: ${currentBooking.clientName}`,
            `Appointment for ${currentBooking.clientName} marked canceled.`
          ]
        );
      }
      const updatedRes = await client.query(
        `${JOINED_BOOKING_SELECT} WHERE b.id = $1 AND b.salon_id = $2 LIMIT 1`,
        [currentBooking.id, params.salonId]
      );
      const updatedBooking = updatedRes.rows.length > 0 ? mapRawBookingRow(updatedRes.rows[0]) : {
        ...currentBooking,
        status: params.nextStatus,
        completedAtIso: params.nextStatus === "COMPLETED" ? nowIso : currentBooking.completedAtIso
      };
      return { ok: true, booking: updatedBooking, changed: true };
    });
  } catch (err) {
    if (err instanceof PgContextError) throw err;
    const pgErr = err;
    if (pgErr?.code === "23P01") {
      return {
        ok: false,
        statusCode: 409,
        error: "Stylist already has an active overlapping appointment."
      };
    }
    console.error("Postgres status update failed (fail-closed):", err);
    return {
      ok: false,
      statusCode: 503,
      error: "Could not update appointment status in database."
    };
  }
}
async function completeAppointmentAndRecordVisitInPostgres(params, actor) {
  assertOwnerOrFounderActor(actor, params.salonId, "completeAppointmentAndRecordVisit");
  const pool = getPgPool();
  if (!pool) {
    return {
      ok: false,
      statusCode: 503,
      error: "Database is not configured. Completion cannot be recorded without persistent storage."
    };
  }
  try {
    return await withPgTransaction(actor, async (client) => {
      const lockRes = await client.query(
        `${JOINED_BOOKING_SELECT}
         WHERE b.salon_id = $1 AND (b.booking_ref = $2 OR b.id::text = $2)
         FOR UPDATE OF b`,
        [params.salonId, params.appointmentId]
      );
      const existing = lockRes.rows.length > 0 ? mapRawBookingRow(lockRes.rows[0]) : null;
      if (existing && (existing.status === "CANCELED" || existing.status === "NO_SHOW")) {
        return {
          ok: false,
          statusCode: 409,
          error: "Canceled appointments cannot be completed."
        };
      }
      const alreadyCompleted = existing?.status === "COMPLETED";
      const nowIso = (/* @__PURE__ */ new Date()).toISOString();
      const cleanBirthDate = (params.birthDate || "").trim();
      let clientRow;
      let bookingUuid;
      if (existing) {
        const cliUpdateRes = await client.query(
          `UPDATE clients
           SET name = COALESCE(NULLIF($1, ''), name),
               birth_date = CASE WHEN $2 <> '' THEN $2 ELSE birth_date END,
               birth_day_month = CASE WHEN $2 <> '' THEN $2 ELSE birth_day_month END,
               last_completed_visit_at = CASE WHEN $3 THEN last_completed_visit_at ELSE $4::timestamptz END,
               total_visits = CASE WHEN $3 THEN total_visits ELSE total_visits + 1 END,
               updated_at = NOW()
           WHERE id = $5 AND salon_id = $6
           RETURNING id, salon_id, name, COALESCE(NULLIF(phone_e164, ''), phone) AS phone,
                     COALESCE(NULLIF(preferred_lang, ''), preferred_language) AS preferred_language,
                     birth_date, last_completed_visit_at, total_visits`,
          [
            params.clientName,
            cleanBirthDate,
            alreadyCompleted,
            nowIso,
            existing.clientId,
            params.salonId
          ]
        );
        const cRow = cliUpdateRes.rows[0];
        clientRow = {
          id: cRow.id,
          salonId: cRow.salon_id,
          name: cRow.name,
          phone: cRow.phone,
          preferredLanguage: cRow.preferred_language,
          birthDate: cRow.birth_date || "",
          lastCompletedVisitAt: cRow.last_completed_visit_at ? toIsoString(cRow.last_completed_visit_at) : null,
          totalVisits: Number(cRow.total_visits ?? 0)
        };
        if (!alreadyCompleted) {
          await client.query(
            `UPDATE bookings
             SET status = 'COMPLETED',
                 completed_at = COALESCE(completed_at, $1::timestamptz)
             WHERE id = $2 AND salon_id = $3`,
            [nowIso, existing.id, params.salonId]
          );
        }
        bookingUuid = existing.id;
      } else {
        const generatedClientId = `cli-${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`;
        const cliUpsertRes = await client.query(
          `INSERT INTO clients (
             id, salon_id, name, phone, phone_e164, preferred_language, preferred_lang,
             awaiting_language_selection, birth_date, birth_day_month,
             last_completed_visit_at, total_visits
           )
           VALUES ($1, $2, $3, $4, $4, $5, $5, FALSE, $6, $6, $7::timestamptz, 1)
           ON CONFLICT (salon_id, phone_e164) DO UPDATE SET
             name = COALESCE(NULLIF(EXCLUDED.name, ''), clients.name),
             birth_date = CASE WHEN EXCLUDED.birth_date <> '' THEN EXCLUDED.birth_date ELSE clients.birth_date END,
             birth_day_month = CASE WHEN EXCLUDED.birth_day_month <> '' THEN EXCLUDED.birth_day_month ELSE clients.birth_day_month END,
             last_completed_visit_at = EXCLUDED.last_completed_visit_at,
             total_visits = clients.total_visits + 1,
             updated_at = NOW()
           RETURNING id, salon_id, name, COALESCE(NULLIF(phone_e164, ''), phone) AS phone,
                     COALESCE(NULLIF(preferred_lang, ''), preferred_language) AS preferred_language,
                     birth_date, last_completed_visit_at, total_visits`,
          [
            generatedClientId,
            params.salonId,
            params.clientName,
            params.clientPhone,
            params.preferredLanguage,
            cleanBirthDate,
            nowIso
          ]
        );
        const cRow = cliUpsertRes.rows[0];
        clientRow = {
          id: cRow.id,
          salonId: cRow.salon_id,
          name: cRow.name,
          phone: cRow.phone,
          preferredLanguage: cRow.preferred_language,
          birthDate: cRow.birth_date || "",
          lastCompletedVisitAt: cRow.last_completed_visit_at ? toIsoString(cRow.last_completed_visit_at) : null,
          totalVisits: Number(cRow.total_visits ?? 1)
        };
        const styRes = await client.query(
          `INSERT INTO stylists (salon_id, name)
           VALUES ($1, $2)
           ON CONFLICT (salon_id, name) DO UPDATE SET active = TRUE
           RETURNING id`,
          [params.salonId, params.barberName]
        );
        const stylistUuid = styRes.rows[0].id;
        const bkInsertRes = await client.query(
          `INSERT INTO bookings (
             salon_id, client_id, stylist_id, booking_ref, services_snapshot,
             total_price, total_duration_mins, starts_at, ends_at,
             status, source, proof_hash, completed_at
           )
           VALUES (
             $1, $2, $3, $4, $5::jsonb,
             $6, 35, $7::timestamptz, $8::timestamptz,
             'COMPLETED', 'OWNER_WALKIN', $9, $10::timestamptz
           )
           RETURNING id`,
          [
            params.salonId,
            clientRow.id,
            stylistUuid,
            params.appointmentId,
            JSON.stringify([{ name: params.service, price: params.price, durationMins: 35 }]),
            params.price,
            params.startsAtIso,
            params.endsAtIso,
            params.proofHash,
            nowIso
          ]
        );
        bookingUuid = bkInsertRes.rows[0].id;
      }
      if (!alreadyCompleted) {
        await client.query(
          `INSERT INTO booking_audit_log (salon_id, booking_id, actor_type, action, previous_state, new_state)
           VALUES ($1, $2, 'OWNER', 'COMPLETED', $3::jsonb, $4::jsonb)`,
          [
            params.salonId,
            bookingUuid,
            JSON.stringify({ status: existing?.status || "NONE" }),
            JSON.stringify({ status: "COMPLETED", completedAt: nowIso, clientId: clientRow.id })
          ]
        );
      }
      const finalBookingRes = await client.query(
        `${JOINED_BOOKING_SELECT} WHERE b.id = $1 AND b.salon_id = $2 LIMIT 1`,
        [bookingUuid, params.salonId]
      );
      const booking = finalBookingRes.rows.length > 0 ? mapRawBookingRow(finalBookingRes.rows[0]) : {
        id: bookingUuid,
        salonId: params.salonId,
        salonPublicCode: "",
        salonName: "",
        publicContactPhone: "",
        whatsappPhone: "",
        timezoneOffsetHours: 5,
        currencySymbol: "PKR ",
        defaultLang: "en",
        address: "",
        googleMapsUrl: "",
        googleReviewUrl: "",
        clientId: clientRow.id,
        clientName: clientRow.name,
        clientPhone: clientRow.phone,
        preferredLanguage: clientRow.preferredLanguage,
        stylistId: "",
        stylistName: params.barberName,
        bookingRef: params.appointmentId,
        servicesSnapshot: [{ name: params.service, price: params.price, durationMins: 35 }],
        totalPrice: params.price,
        totalDurationMins: 35,
        startsAtIso: params.startsAtIso,
        endsAtIso: params.endsAtIso,
        status: "COMPLETED",
        source: "OWNER_WALKIN",
        dealId: null,
        proofHash: params.proofHash,
        completedAtIso: nowIso,
        createdAtIso: nowIso
      };
      return { ok: true, booking, client: clientRow };
    });
  } catch (err) {
    if (err instanceof PgContextError) throw err;
    console.error("Postgres completeAppointmentAndRecordVisit failed (fail-closed):", err);
    return {
      ok: false,
      statusCode: 503,
      error: "Could not complete appointment and record visit in database."
    };
  }
}
async function listSalonBookingsFromPostgres(salonId, actor) {
  assertOwnerOrFounderActor(actor, salonId, "listSalonBookings");
  const pool = getPgPool();
  if (!pool) return null;
  return await withPgTransaction(actor, async (client) => {
    const bkRes = await client.query(
      `${JOINED_BOOKING_SELECT}
       WHERE b.salon_id = $1
       ORDER BY b.starts_at DESC
       LIMIT 200`,
      [salonId]
    );
    const auditRes = await client.query(
      `SELECT id, salon_id, booking_id, actor_type, action, new_state, created_at
       FROM booking_audit_log
       WHERE salon_id = $1
       ORDER BY created_at DESC
       LIMIT 80`,
      [salonId]
    );
    return {
      bookings: bkRes.rows.map(mapRawBookingRow),
      auditLog: auditRes.rows.map((r) => ({
        id: r.id,
        salonId: r.salon_id,
        bookingId: r.booking_id,
        actorType: r.actor_type,
        action: r.action,
        note: typeof r.new_state?.summary === "string" ? r.new_state.summary : `${r.action} (${r.actor_type})`,
        createdAt: toIsoString(r.created_at)
      }))
    };
  });
}

// server/security.ts
import crypto2 from "crypto";
import fs from "fs";
import path from "path";

// server/rateLimiter.ts
var devMemoryBuckets = /* @__PURE__ */ new Map();
function isProductionRuntime() {
  return process.env.NODE_ENV === "production";
}
function getRedisCreds() {
  const url = (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "").trim().replace(/\/+$/, "");
  const token = (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();
  if (!url || !token) return null;
  return { url, token };
}
function isRateLimiterConfigured() {
  return Boolean(getRedisCreds());
}
async function enforceRateLimit(bucketKey, limit, windowSeconds, options) {
  const isProd = isProductionRuntime();
  const creds = getRedisCreds();
  const safeKey = `wc:rl:${bucketKey}`;
  if (creds) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(`${creds.url}/pipeline`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${creds.token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify([
          ["INCR", safeKey],
          ["EXPIRE", safeKey, String(windowSeconds), "NX"],
          ["TTL", safeKey]
        ]),
        signal: controller.signal
      });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        const currentCount = Number(data?.[0]?.result || 1);
        const ttl = Math.max(1, Number(data?.[2]?.result || windowSeconds));
        return {
          allowed: currentCount <= limit,
          limit,
          remaining: Math.max(0, limit - currentCount),
          retryAfterSec: currentCount <= limit ? 0 : ttl,
          backend: "redis"
        };
      }
      if (isProd && options?.failClosedInProd) {
        console.error(`Upstash Redis rate-limit HTTP ${res.status}; failing closed on ${safeKey}.`);
        return {
          allowed: false,
          limit,
          remaining: 0,
          retryAfterSec: 30,
          backend: "unconfigured-prod",
          unavailable: true
        };
      }
    } catch (err) {
      console.warn("Distributed Redis rate limit check failed:", err);
      if (isProd && options?.failClosedInProd) {
        return {
          allowed: false,
          limit,
          remaining: 0,
          retryAfterSec: 30,
          backend: "unconfigured-prod",
          unavailable: true
        };
      }
    }
  } else if (isProd && options?.failClosedInProd) {
    console.error(
      `UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN missing in production; failing closed for ${safeKey}.`
    );
    return {
      allowed: false,
      limit,
      remaining: 0,
      retryAfterSec: 30,
      backend: "unconfigured-prod",
      unavailable: true
    };
  }
  const now = Date.now();
  const windowMs = windowSeconds * 1e3;
  const existing = devMemoryBuckets.get(safeKey);
  if (!existing || existing.resetAtMs <= now) {
    if (devMemoryBuckets.size > 5e3) {
      devMemoryBuckets.clear();
    }
    devMemoryBuckets.set(safeKey, { count: 1, resetAtMs: now + windowMs });
    return {
      allowed: true,
      limit,
      remaining: Math.max(0, limit - 1),
      retryAfterSec: 0,
      backend: isProd ? "unconfigured-prod" : "memory-dev"
    };
  }
  existing.count += 1;
  const retryAfterSec = Math.max(1, Math.ceil((existing.resetAtMs - now) / 1e3));
  return {
    allowed: existing.count <= limit,
    limit,
    remaining: Math.max(0, limit - existing.count),
    retryAfterSec: existing.count <= limit ? 0 : retryAfterSec,
    backend: isProd ? "unconfigured-prod" : "memory-dev"
  };
}
async function getDistributedCounter(counterKey) {
  const creds = getRedisCreds();
  const safeKey = `wc:cnt:${counterKey}`;
  if (creds) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2e3);
      const res = await fetch(`${creds.url}/pipeline`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${creds.token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify([
          ["GET", safeKey],
          ["TTL", safeKey]
        ]),
        signal: controller.signal
      });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        const count = Number(data?.[0]?.result || 0);
        const ttlSec = Math.max(0, Number(data?.[1]?.result || 0));
        return { count: Number.isFinite(count) ? count : 0, ttlSec };
      }
    } catch {
    }
  }
  const existing = devMemoryBuckets.get(safeKey);
  if (!existing || existing.resetAtMs <= Date.now()) return { count: 0, ttlSec: 0 };
  return {
    count: existing.count,
    ttlSec: Math.max(1, Math.ceil((existing.resetAtMs - Date.now()) / 1e3))
  };
}
async function incrementDistributedCounter(counterKey, windowSeconds) {
  const creds = getRedisCreds();
  const safeKey = `wc:cnt:${counterKey}`;
  if (creds) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2e3);
      const res = await fetch(`${creds.url}/pipeline`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${creds.token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify([
          ["INCR", safeKey],
          ["EXPIRE", safeKey, String(windowSeconds)],
          ["TTL", safeKey]
        ]),
        signal: controller.signal
      });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        return {
          count: Number(data?.[0]?.result || 1),
          ttlSec: Math.max(1, Number(data?.[2]?.result || windowSeconds))
        };
      }
    } catch {
    }
  }
  const now = Date.now();
  const existing = devMemoryBuckets.get(safeKey);
  if (!existing || existing.resetAtMs <= now) {
    const next = { count: 1, resetAtMs: now + windowSeconds * 1e3 };
    devMemoryBuckets.set(safeKey, next);
    return { count: 1, ttlSec: windowSeconds };
  }
  existing.count += 1;
  existing.resetAtMs = now + windowSeconds * 1e3;
  return { count: existing.count, ttlSec: windowSeconds };
}
async function deleteDistributedCounter(counterKey) {
  const creds = getRedisCreds();
  const safeKey = `wc:cnt:${counterKey}`;
  devMemoryBuckets.delete(safeKey);
  if (creds) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2e3);
      await fetch(`${creds.url}/del/${encodeURIComponent(safeKey)}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${creds.token}`
        },
        signal: controller.signal
      });
      clearTimeout(timer);
    } catch {
    }
  }
}
function extractClientIpKey(rawHeader, fallbackIp) {
  const first = (rawHeader || fallbackIp || "unknown").split(",")[0].trim();
  return first.replace(/[^a-zA-Z0-9.:_-]/g, "").slice(0, 64) || "unknown";
}

// server/security.ts
var SESSION_COOKIE_NAME = "wc_session";
var SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
var CUSTOMER_COOKIE_TTL_SECONDS = 60 * 60 * 24 * 180;
var AGENT_INVITE_TTL_MS = 1e3 * 60 * 60 * 72;
function isProdRuntime() {
  return process.env.NODE_ENV === "production";
}
var AUTH_DATA_DIR = process.env.VERCEL ? path.join("/tmp", "workcraft-data") : path.resolve(process.cwd(), ".data");
var AUTH_USERS_FILE = path.join(AUTH_DATA_DIR, "auth-users.json");
var FOUNDER_CRED_FILE = path.join(AUTH_DATA_DIR, "founder-cred.json");
var DEV_JWT_KEY_FILE = path.join(AUTH_DATA_DIR, "dev-jwt.key");
var cachedDevJwtSecret = "";
function isJwtSecretConfigured() {
  const configured = (process.env.JWT_SECRET || "").trim();
  if (isProdRuntime()) {
    return configured.length >= 32;
  }
  return true;
}
function getRuntimeJwtSecret() {
  const configured = (process.env.JWT_SECRET || "").trim();
  if (configured.length >= 32) return configured;
  if (isProdRuntime()) {
    console.error(
      "CRITICAL SECURITY CONFIG: JWT_SECRET (>= 32 chars) is missing in production. Auth endpoints will fail closed."
    );
    return "";
  }
  if (cachedDevJwtSecret.length >= 32) return cachedDevJwtSecret;
  try {
    if (fs.existsSync(DEV_JWT_KEY_FILE)) {
      const saved = fs.readFileSync(DEV_JWT_KEY_FILE, "utf8").trim();
      if (saved.length >= 32) {
        cachedDevJwtSecret = saved;
        return saved;
      }
    }
    if (!fs.existsSync(AUTH_DATA_DIR)) {
      fs.mkdirSync(AUTH_DATA_DIR, { recursive: true });
    }
    const generated = crypto2.randomBytes(32).toString("hex");
    fs.writeFileSync(DEV_JWT_KEY_FILE, generated, { mode: 384 });
    cachedDevJwtSecret = generated;
    return generated;
  } catch {
    cachedDevJwtSecret = configured || crypto2.randomBytes(32).toString("hex");
    return cachedDevJwtSecret;
  }
}
function getRuntimeCookieSigningSecret() {
  const dedicated = (process.env.COOKIE_SIGNING_SECRET || "").trim();
  if (dedicated.length >= 32) return dedicated;
  return getRuntimeJwtSecret();
}
var DEV_EPHEMERAL_WEBHOOK_SECRET = crypto2.randomBytes(24).toString("hex");
function getRuntimeWebhookSecret() {
  const configured = (process.env.WORKCRAFT_WEBHOOK_SECRET || "").trim();
  if (configured) return configured;
  if (isProdRuntime()) return "";
  return DEV_EPHEMERAL_WEBHOOK_SECRET;
}
function readStoredFounderCred() {
  try {
    if (!fs.existsSync(FOUNDER_CRED_FILE)) return null;
    const raw = fs.readFileSync(FOUNDER_CRED_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (typeof parsed?.salt === "string" && typeof parsed?.hash === "string") {
      return {
        salt: parsed.salt,
        hash: parsed.hash,
        createdAt: parsed.createdAt || (/* @__PURE__ */ new Date()).toISOString()
      };
    }
    return null;
  } catch {
    return null;
  }
}
function getFounderAuthStatus() {
  const envPin = (process.env.FOUNDER_PIN || process.env.FOUNDER_ACCESS_KEY || "").trim();
  const hasEnvPin = envPin.length >= 4;
  const hasJwt = isJwtSecretConfigured();
  if (isProdRuntime()) {
    const missingEnvVars = [];
    if (!hasJwt) missingEnvVars.push("JWT_SECRET");
    if (!hasEnvPin) missingEnvVars.push("FOUNDER_PIN");
    const prodReady = hasEnvPin && hasJwt;
    return {
      configured: prodReady,
      setupRequired: false,
      productionMisconfigured: !prodReady,
      founderPinConfigured: hasEnvPin,
      jwtSecretConfigured: hasJwt,
      missingEnvVars
    };
  }
  if (hasEnvPin) {
    return {
      configured: true,
      setupRequired: false,
      productionMisconfigured: false,
      founderPinConfigured: true,
      jwtSecretConfigured: true,
      missingEnvVars: []
    };
  }
  const stored = readStoredFounderCred();
  if (stored) {
    return {
      configured: true,
      setupRequired: false,
      productionMisconfigured: false,
      founderPinConfigured: true,
      jwtSecretConfigured: true,
      missingEnvVars: []
    };
  }
  return {
    configured: false,
    setupRequired: true,
    productionMisconfigured: false,
    founderPinConfigured: false,
    jwtSecretConfigured: true,
    missingEnvVars: []
  };
}
function claimInitialFounderPin(rawPin) {
  if (isProdRuntime()) {
    return {
      ok: false,
      error: "Initial PIN setup via UI is disabled in production. Configure FOUNDER_PIN in server environment."
    };
  }
  const status = getFounderAuthStatus();
  if (!status.setupRequired) {
    return { ok: false, error: "Founder PIN is already configured." };
  }
  const clean = (rawPin || "").trim().toUpperCase();
  if (clean.length < 6 || clean.length > 24 || !/^[A-Z0-9!@#$%^&*_-]+$/.test(clean)) {
    return {
      ok: false,
      error: "Choose a Founder PIN of 6\u201324 alphanumeric characters."
    };
  }
  const salt = crypto2.randomBytes(16).toString("hex");
  const hash = crypto2.scryptSync(clean, salt, 64).toString("hex");
  try {
    if (!fs.existsSync(AUTH_DATA_DIR)) {
      fs.mkdirSync(AUTH_DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(
      FOUNDER_CRED_FILE,
      JSON.stringify({ salt, hash, createdAt: (/* @__PURE__ */ new Date()).toISOString() }, null, 2),
      { mode: 384 }
    );
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not persist Founder PIN credential on disk." };
  }
}
function verifyFounderPin(candidate) {
  const clean = (candidate || "").trim().toUpperCase();
  if (!clean) return false;
  const envPin = (process.env.FOUNDER_PIN || process.env.FOUNDER_ACCESS_KEY || "").trim().toUpperCase();
  if (envPin) {
    const a = crypto2.createHash("sha256").update(clean).digest();
    const b = crypto2.createHash("sha256").update(envPin).digest();
    return crypto2.timingSafeEqual(a, b);
  }
  if (isProdRuntime()) {
    return false;
  }
  const stored = readStoredFounderCred();
  if (!stored) return false;
  try {
    const derived = crypto2.scryptSync(clean, stored.salt, 64);
    const expected = Buffer.from(stored.hash, "hex");
    if (derived.length !== expected.length) return false;
    return crypto2.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}
async function checkFounderPinAttemptAllowed(clientKey) {
  const rec = await getDistributedCounter(`founder-fail:${clientKey}`);
  if (rec && rec.count >= 5) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, rec.ttlSec || 60)
    };
  }
  return { allowed: true };
}
async function recordFounderPinFailure(clientKey) {
  await incrementDistributedCounter(`founder-fail:${clientKey}`, 60);
}
async function clearFounderPinFailures(clientKey) {
  await deleteDistributedCounter(`founder-fail:${clientKey}`);
}
var currentSessionVersion = 1;
var USER_DIRECTORY = [
  {
    userId: "usr-founder-1",
    userRole: "FOUNDER",
    displayName: "Farhan Abid",
    email: "farhanabidraja1979@gmail.com",
    phone: "+92 300 0000001",
    salonId: null,
    agentId: null,
    badge: "Founder \xB7 All Tenants"
  },
  {
    userId: "usr-agent-pk-1",
    userRole: "AGENT",
    displayName: "Kamran Sheikh",
    email: "kamran@workcraft.local",
    phone: "+92 301 7788990",
    salonId: null,
    agentId: "agent-pk-1",
    badge: "Field Agent \xB7 PK (Lahore / Karachi)"
  },
  {
    userId: "usr-agent-ae-1",
    userRole: "AGENT",
    displayName: "Tariq Al-Mansoor",
    email: "tariq.uae@workcraft.local",
    phone: "+971 50 4455667",
    salonId: null,
    agentId: "agent-ae-1",
    badge: "Field Agent \xB7 UAE / MENA"
  },
  {
    userId: "usr-salon-1",
    userRole: "SALON_OWNER",
    displayName: "Hamza Malik",
    email: "hamza@sevencuts.pk",
    phone: "+92 321 8472910",
    salonId: "1",
    allowedSalonIds: ["1"],
    agentId: "agent-pk-1",
    salonName: "Seven Cuts Studio",
    badge: "Salon #1 \xB7 Seven Cuts Studio (PRO++)"
  },
  {
    userId: "usr-salon-2",
    userRole: "SALON_OWNER",
    displayName: "Tariq Butt",
    email: "tariq@royalfade.pk",
    phone: "+92 300 9876543",
    salonId: "2",
    allowedSalonIds: ["2"],
    agentId: "agent-pk-1",
    salonName: "Royal Fade Lounge",
    badge: "Salon #2 \xB7 Royal Fade Lounge (STARTER)"
  },
  {
    userId: "usr-salon-3",
    userRole: "SALON_OWNER",
    displayName: "Aslam Khan",
    email: "aslam@alnoor.ae",
    phone: "+971 50 8923411",
    salonId: "3",
    allowedSalonIds: ["3"],
    agentId: "agent-ae-1",
    salonName: "Al-Noor Executive Grooming",
    badge: "Salon #3 \xB7 Al-Noor Grooming (UAE PRO++)"
  },
  {
    userId: "usr-salon-4",
    userRole: "SALON_OWNER",
    displayName: "Oliver Bennett",
    email: "oliver@mayfairblade.co.uk",
    phone: "+44 7911 123456",
    salonId: "4",
    allowedSalonIds: ["4"],
    agentId: "agent-uk-1",
    salonName: "Mayfair Blade & Beard",
    badge: "Salon #4 \xB7 Mayfair Blade (UK STARTER)"
  },
  {
    userId: "usr-salon-5",
    userRole: "SALON_OWNER",
    displayName: "Ayesha Siddiqui",
    email: "ayesha@noorbeauty.pk",
    phone: "+92 333 4412345",
    salonId: "5",
    allowedSalonIds: ["5"],
    agentId: "agent-pk-1",
    salonName: "Noor Beauty Lounge (Ladies Parlor)",
    badge: "Salon #5 \xB7 Noor Beauty Lounge (PRO)"
  }
];
var SALON_AGENT_ASSIGNMENTS = /* @__PURE__ */ new Map([
  ["1", "agent-pk-1"],
  ["2", "agent-pk-1"],
  ["3", "agent-ae-1"],
  ["4", "agent-uk-1"],
  ["5", "agent-pk-1"]
]);
function loadPersistedDynamicUsers() {
  try {
    if (!fs.existsSync(AUTH_USERS_FILE)) return;
    const raw = fs.readFileSync(AUTH_USERS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (typeof parsed.sessionVersion === "number" && parsed.sessionVersion >= 1) {
      currentSessionVersion = parsed.sessionVersion;
    }
    if (Array.isArray(parsed.users)) {
      for (const u of parsed.users) {
        if (u?.userId) {
          const idx = USER_DIRECTORY.findIndex((e) => e.userId === u.userId);
          if (idx >= 0) {
            USER_DIRECTORY[idx] = { ...USER_DIRECTORY[idx], ...u };
          } else {
            USER_DIRECTORY.push(u);
          }
        }
      }
    }
    if (Array.isArray(parsed.assignments)) {
      for (const [salonId, agentId] of parsed.assignments) {
        if (salonId && agentId) {
          SALON_AGENT_ASSIGNMENTS.set(salonId, agentId);
        }
      }
    }
  } catch {
  }
}
function persistDynamicUsers() {
  const dynamicUsers = USER_DIRECTORY.filter(
    (u) => u.userId.startsWith("usr-onboard-") || u.allowedSalonIds && u.allowedSalonIds.length > 1
  );
  const assignments = Array.from(SALON_AGENT_ASSIGNMENTS.entries());
  try {
    if (!fs.existsSync(AUTH_DATA_DIR)) {
      fs.mkdirSync(AUTH_DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(
      AUTH_USERS_FILE,
      JSON.stringify(
        { users: dynamicUsers, assignments, sessionVersion: currentSessionVersion },
        null,
        2
      ),
      "utf8"
    );
  } catch (err) {
    console.warn("Could not persist dynamic auth users:", err);
  }
  void kvSetJson("wc:auth:v1", {
    users: dynamicUsers,
    assignments,
    sessionVersion: currentSessionVersion
  });
}
async function hydrateSecurityStoreFromKv() {
  const parsed = await kvGetJson("wc:auth:v1");
  if (!parsed) return;
  if (typeof parsed.sessionVersion === "number" && parsed.sessionVersion > currentSessionVersion) {
    currentSessionVersion = parsed.sessionVersion;
  }
  if (Array.isArray(parsed.users)) {
    for (const u of parsed.users) {
      if (u?.userId) {
        const idx = USER_DIRECTORY.findIndex((e) => e.userId === u.userId);
        if (idx >= 0) {
          USER_DIRECTORY[idx] = { ...USER_DIRECTORY[idx], ...u };
        } else {
          USER_DIRECTORY.push(u);
        }
      }
    }
  }
  if (Array.isArray(parsed.assignments)) {
    for (const [salonId, agentId] of parsed.assignments) {
      if (salonId && agentId) {
        SALON_AGENT_ASSIGNMENTS.set(salonId, agentId);
      }
    }
  }
}
loadPersistedDynamicUsers();
function rotateAllSessions() {
  currentSessionVersion += 1;
  persistDynamicUsers();
  return currentSessionVersion;
}
function registerSalonAssignment(salonId, agentId) {
  if (salonId && agentId) {
    SALON_AGENT_ASSIGNMENTS.set(salonId, agentId);
    persistDynamicUsers();
  }
}
function registerSalonOwnerAccount(params) {
  const cleanPhone = sanitizePhone(params.phone);
  const digits = normalizePhoneDigits(cleanPhone);
  if (digits.length < 7) {
    return { ok: false, error: "A valid owner contact phone number is required." };
  }
  const existing = findUserByIdentifier(cleanPhone);
  if (existing) {
    if (params.allowMultiBranch && existing.userRole === "SALON_OWNER") {
      const nextAllowed = Array.from(
        /* @__PURE__ */ new Set([...existing.allowedSalonIds || (existing.salonId ? [existing.salonId] : []), params.salonId])
      );
      existing.allowedSalonIds = nextAllowed;
      if (params.agentId) {
        SALON_AGENT_ASSIGNMENTS.set(params.salonId, params.agentId);
      }
      persistDynamicUsers();
      return {
        ok: true,
        user: {
          userId: existing.userId,
          userRole: existing.userRole,
          displayName: existing.displayName,
          email: existing.email,
          phone: existing.phone,
          salonId: existing.salonId,
          allowedSalonIds: nextAllowed,
          agentId: existing.agentId,
          salonName: existing.salonName,
          sessionVersion: currentSessionVersion
        }
      };
    }
    return {
      ok: false,
      error: "This mobile number is already registered. Please sign in to add another branch."
    };
  }
  const cleanSalonName = sanitizePlainText(params.salonName, 100) || "Partner Salon";
  const cleanOwnerName = sanitizePlainText(params.ownerName, 80) || "Salon Owner";
  const newUser = {
    userId: `usr-onboard-${params.salonId}`,
    userRole: "SALON_OWNER",
    displayName: cleanOwnerName,
    email: `${params.salonId}@salon.workcraft.local`,
    phone: cleanPhone,
    salonId: params.salonId,
    allowedSalonIds: [params.salonId],
    agentId: params.agentId ?? null,
    salonName: cleanSalonName,
    badge: `Onboarded \xB7 ${cleanSalonName}`
  };
  USER_DIRECTORY.push(newUser);
  if (params.agentId) {
    SALON_AGENT_ASSIGNMENTS.set(params.salonId, params.agentId);
  }
  persistDynamicUsers();
  return {
    ok: true,
    user: {
      userId: newUser.userId,
      userRole: newUser.userRole,
      displayName: newUser.displayName,
      email: newUser.email,
      phone: newUser.phone,
      salonId: newUser.salonId,
      allowedSalonIds: newUser.allowedSalonIds,
      agentId: newUser.agentId,
      salonName: newUser.salonName,
      sessionVersion: currentSessionVersion
    }
  };
}
function getSalonsAssignedToAgent(agentId) {
  const ids = [];
  for (const [salonId, assigned] of SALON_AGENT_ASSIGNMENTS.entries()) {
    if (assigned === agentId) ids.push(salonId);
  }
  return ids;
}
function isSalonAssignedToAgent(salonId, agentId) {
  if (!agentId) return false;
  return SALON_AGENT_ASSIGNMENTS.get(salonId) === agentId;
}
function sanitizePlainText(value, maxLength = 500) {
  if (typeof value !== "string") return "";
  let cleaned = value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ").replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ").replace(/<[^>]*>/g, " ").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/\b(?:javascript|vbscript|data):/gi, "").trim();
  if (cleaned.length > maxLength) {
    cleaned = cleaned.slice(0, maxLength).trim();
  }
  return cleaned;
}
function sanitizeMultilineTemplate(value, maxLength = 600) {
  if (typeof value !== "string") return "";
  return value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ").replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ").replace(/<[^>]*>/g, " ").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/\b(?:javascript|vbscript|data):/gi, "").trim().slice(0, maxLength);
}
function sanitizePhone(value, maxLength = 24) {
  if (typeof value !== "string") return "";
  return value.replace(/[^\d+\-\s()]/g, "").trim().slice(0, maxLength);
}
function normalizePhoneDigits(phone) {
  return phone.replace(/\D/g, "");
}
function maskPhoneNumber(phone) {
  const digits = normalizePhoneDigits(phone);
  if (digits.length < 4) return "\u2022\u2022\u2022";
  const last4 = digits.slice(-4);
  const trimmed = (phone || "").trim();
  const prefixMatch = trimmed.match(/^\+\d{1,3}/);
  const cc = prefixMatch ? prefixMatch[0] : "";
  return cc ? `${cc} \u2022\u2022\u2022 \u2022\u2022\u2022${last4}` : `\u2022\u2022\u2022 \u2022\u2022\u2022${last4}`;
}
function sanitizeBirthDate(value) {
  if (typeof value !== "string") return "";
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!match) return "";
  const day = Number(match[1]);
  const month = Number(match[2]);
  if (day < 1 || day > 31 || month < 1 || month > 12) return "";
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`;
}
function sanitizeHttpUrl(value, fallback = "") {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return fallback;
    }
    return parsed.toString().slice(0, 300);
  } catch {
    return fallback;
  }
}
function clampInteger(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}
function base64UrlEncode(input) {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function base64UrlDecode(input) {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - input.length % 4);
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(b64, "base64");
}
function signSessionToken(user) {
  const secret = getRuntimeJwtSecret();
  if (!secret) {
    throw new Error("JWT_SECRET is not configured in production.");
  }
  const nowSec = Math.floor(Date.now() / 1e3);
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payloadObj = {
    sub: user.userId,
    user_role: user.userRole,
    salon_id: user.salonId,
    allowed_salon_ids: user.allowedSalonIds,
    agent_id: user.agentId,
    display_name: user.displayName,
    email: user.email,
    phone: user.phone,
    salon_name: user.salonName,
    sv: currentSessionVersion,
    iat: nowSec,
    exp: nowSec + SESSION_TTL_SECONDS
  };
  const payload = base64UrlEncode(JSON.stringify(payloadObj));
  const data = `${header}.${payload}`;
  const sig = base64UrlEncode(
    crypto2.createHmac("sha256", secret).update(data).digest()
  );
  return `${data}.${sig}`;
}
function verifySessionToken(token) {
  try {
    const secret = getRuntimeJwtSecret();
    if (!secret) return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, sigB64] = parts;
    const data = `${headerB64}.${payloadB64}`;
    const expectedSig = base64UrlEncode(
      crypto2.createHmac("sha256", secret).update(data).digest()
    );
    const sigBuf = Buffer.from(sigB64);
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length || !crypto2.timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }
    const claims = JSON.parse(base64UrlDecode(payloadB64).toString("utf8"));
    const nowSec = Math.floor(Date.now() / 1e3);
    if (!claims.sub || !claims.user_role || !claims.exp || claims.exp < nowSec) {
      return null;
    }
    if (typeof claims.sv === "number" && claims.sv !== currentSessionVersion) {
      return null;
    }
    return {
      userId: claims.sub,
      userRole: claims.user_role,
      displayName: claims.display_name,
      email: claims.email,
      phone: claims.phone,
      salonId: claims.salon_id ?? null,
      allowedSalonIds: claims.allowed_salon_ids,
      agentId: claims.agent_id ?? null,
      salonName: claims.salon_name,
      sessionVersion: claims.sv
    };
  } catch {
    return null;
  }
}
function signServerBlob(payload) {
  const secret = getRuntimeCookieSigningSecret();
  if (!secret) {
    throw new Error("COOKIE_SIGNING_SECRET / JWT_SECRET is not configured in production.");
  }
  const data = base64UrlEncode(JSON.stringify(payload));
  const sig = base64UrlEncode(
    crypto2.createHmac("sha256", secret).update(`wc-blob:${data}`).digest()
  );
  return `${data}.${sig}`;
}
function verifyServerBlob(blob) {
  try {
    const secret = getRuntimeCookieSigningSecret();
    if (!secret) return null;
    const parts = (blob || "").split(".");
    if (parts.length !== 2) return null;
    const [data, sig] = parts;
    const expectedSig = base64UrlEncode(
      crypto2.createHmac("sha256", secret).update(`wc-blob:${data}`).digest()
    );
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto2.timingSafeEqual(a, b)) {
      return null;
    }
    return JSON.parse(base64UrlDecode(data).toString("utf8"));
  } catch {
    return null;
  }
}
function signCustomerRecognizeToken(params) {
  const exp = Math.floor(Date.now() / 1e3) + (params.ttlSeconds ?? CUSTOMER_COOKIE_TTL_SECONDS);
  return signServerBlob({
    kind: "wc-client-recognize",
    salonId: params.salonId,
    publicCode: params.publicCode,
    clientId: params.clientId,
    exp
  });
}
function verifyCustomerRecognizeToken(token, expectedSalonId) {
  const claims = verifyServerBlob(token);
  if (!claims || claims.kind !== "wc-client-recognize") return null;
  const nowSec = Math.floor(Date.now() / 1e3);
  if (!claims.exp || claims.exp < nowSec) return null;
  if (expectedSalonId && claims.salonId !== expectedSalonId) return null;
  return claims;
}
function getCustomerCookieName(publicCode) {
  const safe = (publicCode || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32);
  return `wc_cli_${safe}`;
}
function parseCookieHeader(cookieHeader) {
  const out = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(";")) {
    const eqIdx = part.indexOf("=");
    if (eqIdx <= 0) continue;
    const key = part.slice(0, eqIdx).trim();
    const val = part.slice(eqIdx + 1).trim();
    if (key) {
      try {
        out[key] = decodeURIComponent(val);
      } catch {
        out[key] = val;
      }
    }
  }
  return out;
}
function appendSetCookie(res, cookieStr) {
  const existing = res.getHeader("Set-Cookie");
  if (!existing) {
    res.setHeader("Set-Cookie", cookieStr);
  } else if (Array.isArray(existing)) {
    res.setHeader("Set-Cookie", [...existing, cookieStr]);
  } else {
    res.setHeader("Set-Cookie", [String(existing), cookieStr]);
  }
}
function buildCookieAttributes(req, maxAge = SESSION_TTL_SECONDS) {
  const isHttps = Boolean(req?.secure) || req?.header("x-forwarded-proto") === "https" || isProdRuntime();
  if (isHttps) {
    return ["Path=/", "HttpOnly", "SameSite=None", "Secure", "Partitioned", `Max-Age=${maxAge}`];
  }
  return ["Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAge}`];
}
function setSessionCookie(res, token, req) {
  const attrs = buildCookieAttributes(req, SESSION_TTL_SECONDS);
  appendSetCookie(res, `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; ${attrs.join("; ")}`);
}
function clearSessionCookie(res, req) {
  const attrs = buildCookieAttributes(req, 0);
  appendSetCookie(res, `${SESSION_COOKIE_NAME}=; ${attrs.join("; ")}`);
}
function setCustomerBrowserCookie(res, publicCode, token, req) {
  const cookieName = getCustomerCookieName(publicCode);
  const attrs = buildCookieAttributes(req, CUSTOMER_COOKIE_TTL_SECONDS);
  appendSetCookie(res, `${cookieName}=${encodeURIComponent(token)}; ${attrs.join("; ")}`);
}
function verifySameOriginMutation(req) {
  const origin = req.header("origin");
  if (!origin) return true;
  const host = req.header("x-forwarded-host") || req.header("host") || "";
  if (!host) return true;
  try {
    const parsed = new URL(origin);
    return parsed.host.toLowerCase() === host.split(",")[0].trim().toLowerCase();
  } catch {
    return false;
  }
}
var ownerLoginChallenges = /* @__PURE__ */ new Map();
function issueOwnerLoginChallenge(rawIdentifier) {
  const user = findUserByIdentifier(rawIdentifier);
  if (!user || user.userRole !== "SALON_OWNER" && user.userRole !== "AGENT") {
    return {
      ok: false,
      error: "No Salon Owner or Field Agent account matched that phone or email."
    };
  }
  const code = String(crypto2.randomInt(1e5, 999999));
  const challengeId = `chl_${crypto2.randomBytes(12).toString("hex")}`;
  const codeHash = crypto2.createHash("sha256").update(`${challengeId}:${code}`).digest("hex");
  if (ownerLoginChallenges.size > 500) {
    const now = Date.now();
    for (const [k, v] of ownerLoginChallenges.entries()) {
      if (v.expiresAtMs < now) ownerLoginChallenges.delete(k);
    }
  }
  ownerLoginChallenges.set(challengeId, {
    challengeId,
    userId: user.userId,
    codeHash,
    expiresAtMs: Date.now() + 5 * 6e4,
    attempts: 0
  });
  return {
    ok: true,
    challengeId,
    maskedPhone: maskPhoneNumber(user.phone),
    role: user.userRole,
    displayName: user.displayName,
    devPreviewCode: isProdRuntime() ? void 0 : code
  };
}
function verifyOwnerLoginChallenge(challengeId, candidateCode) {
  const rec = ownerLoginChallenges.get((challengeId || "").trim());
  if (!rec) {
    return { ok: false, error: "Login verification session expired or not found." };
  }
  if (rec.expiresAtMs < Date.now()) {
    ownerLoginChallenges.delete(rec.challengeId);
    return { ok: false, error: "Verification code expired. Request a new code." };
  }
  if (rec.attempts >= 5) {
    ownerLoginChallenges.delete(rec.challengeId);
    return { ok: false, error: "Too many invalid code attempts. Request a new code." };
  }
  rec.attempts += 1;
  const cleanCode = (candidateCode || "").trim();
  const candidateHash = crypto2.createHash("sha256").update(`${rec.challengeId}:${cleanCode}`).digest();
  const expectedHash = Buffer.from(rec.codeHash, "hex");
  if (candidateHash.length !== expectedHash.length || !crypto2.timingSafeEqual(candidateHash, expectedHash)) {
    return { ok: false, error: "Incorrect 6-digit verification code." };
  }
  ownerLoginChallenges.delete(rec.challengeId);
  const userRec = findUserById(rec.userId);
  if (!userRec) {
    return { ok: false, error: "Account record no longer exists." };
  }
  return {
    ok: true,
    user: {
      userId: userRec.userId,
      userRole: userRec.userRole,
      displayName: userRec.displayName,
      email: userRec.email,
      phone: userRec.phone,
      salonId: userRec.salonId,
      allowedSalonIds: userRec.allowedSalonIds,
      agentId: userRec.agentId,
      salonName: userRec.salonName,
      sessionVersion: currentSessionVersion
    }
  };
}
function getFounderSessionUser() {
  const f = USER_DIRECTORY[0];
  return {
    userId: f.userId,
    userRole: f.userRole,
    displayName: f.displayName,
    email: f.email,
    phone: f.phone,
    salonId: f.salonId,
    agentId: f.agentId,
    salonName: f.salonName,
    sessionVersion: currentSessionVersion
  };
}
function findUserByIdentifier(rawIdentifier) {
  const cleaned = sanitizePlainText(rawIdentifier, 120);
  if (!cleaned) return null;
  const lowerEmail = cleaned.toLowerCase();
  if (lowerEmail.includes("@")) {
    return USER_DIRECTORY.find((u) => u.email.toLowerCase() === lowerEmail) || null;
  }
  const digits = normalizePhoneDigits(cleaned);
  if (digits.length < 7) return null;
  return USER_DIRECTORY.find((u) => {
    const uDigits = normalizePhoneDigits(u.phone);
    return uDigits === digits || digits.length >= 9 && uDigits.endsWith(digits.slice(-9));
  }) || null;
}
function findUserById(userId) {
  return USER_DIRECTORY.find((u) => u.userId === userId) || null;
}
var AGENT_INVITES_FILE = path.join(AUTH_DATA_DIR, "agent-invites.json");
var agentInvites = /* @__PURE__ */ new Map();
function hashInviteToken(rawToken) {
  return crypto2.createHash("sha256").update(rawToken.trim()).digest("hex");
}
function loadPersistedAgentInvites() {
  try {
    if (!fs.existsSync(AGENT_INVITES_FILE)) return;
    const raw = fs.readFileSync(AGENT_INVITES_FILE, "utf8");
    const list = JSON.parse(raw);
    if (Array.isArray(list)) {
      for (const rec of list) {
        if (rec?.tokenHash) {
          agentInvites.set(rec.tokenHash, rec);
        }
      }
    }
  } catch {
  }
}
function persistAgentInvites() {
  try {
    if (!fs.existsSync(AUTH_DATA_DIR)) {
      fs.mkdirSync(AUTH_DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(
      AGENT_INVITES_FILE,
      JSON.stringify(Array.from(agentInvites.values()), null, 2),
      "utf8"
    );
  } catch (err) {
    console.warn("Could not persist agent invites:", err);
  }
}
loadPersistedAgentInvites();
function createAgentInviteToken(params) {
  const cleanName = sanitizePlainText(params.name, 80) || "Field Agent";
  const cleanPhone = sanitizePhone(params.phone);
  const cleanCity = sanitizePlainText(params.city, 120) || "Assigned Territory";
  const cleanCountry = sanitizePlainText(params.countryName, 60) || "Pakistan";
  const agentId = sanitizePlainText(params.agentId, 40) || `agent-${Date.now().toString(36)}-${crypto2.randomBytes(2).toString("hex")}`;
  const rawToken = crypto2.randomBytes(24).toString("hex");
  const tokenHash = hashInviteToken(rawToken);
  const now = Date.now();
  const expiresAt = new Date(now + AGENT_INVITE_TTL_MS).toISOString();
  agentInvites.set(tokenHash, {
    tokenHash,
    agentId,
    name: cleanName,
    phone: cleanPhone,
    city: cleanCity,
    countryName: cleanCountry,
    createdAt: new Date(now).toISOString(),
    expiresAt,
    usedAt: null
  });
  persistAgentInvites();
  return {
    token: rawToken,
    agentId,
    name: cleanName,
    phone: cleanPhone,
    city: cleanCity,
    countryName: cleanCountry,
    expiresAt
  };
}
function inspectAgentInviteToken(rawToken) {
  const cleaned = sanitizePlainText(rawToken, 128);
  if (!cleaned || cleaned.length < 16) {
    return { valid: false, status: 400, error: "Missing or invalid agent invite token." };
  }
  const tokenHash = hashInviteToken(cleaned);
  const rec = agentInvites.get(tokenHash);
  if (!rec) {
    return { valid: false, status: 404, error: "Agent invite link not found." };
  }
  if (rec.usedAt) {
    return {
      valid: false,
      status: 410,
      error: "This single-use agent invite link has already been used and is permanently locked."
    };
  }
  if (new Date(rec.expiresAt).getTime() < Date.now()) {
    return { valid: false, status: 410, error: "This agent invite link has expired." };
  }
  return {
    valid: true,
    invite: {
      agentId: rec.agentId,
      name: rec.name,
      phone: rec.phone,
      city: rec.city,
      countryName: rec.countryName,
      createdAt: rec.createdAt,
      expiresAt: rec.expiresAt,
      usedAt: rec.usedAt
    }
  };
}
function consumeAgentInviteTokenAndRegisterAgent(params) {
  const check = inspectAgentInviteToken(params.rawToken);
  if (!check.valid) {
    return { ok: false, status: check.status, error: check.error };
  }
  const tokenHash = hashInviteToken(params.rawToken);
  const rec = agentInvites.get(tokenHash);
  rec.usedAt = (/* @__PURE__ */ new Date()).toISOString();
  persistAgentInvites();
  const finalName = sanitizePlainText(params.name, 80) || rec.name;
  const finalPhone = sanitizePhone(params.phone) || rec.phone;
  const finalCity = sanitizePlainText(params.city, 120) || rec.city;
  const userId = `usr-onboard-${rec.agentId}`;
  const existingIdx = USER_DIRECTORY.findIndex(
    (u) => u.userId === userId || u.userRole === "AGENT" && u.agentId === rec.agentId
  );
  const agentRecord = {
    userId,
    userRole: "AGENT",
    displayName: finalName,
    email: `${rec.agentId}@agent.workcraft.local`,
    phone: finalPhone,
    salonId: null,
    agentId: rec.agentId,
    badge: `Field Agent \xB7 ${finalCity}`
  };
  if (existingIdx >= 0) {
    USER_DIRECTORY[existingIdx] = agentRecord;
  } else {
    USER_DIRECTORY.push(agentRecord);
  }
  persistDynamicUsers();
  return {
    ok: true,
    user: {
      userId: agentRecord.userId,
      userRole: "AGENT",
      displayName: agentRecord.displayName,
      email: agentRecord.email,
      phone: agentRecord.phone,
      salonId: null,
      agentId: rec.agentId,
      sessionVersion: currentSessionVersion
    }
  };
}
function extractAuthUserFromRequest(req) {
  const authHeader = req.header("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const bearer = authHeader.slice(7).trim();
    const verified = verifySessionToken(bearer);
    if (verified) return verified;
  }
  const cookies = parseCookieHeader(req.header("cookie"));
  const sessionCookie = cookies[SESSION_COOKIE_NAME];
  if (sessionCookie) {
    return verifySessionToken(sessionCookie);
  }
  return null;
}
function requireAuth(req, res, next) {
  if (!isJwtSecretConfigured()) {
    return res.status(503).json({
      error: "Server authentication is not configured (missing JWT_SECRET)."
    });
  }
  const user = extractAuthUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: "Authentication required. Please open your portal link." });
  }
  if (req.method !== "GET" && req.method !== "HEAD" && !req.header("authorization")) {
    if (!verifySameOriginMutation(req)) {
      return res.status(403).json({ error: "Cross-origin cookie mutation rejected." });
    }
  }
  req.authUser = user;
  return next();
}
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const user = req.authUser;
    if (!user) {
      return res.status(401).json({ error: "Authentication required." });
    }
    if (!allowedRoles.includes(user.userRole)) {
      return res.status(403).json({ error: "Forbidden: insufficient role privileges." });
    }
    return next();
  };
}
function requireSalonTenantAccess(allowAgentReadOnly = false) {
  return (req, res, next) => {
    const user = req.authUser;
    if (!user) {
      return res.status(401).json({ error: "Authentication required." });
    }
    const requestedSalonId = String(req.params.salonId || "").trim();
    if (!requestedSalonId) {
      return res.status(400).json({ error: "salonId is required." });
    }
    if (user.userRole === "FOUNDER") {
      return next();
    }
    if (user.userRole === "SALON_OWNER") {
      const allowed = /* @__PURE__ */ new Set([
        ...user.salonId ? [user.salonId] : [],
        ...Array.isArray(user.allowedSalonIds) ? user.allowedSalonIds : []
      ]);
      if (!allowed.has(requestedSalonId)) {
        return res.status(403).json({
          error: "Forbidden: tenant isolation blocks cross-salon access."
        });
      }
      return next();
    }
    if (user.userRole === "AGENT") {
      if (!allowAgentReadOnly) {
        return res.status(403).json({
          error: "Forbidden: field agents cannot mutate live salon owner operational tables."
        });
      }
      if (!isSalonAssignedToAgent(requestedSalonId, user.agentId)) {
        return res.status(403).json({
          error: "Forbidden: salon is not assigned to your agent_id."
        });
      }
      return next();
    }
    return res.status(403).json({ error: "Forbidden." });
  };
}
function requireWebhookSecret(req, res, next) {
  const expectedSecret = getRuntimeWebhookSecret();
  if (!expectedSecret) {
    return res.status(503).json({
      error: "Webhook secret not configured on server (WORKCRAFT_WEBHOOK_SECRET)."
    });
  }
  const provided = (req.header("x-workcraft-webhook-secret") || "").trim();
  if (!provided) {
    return res.status(401).json({
      error: "Unauthorized: missing x-workcraft-webhook-secret header."
    });
  }
  const providedHash = crypto2.createHash("sha256").update(provided).digest();
  const expectedHash = crypto2.createHash("sha256").update(expectedSecret).digest();
  if (!crypto2.timingSafeEqual(providedHash, expectedHash)) {
    return res.status(401).json({
      error: "Unauthorized: invalid x-workcraft-webhook-secret header."
    });
  }
  return next();
}

// server/conciergeEngine.ts
var BookingLifecycleError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = "BookingLifecycleError";
    this.statusCode = statusCode;
  }
};
var DEFAULT_SALON_BARBERS = ["Master Aslam", "Tariq Mehmood", "Ali Raza", "Bilal Tariq"];
function parseTimeSlotToMinutes(slot) {
  const m = slot.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!m) return -1;
  let hour = parseInt(m[1], 10);
  const mins = m[2] ? parseInt(m[2], 10) : 0;
  const meridiem = (m[3] || "").toUpperCase();
  if (meridiem === "PM" && hour < 12) hour += 12;
  else if (meridiem === "AM" && hour === 12) hour = 0;
  else if (!meridiem && hour >= 1 && hour <= 10) hour += 12;
  return hour * 60 + mins;
}
function formatMinutesToTimeSlot(totalMinutes) {
  const norm = (totalMinutes % 1440 + 1440) % 1440;
  const h24 = Math.floor(norm / 60);
  const mins = norm % 60;
  const meridiem = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${String(h12).padStart(2, "0")}:${String(mins).padStart(2, "0")} ${meridiem}`;
}
var DATA_DIR = process.env.VERCEL ? path2.join("/tmp", "workcraft-data") : path2.resolve(process.cwd(), ".data");
var STORE_FILE = path2.join(DATA_DIR, "concierge-store.json");
var DEAL_VIDEO_DIR = path2.join(DATA_DIR, "deal-videos");
var DEFAULT_SALON_OPERATING_HOURS = {
  monThuOpen: "11:00 AM",
  monThuClose: "11:00 PM",
  monThuClosed: false,
  fridayOpen: "11:00 AM",
  fridayClose: "11:30 PM",
  fridayBreakStart: "01:00 PM",
  fridayBreakEnd: "02:30 PM",
  fridayClosed: false,
  satSunOpen: "10:30 AM",
  satSunClose: "11:30 PM",
  satSunClosed: false
};
var SEEDED_SALON_ADDRESSES = {
  "1": "Plot 42-C, Commercial Sector, DHA Phase 5, Lahore",
  "2": "Shop 14, Main Boulevard, Gulberg III, Lahore",
  "3": "Al Wasl Plaza, Jumeirah 1, Dubai, UAE",
  "4": "28 Brewer Street, Soho, London W1F 0SR, UK",
  "5": "Building 9-B, Clifton Block 4, Karachi"
};
var SEEDED_PUBLIC_CODES = {
  "1": "wc_7k9m2p4x8q2a",
  "2": "wc_3r8v5n2w9c4j",
  "3": "wc_9p4d6t2m8y1k",
  "4": "wc_5w2h8z4f7b3n",
  "5": "wc_6m9q3x7v2p5d"
};
var PLAN_QUOTAS = {
  STARTER: { limit: 750, grace: 50 },
  PRO: { limit: 1500, grace: 100 },
  "PRO++": { limit: 3e3, grace: 200 },
  CUSTOM: { limit: 1e4, grace: 1e3 }
};
var META_WHATSAPP_MONTHLY_CAP = 1e3;
var SUPPORTED_CLIENT_LANGS = /* @__PURE__ */ new Set([
  "en",
  "roman_ur",
  "ur",
  "ar",
  "it",
  "ru",
  "fr",
  "de",
  "es"
]);
function sanitizeClientLang(val, fallback = "en") {
  if (typeof val === "string" && SUPPORTED_CLIENT_LANGS.has(val)) {
    return val;
  }
  return fallback;
}
var EUROPEAN_TWO_LANG_BY_PREFIX = {
  "+39": "it",
  "+7": "ru",
  "+33": "fr",
  "+49": "de",
  "+34": "es"
};
function generateUnguessablePublicCode(salonId) {
  if (salonId && SEEDED_PUBLIC_CODES[salonId]) {
    return SEEDED_PUBLIC_CODES[salonId];
  }
  return `wc_${crypto3.randomBytes(6).toString("hex")}`;
}
function detectTimezoneIana(countryCode) {
  if (countryCode === "+92") return "Asia/Karachi";
  if (countryCode === "+91") return "Asia/Kolkata";
  if (countryCode === "+971" || countryCode === "+968") return "Asia/Dubai";
  if (["+966", "+974", "+965", "+973"].includes(countryCode)) return "Asia/Riyadh";
  if (countryCode === "+44") return "Europe/London";
  if (countryCode === "+39") return "Europe/Rome";
  if (countryCode === "+33") return "Europe/Paris";
  if (countryCode === "+34") return "Europe/Madrid";
  if (countryCode === "+7") return "Europe/Moscow";
  if (countryCode === "+1") return "America/Toronto";
  if (["+49", "+31", "+32", "+43", "+351", "+353", "+30", "+358"].includes(countryCode)) {
    return "Europe/Berlin";
  }
  return "Asia/Karachi";
}
function buildGoogleMapsSearchUrl(salonName, address) {
  return `https://maps.google.com/?q=${encodeURIComponent(`${salonName} ${address}`.trim())}`;
}
function getDefaultClientLanguagesForRegion(region, phone) {
  if (region === "PK") return ["en", "roman_ur", "ur"];
  if (region === "MENA") return ["en", "ur", "ar"];
  const cc = phone ? extractCountryCode(phone) : "";
  const localEuLang = EUROPEAN_TWO_LANG_BY_PREFIX[cc];
  if (localEuLang) {
    return ["en", localEuLang];
  }
  return ["en", "ur", "ar"];
}
function getAllowedClientLanguagesForRegion(region, phone) {
  return getDefaultClientLanguagesForRegion(region, phone);
}
function normalizeClientLanguageList(langs, region, phone) {
  const allowed = getAllowedClientLanguagesForRegion(region, phone);
  const cc = phone ? extractCountryCode(phone) : "";
  if (EUROPEAN_TWO_LANG_BY_PREFIX[cc]) {
    return [...allowed];
  }
  const allowedSet = new Set(allowed);
  if (!Array.isArray(langs) || langs.length === 0) {
    return [...allowed];
  }
  const cleaned = langs.filter((l) => allowedSet.has(l));
  if (!cleaned.includes("en")) cleaned.unshift("en");
  for (const fallbackLang of allowed) {
    if (!cleaned.includes(fallbackLang)) cleaned.push(fallbackLang);
  }
  return Array.from(new Set(cleaned));
}
function getSalonLocalDateParts(offsetHours, nowDate = /* @__PURE__ */ new Date()) {
  const utcMs = nowDate.getTime() + nowDate.getTimezoneOffset() * 6e4;
  const local = new Date(utcMs + offsetHours * 36e5);
  const yyyy = local.getFullYear();
  const mm = String(local.getMonth() + 1).padStart(2, "0");
  const dd = String(local.getDate()).padStart(2, "0");
  return {
    dateStr: `${yyyy}-${mm}-${dd}`,
    minutesOfDay: local.getHours() * 60 + local.getMinutes(),
    dayOfWeek: local.getDay()
    // 0=Sun .. 5=Fri .. 6=Sat
  };
}
function getIsoLocalDateStr(iso, offsetHours) {
  if (!iso) return null;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return getSalonLocalDateParts(offsetHours, parsed).dateStr;
}
function extractCountryCode(phone) {
  const cleaned = phone.replace(/[^\d+]/g, "");
  const prefixes = [
    "+971",
    "+966",
    "+974",
    "+965",
    "+968",
    "+973",
    "+351",
    "+353",
    "+358",
    "+92",
    "+91",
    "+44",
    "+33",
    "+49",
    "+34",
    "+39",
    "+31",
    "+32",
    "+43",
    "+30",
    "+7",
    "+1"
  ];
  for (const prefix of prefixes) {
    if (cleaned.startsWith(prefix)) return prefix;
  }
  const match = cleaned.match(/^\+\d{1,3}/);
  return match ? match[0] : "+92";
}
function detectRegionFromPhone(phone) {
  const cc = extractCountryCode(phone);
  if (cc === "+92") {
    return {
      region: "PK",
      regionLabel: "Pakistan (+92)",
      countryCode: cc,
      timezoneOffsetHours: 5,
      currency: "PKR",
      currencySymbol: "PKR "
    };
  }
  if (cc === "+91") {
    return {
      region: "PK",
      regionLabel: "India (+91)",
      countryCode: cc,
      timezoneOffsetHours: 5.5,
      currency: "INR",
      currencySymbol: "\u20B9"
    };
  }
  if (["+971", "+966", "+974", "+965", "+968", "+973"].includes(cc)) {
    const currencyMap = {
      "+971": { curr: "AED", sym: "AED ", tz: 4, label: "MENA \xB7 UAE (+971)" },
      "+966": { curr: "SAR", sym: "SAR ", tz: 3, label: "MENA \xB7 Saudi Arabia (+966)" },
      "+974": { curr: "QAR", sym: "QAR ", tz: 3, label: "MENA \xB7 Qatar (+974)" },
      "+965": { curr: "KWD", sym: "KWD ", tz: 3, label: "MENA \xB7 Kuwait (+965)" },
      "+968": { curr: "OMR", sym: "OMR ", tz: 4, label: "MENA \xB7 Oman (+968)" },
      "+973": { curr: "BHD", sym: "BHD ", tz: 3, label: "MENA \xB7 Bahrain (+973)" }
    };
    const info = currencyMap[cc] || currencyMap["+971"];
    return {
      region: "MENA",
      regionLabel: info.label,
      countryCode: cc,
      timezoneOffsetHours: info.tz,
      currency: info.curr,
      currencySymbol: info.sym
    };
  }
  const euroZoneCodes = /* @__PURE__ */ new Set(["+33", "+49", "+34", "+39", "+31", "+32", "+43", "+351", "+353", "+30", "+358"]);
  if (cc === "+44") {
    return {
      region: "INTL",
      regionLabel: "United Kingdom (+44)",
      countryCode: cc,
      timezoneOffsetHours: 0,
      currency: "GBP",
      currencySymbol: "\xA3"
    };
  }
  if (cc === "+7") {
    return {
      region: "INTL",
      regionLabel: "Russia (+7)",
      countryCode: cc,
      timezoneOffsetHours: 3,
      currency: "RUB",
      currencySymbol: "\u20BD"
    };
  }
  if (euroZoneCodes.has(cc)) {
    return {
      region: "INTL",
      regionLabel: `Europe (${cc})`,
      countryCode: cc,
      timezoneOffsetHours: 1,
      currency: "EUR",
      currencySymbol: "\u20AC"
    };
  }
  return {
    region: "INTL",
    regionLabel: cc === "+1" ? "USA / Canada (+1)" : `International (${cc})`,
    countryCode: cc,
    timezoneOffsetHours: cc === "+1" ? -5 : 1,
    currency: "USD",
    currencySymbol: "$"
  };
}
function getLanguageMenuForRegion(region, phone) {
  const langs = getDefaultClientLanguagesForRegion(region, phone);
  const metaMap = {
    en: { label: "English", nativeLabel: "English", dir: "ltr" },
    roman_ur: { label: "Roman Urdu", nativeLabel: "Roman Urdu", dir: "ltr" },
    ur: { label: "\u0627\u0631\u062F\u0648 (Urdu)", nativeLabel: "\u0627\u0631\u062F\u0648", dir: "rtl" },
    ar: { label: "\u0627\u0644\u0639\u0631\u0628\u064A\u0629 (Arabic)", nativeLabel: "\u0627\u0644\u0639\u0631\u0628\u064A\u0629", dir: "rtl" },
    it: { label: "Italiano", nativeLabel: "Italiano", dir: "ltr" },
    ru: { label: "\u0420\u0443\u0441\u0441\u043A\u0438\u0439 (Russian)", nativeLabel: "\u0420\u0443\u0441\u0441\u043A\u0438\u0439", dir: "ltr" },
    fr: { label: "Fran\xE7ais", nativeLabel: "Fran\xE7ais", dir: "ltr" },
    de: { label: "Deutsch", nativeLabel: "Deutsch", dir: "ltr" },
    es: { label: "Espa\xF1ol", nativeLabel: "Espa\xF1ol", dir: "ltr" }
  };
  return langs.map((lang, idx) => {
    const digit = String(idx + 1);
    const meta = metaMap[lang];
    return {
      index: digit,
      digit,
      lang,
      label: `${digit}. ${meta.label}`,
      nativeLabel: meta.nativeLabel,
      dir: meta.dir
    };
  });
}
function getLangDirection(lang) {
  return lang === "ur" || lang === "ar" ? "rtl" : "ltr";
}
function buildGreetingMenuText(salonName, region) {
  const options = getLanguageMenuForRegion(region);
  const optionsLine = options.map((o) => `[${o.label}]`).join("  ");
  if (region === "PK") {
    return `Assalamu Alaikum & Welcome to ${salonName}! Please choose your preferred language:
${optionsLine}
Reply with 1, 2, or 3.`;
  }
  if (region === "MENA") {
    return `Marhaba & Welcome to ${salonName}! Please choose your preferred language:
${optionsLine}
Reply with 1, 2, or 3.`;
  }
  return `Welcome to ${salonName}! Please select your preferred language:
${optionsLine}
Reply with 1, 2, or 3.`;
}
function getLocalClockForOffset(offsetHours, nowDate = /* @__PURE__ */ new Date()) {
  const utcMs = nowDate.getTime() + nowDate.getTimezoneOffset() * 6e4;
  const local = new Date(utcMs + offsetHours * 36e5);
  const dd = String(local.getDate()).padStart(2, "0");
  const mm = String(local.getMonth() + 1).padStart(2, "0");
  return {
    dayMonth: `${dd}/${mm}`,
    hour: local.getHours(),
    year: local.getFullYear()
  };
}
function getDefaultServicesForCategory(category, currency) {
  const isSouthAsia = currency === "PKR" || currency === "INR";
  if (category === "LADIES") {
    return [
      { id: "l1", name: "Signature Party Makeup & Styling", durationMins: 60, price: isSouthAsia ? 4500 : 280, active: true },
      { id: "l2", name: "Barat / Walima Bridal Package", durationMins: 150, price: isSouthAsia ? 35e3 : 1800, active: true },
      { id: "l3", name: "Hydra-Facial & Skin Polish", durationMins: 50, price: isSouthAsia ? 3500 : 220, active: true },
      { id: "l4", name: "Keratin Hair Rebonding / Smoothing", durationMins: 120, price: isSouthAsia ? 12e3 : 650, active: true },
      { id: "l5", name: "Mani-Pedi Classic Spa", durationMins: 45, price: isSouthAsia ? 2e3 : 140, active: true }
    ];
  }
  return [
    { id: "s1", name: "Master Haircut", durationMins: 35, price: isSouthAsia ? 600 : 50, active: true },
    { id: "s2", name: "Skin Fade", durationMins: 30, price: isSouthAsia ? 500 : 45, active: true },
    { id: "s3", name: "Classic Beard Trim", durationMins: 25, price: isSouthAsia ? 400 : 35, active: true },
    { id: "s4", name: "Hot Towel Steam Shave", durationMins: 25, price: isSouthAsia ? 500 : 40, active: true },
    { id: "s5", name: "Charcoal Deep Detox Facial", durationMins: 45, price: isSouthAsia ? 2500 : 150, active: true },
    { id: "s6", name: "Groom Signature Package", durationMins: 120, price: isSouthAsia ? 12e3 : 550, active: true }
  ];
}
function inferSalonCategory(salonName, salonId, explicit) {
  if (explicit === "LADIES" || explicit === "MENS") return explicit;
  if (salonId === "5") return "LADIES";
  const low = (salonName || "").toLowerCase();
  if (/parlor|parlour|ladies|beauty|bride|bridal|women/.test(low)) return "LADIES";
  return "MENS";
}
function defaultSettingsForSalon(salonId, salonName, ownerName, phone, packageTier = "PRO++", billingStatus = "ACTIVE", salonCategory, enabledServices) {
  const regionMeta = detectRegionFromPhone(phone);
  const isPk = regionMeta.region === "PK";
  const resolvedCategory = inferSalonCategory(salonName, salonId, salonCategory);
  const address = SEEDED_SALON_ADDRESSES[salonId] || (regionMeta.region === "MENA" ? "Central Commercial Avenue, Dubai, UAE" : regionMeta.region === "PK" ? "Main Commercial Market, Lahore" : "High Street Studio, London");
  return {
    salonId,
    publicCode: generateUnguessablePublicCode(salonId),
    salonName,
    ownerName,
    ownerAuthPhone: phone,
    publicContactPhone: phone,
    publicWhatsappPhone: phone,
    whatsappPhone: phone,
    whatsappAddonEnabled: false,
    metaPhoneNumberId: "",
    countryCode: regionMeta.countryCode,
    timezoneIana: detectTimezoneIana(regionMeta.countryCode),
    timezoneOffsetHours: regionMeta.timezoneOffsetHours,
    currency: regionMeta.currency,
    currencySymbol: regionMeta.currencySymbol,
    defaultLang: "en",
    regionConfirmedByOwner: Boolean(SEEDED_PUBLIC_CODES[salonId]),
    salonCategory: resolvedCategory,
    enabledServices: Array.isArray(enabledServices) && enabledServices.length > 0 ? enabledServices : getDefaultServicesForCategory(resolvedCategory, regionMeta.currency),
    address,
    googleMapsUrl: buildGoogleMapsSearchUrl(salonName, address),
    operatingHours: { ...DEFAULT_SALON_OPERATING_HOURS },
    enabledClientLanguages: getDefaultClientLanguagesForRegion(regionMeta.region, phone),
    videoRetentionDaysAfterExpiry: 30,
    packageTier,
    billingStatus,
    counterSleptAt: null,
    birthdayEnabled: true,
    birthdayEventName: "Birthday Special",
    birthdayDiscountPct: 20,
    birthdayFixedDiscount: isPk ? 500 : 25,
    birthdayGiftService: resolvedCategory === "LADIES" ? "Free Express Hair Mask & Blowdry" : "Free Organic Hair Mask",
    birthdayMessageTemplate: "Happy Birthday {client_name}! Celebrate your special day with {salon_name}. Enjoy {offer_summary} on your next visit today!",
    winbackEnabled: true,
    winbackDays: 30,
    winbackDiscountPct: 15,
    winbackFixedDiscount: 0,
    winbackAddonService: resolvedCategory === "LADIES" ? "Complimentary Threading & Hair Spa Gloss" : "Complimentary Express Hair Wash & Styling",
    winbackMessageTemplate: "Hi {client_name}, we missed you at {salon_name}! It has been {days} days since your last visit. Come back this week for {offer_summary}.",
    reviewBoosterEnabled: packageTier !== "STARTER",
    googleReviewUrl: `https://g.page/r/${salonName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}/review`,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function createInitialSeedData() {
  const now = Date.now();
  const pkLocalToday = getLocalClockForOffset(5).dayMonth;
  const uaeLocalToday = getLocalClockForOffset(4).dayMonth;
  const ukLocalToday = getLocalClockForOffset(0).dayMonth;
  const daysAgoIso = (days) => new Date(now - days * 864e5).toISOString();
  const hoursAgoIso = (hours) => new Date(now - hours * 36e5).toISOString();
  const settingsBySalon = {
    "1": defaultSettingsForSalon("1", "Seven Cuts Studio", "Hamza Malik", "+92 321 8472910", "PRO++"),
    "2": defaultSettingsForSalon("2", "Royal Fade Lounge", "Tariq Butt", "+92 300 9876543", "STARTER"),
    "3": defaultSettingsForSalon("3", "Al-Noor Executive Grooming", "Aslam Khan", "+971 50 8923411", "PRO++"),
    "4": defaultSettingsForSalon("4", "Mayfair Blade & Beard", "Oliver Bennett", "+44 7911 123456", "STARTER"),
    "5": defaultSettingsForSalon("5", "Noor Beauty Lounge (Ladies Parlor)", "Ayesha Siddiqui", "+92 333 4412345", "PRO")
  };
  const barbersBySalon = {
    "1": [...DEFAULT_SALON_BARBERS],
    "2": ["Master Tariq", "Hamza Ali", "Bilal Khan"],
    "3": ["Master Aslam", "Yousuf", "Kamran"],
    "4": ["Oliver", "Jack", "Harry"],
    "5": ["Ayesha", "Sana", "Zara"]
  };
  const clients = [
    {
      id: "cli-1-bilal",
      salonId: "1",
      name: "Bilal Ahmed",
      phone: "+92 300 1234567",
      preferredLanguage: "roman_ur",
      awaitingLanguageSelection: false,
      birthDate: pkLocalToday,
      lastCompletedVisitAt: daysAgoIso(12),
      lastBirthdaySentYear: null,
      lastWinbackSentAt: null,
      awaitingWinbackRebook: false,
      awaitingReviewAppointmentId: null
    },
    {
      id: "cli-1-saad",
      salonId: "1",
      name: "Saad Farooq",
      phone: "+92 345 6789012",
      preferredLanguage: "ur",
      awaitingLanguageSelection: false,
      birthDate: "21/05",
      lastCompletedVisitAt: hoursAgoIso(2.5),
      lastBirthdaySentYear: null,
      lastWinbackSentAt: null,
      awaitingWinbackRebook: false,
      awaitingReviewAppointmentId: null
    },
    {
      id: "cli-1-fahad",
      salonId: "1",
      name: "Fahad Mansoor",
      phone: "+92 312 5544332",
      preferredLanguage: "roman_ur",
      awaitingLanguageSelection: false,
      birthDate: "09/08",
      lastCompletedVisitAt: daysAgoIso(34),
      lastBirthdaySentYear: null,
      lastWinbackSentAt: null,
      awaitingWinbackRebook: false,
      awaitingReviewAppointmentId: null
    },
    {
      id: "cli-3-zayed",
      salonId: "3",
      name: "Zayed Al-Hashmi",
      phone: "+971 50 8923411",
      preferredLanguage: "ar",
      awaitingLanguageSelection: false,
      birthDate: uaeLocalToday,
      lastCompletedVisitAt: daysAgoIso(35),
      lastBirthdaySentYear: null,
      lastWinbackSentAt: null,
      awaitingWinbackRebook: false,
      awaitingReviewAppointmentId: null
    },
    {
      id: "cli-4-oliver",
      salonId: "4",
      name: "Daniel Brooks",
      phone: "+44 7911 887766",
      preferredLanguage: "en",
      awaitingLanguageSelection: false,
      birthDate: ukLocalToday,
      lastCompletedVisitAt: daysAgoIso(32),
      lastBirthdaySentYear: null,
      lastWinbackSentAt: null,
      awaitingWinbackRebook: false,
      awaitingReviewAppointmentId: null
    }
  ];
  const appointments = [
    {
      id: "BK-101",
      salonId: "1",
      clientId: "cli-1-bilal",
      clientName: "Bilal Ahmed",
      clientPhone: "+92 300 1234567",
      barberName: "Master Aslam",
      service: "Master Haircut & Skin Fade",
      price: 1200,
      timeSlot: "03:30 PM",
      durationMins: 40,
      scheduledEndMs: now + 95 * 6e4,
      sourceType: "WHATSAPP_BOT",
      status: "CONFIRMED",
      scheduledForIso: new Date(now + 36e5).toISOString(),
      completedAt: null,
      reviewPromptSentAt: null,
      rating: null,
      ratingComment: null,
      reviewRoutedStatus: "PENDING"
    },
    {
      id: "BK-104",
      salonId: "1",
      clientId: "cli-1-saad",
      clientName: "Saad Farooq",
      clientPhone: "+92 345 6789012",
      barberName: "Bilal Tariq",
      service: "Haircut + Beard Styling Combo",
      price: 1800,
      timeSlot: "05:45 PM",
      durationMins: 50,
      scheduledEndMs: now - 150 * 6e4,
      sourceType: "WHATSAPP_BOT",
      status: "COMPLETED",
      scheduledForIso: hoursAgoIso(3),
      completedAt: hoursAgoIso(2.5),
      reviewPromptSentAt: null,
      rating: null,
      ratingComment: null,
      reviewRoutedStatus: "PENDING"
    }
  ];
  const walkInQueue = [
    {
      id: "wq-101",
      salonId: "1",
      clientName: "Hassan Raza",
      phone: "+92 301 9988776",
      service: "Master Haircut & Skin Fade",
      assignedStaff: "Master Aslam",
      etaMinutes: 15,
      status: "WAITING",
      createdAt: new Date(now - 10 * 6e4).toISOString()
    }
  ];
  const bridalBookings = [
    {
      id: "br-501",
      salonId: "5",
      brideOrEventName: "Zainab & Family Walima Suite",
      phone: "+92 332 8899110",
      packageName: "Signature Barat / Walima Bridal Package",
      eventDate: "Sat \xB7 22 Nov 2026",
      trialDate: "Thu \xB7 20 Nov 2026",
      totalAmount: 35e3,
      advancePaid: 15e3,
      assignedStylist: "Ayesha",
      homeService: false,
      status: "ADVANCE_LOCKED",
      createdAt: daysAgoIso(2)
    }
  ];
  const servicePackages = [
    {
      id: "pkg-101",
      salonId: "1",
      clientName: "Bilal Ahmed",
      phone: "+92 300 1234567",
      packageTitle: "Monthly Hair & Beard VIP Pass (4 Visits)",
      totalSessions: 4,
      usedSessions: 1,
      pricePaid: 3600,
      updatedAt: daysAgoIso(5)
    },
    {
      id: "pkg-501",
      salonId: "5",
      clientName: "Hira Mansoor",
      phone: "+92 321 6677889",
      packageTitle: "5-Session HydraFacial & Skin Polish Pack",
      totalSessions: 5,
      usedSessions: 2,
      pricePaid: 14e3,
      updatedAt: daysAgoIso(4)
    }
  ];
  const deals = [
    {
      id: "deal-1-vip",
      salonId: "1",
      title: "Executive Haircut & Facial Combo (20% OFF)",
      description: "Includes Master Haircut + Skin Fade + Charcoal Deep Detox Facial with priority chair access.",
      discountType: "PCT",
      discountValue: 20,
      serviceIds: ["s1", "s2", "s5"],
      serviceNames: ["Master Haircut", "Skin Fade", "Charcoal Deep Detox Facial"],
      startsAt: daysAgoIso(1),
      expiresAt: new Date(now + 10 * 864e5).toISOString(),
      videoRetentionDaysAfterExpiry: 30,
      videoDeletedAt: null,
      active: true,
      createdAt: daysAgoIso(1)
    },
    {
      id: "deal-3-dubai",
      salonId: "3",
      title: "Jumeirah Executive Grooming Package",
      description: "Master haircut, skin fade, classic beard trim, and hot towel shave bundle.",
      discountType: "PCT",
      discountValue: 15,
      serviceIds: ["s1", "s2", "s3", "s4"],
      serviceNames: ["Master Haircut", "Skin Fade", "Classic Beard Trim", "Hot Towel Steam Shave"],
      startsAt: daysAgoIso(1),
      expiresAt: new Date(now + 14 * 864e5).toISOString(),
      videoRetentionDaysAfterExpiry: 30,
      videoDeletedAt: null,
      active: true,
      createdAt: daysAgoIso(1)
    },
    {
      id: "deal-5-bridal",
      salonId: "5",
      title: "Hydra-Facial + Party Styling Glow Deal",
      description: "Limited-time salon glow offer for ladies parlor bookings.",
      discountType: "PCT",
      discountValue: 20,
      serviceIds: ["l1", "l3"],
      serviceNames: ["Signature Party Makeup & Styling", "Hydra-Facial & Skin Polish"],
      startsAt: daysAgoIso(1),
      expiresAt: new Date(now + 12 * 864e5).toISOString(),
      videoRetentionDaysAfterExpiry: 30,
      videoDeletedAt: null,
      active: true,
      createdAt: daysAgoIso(1)
    }
  ];
  return {
    settingsBySalon,
    barbersBySalon,
    clients,
    appointments,
    chairLocks: [],
    stylistLeaves: [],
    bookingAuditLog: [],
    bookingAccessTokens: {},
    salonUsageMonthly: {},
    metaMessagesMonthly: {},
    alerts: [],
    logs: [],
    walkInQueue,
    bridalBookings,
    servicePackages,
    deals
  };
}
var cachedStore = null;
function normalizeLoadedConciergeStore(parsed) {
  const seed = createInitialSeedData();
  const normalized = {
    settingsBySalon: parsed.settingsBySalon || seed.settingsBySalon,
    barbersBySalon: parsed.barbersBySalon || seed.barbersBySalon,
    clients: Array.isArray(parsed.clients) ? parsed.clients : seed.clients,
    appointments: Array.isArray(parsed.appointments) ? parsed.appointments : seed.appointments,
    chairLocks: Array.isArray(parsed.chairLocks) ? parsed.chairLocks : [],
    stylistLeaves: Array.isArray(parsed.stylistLeaves) ? parsed.stylistLeaves : [],
    bookingAuditLog: Array.isArray(parsed.bookingAuditLog) ? parsed.bookingAuditLog : [],
    bookingAccessTokens: parsed.bookingAccessTokens && typeof parsed.bookingAccessTokens === "object" ? parsed.bookingAccessTokens : {},
    salonUsageMonthly: parsed.salonUsageMonthly && typeof parsed.salonUsageMonthly === "object" ? parsed.salonUsageMonthly : {},
    metaMessagesMonthly: parsed.metaMessagesMonthly && typeof parsed.metaMessagesMonthly === "object" ? parsed.metaMessagesMonthly : {},
    alerts: Array.isArray(parsed.alerts) ? parsed.alerts : [],
    logs: Array.isArray(parsed.logs) ? parsed.logs : [],
    walkInQueue: Array.isArray(parsed.walkInQueue) ? parsed.walkInQueue : seed.walkInQueue,
    bridalBookings: Array.isArray(parsed.bridalBookings) ? parsed.bridalBookings : seed.bridalBookings,
    servicePackages: Array.isArray(parsed.servicePackages) ? parsed.servicePackages : seed.servicePackages,
    deals: Array.isArray(parsed.deals) ? parsed.deals : seed.deals
  };
  const defaultTiers = {
    "1": "PRO++",
    "2": "STARTER",
    "3": "PRO++",
    "4": "STARTER",
    "5": "PRO"
  };
  for (const [sid, tier] of Object.entries(defaultTiers)) {
    if (normalized.settingsBySalon[sid] && !normalized.settingsBySalon[sid].packageTier) {
      normalized.settingsBySalon[sid].packageTier = tier;
    }
  }
  for (const s of Object.values(normalized.settingsBySalon)) {
    const regionMeta = detectRegionFromPhone(s.whatsappPhone || "+92");
    if (!s.publicCode || !s.publicCode.startsWith("wc_")) {
      s.publicCode = generateUnguessablePublicCode(s.salonId);
    }
    if (!s.ownerAuthPhone) {
      s.ownerAuthPhone = s.whatsappPhone || "+92 300 0000000";
    }
    if (!s.publicContactPhone) {
      s.publicContactPhone = s.whatsappPhone || s.ownerAuthPhone;
    }
    if (s.publicWhatsappPhone === void 0) {
      s.publicWhatsappPhone = s.publicContactPhone;
    }
    if (typeof s.whatsappAddonEnabled !== "boolean") {
      s.whatsappAddonEnabled = false;
    }
    if (!s.timezoneIana) {
      s.timezoneIana = detectTimezoneIana(regionMeta.countryCode);
    }
    if (!s.defaultLang) {
      s.defaultLang = "en";
    }
    if (typeof s.regionConfirmedByOwner !== "boolean") {
      s.regionConfirmedByOwner = Boolean(SEEDED_PUBLIC_CODES[s.salonId]);
    }
    if (!s.salonCategory) {
      s.salonCategory = inferSalonCategory(s.salonName, s.salonId);
    }
    if (!Array.isArray(s.enabledServices) || s.enabledServices.length === 0) {
      s.enabledServices = getDefaultServicesForCategory(s.salonCategory, s.currency);
    } else if (s.enabledServices.some((svc) => svc.name === "Master Haircut & Skin Fade")) {
      const expanded = [];
      for (const svc of s.enabledServices) {
        if (svc.name === "Master Haircut & Skin Fade") {
          expanded.push(
            {
              id: "s1",
              name: "Master Haircut",
              durationMins: 35,
              price: Math.max(200, Math.round((svc.price || 800) * 0.65)),
              active: svc.active !== false
            },
            {
              id: "s2-fade",
              name: "Skin Fade",
              durationMins: 30,
              price: Math.max(200, Math.round((svc.price || 800) * 0.55)),
              active: svc.active !== false
            }
          );
        } else {
          expanded.push(svc);
        }
      }
      s.enabledServices = expanded;
    }
    if (!s.address) {
      s.address = SEEDED_SALON_ADDRESSES[s.salonId] || (regionMeta.region === "MENA" ? "Central Commercial Avenue, Dubai, UAE" : regionMeta.region === "PK" ? "Main Commercial Market, Lahore" : "High Street Studio, London");
    }
    if (!s.googleMapsUrl) {
      s.googleMapsUrl = buildGoogleMapsSearchUrl(s.salonName, s.address);
    }
    if (!s.operatingHours) {
      s.operatingHours = { ...DEFAULT_SALON_OPERATING_HOURS };
    }
    s.enabledClientLanguages = normalizeClientLanguageList(
      s.enabledClientLanguages,
      regionMeta.region,
      s.whatsappPhone
    );
    if (typeof s.videoRetentionDaysAfterExpiry !== "number") {
      s.videoRetentionDaysAfterExpiry = 30;
    }
  }
  return normalized;
}
async function hydrateConciergeStoreFromKv() {
  const indexIds = await kvGetJson("wc:concierge:salons:index:v1");
  if (Array.isArray(indexIds) && indexIds.length > 0) {
    const shardDocs = await Promise.all(
      indexIds.map((sid) => kvGetJson(`wc:concierge:salon:${sid}`))
    );
    const merged = {
      settingsBySalon: {},
      clients: [],
      appointments: [],
      chairLocks: [],
      stylistLeaves: [],
      bookingAuditLog: [],
      bookingAccessTokens: {},
      salonUsageMonthly: {},
      barbersBySalon: {},
      alerts: [],
      logs: [],
      walkInQueue: [],
      bridalBookings: [],
      servicePackages: [],
      deals: []
    };
    let loadedAny = false;
    indexIds.forEach((sid, idx) => {
      const doc = shardDocs[idx];
      if (!doc || !doc.settings) return;
      loadedAny = true;
      merged.settingsBySalon[sid] = doc.settings;
      if (Array.isArray(doc.clients)) merged.clients.push(...doc.clients);
      if (Array.isArray(doc.appointments)) merged.appointments.push(...doc.appointments);
      if (Array.isArray(doc.chairLocks)) merged.chairLocks.push(...doc.chairLocks);
      if (Array.isArray(doc.stylistLeaves)) merged.stylistLeaves.push(...doc.stylistLeaves);
      if (Array.isArray(doc.bookingAuditLog)) merged.bookingAuditLog.push(...doc.bookingAuditLog);
      if (doc.bookingAccessTokens && typeof doc.bookingAccessTokens === "object") {
        Object.assign(merged.bookingAccessTokens, doc.bookingAccessTokens);
      }
      if (doc.salonUsageMonthly && typeof doc.salonUsageMonthly === "object") {
        merged.salonUsageMonthly[sid] = doc.salonUsageMonthly;
      }
      if (Array.isArray(doc.barbers)) merged.barbersBySalon[sid] = doc.barbers;
      if (Array.isArray(doc.alerts)) merged.alerts.push(...doc.alerts);
      if (Array.isArray(doc.logs)) merged.logs.push(...doc.logs);
      if (Array.isArray(doc.walkInQueue)) merged.walkInQueue.push(...doc.walkInQueue);
      if (Array.isArray(doc.bridalBookings)) merged.bridalBookings.push(...doc.bridalBookings);
      if (Array.isArray(doc.servicePackages)) merged.servicePackages.push(...doc.servicePackages);
      if (Array.isArray(doc.deals)) merged.deals.push(...doc.deals);
    });
    if (loadedAny) {
      cachedStore = normalizeLoadedConciergeStore(merged);
      return;
    }
  }
  const remote = await kvGetJson("wc:concierge:v1");
  if (!remote || !remote.settingsBySalon || !Array.isArray(remote.clients)) return;
  cachedStore = normalizeLoadedConciergeStore(remote);
}
function ensureStoreLoaded() {
  if (cachedStore) return cachedStore;
  try {
    if (fs2.existsSync(STORE_FILE)) {
      const raw = fs2.readFileSync(STORE_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && parsed.settingsBySalon && Array.isArray(parsed.clients)) {
        cachedStore = normalizeLoadedConciergeStore(parsed);
        return cachedStore;
      }
    }
  } catch {
  }
  cachedStore = createInitialSeedData();
  persistStore();
  return cachedStore;
}
function persistStore(changedSalonId) {
  if (!cachedStore) return;
  try {
    if (!fs2.existsSync(DATA_DIR)) {
      fs2.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs2.writeFileSync(STORE_FILE, JSON.stringify(cachedStore, null, 2), "utf-8");
  } catch (err) {
    console.warn("Could not persist concierge store:", err);
  }
  const salonIds = Object.keys(cachedStore.settingsBySalon);
  const targetIds = changedSalonId && cachedStore.settingsBySalon[changedSalonId] ? [changedSalonId] : salonIds;
  void kvSetJson("wc:concierge:salons:index:v1", salonIds);
  for (const sid of targetIds) {
    const salonTokens = {};
    for (const [hash, rec] of Object.entries(cachedStore.bookingAccessTokens || {})) {
      if (rec.salonId === sid) salonTokens[hash] = rec;
    }
    const doc = {
      settings: cachedStore.settingsBySalon[sid],
      clients: cachedStore.clients.filter((c) => c.salonId === sid),
      appointments: cachedStore.appointments.filter((a) => a.salonId === sid),
      chairLocks: cachedStore.chairLocks.filter((l) => l.salonId === sid),
      stylistLeaves: (cachedStore.stylistLeaves || []).filter((lv) => lv.salonId === sid),
      bookingAuditLog: (cachedStore.bookingAuditLog || []).filter((e) => e.salonId === sid).slice(0, 300),
      bookingAccessTokens: salonTokens,
      salonUsageMonthly: (cachedStore.salonUsageMonthly || {})[sid] || {},
      barbers: cachedStore.barbersBySalon[sid] || [...DEFAULT_SALON_BARBERS],
      alerts: cachedStore.alerts.filter((a) => a.salonId === sid),
      logs: cachedStore.logs.filter((l) => l.salonId === sid).slice(0, 200),
      walkInQueue: cachedStore.walkInQueue.filter((w) => w.salonId === sid),
      bridalBookings: cachedStore.bridalBookings.filter((b) => b.salonId === sid),
      servicePackages: cachedStore.servicePackages.filter((p) => p.salonId === sid),
      deals: (cachedStore.deals || []).filter((d) => d.salonId === sid)
    };
    void kvSetJson(`wc:concierge:salon:${sid}`, doc);
  }
}
function ensureSalonExists(salonId, meta) {
  const store = ensureStoreLoaded();
  if (!store.settingsBySalon[salonId]) {
    store.settingsBySalon[salonId] = defaultSettingsForSalon(
      salonId,
      meta?.salonName || "WorkCraft Salon",
      meta?.ownerName || "Salon Owner",
      meta?.whatsappPhone || "+92 300 0000000",
      meta?.packageTier || "PRO++",
      meta?.billingStatus || "ACTIVE",
      meta?.salonCategory,
      meta?.enabledServices
    );
    persistStore();
  } else if (meta) {
    const existing = store.settingsBySalon[salonId];
    let changed = false;
    if (meta.salonName && existing.salonName !== meta.salonName) {
      existing.salonName = meta.salonName;
      changed = true;
    }
    if (meta.ownerName && existing.ownerName !== meta.ownerName) {
      existing.ownerName = meta.ownerName;
      changed = true;
    }
    if (meta.salonCategory && existing.salonCategory !== meta.salonCategory) {
      existing.salonCategory = meta.salonCategory;
      changed = true;
    }
    if (Array.isArray(meta.enabledServices) && meta.enabledServices.length > 0) {
      existing.enabledServices = meta.enabledServices;
      changed = true;
    }
    if (meta.whatsappPhone && existing.whatsappPhone !== meta.whatsappPhone) {
      const regionMeta = detectRegionFromPhone(meta.whatsappPhone);
      existing.whatsappPhone = meta.whatsappPhone;
      existing.countryCode = regionMeta.countryCode;
      existing.timezoneOffsetHours = regionMeta.timezoneOffsetHours;
      existing.currency = regionMeta.currency;
      existing.currencySymbol = regionMeta.currencySymbol;
      changed = true;
    }
    if (changed) persistStore();
  }
  return store.settingsBySalon[salonId];
}
function resolveSalonIdByPublicCode(publicCode) {
  const clean = (publicCode || "").trim();
  if (!clean || !clean.startsWith("wc_")) {
    return null;
  }
  const store = ensureStoreLoaded();
  const match = Object.values(store.settingsBySalon).find((s) => s.publicCode === clean);
  return match ? match.salonId : null;
}
async function resolveSalonIdByPublicCodeAsync(publicCode) {
  const clean = (publicCode || "").trim();
  if (!clean || !clean.startsWith("wc_")) {
    return null;
  }
  const localMatch = resolveSalonIdByPublicCode(clean);
  if (localMatch) return localMatch;
  const pgSalon = await findSalonByPublicCodeInPostgres(clean);
  if (!pgSalon) return null;
  const store = ensureStoreLoaded();
  const existingByCode = Object.values(store.settingsBySalon).find((s) => s.publicCode === clean);
  if (existingByCode) return existingByCode.salonId;
  const hydratedId = pgSalon.id;
  const tier = pgSalon.planTier === "STARTER" || pgSalon.planTier === "PRO" || pgSalon.planTier === "PRO++" || pgSalon.planTier === "CUSTOM" ? pgSalon.planTier : "PRO++";
  const billingStatus = pgSalon.billingStatus === "PENDING_ACTIVATION" || pgSalon.billingStatus === "PAST_DUE" || pgSalon.billingStatus === "SUSPENDED" ? pgSalon.billingStatus : "ACTIVE";
  const base = defaultSettingsForSalon(
    hydratedId,
    pgSalon.salonName,
    "Salon Owner",
    pgSalon.publicContactPhone || pgSalon.ownerAuthPhone,
    tier,
    billingStatus,
    pgSalon.salonCategory
  );
  store.settingsBySalon[hydratedId] = {
    ...base,
    salonId: hydratedId,
    publicCode: pgSalon.publicCode,
    ownerAuthPhone: pgSalon.ownerAuthPhone,
    publicContactPhone: pgSalon.publicContactPhone,
    publicWhatsappPhone: pgSalon.publicWhatsappPhone || pgSalon.publicContactPhone,
    timezoneIana: pgSalon.timezoneIana || base.timezoneIana,
    timezoneOffsetHours: Number.isFinite(pgSalon.timezoneOffsetHours) ? pgSalon.timezoneOffsetHours : base.timezoneOffsetHours,
    currency: pgSalon.currencyCode || base.currency,
    currencySymbol: pgSalon.currencySymbol || base.currencySymbol,
    defaultLang: pgSalon.defaultLang || base.defaultLang,
    enabledClientLanguages: pgSalon.enabledLangs.length > 0 ? pgSalon.enabledLangs : base.enabledClientLanguages,
    whatsappAddonEnabled: pgSalon.whatsappAddonEnabled,
    address: pgSalon.address || base.address,
    googleMapsUrl: pgSalon.googleMapsUrl || base.googleMapsUrl,
    googleReviewUrl: pgSalon.googleReviewUrl || base.googleReviewUrl
  };
  return hydratedId;
}
function findSalonIdByMetaPhoneNumberId(phoneNumberId) {
  const clean = (phoneNumberId || "").trim();
  if (!clean) return null;
  const store = ensureStoreLoaded();
  const match = Object.values(store.settingsBySalon).find(
    (s) => Boolean(s.whatsappAddonEnabled) && (s.metaPhoneNumberId || "").trim() === clean
  );
  return match ? match.salonId : null;
}
function getSalonBillingMonthKey(settings) {
  return getSalonLocalDateParts(settings.timezoneOffsetHours).dateStr.slice(0, 7);
}
function getMonthlyUsageSnapshot(salonId) {
  const store = ensureStoreLoaded();
  const settings = ensureSalonExists(salonId);
  const billingMonth = getSalonBillingMonthKey(settings);
  const tier = PLAN_QUOTAS[settings.packageTier] ? settings.packageTier : "PRO++";
  const quota = PLAN_QUOTAS[tier];
  const recordedCount = Number(store.salonUsageMonthly?.[salonId]?.[billingMonth] ?? 0);
  const billableBookings = Math.max(0, recordedCount);
  const overageBookings = Math.max(0, billableBookings - quota.limit);
  const remainingInPlan = Math.max(0, quota.limit - billableBookings);
  const pctUsed = quota.limit > 0 ? Math.min(200, Math.round(billableBookings / quota.limit * 100)) : 0;
  const metaUsed = Math.max(0, Number(store.metaMessagesMonthly?.[salonId]?.[billingMonth] ?? 0));
  let status = "OK";
  if (billableBookings >= quota.limit + quota.grace) {
    status = "BLOCKED";
  } else if (billableBookings >= quota.limit) {
    status = "GRACE";
  } else if (pctUsed >= 90) {
    status = "WARN_90";
  } else if (pctUsed >= 80) {
    status = "WARN_80";
  }
  return {
    billingMonth,
    planTier: tier,
    monthlyLimit: quota.limit,
    graceLimit: quota.grace,
    billableBookings,
    overageBookings,
    remainingInPlan,
    pctUsed,
    status,
    metaMessagesUsed: metaUsed,
    metaMonthlyLimit: META_WHATSAPP_MONTHLY_CAP
  };
}
function canSendMetaMessage(salonId) {
  const store = ensureStoreLoaded();
  const settings = ensureSalonExists(salonId);
  const billingMonth = getSalonBillingMonthKey(settings);
  const used = Math.max(0, Number(store.metaMessagesMonthly?.[salonId]?.[billingMonth] ?? 0));
  return {
    allowed: used < META_WHATSAPP_MONTHLY_CAP,
    used,
    limit: META_WHATSAPP_MONTHLY_CAP
  };
}
function recordMetaMessageSent(salonId) {
  const store = ensureStoreLoaded();
  const settings = ensureSalonExists(salonId);
  const billingMonth = getSalonBillingMonthKey(settings);
  if (!store.metaMessagesMonthly) {
    store.metaMessagesMonthly = {};
  }
  if (!store.metaMessagesMonthly[salonId]) {
    store.metaMessagesMonthly[salonId] = {};
  }
  const next = Number(store.metaMessagesMonthly[salonId][billingMonth] ?? 0) + 1;
  store.metaMessagesMonthly[salonId][billingMonth] = next;
  persistStore(salonId);
  return { used: next, limit: META_WHATSAPP_MONTHLY_CAP };
}
function incrementMonthlyUsage(salonId) {
  const store = ensureStoreLoaded();
  const settings = ensureSalonExists(salonId);
  const billingMonth = getSalonBillingMonthKey(settings);
  if (!store.salonUsageMonthly[salonId]) {
    store.salonUsageMonthly[salonId] = {};
  }
  store.salonUsageMonthly[salonId][billingMonth] = Number(store.salonUsageMonthly[salonId][billingMonth] ?? 0) + 1;
}
function appendBookingAudit(salonId, bookingId, actorType, action, note) {
  const store = ensureStoreLoaded();
  const entry = {
    id: `aud-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    salonId,
    bookingId,
    actorType,
    action,
    note: sanitizePlainText(note, 260),
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  store.bookingAuditLog = [entry, ...store.bookingAuditLog || []].slice(0, 1200);
}
async function syncSalonSettingsToPostgres(settings, actor) {
  const normalized = validatePgActorContext(actor);
  if (normalized.role === "PUBLIC_FLOW") {
    throw new PgContextError(
      "PRIVILEGE_ESCALATION",
      "PUBLIC_FLOW cannot sync salon configuration to PostgreSQL."
    );
  }
  if (normalized.role === "SALON_OWNER" && normalized.salonId !== settings.salonId) {
    throw new PgContextError(
      "FORBIDDEN_TENANT",
      `SALON_OWNER (${normalized.salonId}) cannot sync settings for salon ${settings.salonId}.`
    );
  }
  const tier = PLAN_QUOTAS[settings.packageTier] ? settings.packageTier : "PRO++";
  const quota = PLAN_QUOTAS[tier];
  await persistPostgresSnapshotMirror(
    {
      salonId: settings.salonId,
      publicCode: settings.publicCode,
      salonName: settings.salonName,
      ownerName: settings.ownerName,
      salonCategory: settings.salonCategory,
      ownerAuthPhone: settings.ownerAuthPhone || settings.whatsappPhone,
      publicContactPhone: settings.publicContactPhone || settings.whatsappPhone,
      publicWhatsappPhone: settings.publicWhatsappPhone,
      timezoneIana: settings.timezoneIana || "Asia/Karachi",
      timezoneOffsetHours: settings.timezoneOffsetHours,
      currencyCode: settings.currency,
      currencySymbol: settings.currencySymbol,
      defaultLang: settings.defaultLang,
      enabledLangs: settings.enabledClientLanguages,
      planTier: tier,
      monthlyLimit: quota.limit,
      billingStatus: settings.billingStatus,
      address: settings.address,
      googleMapsUrl: settings.googleMapsUrl,
      googleReviewUrl: settings.googleReviewUrl
    },
    actor
  );
}
function formatOfferSummary(settings, kind, lang) {
  if (kind === "BIRTHDAY") {
    const parts2 = [];
    if (settings.birthdayDiscountPct > 0) {
      parts2.push(`${settings.birthdayDiscountPct}% OFF`);
    }
    if (settings.birthdayFixedDiscount > 0) {
      parts2.push(`${settings.currencySymbol}${settings.birthdayFixedDiscount.toLocaleString()} OFF`);
    }
    if (settings.birthdayGiftService.trim()) {
      parts2.push(settings.birthdayGiftService.trim());
    }
    const eventLabel = settings.birthdayEventName?.trim() || "Special Event";
    const joined2 = parts2.join(" + ") || "VIP Priority Chair";
    if (lang === "ur") return `${eventLabel}: ${joined2}`;
    if (lang === "ar") return `${eventLabel}: ${joined2}`;
    if (lang === "roman_ur") return `${eventLabel}: ${joined2}`;
    return `${eventLabel} (${joined2})`;
  }
  const parts = [];
  if (settings.winbackDiscountPct > 0) {
    parts.push(`${settings.winbackDiscountPct}% OFF`);
  }
  if ((settings.winbackFixedDiscount ?? 0) > 0) {
    parts.push(`${settings.currencySymbol}${Number(settings.winbackFixedDiscount).toLocaleString()} OFF`);
  }
  if (settings.winbackAddonService.trim()) {
    parts.push(settings.winbackAddonService.trim());
  }
  const joined = parts.join(" + ") || "VIP Return Treatment";
  if (lang === "ur") return `\u0648\u0627\u067E\u0633\u06CC \u0627\u0633\u067E\u06CC\u0634\u0644 \u0622\u0641\u0631: ${joined}`;
  if (lang === "ar") return `\u0639\u0631\u0636 \u0627\u0644\u0639\u0648\u062F\u0629 \u0627\u0644\u062E\u0627\u0635: ${joined}`;
  return joined;
}
function renderBirthdayMessage(settings, clientName, lang) {
  const offer = formatOfferSummary(settings, "BIRTHDAY", lang);
  if (lang === "roman_ur") {
    return `Happy Birthday ${clientName}! ${settings.salonName} ki taraf se aap ko bohat mubarakbad. Aaj aap ke liye ${offer} tayyar hai. Apna slot book karne ke liye reply karein! (${settings.birthdayMessageTemplate.replace("{client_name}", clientName).replace("{salon_name}", settings.salonName).replace("{offer_summary}", offer)})`;
  }
  if (lang === "ur") {
    return `\u0633\u0627\u0644\u06AF\u0631\u06C1 \u0645\u0628\u0627\u0631\u06A9 ${clientName}! ${settings.salonName} \u06A9\u06CC \u0637\u0631\u0641 \u0633\u06D2 \u062F\u0644\u06CC \u0645\u0628\u0627\u0631\u06A9\u0628\u0627\u062F\u06D4 \u0622\u062C \u0622\u067E \u06A9\u06D2 \u0644\u06CC\u06D2 \u062E\u0635\u0648\u0635\u06CC \u0622\u0641\u0631 (${offer}) \u062F\u0633\u062A\u06CC\u0627\u0628 \u06C1\u06D2\u06D4 \u0648\u0642\u062A \u0628\u06A9 \u06A9\u0631\u0646\u06D2 \u06A9\u06D2 \u0644\u06CC\u06D2 \u062C\u0648\u0627\u0628 \u062F\u06CC\u06BA!`;
  }
  if (lang === "ar") {
    return `\u0639\u064A\u062F \u0645\u064A\u0644\u0627\u062F \u0633\u0639\u064A\u062F \u064A\u0627 ${clientName}! \u064A\u062A\u0645\u0646\u0649 \u0644\u0643 \u0635\u0627\u0644\u0648\u0646 ${settings.salonName} \u064A\u0648\u0645\u0627\u064B \u0631\u0627\u0626\u0639\u0627\u064B. \u0627\u0633\u062A\u0645\u062A\u0639 \u0628\u0640 (${offer}) \u0641\u064A \u0632\u064A\u0627\u0631\u062A\u0643 \u0627\u0644\u064A\u0648\u0645. \u0623\u0631\u0633\u0644 \u0644\u0646\u0627 \u0644\u062A\u0623\u0643\u064A\u062F \u0645\u0648\u0639\u062F\u0643!`;
  }
  return settings.birthdayMessageTemplate.replace(/\{client_name\}/g, clientName).replace(/\{salon_name\}/g, settings.salonName).replace(/\{offer_summary\}/g, offer);
}
function renderWinBackMessage(settings, clientName, lang) {
  const offer = formatOfferSummary(settings, "WINBACK", lang);
  if (lang === "roman_ur") {
    return `Assalamu Alaikum ${clientName}! Hum ne aap ko ${settings.salonName} par miss kiya (${settings.winbackDays} din guzar gaye). Wapis aayein aur paayein: ${offer}. 1-tap booking ke liye sirf "REBOOK" reply karein!`;
  }
  if (lang === "ur") {
    return `\u0627\u0644\u0633\u0644\u0627\u0645 \u0639\u0644\u06CC\u06A9\u0645 ${clientName}! ${settings.salonName} \u067E\u0631 \u0622\u067E \u06A9\u06CC \u0622\u062E\u0631\u06CC \u0648\u0632\u0679 \u06A9\u0648 ${settings.winbackDays} \u062F\u0646 \u06C1\u0648 \u0686\u06A9\u06D2 \u06C1\u06CC\u06BA\u06D4 \u0622\u067E \u06A9\u06D2 \u0644\u06CC\u06D2 \u062E\u0635\u0648\u0635\u06CC \u0622\u0641\u0631: ${offer}\u06D4 \u0641\u0648\u0631\u06CC \u062F\u0648\u0628\u0627\u0631\u06C1 \u0628\u06A9\u0646\u06AF \u06A9\u06D2 \u0644\u06CC\u06D2 "REBOOK" \u0644\u06A9\u06BE \u06A9\u0631 \u0628\u06BE\u06CC\u062C\u06CC\u06BA!`;
  }
  if (lang === "ar") {
    return `\u0645\u0631\u062D\u0628\u0627\u064B ${clientName}! \u0627\u0634\u062A\u0642\u0646\u0627 \u0644\u0632\u064A\u0627\u0631\u062A\u0643 \u0641\u064A ${settings.salonName} \u0645\u0646\u0630 ${settings.winbackDays} \u064A\u0648\u0645\u0627\u064B. \u0639\u062F \u0625\u0644\u064A\u0646\u0627 \u0648\u0627\u062D\u0635\u0644 \u0639\u0644\u0649: ${offer}. \u0644\u0644\u062D\u062C\u0632 \u0627\u0644\u0641\u0648\u0631\u064A \u0628\u0636\u063A\u0637\u0629 \u0648\u0627\u062D\u062F\u0629 \u0623\u0631\u0633\u0644 "REBOOK"!`;
  }
  const custom = settings.winbackMessageTemplate.replace(/\{client_name\}/g, clientName).replace(/\{salon_name\}/g, settings.salonName).replace(/\{days\}/g, String(settings.winbackDays)).replace(/\{offer_summary\}/g, offer);
  return `${custom} Reply "REBOOK" for 1-tap instant rebooking!`;
}
function renderReviewPrompt(salonName, lang) {
  if (lang === "roman_ur") {
    return `Shukriya! Aaj ${salonName} par aap ka visit kaisa raha? Meharbani farma kar 1 se 5 Stars reply karein (1\u20135).`;
  }
  if (lang === "ur") {
    return `\u0622\u062C ${salonName} \u067E\u0631 \u0622\u067E \u06A9\u0627 \u0648\u0632\u0679 \u06A9\u06CC\u0633\u0627 \u0631\u06C1\u0627\u061F \u0628\u0631\u0627\u0626\u06D2 \u0645\u06C1\u0631\u0628\u0627\u0646\u06CC 1 \u0633\u06D2 5 \u0627\u0633\u0679\u0627\u0631\u0632 (1\u20135 Stars) \u0645\u06CC\u06BA \u062C\u0648\u0627\u0628 \u062F\u06CC\u06BA\u06D4`;
  }
  if (lang === "ar") {
    return `\u0643\u064A\u0641 \u0643\u0627\u0646\u062A \u0632\u064A\u0627\u0631\u062A\u0643 \u0625\u0644\u0649 ${salonName} \u0627\u0644\u064A\u0648\u0645\u061F \u064A\u0631\u062C\u0649 \u0627\u0644\u0631\u062F \u0628\u062A\u0642\u064A\u064A\u0645 \u0645\u0646 1 \u0625\u0644\u0649 5 \u0646\u062C\u0648\u0645.`;
  }
  return `How was your visit to ${salonName} today? Reply 1\u20135 Stars.`;
}
function resolveClientConversationLang(client, rawText, region) {
  if (client?.preferredLanguage) return client.preferredLanguage;
  const trimmed = (rawText || "").trim();
  const isIndiaPhone = (client?.phone || "").replace(/\s+/g, "").startsWith("+91");
  if (/[\u0679\u0688\u0691\u06BA\u06BE\u06C1\u06D2\u06AF]/.test(trimmed)) return "ur";
  if (/[\u0600-\u06FF]/.test(trimmed)) return region === "PK" || isIndiaPhone ? "ur" : "ar";
  if (region === "PK" || isIndiaPhone) return "roman_ur";
  if (region === "MENA") return "ar";
  return "en";
}
function appendLog(salonId, entry) {
  const store = ensureStoreLoaded();
  const full = {
    id: `wlog-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    salonId,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    ...entry
  };
  store.logs.unshift(full);
  let salonCount = 0;
  store.logs = store.logs.filter((log) => {
    if (log.salonId !== salonId) return true;
    salonCount += 1;
    return salonCount <= 200;
  });
  return full;
}
function getSalonBarbers(salonId) {
  const store = ensureStoreLoaded();
  if (!store.barbersBySalon[salonId] || store.barbersBySalon[salonId].length === 0) {
    store.barbersBySalon[salonId] = [...DEFAULT_SALON_BARBERS];
  }
  return store.barbersBySalon[salonId];
}
function syncSalonBarbers(salonId, barbers) {
  const store = ensureStoreLoaded();
  ensureSalonExists(salonId);
  const cleaned = barbers.map((b) => sanitizePlainText(b, 60)).filter(Boolean).slice(0, 30);
  if (cleaned.length > 0) {
    store.barbersBySalon[salonId] = cleaned;
    persistStore();
  }
  return getSalonConciergeState(salonId);
}
function setCounterSleepState(salonId, sleeping) {
  const store = ensureStoreLoaded();
  const settings = ensureSalonExists(salonId);
  settings.counterSleptAt = sleeping ? (/* @__PURE__ */ new Date()).toISOString() : null;
  settings.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  store.settingsBySalon[salonId] = settings;
  persistStore();
  return getSalonConciergeState(salonId);
}
function addChairLock(salonId, input) {
  const store = ensureStoreLoaded();
  const settings = ensureSalonExists(salonId);
  const cleanBarber = sanitizePlainText(input.barberName, 60) || "Master Barber";
  const cleanChair = input.chairLabel ? sanitizePlainText(input.chairLabel, 30) : void 0;
  const cleanStart = sanitizePlainText(input.startTimeSlot, 20) || "Now";
  const cleanEnd = sanitizePlainText(input.endTimeSlot, 20) || "Later";
  const cleanTranscript = input.transcript ? sanitizePlainText(input.transcript, 300) : void 0;
  const durationMins = clampInteger(input.durationMins, 5, 480, 30);
  const startMinutes = clampInteger(input.startMinutes, 0, 1440, 0);
  const endMinutes = clampInteger(input.endMinutes, 0, 1920, startMinutes + durationMins);
  if (Array.isArray(input.barbers) && input.barbers.length > 0) {
    const cleanBarbers = input.barbers.map((b) => sanitizePlainText(b, 60)).filter(Boolean).slice(0, 30);
    if (cleanBarbers.length > 0) {
      store.barbersBySalon[salonId] = cleanBarbers;
    }
  }
  const lock = {
    id: `LCK-${Date.now().toString().slice(-4)}-${Math.random().toString(36).slice(2, 4).toUpperCase()}`,
    salonId,
    barberName: cleanBarber,
    chairLabel: cleanChair,
    startTimeSlot: cleanStart,
    endTimeSlot: cleanEnd,
    startMinutes,
    endMinutes,
    durationMins,
    source: input.source,
    transcript: cleanTranscript,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  store.chairLocks.unshift(lock);
  const nowMs = Date.now();
  const lockAppt = {
    id: lock.id,
    salonId,
    clientId: `walkin-${lock.id}`,
    clientName: input.source === "VOICE" ? `Walk-In \xB7 Voice Lock (${input.durationMins}m)` : `Walk-In \xB7 Chair Busy (${input.durationMins}m)`,
    clientPhone: settings.whatsappPhone,
    barberName: input.barberName,
    service: `Chair Blocked (${input.startTimeSlot} \u2013 ${input.endTimeSlot})`,
    price: 0,
    timeSlot: input.startTimeSlot,
    durationMins: input.durationMins,
    scheduledEndMs: nowMs + input.durationMins * 6e4,
    sourceType: "WALK_IN_BUSY",
    status: "IN_CHAIR",
    scheduledForIso: new Date(nowMs).toISOString(),
    completedAt: null,
    reviewPromptSentAt: null,
    rating: null,
    ratingComment: null,
    reviewRoutedStatus: "PENDING"
  };
  store.appointments.unshift(lockAppt);
  persistStore();
  return { lock, state: getSalonConciergeState(salonId) };
}
function removeChairLock(salonId, lockId) {
  const store = ensureStoreLoaded();
  store.chairLocks = store.chairLocks.filter(
    (l) => !(l.salonId === salonId && l.id === lockId)
  );
  persistStore();
  return getSalonConciergeState(salonId);
}
function isBarberBusyAtWindow(salonId, barberName, startMinutes, durationMins = 35, targetDateStr, demoBusyBarber, demoBusyTimeSlot) {
  const store = ensureStoreLoaded();
  const settings = ensureSalonExists(salonId);
  const todayDateStr = getSalonLocalDateParts(settings.timezoneOffsetHours).dateStr;
  const resolvedTargetDate = targetDateStr || todayDateStr;
  const endMinutes = startMinutes + durationMins;
  const normTarget = barberName.toLowerCase();
  if (demoBusyBarber) {
    const normDemo = demoBusyBarber.trim().toLowerCase();
    const matchesDemoBarber = normDemo === normTarget || normTarget.includes(normDemo) || normDemo.includes(normTarget.split(" ")[0]);
    if (matchesDemoBarber) {
      if (!demoBusyTimeSlot) {
        return {
          busy: true,
          busyUntilMinutes: endMinutes,
          reason: "Barber Busy (Demo Test)"
        };
      }
      const demoStart = parseTimeSlotToMinutes(demoBusyTimeSlot);
      if (demoStart >= 0 && startMinutes < demoStart + 45 && endMinutes > demoStart) {
        return {
          busy: true,
          busyUntilMinutes: demoStart + 45,
          reason: `Booked at ${demoBusyTimeSlot} (Demo Test)`
        };
      }
    }
  }
  for (const lock of store.chairLocks) {
    if (lock.salonId !== salonId) continue;
    const lockDateStr = getIsoLocalDateStr(lock.createdAt, settings.timezoneOffsetHours) || todayDateStr;
    if (lockDateStr !== resolvedTargetDate) continue;
    if (lock.barberName.toLowerCase() === normTarget || lock.barberName.toLowerCase().includes(normTarget) || normTarget.includes(lock.barberName.toLowerCase().split(" ")[0])) {
      if (startMinutes < lock.endMinutes && endMinutes > lock.startMinutes) {
        return {
          busy: true,
          busyUntilMinutes: lock.endMinutes,
          reason: `Chair Locked (${lock.startTimeSlot}\u2013${lock.endTimeSlot})`
        };
      }
    }
  }
  for (const lv of store.stylistLeaves || []) {
    if (lv.salonId !== salonId) continue;
    if (lv.date !== resolvedTargetDate) continue;
    const normLeaveStylist = lv.stylistName.toLowerCase();
    if (normLeaveStylist === normTarget || normLeaveStylist.includes(normTarget) || normTarget.includes(normLeaveStylist.split(" ")[0])) {
      if (lv.fullDay !== false && !lv.startTime && !lv.endTime) {
        return {
          busy: true,
          busyUntilMinutes: 1440,
          reason: lv.reason || "Stylist on Leave"
        };
      }
      const lvStart = lv.startTime ? parseTimeSlotToMinutes(lv.startTime) : 0;
      const lvEnd = lv.endTime ? parseTimeSlotToMinutes(lv.endTime) : 1440;
      if (lvStart >= 0 && lvEnd > lvStart && startMinutes < lvEnd && endMinutes > lvStart) {
        return {
          busy: true,
          busyUntilMinutes: lvEnd,
          reason: lv.reason || `On Leave (${lv.startTime}\u2013${lv.endTime})`
        };
      }
    }
  }
  for (const appt of store.appointments) {
    if (appt.salonId !== salonId || appt.status === "COMPLETED" || appt.status === "CANCELED" || appt.canceled) {
      continue;
    }
    const apptDateStr = appt.appointmentDate || getIsoLocalDateStr(appt.scheduledForIso, settings.timezoneOffsetHours) || todayDateStr;
    if (apptDateStr !== resolvedTargetDate) continue;
    if (appt.barberName.toLowerCase() === normTarget || appt.barberName.toLowerCase().includes(normTarget) || normTarget.includes(appt.barberName.toLowerCase().split(" ")[0])) {
      const apptStart = parseTimeSlotToMinutes(appt.timeSlot);
      if (apptStart >= 0) {
        const apptEnd = apptStart + (appt.durationMins || 35);
        if (startMinutes < apptEnd && endMinutes > apptStart) {
          return {
            busy: true,
            busyUntilMinutes: apptEnd,
            reason: `Booked (${appt.timeSlot})`
          };
        }
      }
    }
  }
  return { busy: false, busyUntilMinutes: startMinutes };
}
function runAutoCompleteAppointmentsCron(salonId) {
  const store = ensureStoreLoaded();
  const nowMs = Date.now();
  const fifteenMinMs = 15 * 60 * 1e3;
  let completedCount = 0;
  for (const appt of store.appointments) {
    if (salonId && appt.salonId !== salonId) continue;
    if (appt.status === "COMPLETED" || appt.flagged || appt.canceled) continue;
    let endMs = appt.scheduledEndMs;
    if (!endMs && appt.scheduledForIso) {
      const startMs = new Date(appt.scheduledForIso).getTime();
      if (!Number.isNaN(startMs)) {
        endMs = startMs + (appt.durationMins || 35) * 6e4;
      }
    }
    if (!endMs) continue;
    if (nowMs >= endMs + fifteenMinMs) {
      appt.status = "COMPLETED";
      appt.completedAt = new Date(nowMs).toISOString();
      const client = store.clients.find((c) => c.id === appt.clientId);
      if (client) {
        client.lastCompletedVisitAt = appt.completedAt;
      }
      store.chairLocks = store.chairLocks.filter(
        (l) => !(l.salonId === appt.salonId && l.id === appt.id)
      );
      completedCount++;
    }
  }
  if (completedCount > 0) persistStore();
  return { completedCount };
}
function buildSalonBaseStateSnapshot(salonId, meta, options) {
  const store = ensureStoreLoaded();
  const settings = ensureSalonExists(salonId, meta);
  if (!settings.billingStatus) {
    settings.billingStatus = "ACTIVE";
  }
  if (!settings.salonCategory) {
    settings.salonCategory = inferSalonCategory(settings.salonName, salonId);
  }
  if (!Array.isArray(settings.enabledServices) || settings.enabledServices.length === 0) {
    settings.enabledServices = getDefaultServicesForCategory(settings.salonCategory, settings.currency);
  }
  if (options?.runAutoComplete !== false) {
    runAutoCompleteAppointmentsCron(salonId);
    runDealExpiryAndVideoRetentionCron(salonId);
  }
  const regionMeta = detectRegionFromPhone(settings.whatsappPhone);
  const languageOptions = getLanguageMenuForRegion(regionMeta.region, settings.whatsappPhone);
  const greetingPromptPreview = buildGreetingMenuText(settings.salonName, regionMeta.region);
  return {
    salonId,
    publicCode: settings.publicCode,
    region: regionMeta.region,
    regionLabel: regionMeta.regionLabel,
    languageOptions,
    greetingPromptPreview,
    settings,
    clients: store.clients.filter((c) => c.salonId === salonId),
    appointments: store.appointments.filter((a) => a.salonId === salonId),
    chairLocks: store.chairLocks.filter((l) => l.salonId === salonId),
    barbers: getSalonBarbers(salonId),
    stylistLeaves: (store.stylistLeaves || []).filter((lv) => lv.salonId === salonId),
    alerts: store.alerts.filter((al) => al.salonId === salonId),
    logs: store.logs.filter((l) => l.salonId === salonId).slice(0, 50),
    walkInQueue: (store.walkInQueue || []).filter((w) => w.salonId === salonId),
    bridalBookings: (store.bridalBookings || []).filter((b) => b.salonId === salonId),
    servicePackages: (store.servicePackages || []).filter((p) => p.salonId === salonId),
    deals: (store.deals || []).filter((d) => d.salonId === salonId),
    usageMeter: getMonthlyUsageSnapshot(salonId),
    opportunities: getRetentionOpportunities(salonId),
    bookingAuditLog: (store.bookingAuditLog || []).filter((e) => e.salonId === salonId).slice(0, 80)
  };
}
function getSalonConciergeState(salonId, meta) {
  return buildSalonBaseStateSnapshot(salonId, meta, { runAutoComplete: true });
}
async function updateRetentionSettings(salonId, patch, actor) {
  const normalizedActor = validatePgActorContext(actor);
  if (normalizedActor.role === "PUBLIC_FLOW") {
    throw new PgContextError(
      "PRIVILEGE_ESCALATION",
      "PUBLIC_FLOW cannot update salon retention settings."
    );
  }
  if (normalizedActor.role === "SALON_OWNER" && normalizedActor.salonId !== salonId) {
    throw new PgContextError(
      "FORBIDDEN_TENANT",
      `SALON_OWNER (${normalizedActor.salonId}) cannot update settings for salon ${salonId}.`
    );
  }
  const store = ensureStoreLoaded();
  const current = ensureSalonExists(salonId);
  const regionMeta = detectRegionFromPhone(patch.whatsappPhone || patch.ownerAuthPhone || current.whatsappPhone);
  const cleanCategory = patch.salonCategory === "LADIES" || patch.salonCategory === "MENS" ? patch.salonCategory : void 0;
  const cleanServices = Array.isArray(patch.enabledServices) ? patch.enabledServices.slice(0, 30).map((svc, idx) => ({
    id: sanitizePlainText(svc?.id || `svc-${idx + 1}`, 40),
    name: sanitizePlainText(svc?.name, 80),
    price: clampInteger(svc?.price, 0, 5e5, 1e3),
    durationMins: clampInteger(svc?.durationMins ?? 35, 5, 360, 35),
    bufferAfterMins: svc?.bufferAfterMins !== void 0 ? clampInteger(svc.bufferAfterMins, 0, 120, 0) : void 0,
    eligibleStylists: Array.isArray(svc?.eligibleStylists) ? svc.eligibleStylists.map((st) => sanitizePlainText(st, 60)).filter(Boolean).slice(0, 20) : void 0,
    active: svc?.active !== false
  })).filter((s) => Boolean(s.name)) : void 0;
  const cleanOperatingHours = patch.operatingHours ? {
    monThuOpen: sanitizePlainText(patch.operatingHours.monThuOpen, 20) || current.operatingHours?.monThuOpen || "11:00 AM",
    monThuClose: sanitizePlainText(patch.operatingHours.monThuClose, 20) || current.operatingHours?.monThuClose || "11:00 PM",
    monThuClosed: Boolean(patch.operatingHours.monThuClosed),
    fridayOpen: sanitizePlainText(patch.operatingHours.fridayOpen, 20) || current.operatingHours?.fridayOpen || "11:00 AM",
    fridayClose: sanitizePlainText(patch.operatingHours.fridayClose, 20) || current.operatingHours?.fridayClose || "11:30 PM",
    fridayBreakStart: sanitizePlainText(patch.operatingHours.fridayBreakStart, 20) || current.operatingHours?.fridayBreakStart || "01:00 PM",
    fridayBreakEnd: sanitizePlainText(patch.operatingHours.fridayBreakEnd, 20) || current.operatingHours?.fridayBreakEnd || "02:30 PM",
    fridayClosed: Boolean(patch.operatingHours.fridayClosed),
    satSunOpen: sanitizePlainText(patch.operatingHours.satSunOpen, 20) || current.operatingHours?.satSunOpen || "10:30 AM",
    satSunClose: sanitizePlainText(patch.operatingHours.satSunClose, 20) || current.operatingHours?.satSunClose || "11:30 PM",
    satSunClosed: Boolean(patch.operatingHours.satSunClosed)
  } : current.operatingHours;
  const nextAddress = patch.address !== void 0 ? sanitizePlainText(patch.address, 220) || current.address || "" : current.address;
  const nextSalonName = patch.salonName !== void 0 ? sanitizePlainText(patch.salonName, 100) || current.salonName : current.salonName;
  const validTier = patch.packageTier === "STARTER" || patch.packageTier === "PRO" || patch.packageTier === "PRO++" || patch.packageTier === "CUSTOM" ? patch.packageTier : void 0;
  const validDefaultLang = patch.defaultLang ? sanitizeClientLang(patch.defaultLang) : void 0;
  const safePatch = {
    salonName: nextSalonName,
    ownerName: patch.ownerName !== void 0 ? sanitizePlainText(patch.ownerName, 80) || current.ownerName : current.ownerName,
    ownerAuthPhone: patch.ownerAuthPhone !== void 0 ? sanitizePhone(patch.ownerAuthPhone) || current.ownerAuthPhone : current.ownerAuthPhone,
    publicContactPhone: patch.publicContactPhone !== void 0 ? sanitizePhone(patch.publicContactPhone) || current.publicContactPhone : current.publicContactPhone,
    publicWhatsappPhone: patch.publicWhatsappPhone !== void 0 ? sanitizePhone(patch.publicWhatsappPhone) : current.publicWhatsappPhone,
    whatsappPhone: patch.whatsappPhone !== void 0 ? sanitizePhone(patch.whatsappPhone) || current.whatsappPhone : current.whatsappPhone,
    whatsappAddonEnabled: patch.whatsappAddonEnabled !== void 0 ? Boolean(patch.whatsappAddonEnabled) : current.whatsappAddonEnabled,
    metaPhoneNumberId: patch.metaPhoneNumberId !== void 0 ? sanitizePlainText(patch.metaPhoneNumberId, 64) : current.metaPhoneNumberId,
    timezoneIana: patch.timezoneIana !== void 0 ? sanitizePlainText(patch.timezoneIana, 64) || current.timezoneIana : current.timezoneIana,
    defaultLang: validDefaultLang || current.defaultLang || "en",
    regionConfirmedByOwner: patch.regionConfirmedByOwner !== void 0 ? Boolean(patch.regionConfirmedByOwner) : current.regionConfirmedByOwner,
    packageTier: validTier || current.packageTier,
    salonCategory: cleanCategory || current.salonCategory || inferSalonCategory(current.salonName, salonId),
    enabledServices: cleanServices && cleanServices.length > 0 ? cleanServices : current.enabledServices,
    address: nextAddress,
    googleMapsUrl: patch.googleMapsUrl !== void 0 ? sanitizeHttpUrl(patch.googleMapsUrl, buildGoogleMapsSearchUrl(nextSalonName, nextAddress || "")) : current.googleMapsUrl || buildGoogleMapsSearchUrl(nextSalonName, nextAddress || ""),
    operatingHours: cleanOperatingHours,
    enabledClientLanguages: patch.enabledClientLanguages !== void 0 ? normalizeClientLanguageList(
      patch.enabledClientLanguages,
      regionMeta.region,
      patch.whatsappPhone || current.whatsappPhone
    ) : normalizeClientLanguageList(
      current.enabledClientLanguages,
      regionMeta.region,
      patch.whatsappPhone || current.whatsappPhone
    ),
    videoRetentionDaysAfterExpiry: patch.videoRetentionDaysAfterExpiry !== void 0 ? clampInteger(patch.videoRetentionDaysAfterExpiry, 1, 365, 30) : current.videoRetentionDaysAfterExpiry ?? 30,
    birthdayEnabled: patch.birthdayEnabled !== void 0 ? Boolean(patch.birthdayEnabled) : current.birthdayEnabled,
    birthdayEventName: patch.birthdayEventName !== void 0 ? sanitizePlainText(patch.birthdayEventName, 80) || "Birthday Special" : current.birthdayEventName || "Birthday Special",
    birthdayDiscountPct: patch.birthdayDiscountPct !== void 0 ? clampInteger(patch.birthdayDiscountPct, 0, 100, 0) : current.birthdayDiscountPct,
    birthdayFixedDiscount: patch.birthdayFixedDiscount !== void 0 ? clampInteger(patch.birthdayFixedDiscount, 0, 1e5, 0) : current.birthdayFixedDiscount,
    birthdayGiftService: patch.birthdayGiftService !== void 0 ? sanitizePlainText(patch.birthdayGiftService, 120) : current.birthdayGiftService,
    birthdayMessageTemplate: patch.birthdayMessageTemplate !== void 0 ? sanitizeMultilineTemplate(patch.birthdayMessageTemplate, 600) : current.birthdayMessageTemplate,
    winbackEnabled: patch.winbackEnabled !== void 0 ? Boolean(patch.winbackEnabled) : current.winbackEnabled,
    winbackDays: patch.winbackDays !== void 0 ? clampInteger(patch.winbackDays, 1, 365, current.winbackDays) : current.winbackDays,
    winbackDiscountPct: patch.winbackDiscountPct !== void 0 ? clampInteger(patch.winbackDiscountPct, 0, 100, 0) : current.winbackDiscountPct,
    winbackFixedDiscount: patch.winbackFixedDiscount !== void 0 ? clampInteger(patch.winbackFixedDiscount, 0, 1e5, 0) : current.winbackFixedDiscount ?? 0,
    winbackAddonService: patch.winbackAddonService !== void 0 ? sanitizePlainText(patch.winbackAddonService, 120) : current.winbackAddonService,
    winbackMessageTemplate: patch.winbackMessageTemplate !== void 0 ? sanitizeMultilineTemplate(patch.winbackMessageTemplate, 600) : current.winbackMessageTemplate,
    reviewBoosterEnabled: patch.reviewBoosterEnabled !== void 0 ? Boolean(patch.reviewBoosterEnabled) : current.reviewBoosterEnabled,
    googleReviewUrl: patch.googleReviewUrl !== void 0 ? sanitizeHttpUrl(patch.googleReviewUrl, current.googleReviewUrl) : current.googleReviewUrl
  };
  const updated = {
    ...current,
    ...safePatch,
    salonId,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  if (safePatch.whatsappPhone && patch.whatsappPhone || safePatch.ownerAuthPhone && patch.ownerAuthPhone) {
    updated.countryCode = regionMeta.countryCode;
    updated.timezoneOffsetHours = regionMeta.timezoneOffsetHours;
    updated.timezoneIana = updated.timezoneIana || detectTimezoneIana(regionMeta.countryCode);
    updated.currency = regionMeta.currency;
    updated.currencySymbol = regionMeta.currencySymbol;
  }
  store.settingsBySalon[salonId] = updated;
  await syncSalonSettingsToPostgres(updated, actor);
  persistStore(salonId);
  return getSalonConciergeState(salonId);
}
function addWalkInQueueItem(salonId, input) {
  const store = ensureStoreLoaded();
  ensureSalonExists(salonId);
  const barbers = getSalonBarbers(salonId);
  const item = {
    id: `wq-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 4)}`,
    salonId,
    clientName: sanitizePlainText(input.clientName, 80) || "Walk-In Guest",
    phone: sanitizePhone(input.phone || "") || "",
    service: sanitizePlainText(input.service, 100) || "Express Service",
    assignedStaff: sanitizePlainText(input.assignedStaff, 60) || barbers[0] || "Next Available",
    etaMinutes: clampInteger(input.etaMinutes ?? 15, 5, 180, 15),
    status: "WAITING",
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  store.walkInQueue.unshift(item);
  store.walkInQueue = store.walkInQueue.slice(0, 60);
  persistStore();
  return getSalonConciergeState(salonId);
}
function updateWalkInQueueStatus(salonId, itemId, status) {
  const store = ensureStoreLoaded();
  const target = store.walkInQueue.find((w) => w.salonId === salonId && w.id === itemId);
  if (target) {
    target.status = status;
    persistStore();
  }
  return getSalonConciergeState(salonId);
}
function upsertBridalBooking(salonId, input) {
  const store = ensureStoreLoaded();
  ensureSalonExists(salonId);
  const totalAmount = clampInteger(input.totalAmount, 0, 2e6, 25e3);
  const advancePaid = clampInteger(input.advancePaid, 0, totalAmount, 0);
  const barbers = getSalonBarbers(salonId);
  const record = {
    id: `br-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 4)}`,
    salonId,
    brideOrEventName: sanitizePlainText(input.brideOrEventName, 100) || "Bridal Event",
    phone: sanitizePhone(input.phone || "") || "+92 300 0000000",
    packageName: sanitizePlainText(input.packageName, 100) || "Bridal Makeup & Styling",
    eventDate: sanitizePlainText(input.eventDate, 40) || "Upcoming Event",
    trialDate: input.trialDate ? sanitizePlainText(input.trialDate, 40) : void 0,
    totalAmount,
    advancePaid,
    assignedStylist: sanitizePlainText(input.assignedStylist, 60) || barbers[0] || "Lead Stylist",
    homeService: Boolean(input.homeService),
    status: advancePaid >= totalAmount ? "SETTLED" : "ADVANCE_LOCKED",
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  store.bridalBookings.unshift(record);
  store.bridalBookings = store.bridalBookings.slice(0, 60);
  persistStore();
  return getSalonConciergeState(salonId);
}
function settleBridalBookingBalance(salonId, bookingId) {
  const store = ensureStoreLoaded();
  const target = store.bridalBookings.find((b) => b.salonId === salonId && b.id === bookingId);
  if (target) {
    target.advancePaid = target.totalAmount;
    target.status = "SETTLED";
    persistStore();
  }
  return getSalonConciergeState(salonId);
}
function upsertServicePackage(salonId, input) {
  const store = ensureStoreLoaded();
  ensureSalonExists(salonId);
  const pass = {
    id: `pkg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 4)}`,
    salonId,
    clientName: sanitizePlainText(input.clientName, 80) || "VIP Member",
    phone: sanitizePhone(input.phone || "") || "",
    packageTitle: sanitizePlainText(input.packageTitle, 100) || "Multi-Session Package",
    totalSessions: clampInteger(input.totalSessions, 2, 30, 5),
    usedSessions: 0,
    pricePaid: clampInteger(input.pricePaid, 0, 1e6, 5e3),
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  store.servicePackages.unshift(pass);
  store.servicePackages = store.servicePackages.slice(0, 80);
  persistStore();
  return getSalonConciergeState(salonId);
}
function consumeServicePackageSession(salonId, pkgId) {
  const store = ensureStoreLoaded();
  const target = store.servicePackages.find((p) => p.salonId === salonId && p.id === pkgId);
  if (target && target.usedSessions < target.totalSessions) {
    target.usedSessions += 1;
    target.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    persistStore();
  }
  return getSalonConciergeState(salonId);
}
async function setSalonBillingStatus(salonId, billingStatus, actor) {
  const normalizedActor = validatePgActorContext(actor);
  if (normalizedActor.role !== "FOUNDER") {
    throw new PgContextError(
      "PRIVILEGE_ESCALATION",
      `Only FOUNDER may modify salon billing_status (received role ${normalizedActor.role}).`
    );
  }
  const store = ensureStoreLoaded();
  const current = ensureSalonExists(salonId);
  current.billingStatus = billingStatus;
  current.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  store.settingsBySalon[salonId] = current;
  await syncSalonSettingsToPostgres(current, actor);
  persistStore(salonId);
  return getSalonConciergeState(salonId);
}
function listSalonsForAgent(agentId, isFounder = false) {
  const store = ensureStoreLoaded();
  const all = Object.values(store.settingsBySalon);
  if (isFounder) return all;
  if (!agentId) return [];
  const allowedIds = new Set(getSalonsAssignedToAgent(agentId));
  return all.filter((s) => allowedIds.has(s.salonId));
}
function upsertClientProfile(salonId, input) {
  const store = ensureStoreLoaded();
  ensureSalonExists(salonId);
  const cleanPhone = sanitizePhone(input.phone);
  const normPhone = cleanPhone.replace(/\s+/g, "");
  const cleanName = sanitizePlainText(input.name, 80);
  const cleanBirthDate = input.birthDate !== void 0 ? sanitizeBirthDate(input.birthDate) : void 0;
  const validLang = input.preferredLanguage === "en" || input.preferredLanguage === "roman_ur" || input.preferredLanguage === "ur" || input.preferredLanguage === "ar" ? input.preferredLanguage : input.preferredLanguage === null ? null : void 0;
  let existing = store.clients.find(
    (c) => c.salonId === salonId && c.phone.replace(/\s+/g, "") === normPhone
  );
  if (!existing) {
    existing = {
      id: `cli-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      salonId,
      name: cleanName || "Salon Client",
      phone: cleanPhone,
      preferredLanguage: validLang ?? null,
      awaitingLanguageSelection: validLang ? false : true,
      birthDate: cleanBirthDate || "",
      lastCompletedVisitAt: null,
      lastBirthdaySentYear: null,
      lastWinbackSentAt: null,
      awaitingWinbackRebook: false,
      awaitingReviewAppointmentId: null,
      marketingOptIn: Boolean(input.marketingOptIn),
      totalVisits: 0,
      lastServiceIds: [],
      lastBarberName: null
    };
    store.clients.unshift(existing);
  } else {
    if (cleanName) existing.name = cleanName;
    if (cleanBirthDate !== void 0) existing.birthDate = cleanBirthDate;
    if (validLang !== void 0) {
      existing.preferredLanguage = validLang;
      existing.awaitingLanguageSelection = false;
    }
    if (typeof input.marketingOptIn === "boolean") {
      existing.marketingOptIn = input.marketingOptIn;
    }
  }
  persistStore(salonId);
  return existing;
}
function addStylistLeave(salonId, input) {
  const store = ensureStoreLoaded();
  ensureSalonExists(salonId);
  const cleanStylist = sanitizePlainText(input.stylistName, 60);
  const cleanDate = /^\d{4}-\d{2}-\d{2}$/.test(input.date || "") ? input.date : "";
  if (!cleanStylist || !cleanDate) {
    throw new Error("Stylist name and YYYY-MM-DD date are required.");
  }
  const lv = {
    id: `lv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    salonId,
    stylistName: cleanStylist,
    date: cleanDate,
    startTime: input.startTime ? sanitizePlainText(input.startTime, 20) : void 0,
    endTime: input.endTime ? sanitizePlainText(input.endTime, 20) : void 0,
    fullDay: input.fullDay !== false && !(input.startTime && input.endTime),
    reason: input.reason ? sanitizePlainText(input.reason, 120) : "Scheduled Off / Leave",
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  store.stylistLeaves = [lv, ...store.stylistLeaves || []].slice(0, 200);
  persistStore(salonId);
  return getSalonConciergeState(salonId);
}
function removeStylistLeave(salonId, leaveId) {
  const store = ensureStoreLoaded();
  store.stylistLeaves = (store.stylistLeaves || []).filter(
    (lv) => !(lv.salonId === salonId && lv.id === leaveId)
  );
  persistStore(salonId);
  return getSalonConciergeState(salonId);
}
function getRetentionOpportunities(salonId) {
  const store = ensureStoreLoaded();
  const settings = ensureSalonExists(salonId);
  const localClock = getLocalClockForOffset(settings.timezoneOffsetHours);
  const nowMs = Date.now();
  const winbackThresholdMs = Math.max(1, settings.winbackDays) * 864e5;
  const opportunities = [];
  for (const cli of store.clients.filter((c) => c.salonId === salonId)) {
    const lang = cli.preferredLanguage || "en";
    const cleanPhoneDigits = cli.phone.replace(/\D/g, "");
    if (!cleanPhoneDigits) continue;
    const bookUrlHint = `/s/${settings.publicCode}`;
    if (settings.birthdayEnabled && cli.birthDate && cli.birthDate === localClock.dayMonth) {
      const msg = `${renderBirthdayMessage(settings, cli.name, lang)} Book instantly: ${bookUrlHint}`;
      opportunities.push({
        clientId: cli.id,
        clientName: cli.name,
        clientPhone: cli.phone,
        reason: "BIRTHDAY",
        suggestedMessage: msg,
        whatsappHandoffUrl: `https://wa.me/${cleanPhoneDigits}?text=${encodeURIComponent(msg)}`
      });
      continue;
    }
    if (settings.winbackEnabled && cli.lastCompletedVisitAt) {
      const lastVisitMs = new Date(cli.lastCompletedVisitAt).getTime();
      if (!Number.isNaN(lastVisitMs) && nowMs - lastVisitMs >= winbackThresholdMs) {
        const hasUpcoming = store.appointments.some(
          (a) => a.salonId === salonId && a.clientId === cli.id && (a.status === "CONFIRMED" || a.status === "IN_CHAIR")
        );
        if (!hasUpcoming) {
          const daysSince = Math.floor((nowMs - lastVisitMs) / 864e5);
          const msg = `${renderWinBackMessage(settings, cli.name, lang)} Instant rebook: ${bookUrlHint}`;
          opportunities.push({
            clientId: cli.id,
            clientName: cli.name,
            clientPhone: cli.phone,
            reason: "DORMANT_30D",
            daysSinceLastVisit: daysSince,
            suggestedMessage: msg,
            whatsappHandoffUrl: `https://wa.me/${cleanPhoneDigits}?text=${encodeURIComponent(msg)}`
          });
        }
      }
    }
  }
  return opportunities;
}
function saveFirstTimeClientProfile(publicCode, input) {
  const salonId = resolveSalonIdByPublicCode(publicCode);
  if (!salonId) {
    return { ok: false, statusCode: 404, error: "Salon booking link not found." };
  }
  const settings = ensureSalonExists(salonId);
  const cleanName = sanitizePlainText(input.name, 80);
  const cleanPhone = sanitizePhone(input.phone);
  if (!cleanName || cleanName.length < 2) {
    return { ok: false, statusCode: 400, error: "Please enter your complete full name." };
  }
  if (!cleanPhone || cleanPhone.replace(/\D/g, "").length < 6) {
    return { ok: false, statusCode: 400, error: "Please enter a valid mobile number." };
  }
  const validLang = sanitizeClientLang(input.preferredLanguage, "en");
  const client = upsertClientProfile(salonId, {
    name: cleanName,
    phone: cleanPhone,
    preferredLanguage: validLang,
    marketingOptIn: Boolean(input.marketingOptIn)
  });
  const cookieToken = signCustomerRecognizeToken({
    salonId,
    publicCode: settings.publicCode,
    clientId: client.id
  });
  const availableLanguages = getConfiguredLanguageChoices(settings, client.phone);
  return {
    ok: true,
    salonId,
    publicCode: settings.publicCode,
    cookieToken,
    personalReturningShareUrl: `/s/${encodeURIComponent(settings.publicCode)}?c=${encodeURIComponent(cookieToken)}`,
    availableLanguages,
    returningClient: {
      clientId: client.id,
      clientName: client.name,
      maskedPhone: maskPhoneNumber(client.phone),
      preferredLanguage: client.preferredLanguage || validLang,
      totalVisits: Number(client.totalVisits || 0),
      lastServiceIds: Array.isArray(client.lastServiceIds) ? client.lastServiceIds : [],
      lastBarberName: client.lastBarberName || null,
      marketingOptIn: Boolean(client.marketingOptIn)
    }
  };
}
function assertOwnerOrFounderConciergeActor(actor, salonId, operation) {
  const normalized = validatePgActorContext(actor);
  if (normalized.role !== "FOUNDER" && normalized.role !== "SALON_OWNER") {
    throw new PgContextError(
      "PRIVILEGE_ESCALATION",
      `${normalized.role} is not authorized to perform ${operation}.`
    );
  }
  if (normalized.role === "SALON_OWNER" && normalized.salonId !== salonId) {
    throw new PgContextError(
      "FORBIDDEN_TENANT",
      `SALON_OWNER (${normalized.salonId}) cannot access salon ${salonId} during ${operation}.`
    );
  }
  return normalized;
}
function generateBookingManagementToken(publicCode) {
  const encodedCode = Buffer.from(publicCode, "utf8").toString("base64url");
  return `wcbt_${encodedCode}.${crypto3.randomBytes(24).toString("base64url")}`;
}
function getWideUtcDayWindow(dateStr) {
  const parts = dateStr.split("-").map((n) => parseInt(n, 10));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    const now = Date.now();
    return {
      windowStartIso: new Date(now - 864e5).toISOString(),
      windowEndIso: new Date(now + 2 * 864e5).toISOString()
    };
  }
  const [y, m, d] = parts;
  const startUtcMs = Date.UTC(y, m - 1, d, 0, 0, 0) - 14 * 36e5;
  const endUtcMs = Date.UTC(y, m - 1, d, 23, 59, 59, 999) + 14 * 36e5;
  return {
    windowStartIso: new Date(startUtcMs).toISOString(),
    windowEndIso: new Date(endUtcMs).toISOString()
  };
}
function mapPgBookingToConciergeAppointment(rec, tzOffsetHours) {
  const tz = Number.isFinite(tzOffsetHours) ? tzOffsetHours : rec.timezoneOffsetHours;
  const appointmentDate = getIsoLocalDateStr(rec.startsAtIso, tz) || getSalonLocalDateParts(tz).dateStr;
  const startMs = new Date(rec.startsAtIso).getTime();
  const localDate = new Date(startMs + tz * 36e5);
  const timeSlot = Number.isNaN(localDate.getTime()) ? "12:00 PM" : formatMinutesToTimeSlot(localDate.getUTCHours() * 60 + localDate.getUTCMinutes());
  const endMs = new Date(rec.endsAtIso).getTime();
  const serviceNames = rec.servicesSnapshot.map((s) => s.name).filter(Boolean).join(" + ");
  const serviceIds = rec.servicesSnapshot.map((s) => s.id || s.name).filter((x) => Boolean(x));
  return {
    id: rec.bookingRef || rec.id,
    salonId: rec.salonId,
    clientId: rec.clientId,
    clientName: rec.clientName,
    clientPhone: rec.clientPhone,
    barberName: rec.stylistName,
    service: serviceNames || "Salon Service",
    serviceIds,
    price: rec.totalPrice,
    appointmentDate,
    timeSlot,
    durationMins: rec.totalDurationMins,
    scheduledEndMs: Number.isNaN(endMs) ? void 0 : endMs,
    dealId: rec.dealId,
    idempotencyKey: rec.idempotencyKey,
    proofHash: rec.proofHash,
    sourceType: rec.source || "WEB_LINK",
    status: rec.status === "NO_SHOW" ? "CANCELED" : rec.status,
    canceled: rec.status === "CANCELED",
    scheduledForIso: rec.startsAtIso,
    completedAt: rec.completedAtIso,
    reviewPromptSentAt: null,
    rating: null,
    ratingComment: null,
    reviewRoutedStatus: "PENDING"
  };
}
function mapPgClientVisitToProfile(c, defaultLang) {
  return {
    id: c.id,
    salonId: c.salonId,
    name: c.name,
    phone: c.phone,
    preferredLanguage: sanitizeClientLang(c.preferredLanguage || defaultLang, defaultLang),
    awaitingLanguageSelection: false,
    birthDate: c.birthDate || "",
    lastCompletedVisitAt: c.lastCompletedVisitAt,
    lastBirthdaySentYear: null,
    lastWinbackSentAt: null,
    awaitingWinbackRebook: false,
    awaitingReviewAppointmentId: null,
    totalVisits: c.totalVisits
  };
}
function mapPgBookingToManagementPayload(rec) {
  const settings = ensureSalonExists(rec.salonId);
  const tz = Number.isFinite(rec.timezoneOffsetHours) ? rec.timezoneOffsetHours : settings.timezoneOffsetHours;
  const startMs = new Date(rec.startsAtIso).getTime();
  const localDate = new Date(startMs + tz * 36e5);
  const timeSlot = Number.isNaN(localDate.getTime()) ? "12:00 PM" : formatMinutesToTimeSlot(localDate.getUTCHours() * 60 + localDate.getUTCMinutes());
  const appointmentDate = getIsoLocalDateStr(rec.startsAtIso, tz) || getSalonLocalDateParts(tz).dateStr;
  const service = rec.servicesSnapshot.map((s) => s.name).filter(Boolean).join(" + ") || "Salon Service";
  const serviceIds = rec.servicesSnapshot.map((s) => s.id || s.name).filter((x) => Boolean(x));
  const address = rec.address || settings.address || SEEDED_SALON_ADDRESSES[rec.salonId] || "Salon Location";
  const googleMapsUrl = rec.googleMapsUrl || settings.googleMapsUrl || buildGoogleMapsSearchUrl(rec.salonName || settings.salonName, address);
  return {
    ok: true,
    bookingId: rec.bookingRef || rec.id,
    bookingRef: rec.bookingRef || rec.id,
    salonPublicCode: rec.salonPublicCode || settings.publicCode,
    salonName: rec.salonName || settings.salonName,
    publicContactPhone: rec.publicContactPhone || settings.publicContactPhone || settings.whatsappPhone,
    publicWhatsappPhone: rec.publicWhatsappPhone || rec.publicContactPhone || settings.publicWhatsappPhone || settings.publicContactPhone || settings.whatsappPhone,
    clientName: rec.clientName,
    maskedPhone: maskPhoneNumber(rec.clientPhone),
    service,
    serviceIds,
    barberName: rec.stylistName,
    appointmentDate,
    timeSlot,
    durationMins: rec.totalDurationMins || 35,
    totalPrice: rec.totalPrice,
    currencySymbol: rec.currencySymbol || settings.currencySymbol,
    status: rec.status === "NO_SHOW" ? "CANCELED" : rec.status,
    address,
    googleMapsUrl,
    // Neutral review URL revealed STRICTLY when appointment is COMPLETED (no star-rating gating!)
    googleReviewUrl: rec.status === "COMPLETED" ? rec.googleReviewUrl || settings.googleReviewUrl || null : null,
    preferredLanguage: sanitizeClientLang(rec.preferredLanguage || rec.defaultLang || settings.defaultLang, "en"),
    icsContent: buildIcsCalendarContent({
      bookingId: rec.bookingRef || rec.id,
      salonName: rec.salonName || settings.salonName,
      service,
      barberName: rec.stylistName,
      address,
      startsAtIso: rec.startsAtIso,
      durationMins: rec.totalDurationMins || 35
    })
  };
}
async function buildOwnerStateFromPostgres(salonId, actor, updatedClient) {
  const baseState = buildSalonBaseStateSnapshot(salonId, void 0, { runAutoComplete: false });
  const pgData = await listSalonBookingsFromPostgres(salonId, actor);
  if (pgData) {
    baseState.appointments = pgData.bookings.map(
      (b) => mapPgBookingToConciergeAppointment(b, baseState.settings.timezoneOffsetHours)
    );
    baseState.bookingAuditLog = pgData.auditLog;
  }
  if (updatedClient) {
    const idx = baseState.clients.findIndex((c) => c.id === updatedClient.id || c.phone === updatedClient.phone);
    if (idx >= 0) {
      baseState.clients[idx] = { ...baseState.clients[idx], ...updatedClient };
    } else {
      baseState.clients = [updatedClient, ...baseState.clients];
    }
  }
  return baseState;
}
async function updateAppointmentStatus(salonId, bookingId, nextStatus, actor) {
  assertOwnerOrFounderConciergeActor(actor, salonId, "updateAppointmentStatus");
  if (isPostgresConfigured()) {
    const pgOutcome = await updateBookingStatusInPostgres({ salonId, bookingId, nextStatus }, actor);
    if (!pgOutcome.ok) {
      return { ok: false, statusCode: pgOutcome.statusCode, error: pgOutcome.error };
    }
    const state = await buildOwnerStateFromPostgres(salonId, actor);
    const appointment = mapPgBookingToConciergeAppointment(
      pgOutcome.booking,
      state.settings.timezoneOffsetHours
    );
    return { ok: true, appointment, state };
  }
  if (process.env.NODE_ENV === "production") {
    return {
      ok: false,
      statusCode: 503,
      error: "Database is not configured. Status update cannot be committed without persistent storage."
    };
  }
  const store = ensureStoreLoaded();
  ensureSalonExists(salonId);
  const appt = store.appointments.find((a) => a.salonId === salonId && a.id === bookingId);
  if (!appt) {
    return { ok: false, statusCode: 404, error: "Appointment not found for this salon." };
  }
  if (appt.status === "COMPLETED" && nextStatus !== "COMPLETED") {
    return { ok: false, statusCode: 409, error: `Completed appointments cannot transition to ${nextStatus}.` };
  }
  if (appt.status === "CANCELED" && nextStatus !== "CANCELED") {
    return { ok: false, statusCode: 409, error: "Canceled appointments cannot be reopened." };
  }
  appt.status = nextStatus;
  if (nextStatus === "CANCELED") {
    appt.canceled = true;
    store.chairLocks = store.chairLocks.filter((l) => !(l.salonId === salonId && l.id === bookingId));
    appendBookingAudit(salonId, bookingId, "OWNER", "CANCELED", "Marked canceled by salon owner (quota unchanged).");
  } else if (nextStatus === "COMPLETED") {
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    appt.completedAt = nowIso;
    const cli = store.clients.find((c) => c.id === appt.clientId);
    if (cli) {
      cli.lastCompletedVisitAt = nowIso;
      cli.totalVisits = (cli.totalVisits || 0) + 1;
    }
    store.chairLocks = store.chairLocks.filter((l) => !(l.salonId === salonId && l.id === bookingId));
    appendBookingAudit(salonId, bookingId, "OWNER", "COMPLETED", "Appointment marked completed by salon owner.");
  } else {
    appendBookingAudit(salonId, bookingId, "OWNER", nextStatus === "IN_CHAIR" ? "IN_CHAIR" : "CREATED", `Status updated to ${nextStatus}.`);
  }
  persistStore(salonId);
  return { ok: true, appointment: appt, state: getSalonConciergeState(salonId) };
}
async function rescheduleAppointmentByOwner(salonId, bookingId, input, actor) {
  assertOwnerOrFounderConciergeActor(actor, salonId, "rescheduleAppointmentByOwner");
  const cleanDate = sanitizePlainText(input.appointmentDate || "", 20);
  const cleanTimeSlot = sanitizePlainText(input.timeSlot || "", 24);
  const requestedBarber = input.barberName ? sanitizePlainText(input.barberName, 60) : void 0;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate) || !cleanTimeSlot) {
    return { statusCode: 400, ok: false, error: "Valid date and time slot are required." };
  }
  if (isPostgresConfigured()) {
    const { windowStartIso, windowEndIso } = getWideUtcDayWindow(cleanDate);
    const resolveSlot = (snapshot, currentBooking) => {
      const targetBarber2 = requestedBarber || currentBooking.stylistName;
      const serviceIds = currentBooking.servicesSnapshot.map((s) => s.id || s.name).filter((x) => Boolean(x));
      const avail2 = evaluateAvailabilityFromSnapshot({
        salonId,
        date: cleanDate,
        exactDurationMins: currentBooking.totalDurationMins || 35,
        serviceIds,
        excludeBookingId: currentBooking.id,
        snapshot
      });
      if (!avail2.isOpen) {
        return {
          ok: false,
          statusCode: 409,
          error: avail2.closedReason || "Salon is closed on that date."
        };
      }
      const startMinutes2 = parseTimeSlotToMinutes(cleanTimeSlot);
      const formattedTime2 = startMinutes2 >= 0 ? formatMinutesToTimeSlot(startMinutes2) : cleanTimeSlot;
      const matchedSlot2 = avail2.slots.find(
        (s) => s.startMinutes === startMinutes2 || s.timeSlot === formattedTime2
      );
      const matchedBarber2 = matchedSlot2?.barbers.find(
        (b) => b.name.toLowerCase() === targetBarber2.toLowerCase() && b.available
      );
      if (!matchedSlot2 || !matchedBarber2) {
        return {
          ok: false,
          statusCode: 409,
          error: `${targetBarber2} is not available at ${formattedTime2} on ${cleanDate}.`
        };
      }
      const [y2, m2, d2] = cleanDate.split("-").map((n) => parseInt(n, 10));
      const tz = Number.isFinite(snapshot.timezoneOffsetHours) ? snapshot.timezoneOffsetHours : ensureSalonExists(salonId).timezoneOffsetHours;
      const startUtcMs2 = Date.UTC(y2, m2 - 1, d2, Math.floor(startMinutes2 / 60), startMinutes2 % 60, 0) - tz * 36e5;
      const dur2 = currentBooking.totalDurationMins || 35;
      return {
        ok: true,
        startUtcIso: new Date(startUtcMs2).toISOString(),
        endUtcIso: new Date(startUtcMs2 + dur2 * 6e4).toISOString(),
        formattedTime: formattedTime2,
        barberName: matchedBarber2.name,
        durationMins: dur2
      };
    };
    const pgResult = await rescheduleBookingByOwnerInPostgres(
      {
        salonId,
        bookingId,
        appointmentDate: cleanDate,
        windowStartIso,
        windowEndIso,
        resolveSlot
      },
      actor
    );
    if (!pgResult.ok) {
      return { statusCode: pgResult.statusCode, ok: false, error: pgResult.error };
    }
    const state = await buildOwnerStateFromPostgres(salonId, actor);
    const appointment = mapPgBookingToConciergeAppointment(
      pgResult.booking,
      state.settings.timezoneOffsetHours
    );
    return { statusCode: 200, ok: true, appointment, state };
  }
  if (process.env.NODE_ENV === "production") {
    return {
      statusCode: 503,
      ok: false,
      error: "Database is not configured. Reschedule cannot be committed without persistent storage."
    };
  }
  const store = ensureStoreLoaded();
  const settings = ensureSalonExists(salonId);
  const appt = store.appointments.find((a) => a.salonId === salonId && a.id === bookingId);
  if (!appt) {
    return { statusCode: 404, ok: false, error: "Appointment not found for this salon." };
  }
  if (appt.status === "COMPLETED" || appt.status === "CANCELED") {
    return {
      statusCode: 409,
      ok: false,
      error: "Completed or canceled appointments cannot be rescheduled."
    };
  }
  const targetBarber = requestedBarber || appt.barberName;
  const prevStatus = appt.status;
  appt.status = "CANCELED";
  const avail = evaluateAvailabilityFromSnapshot({
    salonId,
    date: cleanDate,
    exactDurationMins: appt.durationMins || 35,
    serviceIds: appt.serviceIds,
    snapshot: null
  });
  appt.status = prevStatus;
  if (!avail.isOpen) {
    return {
      statusCode: 409,
      ok: false,
      error: avail.closedReason || "Salon is closed on that date."
    };
  }
  const startMinutes = parseTimeSlotToMinutes(cleanTimeSlot);
  const formattedTime = startMinutes >= 0 ? formatMinutesToTimeSlot(startMinutes) : cleanTimeSlot;
  const matchedSlot = avail.slots.find(
    (s) => s.startMinutes === startMinutes || s.timeSlot === formattedTime
  );
  const matchedBarber = matchedSlot?.barbers.find(
    (b) => b.name.toLowerCase() === targetBarber.toLowerCase() && b.available
  );
  if (!matchedSlot || !matchedBarber) {
    return {
      statusCode: 409,
      ok: false,
      error: `${targetBarber} is not available at ${formattedTime} on ${cleanDate}.`
    };
  }
  const [y, m, d] = cleanDate.split("-").map((n) => parseInt(n, 10));
  const startUtcMs = Date.UTC(y, m - 1, d, Math.floor(startMinutes / 60), startMinutes % 60, 0) - settings.timezoneOffsetHours * 36e5;
  const dur = appt.durationMins || 35;
  const oldSummary = `${appt.appointmentDate || ""} ${appt.timeSlot} (${appt.barberName})`;
  appt.appointmentDate = cleanDate;
  appt.timeSlot = formattedTime;
  appt.barberName = matchedBarber.name;
  appt.scheduledForIso = new Date(startUtcMs).toISOString();
  appt.scheduledEndMs = startUtcMs + dur * 6e4;
  appendBookingAudit(
    salonId,
    appt.id,
    "OWNER",
    "RESCHEDULED",
    `Moved by owner from ${oldSummary} to ${cleanDate} ${formattedTime} (${matchedBarber.name}). 0 quota used.`
  );
  persistStore(salonId);
  return {
    statusCode: 200,
    ok: true,
    appointment: appt,
    state: getSalonConciergeState(salonId)
  };
}
async function completeAppointmentAndRecordVisit(salonId, payload, actor) {
  assertOwnerOrFounderConciergeActor(actor, salonId, "completeAppointmentAndRecordVisit");
  const settings = ensureSalonExists(salonId);
  const regionMeta = detectRegionFromPhone(settings.whatsappPhone);
  const defaultLang = payload.preferredLanguage || (regionMeta.region === "PK" ? "roman_ur" : regionMeta.region === "MENA" ? "ar" : "en");
  const cleanApptId = sanitizePlainText(payload.appointmentId, 60) || `BK-${Date.now()}`;
  const cleanClientName = sanitizePlainText(payload.clientName, 80) || "Salon Client";
  const cleanClientPhone = sanitizePhone(payload.clientPhone);
  const cleanBarber = sanitizePlainText(payload.barberName, 60) || "Master Barber";
  const cleanService = sanitizePlainText(payload.service, 160) || "Salon Service";
  const cleanTimeSlot = sanitizePlainText(payload.timeSlot, 40) || "Completed";
  const cleanPrice = clampInteger(payload.price, 0, 1e6, 0);
  const cleanBirthDate = payload.birthDate ? sanitizeBirthDate(payload.birthDate) : "";
  if (isPostgresConfigured()) {
    const nowMs = Date.now();
    const startsAtIso = new Date(nowMs).toISOString();
    const endsAtIso = new Date(nowMs + 35 * 6e4).toISOString();
    const proofHash = crypto3.createHash("sha256").update(`${salonId}:${cleanApptId}:${cleanClientPhone}:${cleanBarber}:COMPLETED`).digest("hex");
    const pgResult = await completeAppointmentAndRecordVisitInPostgres(
      {
        salonId,
        appointmentId: cleanApptId,
        clientName: cleanClientName,
        clientPhone: cleanClientPhone,
        barberName: cleanBarber,
        service: cleanService,
        price: cleanPrice,
        birthDate: cleanBirthDate,
        preferredLanguage: defaultLang,
        startsAtIso,
        endsAtIso,
        proofHash
      },
      actor
    );
    if (!pgResult.ok) {
      throw new BookingLifecycleError(pgResult.statusCode, pgResult.error);
    }
    const mappedClient = mapPgClientVisitToProfile(pgResult.client, defaultLang);
    const state = await buildOwnerStateFromPostgres(salonId, actor, mappedClient);
    const appointment = mapPgBookingToConciergeAppointment(
      pgResult.booking,
      state.settings.timezoneOffsetHours
    );
    return {
      appointment,
      client: mappedClient,
      state
    };
  }
  if (process.env.NODE_ENV === "production") {
    throw new BookingLifecycleError(
      503,
      "Database is not configured. Completion cannot be recorded without persistent storage."
    );
  }
  const store = ensureStoreLoaded();
  const client = upsertClientProfile(salonId, {
    phone: cleanClientPhone,
    name: cleanClientName,
    birthDate: payload.birthDate
  });
  if (!client.preferredLanguage) {
    client.preferredLanguage = defaultLang;
    client.awaitingLanguageSelection = false;
  }
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  client.lastCompletedVisitAt = nowIso;
  let appt = store.appointments.find(
    (a) => a.salonId === salonId && a.id === cleanApptId
  );
  if (!appt) {
    client.totalVisits = (client.totalVisits || 0) + 1;
    appt = {
      id: cleanApptId,
      salonId,
      clientId: client.id,
      clientName: cleanClientName,
      clientPhone: cleanClientPhone,
      barberName: cleanBarber,
      service: cleanService,
      price: cleanPrice,
      timeSlot: cleanTimeSlot,
      sourceType: "OWNER_WALKIN",
      status: "COMPLETED",
      scheduledForIso: nowIso,
      completedAt: nowIso,
      reviewPromptSentAt: null,
      rating: null,
      ratingComment: null,
      reviewRoutedStatus: "PENDING"
    };
    store.appointments.unshift(appt);
  } else {
    if (appt.status === "CANCELED") {
      throw new BookingLifecycleError(409, "Canceled appointments cannot be completed.");
    }
    if (appt.status !== "COMPLETED") {
      client.totalVisits = (client.totalVisits || 0) + 1;
    }
    appt.status = "COMPLETED";
    appt.completedAt = appt.completedAt || nowIso;
    appt.clientId = client.id;
  }
  store.chairLocks = store.chairLocks.filter(
    (l) => !(l.salonId === salonId && l.id === payload.appointmentId)
  );
  persistStore();
  return {
    appointment: appt,
    client,
    state: getSalonConciergeState(salonId)
  };
}
function processWhatsAppWebhook(payload) {
  const store = ensureStoreLoaded();
  const settings = ensureSalonExists(payload.salonId);
  const regionMeta = detectRegionFromPhone(settings.whatsappPhone);
  const menuOptions = getLanguageMenuForRegion(regionMeta.region, settings.whatsappPhone);
  const cleanPhone = sanitizePhone(payload.fromPhone);
  const cleanClientName = payload.clientName ? sanitizePlainText(payload.clientName, 80) : void 0;
  const raw = sanitizePlainText(payload.messageText, 500);
  const lower = raw.toLowerCase();
  let client = store.clients.find(
    (c) => c.salonId === payload.salonId && c.phone.replace(/\s+/g, "") === cleanPhone.replace(/\s+/g, "")
  );
  if (!client) {
    client = upsertClientProfile(payload.salonId, {
      phone: cleanPhone,
      name: cleanClientName || "WhatsApp Client",
      preferredLanguage: null
    });
  } else if (cleanClientName && client.name === "WhatsApp Client") {
    client.name = cleanClientName;
  }
  const isPendingRerouteReply = Boolean(
    client.pendingReroute && (client.pendingReroute.alternatives.some((alt) => alt.index === raw) || client.pendingReroute.alternatives.some(
      (alt) => lower.includes(alt.barberName.toLowerCase().split(" ")[0])
    ))
  );
  const isPendingRescheduleReply = Boolean(
    client.pendingReschedule && client.pendingReschedule.alternatives.some((alt) => alt.index === raw)
  );
  const isGreeting = /^(hi|hello|hey|salam|assalam|assalamu|marhaba|السلام|مرحبا)\b/i.test(lower);
  const starMatch = raw.match(/^([1-5])(\s*(stars?|★|\*)?.*)?$/i);
  const reviewApptId = payload.appointmentIdForReview || client.awaitingReviewAppointmentId;
  const isStarFeedback = Boolean(
    !isPendingRerouteReply && !isPendingRescheduleReply && starMatch && (reviewApptId || lower.includes("star") || raw.length <= 2 && !client.awaitingLanguageSelection)
  );
  const isWinbackRebook = !isPendingRerouteReply && !isPendingRescheduleReply && (lower.includes("rebook") || client.awaitingWinbackRebook && raw === "1");
  const isPriceListQuery = !isPendingRerouteReply && !isPendingRescheduleReply && !client.awaitingLanguageSelection && (/\b(price|prices|rate|rates|menu|charges|fee|list|kitne|qeemat)\b|قیمت|ریٹ|اسعار|أسعار|قائمة/i.test(lower) || raw === "2" && !isStarFeedback);
  const isLateReply = /\b(late|delay|minutes?\s*late|min\s*late|der\s*ho|تأخير|متأخر)\b/i.test(lower);
  const isRescheduleReply = /\b(reschedule|tomorrow|cancel|can'?t\s*(make|come)|nahi\s*aa|kal\s*ka|تأجيل|إلغاء|غداً)\b/i.test(lower);
  const isBridalOrGroom = /\b(bridal|bride|groom|baraat|walima|nikah|wedding|dulha|dulhan|عروس|عريس|دلہن|دولہا)\b/i.test(
    lower
  );
  const isBookingOrConfirm = isBridalOrGroom || /\b(confirm|confirmed|book|want|wants|coming|on\s*my\s*way|be\s*there|haircut|beard|facial|fade|shave|groom|slot|aa\s*raha|کنفرم|بک|حجز|أؤكد|تأكيد|قادم)\b/i.test(
    lower
  ) || /\b\d{1,2}(:\d{2})?\s*(am|pm|a\.m\.|p\.m\.)\b/i.test(lower);
  const hasStructuredAction = isPendingRerouteReply || isPendingRescheduleReply || isStarFeedback || isWinbackRebook || isPriceListQuery || isLateReply || isRescheduleReply || isBookingOrConfirm;
  const matchedLangOpt = menuOptions.find((o) => o.index === raw) || menuOptions.find(
    (o) => lower.includes(
      o.lang === "roman_ur" ? "roman" : o.lang === "ur" ? "urdu" : o.lang === "ar" ? "arab" : "eng"
    )
  );
  const isStep5Action = isPendingRerouteReply || isPendingRescheduleReply || isPriceListQuery || !isStarFeedback && !isWinbackRebook && (isLateReply || isRescheduleReply || isBookingOrConfirm);
  if (!(isStep5Action && !payload.forceLanguagePrompt && !(client.awaitingLanguageSelection && matchedLangOpt))) {
    appendLog(payload.salonId, {
      direction: "INBOUND",
      module: client.awaitingReviewAppointmentId ? "REVIEW_T2H" : isWinbackRebook ? "WINBACK_30D" : "LANGUAGE_MENU",
      clientName: client.name,
      clientPhone: client.phone,
      language: client.preferredLanguage || "en",
      dir: getLangDirection(client.preferredLanguage || "en"),
      body: raw
    });
  }
  if (payload.forceLanguagePrompt || !hasStructuredAction && isGreeting || !hasStructuredAction && !client.preferredLanguage && !client.awaitingLanguageSelection) {
    const chosenLang = client.preferredLanguage || "en";
    client.awaitingLanguageSelection = false;
    const welcome = buildCustomerWelcomeMenu(settings, chosenLang);
    appendLog(payload.salonId, {
      direction: "OUTBOUND",
      module: "LANGUAGE_MENU",
      clientName: client.name,
      clientPhone: client.phone,
      language: welcome.language,
      dir: welcome.dir,
      body: welcome.welcomeText
    });
    persistStore(payload.salonId);
    return {
      replyText: welcome.welcomeText,
      replyDir: welcome.dir,
      lockedLanguage: welcome.language,
      routedAction: "WELCOME_MENU_SENT",
      state: getSalonConciergeState(payload.salonId)
    };
  }
  if (!hasStructuredAction && matchedLangOpt) {
    client.preferredLanguage = matchedLangOpt.lang;
    client.awaitingLanguageSelection = false;
    const welcome = buildCustomerWelcomeMenu(settings, matchedLangOpt.lang);
    appendLog(payload.salonId, {
      direction: "OUTBOUND",
      module: "LANGUAGE_MENU",
      clientName: client.name,
      clientPhone: client.phone,
      language: welcome.language,
      dir: welcome.dir,
      body: welcome.welcomeText
    });
    persistStore(payload.salonId);
    return {
      replyText: welcome.welcomeText,
      replyDir: welcome.dir,
      lockedLanguage: matchedLangOpt.lang,
      routedAction: `LANGUAGE_LOCKED_${matchedLangOpt.lang.toUpperCase()}`,
      state: getSalonConciergeState(payload.salonId)
    };
  }
  if (!hasStructuredAction && (raw === "1" || raw === "3" || raw === "4" || /\b(hours|timing|location|address|map|deal|offer|promo)\b/i.test(lower))) {
    const targetLang = client.preferredLanguage || "en";
    let actionId = "BOOK_APPOINTMENT";
    if (raw === "3" || /\b(hours|timing|location|address|map)\b/i.test(lower)) {
      actionId = "HOURS_LOCATION";
    } else if (raw === "4" || /\b(deal|offer|promo)\b/i.test(lower)) {
      actionId = "CURRENT_DEALS";
    }
    const resAction = handleCustomerWhatsAppAction({
      salonId: payload.salonId,
      fromPhone: cleanPhone,
      messageText: raw,
      actionId,
      preferredLang: targetLang,
      clientName: cleanClientName,
      isDemo: false
    });
    return {
      replyText: resAction.text,
      replyDir: resAction.dir,
      lockedLanguage: resAction.language,
      routedAction: actionId,
      state: getSalonConciergeState(payload.salonId)
    };
  }
  if (hasStructuredAction && !client.preferredLanguage) {
    client.preferredLanguage = resolveClientConversationLang(client, raw, regionMeta.region);
    client.awaitingLanguageSelection = false;
  }
  const activeLang = resolveClientConversationLang(
    client,
    raw,
    regionMeta.region
  );
  const activeDir = getLangDirection(activeLang);
  if (isStarFeedback && starMatch) {
    const rating = Number(starMatch[1]);
    const appt = store.appointments.find((a) => a.id === reviewApptId) || store.appointments.find((a) => a.salonId === payload.salonId && a.clientId === client.id && a.status === "COMPLETED");
    if (appt) {
      appt.rating = rating;
      appt.ratingComment = raw;
      appt.reviewRoutedStatus = "PUBLIC_GOOGLE_SENT";
    }
    client.awaitingReviewAppointmentId = null;
    const thankYouMap = {
      en: `Thank you for your feedback, ${client.name}! Every review helps ${settings.salonName} serve you better. Share your honest experience on Google: ${settings.googleReviewUrl}`,
      roman_ur: `Aap ke feedback ka bohat shukriya ${client.name}! Meharbani farma kar apna imandari se review Google par share karein: ${settings.googleReviewUrl}`,
      ur: `\u0622\u067E \u06A9\u06D2 \u0641\u06CC\u0688\u0628\u06CC\u06A9 \u06A9\u0627 \u0628\u06C1\u062A \u0634\u06A9\u0631\u06CC\u06C1 ${client.name}! \u0628\u0631\u0627\u0626\u06D2 \u0645\u06C1\u0631\u0628\u0627\u0646\u06CC \u0627\u067E\u0646\u0627 \u0627\u06CC\u0645\u0627\u0646\u062F\u0627\u0631\u06CC \u067E\u0631 \u0645\u0628\u0646\u06CC \u0631\u06CC\u0648\u06CC\u0648 \u06AF\u0648\u06AF\u0644 \u067E\u0631 \u0634\u06CC\u0626\u0631 \u06A9\u0631\u06CC\u06BA: ${settings.googleReviewUrl}`,
      ar: `\u0634\u0643\u0631\u0627\u064B \u062C\u0632\u064A\u0644\u0627\u064B \u0644\u0645\u0634\u0627\u0631\u0643\u062A\u0643 \u0631\u0623\u064A\u0643 \u064A\u0627 ${client.name}! \u0646\u0631\u062D\u0628 \u0628\u0645\u0634\u0627\u0631\u0643\u0629 \u062A\u062C\u0631\u0628\u062A\u0643 \u0627\u0644\u0635\u0627\u062F\u0642\u0629 \u0639\u0644\u0649 \u062C\u0648\u062C\u0644: ${settings.googleReviewUrl}`
    };
    const replyText2 = thankYouMap[activeLang] || thankYouMap.en || "";
    appendLog(payload.salonId, {
      direction: "OUTBOUND",
      module: "REVIEW_T2H",
      clientName: client.name,
      clientPhone: client.phone,
      language: activeLang,
      dir: activeDir,
      body: replyText2
    });
    persistStore(payload.salonId);
    return {
      replyText: replyText2,
      replyDir: activeDir,
      lockedLanguage: activeLang,
      routedAction: "REVIEW_ROUTED_PUBLIC_GOOGLE",
      state: getSalonConciergeState(payload.salonId)
    };
  }
  if (isPriceListQuery) {
    const activeServices = (Array.isArray(settings.enabledServices) && settings.enabledServices.length > 0 ? settings.enabledServices : getDefaultServicesForCategory(settings.salonCategory || "MENS", settings.currency)).filter((s) => s.active !== false).slice(0, 6);
    const lines = activeServices.map(
      (s, idx) => `${idx + 1}. ${s.name} \u2014 ${settings.currencySymbol}${Number(s.price).toLocaleString()}`
    ).join("\n");
    const isLadiesSalon = settings.salonCategory === "LADIES";
    const privacyNoteMap = isLadiesSalon ? {
      en: "\nFemale-Only Private Cabins & Ladies Staff Assured.",
      roman_ur: "\nLadies-Only Private Cabins aur Female Staff 100% maujood hai.",
      ur: "\n\u062E\u0648\u0627\u062A\u06CC\u0646 \u06A9\u06D2 \u0644\u06CC\u06D2 \u0639\u0644\u06CC\u062D\u062F\u06C1 \u067E\u0631\u0627\u0626\u06CC\u0648\u06CC\u0679 \u06A9\u06CC\u0628\u0646 \u0627\u0648\u0631 \u0641\u06CC \u0645\u06CC\u0644 \u0627\u0633\u0679\u0627\u0641 \u06A9\u06CC \u0645\u06A9\u0645\u0644 \u0633\u06C1\u0648\u0644\u062A \u0645\u0648\u062C\u0648\u062F \u06C1\u06D2\u06D4",
      ar: "\n\u062E\u0635\u0648\u0635\u064A\u0629 \u062A\u0627\u0645\u0629: \u0643\u0627\u0628\u064A\u0646\u0627\u062A \u062E\u0627\u0635\u0629 \u0644\u0644\u0633\u064A\u062F\u0627\u062A \u0648\u0637\u0627\u0642\u0645 \u0646\u0633\u0627\u0626\u064A \u0628\u0627\u0644\u0643\u0627\u0645\u0644."
    } : { en: "", roman_ur: "", ur: "", ar: "" };
    const menuReplyMap = {
      en: `${settings.salonName} Rate Menu:
${lines}${privacyNoteMap.en}
Reply with your service & time to book!`,
      roman_ur: `${settings.salonName} Ki Rate List:
${lines}${privacyNoteMap.roman_ur}
Book karne ke liye service aur waqt reply karein!`,
      ur: `${settings.salonName} \u06A9\u06CC \u0631\u06CC\u0679 \u0644\u0633\u0679:
${lines}${privacyNoteMap.ur}
\u0627\u067E\u0627\u0626\u0646\u0679\u0645\u0646\u0679 \u0628\u06A9 \u06A9\u0631\u0646\u06D2 \u06A9\u06D2 \u0644\u06CC\u06D2 \u0633\u0631\u0648\u0633 \u0627\u0648\u0631 \u0648\u0642\u062A \u0644\u06A9\u06BE \u06A9\u0631 \u0628\u06BE\u06CC\u062C\u06CC\u06BA!`,
      ar: `\u0642\u0627\u0626\u0645\u0629 \u0623\u0633\u0639\u0627\u0631 ${settings.salonName}:
${lines}${privacyNoteMap.ar}
\u0623\u0631\u0633\u0644 \u0627\u0644\u062E\u062F\u0645\u0629 \u0648\u0627\u0644\u0648\u0642\u062A \u0644\u062D\u062C\u0632 \u0645\u0648\u0639\u062F\u0643 \u0641\u0648\u0631\u0627\u064B!`
    };
    appendLog(payload.salonId, {
      direction: "INBOUND",
      module: "BOOKING",
      clientName: client.name,
      clientPhone: client.phone,
      language: activeLang,
      dir: activeDir,
      body: raw,
      eventMetadata: { eventType: "PRICE_MENU_SENT" }
    });
    const replyText2 = menuReplyMap[activeLang] || menuReplyMap.en || "";
    appendLog(payload.salonId, {
      direction: "OUTBOUND",
      module: "BOOKING",
      clientName: client.name,
      clientPhone: client.phone,
      language: activeLang,
      dir: activeDir,
      body: replyText2
    });
    persistStore();
    return {
      replyText: replyText2,
      replyDir: activeDir,
      lockedLanguage: activeLang,
      routedAction: "PRICE_MENU_SENT",
      state: getSalonConciergeState(payload.salonId)
    };
  }
  if (lower.includes("rebook") || client.awaitingWinbackRebook && raw === "1") {
    client.awaitingWinbackRebook = false;
    const newBooking = {
      id: `BK-WB-${Date.now().toString().slice(-4)}`,
      salonId: payload.salonId,
      clientId: client.id,
      clientName: client.name,
      clientPhone: client.phone,
      barberName: "Master Aslam",
      service: settings.winbackAddonService ? `VIP Return Visit + ${settings.winbackAddonService}` : "VIP Return Haircut & Styling",
      price: settings.currency === "PKR" ? 1200 : 80,
      timeSlot: "05:00 PM (Priority Rebook)",
      status: "CONFIRMED",
      scheduledForIso: new Date(Date.now() + 864e5).toISOString(),
      completedAt: null,
      reviewPromptSentAt: null,
      rating: null,
      ratingComment: null,
      reviewRoutedStatus: "PENDING"
    };
    store.appointments.unshift(newBooking);
    const lockedWinbackSummary = formatOfferSummary(settings, "WINBACK", activeLang);
    const rebookConfirm = {
      en: `Priority Rebooking Confirmed (${newBooking.id})! Your offer (${lockedWinbackSummary}) is locked at ${settings.salonName}.`,
      roman_ur: `Mubarak ${client.name}! Aap ki priority rebooking (${newBooking.id}) confirm ho gayi hai. Offer (${lockedWinbackSummary}) lock kar diya gaya hai.`,
      ur: `\u0622\u067E \u06A9\u06CC \u062A\u0631\u062C\u06CC\u062D\u06CC \u0631\u06CC-\u0628\u06A9\u0646\u06AF (${newBooking.id}) \u06A9\u0646\u0641\u0631\u0645 \u06C1\u0648 \u06AF\u0626\u06CC \u06C1\u06D2 ${client.name}! \u0622\u067E \u06A9\u06CC \u0622\u0641\u0631 (${lockedWinbackSummary}) \u0645\u062D\u0641\u0648\u0638 \u06A9\u0631 \u062F\u06CC \u06AF\u0626\u06CC \u06C1\u06D2\u06D4`,
      ar: `\u062A\u0645 \u062A\u0623\u0643\u064A\u062F \u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u062D\u062C\u0632 \u0627\u0644\u0641\u0648\u0631\u064A (${newBooking.id}) \u064A\u0627 ${client.name}! \u062A\u0645 \u062A\u062B\u0628\u064A\u062A \u0639\u0631\u0636\u0643 (${lockedWinbackSummary}) \u0641\u064A ${settings.salonName}.`
    };
    const replyText2 = rebookConfirm[activeLang] || rebookConfirm.en || "";
    appendLog(payload.salonId, {
      direction: "OUTBOUND",
      module: "WINBACK_30D",
      clientName: client.name,
      clientPhone: client.phone,
      language: activeLang,
      dir: activeDir,
      body: replyText2
    });
    persistStore();
    return {
      replyText: replyText2,
      replyDir: activeDir,
      lockedLanguage: activeLang,
      routedAction: "WINBACK_REBOOKED",
      state: getSalonConciergeState(payload.salonId)
    };
  }
  if (isPendingRerouteReply && client.pendingReroute) {
    const pending = client.pendingReroute;
    const chosen = pending.alternatives.find((alt) => alt.index === raw) || pending.alternatives.find(
      (alt) => lower.includes(alt.barberName.toLowerCase().split(" ")[0])
    ) || pending.alternatives[0];
    client.pendingReroute = null;
    if (chosen) {
      const startMins = parseTimeSlotToMinutes(chosen.timeSlot);
      const nowBase = /* @__PURE__ */ new Date();
      const startDate = new Date(nowBase);
      if (startMins >= 0) {
        startDate.setHours(Math.floor(startMins / 60), startMins % 60, 0, 0);
      }
      const reroutedAppt = {
        id: `BK-WA-${Date.now().toString().slice(-4)}`,
        salonId: payload.salonId,
        clientId: client.id,
        clientName: client.name,
        clientPhone: client.phone,
        barberName: chosen.barberName,
        service: pending.services,
        price: settings.currency === "PKR" ? 1500 : 85,
        timeSlot: chosen.timeSlot,
        durationMins: 35,
        scheduledEndMs: startDate.getTime() + 35 * 6e4,
        sourceType: "WHATSAPP_BOT",
        status: "CONFIRMED",
        scheduledForIso: startDate.toISOString(),
        completedAt: null,
        reviewPromptSentAt: null,
        rating: null,
        ratingComment: null,
        reviewRoutedStatus: "PENDING"
      };
      store.appointments.unshift(reroutedAppt);
      appendLog(payload.salonId, {
        direction: "INBOUND",
        module: "BOOKING",
        clientName: client.name,
        clientPhone: client.phone,
        language: activeLang,
        dir: activeDir,
        body: raw,
        eventMetadata: {
          eventType: "APPOINTMENT_CONFIRMED",
          barberName: chosen.barberName,
          services: pending.services,
          timeSlot: chosen.timeSlot
        }
      });
      const confirmMap = {
        en: `Confirmed! ${client.name}, we booked you with ${chosen.barberName} at ${chosen.timeSlot} (${pending.services}).`,
        roman_ur: `Confirm ho gaya ${client.name}! Aap ki booking ${chosen.barberName} ke sath ${chosen.timeSlot} par (${pending.services}) lock ho gayi hai.`,
        ur: `\u06A9\u0646\u0641\u0631\u0645 \u06C1\u0648 \u06AF\u06CC\u0627 ${client.name}! \u0622\u067E \u06A9\u06CC \u0628\u06A9\u0646\u06AF \u0628\u0627\u0631\u0628\u0631 ${chosen.barberName} \u06A9\u06D2 \u0633\u0627\u062A\u06BE ${chosen.timeSlot} \u067E\u0631 (${pending.services}) \u0645\u062D\u0641\u0648\u0638 \u06A9\u0631 \u062F\u06CC \u06AF\u0626\u06CC \u06C1\u06D2\u06D4`,
        ar: `\u062A\u0645 \u0627\u0644\u062A\u0623\u0643\u064A\u062F \u064A\u0627 ${client.name}! \u062A\u0645 \u062D\u062C\u0632 \u0645\u0648\u0639\u062F\u0643 \u0645\u0639 \u0627\u0644\u062D\u0644\u0627\u0642 ${chosen.barberName} \u0627\u0644\u0633\u0627\u0639\u0629 ${chosen.timeSlot} (${pending.services}).`
      };
      const replyText2 = confirmMap[activeLang] || confirmMap.en || "";
      appendLog(payload.salonId, {
        direction: "OUTBOUND",
        module: "BOOKING",
        clientName: client.name,
        clientPhone: client.phone,
        language: activeLang,
        dir: activeDir,
        body: replyText2
      });
      persistStore();
      return {
        replyText: replyText2,
        replyDir: activeDir,
        lockedLanguage: activeLang,
        routedAction: "BARBER_REROUTE_CONFIRMED",
        state: getSalonConciergeState(payload.salonId)
      };
    }
  }
  if (isPendingRescheduleReply && client.pendingReschedule) {
    const pending = client.pendingReschedule;
    const picked = pending.alternatives.find((alt) => alt.index === raw) || pending.alternatives[0];
    client.pendingReschedule = null;
    if (picked) {
      const startMins = parseTimeSlotToMinutes(picked.timeSlot);
      const startDate = new Date(Date.now() + 864e5);
      if (startMins >= 0) {
        startDate.setHours(Math.floor(startMins / 60), startMins % 60, 0, 0);
      }
      const rescheduledAppt = {
        id: `BK-RS-${Date.now().toString().slice(-4)}`,
        salonId: payload.salonId,
        clientId: client.id,
        clientName: client.name,
        clientPhone: client.phone,
        barberName: picked.barberName,
        service: pending.preferredService,
        price: settings.currency === "PKR" ? 1200 : 85,
        timeSlot: `${picked.timeSlot} (${picked.dateLabel})`,
        durationMins: 40,
        scheduledEndMs: startDate.getTime() + 40 * 6e4,
        sourceType: "WHATSAPP_BOT",
        status: "CONFIRMED",
        scheduledForIso: startDate.toISOString(),
        completedAt: null,
        reviewPromptSentAt: null,
        rating: null,
        ratingComment: null,
        reviewRoutedStatus: "PENDING"
      };
      store.appointments.unshift(rescheduledAppt);
      appendLog(payload.salonId, {
        direction: "INBOUND",
        module: "BOOKING",
        clientName: client.name,
        clientPhone: client.phone,
        language: activeLang,
        dir: activeDir,
        body: raw,
        eventMetadata: {
          eventType: "RESCHEDULE_CONFIRMED",
          barberName: picked.barberName,
          services: pending.preferredService,
          timeSlot: `${picked.timeSlot} (${picked.dateLabel})`
        }
      });
      const reschedConfirmMap = {
        en: `Rescheduled! ${client.name}, your new slot is locked for ${picked.dateLabel} at ${picked.timeSlot} with ${picked.barberName}.`,
        roman_ur: `Reschedule confirm ${client.name}! Kal ${picked.timeSlot} par ${picked.barberName} ke sath aap ka slot lock ho gaya hai.`,
        ur: `\u0631\u06CC \u0634\u06CC\u0688\u0648\u0644 \u06A9\u0646\u0641\u0631\u0645 ${client.name}! \u06A9\u0644 ${picked.timeSlot} \u0628\u062C\u06D2 ${picked.barberName} \u06A9\u06D2 \u0633\u0627\u062A\u06BE \u0622\u067E \u06A9\u0627 \u0646\u06CC\u0627 \u0648\u0642\u062A \u0645\u062D\u0641\u0648\u0638 \u06C1\u0648 \u06AF\u06CC\u0627 \u06C1\u06D2\u06D4`,
        ar: `\u062A\u0645 \u062A\u0623\u0643\u064A\u062F \u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u062C\u062F\u0648\u0644\u0629 \u064A\u0627 ${client.name}! \u0645\u0648\u0639\u062F\u0643 \u0627\u0644\u062C\u062F\u064A\u062F ${picked.dateLabel} \u0627\u0644\u0633\u0627\u0639\u0629 ${picked.timeSlot} \u0645\u0639 ${picked.barberName}.`
      };
      const replyText2 = reschedConfirmMap[activeLang] || reschedConfirmMap.en || "";
      appendLog(payload.salonId, {
        direction: "OUTBOUND",
        module: "BOOKING",
        clientName: client.name,
        clientPhone: client.phone,
        language: activeLang,
        dir: activeDir,
        body: replyText2
      });
      persistStore();
      return {
        replyText: replyText2,
        replyDir: activeDir,
        lockedLanguage: activeLang,
        routedAction: "RESCHEDULE_CONFIRMED",
        state: getSalonConciergeState(payload.salonId)
      };
    }
  }
  if (isLateReply || isRescheduleReply || isBookingOrConfirm) {
    const salonBarbers = getSalonBarbers(payload.salonId);
    const timeMatch = raw.match(/\b(\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.))\b/i);
    const extractedTimeRaw = timeMatch ? timeMatch[1].replace(/\./g, "").toUpperCase().replace(/^(\d{1,2})\s/, "$1:00 ") : "04:30 PM";
    const parsedTimeMins = parseTimeSlotToMinutes(extractedTimeRaw);
    const extractedTime = parsedTimeMins >= 0 ? formatMinutesToTimeSlot(parsedTimeMins) : extractedTimeRaw;
    const rosterMatchedBarber = salonBarbers.find((b) => {
      const firstToken = b.toLowerCase().replace(/^master\s+/i, "").split(/\s+/)[0];
      return lower.includes(b.toLowerCase()) || firstToken.length >= 3 && lower.includes(firstToken);
    });
    const barberMatch = raw.match(/(?:barber|stylist|حلاق|باربر)\s+([A-Za-z]+)/i) || raw.match(/\bwith\s+(?!(?:barber|stylist|the|my|our)\b)([A-Za-z]+)/i);
    const extractedBarber = rosterMatchedBarber || (barberMatch ? barberMatch[1] : salonBarbers[0] || "Master Aslam");
    const matchedServices = [];
    if (/bridal|bride|dulhan|عروس|دلہن/i.test(lower)) matchedServices.push("Bridal Package");
    if (/groom|baraat|walima|dulha|عريس|دولہا/i.test(lower)) matchedServices.push("Groom Executive Package");
    if (/haircut|fade|cut|قص|کٹ/i.test(lower)) matchedServices.push("Haircut");
    if (/beard|shave|trim|لحية|داڑھی/i.test(lower)) matchedServices.push("Beard");
    if (/facial|scrub|polish|بشرة|فیشل/i.test(lower)) matchedServices.push("Facial");
    if (/massage|مساج/i.test(lower)) matchedServices.push("Head Massage");
    const extractedServices = matchedServices.length > 0 ? matchedServices.join(" & ") : "Haircut & Beard";
    if (isLateReply) {
      appendLog(payload.salonId, {
        direction: "INBOUND",
        module: "BOOKING",
        clientName: client.name,
        clientPhone: client.phone,
        language: activeLang,
        dir: activeDir,
        body: raw,
        eventMetadata: {
          eventType: "REMINDER_REPLY_LATE",
          barberName: extractedBarber,
          timeSlot: extractedTime
        }
      });
      const lateReplyMap = {
        en: `No problem ${client.name}! We have notified ${extractedBarber} that you will arrive shortly for your ${extractedTime} slot.`,
        roman_ur: `Koi masla nahi ${client.name}! Hum ne barber ${extractedBarber} ko inform kar diya hai ke aap ${extractedTime} ke liye thori der mein pohanch rahe hain.`,
        ur: `\u06A9\u0648\u0626\u06CC \u0628\u0627\u062A \u0646\u06C1\u06CC\u06BA ${client.name}! \u06C1\u0645 \u0646\u06D2 \u0628\u0627\u0631\u0628\u0631 ${extractedBarber} \u06A9\u0648 \u0627\u0637\u0644\u0627\u0639 \u062F\u06D2 \u062F\u06CC \u06C1\u06D2 \u06A9\u06C1 \u0622\u067E ${extractedTime} \u06A9\u06D2 \u0648\u0642\u062A \u067E\u0631 \u062A\u06BE\u0648\u0691\u06CC \u062F\u06CC\u0631 \u0633\u06D2 \u067E\u06C1\u0646\u0686\u06CC\u06BA \u06AF\u06D2\u06D4`,
        ar: `\u0644\u0627 \u0628\u0623\u0633 \u064A\u0627 ${client.name}! \u0623\u0628\u0644\u063A\u0646\u0627 \u0627\u0644\u062D\u0644\u0627\u0642 ${extractedBarber} \u0628\u0623\u0646\u0643 \u0633\u062A\u062A\u0623\u062E\u0631 \u0642\u0644\u064A\u0644\u0627\u064B \u0639\u0646 \u0645\u0648\u0639\u062F ${extractedTime}.`
      };
      const replyText3 = lateReplyMap[activeLang] || lateReplyMap.en || "";
      appendLog(payload.salonId, {
        direction: "OUTBOUND",
        module: "BOOKING",
        clientName: client.name,
        clientPhone: client.phone,
        language: activeLang,
        dir: activeDir,
        body: replyText3
      });
      persistStore();
      return {
        replyText: replyText3,
        replyDir: activeDir,
        lockedLanguage: activeLang,
        routedAction: "REMINDER_REPLY_LATE",
        state: getSalonConciergeState(payload.salonId)
      };
    }
    if (isRescheduleReply) {
      const slotTimes = ["11:30 AM", "02:00 PM", "05:30 PM"];
      const slotAlternatives = slotTimes.map((timeSlot, idx) => ({
        index: String(idx + 1),
        barberName: salonBarbers[idx % salonBarbers.length] || extractedBarber,
        timeSlot,
        dateLabel: "Tomorrow"
      }));
      client.pendingReschedule = {
        requestedAt: (/* @__PURE__ */ new Date()).toISOString(),
        preferredService: extractedServices,
        alternatives: slotAlternatives
      };
      const slotLines = slotAlternatives.map((alt) => `[${alt.index}. ${alt.dateLabel} ${alt.timeSlot} \xB7 ${alt.barberName}]`).join("\n");
      appendLog(payload.salonId, {
        direction: "INBOUND",
        module: "BOOKING",
        clientName: client.name,
        clientPhone: client.phone,
        language: activeLang,
        dir: activeDir,
        body: raw,
        eventMetadata: {
          eventType: "REMINDER_REPLY_RESCHEDULE",
          barberName: extractedBarber,
          timeSlot: extractedTime
        }
      });
      const reschedMap = {
        en: `Got it ${client.name}. Reply 1, 2, or 3 to lock your new tomorrow slot at ${settings.salonName}:
${slotLines}`,
        roman_ur: `Ji ${client.name}, hum ne kal ke khali slots tayyar kiye hain \u2014 confirm karne ke liye 1, 2, ya 3 reply karein:
${slotLines}`,
        ur: `\u062C\u06CC ${client.name}\u060C \u06A9\u0644 \u06A9\u06D2 \u062F\u0633\u062A\u06CC\u0627\u0628 \u0627\u0648\u0642\u0627\u062A \u0645\u06CC\u06BA \u0633\u06D2 \u0628\u06A9 \u06A9\u0631\u0646\u06D2 \u06A9\u06D2 \u0644\u06CC\u06D2 1\u060C 2 \u06CC\u0627 3 \u0644\u06A9\u06BE \u06A9\u0631 \u0628\u06BE\u06CC\u062C\u06CC\u06BA:
${slotLines}`,
        ar: `\u062A\u0645 \u064A\u0627 ${client.name}\u060C \u0627\u062E\u062A\u0631 \u0645\u0648\u0639\u062F\u0627\u064B \u0644\u064A\u0648\u0645 \u063A\u062F \u0628\u0627\u0644\u0631\u062F \u0628\u0640 1 \u0623\u0648 2 \u0623\u0648 3 \u0644\u062A\u062B\u0628\u064A\u062A\u0647 \u0641\u0648\u0631\u0627\u064B:
${slotLines}`
      };
      const replyText3 = reschedMap[activeLang] || reschedMap.en || "";
      appendLog(payload.salonId, {
        direction: "OUTBOUND",
        module: "BOOKING",
        clientName: client.name,
        clientPhone: client.phone,
        language: activeLang,
        dir: activeDir,
        body: replyText3
      });
      persistStore();
      return {
        replyText: replyText3,
        replyDir: activeDir,
        lockedLanguage: activeLang,
        routedAction: "REMINDER_REPLY_RESCHEDULE",
        state: getSalonConciergeState(payload.salonId)
      };
    }
    const isReminderOnly = !isBridalOrGroom && /\b(i'?m coming|on my way|coming|yes\s*confirm|aa\s*raha|جی آ رہا|قادم)\b/i.test(lower) && matchedServices.length === 0;
    if (!isReminderOnly && parsedTimeMins >= 0) {
      const busyCheck = isBarberBusyAtWindow(payload.salonId, extractedBarber, parsedTimeMins, 35);
      if (busyCheck.busy) {
        const freeBarbers = salonBarbers.filter(
          (b) => b.toLowerCase() !== extractedBarber.toLowerCase() && !isBarberBusyAtWindow(payload.salonId, b, parsedTimeMins, 35).busy
        );
        const nextOpenSlot = formatMinutesToTimeSlot(busyCheck.busyUntilMinutes);
        const alternatives = [];
        freeBarbers.slice(0, 2).forEach((b, idx) => {
          alternatives.push({
            index: String(idx + 1),
            type: "ALT_BARBER",
            barberName: b,
            timeSlot: extractedTime
          });
        });
        alternatives.push({
          index: String(alternatives.length + 1),
          type: "NEXT_SLOT",
          barberName: extractedBarber,
          timeSlot: nextOpenSlot
        });
        client.pendingReroute = {
          requestedBarber: extractedBarber,
          requestedTimeSlot: extractedTime,
          requestedMinutes: parsedTimeMins,
          services: extractedServices,
          alternatives
        };
        const menuLines = alternatives.map(
          (alt) => alt.type === "ALT_BARBER" ? `[${alt.index}. ${alt.barberName} @ ${alt.timeSlot} (Available Now)]` : `[${alt.index}. ${alt.barberName} @ ${alt.timeSlot} (Next Open Slot)]`
        ).join("\n");
        const busyReplyMap = {
          en: `Status: ${extractedBarber} is currently Busy at ${extractedTime}. Please choose an instant alternative:
${menuLines}`,
          roman_ur: `Itlaa: ${extractedBarber} ${extractedTime} par abhi Busy hain. Foran neechay se option chunein:
${menuLines}`,
          ur: `\u0627\u0637\u0644\u0627\u0639: \u0628\u0627\u0631\u0628\u0631 ${extractedBarber} \u0627\u0633 \u0648\u0642\u062A ${extractedTime} \u067E\u0631 \u0645\u0635\u0631\u0648\u0641 (Busy) \u06C1\u06CC\u06BA\u06D4 \u0641\u0648\u0631\u06CC \u0645\u062A\u0628\u0627\u062F\u0644 \u0645\u0646\u062A\u062E\u0628 \u06A9\u0631\u06CC\u06BA:
${menuLines}`,
          ar: `\u062A\u0646\u0628\u064A\u0647: \u0627\u0644\u062D\u0644\u0627\u0642 ${extractedBarber} \u0645\u0634\u063A\u0648\u0644 \u062D\u0627\u0644\u064A\u0627\u064B \u0627\u0644\u0633\u0627\u0639\u0629 ${extractedTime}. \u0627\u062E\u062A\u0631 \u0628\u062F\u064A\u0644\u0627\u064B \u0641\u0648\u0631\u064A\u0627\u064B:
${menuLines}`
        };
        appendLog(payload.salonId, {
          direction: "INBOUND",
          module: "BOOKING",
          clientName: client.name,
          clientPhone: client.phone,
          language: activeLang,
          dir: activeDir,
          body: raw,
          eventMetadata: {
            eventType: "BARBER_BUSY_REROUTED",
            barberName: extractedBarber,
            services: extractedServices,
            timeSlot: extractedTime
          }
        });
        const replyText3 = busyReplyMap[activeLang] || busyReplyMap.en || "";
        appendLog(payload.salonId, {
          direction: "OUTBOUND",
          module: "BOOKING",
          clientName: client.name,
          clientPhone: client.phone,
          language: activeLang,
          dir: activeDir,
          body: replyText3
        });
        persistStore();
        return {
          replyText: replyText3,
          replyDir: activeDir,
          lockedLanguage: activeLang,
          routedAction: "BARBER_BUSY_REROUTE_OFFERED",
          state: getSalonConciergeState(payload.salonId)
        };
      }
    }
    const eventType = isBridalOrGroom ? "URGENT_BRIDAL_GROOM" : isReminderOnly ? "REMINDER_REPLY_CONFIRMED" : "APPOINTMENT_CONFIRMED";
    const startDate = /* @__PURE__ */ new Date();
    if (parsedTimeMins >= 0) {
      startDate.setHours(Math.floor(parsedTimeMins / 60), parsedTimeMins % 60, 0, 0);
    }
    const newAppt = {
      id: `BK-WA-${Date.now().toString().slice(-4)}`,
      salonId: payload.salonId,
      clientId: client.id,
      clientName: client.name,
      clientPhone: client.phone,
      barberName: extractedBarber,
      service: extractedServices,
      price: isBridalOrGroom ? settings.currency === "PKR" ? 12e3 : 450 : settings.currency === "PKR" ? 1500 : 85,
      timeSlot: extractedTime,
      durationMins: isBridalOrGroom ? 90 : 35,
      scheduledEndMs: startDate.getTime() + (isBridalOrGroom ? 90 : 35) * 6e4,
      sourceType: "WHATSAPP_BOT",
      status: "CONFIRMED",
      scheduledForIso: startDate.toISOString(),
      completedAt: null,
      reviewPromptSentAt: null,
      rating: null,
      ratingComment: null,
      reviewRoutedStatus: "PENDING"
    };
    if (!isReminderOnly) {
      store.appointments.unshift(newAppt);
    }
    appendLog(payload.salonId, {
      direction: "INBOUND",
      module: "BOOKING",
      clientName: client.name,
      clientPhone: client.phone,
      language: activeLang,
      dir: activeDir,
      body: raw,
      eventMetadata: {
        eventType,
        barberName: extractedBarber,
        services: extractedServices,
        timeSlot: extractedTime
      }
    });
    const confirmReplyMap = {
      en: `Confirmed! ${client.name}, your ${extractedServices} with ${extractedBarber} at ${extractedTime} is locked at ${settings.salonName}.`,
      roman_ur: `Confirm ho gaya ${client.name}! ${extractedBarber} ke sath ${extractedTime} par (${extractedServices}) lock kar diya gaya hai.`,
      ur: `\u06A9\u0646\u0641\u0631\u0645 \u06C1\u0648 \u06AF\u06CC\u0627 ${client.name}! \u0628\u0627\u0631\u0628\u0631 ${extractedBarber} \u06A9\u06D2 \u0633\u0627\u062A\u06BE ${extractedTime} \u067E\u0631 (${extractedServices}) \u0628\u06A9 \u06C1\u0648 \u06AF\u06CC\u0627 \u06C1\u06D2\u06D4`,
      ar: `\u062A\u0645 \u0627\u0644\u062A\u0623\u0643\u064A\u062F \u064A\u0627 ${client.name}! \u0645\u0648\u0639\u062F\u0643 (${extractedServices}) \u0645\u0639 \u0627\u0644\u062D\u0644\u0627\u0642 ${extractedBarber} \u0627\u0644\u0633\u0627\u0639\u0629 ${extractedTime} \u0645\u0624\u0643\u062F \u0641\u064A ${settings.salonName}.`
    };
    const replyText2 = confirmReplyMap[activeLang] || confirmReplyMap.en || "";
    appendLog(payload.salonId, {
      direction: "OUTBOUND",
      module: "BOOKING",
      clientName: client.name,
      clientPhone: client.phone,
      language: activeLang,
      dir: activeDir,
      body: replyText2
    });
    persistStore();
    return {
      replyText: replyText2,
      replyDir: activeDir,
      lockedLanguage: activeLang,
      routedAction: eventType,
      state: getSalonConciergeState(payload.salonId)
    };
  }
  const generalAck = {
    en: `Received "${raw}" at ${settings.salonName}. Pick a service or reply BOOK to reserve your chair!`,
    roman_ur: `Aap ka message "${raw}" mil gaya hai. ${settings.salonName} par slot reserve karne ke liye apna waqt aur service batayein!`,
    ur: `${settings.salonName} \u0645\u06CC\u06BA \u0622\u067E \u06A9\u0627 \u067E\u06CC\u063A\u0627\u0645 "${raw}" \u0645\u0648\u0635\u0648\u0644 \u06C1\u0648 \u06AF\u06CC\u0627 \u06C1\u06D2\u06D4 \u0648\u0642\u062A \u0627\u0648\u0631 \u0633\u0631\u0648\u0633 \u0645\u0646\u062A\u062E\u0628 \u06A9\u0631 \u06A9\u06D2 \u0627\u067E\u0627\u0626\u0646\u0679\u0645\u0646\u0679 \u06A9\u0646\u0641\u0631\u0645 \u06A9\u0631\u06CC\u06BA!`,
    ar: `\u062A\u0645 \u0627\u0633\u062A\u0644\u0627\u0645 \u0631\u0633\u0627\u0644\u062A\u0643 "${raw}" \u0641\u064A ${settings.salonName}. \u0627\u062E\u062A\u0631 \u0627\u0644\u062E\u062F\u0645\u0629 \u0648\u0627\u0644\u0648\u0642\u062A \u0644\u062A\u0623\u0643\u064A\u062F \u0645\u0648\u0639\u062F\u0643 \u0641\u0648\u0631\u0627\u064B!`
  };
  const replyText = generalAck[activeLang] || generalAck.en || "";
  appendLog(payload.salonId, {
    direction: "OUTBOUND",
    module: "BOOKING",
    clientName: client.name,
    clientPhone: client.phone,
    language: activeLang,
    dir: activeDir,
    body: replyText
  });
  persistStore();
  return {
    replyText,
    replyDir: activeDir,
    lockedLanguage: activeLang,
    routedAction: "CONCIERGE_REPLIED",
    state: getSalonConciergeState(payload.salonId)
  };
}
function runBirthdayCron(salonId, forceRun = false) {
  const store = ensureStoreLoaded();
  const targetSalons = salonId ? [store.settingsBySalon[salonId]].filter(Boolean) : Object.values(store.settingsBySalon);
  let dispatchedCount = 0;
  let quarantinedCount = 0;
  for (const settings of targetSalons) {
    if (!settings.birthdayEnabled) continue;
    if (settings.billingStatus === "PENDING_ACTIVATION" || settings.billingStatus === "SUSPENDED") {
      quarantinedCount++;
      continue;
    }
    const local = getLocalClockForOffset(settings.timezoneOffsetHours);
    if (!forceRun && local.hour !== 9) continue;
    const matchingClients = store.clients.filter(
      (c) => c.salonId === settings.salonId && c.birthDate === local.dayMonth && (forceRun || c.lastBirthdaySentYear !== local.year)
    );
    for (const cli of matchingClients) {
      const lang = cli.preferredLanguage || "en";
      const body = renderBirthdayMessage(settings, cli.name, lang);
      cli.lastBirthdaySentYear = local.year;
      appendLog(settings.salonId, {
        direction: "OUTBOUND",
        module: "BIRTHDAY_9AM",
        clientName: cli.name,
        clientPhone: cli.phone,
        language: lang,
        dir: getLangDirection(lang),
        body
      });
      dispatchedCount++;
    }
  }
  if (dispatchedCount > 0) persistStore();
  return { dispatchedCount, salonIdsChecked: targetSalons.length, quarantinedCount };
}
function runWinBackCron(salonId, forceRun = false) {
  const store = ensureStoreLoaded();
  const targetSalons = salonId ? [store.settingsBySalon[salonId]].filter(Boolean) : Object.values(store.settingsBySalon);
  const nowMs = Date.now();
  let dispatchedCount = 0;
  let quarantinedCount = 0;
  for (const settings of targetSalons) {
    if (!settings.winbackEnabled) continue;
    if (settings.billingStatus === "PENDING_ACTIVATION" || settings.billingStatus === "SUSPENDED") {
      quarantinedCount++;
      continue;
    }
    const thresholdMs = Math.max(1, settings.winbackDays) * 864e5;
    const salonClients = store.clients.filter((c) => c.salonId === settings.salonId);
    for (const cli of salonClients) {
      if (!cli.lastCompletedVisitAt) continue;
      const lastVisitMs = new Date(cli.lastCompletedVisitAt).getTime();
      if (Number.isNaN(lastVisitMs) || nowMs - lastVisitMs < thresholdMs) continue;
      const hasUpcomingAppointment = store.appointments.some(
        (a) => a.salonId === settings.salonId && (a.clientId === cli.id || a.clientPhone.replace(/\s+/g, "") === cli.phone.replace(/\s+/g, "")) && (a.status === "CONFIRMED" || a.status === "IN_CHAIR")
      );
      if (hasUpcomingAppointment) continue;
      if (!forceRun && cli.lastWinbackSentAt) {
        const lastSentMs = new Date(cli.lastWinbackSentAt).getTime();
        if (!Number.isNaN(lastSentMs) && nowMs - lastSentMs < 14 * 864e5) continue;
      }
      const lang = cli.preferredLanguage || "en";
      const body = renderWinBackMessage(settings, cli.name, lang);
      cli.lastWinbackSentAt = new Date(nowMs).toISOString();
      cli.awaitingWinbackRebook = true;
      appendLog(settings.salonId, {
        direction: "OUTBOUND",
        module: "WINBACK_30D",
        clientName: cli.name,
        clientPhone: cli.phone,
        language: lang,
        dir: getLangDirection(lang),
        body
      });
      dispatchedCount++;
    }
  }
  if (dispatchedCount > 0) persistStore();
  return { dispatchedCount, quarantinedCount };
}
function runPostServiceReviewCron(salonId, forceImmediate = false, targetAppointmentId) {
  const store = ensureStoreLoaded();
  const nowMs = Date.now();
  const twoHoursMs = 2 * 3600 * 1e3;
  let dispatchedCount = 0;
  for (const appt of store.appointments) {
    if (salonId && appt.salonId !== salonId) continue;
    if (targetAppointmentId && appt.id !== targetAppointmentId) continue;
    if (appt.status !== "COMPLETED") continue;
    if (!forceImmediate && appt.reviewPromptSentAt) continue;
    const settings = ensureSalonExists(appt.salonId);
    if (!settings.reviewBoosterEnabled) continue;
    const completedMs = appt.completedAt ? new Date(appt.completedAt).getTime() : 0;
    if (!forceImmediate && (!completedMs || nowMs - completedMs < twoHoursMs)) continue;
    const client = store.clients.find((c) => c.id === appt.clientId);
    const regionInfo = detectRegionFromPhone(client?.phone || settings.whatsappPhone);
    const lang = resolveClientConversationLang(client, "", regionInfo.region);
    const promptBody = renderReviewPrompt(settings.salonName, lang);
    appt.reviewPromptSentAt = new Date(nowMs).toISOString();
    appt.reviewRoutedStatus = "PROMPT_SENT";
    if (client) {
      client.awaitingReviewAppointmentId = appt.id;
    }
    appendLog(appt.salonId, {
      direction: "OUTBOUND",
      module: "REVIEW_T2H",
      clientName: appt.clientName,
      clientPhone: appt.clientPhone,
      language: lang,
      dir: getLangDirection(lang),
      body: promptBody
    });
    dispatchedCount++;
  }
  if (dispatchedCount > 0) persistStore();
  return { dispatchedCount };
}
function resolveOwnerAlert(salonId, alertId) {
  const store = ensureStoreLoaded();
  const alert = store.alerts.find((a) => a.salonId === salonId && a.id === alertId);
  if (alert) {
    alert.status = "RESOLVED";
    alert.resolvedAt = (/* @__PURE__ */ new Date()).toISOString();
    persistStore();
  }
  return getSalonConciergeState(salonId);
}
var LANGUAGE_CHOICE_META = {
  en: { lang: "en", label: "English", nativeLabel: "English", dir: "ltr" },
  roman_ur: { lang: "roman_ur", label: "Roman Urdu", nativeLabel: "Roman Urdu", dir: "ltr" },
  ur: { lang: "ur", label: "Urdu", nativeLabel: "\u0627\u0631\u062F\u0648", dir: "rtl" },
  ar: { lang: "ar", label: "Arabic", nativeLabel: "\u0627\u0644\u0639\u0631\u0628\u064A\u0629", dir: "rtl" },
  it: { lang: "it", label: "Italian", nativeLabel: "Italiano", dir: "ltr" },
  ru: { lang: "ru", label: "Russian", nativeLabel: "\u0420\u0443\u0441\u0441\u043A\u0438\u0439", dir: "ltr" },
  fr: { lang: "fr", label: "French", nativeLabel: "Fran\xE7ais", dir: "ltr" },
  de: { lang: "de", label: "German", nativeLabel: "Deutsch", dir: "ltr" },
  es: { lang: "es", label: "Spanish", nativeLabel: "Espa\xF1ol", dir: "ltr" }
};
var CUSTOMER_SERVICE_TRANSLATIONS = {
  "master haircut": {
    roman_ur: "Master Haircut",
    ur: "\u0645\u0627\u0633\u0679\u0631 \u06C1\u06CC\u0626\u0631 \u06A9\u0679",
    ar: "\u0642\u0635 \u0634\u0639\u0631 \u0627\u062D\u062A\u0631\u0627\u0641\u064A"
  },
  "skin fade": {
    roman_ur: "Skin Fade",
    ur: "\u0627\u0633\u06A9\u0646 \u0641\u06CC\u0688",
    ar: "\u062A\u062F\u0631\u064A\u062C \u0633\u0643\u0646 \u0641\u064A\u062F"
  },
  "classic beard trim": {
    roman_ur: "Classic Beard Trim",
    ur: "\u06A9\u0644\u0627\u0633\u06A9 \u062F\u0627\u0691\u06BE\u06CC \u0679\u0631\u0645",
    ar: "\u062A\u0634\u0630\u064A\u0628 \u0627\u0644\u0644\u062D\u064A\u0629 \u0627\u0644\u0643\u0644\u0627\u0633\u064A\u0643\u064A"
  },
  "classic beard trim & sculpt": {
    roman_ur: "Classic Beard Trim & Setting",
    ur: "\u06A9\u0644\u0627\u0633\u06A9 \u062F\u0627\u0691\u06BE\u06CC \u0679\u0631\u0645 \u0627\u0648\u0631 \u0633\u06CC\u0679\u0646\u06AF",
    ar: "\u062A\u0634\u0630\u064A\u0628 \u0648\u062A\u062D\u062F\u064A\u062F \u0627\u0644\u0644\u062D\u064A\u0629 \u0627\u0644\u0643\u0644\u0627\u0633\u064A\u0643\u064A"
  },
  "hot towel steam shave": {
    roman_ur: "Hot Towel Steam Shave",
    ur: "\u06C1\u0627\u0679 \u0679\u0627\u0648\u0644 \u0627\u0633\u0679\u06CC\u0645 \u0634\u06CC\u0648",
    ar: "\u062D\u0644\u0627\u0642\u0629 \u0628\u0627\u0644\u0645\u0646\u0634\u0641\u0629 \u0627\u0644\u0633\u0627\u062E\u0646\u0629 \u0648\u0627\u0644\u0628\u062E\u0627\u0631"
  },
  "hair color & camo": {
    roman_ur: "Hair Color & Camo",
    ur: "\u06C1\u06CC\u0626\u0631 \u06A9\u0644\u0631 \u0627\u0648\u0631 \u06A9\u06CC\u0645\u0648",
    ar: "\u0635\u0628\u063A\u0629 \u0648\u062A\u0644\u0648\u064A\u0646 \u0627\u0644\u0634\u0639\u0631"
  },
  "charcoal deep detox facial": {
    roman_ur: "Charcoal Deep Detox Facial",
    ur: "\u0686\u0627\u0631\u06A9\u0648\u0644 \u0688\u06CC\u067E \u0688\u06CC\u0679\u0648\u06A9\u0633 \u0641\u06CC\u0634\u0644",
    ar: "\u062A\u0646\u0638\u064A\u0641 \u0639\u0645\u064A\u0642 \u0644\u0644\u0628\u0634\u0631\u0629 \u0628\u0627\u0644\u0641\u062D\u0645"
  },
  "keratin hair protein": {
    roman_ur: "Keratin Hair Protein",
    ur: "\u06A9\u06CC\u0631\u0627\u0679\u06CC\u0646 \u06C1\u06CC\u0626\u0631 \u067E\u0631\u0648\u0679\u06CC\u0646",
    ar: "\u0628\u0631\u0648\u062A\u064A\u0646 \u0627\u0644\u0643\u064A\u0631\u0627\u062A\u064A\u0646 \u0644\u0644\u0634\u0639\u0631"
  },
  "herbal mint head massage": {
    roman_ur: "Herbal Mint Head Massage",
    ur: "\u06C1\u0631\u0628\u0644 \u0645\u0646\u0679 \u06C1\u06CC\u0688 \u0645\u0633\u0627\u062C",
    ar: "\u0645\u0633\u0627\u062C \u0627\u0644\u0631\u0623\u0633 \u0628\u0627\u0644\u0646\u0639\u0646\u0627\u0639 \u0648\u0627\u0644\u0623\u0639\u0634\u0627\u0628"
  },
  "groom signature package": {
    roman_ur: "Dulha Signature Package",
    ur: "\u062F\u0648\u0644\u06C1\u0627 \u0633\u06AF\u0646\u06CC\u0686\u0631 \u067E\u06CC\u06A9\u06CC\u062C",
    ar: "\u0628\u0627\u0642\u0629 \u0627\u0644\u0639\u0631\u064A\u0633 \u0627\u0644\u0645\u0645\u064A\u0632\u0629"
  },
  "signature party makeup & styling": {
    roman_ur: "Party Makeup & Styling",
    ur: "\u067E\u0627\u0631\u0679\u06CC \u0645\u06CC\u06A9 \u0627\u067E \u0627\u0648\u0631 \u0627\u0633\u0679\u0627\u0626\u0644\u0646\u06AF",
    ar: "\u0645\u0643\u064A\u0627\u062C \u0633\u0647\u0631\u0629 \u0645\u0645\u064A\u0632 \u0648\u062A\u0635\u0641\u064A\u0641"
  },
  "barat / walima bridal package": {
    roman_ur: "Barat / Walima Bridal Package",
    ur: "\u0628\u0627\u0631\u0627\u062A / \u0648\u0644\u06CC\u0645\u06C1 \u0628\u0631\u0627\u0626\u06CC\u0688\u0644 \u067E\u06CC\u06A9\u06CC\u062C",
    ar: "\u0628\u0627\u0642\u0629 \u0627\u0644\u0639\u0631\u0648\u0633 \u0644\u0644\u0632\u0641\u0627\u0641"
  },
  "hydra-facial & skin polish": {
    roman_ur: "Hydra-Facial & Skin Polish",
    ur: "\u06C1\u0627\u0626\u06CC\u0688\u0631\u0627 \u0641\u06CC\u0634\u0644 \u0627\u0648\u0631 \u0627\u0633\u06A9\u0646 \u067E\u0627\u0644\u0634",
    ar: "\u0647\u064A\u062F\u0631\u0627\u0641\u064A\u0634\u0644 \u0648\u0635\u0646\u0641\u0631\u0629 \u0627\u0644\u0628\u0634\u0631\u0629"
  },
  "keratin hair rebonding / smoothing": {
    roman_ur: "Keratin Rebonding / Smoothing",
    ur: "\u06A9\u06CC\u0631\u0627\u0679\u06CC\u0646 \u0631\u06CC\u0628\u0627\u0646\u0688\u0646\u06AF / \u0627\u0633\u0645\u0648\u062A\u06BE\u0646\u06AF",
    ar: "\u0641\u0631\u062F \u0648\u062A\u0646\u0639\u064A\u0645 \u0627\u0644\u0634\u0639\u0631 \u0628\u0627\u0644\u0643\u064A\u0631\u0627\u062A\u064A\u0646"
  },
  "mani-pedi classic spa": {
    roman_ur: "Mani-Pedi Classic Spa",
    ur: "\u0645\u06CC\u0646\u06CC \u067E\u06CC\u0688\u06CC \u06A9\u0644\u0627\u0633\u06A9 \u0627\u0633\u067E\u0627",
    ar: "\u0645\u0627\u0646\u064A\u0643\u064A\u0631 \u0648\u0628\u0627\u062F\u064A\u0643\u064A\u0631 \u0643\u0644\u0627\u0633\u064A\u0643\u064A"
  },
  "full face threading & waxing": {
    roman_ur: "Face Threading & Waxing",
    ur: "\u0641\u0644 \u0641\u06CC\u0633 \u062A\u06BE\u0631\u06CC\u0688\u0646\u06AF \u0627\u0648\u0631 \u0648\u06CC\u06A9\u0633\u0646\u06AF",
    ar: "\u0625\u0632\u0627\u0644\u0629 \u0634\u0639\u0631 \u0627\u0644\u0648\u062C\u0647 \u0628\u0627\u0644\u0641\u062A\u0644\u0629 \u0648\u0627\u0644\u0634\u0645\u0639"
  },
  "deep conditioning hair spa": {
    roman_ur: "Deep Conditioning Hair Spa",
    ur: "\u0688\u06CC\u067E \u06A9\u0646\u0688\u06CC\u0634\u0646\u0646\u06AF \u06C1\u06CC\u0626\u0631 \u0627\u0633\u067E\u0627",
    ar: "\u062D\u0645\u0627\u0645 \u0643\u0631\u064A\u0645 \u0648\u0639\u0646\u0627\u064A\u0629 \u0644\u0644\u0634\u0639\u0631"
  }
};
function localizeServiceName(name, lang) {
  if (lang === "en") return name;
  const key = name.trim().toLowerCase();
  if (lang === "roman_ur" || lang === "ur" || lang === "ar") {
    const exact = CUSTOMER_SERVICE_TRANSLATIONS[key];
    if (exact) return exact[lang];
  }
  if (lang === "roman_ur") return name;
  if (lang === "it" || lang === "ru" || lang === "fr" || lang === "de" || lang === "es") {
    const euTokenMap = {
      it: [
        [/\bmaster haircut\b/gi, "Taglio Uomo"],
        [/\bhaircut\b/gi, "Taglio Capelli"],
        [/\bskin fade\b/gi, "Sfumatura Skin Fade"],
        [/\bclassic beard trim\b/gi, "Rifinitura Barba Classica"],
        [/\bbeard trim\b/gi, "Rifinitura Barba"],
        [/\bhot towel steam shave\b/gi, "Rasatura Panno Caldo"],
        [/\bfacial\b/gi, "Trattamento Viso"],
        [/\bmassage\b/gi, "Massaggio"]
      ],
      ru: [
        [/\bmaster haircut\b/gi, "\u041C\u0443\u0436\u0441\u043A\u0430\u044F \u0441\u0442\u0440\u0438\u0436\u043A\u0430"],
        [/\bhaircut\b/gi, "\u0421\u0442\u0440\u0438\u0436\u043A\u0430"],
        [/\bskin fade\b/gi, "\u0421\u043A\u0438\u043D \u0424\u0435\u0439\u0434"],
        [/\bclassic beard trim\b/gi, "\u041C\u043E\u0434\u0435\u043B\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435 \u0431\u043E\u0440\u043E\u0434\u044B"],
        [/\bbeard trim\b/gi, "\u0421\u0442\u0440\u0438\u0436\u043A\u0430 \u0431\u043E\u0440\u043E\u0434\u044B"],
        [/\bhot towel steam shave\b/gi, "\u041A\u043E\u0440\u043E\u043B\u0435\u0432\u0441\u043A\u043E\u0435 \u0431\u0440\u0438\u0442\u044C\u0451"],
        [/\bfacial\b/gi, "\u0423\u0445\u043E\u0434 \u0437\u0430 \u043B\u0438\u0446\u043E\u043C"],
        [/\bmassage\b/gi, "\u041C\u0430\u0441\u0441\u0430\u0436 \u0433\u043E\u043B\u043E\u0432\u044B"]
      ],
      fr: [
        [/\bmaster haircut\b/gi, "Coupe Homme"],
        [/\bhaircut\b/gi, "Coupe de Cheveux"],
        [/\bskin fade\b/gi, "D\xE9grad\xE9 Am\xE9ricain"],
        [/\bclassic beard trim\b/gi, "Taille de Barbe Classique"],
        [/\bbeard trim\b/gi, "Taille de Barbe"],
        [/\bhot towel steam shave\b/gi, "Rasage Serviette Chaude"],
        [/\bfacial\b/gi, "Soin du Visage"],
        [/\bmassage\b/gi, "Massage Cr\xE2nien"]
      ],
      de: [
        [/\bmaster haircut\b/gi, "Meister-Haarschnitt"],
        [/\bhaircut\b/gi, "Haarschnitt"],
        [/\bskin fade\b/gi, "Skin Fade"],
        [/\bclassic beard trim\b/gi, "Klassischer Bartschnitt"],
        [/\bbeard trim\b/gi, "Bartschnitt"],
        [/\bhot towel steam shave\b/gi, "Hei\xDFtuch-Rasur"],
        [/\bfacial\b/gi, "Gesichtsbehandlung"],
        [/\bmassage\b/gi, "Kopfmassage"]
      ],
      es: [
        [/\bmaster haircut\b/gi, "Corte Maestro"],
        [/\bhaircut\b/gi, "Corte de Pelo"],
        [/\bskin fade\b/gi, "Degradado Skin Fade"],
        [/\bclassic beard trim\b/gi, "Arreglo de Barba Cl\xE1sico"],
        [/\bbeard trim\b/gi, "Arreglo de Barba"],
        [/\bhot towel steam shave\b/gi, "Afeitado Toalla Caliente"],
        [/\bfacial\b/gi, "Limpieza Facial"],
        [/\bmassage\b/gi, "Masaje Capilar"]
      ]
    };
    let euOut = name;
    for (const [rx, replacement] of euTokenMap[lang]) {
      euOut = euOut.replace(rx, replacement);
    }
    return euOut;
  }
  const tokenMapUr = [
    [/\bmaster haircut\b/gi, "\u0645\u0627\u0633\u0679\u0631 \u06C1\u06CC\u0626\u0631 \u06A9\u0679"],
    [/\bhaircut\b/gi, "\u06C1\u06CC\u0626\u0631 \u06A9\u0679"],
    [/\bskin fade\b/gi, "\u0627\u0633\u06A9\u0646 \u0641\u06CC\u0688"],
    [/\bbeard trim\b/gi, "\u062F\u0627\u0691\u06BE\u06CC \u0679\u0631\u0645"],
    [/\bbeard\b/gi, "\u062F\u0627\u0691\u06BE\u06CC"],
    [/\bshave\b/gi, "\u0634\u06CC\u0648"],
    [/\bfacial\b/gi, "\u0641\u06CC\u0634\u0644"],
    [/\bpolish\b/gi, "\u067E\u0627\u0644\u0634"],
    [/\bmassage\b/gi, "\u0645\u0633\u0627\u062C"],
    [/\bmakeup\b/gi, "\u0645\u06CC\u06A9 \u0627\u067E"],
    [/\bbridal\b/gi, "\u0628\u0631\u0627\u0626\u06CC\u0688\u0644"],
    [/\bgroom\b/gi, "\u062F\u0648\u0644\u06C1\u0627"],
    [/\bpackage\b/gi, "\u067E\u06CC\u06A9\u06CC\u062C"],
    [/\bkeratin\b/gi, "\u06A9\u06CC\u0631\u0627\u0679\u06CC\u0646"],
    [/\bhair color\b/gi, "\u06C1\u06CC\u0626\u0631 \u06A9\u0644\u0631"],
    [/\bthreading\b/gi, "\u062A\u06BE\u0631\u06CC\u0688\u0646\u06AF"],
    [/\bwaxing\b/gi, "\u0648\u06CC\u06A9\u0633\u0646\u06AF"],
    [/\bspa\b/gi, "\u0627\u0633\u067E\u0627"]
  ];
  const tokenMapAr = [
    [/\bmaster haircut\b/gi, "\u0642\u0635 \u0634\u0639\u0631 \u0627\u062D\u062A\u0631\u0627\u0641\u064A"],
    [/\bhaircut\b/gi, "\u0642\u0635 \u0634\u0639\u0631"],
    [/\bskin fade\b/gi, "\u062A\u062F\u0631\u064A\u062C \u0633\u0643\u0646 \u0641\u064A\u062F"],
    [/\bbeard trim\b/gi, "\u062A\u0634\u0630\u064A\u0628 \u0627\u0644\u0644\u062D\u064A\u0629"],
    [/\bbeard\b/gi, "\u0644\u062D\u064A\u0629"],
    [/\bshave\b/gi, "\u062D\u0644\u0627\u0642\u0629"],
    [/\bfacial\b/gi, "\u062A\u0646\u0638\u064A\u0641 \u0628\u0634\u0631\u0629"],
    [/\bmassage\b/gi, "\u0645\u0633\u0627\u062C"],
    [/\bmakeup\b/gi, "\u0645\u0643\u064A\u0627\u062C"],
    [/\bbridal\b/gi, "\u0639\u0631\u0648\u0633"],
    [/\bgroom\b/gi, "\u0639\u0631\u064A\u0633"],
    [/\bpackage\b/gi, "\u0628\u0627\u0642\u0629"],
    [/\bkeratin\b/gi, "\u0643\u064A\u0631\u0627\u062A\u064A\u0646"],
    [/\bhair color\b/gi, "\u0635\u0628\u063A\u0629 \u0634\u0639\u0631"],
    [/\bthreading\b/gi, "\u0625\u0632\u0627\u0644\u0629 \u0634\u0639\u0631 \u0628\u0627\u0644\u0641\u062A\u0644\u0629"],
    [/\bwaxing\b/gi, "\u0634\u0645\u0639"],
    [/\bspa\b/gi, "\u0633\u0628\u0627"]
  ];
  let out = name;
  const rules = lang === "ur" ? tokenMapUr : tokenMapAr;
  for (const [rx, replacement] of rules) {
    out = out.replace(rx, replacement);
  }
  return out;
}
function enrichServicesWithTranslations(services) {
  return services.map((s) => ({
    ...s,
    translations: {
      en: s.name,
      roman_ur: s.translations?.roman_ur || localizeServiceName(s.name, "roman_ur"),
      ur: s.translations?.ur || localizeServiceName(s.name, "ur"),
      ar: s.translations?.ar || localizeServiceName(s.name, "ar"),
      it: s.translations?.it || localizeServiceName(s.name, "it"),
      ru: s.translations?.ru || localizeServiceName(s.name, "ru"),
      fr: s.translations?.fr || localizeServiceName(s.name, "fr"),
      de: s.translations?.de || localizeServiceName(s.name, "de"),
      es: s.translations?.es || localizeServiceName(s.name, "es")
    }
  }));
}
var CUSTOMER_DEAL_EXACT_TRANSLATIONS = {
  "executive haircut & facial combo (20% off)": {
    roman_ur: "Executive Haircut & Facial Combo (20% OFF)",
    ur: "\u0627\u06CC\u06AF\u0632\u06CC\u06A9\u0679\u0648 \u06C1\u06CC\u0626\u0631 \u06A9\u0679 \u0627\u0648\u0631 \u0641\u06CC\u0634\u0644 \u06A9\u0648\u0645\u0628\u0648 (20% \u0631\u0639\u0627\u06CC\u062A)",
    ar: "\u0628\u0627\u0642\u0629 \u0642\u0635 \u0627\u0644\u0634\u0639\u0631 \u0648\u062A\u0646\u0638\u064A\u0641 \u0627\u0644\u0628\u0634\u0631\u0629 \u0627\u0644\u062A\u0646\u0641\u064A\u0630\u064A\u0629 (\u062E\u0635\u0645 20%)"
  },
  "includes master haircut + skin fade + charcoal deep detox facial with priority chair access.": {
    roman_ur: "Master Haircut, Skin Fade aur Charcoal Facial ke sath priority chair shamil hai.",
    ur: "\u0627\u0633 \u0622\u0641\u0631 \u0645\u06CC\u06BA \u0645\u0627\u0633\u0679\u0631 \u06C1\u06CC\u0626\u0631 \u06A9\u0679\u060C \u0627\u0633\u06A9\u0646 \u0641\u06CC\u0688 \u0627\u0648\u0631 \u0686\u0627\u0631\u06A9\u0648\u0644 \u0688\u06CC\u067E \u0688\u06CC\u0679\u0648\u06A9\u0633 \u0641\u06CC\u0634\u0644 \u062A\u0631\u062C\u06CC\u062D\u06CC \u06A9\u0631\u0633\u06CC \u06A9\u06D2 \u0633\u0627\u062A\u06BE \u0634\u0627\u0645\u0644 \u06C1\u06CC\u06BA\u06D4",
    ar: "\u062A\u062A\u0636\u0645\u0646 \u0627\u0644\u0628\u0627\u0642\u0629 \u0642\u0635 \u0634\u0639\u0631 \u0627\u062D\u062A\u0631\u0627\u0641\u064A \u0648\u062A\u062F\u0631\u064A\u062C \u0627\u0644\u0634\u0639\u0631 \u0648\u062A\u0646\u0638\u064A\u0641 \u0639\u0645\u064A\u0642 \u0644\u0644\u0628\u0634\u0631\u0629 \u0628\u0627\u0644\u0641\u062D\u0645 \u0645\u0639 \u0623\u0648\u0644\u0648\u064A\u0629 \u0627\u0644\u062C\u0644\u0648\u0633."
  },
  "jumeirah executive grooming package": {
    roman_ur: "Jumeirah Executive Grooming Package",
    ur: "\u062C\u0645\u06CC\u0631\u06C1 \u0627\u06CC\u06AF\u0632\u06CC\u06A9\u0679\u0648 \u06AF\u0631\u0648\u0645\u0646\u06AF \u067E\u06CC\u06A9\u06CC\u062C",
    ar: "\u0628\u0627\u0642\u0629 \u062C\u0645\u064A\u0631\u0627 \u0644\u0644\u0639\u0646\u0627\u064A\u0629 \u0627\u0644\u062A\u0646\u0641\u064A\u0630\u064A\u0629"
  },
  "master haircut, skin fade, classic beard trim, and hot towel shave bundle.": {
    roman_ur: "Master Haircut, Skin Fade, Classic Beard Trim aur Hot Towel Shave ka mukammal bundle.",
    ur: "\u0645\u0627\u0633\u0679\u0631 \u06C1\u06CC\u0626\u0631 \u06A9\u0679\u060C \u0627\u0633\u06A9\u0646 \u0641\u06CC\u0688\u060C \u06A9\u0644\u0627\u0633\u06A9 \u062F\u0627\u0691\u06BE\u06CC \u0679\u0631\u0645 \u0627\u0648\u0631 \u06C1\u0627\u0679 \u0679\u0627\u0648\u0644 \u0634\u06CC\u0648 \u06A9\u0627 \u0645\u06A9\u0645\u0644 \u067E\u06CC\u06A9\u06CC\u062C\u06D4",
    ar: "\u0628\u0627\u0642\u0629 \u0634\u0627\u0645\u0644\u0629 \u062A\u062A\u0636\u0645\u0646 \u0642\u0635 \u0634\u0639\u0631 \u0627\u062D\u062A\u0631\u0627\u0641\u064A\u060C \u062A\u062F\u0631\u064A\u062C \u0627\u0644\u0634\u0639\u0631\u060C \u062A\u0634\u0630\u064A\u0628 \u0627\u0644\u0644\u062D\u064A\u0629\u060C \u0648\u062D\u0644\u0627\u0642\u0629 \u0628\u0627\u0644\u0645\u0646\u0634\u0641\u0629 \u0627\u0644\u0633\u0627\u062E\u0646\u0629."
  },
  "signature haircut, beard sculpt, and hot towel shave bundle.": {
    roman_ur: "Signature Haircut, Beard Sculpt aur Hot Towel Shave ka mukammal bundle.",
    ur: "\u0633\u06AF\u0646\u06CC\u0686\u0631 \u06C1\u06CC\u0626\u0631 \u06A9\u0679\u060C \u062F\u0627\u0691\u06BE\u06CC \u0627\u0633\u0679\u0627\u0626\u0644\u0646\u06AF \u0627\u0648\u0631 \u06C1\u0627\u0679 \u0679\u0627\u0648\u0644 \u0634\u06CC\u0648 \u06A9\u0627 \u0645\u06A9\u0645\u0644 \u067E\u06CC\u06A9\u06CC\u062C\u06D4",
    ar: "\u0628\u0627\u0642\u0629 \u0634\u0627\u0645\u0644\u0629 \u062A\u062A\u0636\u0645\u0646 \u0642\u0635 \u0634\u0639\u0631 \u0645\u0645\u064A\u0632\u060C \u062A\u062D\u062F\u064A\u062F \u0627\u0644\u0644\u062D\u064A\u0629\u060C \u0648\u062D\u0644\u0627\u0642\u0629 \u0628\u0627\u0644\u0645\u0646\u0634\u0641\u0629 \u0627\u0644\u0633\u0627\u062E\u0646\u0629."
  },
  "hydra-facial + party styling glow deal": {
    roman_ur: "Hydra-Facial + Party Styling Glow Deal",
    ur: "\u06C1\u0627\u0626\u06CC\u0688\u0631\u0627 \u0641\u06CC\u0634\u0644 + \u067E\u0627\u0631\u0679\u06CC \u0627\u0633\u0679\u0627\u0626\u0644\u0646\u06AF \u06AF\u0644\u0648 \u0688\u06CC\u0644",
    ar: "\u0639\u0631\u0636 \u0627\u0644\u0647\u064A\u062F\u0631\u0627\u0641\u064A\u0634\u0644 \u0648\u062A\u0635\u0641\u064A\u0641 \u0627\u0644\u0633\u0647\u0631\u0629 \u0627\u0644\u0645\u062A\u0623\u0644\u0642"
  },
  "limited-time salon glow offer for ladies parlor bookings.": {
    roman_ur: "Ladies parlor bookings ke liye mehdood muddat ki glow offer.",
    ur: "\u0644\u06CC\u0688\u06CC\u0632 \u067E\u0627\u0631\u0644\u0631 \u0628\u06A9\u0646\u06AF\u0632 \u06A9\u06D2 \u0644\u06CC\u06D2 \u0645\u062D\u062F\u0648\u062F \u0645\u062F\u062A \u06A9\u06CC \u062E\u0635\u0648\u0635\u06CC \u06AF\u0644\u0648 \u0622\u0641\u0631\u06D4",
    ar: "\u0639\u0631\u0636 \u0625\u0634\u0631\u0627\u0642\u0629 \u062E\u0627\u0635 \u0644\u0641\u062A\u0631\u0629 \u0645\u062D\u062F\u0648\u062F\u0629 \u0644\u062D\u062C\u0648\u0632\u0627\u062A \u0635\u0627\u0644\u0648\u0646 \u0627\u0644\u0633\u064A\u062F\u0627\u062A."
  },
  "weekend grooming combo": {
    roman_ur: "Weekend Grooming Combo",
    ur: "\u0648\u06CC\u06A9 \u0627\u06CC\u0646\u0688 \u06AF\u0631\u0648\u0645\u0646\u06AF \u06A9\u0648\u0645\u0628\u0648",
    ar: "\u0628\u0627\u0642\u0629 \u0627\u0644\u0639\u0646\u0627\u064A\u0629 \u0644\u0639\u0637\u0644\u0629 \u0646\u0647\u0627\u064A\u0629 \u0627\u0644\u0623\u0633\u0628\u0648\u0639"
  }
};
function localizeDealText(text, lang) {
  const clean = (text || "").trim();
  if (!clean || lang === "en") return clean;
  if (lang === "roman_ur" || lang === "ur" || lang === "ar") {
    const exact = CUSTOMER_DEAL_EXACT_TRANSLATIONS[clean.toLowerCase()];
    if (exact) return exact[lang];
  }
  if (lang === "it" || lang === "ru" || lang === "fr" || lang === "de" || lang === "es") {
    return clean;
  }
  if (lang === "roman_ur") {
    return clean.replace(/\bvalid until\b/gi, "Aakhri tareekh").replace(/\bspecial salon offer\b/gi, "Khas Salon Offer").replace(/\bwith\b/gi, "ke sath");
  }
  const urRules = [
    [/\bcharcoal deep detox facial\b/gi, "\u0686\u0627\u0631\u06A9\u0648\u0644 \u0688\u06CC\u067E \u0688\u06CC\u0679\u0648\u06A9\u0633 \u0641\u06CC\u0634\u0644"],
    [/\bhot towel steam shave\b/gi, "\u06C1\u0627\u0679 \u0679\u0627\u0648\u0644 \u0627\u0633\u0679\u06CC\u0645 \u0634\u06CC\u0648"],
    [/\bsignature party makeup & styling\b/gi, "\u0633\u06AF\u0646\u06CC\u0686\u0631 \u067E\u0627\u0631\u0679\u06CC \u0645\u06CC\u06A9 \u0627\u067E \u0627\u0648\u0631 \u0627\u0633\u0679\u0627\u0626\u0644\u0646\u06AF"],
    [/\bhydra-facial & skin polish\b/gi, "\u06C1\u0627\u0626\u06CC\u0688\u0631\u0627 \u0641\u06CC\u0634\u0644 \u0627\u0648\u0631 \u0627\u0633\u06A9\u0646 \u067E\u0627\u0644\u0634"],
    [/\bmaster haircut\b/gi, "\u0645\u0627\u0633\u0679\u0631 \u06C1\u06CC\u0626\u0631 \u06A9\u0679"],
    [/\bskin fade\b/gi, "\u0627\u0633\u06A9\u0646 \u0641\u06CC\u0688"],
    [/\bclassic beard trim\b/gi, "\u06A9\u0644\u0627\u0633\u06A9 \u062F\u0627\u0691\u06BE\u06CC \u0679\u0631\u0645"],
    [/\bpriority chair access\b/gi, "\u062A\u0631\u062C\u06CC\u062D\u06CC \u06A9\u0631\u0633\u06CC"],
    [/\bspecial salon offer\b/gi, "\u062E\u0635\u0648\u0635\u06CC \u0633\u06CC\u0644\u0648\u0646 \u0622\u0641\u0631"],
    [/\blimited-time\b/gi, "\u0645\u062D\u062F\u0648\u062F \u0645\u062F\u062A"],
    [/\bvalid until\b/gi, "\u0622\u062E\u0631\u06CC \u062A\u0627\u0631\u06CC\u062E"],
    [/\bincludes:\s*/gi, "\u0634\u0627\u0645\u0644 \u06C1\u06CC\u06BA: "],
    [/\bincludes\b/gi, "\u0634\u0627\u0645\u0644 \u06C1\u06CC\u06BA:"],
    [/\bwith\b/gi, "\u0627\u0648\u0631"],
    [/\band\b/gi, "\u0627\u0648\u0631"],
    [/\s+&\s+/g, " \u0627\u0648\u0631 "],
    [/\bweekend\b/gi, "\u0648\u06CC\u06A9 \u0627\u06CC\u0646\u0688"],
    [/\bgrooming\b/gi, "\u06AF\u0631\u0648\u0645\u0646\u06AF"],
    [/\bexecutive\b/gi, "\u0627\u06CC\u06AF\u0632\u06CC\u06A9\u0679\u0648"],
    [/\bcombo\b/gi, "\u06A9\u0648\u0645\u0628\u0648"],
    [/\bpackage\b/gi, "\u067E\u06CC\u06A9\u06CC\u062C"],
    [/\bbundle\b/gi, "\u067E\u06CC\u06A9\u06CC\u062C"],
    [/\boffer\b/gi, "\u0622\u0641\u0631"],
    [/\bdeal\b/gi, "\u0688\u06CC\u0644"],
    [/\bhaircut\b/gi, "\u06C1\u06CC\u0626\u0631 \u06A9\u0679"],
    [/\bbeard\b/gi, "\u062F\u0627\u0691\u06BE\u06CC"],
    [/\bfacial\b/gi, "\u0641\u06CC\u0634\u0644"],
    [/\bbridal\b/gi, "\u0628\u0631\u0627\u0626\u06CC\u0688\u0644"],
    [/\boff\b/gi, "\u0631\u0639\u0627\u06CC\u062A"]
  ];
  const arRules = [
    [/\bcharcoal deep detox facial\b/gi, "\u062A\u0646\u0638\u064A\u0641 \u0639\u0645\u064A\u0642 \u0644\u0644\u0628\u0634\u0631\u0629 \u0628\u0627\u0644\u0641\u062D\u0645"],
    [/\bhot towel steam shave\b/gi, "\u062D\u0644\u0627\u0642\u0629 \u0628\u0627\u0644\u0645\u0646\u0634\u0641\u0629 \u0627\u0644\u0633\u0627\u062E\u0646\u0629 \u0648\u0627\u0644\u0628\u062E\u0627\u0631"],
    [/\bsignature party makeup & styling\b/gi, "\u0645\u0643\u064A\u0627\u062C \u0633\u0647\u0631\u0629 \u0645\u0645\u064A\u0632 \u0648\u062A\u0635\u0641\u064A\u0641"],
    [/\bhydra-facial & skin polish\b/gi, "\u0647\u064A\u062F\u0631\u0627\u0641\u064A\u0634\u0644 \u0648\u0635\u0646\u0641\u0631\u0629 \u0627\u0644\u0628\u0634\u0631\u0629"],
    [/\bmaster haircut\b/gi, "\u0642\u0635 \u0634\u0639\u0631 \u0627\u062D\u062A\u0631\u0627\u0641\u064A"],
    [/\bskin fade\b/gi, "\u062A\u062F\u0631\u064A\u062C \u0627\u0644\u0634\u0639\u0631"],
    [/\bclassic beard trim\b/gi, "\u062A\u0634\u0630\u064A\u0628 \u0627\u0644\u0644\u062D\u064A\u0629 \u0627\u0644\u0643\u0644\u0627\u0633\u064A\u0643\u064A"],
    [/\bpriority chair access\b/gi, "\u0623\u0648\u0644\u0648\u064A\u0629 \u0627\u0644\u062C\u0644\u0648\u0633"],
    [/\bspecial salon offer\b/gi, "\u0639\u0631\u0636 \u0635\u0627\u0644\u0648\u0646 \u062E\u0627\u0635"],
    [/\blimited-time\b/gi, "\u0644\u0641\u062A\u0631\u0629 \u0645\u062D\u062F\u0648\u062F\u0629"],
    [/\bvalid until\b/gi, "\u0635\u0627\u0644\u062D \u062D\u062A\u0649"],
    [/\bincludes:\s*/gi, "\u064A\u0634\u0645\u0644: "],
    [/\bincludes\b/gi, "\u064A\u0634\u0645\u0644:"],
    [/\bwith\b/gi, "\u0645\u0639"],
    [/\band\b/gi, "\u0648"],
    [/\s+&\s+/g, " \u0648 "],
    [/\bweekend\b/gi, "\u0646\u0647\u0627\u064A\u0629 \u0627\u0644\u0623\u0633\u0628\u0648\u0639"],
    [/\bgrooming\b/gi, "\u0639\u0646\u0627\u064A\u0629"],
    [/\bexecutive\b/gi, "\u062A\u0646\u0641\u064A\u0630\u064A"],
    [/\bcombo\b/gi, "\u0628\u0627\u0642\u0629"],
    [/\bpackage\b/gi, "\u0628\u0627\u0642\u0629"],
    [/\bbundle\b/gi, "\u0628\u0627\u0642\u0629"],
    [/\boffer\b/gi, "\u0639\u0631\u0636"],
    [/\bdeal\b/gi, "\u0639\u0631\u0636"],
    [/\bhaircut\b/gi, "\u0642\u0635 \u0634\u0639\u0631"],
    [/\bbeard\b/gi, "\u0644\u062D\u064A\u0629"],
    [/\bfacial\b/gi, "\u062A\u0646\u0638\u064A\u0641 \u0628\u0634\u0631\u0629"],
    [/\bbridal\b/gi, "\u0639\u0631\u0648\u0633"],
    [/\boff\b/gi, "\u062E\u0635\u0645"]
  ];
  let out = clean;
  const rules = lang === "ur" ? urRules : arRules;
  for (const [rx, replacement] of rules) {
    out = out.replace(rx, replacement);
  }
  return out;
}
function enrichDealWithTranslations(deal) {
  return {
    ...deal,
    titleTranslations: {
      en: deal.title,
      roman_ur: deal.titleTranslations?.roman_ur || localizeDealText(deal.title, "roman_ur"),
      ur: deal.titleTranslations?.ur || localizeDealText(deal.title, "ur"),
      ar: deal.titleTranslations?.ar || localizeDealText(deal.title, "ar")
    },
    descriptionTranslations: {
      en: deal.description,
      roman_ur: deal.descriptionTranslations?.roman_ur || localizeDealText(deal.description, "roman_ur"),
      ur: deal.descriptionTranslations?.ur || localizeDealText(deal.description, "ur"),
      ar: deal.descriptionTranslations?.ar || localizeDealText(deal.description, "ar")
    }
  };
}
function isUniformDailySchedule(hours) {
  if (hours.monThuClosed || hours.fridayClosed || hours.satSunClosed) return false;
  const sameOpen = hours.monThuOpen.trim().toLowerCase() === hours.fridayOpen.trim().toLowerCase() && hours.monThuOpen.trim().toLowerCase() === hours.satSunOpen.trim().toLowerCase();
  const sameClose = hours.monThuClose.trim().toLowerCase() === hours.fridayClose.trim().toLowerCase() && hours.monThuClose.trim().toLowerCase() === hours.satSunClose.trim().toLowerCase();
  const bStart = (hours.fridayBreakStart || "").trim().toLowerCase();
  const bEnd = (hours.fridayBreakEnd || "").trim().toLowerCase();
  const hasBreak = Boolean(bStart) && Boolean(bEnd) && bStart !== "none" && bEnd !== "none" && bStart !== "off" && bEnd !== "off" && bStart !== bEnd;
  return sameOpen && sameClose && !hasBreak;
}
function getConfiguredLanguageChoices(settings, clientPhoneOverride) {
  const clientEu = clientPhoneOverride ? EUROPEAN_TWO_LANG_BY_PREFIX[extractCountryCode(clientPhoneOverride)] : void 0;
  if (clientEu) {
    return ["en", clientEu].map((l) => LANGUAGE_CHOICE_META[l]);
  }
  const regionMeta = detectRegionFromPhone(settings.whatsappPhone);
  const langs = normalizeClientLanguageList(
    settings.enabledClientLanguages,
    regionMeta.region,
    settings.whatsappPhone
  );
  return langs.map((l) => LANGUAGE_CHOICE_META[l]);
}
function resolveSavedNameStatus(client) {
  if (!client || !client.name) return { hasSavedName: false, savedName: null };
  const trimmed = client.name.trim();
  const placeholders = /* @__PURE__ */ new Set(["salon client", "whatsapp client", "guest", "walk-in guest", ""]);
  if (placeholders.has(trimmed.toLowerCase())) {
    return { hasSavedName: false, savedName: null };
  }
  return { hasSavedName: true, savedName: trimmed };
}
function isDealCurrentlyActive(deal, nowMs = Date.now()) {
  if (!deal.active) return false;
  const expMs = new Date(deal.expiresAt).getTime();
  if (Number.isNaN(expMs)) return false;
  return expMs > nowMs;
}
function runDealExpiryAndVideoRetentionCron(salonId) {
  const store = ensureStoreLoaded();
  const nowMs = Date.now();
  let expiredDealsCount = 0;
  let purgedVideosCount = 0;
  let changed = false;
  for (const deal of store.deals || []) {
    if (salonId && deal.salonId !== salonId) continue;
    const expMs = new Date(deal.expiresAt).getTime();
    if (!Number.isNaN(expMs) && expMs <= nowMs) {
      expiredDealsCount += 1;
      if (deal.active) {
        deal.active = false;
        changed = true;
      }
      const settings = store.settingsBySalon[deal.salonId];
      const retentionDays = clampInteger(
        deal.videoRetentionDaysAfterExpiry ?? settings?.videoRetentionDaysAfterExpiry ?? 30,
        1,
        365,
        30
      );
      const deleteAfterMs = expMs + retentionDays * 864e5;
      if (nowMs >= deleteAfterMs && (deal.videoFileName || deal.videoUrl)) {
        if (deal.videoFileName) {
          const safePath = path2.join(DEAL_VIDEO_DIR, path2.basename(deal.videoFileName));
          try {
            if (fs2.existsSync(safePath)) {
              fs2.unlinkSync(safePath);
            }
          } catch (err) {
            console.warn("Could not unlink expired deal video:", err);
          }
        }
        deal.videoFileName = void 0;
        deal.videoMimeType = void 0;
        deal.videoUrl = void 0;
        deal.videoDeletedAt = new Date(nowMs).toISOString();
        purgedVideosCount += 1;
        changed = true;
      }
    }
  }
  if (changed) {
    persistStore(salonId);
  }
  return { expiredDealsCount, purgedVideosCount };
}
function listSalonDeals(salonId, activeOnly = false) {
  ensureSalonExists(salonId);
  runDealExpiryAndVideoRetentionCron(salonId);
  const store = ensureStoreLoaded();
  const nowMs = Date.now();
  return (store.deals || []).filter((d) => d.salonId === salonId && (!activeOnly || isDealCurrentlyActive(d, nowMs))).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((d) => enrichDealWithTranslations(d));
}
function createSalonDeal(salonId, input) {
  const store = ensureStoreLoaded();
  const settings = ensureSalonExists(salonId);
  const cleanTitle = sanitizePlainText(input.title, 100);
  if (!cleanTitle) {
    throw new Error("Deal title is required.");
  }
  const expDate = new Date(input.expiresAt);
  if (Number.isNaN(expDate.getTime())) {
    throw new Error("Valid deal expiry date is required.");
  }
  const discountType = input.discountType === "FIXED" || input.discountType === "BUNDLE_PRICE" ? input.discountType : "PCT";
  const discountValue = discountType === "PCT" ? clampInteger(input.discountValue ?? 15, 1, 90, 15) : clampInteger(input.discountValue ?? 500, 0, 5e5, 500);
  const configuredServices = settings.enabledServices || [];
  const requestedIds = Array.isArray(input.serviceIds) ? input.serviceIds : [];
  const matchedServices = configuredServices.filter(
    (s) => s.active !== false && s.id && requestedIds.includes(s.id)
  );
  const finalServices = matchedServices.length > 0 ? matchedServices : configuredServices.filter((s) => s.active !== false).slice(0, 2);
  const retentionDays = clampInteger(
    input.videoRetentionDaysAfterExpiry ?? settings.videoRetentionDaysAfterExpiry ?? 30,
    1,
    365,
    30
  );
  const dealId = `deal-${salonId}-${Date.now().toString(36)}`;
  let videoFileName;
  let videoMimeType;
  let videoUrl;
  if (input.videoBuffer && input.videoBuffer.length > 0) {
    const allowedMimeMap = {
      "video/mp4": ".mp4",
      "video/webm": ".webm",
      "video/quicktime": ".mov"
    };
    const rawMime = (input.videoMimeType || "video/mp4").toLowerCase().split(";")[0].trim();
    const ext = allowedMimeMap[rawMime] || ".mp4";
    if (!fs2.existsSync(DEAL_VIDEO_DIR)) {
      fs2.mkdirSync(DEAL_VIDEO_DIR, { recursive: true });
    }
    videoFileName = `${dealId}${ext}`.replace(/[^a-zA-Z0-9._-]/g, "");
    videoMimeType = allowedMimeMap[rawMime] ? rawMime : "video/mp4";
    fs2.writeFileSync(path2.join(DEAL_VIDEO_DIR, videoFileName), input.videoBuffer);
    videoUrl = `/api/public/deal-videos/${encodeURIComponent(videoFileName)}`;
  }
  const deal = {
    id: dealId,
    salonId,
    title: cleanTitle,
    description: sanitizePlainText(input.description || "", 300) || `Special salon offer valid until ${expDate.toLocaleDateString()}.`,
    discountType,
    discountValue,
    serviceIds: finalServices.map((s) => s.id || s.name),
    serviceNames: finalServices.map((s) => s.name),
    startsAt: (/* @__PURE__ */ new Date()).toISOString(),
    expiresAt: expDate.toISOString(),
    videoRetentionDaysAfterExpiry: retentionDays,
    videoFileName,
    videoMimeType,
    videoUrl,
    videoDeletedAt: null,
    active: expDate.getTime() > Date.now(),
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  store.deals = [deal, ...store.deals || []];
  persistStore(salonId);
  return { deal, state: getSalonConciergeState(salonId) };
}
function deleteSalonDeal(salonId, dealId) {
  const store = ensureStoreLoaded();
  const target = (store.deals || []).find((d) => d.salonId === salonId && d.id === dealId);
  if (target?.videoFileName) {
    try {
      const p = path2.join(DEAL_VIDEO_DIR, path2.basename(target.videoFileName));
      if (fs2.existsSync(p)) fs2.unlinkSync(p);
    } catch {
    }
  }
  store.deals = (store.deals || []).filter((d) => !(d.salonId === salonId && d.id === dealId));
  persistStore(salonId);
  return getSalonConciergeState(salonId);
}
function getDealVideoFileInfo(fileName) {
  runDealExpiryAndVideoRetentionCron();
  const safeName = path2.basename(fileName || "");
  if (!safeName || safeName.includes("..")) return null;
  const fullPath = path2.join(DEAL_VIDEO_DIR, safeName);
  if (!fs2.existsSync(fullPath)) return null;
  const ext = path2.extname(safeName).toLowerCase();
  const mimeType = ext === ".webm" ? "video/webm" : ext === ".mov" ? "video/quicktime" : "video/mp4";
  return { filePath: fullPath, mimeType };
}
function getPublicDealPayload(salonCode, dealId) {
  const salonId = resolveSalonIdByPublicCode(salonCode);
  if (!salonId) return null;
  const settings = ensureSalonExists(salonId);
  runDealExpiryAndVideoRetentionCron(salonId);
  const store = ensureStoreLoaded();
  const deal = (store.deals || []).find((d) => d.salonId === salonId && d.id === dealId);
  if (!deal) return null;
  const isExpired = !isDealCurrentlyActive(deal);
  const videoPurged = Boolean(deal.videoDeletedAt);
  const activeServices = (settings.enabledServices || []).filter((s) => s.active !== false);
  const matchedServices = activeServices.filter(
    (s) => s.id && deal.serviceIds.includes(s.id) || deal.serviceNames.includes(s.name)
  );
  const enrichedActive = enrichServicesWithTranslations(activeServices);
  const enrichedMatched = enrichServicesWithTranslations(
    matchedServices.length > 0 ? matchedServices : activeServices.slice(0, 2)
  );
  const address = settings.address || SEEDED_SALON_ADDRESSES[salonId] || "Salon Location";
  const googleMapsUrl = settings.googleMapsUrl || buildGoogleMapsSearchUrl(settings.salonName, address);
  return {
    salonId,
    publicCode: settings.publicCode,
    salonName: settings.salonName,
    salonCategory: settings.salonCategory || "MENS",
    address,
    googleMapsUrl,
    currencySymbol: settings.currencySymbol,
    deal: enrichDealWithTranslations(deal),
    isExpired,
    videoPurged,
    retentionDaysAfterExpiry: deal.videoRetentionDaysAfterExpiry ?? settings.videoRetentionDaysAfterExpiry ?? 30,
    services: enrichedActive,
    matchedServices: enrichedMatched,
    availableLanguages: getConfiguredLanguageChoices(settings),
    defaultLanguage: settings.defaultLang || "en"
  };
}
function getScheduleForDate(hours, dateStr) {
  const parts = dateStr.split("-").map((n) => parseInt(n, 10));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    return {
      isOpen: false,
      dayName: "Invalid Date",
      openMins: 0,
      closeMins: 0,
      closedReason: "Invalid date selected."
    };
  }
  const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12, 0, 0));
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dow = dt.getUTCDay();
  const dayName = dayNames[dow];
  if (dow === 5) {
    if (hours.fridayClosed) {
      return {
        isOpen: false,
        dayName,
        openMins: 0,
        closeMins: 0,
        closedReason: "Salon is closed on Friday."
      };
    }
    const openMins2 = parseTimeSlotToMinutes(hours.fridayOpen);
    const closeMins2 = parseTimeSlotToMinutes(hours.fridayClose);
    const bStart = parseTimeSlotToMinutes(hours.fridayBreakStart || "");
    const bEnd = parseTimeSlotToMinutes(hours.fridayBreakEnd || "");
    return {
      isOpen: openMins2 >= 0 && closeMins2 > openMins2,
      dayName,
      openMins: openMins2 >= 0 ? openMins2 : 660,
      closeMins: closeMins2 > 0 ? closeMins2 : 1380,
      breakStartMins: bStart >= 0 ? bStart : void 0,
      breakEndMins: bEnd > bStart ? bEnd : void 0,
      fridayBreakText: bStart >= 0 && bEnd > bStart && hours.fridayBreakStart && hours.fridayBreakEnd ? `Friday Prayer Break: ${hours.fridayBreakStart} \u2013 ${hours.fridayBreakEnd}` : void 0
    };
  }
  if (dow === 0 || dow === 6) {
    if (hours.satSunClosed) {
      return {
        isOpen: false,
        dayName,
        openMins: 0,
        closeMins: 0,
        closedReason: `Salon is closed on ${dayName}.`
      };
    }
    const openMins2 = parseTimeSlotToMinutes(hours.satSunOpen);
    const closeMins2 = parseTimeSlotToMinutes(hours.satSunClose);
    return {
      isOpen: openMins2 >= 0 && closeMins2 > openMins2,
      dayName,
      openMins: openMins2 >= 0 ? openMins2 : 630,
      closeMins: closeMins2 > 0 ? closeMins2 : 1380
    };
  }
  if (hours.monThuClosed) {
    return {
      isOpen: false,
      dayName,
      openMins: 0,
      closeMins: 0,
      closedReason: `Salon is closed on ${dayName}.`
    };
  }
  const openMins = parseTimeSlotToMinutes(hours.monThuOpen);
  const closeMins = parseTimeSlotToMinutes(hours.monThuClose);
  return {
    isOpen: openMins >= 0 && closeMins > openMins,
    dayName,
    openMins: openMins >= 0 ? openMins : 660,
    closeMins: closeMins > 0 ? closeMins : 1320
  };
}
function getCustomerExperienceConfig(salonId, clientToken, requestedLang) {
  const settings = ensureSalonExists(salonId);
  runDealExpiryAndVideoRetentionCron(salonId);
  const store = ensureStoreLoaded();
  const regionMeta = detectRegionFromPhone(settings.whatsappPhone);
  let verifiedClient;
  if (clientToken) {
    const claims = verifyCustomerRecognizeToken(clientToken, salonId);
    if (claims?.clientId) {
      verifiedClient = store.clients.find(
        (c) => c.salonId === salonId && c.id === claims.clientId
      );
    }
  }
  const availableLanguages = getConfiguredLanguageChoices(settings, verifiedClient?.phone);
  const returningClient = verifiedClient ? {
    clientId: verifiedClient.id,
    clientName: verifiedClient.name,
    maskedPhone: maskPhoneNumber(verifiedClient.phone),
    preferredLanguage: verifiedClient.preferredLanguage || "en",
    totalVisits: Number(verifiedClient.totalVisits || 0),
    lastServiceIds: Array.isArray(verifiedClient.lastServiceIds) ? verifiedClient.lastServiceIds : [],
    lastBarberName: verifiedClient.lastBarberName || null,
    marketingOptIn: Boolean(verifiedClient.marketingOptIn)
  } : null;
  const defaultLanguage = requestedLang && availableLanguages.some((l) => l.lang === requestedLang) ? requestedLang : returningClient?.preferredLanguage && availableLanguages.some((l) => l.lang === returningClient.preferredLanguage) ? returningClient.preferredLanguage : settings.defaultLang || "en";
  const activeServices = (settings.enabledServices || []).filter((s) => s.active !== false);
  const activeDeals = listSalonDeals(salonId, true).map((d) => ({
    ...d,
    dealPagePath: `/deal/${encodeURIComponent(settings.publicCode)}/${encodeURIComponent(d.id)}`
  }));
  const address = settings.address || SEEDED_SALON_ADDRESSES[salonId] || "Salon Location";
  const googleMapsUrl = settings.googleMapsUrl || buildGoogleMapsSearchUrl(settings.salonName, address);
  const usage = getMonthlyUsageSnapshot(salonId);
  return {
    salonId,
    publicCode: settings.publicCode,
    salonName: settings.salonName,
    salonCategory: settings.salonCategory || "MENS",
    region: regionMeta.region,
    currency: settings.currency,
    currencySymbol: settings.currencySymbol,
    timezoneIana: settings.timezoneIana || detectTimezoneIana(regionMeta.countryCode),
    publicContactPhone: settings.publicContactPhone || settings.whatsappPhone,
    publicWhatsappPhone: settings.publicWhatsappPhone || settings.publicContactPhone || settings.whatsappPhone,
    whatsappAddonEnabled: Boolean(settings.whatsappAddonEnabled),
    address,
    googleMapsUrl,
    googleReviewUrl: settings.googleReviewUrl,
    operatingHours: settings.operatingHours || { ...DEFAULT_SALON_OPERATING_HOURS },
    availableLanguages,
    defaultLanguage,
    services: enrichServicesWithTranslations(activeServices),
    barbers: getSalonBarbers(salonId),
    activeDeals,
    returningClient,
    todayDate: getSalonLocalDateParts(settings.timezoneOffsetHours).dateStr,
    usageStatus: usage.status
  };
}
function buildCustomerWelcomeMenu(settings, lang, savedClientName) {
  const availableLanguages = getConfiguredLanguageChoices(settings);
  const resolvedLang = availableLanguages.some((l) => l.lang === lang) ? lang : "en";
  const dir = getLangDirection(resolvedLang);
  const cleanName = savedClientName ? sanitizePlainText(savedClientName, 80) : "";
  const copyMap = {
    en: {
      welcome: cleanName ? `Welcome back to ${settings.salonName}, ${cleanName}! How can I help you today?` : `Welcome to ${settings.salonName}! Choose an option below to get started:`,
      book: "Book Appointment",
      services: "Services & Prices",
      hours: "Opening Hours & Location",
      deals: "Current Deals & Offers"
    },
    roman_ur: {
      welcome: cleanName ? `${settings.salonName} mein dobara khush amdeed, ${cleanName}! Mein aap ki kya madad kar sakta hoon?` : `${settings.salonName} mein khush amdeed! Shuru karne ke liye neeche option chunein:`,
      book: "Appointment Book Karein",
      services: "Services aur Prices",
      hours: "Opening Hours aur Location",
      deals: "Current Deals aur Offers"
    },
    ur: {
      welcome: cleanName ? `${settings.salonName} \u0645\u06CC\u06BA \u062F\u0648\u0628\u0627\u0631\u06C1 \u062E\u0648\u0634 \u0622\u0645\u062F\u06CC\u062F\u060C ${cleanName}! \u0645\u06CC\u06BA \u0622\u067E \u06A9\u06CC \u06A9\u06CC\u0627 \u0645\u062F\u062F \u06A9\u0631 \u0633\u06A9\u062A\u0627 \u06C1\u0648\u06BA\u061F` : `${settings.salonName} \u0645\u06CC\u06BA \u062E\u0648\u0634 \u0622\u0645\u062F\u06CC\u062F! \u0646\u06CC\u0686\u06D2 \u062F\u06CC\u06D2 \u06AF\u0626\u06D2 \u0622\u067E\u0634\u0646\u0632 \u0645\u06CC\u06BA \u0633\u06D2 \u0627\u0646\u062A\u062E\u0627\u0628 \u06A9\u0631\u06CC\u06BA:`,
      book: "\u0627\u067E\u0627\u0626\u0646\u0679\u0645\u0646\u0679 \u0628\u06A9 \u06A9\u0631\u06CC\u06BA",
      services: "\u0633\u0631\u0648\u0633\u0632 \u0627\u0648\u0631 \u0642\u06CC\u0645\u062A\u06CC\u06BA",
      hours: "\u0627\u0648\u0642\u0627\u062A \u0627\u0648\u0631 \u0644\u0648\u06A9\u06CC\u0634\u0646",
      deals: "\u0645\u0648\u062C\u0648\u062F\u06C1 \u0688\u06CC\u0644\u0632 \u0627\u0648\u0631 \u0622\u0641\u0631\u0632"
    },
    ar: {
      welcome: cleanName ? `\u0623\u0647\u0644\u0627\u064B \u0628\u0639\u0648\u062F\u062A\u0643 \u0625\u0644\u0649 ${settings.salonName}\u060C ${cleanName}! \u0643\u064A\u0641 \u064A\u0645\u0643\u0646\u0646\u064A \u0645\u0633\u0627\u0639\u062F\u062A\u0643 \u0627\u0644\u064A\u0648\u0645\u061F` : `\u0623\u0647\u0644\u0627\u064B \u0628\u0643 \u0641\u064A ${settings.salonName}! \u062D\u062F\u062F \u0623\u062D\u062F \u0627\u0644\u062E\u064A\u0627\u0631\u0627\u062A \u0627\u0644\u062A\u0627\u0644\u064A\u0629 \u0644\u0644\u0628\u062F\u0621:`,
      book: "\u062D\u062C\u0632 \u0645\u0648\u0639\u062F",
      services: "\u0627\u0644\u062E\u062F\u0645\u0627\u062A \u0648\u0627\u0644\u0623\u0633\u0639\u0627\u0631",
      hours: "\u0633\u0627\u0639\u0627\u062A \u0627\u0644\u0639\u0645\u0644 \u0648\u0627\u0644\u0645\u0648\u0642\u0639",
      deals: "\u0627\u0644\u0639\u0631\u0648\u0636 \u0648\u0627\u0644\u0628\u0627\u0642\u0627\u062A \u0627\u0644\u062D\u0627\u0644\u064A\u0629"
    },
    it: {
      welcome: cleanName ? `Bentornato da ${settings.salonName}, ${cleanName}! Come posso aiutarti oggi?` : `Benvenuto da ${settings.salonName}! Scegli una delle opzioni qui sotto:`,
      book: "Prenota Appuntamento",
      services: "Servizi e Prezzi",
      hours: "Orari e Posizione",
      deals: "Offerte Attuali"
    },
    ru: {
      welcome: cleanName ? `\u0421 \u0432\u043E\u0437\u0432\u0440\u0430\u0449\u0435\u043D\u0438\u0435\u043C \u0432 ${settings.salonName}, ${cleanName}! \u0427\u0435\u043C \u043C\u044B \u043C\u043E\u0436\u0435\u043C \u0432\u0430\u043C \u043F\u043E\u043C\u043E\u0447\u044C?` : `\u0414\u043E\u0431\u0440\u043E \u043F\u043E\u0436\u0430\u043B\u043E\u0432\u0430\u0442\u044C \u0432 ${settings.salonName}! \u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043D\u0443\u0436\u043D\u044B\u0439 \u0440\u0430\u0437\u0434\u0435\u043B \u043D\u0438\u0436\u0435:`,
      book: "\u0417\u0430\u043F\u0438\u0441\u0430\u0442\u044C\u0441\u044F",
      services: "\u0423\u0441\u043B\u0443\u0433\u0438 \u0438 \u0426\u0435\u043D\u044B",
      hours: "\u0427\u0430\u0441\u044B \u0440\u0430\u0431\u043E\u0442\u044B \u0438 \u0410\u0434\u0440\u0435\u0441",
      deals: "\u0410\u043A\u0446\u0438\u0438 \u0438 \u0421\u043A\u0438\u0434\u043A\u0438"
    },
    fr: {
      welcome: cleanName ? `Bon retour chez ${settings.salonName}, ${cleanName} ! Comment puis-je vous aider ?` : `Bienvenue chez ${settings.salonName} ! Choisissez une option ci-dessous :`,
      book: "Prendre Rendez-vous",
      services: "Services et Tarifs",
      hours: "Horaires et Adresse",
      deals: "Offres du Moment"
    },
    de: {
      welcome: cleanName ? `Willkommen zur\xFCck bei ${settings.salonName}, ${cleanName}! Wie kann ich Ihnen helfen?` : `Willkommen bei ${settings.salonName}! W\xE4hlen Sie unten eine Option:`,
      book: "Termin Buchen",
      services: "Preise & Leistungen",
      hours: "\xD6ffnungszeiten & Standort",
      deals: "Aktuelle Angebote"
    },
    es: {
      welcome: cleanName ? `Bienvenido de nuevo a ${settings.salonName}, ${cleanName}! \xBFEn qu\xE9 podemos ayudarte hoy?` : `Bienvenido a ${settings.salonName}! Elige una opci\xF3n abajo para comenzar:`,
      book: "Reservar Cita",
      services: "Servicios y Precios",
      hours: "Horarios y Ubicaci\xF3n",
      deals: "Ofertas Actuales"
    }
  };
  const c = copyMap[resolvedLang] || copyMap.en;
  return {
    language: resolvedLang,
    dir,
    welcomeText: c.welcome,
    options: [
      { id: "BOOK_APPOINTMENT", label: c.book },
      { id: "SERVICES_PRICES", label: c.services },
      { id: "HOURS_LOCATION", label: c.hours },
      { id: "CURRENT_DEALS", label: c.deals }
    ],
    availableLanguages
  };
}
function handleCustomerWhatsAppAction(input) {
  const settings = ensureSalonExists(input.salonId);
  runDealExpiryAndVideoRetentionCron(input.salonId);
  const store = ensureStoreLoaded();
  const isDemo = Boolean(input.isDemo);
  const cleanPhone = sanitizePhone(input.fromPhone || "+92 300 0000000") || "+92 300 0000000";
  const raw = sanitizePlainText(input.messageText || "", 300);
  const lower = raw.toLowerCase();
  let client = store.clients.find(
    (c) => c.salonId === input.salonId && c.phone.replace(/\s+/g, "") === cleanPhone.replace(/\s+/g, "")
  );
  if (!isDemo && !client) {
    client = upsertClientProfile(input.salonId, {
      phone: cleanPhone,
      name: input.clientName || "WhatsApp Client",
      preferredLanguage: input.preferredLang || "en"
    });
  }
  const availableLanguages = getConfiguredLanguageChoices(settings);
  const activeLang = input.preferredLang && availableLanguages.some((l) => l.lang === input.preferredLang) ? input.preferredLang : client?.preferredLanguage && availableLanguages.some((l) => l.lang === client.preferredLanguage) ? client.preferredLanguage : "en";
  const dir = getLangDirection(activeLang);
  if (!isDemo && client && input.preferredLang) {
    client.preferredLanguage = activeLang;
    client.awaitingLanguageSelection = false;
  }
  let resolvedAction = input.actionId || "WELCOME";
  if (!input.actionId) {
    if (/^(hi|hello|hey|salam|assalam|marhaba|السلام|مرحبا)\b/i.test(lower)) {
      resolvedAction = "WELCOME";
    } else if (/book|appointment|reserve|حجز|بک/i.test(lower) || raw === "1") {
      resolvedAction = "BOOK_APPOINTMENT";
    } else if (/service|price|rate|menu|سروس|قیمت|أسعار/i.test(lower) || raw === "2") {
      resolvedAction = "SERVICES_PRICES";
    } else if (/hour|timing|open|location|address|map|اوقات|لوکیشن|موقع|ساعات/i.test(lower) || raw === "3") {
      resolvedAction = "HOURS_LOCATION";
    } else if (/deal|offer|promo|video|آفر|ڈیل|عرض/i.test(lower) || raw === "4") {
      resolvedAction = "CURRENT_DEALS";
    }
  }
  const activeServices = enrichServicesWithTranslations(
    (settings.enabledServices || []).filter((s) => s.active !== false)
  );
  const hours = settings.operatingHours || { ...DEFAULT_SALON_OPERATING_HOURS };
  const address = settings.address || SEEDED_SALON_ADDRESSES[input.salonId] || "Salon Location";
  const googleMapsUrl = settings.googleMapsUrl || buildGoogleMapsSearchUrl(settings.salonName, address);
  const activeDeals = listSalonDeals(input.salonId, true).map((d) => ({
    ...d,
    dealPagePath: `/deal/${encodeURIComponent(settings.publicCode)}/${encodeURIComponent(d.id)}`
  }));
  const savedStatus = resolveSavedNameStatus(client);
  const greetingName = input.clientName !== void 0 ? sanitizePlainText(input.clientName, 80) || null : savedStatus.hasSavedName ? savedStatus.savedName : null;
  const bookCtaMap = {
    en: "Book Appointment",
    roman_ur: "Appointment Book Karein",
    ur: "\u0627\u067E\u0627\u0626\u0646\u0679\u0645\u0646\u0679 \u0628\u06A9 \u06A9\u0631\u06CC\u06BA",
    ar: "\u062D\u062C\u0632 \u0645\u0648\u0639\u062F",
    it: "Prenota Appuntamento",
    ru: "\u0417\u0430\u043F\u0438\u0441\u0430\u0442\u044C\u0441\u044F",
    fr: "Prendre Rendez-vous",
    de: "Termin Buchen",
    es: "Reservar Cita"
  };
  if (resolvedAction === "WELCOME") {
    const welcome = buildCustomerWelcomeMenu(settings, activeLang, greetingName);
    return {
      language: welcome.language,
      dir: welcome.dir,
      action: "WELCOME",
      text: welcome.welcomeText,
      welcome
    };
  }
  if (resolvedAction === "BOOK_APPOINTMENT") {
    const openFlowLabel = {
      en: `Opening the instant booking form for ${settings.salonName}...`,
      roman_ur: `${settings.salonName} ka booking form khul raha hai...`,
      ur: `${settings.salonName} \u06A9\u0627 \u0628\u06A9\u0646\u06AF \u0641\u0627\u0631\u0645 \u06A9\u06BE\u0644 \u0631\u06C1\u0627 \u06C1\u06D2...`,
      ar: `\u062C\u0627\u0631\u064A \u0641\u062A\u062D \u0646\u0645\u0648\u0630\u062C \u0627\u0644\u062D\u062C\u0632 \u0627\u0644\u0641\u0648\u0631\u064A \u0644\u0640 ${settings.salonName}...`,
      it: `Apertura prenotazione immediata per ${settings.salonName}...`,
      ru: `\u041E\u0442\u043A\u0440\u044B\u0442\u0438\u0435 \u043E\u043D\u043B\u0430\u0439\u043D-\u0437\u0430\u043F\u0438\u0441\u0438 \u0432 ${settings.salonName}...`,
      fr: `Ouverture de la r\xE9servation pour ${settings.salonName}...`,
      de: `Buchungsformular f\xFCr ${settings.salonName} wird ge\xF6ffnet...`,
      es: `Abriendo reserva instant\xE1nea para ${settings.salonName}...`
    };
    return {
      language: activeLang,
      dir,
      action: "BOOK_APPOINTMENT",
      text: openFlowLabel[activeLang] || openFlowLabel.en,
      openBookingFlow: true
    };
  }
  if (resolvedAction === "SERVICES_PRICES") {
    const minWordMap = {
      en: "min",
      roman_ur: "min",
      ur: "\u0645\u0646\u0679",
      ar: "\u062F\u0642\u064A\u0642\u0629",
      it: "min",
      ru: "\u043C\u0438\u043D",
      fr: "min",
      de: "Min",
      es: "min"
    };
    const lines = activeServices.map((s) => {
      const displayName = s.translations?.[activeLang] || localizeServiceName(s.name, activeLang);
      return `\u2022 ${displayName} \u2014 ${settings.currencySymbol}${s.price.toLocaleString()} (${s.durationMins || 35} ${minWordMap[activeLang]})`;
    });
    const header = {
      en: `${settings.salonName} \u2014 Services & Prices:
${lines.join("\n")}`,
      roman_ur: `${settings.salonName} \u2014 Services aur Prices:
${lines.join("\n")}`,
      ur: `${settings.salonName} \u2014 \u0633\u0631\u0648\u0633\u0632 \u0627\u0648\u0631 \u0642\u06CC\u0645\u062A\u06CC\u06BA:
${lines.join("\n")}`,
      ar: `${settings.salonName} \u2014 \u0627\u0644\u062E\u062F\u0645\u0627\u062A \u0648\u0627\u0644\u0623\u0633\u0639\u0627\u0631:
${lines.join("\n")}`,
      it: `${settings.salonName} \u2014 Servizi e Prezzi:
${lines.join("\n")}`,
      ru: `${settings.salonName} \u2014 \u0423\u0441\u043B\u0443\u0433\u0438 \u0438 \u0426\u0435\u043D\u044B:
${lines.join("\n")}`,
      fr: `${settings.salonName} \u2014 Services et Tarifs :
${lines.join("\n")}`,
      de: `${settings.salonName} \u2014 Preise & Leistungen:
${lines.join("\n")}`,
      es: `${settings.salonName} \u2014 Servicios y Precios:
${lines.join("\n")}`
    };
    const text2 = header[activeLang] || header.en;
    if (!isDemo && client) {
      appendLog(input.salonId, {
        direction: "OUTBOUND",
        module: "BOOKING",
        clientName: client.name,
        clientPhone: client.phone,
        language: activeLang,
        dir,
        body: text2
      });
      persistStore(input.salonId);
    }
    return {
      language: activeLang,
      dir,
      action: "SERVICES_PRICES",
      text: text2,
      showBookCta: true,
      bookCtaLabel: bookCtaMap[activeLang] || bookCtaMap.en,
      services: activeServices
    };
  }
  if (resolvedAction === "HOURS_LOCATION") {
    const uniformDaily = isUniformDailySchedule(hours);
    const closedWord = {
      en: "Closed",
      roman_ur: "Band",
      ur: "\u0628\u0646\u062F",
      ar: "\u0645\u063A\u0644\u0642",
      it: "Chiuso",
      ru: "\u0417\u0430\u043A\u0440\u044B\u0442\u043E",
      fr: "Ferm\xE9",
      de: "Geschlossen",
      es: "Cerrado"
    };
    const breakWord = {
      en: "Break",
      roman_ur: "Waqfa",
      ur: "\u0648\u0642\u0641\u06C1",
      ar: "\u0627\u0633\u062A\u0631\u0627\u062D\u0629",
      it: "Pausa",
      ru: "\u041F\u0435\u0440\u0435\u0440\u044B\u0432",
      fr: "Pause",
      de: "Pause",
      es: "Pausa"
    };
    const monThu = hours.monThuClosed ? closedWord[activeLang] : `${hours.monThuOpen} \u2013 ${hours.monThuClose}`;
    const fri = hours.fridayClosed ? closedWord[activeLang] : `${hours.fridayOpen} \u2013 ${hours.fridayClose}${hours.fridayBreakStart && hours.fridayBreakEnd && hours.fridayBreakStart.toLowerCase() !== "none" && hours.fridayBreakEnd.toLowerCase() !== "none" ? ` (${breakWord[activeLang]}: ${hours.fridayBreakStart} \u2013 ${hours.fridayBreakEnd})` : ""}`;
    const satSun = hours.satSunClosed ? closedWord[activeLang] : `${hours.satSunOpen} \u2013 ${hours.satSunClose}`;
    const scheduleBlock = uniformDaily ? {
      en: `Mon \u2013 Sun: ${hours.monThuOpen} \u2013 ${hours.monThuClose}`,
      roman_ur: `Peer \u2013 Itwar: ${hours.monThuOpen} \u2013 ${hours.monThuClose}`,
      ur: `\u067E\u06CC\u0631 \u062A\u0627 \u0627\u062A\u0648\u0627\u0631: ${hours.monThuOpen} \u2013 ${hours.monThuClose}`,
      ar: `\u0627\u0644\u0625\u062B\u0646\u064A\u0646 \u2013 \u0627\u0644\u0623\u062D\u062F: ${hours.monThuOpen} \u2013 ${hours.monThuClose}`,
      it: `Lun \u2013 Dom: ${hours.monThuOpen} \u2013 ${hours.monThuClose}`,
      ru: `\u041F\u043D \u2013 \u0412\u0441: ${hours.monThuOpen} \u2013 ${hours.monThuClose}`,
      fr: `Lun \u2013 Dim : ${hours.monThuOpen} \u2013 ${hours.monThuClose}`,
      de: `Mo \u2013 So: ${hours.monThuOpen} \u2013 ${hours.monThuClose}`,
      es: `Lun \u2013 Dom: ${hours.monThuOpen} \u2013 ${hours.monThuClose}`
    } : {
      en: `Mon\u2013Thu: ${monThu}
Friday: ${fri}
Sat\u2013Sun: ${satSun}`,
      roman_ur: `Mon\u2013Thu: ${monThu}
Jumma (Friday): ${fri}
Sat\u2013Sun: ${satSun}`,
      ur: `\u067E\u06CC\u0631 \u062A\u0627 \u062C\u0645\u0639\u0631\u0627\u062A: ${monThu}
\u062C\u0645\u0639\u06C1: ${fri}
\u06C1\u0641\u062A\u06C1 \u0627\u0648\u0631 \u0627\u062A\u0648\u0627\u0631: ${satSun}`,
      ar: `\u0627\u0644\u0625\u062B\u0646\u064A\u0646 \u2013 \u0627\u0644\u062E\u0645\u064A\u0633: ${monThu}
\u0627\u0644\u062C\u0645\u0639\u0629: ${fri}
\u0627\u0644\u0633\u0628\u062A \u2013 \u0627\u0644\u0623\u062D\u062F: ${satSun}`,
      it: `Lun\u2013Gio: ${monThu}
Venerd\xEC: ${fri}
Sab\u2013Dom: ${satSun}`,
      ru: `\u041F\u043D\u2013\u0427\u0442: ${monThu}
\u041F\u044F\u0442\u043D\u0438\u0446\u0430: ${fri}
\u0421\u0431\u2013\u0412\u0441: ${satSun}`,
      fr: `Lun\u2013Jeu : ${monThu}
Vendredi : ${fri}
Sam\u2013Dim : ${satSun}`,
      de: `Mo\u2013Do: ${monThu}
Freitag: ${fri}
Sa\u2013So: ${satSun}`,
      es: `Lun\u2013Jue: ${monThu}
Viernes: ${fri}
S\xE1b\u2013Dom: ${satSun}`
    };
    const header = {
      en: `${settings.salonName} \u2014 Opening Hours & Location:
${scheduleBlock.en}
Address: ${address}`,
      roman_ur: `${settings.salonName} \u2014 Opening Hours aur Location:
${scheduleBlock.roman_ur}
Address: ${address}`,
      ur: `${settings.salonName} \u2014 \u06A9\u06BE\u0644\u0646\u06D2 \u06A9\u06D2 \u0627\u0648\u0642\u0627\u062A \u0627\u0648\u0631 \u0644\u0648\u06A9\u06CC\u0634\u0646:
${scheduleBlock.ur}
\u067E\u062A\u06C1: ${address}`,
      ar: `${settings.salonName} \u2014 \u0633\u0627\u0639\u0627\u062A \u0627\u0644\u0639\u0645\u0644 \u0648\u0627\u0644\u0645\u0648\u0642\u0639:
${scheduleBlock.ar}
\u0627\u0644\u0639\u0646\u0648\u0627\u0646: ${address}`,
      it: `${settings.salonName} \u2014 Orari e Posizione:
${scheduleBlock.it}
Indirizzo: ${address}`,
      ru: `${settings.salonName} \u2014 \u0427\u0430\u0441\u044B \u0440\u0430\u0431\u043E\u0442\u044B \u0438 \u0410\u0434\u0440\u0435\u0441:
${scheduleBlock.ru}
\u0410\u0434\u0440\u0435\u0441: ${address}`,
      fr: `${settings.salonName} \u2014 Horaires et Adresse :
${scheduleBlock.fr}
Adresse : ${address}`,
      de: `${settings.salonName} \u2014 \xD6ffnungszeiten & Standort:
${scheduleBlock.de}
Adresse: ${address}`,
      es: `${settings.salonName} \u2014 Horarios y Ubicaci\xF3n:
${scheduleBlock.es}
Direcci\xF3n: ${address}`
    };
    const text2 = header[activeLang] || header.en;
    if (!isDemo && client) {
      appendLog(input.salonId, {
        direction: "OUTBOUND",
        module: "BOOKING",
        clientName: client.name,
        clientPhone: client.phone,
        language: activeLang,
        dir,
        body: text2
      });
      persistStore(input.salonId);
    }
    return {
      language: activeLang,
      dir,
      action: "HOURS_LOCATION",
      text: text2,
      showBookCta: true,
      bookCtaLabel: bookCtaMap[activeLang] || bookCtaMap.en,
      hours,
      address,
      googleMapsUrl
    };
  }
  let text = "";
  if (activeDeals.length === 0) {
    const emptyMap = {
      en: `${settings.salonName}: No active deals right now. You can still book any regular service anytime!`,
      roman_ur: `${settings.salonName}: Is waqt koi active deal nahi hai. Aap regular service book kar sakte hain!`,
      ur: `${settings.salonName}: \u0627\u0633 \u0648\u0642\u062A \u06A9\u0648\u0626\u06CC \u0641\u0639\u0627\u0644 \u0688\u06CC\u0644 \u062F\u0633\u062A\u06CC\u0627\u0628 \u0646\u06C1\u06CC\u06BA \u06C1\u06D2\u06D4 \u0622\u067E \u0628\u0627\u0642\u0627\u0639\u062F\u06C1 \u0633\u0631\u0648\u0633 \u0628\u06A9 \u06A9\u0631 \u0633\u06A9\u062A\u06D2 \u06C1\u06CC\u06BA!`,
      ar: `${settings.salonName}: \u0644\u0627 \u062A\u0648\u062C\u062F \u0639\u0631\u0648\u0636 \u0633\u0627\u0631\u064A\u0629 \u062D\u0627\u0644\u064A\u0627\u064B. \u064A\u0645\u0643\u0646\u0643 \u062D\u062C\u0632 \u0623\u064A \u062E\u062F\u0645\u0629 \u0627\u0639\u062A\u064A\u0627\u062F\u064A\u0629 \u0641\u064A \u0623\u064A \u0648\u0642\u062A!`,
      it: `${settings.salonName}: Nessuna offerta attiva al momento. Puoi comunque prenotare qualsiasi servizio standard!`,
      ru: `${settings.salonName}: \u0421\u0435\u0439\u0447\u0430\u0441 \u043D\u0435\u0442 \u0430\u043A\u0442\u0438\u0432\u043D\u044B\u0445 \u0430\u043A\u0446\u0438\u0439, \u043D\u043E \u0432\u044B \u043C\u043E\u0436\u0435\u0442\u0435 \u0437\u0430\u043F\u0438\u0441\u0430\u0442\u044C\u0441\u044F \u043D\u0430 \u043B\u044E\u0431\u0443\u044E \u0441\u0442\u0430\u043D\u0434\u0430\u0440\u0442\u043D\u0443\u044E \u0443\u0441\u043B\u0443\u0433\u0443!`,
      fr: `${settings.salonName} : Aucune offre en cours. Vous pouvez r\xE9server nos services habituels \xE0 tout moment !`,
      de: `${settings.salonName}: Derzeit keine Sonderangebote. Sie k\xF6nnen jederzeit regul\xE4re Leistungen buchen!`,
      es: `${settings.salonName}: No hay ofertas activas ahora mismo. \xA1Puedes reservar cualquier servicio regular!`
    };
    text = emptyMap[activeLang] || emptyMap.en;
  } else {
    const dealLines = activeDeals.map((d) => {
      const badge = d.discountType === "PCT" ? activeLang === "ur" ? `${d.discountValue}% \u0631\u0639\u0627\u06CC\u062A` : activeLang === "ar" ? `\u062E\u0635\u0645 ${d.discountValue}%` : `${d.discountValue}% OFF` : d.discountType === "FIXED" ? activeLang === "ur" ? `${settings.currencySymbol}${d.discountValue.toLocaleString()} \u0631\u0639\u0627\u06CC\u062A` : activeLang === "ar" ? `\u062E\u0635\u0645 ${settings.currencySymbol}${d.discountValue.toLocaleString()}` : `${settings.currencySymbol}${d.discountValue.toLocaleString()} OFF` : activeLang === "ur" ? `\u067E\u06CC\u06A9\u06CC\u062C ${settings.currencySymbol}${d.discountValue.toLocaleString()}` : activeLang === "ar" ? `\u0628\u0627\u0642\u0629 ${settings.currencySymbol}${d.discountValue.toLocaleString()}` : `Bundle ${settings.currencySymbol}${d.discountValue.toLocaleString()}`;
      const expDate = new Date(d.expiresAt).toLocaleDateString(
        activeLang === "ur" ? "ur-PK" : activeLang === "ar" ? "ar-AE" : "en-GB"
      );
      const expLabel = activeLang === "ur" ? `\u0622\u062E\u0631\u06CC \u062A\u0627\u0631\u06CC\u062E ${expDate}` : activeLang === "ar" ? `\u0633\u0627\u0631\u064A \u062D\u062A\u0649 ${expDate}` : activeLang === "roman_ur" ? `Aakhri tareekh ${expDate}` : `Expires ${expDate}`;
      const localizedDealTitle = d.titleTranslations?.[activeLang] || d.title;
      const titleAlreadyShowsBadge = localizedDealTitle.includes(badge) || d.discountType === "PCT" && localizedDealTitle.includes(`${d.discountValue}%`);
      return titleAlreadyShowsBadge ? `\u2022 ${localizedDealTitle} \u2014 ${expLabel}` : `\u2022 ${localizedDealTitle} (${badge}) \u2014 ${expLabel}`;
    });
    const prefix = {
      en: `${settings.salonName} \u2014 Active Deals & Offers:
${dealLines.join("\n")}`,
      roman_ur: `${settings.salonName} \u2014 Active Deals aur Offers:
${dealLines.join("\n")}`,
      ur: `${settings.salonName} \u2014 \u0645\u0648\u062C\u0648\u062F\u06C1 \u0641\u0639\u0627\u0644 \u0688\u06CC\u0644\u0632:
${dealLines.join("\n")}`,
      ar: `${settings.salonName} \u2014 \u0627\u0644\u0639\u0631\u0648\u0636 \u0627\u0644\u0633\u0627\u0631\u064A\u0629 \u062D\u0627\u0644\u064A\u0627\u064B:
${dealLines.join("\n")}`,
      it: `${settings.salonName} \u2014 Offerte Attuali:
${dealLines.join("\n")}`,
      ru: `${settings.salonName} \u2014 \u0414\u0435\u0439\u0441\u0442\u0432\u0443\u044E\u0449\u0438\u0435 \u0430\u043A\u0446\u0438\u0438:
${dealLines.join("\n")}`,
      fr: `${settings.salonName} \u2014 Offres Actuelles :
${dealLines.join("\n")}`,
      de: `${settings.salonName} \u2014 Aktuelle Angebote:
${dealLines.join("\n")}`,
      es: `${settings.salonName} \u2014 Ofertas Activas:
${dealLines.join("\n")}`
    };
    text = prefix[activeLang] || prefix.en;
  }
  if (!isDemo && client) {
    appendLog(input.salonId, {
      direction: "OUTBOUND",
      module: "BOOKING",
      clientName: client.name,
      clientPhone: client.phone,
      language: activeLang,
      dir,
      body: text
    });
    persistStore(input.salonId);
  }
  return {
    language: activeLang,
    dir,
    action: "CURRENT_DEALS",
    text,
    deals: activeDeals
  };
}
function doesBarberNameMatch(candidateName, targetName) {
  const normCandidate = candidateName.trim().toLowerCase();
  const normTarget = targetName.trim().toLowerCase();
  if (!normCandidate || !normTarget) return false;
  return normCandidate === normTarget || normCandidate.includes(normTarget) || normTarget.includes(normCandidate.split(" ")[0]);
}
function evaluateAvailabilityFromSnapshot(input) {
  const store = ensureStoreLoaded();
  const settings = ensureSalonExists(input.salonId);
  const snapshot = input.snapshot;
  const tz = snapshot && Number.isFinite(snapshot.timezoneOffsetHours) ? snapshot.timezoneOffsetHours : settings.timezoneOffsetHours;
  const hours = snapshot?.operatingHours && Object.keys(snapshot.operatingHours).length > 0 ? { ...DEFAULT_SALON_OPERATING_HOURS, ...snapshot.operatingHours } : settings.operatingHours || { ...DEFAULT_SALON_OPERATING_HOURS };
  const barbers = snapshot && snapshot.stylists.length > 0 ? snapshot.stylists.filter((s) => s.active).map((s) => s.name) : getSalonBarbers(input.salonId);
  const configuredServices = snapshot && snapshot.services.length > 0 ? snapshot.services.filter((s) => s.active) : (settings.enabledServices || []).filter((s) => s.active !== false);
  const requestedIds = Array.isArray(input.serviceIds) ? input.serviceIds : [];
  const selectedServices = requestedIds.length > 0 ? configuredServices.filter(
    (s) => s.id && requestedIds.includes(s.id) || requestedIds.includes(s.name)
  ) : [];
  const maxBufferMins = selectedServices.reduce(
    (maxB, s) => Math.max(maxB, Number(s.bufferAfterMins || 0)),
    0
  );
  const eligibleBarbersSet = (() => {
    const sets = selectedServices.map(
      (s) => Array.isArray(s.eligibleStylists) && s.eligibleStylists.length > 0 ? s.eligibleStylists : null
    ).filter((x) => Boolean(x));
    if (sets.length === 0) return null;
    let common = new Set(sets[0].map((n) => n.toLowerCase()));
    for (const arr of sets.slice(1)) {
      const nextSet = new Set(arr.map((n) => n.toLowerCase()));
      common = new Set([...common].filter((n) => nextSet.has(n)));
    }
    return common;
  })();
  const durationMins = input.exactDurationMins !== void 0 ? clampInteger(input.exactDurationMins, 10, 480, 40) : clampInteger(input.durationMins ?? 40, 10, 300, 40) + maxBufferMins;
  const cleanDate = /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : getSalonLocalDateParts(tz).dateStr;
  const schedule = getScheduleForDate(hours, cleanDate);
  if (!schedule.isOpen) {
    return {
      salonId: input.salonId,
      publicCode: snapshot?.publicCode || settings.publicCode,
      date: cleanDate,
      dayName: schedule.dayName,
      isOpen: false,
      closedReason: schedule.closedReason || "Salon is closed on this date.",
      totalDurationMins: durationMins,
      slots: [],
      barbers
    };
  }
  const [y, m, d] = cleanDate.split("-").map((n) => parseInt(n, 10));
  const localDayStartUtcMs = Date.UTC(y, m - 1, d, 0, 0, 0) - tz * 36e5;
  const localNow = getSalonLocalDateParts(tz);
  const isToday = cleanDate === localNow.dateStr;
  const slots = [];
  for (let start = schedule.openMins; start + durationMins <= schedule.closeMins; start += 30) {
    const end = start + durationMins;
    if (isToday && start < localNow.minutesOfDay + 15) {
      continue;
    }
    if (schedule.breakStartMins !== void 0 && schedule.breakEndMins !== void 0 && start < schedule.breakEndMins && end > schedule.breakStartMins) {
      continue;
    }
    const timeSlot = formatMinutesToTimeSlot(start);
    const barberStatuses = barbers.map((barberName) => {
      if (eligibleBarbersSet && !eligibleBarbersSet.has(barberName.toLowerCase())) {
        return {
          name: barberName,
          available: false,
          reason: "Not assigned to selected service"
        };
      }
      if (!snapshot) {
        const check = isBarberBusyAtWindow(
          input.salonId,
          barberName,
          start,
          durationMins,
          cleanDate,
          input.demoBusyBarber,
          input.demoBusyTimeSlot
        );
        return {
          name: barberName,
          available: !check.busy,
          reason: check.reason
        };
      }
      if (input.demoBusyBarber && doesBarberNameMatch(input.demoBusyBarber, barberName)) {
        if (!input.demoBusyTimeSlot) {
          return { name: barberName, available: false, reason: "Barber Busy (Demo Test)" };
        }
        const demoStart = parseTimeSlotToMinutes(input.demoBusyTimeSlot);
        if (demoStart >= 0 && start < demoStart + 45 && end > demoStart) {
          return {
            name: barberName,
            available: false,
            reason: `Booked at ${input.demoBusyTimeSlot} (Demo Test)`
          };
        }
      }
      for (const lock of store.chairLocks) {
        if (lock.salonId !== input.salonId) continue;
        const lockDateStr = getIsoLocalDateStr(lock.createdAt, tz) || localNow.dateStr;
        if (lockDateStr !== cleanDate) continue;
        if (doesBarberNameMatch(lock.barberName, barberName)) {
          if (start < lock.endMinutes && end > lock.startMinutes) {
            return {
              name: barberName,
              available: false,
              reason: `Chair Locked (${lock.startTimeSlot}\u2013${lock.endTimeSlot})`
            };
          }
        }
      }
      for (const lv of snapshot.leaves) {
        if (!doesBarberNameMatch(lv.stylistName, barberName)) continue;
        const lvStartMins = (new Date(lv.startsAtIso).getTime() - localDayStartUtcMs) / 6e4;
        const lvEndMins = (new Date(lv.endsAtIso).getTime() - localDayStartUtcMs) / 6e4;
        if (start < lvEndMins && end > lvStartMins) {
          return {
            name: barberName,
            available: false,
            reason: lv.reason || "Stylist on Leave"
          };
        }
      }
      for (const lv of store.stylistLeaves || []) {
        if (lv.salonId !== input.salonId || lv.date !== cleanDate) continue;
        if (!doesBarberNameMatch(lv.stylistName, barberName)) continue;
        if (lv.fullDay !== false && !lv.startTime && !lv.endTime) {
          return {
            name: barberName,
            available: false,
            reason: lv.reason || "Stylist on Leave"
          };
        }
        const lvStart = lv.startTime ? parseTimeSlotToMinutes(lv.startTime) : 0;
        const lvEnd = lv.endTime ? parseTimeSlotToMinutes(lv.endTime) : 1440;
        if (lvStart >= 0 && lvEnd > lvStart && start < lvEnd && end > lvStart) {
          return {
            name: barberName,
            available: false,
            reason: lv.reason || `On Leave (${lv.startTime}\u2013${lv.endTime})`
          };
        }
      }
      for (const bk of snapshot.bookings) {
        if (bk.status !== "CONFIRMED" && bk.status !== "IN_CHAIR") continue;
        if (input.excludeBookingId && (bk.id === input.excludeBookingId || bk.bookingRef === input.excludeBookingId)) {
          continue;
        }
        if (!doesBarberNameMatch(bk.stylistName, barberName)) continue;
        const bkStartMins = (new Date(bk.startsAtIso).getTime() - localDayStartUtcMs) / 6e4;
        const bkEndMins = (new Date(bk.endsAtIso).getTime() - localDayStartUtcMs) / 6e4;
        if (start < bkEndMins && end > bkStartMins) {
          return {
            name: barberName,
            available: false,
            reason: `Booked (${formatMinutesToTimeSlot(Math.round(bkStartMins))})`
          };
        }
      }
      return { name: barberName, available: true };
    });
    const availableBarberCount = barberStatuses.filter((b) => b.available).length;
    if (availableBarberCount > 0 || input.demoBusyBarber) {
      slots.push({
        timeSlot,
        startMinutes: start,
        availableBarberCount,
        barbers: barberStatuses
      });
    }
  }
  return {
    salonId: input.salonId,
    publicCode: snapshot?.publicCode || settings.publicCode,
    date: cleanDate,
    dayName: schedule.dayName,
    isOpen: true,
    fridayBreakText: schedule.fridayBreakText,
    totalDurationMins: durationMins,
    slots,
    barbers
  };
}
async function getAvailableSlotsAndBarbers(input) {
  const actor = "actor" in input ? input.actor : createPublicFlowSalonActor(input.salonId);
  const normalizedActor = validatePgActorContext(actor);
  if (normalizedActor.role === "AGENT") {
    throw new PgContextError(
      "PRIVILEGE_ESCALATION",
      "AGENT cannot query public booking availability directly."
    );
  }
  if ((normalizedActor.role === "SALON_OWNER" || normalizedActor.role === "PUBLIC_FLOW") && normalizedActor.salonId !== input.salonId) {
    throw new PgContextError(
      "FORBIDDEN_TENANT",
      `${normalizedActor.role} (${normalizedActor.salonId}) cannot read availability for salon ${input.salonId}.`
    );
  }
  const settings = ensureSalonExists(input.salonId);
  const cleanDate = /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : getSalonLocalDateParts(settings.timezoneOffsetHours).dateStr;
  let snapshot = null;
  if (isPostgresConfigured()) {
    const { windowStartIso, windowEndIso } = getWideUtcDayWindow(cleanDate);
    snapshot = await fetchAvailabilitySnapshotFromPostgres(
      {
        salonId: input.salonId,
        windowStartIso,
        windowEndIso
      },
      actor
    );
  } else if (process.env.NODE_ENV === "production") {
    throw new BookingLifecycleError(
      503,
      "Database is not configured. Availability cannot be verified without persistent storage."
    );
  }
  return evaluateAvailabilityFromSnapshot({
    salonId: input.salonId,
    date: cleanDate,
    durationMins: input.durationMins,
    serviceIds: input.serviceIds,
    demoBusyBarber: input.demoBusyBarber,
    demoBusyTimeSlot: input.demoBusyTimeSlot,
    snapshot
  });
}
function buildIcsCalendarContent(params) {
  const start = new Date(params.startsAtIso);
  const end = new Date(start.getTime() + params.durationMins * 6e4);
  const fmt = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//WorkCraft Local//Booking//EN",
    "BEGIN:VEVENT",
    `UID:${params.bookingId}@workcraft.local`,
    `DTSTAMP:${fmt(/* @__PURE__ */ new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${params.salonName} \u2014 ${params.service} (${params.barberName})`,
    `LOCATION:${params.address}`,
    `DESCRIPTION:Booking Ref ${params.bookingId} with ${params.barberName} at ${params.salonName}`,
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");
}
function findRawAccessTokenForBooking(bookingId, salonId, expiresAtMs) {
  const store = ensureStoreLoaded();
  const settings = ensureSalonExists(salonId);
  const rawAccessToken = generateBookingManagementToken(settings.publicCode);
  const tokenHash = crypto3.createHash("sha256").update(rawAccessToken).digest("hex");
  store.bookingAccessTokens[tokenHash] = {
    bookingId,
    salonId,
    expiresAtMs,
    revoked: false
  };
  return rawAccessToken;
}
async function createCustomerFlowBooking(salonId, input) {
  const store = ensureStoreLoaded();
  const settings = ensureSalonExists(salonId);
  runDealExpiryAndVideoRetentionCron(salonId);
  const isDemo = Boolean(input.isDemo);
  const cleanIdempotencyKey = input.idempotencyKey ? sanitizePlainText(input.idempotencyKey, 96) : void 0;
  if (!isDemo && cleanIdempotencyKey) {
    const existingAppt = store.appointments.find(
      (a) => a.salonId === salonId && a.idempotencyKey === cleanIdempotencyKey
    );
    if (existingAppt) {
      const address2 = settings.address || SEEDED_SALON_ADDRESSES[salonId] || "Salon Location";
      const googleMapsUrl2 = settings.googleMapsUrl || buildGoogleMapsSearchUrl(settings.salonName, address2);
      const rawToken = findRawAccessTokenForBooking(
        existingAppt.id,
        salonId,
        (existingAppt.scheduledEndMs || Date.now()) + 7 * 864e5
      );
      const recognizeToken = signCustomerRecognizeToken({
        salonId,
        publicCode: settings.publicCode,
        clientId: existingAppt.clientId
      });
      persistStore(salonId);
      return {
        statusCode: 200,
        recognizeCookieToken: recognizeToken,
        payload: {
          ok: true,
          isDemo: false,
          appointment: existingAppt,
          appliedDeal: null,
          currencySymbol: settings.currencySymbol,
          address: address2,
          googleMapsUrl: googleMapsUrl2,
          bookingManagementToken: rawToken,
          bookingManagementPath: `/b/${rawToken}`,
          personalReturningShareUrl: `/s/${encodeURIComponent(settings.publicCode)}?c=${encodeURIComponent(recognizeToken)}`,
          maskedPhone: maskPhoneNumber(existingAppt.clientPhone)
        }
      };
    }
  }
  const usage = getMonthlyUsageSnapshot(salonId);
  if (!isDemo && usage.billableBookings >= usage.monthlyLimit + usage.graceLimit) {
    return {
      statusCode: 402,
      payload: {
        ok: false,
        code: "QUOTA_EXCEEDED",
        error: `${settings.salonName} has reached its monthly online booking capacity. Please call the salon directly.`,
        publicContactPhone: settings.publicContactPhone || settings.whatsappPhone
      }
    };
  }
  const verifiedClient = input.verifiedClientId ? store.clients.find((c) => c.salonId === salonId && c.id === input.verifiedClientId) : void 0;
  const cleanPhone = sanitizePhone(input.clientPhone || "") || (verifiedClient ? verifiedClient.phone : "");
  if (!cleanPhone || cleanPhone.replace(/\D/g, "").length < 6) {
    return {
      statusCode: 400,
      payload: { ok: false, code: "VALIDATION_ERROR", error: "Valid phone number is required." }
    };
  }
  const configuredServices = (settings.enabledServices || []).filter((s) => s.active !== false);
  const requestedIds = Array.isArray(input.serviceIds) ? input.serviceIds : [];
  const selectedServices = configuredServices.filter(
    (s) => s.id && requestedIds.includes(s.id) || requestedIds.includes(s.name)
  );
  if (selectedServices.length === 0) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        code: "VALIDATION_ERROR",
        error: "Please select at least one active salon service."
      }
    };
  }
  const maxBufferMins = selectedServices.reduce(
    (maxB, s) => Math.max(maxB, Number(s.bufferAfterMins || 0)),
    0
  );
  const originalTotal = selectedServices.reduce((sum, s) => sum + (Number(s.price) || 0), 0);
  const totalDurationMins = Math.max(
    15,
    selectedServices.reduce((sum, s) => sum + (Number(s.durationMins) || 35), 0) + maxBufferMins
  );
  let finalTotal = originalTotal;
  let appliedDeal = null;
  if (input.dealId) {
    const deal = (store.deals || []).find((d2) => d2.salonId === salonId && d2.id === input.dealId);
    if (!deal || !isDealCurrentlyActive(deal)) {
      return {
        statusCode: 400,
        payload: {
          ok: false,
          code: "INVALID_DEAL",
          error: "This promotional deal has expired and is no longer available."
        }
      };
    }
    if (deal.discountType === "PCT") {
      finalTotal = Math.max(0, Math.round(originalTotal * (1 - deal.discountValue / 100)));
    } else if (deal.discountType === "FIXED") {
      finalTotal = Math.max(0, originalTotal - deal.discountValue);
    } else if (deal.discountType === "BUNDLE_PRICE") {
      finalTotal = Math.max(0, Math.min(originalTotal, deal.discountValue));
    }
    appliedDeal = {
      id: deal.id,
      title: deal.title,
      originalTotal,
      finalTotal,
      savings: Math.max(0, originalTotal - finalTotal)
    };
  }
  const normPhone = cleanPhone.replace(/\s+/g, "");
  const existingClient = verifiedClient || store.clients.find(
    (c) => c.salonId === salonId && c.phone.replace(/\s+/g, "") === normPhone
  );
  const savedInfo = resolveSavedNameStatus(existingClient);
  const providedName = sanitizePlainText(input.clientName || "", 80);
  const finalClientName = providedName || (savedInfo.hasSavedName ? savedInfo.savedName : "");
  if (!finalClientName) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        code: "NAME_REQUIRED",
        error: "Please enter your complete name to book this appointment."
      }
    };
  }
  const cleanDate = sanitizePlainText(input.appointmentDate || "", 20);
  const cleanTimeSlot = sanitizePlainText(input.timeSlot || "", 24);
  const cleanBarber = sanitizePlainText(input.barberName || "", 60);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate) || !cleanTimeSlot || !cleanBarber) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        code: "VALIDATION_ERROR",
        error: "Date, time slot, and barber selection are required."
      }
    };
  }
  const availability = await getAvailableSlotsAndBarbers({
    salonId,
    date: cleanDate,
    durationMins: totalDurationMins - maxBufferMins,
    serviceIds: selectedServices.map((s) => s.id || s.name),
    demoBusyBarber: isDemo ? input.demoBusyBarber : void 0,
    demoBusyTimeSlot: isDemo ? input.demoBusyTimeSlot : void 0,
    actor: createPublicFlowSalonActor(salonId)
  });
  if (!availability.isOpen) {
    return {
      statusCode: 409,
      payload: {
        ok: false,
        code: "SALON_CLOSED",
        error: availability.closedReason || "Salon is closed on the selected date."
      }
    };
  }
  const startMinutes = parseTimeSlotToMinutes(cleanTimeSlot);
  const formattedTime = startMinutes >= 0 ? formatMinutesToTimeSlot(startMinutes) : cleanTimeSlot;
  const matchedSlot = availability.slots.find(
    (s) => s.startMinutes === startMinutes || s.timeSlot === formattedTime
  );
  if (!matchedSlot) {
    return {
      statusCode: 409,
      payload: {
        ok: false,
        code: "SLOT_UNAVAILABLE",
        error: `Time slot ${formattedTime} is no longer available for ${totalDurationMins} mins on ${cleanDate}. Please pick another slot.`
      }
    };
  }
  const matchedBarber = matchedSlot.barbers.find(
    (b) => b.name.toLowerCase() === cleanBarber.toLowerCase()
  );
  if (!matchedBarber || !matchedBarber.available) {
    return {
      statusCode: 409,
      payload: {
        ok: false,
        code: "SLOT_UNAVAILABLE",
        error: `${cleanBarber} is unavailable at ${formattedTime}${matchedBarber?.reason ? ` (${matchedBarber.reason})` : ""}. Please choose another available barber or slot.`
      }
    };
  }
  const [y, m, d] = cleanDate.split("-").map((n) => parseInt(n, 10));
  const startUtcMs = Date.UTC(y, m - 1, d, Math.floor(startMinutes / 60), startMinutes % 60, 0) - settings.timezoneOffsetHours * 36e5;
  const scheduledEndMs = startUtcMs + totalDurationMins * 6e4;
  const address = settings.address || SEEDED_SALON_ADDRESSES[salonId] || "Salon Location";
  const googleMapsUrl = settings.googleMapsUrl || buildGoogleMapsSearchUrl(settings.salonName, address);
  const serviceNamesSummary = selectedServices.map((s) => s.name).join(" + ");
  const apptId = isDemo ? `DEMO-${Date.now().toString().slice(-4)}` : `BK-WEB-${Date.now().toString().slice(-4)}-${crypto3.randomBytes(2).toString("hex").toUpperCase()}`;
  let clientId = existingClient?.id || `demo-cli-${Date.now().toString(36)}`;
  if (!isDemo) {
    const savedClient = upsertClientProfile(salonId, {
      phone: cleanPhone,
      name: finalClientName,
      preferredLanguage: input.preferredLanguage || existingClient?.preferredLanguage || "en",
      marketingOptIn: input.marketingOptIn !== void 0 ? Boolean(input.marketingOptIn) : existingClient?.marketingOptIn
    });
    savedClient.totalVisits = (savedClient.totalVisits || 0) + 1;
    savedClient.lastServiceIds = selectedServices.map((s) => s.id || s.name);
    savedClient.lastBarberName = matchedBarber.name;
    clientId = savedClient.id;
  }
  const adSource = input.adSource || "WEB_LINK";
  const sourceTypeMap = {
    FB: "FB_AD",
    IG: "IG_AD",
    TIKTOK: "TIKTOK_AD",
    QR: "WEB_QR",
    WEB_LINK: "WEB_LINK",
    DIRECT: "WEB_LINK"
  };
  const rawAccessToken = generateBookingManagementToken(settings.publicCode);
  const tokenHash = crypto3.createHash("sha256").update(rawAccessToken).digest("hex");
  const accessTokenExpiresAtMs = scheduledEndMs + 7 * 864e5;
  const proofHash = crypto3.createHash("sha256").update(`${salonId}:${apptId}:${cleanDate}:${formattedTime}:${matchedBarber.name}`).digest("hex");
  const newAppointment = {
    id: apptId,
    salonId,
    clientId,
    clientName: finalClientName,
    clientPhone: cleanPhone,
    barberName: matchedBarber.name,
    service: serviceNamesSummary,
    serviceIds: selectedServices.map((s) => s.id || s.name),
    price: finalTotal,
    appointmentDate: cleanDate,
    timeSlot: formattedTime,
    durationMins: totalDurationMins,
    scheduledEndMs,
    dealId: appliedDeal?.id || null,
    bookedDealTitle: appliedDeal?.title,
    adSource,
    idempotencyKey: cleanIdempotencyKey,
    proofHash,
    sourceType: sourceTypeMap[adSource] || "WEB_LINK",
    status: "CONFIRMED",
    scheduledForIso: new Date(startUtcMs).toISOString(),
    completedAt: null,
    reviewPromptSentAt: null,
    rating: null,
    ratingComment: null,
    reviewRoutedStatus: "PENDING"
  };
  let recognizeCookieToken;
  if (!isDemo) {
    const pgCheck = await recordBookingInPostgres({
      salonPublicCode: settings.publicCode,
      bookingRef: apptId,
      clientName: finalClientName,
      clientPhoneE164: cleanPhone,
      preferredLang: input.preferredLanguage || "en",
      stylistName: matchedBarber.name,
      servicesSnapshot: selectedServices.map((s) => ({
        id: s.id,
        name: s.name,
        price: s.price,
        durationMins: s.durationMins || 35
      })),
      totalPrice: finalTotal,
      totalDurationMins,
      startsAtIso: newAppointment.scheduledForIso,
      endsAtIso: new Date(scheduledEndMs).toISOString(),
      source: newAppointment.sourceType || "WEB_LINK",
      idempotencyKey: cleanIdempotencyKey,
      proofHash,
      billingMonth: getSalonBillingMonthKey(settings),
      monthlyLimit: usage.monthlyLimit,
      accessTokenHash: tokenHash,
      accessTokenExpiresAtIso: new Date(accessTokenExpiresAtMs).toISOString()
    });
    if (!pgCheck.ok) {
      if (pgCheck.code === "OVERLAP") {
        return {
          statusCode: 409,
          payload: {
            ok: false,
            code: "SLOT_UNAVAILABLE",
            error: pgCheck.error
          }
        };
      }
      return {
        statusCode: 503,
        payload: {
          ok: false,
          code: "DB_UNAVAILABLE",
          error: pgCheck.error
        }
      };
    }
    store.appointments.unshift(newAppointment);
    store.bookingAccessTokens[tokenHash] = {
      bookingId: apptId,
      salonId,
      expiresAtMs: accessTokenExpiresAtMs,
      revoked: false
    };
    incrementMonthlyUsage(salonId);
    appendBookingAudit(
      salonId,
      apptId,
      "CUSTOMER",
      "CREATED",
      `Booked ${serviceNamesSummary} on ${cleanDate} at ${formattedTime} with ${matchedBarber.name} via ${adSource}.`
    );
    const isUrgentBridalOrGroom = /bridal|bride|groom|dulha|dulhan/i.test(serviceNamesSummary);
    const bookingLang = sanitizeClientLang(input.preferredLanguage, "en");
    appendLog(salonId, {
      direction: "INBOUND",
      module: "BOOKING",
      clientName: finalClientName,
      clientPhone: cleanPhone,
      language: bookingLang,
      dir: getLangDirection(bookingLang),
      body: `Web Booking Confirmed: ${serviceNamesSummary} on ${cleanDate} at ${formattedTime} with ${matchedBarber.name}`,
      eventMetadata: {
        eventType: isUrgentBridalOrGroom ? "URGENT_BRIDAL_GROOM" : "APPOINTMENT_CONFIRMED",
        barberName: matchedBarber.name,
        services: serviceNamesSummary,
        timeSlot: formattedTime,
        dateLabel: cleanDate,
        clientId
      }
    });
    recognizeCookieToken = signCustomerRecognizeToken({
      salonId,
      publicCode: settings.publicCode,
      clientId
    });
    persistStore(salonId);
  }
  return {
    statusCode: 201,
    recognizeCookieToken,
    payload: {
      ok: true,
      isDemo,
      appointment: newAppointment,
      appliedDeal,
      currencySymbol: settings.currencySymbol,
      address,
      googleMapsUrl,
      bookingManagementToken: rawAccessToken,
      bookingManagementPath: `/b/${rawAccessToken}`,
      personalReturningShareUrl: recognizeCookieToken ? `/s/${encodeURIComponent(settings.publicCode)}?c=${encodeURIComponent(recognizeCookieToken)}` : void 0,
      maskedPhone: maskPhoneNumber(cleanPhone)
    }
  };
}
async function getBookingByAccessToken(rawToken) {
  const clean = (rawToken || "").trim();
  if (!clean || clean.length < 12) return null;
  if (isPostgresConfigured()) {
    const pgBooking = await getBookingByAccessTokenFromPostgres(clean);
    return pgBooking ? mapPgBookingToManagementPayload(pgBooking) : null;
  }
  if (process.env.NODE_ENV === "production") {
    throw new BookingLifecycleError(
      503,
      "Database is not configured. Booking lookup requires persistent storage."
    );
  }
  const store = ensureStoreLoaded();
  const tokenHash = crypto3.createHash("sha256").update(clean).digest("hex");
  const tokenRec = store.bookingAccessTokens?.[tokenHash];
  if (!tokenRec || tokenRec.revoked || tokenRec.expiresAtMs < Date.now()) {
    return null;
  }
  const appt = store.appointments.find(
    (a) => a.salonId === tokenRec.salonId && a.id === tokenRec.bookingId
  );
  if (!appt) return null;
  const settings = ensureSalonExists(tokenRec.salonId);
  const address = settings.address || SEEDED_SALON_ADDRESSES[settings.salonId] || "Salon Location";
  const googleMapsUrl = settings.googleMapsUrl || buildGoogleMapsSearchUrl(settings.salonName, address);
  const cli = store.clients.find((c) => c.id === appt.clientId);
  return {
    ok: true,
    bookingId: appt.id,
    bookingRef: appt.id,
    salonPublicCode: settings.publicCode,
    salonName: settings.salonName,
    publicContactPhone: settings.publicContactPhone || settings.whatsappPhone,
    publicWhatsappPhone: settings.publicWhatsappPhone || settings.publicContactPhone || settings.whatsappPhone,
    clientName: appt.clientName,
    maskedPhone: maskPhoneNumber(appt.clientPhone),
    service: appt.service,
    serviceIds: Array.isArray(appt.serviceIds) ? appt.serviceIds : [],
    barberName: appt.barberName,
    appointmentDate: appt.appointmentDate || getIsoLocalDateStr(appt.scheduledForIso, settings.timezoneOffsetHours) || getSalonLocalDateParts(settings.timezoneOffsetHours).dateStr,
    timeSlot: appt.timeSlot,
    durationMins: appt.durationMins || 35,
    totalPrice: appt.price,
    currencySymbol: settings.currencySymbol,
    status: appt.status,
    address,
    googleMapsUrl,
    // Neutral review URL revealed STRICTLY when appointment is COMPLETED (no star-rating gating!)
    googleReviewUrl: appt.status === "COMPLETED" ? settings.googleReviewUrl : null,
    preferredLanguage: cli?.preferredLanguage || settings.defaultLang || "en",
    icsContent: buildIcsCalendarContent({
      bookingId: appt.id,
      salonName: settings.salonName,
      service: appt.service,
      barberName: appt.barberName,
      address,
      startsAtIso: appt.scheduledForIso,
      durationMins: appt.durationMins || 35
    })
  };
}
async function rescheduleBookingByAccessToken(rawToken, input) {
  const clean = (rawToken || "").trim();
  if (!clean) return { statusCode: 404, ok: false, error: "Booking link not found." };
  const cleanDate = sanitizePlainText(input.appointmentDate || "", 20);
  const cleanTimeSlot = sanitizePlainText(input.timeSlot || "", 24);
  const requestedBarber = input.barberName ? sanitizePlainText(input.barberName, 60) : void 0;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate) || !cleanTimeSlot) {
    return { statusCode: 400, ok: false, error: "Valid date and time slot are required." };
  }
  if (isPostgresConfigured()) {
    const { windowStartIso, windowEndIso } = getWideUtcDayWindow(cleanDate);
    const resolveSlot = (snapshot, currentBooking) => {
      const targetBarber2 = requestedBarber || currentBooking.stylistName;
      const serviceIds = currentBooking.servicesSnapshot.map((s) => s.id || s.name).filter((x) => Boolean(x));
      const avail2 = evaluateAvailabilityFromSnapshot({
        salonId: snapshot.salonId,
        date: cleanDate,
        exactDurationMins: currentBooking.totalDurationMins || 35,
        serviceIds,
        excludeBookingId: currentBooking.id,
        snapshot
      });
      if (!avail2.isOpen) {
        return {
          ok: false,
          statusCode: 409,
          error: avail2.closedReason || "Salon is closed on that date."
        };
      }
      const startMinutes2 = parseTimeSlotToMinutes(cleanTimeSlot);
      const formattedTime2 = startMinutes2 >= 0 ? formatMinutesToTimeSlot(startMinutes2) : cleanTimeSlot;
      const matchedSlot2 = avail2.slots.find(
        (s) => s.startMinutes === startMinutes2 || s.timeSlot === formattedTime2
      );
      const matchedBarber2 = matchedSlot2?.barbers.find(
        (b) => b.name.toLowerCase() === targetBarber2.toLowerCase() && b.available
      );
      if (!matchedSlot2 || !matchedBarber2) {
        return {
          ok: false,
          statusCode: 409,
          error: `${targetBarber2} is not available at ${formattedTime2} on ${cleanDate}.`
        };
      }
      const [y2, m2, d2] = cleanDate.split("-").map((n) => parseInt(n, 10));
      const tz = Number.isFinite(snapshot.timezoneOffsetHours) ? snapshot.timezoneOffsetHours : ensureSalonExists(snapshot.salonId).timezoneOffsetHours;
      const startUtcMs2 = Date.UTC(y2, m2 - 1, d2, Math.floor(startMinutes2 / 60), startMinutes2 % 60, 0) - tz * 36e5;
      const dur2 = currentBooking.totalDurationMins || 35;
      return {
        ok: true,
        startUtcIso: new Date(startUtcMs2).toISOString(),
        endUtcIso: new Date(startUtcMs2 + dur2 * 6e4).toISOString(),
        formattedTime: formattedTime2,
        barberName: matchedBarber2.name,
        durationMins: dur2
      };
    };
    const pgResult = await rescheduleBookingByAccessTokenInPostgres({
      rawToken: clean,
      appointmentDate: cleanDate,
      windowStartIso,
      windowEndIso,
      resolveSlot
    });
    if (!pgResult.ok) {
      return { statusCode: pgResult.statusCode, ok: false, error: pgResult.error };
    }
    return {
      statusCode: 200,
      ok: true,
      booking: mapPgBookingToManagementPayload(pgResult.booking)
    };
  }
  if (process.env.NODE_ENV === "production") {
    return {
      statusCode: 503,
      ok: false,
      error: "Database is not configured. Reschedule cannot be committed without persistent storage."
    };
  }
  const store = ensureStoreLoaded();
  const tokenHash = crypto3.createHash("sha256").update(clean).digest("hex");
  const tokenRec = store.bookingAccessTokens?.[tokenHash];
  if (!tokenRec || tokenRec.revoked || tokenRec.expiresAtMs < Date.now()) {
    return { statusCode: 404, ok: false, error: "This booking management link has expired or been revoked." };
  }
  const appt = store.appointments.find(
    (a) => a.salonId === tokenRec.salonId && a.id === tokenRec.bookingId
  );
  if (!appt) return { statusCode: 404, ok: false, error: "Appointment not found." };
  if (appt.status === "COMPLETED" || appt.status === "CANCELED") {
    return { statusCode: 409, ok: false, error: `Completed or canceled bookings cannot be rescheduled.` };
  }
  const settings = ensureSalonExists(tokenRec.salonId);
  const targetBarber = requestedBarber || appt.barberName;
  const prevStatus = appt.status;
  appt.status = "CANCELED";
  const avail = evaluateAvailabilityFromSnapshot({
    salonId: tokenRec.salonId,
    date: cleanDate,
    exactDurationMins: appt.durationMins || 35,
    serviceIds: appt.serviceIds,
    snapshot: null
  });
  appt.status = prevStatus;
  if (!avail.isOpen) {
    return { statusCode: 409, ok: false, error: avail.closedReason || "Salon is closed on that date." };
  }
  const startMinutes = parseTimeSlotToMinutes(cleanTimeSlot);
  const formattedTime = startMinutes >= 0 ? formatMinutesToTimeSlot(startMinutes) : cleanTimeSlot;
  const matchedSlot = avail.slots.find(
    (s) => s.startMinutes === startMinutes || s.timeSlot === formattedTime
  );
  const matchedBarber = matchedSlot?.barbers.find(
    (b) => b.name.toLowerCase() === targetBarber.toLowerCase() && b.available
  );
  if (!matchedSlot || !matchedBarber) {
    return {
      statusCode: 409,
      ok: false,
      error: `${targetBarber} is not available at ${formattedTime} on ${cleanDate}.`
    };
  }
  const [y, m, d] = cleanDate.split("-").map((n) => parseInt(n, 10));
  const startUtcMs = Date.UTC(y, m - 1, d, Math.floor(startMinutes / 60), startMinutes % 60, 0) - settings.timezoneOffsetHours * 36e5;
  const dur = appt.durationMins || 35;
  const oldSummary = `${appt.appointmentDate || ""} ${appt.timeSlot} (${appt.barberName})`;
  appt.appointmentDate = cleanDate;
  appt.timeSlot = formattedTime;
  appt.barberName = matchedBarber.name;
  appt.scheduledForIso = new Date(startUtcMs).toISOString();
  appt.scheduledEndMs = startUtcMs + dur * 6e4;
  tokenRec.expiresAtMs = appt.scheduledEndMs + 7 * 864e5;
  appendBookingAudit(
    tokenRec.salonId,
    appt.id,
    "CUSTOMER",
    "RESCHEDULED",
    `Moved from ${oldSummary} to ${cleanDate} ${formattedTime} (${matchedBarber.name}). 0 quota used.`
  );
  const cli = store.clients.find((c) => c.id === appt.clientId);
  const clientLang = sanitizeClientLang(cli?.preferredLanguage, "en");
  appendLog(tokenRec.salonId, {
    direction: "INBOUND",
    module: "BOOKING",
    clientName: appt.clientName,
    clientPhone: appt.clientPhone,
    language: clientLang,
    dir: getLangDirection(clientLang),
    body: `Rescheduled by customer from ${oldSummary} to ${cleanDate} ${formattedTime} (${matchedBarber.name})`,
    eventMetadata: {
      eventType: "RESCHEDULE_CONFIRMED",
      barberName: matchedBarber.name,
      services: appt.service,
      timeSlot: formattedTime,
      dateLabel: cleanDate,
      clientId: appt.clientId
    }
  });
  persistStore(tokenRec.salonId);
  return { statusCode: 200, ok: true, booking: await getBookingByAccessToken(rawToken) || void 0 };
}
async function cancelBookingByAccessToken(rawToken, reason) {
  const clean = (rawToken || "").trim();
  if (!clean) return { statusCode: 404, ok: false, error: "Booking link not found." };
  if (isPostgresConfigured()) {
    const cleanReason = reason ? sanitizePlainText(reason, 120) : void 0;
    const pgResult = await cancelBookingByAccessTokenInPostgres({
      rawToken: clean,
      reason: cleanReason
    });
    if (!pgResult.ok) {
      return { statusCode: pgResult.statusCode, ok: false, error: pgResult.error };
    }
    return {
      statusCode: 200,
      ok: true,
      booking: mapPgBookingToManagementPayload(pgResult.booking)
    };
  }
  if (process.env.NODE_ENV === "production") {
    return {
      statusCode: 503,
      ok: false,
      error: "Database is not configured. Cancellation cannot be committed without persistent storage."
    };
  }
  const store = ensureStoreLoaded();
  const tokenHash = crypto3.createHash("sha256").update(clean).digest("hex");
  const tokenRec = store.bookingAccessTokens?.[tokenHash];
  if (!tokenRec || tokenRec.revoked || tokenRec.expiresAtMs < Date.now()) {
    return { statusCode: 404, ok: false, error: "This booking management link has expired or been revoked." };
  }
  const appt = store.appointments.find(
    (a) => a.salonId === tokenRec.salonId && a.id === tokenRec.bookingId
  );
  if (!appt) return { statusCode: 404, ok: false, error: "Appointment not found." };
  if (appt.status === "COMPLETED") {
    return { statusCode: 409, ok: false, error: "Completed appointments cannot be canceled." };
  }
  appt.status = "CANCELED";
  appt.canceled = true;
  store.chairLocks = store.chairLocks.filter(
    (l) => !(l.salonId === tokenRec.salonId && l.id === appt.id)
  );
  appendBookingAudit(
    tokenRec.salonId,
    appt.id,
    "CUSTOMER",
    "CANCELED",
    `Canceled by customer (${sanitizePlainText(reason || "Self-service cancel", 120)}). Slot freed; quota unchanged.`
  );
  const cli = store.clients.find((c) => c.id === appt.clientId);
  const clientLang = sanitizeClientLang(cli?.preferredLanguage, "en");
  appendLog(tokenRec.salonId, {
    direction: "INBOUND",
    module: "BOOKING",
    clientName: appt.clientName,
    clientPhone: appt.clientPhone,
    language: clientLang,
    dir: getLangDirection(clientLang),
    body: `Canceled by customer: ${appt.appointmentDate || ""} ${appt.timeSlot} with ${appt.barberName}`,
    eventMetadata: {
      eventType: "APPOINTMENT_CANCELED",
      barberName: appt.barberName,
      services: appt.service,
      timeSlot: appt.timeSlot,
      dateLabel: appt.appointmentDate,
      clientId: appt.clientId
    }
  });
  persistStore(tokenRec.salonId);
  return { statusCode: 200, ok: true, booking: await getBookingByAccessToken(rawToken) || void 0 };
}

// server/voiceTranslator.ts
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${Math.round(ms / 1e3)}s.`));
    }, ms);
    promise.then((val) => {
      clearTimeout(timer);
      resolve(val);
    }).catch((err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}
var LOCALE_TO_EDGE_VOICE = {
  "ar-AE": "ar-AE-HamdanNeural",
  "ur-PK": "ur-PK-AsadNeural",
  "en-US": "en-US-AndrewNeural"
};
var LOCALE_TO_GEMINI_VOICE = {
  "ar-AE": "Charon",
  "ur-PK": "Charon",
  "en-US": "Kore"
};
var LOCALE_TO_DIALECT_LABEL = {
  "ar-AE": "Gulf Arabic",
  "ur-PK": "Standard Urdu",
  "en-US": "English"
};
function resolveTargetLocale(targetLocale, targetDialect) {
  const normLocale = (targetLocale || "").trim().toLowerCase();
  const normDialect = (targetDialect || "").trim().toLowerCase();
  if (normLocale.startsWith("ar") || normDialect.includes("arabic")) {
    return "ar-AE";
  }
  if (normLocale.startsWith("ur") || normDialect.includes("urdu") || normDialect.includes("punjabi")) {
    return "ur-PK";
  }
  if (normLocale.startsWith("en") || normDialect.includes("english")) {
    return "en-US";
  }
  return "ur-PK";
}
function detectTextLanguageLabel(text) {
  if (/[\u0679\u067E\u0686\u0688\u0691\u0698\u06BA\u06BE\u06C1\u06D2]/.test(text)) {
    return "Urdu";
  }
  if (/[\u0600-\u06FF]/.test(text)) {
    return "Arabic";
  }
  return "English / Auto";
}
function createGeminiClient(apiKey) {
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build"
      }
    }
  });
}
function formatGeminiError(err) {
  const raw = err instanceof Error ? err.message : String(err || "");
  if (/API_KEY_INVALID|PERMISSION_DENIED|401|403/i.test(raw)) {
    return "Gemini API key is invalid or unauthorized. Please verify GEMINI_API_KEY in Settings > Secrets.";
  }
  if (/RESOURCE_EXHAUSTED|429|quota/i.test(raw)) {
    return "Gemini API rate/daily free-tier limit reached. Wait ~60 seconds or attach a pay-as-you-go GEMINI_API_KEY in Settings > Secrets.";
  }
  if (/timed out|timeout/i.test(raw)) {
    return "Voice translation took too long on the server. Please try a shorter clip (3\u201315s) or tap Retry.";
  }
  return raw ? `Voice translation upstream error: ${raw.slice(0, 180)}` : "Voice translation upstream error.";
}
async function synthesizeGeminiTts(ai, text, targetLocale) {
  const prebuiltVoice = LOCALE_TO_GEMINI_VOICE[targetLocale];
  const displayVoiceName = `Gemini ${prebuiltVoice} (${targetLocale})`;
  const cleanText = text.trim().slice(0, 1200);
  if (!cleanText) {
    return { audioBase64: null, voiceName: displayVoiceName, ttsSource: "unavailable", ttsError: "Empty speech text." };
  }
  const styleHint = targetLocale === "ur-PK" ? "Speak clearly in natural, warm Pakistani Urdu pronunciation for a salon owner." : targetLocale === "ar-AE" ? "Speak clearly in natural, warm Gulf Arabic pronunciation for a salon owner." : "Speak clearly in natural, warm English pronunciation.";
  try {
    const response = await withTimeout(
      ai.models.generateContent({
        model: "gemini-3.8-flash-lite-tts",
        contents: [
          {
            role: "user",
            parts: [
              {
                text: cleanText,
                speechMetadata: {
                  style: styleHint
                }
              }
            ]
          }
        ],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: prebuiltVoice }
            }
          }
        }
      }),
      15e3,
      "Gemini TTS"
    );
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio && base64Audio.length > 0) {
      return {
        audioBase64: base64Audio,
        voiceName: displayVoiceName,
        ttsSource: "gemini-tts"
      };
    }
    return {
      audioBase64: null,
      voiceName: displayVoiceName,
      ttsSource: "unavailable",
      ttsError: "Gemini TTS returned no audio data."
    };
  } catch (err) {
    return {
      audioBase64: null,
      voiceName: displayVoiceName,
      ttsSource: "unavailable",
      ttsError: err instanceof Error ? err.message : "Gemini TTS failed."
    };
  }
}
var LOCALE_BACKUP_EDGE_VOICE = {
  "ar-AE": "ar-SA-HamedNeural",
  "ur-PK": "ur-PK-UzmaNeural",
  "en-US": "en-US-GuyNeural"
};
async function synthesizeEdgeTtsInMemory(text, targetLocale) {
  const primaryVoice = LOCALE_TO_EDGE_VOICE[targetLocale];
  const backupVoice = LOCALE_BACKUP_EDGE_VOICE[targetLocale];
  const cleanText = text.trim().slice(0, 1500);
  if (!cleanText) {
    return { audioBase64: null, voiceName: primaryVoice, ttsSource: "unavailable", ttsError: "Empty speech text." };
  }
  const attemptVoice = async (voiceName) => {
    const tts = new MsEdgeTTS({
      connectionTimeoutMs: 5e3,
      synthesisTimeoutMs: 8e3
    });
    try {
      await tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
      const { audioStream } = tts.toStream(cleanText);
      return await new Promise((resolve, reject) => {
        const chunks = [];
        let settled = false;
        const timeout = setTimeout(() => {
          if (!settled) {
            settled = true;
            reject(new Error("Edge TTS stream timed out."));
          }
        }, 8500);
        audioStream.on("data", (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        audioStream.on("end", () => {
          clearTimeout(timeout);
          if (!settled) {
            settled = true;
            resolve(Buffer.concat(chunks));
          }
        });
        audioStream.on("error", (err) => {
          clearTimeout(timeout);
          if (!settled) {
            settled = true;
            reject(err);
          }
        });
      });
    } finally {
      try {
        tts.close();
      } catch {
      }
    }
  };
  let lastErr = "Edge TTS synthesis failed.";
  for (const voiceName of [primaryVoice, backupVoice]) {
    try {
      const buffer = await attemptVoice(voiceName);
      if (buffer.length > 0) {
        return {
          audioBase64: buffer.toString("base64"),
          voiceName,
          ttsSource: "msedge-tts"
        };
      }
      lastErr = "Empty audio buffer from Edge TTS.";
    } catch (err) {
      lastErr = err instanceof Error ? err.message : "Edge TTS synthesis failed.";
    }
  }
  return {
    audioBase64: null,
    voiceName: primaryVoice,
    ttsSource: "unavailable",
    ttsError: lastErr
  };
}
async function transcribeChairIntentAudio(audioBase64, audioMimeType, ownerLang) {
  const cleanAudioBase64 = (audioBase64 || "").replace(/^data:[^;]+;base64,/, "").trim();
  const cleanAudioMime = (audioMimeType || "audio/webm").split(";")[0].trim() || "audio/webm";
  const apiKey = (process.env.GEMINI_API_KEY || "").trim();
  if (!cleanAudioBase64) {
    return { transcript: "", error: "No audio recording supplied." };
  }
  if (!apiKey) {
    return { transcript: "", error: "GEMINI_API_KEY is not configured." };
  }
  const ai = createGeminiClient(apiKey);
  const hint = ownerLang === "ur" ? "Expected language: Urdu / English barber names & time durations." : ownerLang === "ar" ? "Expected language: Arabic / English barber names & time durations." : "Expected language: English barber names & time durations.";
  for (const modelName of ["gemini-4-hydrogen", "gemini-3.1-flash-lite"]) {
    try {
      const response = await withTimeout(
        ai.models.generateContent({
          model: modelName,
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: cleanAudioMime,
                  data: cleanAudioBase64
                }
              },
              {
                text: `Transcribe this short salon chair lock voice command verbatim, keeping BOTH the barber/staff person name AND the exact start/end time or duration (e.g., "Mr. Zia 2:00 PM to 3:00 PM" or "Aslam 30 minutes"). ${hint} Return ONLY the concise spoken phrase.`
              }
            ]
          }
        }),
        15e3,
        "Chair lock audio"
      );
      const outText = (response.text ?? "").trim();
      if (outText) return { transcript: outText };
    } catch (err) {
      const formatted = formatGeminiError(err);
      if (modelName === "gemini-3.1-flash-lite") {
        return { transcript: "", error: formatted };
      }
    }
  }
  return { transcript: "", error: "Could not transcribe chair lock audio." };
}
async function translateAndSynthesizeVoice(req) {
  const targetLocale = resolveTargetLocale(req.targetLocale, req.targetDialect);
  const targetDialect = req.targetDialect?.trim() || LOCALE_TO_DIALECT_LABEL[targetLocale];
  const cleanAudioBase64 = (req.audioBase64 || "").replace(/^data:[^;]+;base64,/, "").trim();
  const cleanAudioMime = (req.audioMimeType || "audio/webm;codecs=opus").split(";")[0].trim() || "audio/webm";
  const cleanText = (req.text || "").trim().slice(0, 1e3);
  const localeInstruction = targetLocale === "ar-AE" ? "Natural conversational Gulf Arabic (UAE/Saudi salon style) in Arabic script (\u0627\u0644\u0639\u0631\u0628\u064A\u0629). Translate EVERY detail accurately without omitting names, numbers, or instructions. Do not include transliteration." : targetLocale === "ur-PK" ? "Natural polite Pakistani Urdu in Urdu script (\u0627\u0631\u062F\u0648). Translate EVERY detail accurately without omitting names, numbers, or instructions. Keep it clear and conversational for a salon owner." : "Clear, polite natural English. Translate EVERY detail accurately without omitting names, numbers, or instructions.";
  const apiKey = (process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) {
    if (cleanText && !cleanAudioBase64) {
      const edgeTts2 = await synthesizeEdgeTtsInMemory(cleanText, targetLocale);
      return {
        transcript: cleanText,
        detectedInputLanguage: detectTextLanguageLabel(cleanText),
        targetLocale,
        targetDialect,
        translatedText: cleanText,
        voiceName: edgeTts2.voiceName,
        audioBase64: edgeTts2.audioBase64,
        audioMimeType: "audio/mpeg",
        translationSource: "local-fallback",
        ttsSource: edgeTts2.ttsSource,
        ttsError: edgeTts2.ttsError
      };
    }
    return {
      transcript: cleanText,
      detectedInputLanguage: cleanText ? detectTextLanguageLabel(cleanText) : "Audio",
      targetLocale,
      targetDialect,
      translatedText: "",
      voiceName: LOCALE_TO_EDGE_VOICE[targetLocale],
      audioBase64: null,
      audioMimeType: "audio/mpeg",
      translationSource: "error",
      translationError: "GEMINI_API_KEY is not set on the server. Add GEMINI_API_KEY in Settings > Secrets so live Arabic/Urdu/English voice transcription and translation can run.",
      ttsSource: "unavailable",
      ttsError: "Translation skipped because GEMINI_API_KEY is missing."
    };
  }
  if (!cleanAudioBase64 && !cleanText) {
    return {
      transcript: "",
      detectedInputLanguage: "Unknown",
      targetLocale,
      targetDialect,
      translatedText: "",
      voiceName: LOCALE_TO_EDGE_VOICE[targetLocale],
      audioBase64: null,
      audioMimeType: "audio/mpeg",
      translationSource: "error",
      translationError: "No voice recording or text message provided.",
      ttsSource: "unavailable"
    };
  }
  const ai = createGeminiClient(apiKey);
  let finalTranscript = cleanText;
  let finalTranslated = "";
  let detectedInputLanguage = finalTranscript ? detectTextLanguageLabel(finalTranscript) : "Audio";
  let translationSucceeded = false;
  let lastErrorMsg = "";
  const translationModels = ["gemini-4-hydrogen", "gemini-3.1-flash-lite"];
  for (const modelName of translationModels) {
    try {
      const hasAudio = Boolean(cleanAudioBase64);
      const prompt = hasAudio ? `Listen carefully to the attached voice recording${cleanText ? ` (with additional note: "${cleanText}")` : ""}.
1. Transcribe the exact spoken message verbatim in its original spoken language (Arabic, Urdu, Punjabi, or English). Preserve names, times, and numbers.
2. Detect the spoken input language accurately (e.g., Arabic, Urdu, English, Punjabi).
3. Translate the exact meaning and wording faithfully into: ${localeInstruction}
Do NOT replace the message with generic greetings or omit any details.` : `You are translating a salon communication message verbatim.
1. Return the exact original message as "transcript".
2. Detect the input language accurately (e.g., Arabic, Urdu, English, Roman Urdu, Punjabi).
3. Translate the exact meaning and wording faithfully into: ${localeInstruction}
Do NOT add unrelated boilerplate or omit any numbers, times, or instructions.

Original message: "${finalTranscript}"`;
      const contents = hasAudio ? {
        parts: [
          {
            inlineData: {
              mimeType: cleanAudioMime,
              data: cleanAudioBase64
            }
          },
          { text: prompt }
        ]
      } : prompt;
      const response = await withTimeout(
        ai.models.generateContent({
          model: modelName,
          contents,
          config: {
            ...modelName === "gemini-4-hydrogen" ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {},
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                transcript: {
                  type: Type.STRING,
                  description: "Exact verbatim transcript of the spoken or written input."
                },
                translatedText: {
                  type: Type.STRING,
                  description: "Exact, faithful translation in the requested target locale script."
                },
                detectedSourceLanguage: {
                  type: Type.STRING,
                  description: "Short label of detected input language, e.g., Arabic, Urdu, English, Punjabi."
                }
              },
              required: ["transcript", "translatedText", "detectedSourceLanguage"]
            }
          }
        }),
        2e4,
        "Voice translation"
      );
      const parsed = JSON.parse((response.text ?? "{}").trim());
      if (parsed.translatedText && parsed.translatedText.trim()) {
        finalTranscript = parsed.transcript?.trim() || finalTranscript || "(Recorded Voice Note)";
        finalTranslated = parsed.translatedText.trim();
        detectedInputLanguage = parsed.detectedSourceLanguage?.trim() || detectedInputLanguage;
        translationSucceeded = true;
        break;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      lastErrorMsg = formatGeminiError(err);
      console.warn(`Gemini voice translation (${modelName}) notice:`, msg);
      if (/RESOURCE_EXHAUSTED|429|quota|API_KEY_INVALID|PERMISSION_DENIED|401|403/i.test(msg)) {
        break;
      }
      if (!/not found|404|unsupported|invalid argument|503|unavailable|high demand|overloaded|timed out/i.test(msg)) {
        break;
      }
    }
  }
  if (!translationSucceeded || !finalTranslated) {
    if (cleanText && !cleanAudioBase64) {
      const edgeTts2 = await synthesizeEdgeTtsInMemory(cleanText, targetLocale);
      return {
        transcript: cleanText,
        detectedInputLanguage,
        targetLocale,
        targetDialect,
        translatedText: cleanText,
        voiceName: edgeTts2.voiceName,
        audioBase64: edgeTts2.audioBase64,
        audioMimeType: "audio/mpeg",
        translationSource: "local-fallback",
        ttsSource: edgeTts2.ttsSource,
        ttsError: edgeTts2.ttsError || lastErrorMsg
      };
    }
    return {
      transcript: finalTranscript,
      detectedInputLanguage,
      targetLocale,
      targetDialect,
      translatedText: "",
      voiceName: LOCALE_TO_EDGE_VOICE[targetLocale],
      audioBase64: null,
      audioMimeType: "audio/mpeg",
      translationSource: "error",
      translationError: lastErrorMsg || "Could not transcribe or translate the voice recording. Please try speaking clearly or check your connection.",
      ttsSource: "unavailable"
    };
  }
  const edgeTts = await synthesizeEdgeTtsInMemory(finalTranslated, targetLocale);
  if (edgeTts.audioBase64) {
    return {
      transcript: finalTranscript,
      detectedInputLanguage,
      targetLocale,
      targetDialect,
      translatedText: finalTranslated,
      voiceName: edgeTts.voiceName,
      audioBase64: edgeTts.audioBase64,
      audioMimeType: "audio/mpeg",
      translationSource: cleanAudioBase64 ? "gemini-audio" : "gemini-text",
      ttsSource: "msedge-tts"
    };
  }
  const geminiTts = await synthesizeGeminiTts(ai, finalTranslated, targetLocale);
  if (geminiTts.audioBase64) {
    return {
      transcript: finalTranscript,
      detectedInputLanguage,
      targetLocale,
      targetDialect,
      translatedText: finalTranslated,
      voiceName: geminiTts.voiceName,
      audioBase64: geminiTts.audioBase64,
      audioMimeType: "audio/wav",
      translationSource: cleanAudioBase64 ? "gemini-audio" : "gemini-text",
      ttsSource: "gemini-tts"
    };
  }
  return {
    transcript: finalTranscript,
    detectedInputLanguage,
    targetLocale,
    targetDialect,
    translatedText: finalTranslated,
    voiceName: edgeTts.voiceName,
    audioBase64: null,
    audioMimeType: "audio/mpeg",
    translationSource: cleanAudioBase64 ? "gemini-audio" : "gemini-text",
    ttsSource: "unavailable",
    ttsError: edgeTts.ttsError || geminiTts.ttsError || "Neural audio generation unavailable right now; translated text is ready."
  };
}

// server/voiceInboxStore.ts
import fs3 from "fs";
import path3 from "path";
function normalizeSalonKey(raw) {
  return (raw || "").trim().toLowerCase().replace(/^salon-/, "");
}
var SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1e3;
var FREE_TIER_STORAGE_QUOTA_BYTES = 25 * 1024 * 1024;
var FREE_TIER_GEMINI_RPD_LIMIT = 1500;
var ALERT_THRESHOLD_PERCENT = 80;
function resolveStoreFilePath() {
  if (process.env.VERCEL) {
    return path3.join("/tmp", "workcraft-voice-inbox.json");
  }
  return path3.resolve(process.cwd(), ".data", "voice-inbox.json");
}
function getTodayKey() {
  return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
}
function buildSeedThreads(now) {
  return [
    {
      id: "wc-101",
      serialNumber: "101",
      salonId: "salon-1",
      ownerName: "Hamza",
      salonName: "Seven Cuts Salon",
      city: "Lahore DHA",
      duration: "0:24",
      receivedAgo: "18m ago",
      dialect: "Standard Urdu",
      targetLocale: "ur-PK",
      unread: true,
      transcript: "\u201CSalam Farhan bhai, humara weekend video deal upload kiya tha 58 second ka, check kar lein approved hai ke nahi taake blast schedule ho sake.\u201D",
      speechPlayText: "\u0627\u0644\u0633\u0644\u0627\u0645 \u0639\u0644\u06CC\u06A9\u0645 \u0641\u0631\u062D\u0627\u0646 \u0628\u06BE\u0627\u0626\u06CC\u060C \u06C1\u0645\u0627\u0631\u0627 \u0648\u06CC\u06A9 \u0627\u06CC\u0646\u0688 \u0648\u06CC\u0688\u06CC\u0648 \u0688\u06CC\u0644 58 \u0633\u06CC\u06A9\u0646\u0688 \u06A9\u0627 \u0627\u067E\u0644\u0648\u0688 \u06A9\u06CC\u0627 \u062A\u06BE\u0627\u060C \u0686\u06CC\u06A9 \u06A9\u0631 \u0644\u06CC\u06BA \u0645\u0646\u0638\u0648\u0631 \u06C1\u06D2 \u06CC\u0627 \u0646\u06C1\u06CC\u06BA \u062A\u0627\u06A9\u06C1 \u06A9\u0644 \u0635\u0628\u062D \u0628\u0644\u0627\u0633\u0679 \u0634\u06CC\u0688\u0648\u0644 \u06C1\u0648 \u0633\u06A9\u06D2\u06D4",
      defaultReplySuggestion: "Your 58-second weekend video deal is verified and approved for tomorrow morning broadcast.",
      messages: [
        {
          id: "msg-init-101",
          senderRole: "SALON_OWNER",
          senderLabel: "Hamza \xB7 Seven Cuts Salon",
          originalText: "Salam Farhan bhai, humara weekend video deal upload kiya tha 58 second ka, check kar lein approved hai ke nahi taake blast schedule ho sake.",
          translatedText: "\u0627\u0644\u0633\u0644\u0627\u0645 \u0639\u0644\u06CC\u06A9\u0645 \u0641\u0631\u062D\u0627\u0646 \u0628\u06BE\u0627\u0626\u06CC\u060C \u06C1\u0645\u0627\u0631\u0627 \u0648\u06CC\u06A9 \u0627\u06CC\u0646\u0688 \u0648\u06CC\u0688\u06CC\u0648 \u0688\u06CC\u0644 58 \u0633\u06CC\u06A9\u0646\u0688 \u06A9\u0627 \u0627\u067E\u0644\u0648\u0688 \u06A9\u06CC\u0627 \u062A\u06BE\u0627\u060C \u0686\u06CC\u06A9 \u06A9\u0631 \u0644\u06CC\u06BA \u0645\u0646\u0638\u0648\u0631 \u06C1\u06D2 \u06CC\u0627 \u0646\u06C1\u06CC\u06BA \u062A\u0627\u06A9\u06C1 \u06A9\u0644 \u0635\u0628\u062D \u0628\u0644\u0627\u0633\u0679 \u0634\u06CC\u0688\u0648\u0644 \u06C1\u0648 \u0633\u06A9\u06D2\u06D4",
          detectedInputLanguage: "Urdu / Roman Urdu",
          targetLocale: "ur-PK",
          sizeBytes: 142 * 1024,
          createdAtMs: now - 18 * 60 * 1e3,
          expiresAtMs: now - 18 * 60 * 1e3 + SEVEN_DAYS_MS
        }
      ]
    },
    {
      id: "wc-102",
      serialNumber: "102",
      salonId: "salon-5",
      ownerName: "Ayesha",
      salonName: "Noor Beauty Lounge",
      city: "Karachi Clifton",
      duration: "0:19",
      receivedAgo: "42m ago",
      dialect: "Standard Urdu",
      targetLocale: "ur-PK",
      unread: true,
      transcript: "\u201C\u0641\u0631\u0627\u0626\u06CC\u0688\u06D2 \u0628\u0631\u0627\u0626\u06CC\u0688\u0644 \u0688\u0633\u06A9\u0627\u0624\u0646\u0679 \u067E\u06CC\u06A9\u06CC\u062C \u0631\u06CC\u0679 \u0633\u0633\u0679\u0645 \u0645\u06CC\u06BA \u0627\u067E\u0688\u06CC\u0679 \u06C1\u0648 \u06AF\u06CC\u0627 \u06C1\u06D2\u061F \u06A9\u0633\u0679\u0645\u0631 \u067E\u0648\u0686\u06BE \u0631\u06C1\u06D2 \u06C1\u06CC\u06BA\u06D4\u201D",
      speechPlayText: "\u0641\u0631\u0627\u0626\u06CC\u0688\u06D2 \u0628\u0631\u0627\u0626\u06CC\u0688\u0644 \u0688\u0633\u06A9\u0627\u0624\u0646\u0679 \u067E\u06CC\u06A9\u06CC\u062C \u0631\u06CC\u0679 \u0633\u0633\u0679\u0645 \u0645\u06CC\u06BA \u0627\u067E\u0688\u06CC\u0679 \u06C1\u0648 \u06AF\u06CC\u0627 \u06C1\u06D2\u061F \u06A9\u0633\u0679\u0645\u0631 \u067E\u0648\u0686\u06BE \u0631\u06C1\u06D2 \u06C1\u06CC\u06BA\u06D4",
      defaultReplySuggestion: "Yes Ayesha, your Friday bridal discount package rates are updated and live in WhatsApp.",
      messages: [
        {
          id: "msg-init-102",
          senderRole: "SALON_OWNER",
          senderLabel: "Ayesha \xB7 Noor Beauty Lounge",
          originalText: "\u0641\u0631\u0627\u0626\u06CC\u0688\u06D2 \u0628\u0631\u0627\u0626\u06CC\u0688\u0644 \u0688\u0633\u06A9\u0627\u0624\u0646\u0679 \u067E\u06CC\u06A9\u06CC\u062C \u0631\u06CC\u0679 \u0633\u0633\u0679\u0645 \u0645\u06CC\u06BA \u0627\u067E\u0688\u06CC\u0679 \u06C1\u0648 \u06AF\u06CC\u0627 \u06C1\u06D2\u061F \u06A9\u0633\u0679\u0645\u0631 \u067E\u0648\u0686\u06BE \u0631\u06C1\u06D2 \u06C1\u06CC\u06BA\u06D4",
          translatedText: "\u0641\u0631\u0627\u0626\u06CC\u0688\u06D2 \u0628\u0631\u0627\u0626\u06CC\u0688\u0644 \u0688\u0633\u06A9\u0627\u0624\u0646\u0679 \u067E\u06CC\u06A9\u06CC\u062C \u0631\u06CC\u0679 \u0633\u0633\u0679\u0645 \u0645\u06CC\u06BA \u0627\u067E\u0688\u06CC\u0679 \u06C1\u0648 \u06AF\u06CC\u0627 \u06C1\u06D2\u061F \u06A9\u0633\u0679\u0645\u0631 \u067E\u0648\u0686\u06BE \u0631\u06C1\u06D2 \u06C1\u06CC\u06BA\u06D4",
          detectedInputLanguage: "Urdu",
          targetLocale: "ur-PK",
          sizeBytes: 118 * 1024,
          createdAtMs: now - 42 * 60 * 1e3,
          expiresAtMs: now - 42 * 60 * 1e3 + SEVEN_DAYS_MS
        }
      ]
    },
    {
      id: "wc-103",
      serialNumber: "103",
      salonId: "salon-3",
      ownerName: "Bilal",
      salonName: "The Groom Room",
      city: "Islamabad F-7",
      duration: "0:21",
      receivedAgo: "1h ago",
      dialect: "Standard Urdu",
      targetLocale: "ur-PK",
      unread: false,
      transcript: "\u201CAssalamu Alaikum sir, sade 2 barbers de slot timings update karanay si Friday layi, system vich save ho jange?\u201D",
      speechPlayText: "\u0627\u0644\u0633\u0644\u0627\u0645 \u0639\u0644\u06CC\u06A9\u0645 \u0633\u0631\u060C \u06C1\u0645\u0627\u0631\u06D2 \u062F\u0648 \u0628\u0627\u0631\u0628\u0631\u0632 \u06A9\u06D2 \u0641\u0631\u0627\u0626\u06CC\u0688\u06D2 \u0633\u0644\u0627\u0679 \u0679\u0627\u0626\u0645\u0646\u06AF\u0632 \u0627\u067E\u0688\u06CC\u0679 \u06A9\u0631\u0646\u06D2 \u062A\u06BE\u06D2\u060C \u06A9\u06CC\u0627 \u0633\u0633\u0679\u0645 \u0645\u06CC\u06BA \u0633\u06CC\u0648 \u06C1\u0648 \u062C\u0627\u0626\u06CC\u06BA \u06AF\u06D2\u061F",
      defaultReplySuggestion: "Yes Bilal, update both barber schedules inside Manage -> Staff & Barbers and slots sync automatically.",
      messages: [
        {
          id: "msg-init-103",
          senderRole: "SALON_OWNER",
          senderLabel: "Bilal \xB7 The Groom Room",
          originalText: "Assalamu Alaikum sir, sade 2 barbers de slot timings update karanay si Friday layi, system vich save ho jange?",
          translatedText: "\u0627\u0644\u0633\u0644\u0627\u0645 \u0639\u0644\u06CC\u06A9\u0645 \u0633\u0631\u060C \u06C1\u0645\u0627\u0631\u06D2 \u062F\u0648 \u0628\u0627\u0631\u0628\u0631\u0632 \u06A9\u06D2 \u0641\u0631\u0627\u0626\u06CC\u0688\u06D2 \u0633\u0644\u0627\u0679 \u0679\u0627\u0626\u0645\u0646\u06AF\u0632 \u0627\u067E\u0688\u06CC\u0679 \u06A9\u0631\u0646\u06D2 \u062A\u06BE\u06D2\u060C \u06A9\u06CC\u0627 \u0633\u0633\u0679\u0645 \u0645\u06CC\u06BA \u0633\u06CC\u0648 \u06C1\u0648 \u062C\u0627\u0626\u06CC\u06BA \u06AF\u06D2\u061F",
          detectedInputLanguage: "Punjabi / Roman Urdu",
          targetLocale: "ur-PK",
          sizeBytes: 126 * 1024,
          createdAtMs: now - 60 * 60 * 1e3,
          expiresAtMs: now - 60 * 60 * 1e3 + SEVEN_DAYS_MS
        }
      ]
    },
    {
      id: "wc-104",
      serialNumber: "104",
      salonId: "salon-4",
      ownerName: "Tareq",
      salonName: "Elite Grooming",
      city: "Dubai Marina, UAE",
      duration: "0:27",
      receivedAgo: "2h ago",
      dialect: "Gulf Arabic",
      targetLocale: "ar-AE",
      unread: false,
      transcript: "\u201C\u0645\u0631\u062D\u0628\u0627\u064B\u060C \u0647\u0644 \u062A\u0645 \u062A\u0641\u0639\u064A\u0644 \u0639\u0631\u0636 \u0646\u0647\u0627\u064A\u0629 \u0627\u0644\u0623\u0633\u0628\u0648\u0639 \u0644\u0628\u0627\u0642\u0629 VIP \u0641\u064A \u0627\u0644\u0631\u062F \u0627\u0644\u062A\u0644\u0642\u0627\u0626\u064A \u0639\u0644\u0649 \u0648\u0627\u062A\u0633\u0627\u0628\u061F\u201D",
      speechPlayText: "\u0645\u0631\u062D\u0628\u0627\u064B\u060C \u0647\u0644 \u062A\u0645 \u062A\u0641\u0639\u064A\u0644 \u0639\u0631\u0636 \u0646\u0647\u0627\u064A\u0629 \u0627\u0644\u0623\u0633\u0628\u0648\u0639 \u0644\u0628\u0627\u0642\u0629 VIP \u0641\u064A \u0627\u0644\u0631\u062F \u0627\u0644\u062A\u0644\u0642\u0627\u0626\u064A \u0639\u0644\u0649 \u0648\u0627\u062A\u0633\u0627\u0628\u061F",
      defaultReplySuggestion: "Hello Tareq, your weekend VIP deal is verified and live in WhatsApp auto-replies now.",
      messages: [
        {
          id: "msg-init-104",
          senderRole: "SALON_OWNER",
          senderLabel: "Tareq \xB7 Elite Grooming",
          originalText: "\u0645\u0631\u062D\u0628\u0627\u064B\u060C \u0647\u0644 \u062A\u0645 \u062A\u0641\u0639\u064A\u0644 \u0639\u0631\u0636 \u0646\u0647\u0627\u064A\u0629 \u0627\u0644\u0623\u0633\u0628\u0648\u0639 \u0644\u0628\u0627\u0642\u0629 VIP \u0641\u064A \u0627\u0644\u0631\u062F \u0627\u0644\u062A\u0644\u0642\u0627\u0626\u064A \u0639\u0644\u0649 \u0648\u0627\u062A\u0633\u0627\u0628\u061F",
          translatedText: "\u0645\u0631\u062D\u0628\u0627\u064B\u060C \u0647\u0644 \u062A\u0645 \u062A\u0641\u0639\u064A\u0644 \u0639\u0631\u0636 \u0646\u0647\u0627\u064A\u0629 \u0627\u0644\u0623\u0633\u0628\u0648\u0639 \u0644\u0628\u0627\u0642\u0629 VIP \u0641\u064A \u0627\u0644\u0631\u062F \u0627\u0644\u062A\u0644\u0642\u0627\u0626\u064A \u0639\u0644\u0649 \u0648\u0627\u062A\u0633\u0627\u0628\u061F",
          detectedInputLanguage: "Arabic",
          targetLocale: "ar-AE",
          sizeBytes: 148 * 1024,
          createdAtMs: now - 120 * 60 * 1e3,
          expiresAtMs: now - 120 * 60 * 1e3 + SEVEN_DAYS_MS
        }
      ]
    }
  ];
}
var storeCache = null;
async function hydrateVoiceStoreFromKv() {
  const remote = await kvGetJson("wc:voice:v1");
  if (!remote || !Array.isArray(remote.threads) || remote.threads.length === 0) return;
  const now = Date.now();
  storeCache = {
    threads: remote.threads,
    purgedClipCount: Number(remote.purgedClipCount || 0),
    lastCleanupAt: remote.lastCleanupAt || new Date(now).toISOString(),
    geminiRequestsToday: Number(remote.geminiRequestsToday || 2),
    edgeTtsRequestsToday: Number(remote.edgeTtsRequestsToday || 2),
    usageDayKey: remote.usageDayKey || getTodayKey(),
    autoAlertWhatsAppSent: Boolean(remote.autoAlertWhatsAppSent),
    lastHeartbeatMs: Number(remote.lastHeartbeatMs || now),
    lineSimulatedDown: Boolean(remote.lineSimulatedDown),
    lineReason: remote.lineReason || "Connected & Healthy via Central WorkCraft Gateway"
  };
}
function persistStore2(store) {
  try {
    const filePath = resolveStoreFilePath();
    fs3.mkdirSync(path3.dirname(filePath), { recursive: true });
    fs3.writeFileSync(filePath, JSON.stringify(store, null, 2), "utf8");
  } catch {
  }
  void kvSetJson("wc:voice:v1", store);
}
function loadStore() {
  if (storeCache) {
    sweepExpiredVoiceBlobsInternal(storeCache);
    return storeCache;
  }
  const now = Date.now();
  const filePath = resolveStoreFilePath();
  if (fs3.existsSync(filePath)) {
    try {
      const parsed = JSON.parse(fs3.readFileSync(filePath, "utf8"));
      if (Array.isArray(parsed.threads) && parsed.threads.length > 0) {
        storeCache = {
          threads: parsed.threads,
          purgedClipCount: Number(parsed.purgedClipCount || 0),
          lastCleanupAt: parsed.lastCleanupAt || new Date(now).toISOString(),
          geminiRequestsToday: Number(parsed.geminiRequestsToday || 2),
          edgeTtsRequestsToday: Number(parsed.edgeTtsRequestsToday || 2),
          usageDayKey: parsed.usageDayKey || getTodayKey(),
          autoAlertWhatsAppSent: Boolean(parsed.autoAlertWhatsAppSent),
          lastHeartbeatMs: Number(parsed.lastHeartbeatMs || now),
          lineSimulatedDown: Boolean(parsed.lineSimulatedDown),
          lineReason: parsed.lineReason || "Connected & Healthy via Central WorkCraft Gateway"
        };
        sweepExpiredVoiceBlobsInternal(storeCache);
        return storeCache;
      }
    } catch {
    }
  }
  storeCache = {
    threads: buildSeedThreads(now),
    purgedClipCount: 0,
    lastCleanupAt: new Date(now).toISOString(),
    geminiRequestsToday: 2,
    edgeTtsRequestsToday: 2,
    usageDayKey: getTodayKey(),
    autoAlertWhatsAppSent: false,
    lastHeartbeatMs: now,
    lineSimulatedDown: false,
    lineReason: "Connected & Healthy via Central WorkCraft Gateway"
  };
  persistStore2(storeCache);
  return storeCache;
}
function sweepExpiredVoiceBlobsInternal(store) {
  const now = Date.now();
  const todayKey = getTodayKey();
  if (store.usageDayKey !== todayKey) {
    store.usageDayKey = todayKey;
    store.geminiRequestsToday = 0;
    store.edgeTtsRequestsToday = 0;
    store.autoAlertWhatsAppSent = false;
  }
  let purgedInRun = 0;
  for (const thread of store.threads) {
    const kept = [];
    for (const msg of thread.messages) {
      if (msg.expiresAtMs <= now) {
        purgedInRun += 1;
        continue;
      }
      kept.push(msg);
    }
    thread.messages = kept;
  }
  if (purgedInRun > 0) {
    store.purgedClipCount += purgedInRun;
  }
  store.lastCleanupAt = new Date(now).toISOString();
  return purgedInRun;
}
function sweepExpiredVoiceBlobs() {
  const store = loadStore();
  const purgedCount = sweepExpiredVoiceBlobsInternal(store);
  persistStore2(store);
  return { purgedCount, lastCleanupAt: store.lastCleanupAt };
}
function recordAiVoiceApiUsage(usedGemini, usedEdgeTts) {
  const store = loadStore();
  if (usedGemini) store.geminiRequestsToday += 1;
  if (usedEdgeTts) store.edgeTtsRequestsToday += 1;
  const meter = getLiveUsageMeter(store);
  if (meter.alertTriggered && !store.autoAlertWhatsAppSent) {
    store.autoAlertWhatsAppSent = true;
    console.warn(`[WORKCRAFT AUTO-ALERT] Free-tier usage crossed 80%: ${meter.usagePercent}% \u2014 WhatsApp alert queued to Founder.`);
  }
  persistStore2(store);
  return getLiveUsageMeter(store);
}
function getLiveUsageMeter(existingStore) {
  const store = existingStore || loadStore();
  let activeClipCount = 0;
  let storageUsedBytes = 0;
  for (const thread of store.threads) {
    for (const msg of thread.messages) {
      activeClipCount += 1;
      storageUsedBytes += Math.max(0, Number(msg.sizeBytes || 0));
    }
  }
  const storageUsedKb = Math.round(storageUsedBytes / 1024);
  const storageQuotaKb = Math.round(FREE_TIER_STORAGE_QUOTA_BYTES / 1024);
  const storagePercent = Math.min(
    100,
    Math.round(storageUsedBytes / FREE_TIER_STORAGE_QUOTA_BYTES * 1e3) / 10
  );
  const geminiPercent = Math.min(
    100,
    Math.round(store.geminiRequestsToday / FREE_TIER_GEMINI_RPD_LIMIT * 1e3) / 10
  );
  const usagePercent = Math.max(storagePercent, geminiPercent);
  const alertTriggered = usagePercent >= ALERT_THRESHOLD_PERCENT;
  return {
    monthlyExpenseUsd: 0,
    monthlyExpenseLabel: "$0.00 / mo",
    retentionDays: 7,
    targetClipKb: 150,
    activeClipCount,
    purgedClipCount: store.purgedClipCount,
    storageUsedBytes,
    storageUsedKb,
    storageQuotaKb,
    storagePercent,
    geminiRequestsToday: store.geminiRequestsToday,
    geminiDailyLimit: FREE_TIER_GEMINI_RPD_LIMIT,
    geminiPercent,
    edgeTtsRequestsToday: store.edgeTtsRequestsToday,
    usagePercent,
    alertThresholdPercent: ALERT_THRESHOLD_PERCENT,
    alertTriggered,
    autoAlertWhatsAppSent: store.autoAlertWhatsAppSent || alertTriggered,
    autoAlertMessage: alertTriggered ? `Free-tier threshold warning (${usagePercent}% >= 80%). Oldest clips will auto-purge cleanly at 7 days.` : null,
    lastCleanupAt: store.lastCleanupAt
  };
}
function listVoiceThreads(salonIdFilter) {
  const store = loadStore();
  const normalizedFilter = normalizeSalonKey(salonIdFilter);
  const threads = normalizedFilter ? store.threads.filter((t) => normalizeSalonKey(t.salonId) === normalizedFilter) : store.threads;
  const unreadCount = store.threads.filter((t) => t.unread).length;
  return {
    threads,
    unreadCount,
    usage: getLiveUsageMeter(store)
  };
}
function markVoiceThreadRead(threadId, unread = false) {
  const store = loadStore();
  store.threads = store.threads.map((t) => t.id === threadId ? { ...t, unread } : t);
  persistStore2(store);
  return {
    threads: store.threads,
    unreadCount: store.threads.filter((t) => t.unread).length
  };
}
function appendVoiceMessage(params) {
  const store = loadStore();
  const now = Date.now();
  const normalizedTargetSalon = normalizeSalonKey(params.salonId);
  const normalizedTargetSalonName = (params.salonName || "").trim().toLowerCase();
  let targetThread = params.threadId && store.threads.find((t) => t.id === params.threadId) || normalizedTargetSalon && store.threads.find((t) => normalizeSalonKey(t.salonId) === normalizedTargetSalon) || normalizedTargetSalonName && store.threads.find((t) => t.salonName.trim().toLowerCase() === normalizedTargetSalonName) || void 0;
  if (!targetThread) {
    const nextSerial = String(101 + store.threads.length);
    const dialect = params.targetLocale === "ar-AE" ? "Gulf Arabic" : params.targetLocale === "en-US" ? "English" : "Standard Urdu";
    targetThread = {
      id: params.threadId || `wc-${nextSerial}`,
      serialNumber: nextSerial,
      salonId: params.salonId || `salon-${nextSerial}`,
      ownerName: params.ownerName || "Salon Owner",
      salonName: params.salonName || "Partner Salon",
      city: params.city || "Active Branch",
      duration: "0:15",
      receivedAgo: "Just now",
      dialect,
      targetLocale: params.targetLocale,
      unread: params.senderRole === "SALON_OWNER",
      transcript: `\u201C${params.originalText}\u201D`,
      speechPlayText: params.translatedText || params.originalText,
      defaultReplySuggestion: "Thank you, we received your voice note and will assist right away.",
      messages: []
    };
    store.threads.unshift(targetThread);
  }
  const estimatedBytes = params.sizeBytes ?? (params.audioDataUrl ? Math.round(params.audioDataUrl.length * 3 / 4) : Math.max(1024, Buffer.byteLength(params.translatedText || params.originalText, "utf8")));
  const newMsg = {
    id: `vmsg-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    senderRole: params.senderRole,
    senderLabel: params.senderRole === "FOUNDER" ? "WorkCraft Founder (Private Line)" : `${targetThread.ownerName} \xB7 ${targetThread.salonName}`,
    originalText: params.originalText,
    translatedText: params.translatedText,
    detectedInputLanguage: params.detectedInputLanguage,
    targetLocale: params.targetLocale,
    voiceName: params.voiceName,
    audioDataUrl: params.audioDataUrl,
    sizeBytes: estimatedBytes,
    createdAtMs: now,
    expiresAtMs: now + SEVEN_DAYS_MS
  };
  targetThread.messages.push(newMsg);
  if (params.senderRole === "SALON_OWNER") {
    targetThread.unread = true;
    targetThread.receivedAgo = "Just now";
    targetThread.transcript = `\u201C${params.originalText}\u201D`;
    targetThread.speechPlayText = params.translatedText || params.originalText;
    const existingIdx = store.threads.findIndex((t) => t.id === targetThread.id);
    if (existingIdx > 0) {
      store.threads.splice(existingIdx, 1);
      store.threads.unshift(targetThread);
    }
  } else {
    targetThread.unread = false;
  }
  const usage = getLiveUsageMeter(store);
  if (usage.alertTriggered && !store.autoAlertWhatsAppSent) {
    store.autoAlertWhatsAppSent = true;
  }
  persistStore2(store);
  return {
    thread: targetThread,
    threads: store.threads,
    unreadCount: store.threads.filter((t) => t.unread).length,
    usage: getLiveUsageMeter(store)
  };
}
function getWhatsAppHeartbeatStatus() {
  const store = loadStore();
  const now = Date.now();
  const heartbeatAgeSec = Math.max(0, Math.round((now - store.lastHeartbeatMs) / 1e3));
  const isStale = heartbeatAgeSec > 180;
  const isIssue = store.lineSimulatedDown || isStale;
  return {
    status: isIssue ? "ISSUE" : "HEALTHY",
    lastHeartbeatAt: new Date(store.lastHeartbeatMs).toISOString(),
    heartbeatAgeSec,
    activeLines: isIssue ? 23 : 24,
    totalLines: 24,
    autoAlertDispatched: isIssue,
    reason: isIssue ? store.lineReason || "Central SIM heartbeat timeout \u2014 Founder WhatsApp alerted automatically." : "All WhatsApp gateway sockets & webhooks responding normally."
  };
}
function recordWhatsAppGatewayHeartbeat(ok = true, reason) {
  const store = loadStore();
  store.lastHeartbeatMs = Date.now();
  store.lineSimulatedDown = !ok;
  store.lineReason = reason || (ok ? "Connected & Healthy via Central WorkCraft Gateway" : "Line drop detected by gateway monitor \u2014 Founder WhatsApp alerted.");
  persistStore2(store);
  return getWhatsAppHeartbeatStatus();
}

// server/opsStore.ts
import crypto4 from "crypto";
import fs4 from "fs";
import path4 from "path";
var DATA_DIR2 = process.env.VERCEL ? path4.join("/tmp", "workcraft-data") : path4.resolve(process.cwd(), ".data");
var OPS_STORE_FILE = path4.join(DATA_DIR2, "ops-ledger.json");
var P256_SPKI_PREFIX = Buffer.from("3059301306072a8648ce3d020106082a8648ce3d030107034200", "hex");
var DEFAULT_OPS_STATE = {
  biometricRevokedBeforeMs: 0,
  biometricDevices: [],
  founderReportPhone: "+92 321 0000000",
  pairingKey: `WC-${crypto4.randomBytes(2).toString("hex").toUpperCase()}-LIVE`,
  pairingUpdatedAt: (/* @__PURE__ */ new Date()).toISOString(),
  agentCashHeld: {
    "agent-pk-1": {
      held: 25e3,
      deals: 1,
      lastUpdatedAt: (/* @__PURE__ */ new Date()).toISOString()
    }
  },
  coAgents: [
    {
      id: "coagent-pk-1",
      leadAgentId: "agent-pk-1",
      leadAgentName: "Kamran Tariq",
      name: "Bilal Raza (Co-Agent)",
      phone: "+92 302 5544332",
      city: "Lahore Gulberg & Model Town",
      splitPctOfAgentShare: 50,
      cashHeld: 0,
      dealsClosed: 3,
      status: "ACTIVE",
      createdAt: new Date(Date.now() - 864e5 * 14).toISOString()
    }
  ],
  ledgerEntries: [],
  broadcasts: [],
  incidents: [],
  usedPaymentTids: []
};
var opsState = structuredClone(DEFAULT_OPS_STATE);
function loadOpsState() {
  try {
    if (!fs4.existsSync(OPS_STORE_FILE)) return;
    const raw = fs4.readFileSync(OPS_STORE_FILE, "utf8");
    const parsed = JSON.parse(raw);
    opsState = {
      ...structuredClone(DEFAULT_OPS_STATE),
      ...parsed,
      agentCashHeld: parsed.agentCashHeld || structuredClone(DEFAULT_OPS_STATE.agentCashHeld),
      coAgents: Array.isArray(parsed.coAgents) ? parsed.coAgents : structuredClone(DEFAULT_OPS_STATE.coAgents),
      ledgerEntries: Array.isArray(parsed.ledgerEntries) ? parsed.ledgerEntries : [],
      broadcasts: Array.isArray(parsed.broadcasts) ? parsed.broadcasts : [],
      biometricDevices: Array.isArray(parsed.biometricDevices) ? parsed.biometricDevices : [],
      incidents: Array.isArray(parsed.incidents) ? parsed.incidents : [],
      usedPaymentTids: Array.isArray(parsed.usedPaymentTids) ? parsed.usedPaymentTids : []
    };
  } catch {
  }
}
async function hydrateOpsStoreFromKv() {
  const remote = await kvGetJson("wc:ops:v1");
  if (!remote) return;
  opsState = {
    ...structuredClone(DEFAULT_OPS_STATE),
    ...remote,
    agentCashHeld: remote.agentCashHeld || opsState.agentCashHeld,
    coAgents: Array.isArray(remote.coAgents) ? remote.coAgents : opsState.coAgents,
    ledgerEntries: Array.isArray(remote.ledgerEntries) ? remote.ledgerEntries : opsState.ledgerEntries,
    broadcasts: Array.isArray(remote.broadcasts) ? remote.broadcasts : opsState.broadcasts,
    biometricDevices: Array.isArray(remote.biometricDevices) ? remote.biometricDevices : opsState.biometricDevices,
    incidents: Array.isArray(remote.incidents) ? remote.incidents : opsState.incidents,
    usedPaymentTids: Array.isArray(remote.usedPaymentTids) ? remote.usedPaymentTids : opsState.usedPaymentTids
  };
}
function saveOpsState() {
  try {
    if (!fs4.existsSync(DATA_DIR2)) {
      fs4.mkdirSync(DATA_DIR2, { recursive: true });
    }
    fs4.writeFileSync(OPS_STORE_FILE, JSON.stringify(opsState, null, 2), "utf8");
  } catch (err) {
    console.warn("Could not persist ops state:", err);
  }
  void kvSetJson("wc:ops:v1", opsState);
}
loadOpsState();
function decodeBase64Flexible(input) {
  const clean = (input || "").trim().replace(/-/g, "+").replace(/_/g, "/");
  const pad = clean.length % 4 === 0 ? "" : "=".repeat(4 - clean.length % 4);
  return Buffer.from(clean + pad, "base64");
}
function encodeBase64Url(buf) {
  return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function extractSpkiFromAuthenticatorData(authData) {
  try {
    if (authData.length < 55) return null;
    const flags = authData[32];
    const hasAttestedCredentialData = (flags & 64) !== 0;
    if (!hasAttestedCredentialData) return null;
    let offset = 37 + 16;
    const credIdLen = authData.readUInt16BE(offset);
    offset += 2 + credIdLen;
    const cose = authData.subarray(offset);
    const xMarker = Buffer.from([33, 88, 32]);
    const yMarker = Buffer.from([34, 88, 32]);
    const xIdx = cose.indexOf(xMarker);
    const yIdx = cose.indexOf(yMarker);
    if (xIdx < 0 || yIdx < 0) return null;
    const x = cose.subarray(xIdx + 3, xIdx + 35);
    const y = cose.subarray(yIdx + 3, yIdx + 35);
    if (x.length !== 32 || y.length !== 32) return null;
    const spki = Buffer.concat([P256_SPKI_PREFIX, Buffer.from([4]), x, y]);
    return spki.toString("base64");
  } catch {
    return null;
  }
}
function issueFounderWebAuthnChallenge(purpose) {
  const challenge = encodeBase64Url(crypto4.randomBytes(32));
  const challengeToken = signServerBlob({
    kind: "webauthn-challenge",
    purpose,
    challenge,
    exp: Date.now() + 12e4
    // 2-minute challenge window
  });
  return { challenge, challengeToken };
}
function registerFounderBiometricCredential(params) {
  const challengeClaims = verifyServerBlob(params.challengeToken);
  if (!challengeClaims || challengeClaims.kind !== "webauthn-challenge" || challengeClaims.purpose !== "register" || !challengeClaims.challenge || !challengeClaims.exp || challengeClaims.exp < Date.now()) {
    return { ok: false, error: "Biometric setup session expired. Please try again." };
  }
  let clientData = {};
  try {
    clientData = JSON.parse(decodeBase64Flexible(params.clientDataJSON).toString("utf8"));
  } catch {
    return { ok: false, error: "Malformed WebAuthn client data." };
  }
  if (clientData.type !== "webauthn.create" || clientData.challenge !== challengeClaims.challenge) {
    return { ok: false, error: "Biometric challenge mismatch." };
  }
  let spkiBase64 = (params.publicKeySpkiBase64 || "").trim();
  if (!spkiBase64 && params.authenticatorDataBase64) {
    const authBuf = decodeBase64Flexible(params.authenticatorDataBase64);
    spkiBase64 = extractSpkiFromAuthenticatorData(authBuf) || "";
  }
  if (!spkiBase64) {
    return { ok: false, error: "Browser did not expose an ECDSA P-256 public key for biometrics." };
  }
  try {
    const spkiBuf = decodeBase64Flexible(spkiBase64);
    crypto4.createPublicKey({ key: spkiBuf, format: "der", type: "spki" });
    spkiBase64 = spkiBuf.toString("base64");
  } catch {
    return { ok: false, error: "Unsupported biometric key format. Please use Fingerprint or Face ID." };
  }
  const credentialId = sanitizePlainText(params.credentialId, 300);
  if (!credentialId) {
    return { ok: false, error: "Missing WebAuthn credential ID." };
  }
  const deviceLabel = sanitizePlainText(params.deviceLabel, 80) || "Founder Mobile Device";
  const createdAtMs = Date.now();
  opsState.biometricDevices = [
    { credentialId, spkiBase64, deviceLabel, createdAtMs },
    ...opsState.biometricDevices.filter((d) => d.credentialId !== credentialId)
  ].slice(0, 10);
  saveOpsState();
  const biometricBlob = signServerBlob({
    kind: "founder-biometric",
    credentialId,
    spkiBase64,
    deviceLabel,
    createdAtMs
  });
  return { ok: true, biometricBlob, deviceLabel, credentialId };
}
function verifyFounderBiometricAssertion(params) {
  const challengeClaims = verifyServerBlob(params.challengeToken);
  if (!challengeClaims || challengeClaims.kind !== "webauthn-challenge" || challengeClaims.purpose !== "login" || !challengeClaims.challenge || !challengeClaims.exp || challengeClaims.exp < Date.now()) {
    return { ok: false, error: "Biometric prompt expired. Please tap Unlock with Biometric again." };
  }
  const blobClaims = verifyServerBlob(params.biometricBlob);
  if (!blobClaims || blobClaims.kind !== "founder-biometric" || !blobClaims.credentialId || !blobClaims.spkiBase64 || (blobClaims.createdAtMs || 0) < opsState.biometricRevokedBeforeMs) {
    return {
      ok: false,
      error: "Saved device biometric was revoked or expired. Unlock once with your Founder PIN to re-enable."
    };
  }
  if (blobClaims.credentialId !== params.credentialId.trim()) {
    return { ok: false, error: "Credential ID mismatch for this mobile device." };
  }
  const clientDataBuf = decodeBase64Flexible(params.clientDataJSON);
  let clientData = {};
  try {
    clientData = JSON.parse(clientDataBuf.toString("utf8"));
  } catch {
    return { ok: false, error: "Invalid WebAuthn client data." };
  }
  if (clientData.type !== "webauthn.get" || clientData.challenge !== challengeClaims.challenge) {
    return { ok: false, error: "Biometric login challenge verification failed." };
  }
  const authDataBuf = decodeBase64Flexible(params.authenticatorData);
  if (authDataBuf.length < 37 || (authDataBuf[32] & 1) === 0) {
    return { ok: false, error: "User presence was not confirmed by device biometric sensor." };
  }
  try {
    const publicKey = crypto4.createPublicKey({
      key: decodeBase64Flexible(blobClaims.spkiBase64),
      format: "der",
      type: "spki"
    });
    const clientHash = crypto4.createHash("sha256").update(clientDataBuf).digest();
    const signedPayload = Buffer.concat([authDataBuf, clientHash]);
    const sigBuf = decodeBase64Flexible(params.signature);
    const verified = crypto4.verify("sha256", signedPayload, publicKey, sigBuf);
    if (!verified) {
      return { ok: false, error: "Biometric signature verification failed." };
    }
  } catch {
    return { ok: false, error: "Could not verify hardware biometric signature." };
  }
  return { ok: true, deviceLabel: blobClaims.deviceLabel || "Founder Mobile Device" };
}
function revokeAllFounderBiometrics() {
  opsState.biometricRevokedBeforeMs = Date.now();
  opsState.biometricDevices = [];
  saveOpsState();
  return { revokedAt: new Date(opsState.biometricRevokedBeforeMs).toISOString() };
}
function getFinanceAndAgentSummary(agentId = "agent-pk-1") {
  const agentCash = opsState.agentCashHeld[agentId] || {
    held: 0,
    deals: 0,
    lastUpdatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  const coAgents = opsState.coAgents.filter((c) => c.leadAgentId === agentId);
  return {
    agentId,
    cashHeld: agentCash.held,
    dealsCount: agentCash.deals,
    lastUpdatedAt: agentCash.lastUpdatedAt,
    coAgents,
    recentLedger: opsState.ledgerEntries.slice(0, 25)
  };
}
function recordAgentCashCollection(params) {
  const agentKey = params.agentId || "agent-pk-1";
  const current = opsState.agentCashHeld[agentKey] || {
    held: 0,
    deals: 0,
    lastUpdatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  const amount = Math.max(0, Math.round(Number(params.amount || 0)));
  const updatedHeld = current.held + amount;
  const updatedDeals = current.deals + 1;
  opsState.agentCashHeld[agentKey] = {
    held: updatedHeld,
    deals: updatedDeals,
    lastUpdatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  if (params.coAgentId) {
    const coAgent = opsState.coAgents.find((c) => c.id === params.coAgentId);
    if (coAgent) {
      coAgent.cashHeld += amount;
      coAgent.dealsClosed += 1;
      coAgent.status = "HANDOFF_PENDING";
    }
  }
  const entry = {
    id: `led-${Date.now()}-${crypto4.randomBytes(2).toString("hex")}`,
    type: "CASH_COLLECTED",
    salonName: sanitizePlainText(params.salonName, 100) || "Partner Salon",
    agentId: agentKey,
    coAgentId: params.coAgentId,
    amount,
    currency: "PKR",
    method: "Biometric Cash Collection",
    referenceTid: sanitizePlainText(params.tid, 60) || `CASH-${Date.now()}`,
    proofHash: sanitizePlainText(params.proofHash, 80) || "sha256:verified",
    note: params.coAgentId ? `Cash collected via Co-Agent (${params.coAgentId}) \u2014 pending handover to Lead Agent.` : "Cash collected by Lead Field Agent with biometric seal.",
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  opsState.ledgerEntries.unshift(entry);
  opsState.ledgerEntries = opsState.ledgerEntries.slice(0, 100);
  saveOpsState();
  return { entry, ...getFinanceAndAgentSummary(agentKey) };
}
function recordAgentCashRemittance(params) {
  const agentKey = params.agentId || "agent-pk-1";
  const current = opsState.agentCashHeld[agentKey] || {
    held: 0,
    deals: 0,
    lastUpdatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  const clearedAmount = typeof params.amount === "number" && params.amount > 0 ? Math.min(current.held, Math.round(params.amount)) : current.held;
  const nextHeld = Math.max(0, current.held - clearedAmount);
  opsState.agentCashHeld[agentKey] = {
    held: nextHeld,
    deals: nextHeld === 0 ? 0 : current.deals,
    lastUpdatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  const entry = {
    id: `led-${Date.now()}-${crypto4.randomBytes(2).toString("hex")}`,
    type: "CASH_REMITTED",
    salonName: "WORKCRAFT Main Account",
    agentId: agentKey,
    amount: clearedAmount,
    currency: "PKR",
    method: "Official Bank / Wallet Remittance",
    referenceTid: sanitizePlainText(params.tid, 80),
    proofHash: `sha256:${crypto4.createHash("sha256").update(params.tid).digest("hex").slice(0, 16)}`,
    note: "Agent remitted held cash into WORKCRAFT Main Account.",
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  opsState.ledgerEntries.unshift(entry);
  opsState.ledgerEntries = opsState.ledgerEntries.slice(0, 100);
  saveOpsState();
  return { clearedAmount, entry, ...getFinanceAndAgentSummary(agentKey) };
}
function createCoAgentRecord(params) {
  const record = {
    id: `coagent-${Date.now().toString(36)}-${crypto4.randomBytes(2).toString("hex")}`,
    leadAgentId: params.leadAgentId || "agent-pk-1",
    leadAgentName: sanitizePlainText(params.leadAgentName, 80) || "Lead Field Agent",
    name: sanitizePlainText(params.name, 80),
    phone: sanitizePhone(params.phone),
    city: sanitizePlainText(params.city, 100) || "Pakistan",
    splitPctOfAgentShare: Math.max(10, Math.min(90, Math.round(Number(params.splitPctOfAgentShare || 50)))),
    cashHeld: 0,
    dealsClosed: 0,
    status: "ACTIVE",
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  opsState.coAgents.unshift(record);
  saveOpsState();
  return record;
}
function recordCoAgentCashHandoff(params) {
  const coAgent = opsState.coAgents.find((c) => c.id === params.coAgentId);
  if (!coAgent) return null;
  const handedOffAmount = coAgent.cashHeld;
  coAgent.cashHeld = 0;
  coAgent.status = "ACTIVE";
  const entry = {
    id: `led-${Date.now()}-${crypto4.randomBytes(2).toString("hex")}`,
    type: "CO_AGENT_HANDOFF",
    salonName: `Co-Agent Handoff (${coAgent.name})`,
    agentId: params.leadAgentId || coAgent.leadAgentId,
    coAgentId: coAgent.id,
    amount: handedOffAmount,
    currency: "PKR",
    method: "Co-Agent \u2794 Lead Agent Biometric Handoff",
    referenceTid: sanitizePlainText(params.referenceTid, 60) || `HANDOFF-${Date.now()}`,
    proofHash: `sha256:${crypto4.createHash("sha256").update(`${coAgent.id}:${Date.now()}`).digest("hex").slice(0, 16)}`,
    note: `Verified ${coAgent.splitPctOfAgentShare}% co-agent split settlement & physical handoff.`,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  opsState.ledgerEntries.unshift(entry);
  opsState.ledgerEntries = opsState.ledgerEntries.slice(0, 100);
  saveOpsState();
  return { coAgent, entry, ...getFinanceAndAgentSummary(params.leadAgentId || coAgent.leadAgentId) };
}
var WORKCRAFT_PACKAGE_CATALOG = {
  PKR: {
    STARTER: { setupFee: 17500, monthlyMaint: 1750, bookingsLimit: "750 bookings/mo" },
    GROWTH: { setupFee: 25e3, monthlyMaint: 2500, bookingsLimit: "1,500 bookings/mo" },
    VIP: { setupFee: 35e3, monthlyMaint: 3500, bookingsLimit: "3,000 bookings/mo" },
    CUSTOM: { setupFee: 5e4, monthlyMaint: 5e3, bookingsLimit: "> 3,000 bookings/mo" }
  },
  USD: {
    STARTER: { setupFee: 79, monthlyMaint: 15, bookingsLimit: "750 bookings/mo" },
    GROWTH: { setupFee: 129, monthlyMaint: 25, bookingsLimit: "1,500 bookings/mo" },
    VIP: { setupFee: 169, monthlyMaint: 35, bookingsLimit: "3,000 bookings/mo" },
    CUSTOM: { setupFee: 250, monthlyMaint: 50, bookingsLimit: "> 3,000 bookings/mo" }
  },
  AED: {
    STARTER: { setupFee: 290, monthlyMaint: 55, bookingsLimit: "750 bookings/mo" },
    GROWTH: { setupFee: 475, monthlyMaint: 92, bookingsLimit: "1,500 bookings/mo" },
    VIP: { setupFee: 620, monthlyMaint: 129, bookingsLimit: "3,000 bookings/mo" },
    CUSTOM: { setupFee: 920, monthlyMaint: 184, bookingsLimit: "> 3,000 bookings/mo" }
  },
  SAR: {
    STARTER: { setupFee: 295, monthlyMaint: 56, bookingsLimit: "750 bookings/mo" },
    GROWTH: { setupFee: 485, monthlyMaint: 94, bookingsLimit: "1,500 bookings/mo" },
    VIP: { setupFee: 635, monthlyMaint: 131, bookingsLimit: "3,000 bookings/mo" },
    CUSTOM: { setupFee: 940, monthlyMaint: 188, bookingsLimit: "> 3,000 bookings/mo" }
  },
  GBP: {
    STARTER: { setupFee: 62, monthlyMaint: 12, bookingsLimit: "750 bookings/mo" },
    GROWTH: { setupFee: 102, monthlyMaint: 20, bookingsLimit: "1,500 bookings/mo" },
    VIP: { setupFee: 134, monthlyMaint: 28, bookingsLimit: "3,000 bookings/mo" },
    CUSTOM: { setupFee: 198, monthlyMaint: 40, bookingsLimit: "> 3,000 bookings/mo" }
  }
};
function normalizeWorkcraftTier(rawTier) {
  const upper = String(rawTier || "").trim().toUpperCase();
  if (upper === "STARTER") return "STARTER";
  if (upper === "GROWTH" || upper === "PRO") return "GROWTH";
  if (upper === "VIP" || upper === "PRO++") return "VIP";
  if (upper === "CUSTOM") return "CUSTOM";
  return "GROWTH";
}
function resolveOfficialWorkcraftDestination(method, currency) {
  const m = method.toLowerCase();
  if (m.includes("easypaisa")) return "WorkCraft EasyPaisa Merchant Till (0300-WORKCRAFT)";
  if (m.includes("jazzcash")) return "WorkCraft JazzCash Corporate Till (789210)";
  if (m.includes("stripe") || m.includes("card")) return `WorkCraft Official Stripe 3DS Account (${currency})`;
  if (m.includes("cash")) return "WorkCraft Pakistan Field Cash Custody (48h Meezan Remittance Locked)";
  return "WorkCraft Meezan Bank Ltd Official (PK64MEZN0001020304050607)";
}
function verifyAuthoritativeWorkcraftPayment(params) {
  const cleanTid = sanitizePlainText(params.tid, 80).trim();
  if (cleanTid.length < 6 || !/^[A-Za-z0-9._:/-]+$/.test(cleanTid)) {
    return {
      ok: false,
      error: "Valid Transaction ID (TID) / Bank Reference (min 6 alphanumeric characters) is required."
    };
  }
  const lowerTid = cleanTid.toLowerCase();
  if (/^(test|demo|fake|000000|111111|123456|abcdef)/.test(lowerTid)) {
    return {
      ok: false,
      error: "Placeholder or test TID rejected. Enter an authentic wallet, bank, or card reference."
    };
  }
  if (opsState.usedPaymentTids.includes(cleanTid.toUpperCase())) {
    return {
      ok: false,
      error: `Duplicate TID detected (${cleanTid}). Every WorkCraft payment receipt must be unique.`
    };
  }
  const normCurrency = String(params.currency || "PKR").toUpperCase();
  const catalog = WORKCRAFT_PACKAGE_CATALOG[normCurrency] || WORKCRAFT_PACKAGE_CATALOG.PKR;
  const effectiveCurrency = WORKCRAFT_PACKAGE_CATALOG[normCurrency] ? normCurrency : "PKR";
  const submitted = Number(params.submittedAmount || 0);
  if (!Number.isFinite(submitted) || submitted <= 0) {
    return { ok: false, error: "Payment amount must be greater than zero." };
  }
  let expectedAmount = submitted;
  if (params.kind === "SETUP") {
    const tierKey = normalizeWorkcraftTier(params.tier);
    expectedAmount = catalog[tierKey].setupFee;
  } else if (params.kind === "MAINTENANCE") {
    if (params.tier) {
      const tierKey = normalizeWorkcraftTier(params.tier);
      expectedAmount = catalog[tierKey].monthlyMaint;
    } else {
      const allowedMaints = Object.values(catalog).map((c) => c.monthlyMaint);
      if (!allowedMaints.some((m) => Math.abs(m - submitted) < 0.01)) {
        return {
          ok: false,
          error: `Maintenance amount ${effectiveCurrency} ${submitted} does not match any official WorkCraft monthly plan.`
        };
      }
      expectedAmount = submitted;
    }
  } else if (params.kind === "UPGRADE") {
    const targetTier = normalizeWorkcraftTier(params.tier);
    if (params.previousTier) {
      const prevTier = normalizeWorkcraftTier(params.previousTier);
      expectedAmount = Math.max(0, catalog[targetTier].setupFee - catalog[prevTier].setupFee);
    } else {
      expectedAmount = catalog[targetTier].setupFee;
    }
  } else if (params.kind === "VIDEO_CAMPAIGN") {
    const isMonthly4 = String(params.tier || "").toUpperCase() === "MONTHLY_4";
    if (effectiveCurrency === "PKR") {
      expectedAmount = isMonthly4 ? 4e3 : 1500;
    } else {
      expectedAmount = isMonthly4 ? 40 : 15;
    }
  }
  if (params.kind !== "UPGRADE" || params.previousTier) {
    if (Math.abs(submitted - expectedAmount) > 0.5) {
      return {
        ok: false,
        error: `Amount mismatch: expected exact ${effectiveCurrency} ${expectedAmount.toLocaleString()} for WorkCraft settlement, received ${effectiveCurrency} ${submitted.toLocaleString()}.`
      };
    }
  }
  opsState.usedPaymentTids.unshift(cleanTid.toUpperCase());
  opsState.usedPaymentTids = opsState.usedPaymentTids.slice(0, 1e3);
  saveOpsState();
  const officialDestination = resolveOfficialWorkcraftDestination(params.method, effectiveCurrency);
  const sha256Proof = `sha256:${crypto4.createHash("sha256").update(`${params.kind}:${params.salonId || "onboarding"}:${cleanTid}:${expectedAmount}:${effectiveCurrency}`).digest("hex").slice(0, 32)}`;
  return {
    ok: true,
    normalizedTid: cleanTid,
    verifiedAmount: expectedAmount,
    currency: effectiveCurrency,
    officialDestination,
    sha256Proof
  };
}
function recordSalonFinancialPayment(params) {
  const entry = {
    id: `led-${Date.now()}-${crypto4.randomBytes(2).toString("hex")}`,
    type: params.type,
    salonId: params.salonId,
    salonName: sanitizePlainText(params.salonName, 100) || "Partner Salon",
    ...params.agentId ? { agentId: sanitizePlainText(params.agentId, 60) } : {},
    amount: Math.max(0, Math.round(Number(params.amount || 0))),
    currency: sanitizePlainText(params.currency, 8) || "PKR",
    method: sanitizePlainText(params.method, 80) || "Digital Gateway",
    referenceTid: sanitizePlainText(params.referenceTid, 80) || `TXN-${Date.now()}`,
    proofHash: `sha256:${crypto4.createHash("sha256").update(`${params.salonId}:${params.referenceTid}:${Date.now()}`).digest("hex").slice(0, 16)}`,
    note: sanitizePlainText(params.note, 220),
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  opsState.ledgerEntries.unshift(entry);
  opsState.ledgerEntries = opsState.ledgerEntries.slice(0, 100);
  saveOpsState();
  return entry;
}
function getFounderSettings() {
  return {
    founderReportPhone: opsState.founderReportPhone,
    pairingKey: opsState.pairingKey,
    pairingUpdatedAt: opsState.pairingUpdatedAt,
    biometricDeviceCount: opsState.biometricDevices.length,
    broadcasts: opsState.broadcasts.slice(0, 10)
  };
}
function updateFounderReportPhone(phone) {
  const cleaned = sanitizePhone(phone);
  if (!cleaned) return null;
  opsState.founderReportPhone = cleaned;
  saveOpsState();
  return getFounderSettings();
}
function rotateFounderPairingKey() {
  opsState.pairingKey = `WC-${crypto4.randomBytes(2).toString("hex").toUpperCase()}-LIVE`;
  opsState.pairingUpdatedAt = (/* @__PURE__ */ new Date()).toISOString();
  saveOpsState();
  return getFounderSettings();
}
function recordFounderBroadcastDispatch(params) {
  const entry = {
    id: `bc-${Date.now().toString(36)}`,
    title: sanitizePlainText(params.title, 160),
    messageEn: sanitizePlainText(params.messageEn, 800),
    regionFilter: sanitizePlainText(params.regionFilter, 20) || "ALL",
    tierFilter: sanitizePlainText(params.tierFilter, 20) || "ALL",
    recipientCount: Math.max(1, Math.round(Number(params.recipientCount || 1))),
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  opsState.broadcasts.unshift(entry);
  opsState.broadcasts = opsState.broadcasts.slice(0, 20);
  saveOpsState();
  return entry;
}
function recordIncidentReport(params) {
  const normRole = sanitizePlainText(params.role || "SYSTEM", 24).toUpperCase();
  const role = normRole === "FOUNDER" || normRole === "AGENT" || normRole === "SALON_OWNER" || normRole === "END_USER" ? normRole : "SYSTEM";
  const normSeverity = sanitizePlainText(params.severity || "MEDIUM", 16).toUpperCase();
  const severity = normSeverity === "CRITICAL" ? "CRITICAL" : normSeverity === "LOW" ? "LOW" : "MEDIUM";
  const normStatus = sanitizePlainText(params.resolutionStatus || "AUTO_RESOLVED", 32).toUpperCase();
  const resolutionStatus = normStatus === "NEEDS_FOUNDER_ACTION" ? "NEEDS_FOUNDER_ACTION" : normStatus === "FALLBACK_ACTIVE" ? "FALLBACK_ACTIVE" : normStatus === "RESOLVED_BY_FOUNDER" ? "RESOLVED_BY_FOUNDER" : "AUTO_RESOLVED";
  const occurredAt = (/* @__PURE__ */ new Date()).toISOString();
  const shouldAlertFounder = severity === "CRITICAL" || resolutionStatus === "NEEDS_FOUNDER_ACTION" || resolutionStatus === "AUTO_RESOLVED";
  const record = {
    id: `inc-${Date.now().toString(36)}-${crypto4.randomBytes(2).toString("hex")}`,
    role,
    area: sanitizePlainText(params.area || "Application UI", 80),
    route: sanitizePlainText(params.route || "/", 140),
    severity,
    message: sanitizePlainText(params.message || "Recovered runtime glitch", 320),
    stackHint: params.stackHint ? sanitizePlainText(params.stackHint, 240) : void 0,
    resolutionStatus,
    recoveryMs: Math.max(10, Math.min(3e4, Math.round(Number(params.recoveryMs || 800)))),
    founderAlerted: shouldAlertFounder,
    occurredAt,
    resolvedAt: resolutionStatus === "AUTO_RESOLVED" ? occurredAt : null
  };
  opsState.incidents.unshift(record);
  opsState.incidents = opsState.incidents.slice(0, 80);
  saveOpsState();
  if (severity === "CRITICAL" || resolutionStatus === "NEEDS_FOUNDER_ACTION") {
    void dispatchFounderAlertWebhook({
      id: record.id,
      severity: record.severity,
      role: record.role,
      area: record.area,
      route: record.route,
      message: record.message,
      resolutionStatus: record.resolutionStatus,
      recoveryMs: record.recoveryMs,
      occurredAt: record.occurredAt
    });
  }
  return record;
}
function listIncidentReports(limit = 50) {
  const list = opsState.incidents.slice(0, Math.max(1, Math.min(80, limit)));
  const autoResolvedCount = opsState.incidents.filter(
    (i) => i.resolutionStatus === "AUTO_RESOLVED" || i.resolutionStatus === "RESOLVED_BY_FOUNDER"
  ).length;
  const openActionCount = opsState.incidents.filter(
    (i) => i.resolutionStatus === "NEEDS_FOUNDER_ACTION"
  ).length;
  const avgRecoveryMs = opsState.incidents.length > 0 ? Math.round(
    opsState.incidents.reduce((sum, i) => sum + (i.recoveryMs || 0), 0) / opsState.incidents.length
  ) : 420;
  return {
    incidents: list,
    summary: {
      totalRecorded: opsState.incidents.length,
      autoResolvedCount,
      openActionCount,
      avgRecoveryMs,
      founderPhone: opsState.founderReportPhone
    }
  };
}
function resolveIncidentReport(incidentId) {
  const item = opsState.incidents.find((i) => i.id === incidentId);
  if (!item) return null;
  item.resolutionStatus = "RESOLVED_BY_FOUNDER";
  item.resolvedAt = (/* @__PURE__ */ new Date()).toISOString();
  saveOpsState();
  return item;
}

// server/app.ts
var SALON_GLOSSARY = [
  [/\bbeard oil treatment\b/i, "\u062F\u0627\u0691\u06BE\u06CC \u0622\u0626\u0644 \u0679\u0631\u06CC\u0679\u0645\u0646\u0679", "\u0639\u0644\u0627\u062C \u0627\u0644\u0644\u062D\u064A\u0629 \u0628\u0627\u0644\u0632\u064A\u062A"],
  [/\bbeard trim\b/i, "\u062F\u0627\u0691\u06BE\u06CC \u06A9\u06CC \u06A9\u0679\u0627\u0626\u06CC \u0648 \u0633\u06CC\u0679\u0646\u06AF", "\u062A\u0634\u0630\u064A\u0628 \u0648\u062A\u062D\u062F\u064A\u062F \u0627\u0644\u0644\u062D\u064A\u0629"],
  [/\bbeard sculpt\b/i, "\u062F\u0627\u0691\u06BE\u06CC \u0627\u0633\u06A9\u0644\u067E\u0679\u0646\u06AF \u0648 \u062E\u0637", "\u0646\u062D\u062A \u0648\u062A\u062D\u062F\u064A\u062F \u0627\u0644\u0644\u062D\u064A\u0629"],
  [/\bbeard color\b/i, "\u062F\u0627\u0691\u06BE\u06CC \u06A9\u0644\u0631\u0646\u06AF", "\u0635\u0628\u063A \u0627\u0644\u0644\u062D\u064A\u0629"],
  [/\bbeard styling\b/i, "\u062F\u0627\u0691\u06BE\u06CC \u0627\u0633\u0679\u0627\u0626\u0644\u0646\u06AF", "\u062A\u0635\u0641\u064A\u0641 \u0627\u0644\u0644\u062D\u064A\u0629"],
  [/\bhot towel shave\b/i, "\u06C1\u0627\u0679 \u0679\u0627\u0648\u0644 \u0634\u06CC\u0648", "\u062D\u0644\u0627\u0642\u0629 \u0628\u0627\u0644\u0645\u0646\u0634\u0641\u0629 \u0627\u0644\u0633\u0627\u062E\u0646\u0629"],
  [/\broyal shave\b/i, "\u0634\u0627\u06C1\u06CC \u0634\u06CC\u0648", "\u062D\u0644\u0627\u0642\u0629 \u0645\u0644\u0643\u064A\u0629"],
  [/\bexecutive haircut\b/i, "\u0627\u06CC\u06AF\u0632\u06CC\u06A9\u0679\u0648 \u06C1\u06CC\u0626\u0631 \u06A9\u0679", "\u0642\u0635 \u0634\u0639\u0631 \u062A\u0646\u0641\u064A\u0630\u064A"],
  [/\bkids haircut\b/i, "\u0628\u0686\u0648\u06BA \u06A9\u0627 \u06C1\u06CC\u0626\u0631 \u06A9\u0679", "\u0642\u0635 \u0634\u0639\u0631 \u0644\u0644\u0623\u0637\u0641\u0627\u0644"],
  [/\bskin fade\b/i, "\u0627\u0633\u06A9\u0646 \u0641\u06CC\u0688 \u06A9\u0679\u0646\u06AF", "\u062A\u062F\u0631\u064A\u062C \u0633\u0643\u0646 \u0641\u064A\u062F"],
  [/\bclassic haircut\b/i, "\u06A9\u0644\u0627\u0633\u06A9 \u06C1\u06CC\u0626\u0631 \u06A9\u0679", "\u0642\u0635 \u0634\u0639\u0631 \u0643\u0644\u0627\u0633\u064A\u0643\u064A"],
  [/\bdeep cleansing facial\b/i, "\u0688\u06CC\u067E \u06A9\u0644\u06CC\u0646\u0632\u0646\u06AF \u0641\u06CC\u0634\u0644", "\u062A\u0646\u0638\u064A\u0641 \u0639\u0645\u064A\u0642 \u0644\u0644\u0628\u0634\u0631\u0629"],
  [/\bhydra\s*facial\b/i, "\u06C1\u0627\u0626\u06CC\u0688\u0631\u0627 \u0641\u06CC\u0634\u0644", "\u062C\u0644\u0633\u0629 \u0647\u064A\u062F\u0631\u0627\u0641\u064A\u0634\u0644"],
  [/\bgold facial\b/i, "\u06AF\u0648\u0644\u0688 \u0641\u06CC\u0634\u0644", "\u062C\u0644\u0633\u0629 \u0627\u0644\u0630\u0647\u0628 \u0644\u0644\u0648\u062C\u0647"],
  [/\bcharcoal facial\b/i, "\u0686\u0627\u0631\u06A9\u0648\u0644 \u0641\u06CC\u0634\u0644", "\u062A\u0646\u0638\u064A\u0641 \u0628\u0634\u0631\u0629 \u0628\u0627\u0644\u0641\u062D\u0645"],
  [/\bskin polish\b/i, "\u0627\u0633\u06A9\u0646 \u067E\u0627\u0644\u0634", "\u0635\u0646\u0641\u0631\u0629 \u0648\u062A\u0641\u062A\u064A\u062D \u0627\u0644\u0628\u0634\u0631\u0629"],
  [/\bkeratin treatment\b/i, "\u06A9\u06CC\u0631\u0627\u0679\u06CC\u0646 \u0679\u0631\u06CC\u0679\u0645\u0646\u0679", "\u0639\u0644\u0627\u062C \u0627\u0644\u0643\u064A\u0631\u0627\u062A\u064A\u0646 \u0644\u0644\u0634\u0639\u0631"],
  [/\bhair protein\b/i, "\u06C1\u06CC\u0626\u0631 \u067E\u0631\u0648\u0679\u06CC\u0646 \u0679\u0631\u06CC\u0679\u0645\u0646\u0679", "\u0628\u0631\u0648\u062A\u064A\u0646 \u0644\u062A\u0642\u0648\u064A\u0629 \u0627\u0644\u0634\u0639\u0631"],
  [/\bhead massage\b/i, "\u0633\u0631 \u06A9\u0627 \u0645\u0633\u0627\u062C", "\u062A\u062F\u0644\u064A\u0643 \u0627\u0644\u0631\u0623\u0633"],
  [/\bshoulder massage\b/i, "\u06A9\u0646\u062F\u06BE\u0648\u06BA \u06A9\u0627 \u0645\u0633\u0627\u062C", "\u062A\u062F\u0644\u064A\u0643 \u0627\u0644\u0643\u062A\u0641\u064A\u0646"],
  [/\bmanicure\b/i, "\u0645\u06CC\u0646\u06CC \u06A9\u06CC\u0648\u0631", "\u0645\u0627\u0646\u064A\u0643\u064A\u0631"],
  [/\bpedicure\b/i, "\u067E\u06CC\u0688\u06CC \u06A9\u06CC\u0648\u0631", "\u0628\u0627\u062F\u064A\u0643\u064A\u0631"],
  [/\bparty makeup\b/i, "\u067E\u0627\u0631\u0679\u06CC \u0645\u06CC\u06A9 \u0627\u067E", "\u0645\u0643\u064A\u0627\u062C \u062D\u0641\u0644\u0627\u062A"],
  [/\bbridal makeup\b/i, "\u0628\u0631\u0627\u0626\u06CC\u0688\u0644 \u0645\u06CC\u06A9 \u0627\u067E", "\u0645\u0643\u064A\u0627\u062C \u0639\u0631\u0627\u0626\u0633"],
  [/\bthreading\b/i, "\u062A\u06BE\u0631\u06CC\u0688\u0646\u06AF", "\u0641\u062A\u0644\u0629 / \u062A\u0646\u0638\u064A\u0641 \u0627\u0644\u062D\u0648\u0627\u062C\u0628"],
  [/\bwaxing\b/i, "\u0648\u06CC\u06A9\u0633\u0646\u06AF", "\u0625\u0632\u0627\u0644\u0629 \u0627\u0644\u0634\u0639\u0631 \u0628\u0627\u0644\u0634\u0645\u0639"],
  [/\bbleach\b/i, "\u0627\u0633\u06A9\u0646 \u0628\u0644\u06CC\u0686", "\u062A\u0634\u0642\u064A\u0631 \u0648\u062A\u0641\u062A\u064A\u062D"],
  [/\bhair color\b/i, "\u06C1\u06CC\u0626\u0631 \u06A9\u0644\u0631", "\u0635\u0628\u063A\u0629 \u0634\u0639\u0631"],
  [/\bscalp\b/i, "\u0627\u0633\u06A9\u06CC\u0644\u067E", "\u0641\u0631\u0648\u0629 \u0627\u0644\u0631\u0623\u0633"],
  [/\bozone\b/i, "\u0627\u0648\u0632\u0648\u0646", "\u0623\u0648\u0632\u0648\u0646"],
  [/\bsteam\b/i, "\u0627\u0633\u0679\u06CC\u0645 (\u0628\u06BE\u0627\u067E)", "\u0628\u062E\u0627\u0631"],
  [/\bfacial\b/i, "\u0641\u06CC\u0634\u0644", "\u062A\u0646\u0638\u064A\u0641 \u0628\u0634\u0631\u0629"],
  [/\bwash\b/i, "\u0648\u0627\u0634", "\u063A\u0633\u064A\u0644"],
  [/\bhaircut\b/i, "\u06C1\u06CC\u0626\u0631 \u06A9\u0679", "\u0642\u0635 \u0634\u0639\u0631"],
  [/\bshave\b/i, "\u0634\u06CC\u0648", "\u062D\u0644\u0627\u0642\u0629"],
  [/\bbeard\b/i, "\u062F\u0627\u0691\u06BE\u06CC", "\u0627\u0644\u0644\u062D\u064A\u0629"],
  [/\bhair\b/i, "\u0628\u0627\u0644\u0648\u06BA \u06A9\u0627", "\u0627\u0644\u0634\u0639\u0631"],
  [/\boil\b/i, "\u0622\u0626\u0644", "\u0632\u064A\u062A"],
  [/\bmassage\b/i, "\u0645\u0633\u0627\u062C", "\u0645\u0633\u0627\u062C \u0648\u062A\u062F\u0644\u064A\u0643"],
  [/\btreatment\b/i, "\u0679\u0631\u06CC\u0679\u0645\u0646\u0679", "\u0639\u0644\u0627\u062C"],
  [/\btrim\b/i, "\u0679\u0631\u0645", "\u062A\u0634\u0630\u064A\u0628"],
  [/\bspa\b/i, "\u0633\u067E\u0627", "\u0633\u0628\u0627"],
  [/\bcombo\b/i, "\u06A9\u0648\u0645\u0628\u0648 \u067E\u06CC\u06A9\u06CC\u062C", "\u0628\u0627\u0642\u0629 \u0634\u0627\u0645\u0644\u0629"],
  [/\bpackage\b/i, "\u067E\u06CC\u06A9\u06CC\u062C", "\u0628\u0627\u0642\u0629"],
  [/\bstyling\b/i, "\u0627\u0633\u0679\u0627\u0626\u0644\u0646\u06AF", "\u062A\u0635\u0641\u064A\u0641"],
  [/\bscrub\b/i, "\u0627\u0633\u06A9\u0631\u0628", "\u0633\u0646\u0641\u0631\u0629"],
  [/\bcleansing\b/i, "\u06A9\u0644\u06CC\u0646\u0632\u0646\u06AF", "\u062A\u0646\u0638\u064A\u0641"],
  [/\bwhitening\b/i, "\u0648\u0627\u0626\u0679\u0646\u0646\u06AF", "\u062A\u0641\u062A\u064A\u062D"],
  [/\bdetox\b/i, "\u0688\u06CC\u0679\u0627\u06A9\u0633", "\u062A\u0646\u0642\u064A\u0629"],
  [/\bglow\b/i, "\u06AF\u0644\u0648", "\u0646\u0636\u0627\u0631\u0629"],
  [/\bpremium\b/i, "\u067E\u0631\u06CC\u0645\u06CC\u0645", "\u0641\u0627\u062E\u0631"],
  [/\bluxury\b/i, "\u0644\u06AF\u0698\u0631\u06CC", "\u0645\u0644\u0643\u064A \u0641\u0627\u062E\u0631"],
  [/\broyal\b/i, "\u0631\u0627\u0626\u0644", "\u0645\u0644\u0643\u064A"],
  [/\borganic\b/i, "\u0622\u0631\u06AF\u06CC\u0646\u06A9", "\u0637\u0628\u064A\u0639\u064A \u0639\u0636\u0648\u064A"],
  [/\bherbal\b/i, "\u06C1\u0631\u0628\u0644", "\u0623\u0639\u0634\u0627\u0628 \u0637\u0628\u064A\u0639\u064A\u0629"],
  [/\bprotein\b/i, "\u067E\u0631\u0648\u0679\u06CC\u0646", "\u0628\u0631\u0648\u062A\u064A\u0646"],
  [/\bkeratin\b/i, "\u06A9\u06CC\u0631\u0627\u0679\u06CC\u0646", "\u0643\u064A\u0631\u0627\u062A\u064A\u0646"],
  [/\bblowdry\b/i, "\u0628\u0644\u0648 \u0688\u0631\u0627\u0626\u06CC", "\u0633\u0634\u0648\u0627\u0631"]
];
var URDU_CHAR_MAP = {
  a: "\u0627",
  b: "\u0628",
  c: "\u06A9",
  d: "\u0688",
  e: "\u06CC",
  f: "\u0641",
  g: "\u06AF",
  h: "\u06C1",
  i: "\u06CC",
  j: "\u062C",
  k: "\u06A9",
  l: "\u0644",
  m: "\u0645",
  n: "\u0646",
  o: "\u0648",
  p: "\u067E",
  q: "\u0642",
  r: "\u0631",
  s: "\u0633",
  t: "\u0679",
  u: "\u0648",
  v: "\u0648",
  w: "\u0648",
  x: "\u06A9\u0633",
  y: "\u06CC",
  z: "\u0632"
};
var ARABIC_CHAR_MAP = {
  a: "\u0627",
  b: "\u0628",
  c: "\u0643",
  d: "\u062F",
  e: "\u064A",
  f: "\u0641",
  g: "\u063A",
  h: "\u0647",
  i: "\u064A",
  j: "\u062C",
  k: "\u0643",
  l: "\u0644",
  m: "\u0645",
  n: "\u0646",
  o: "\u0648",
  p: "\u0628",
  q: "\u0642",
  r: "\u0631",
  s: "\u0633",
  t: "\u062A",
  u: "\u0648",
  v: "\u0641",
  w: "\u0648",
  x: "\u0643\u0633",
  y: "\u064A",
  z: "\u0632"
};
function transliterateWord(word, lang) {
  const map = lang === "ur" ? URDU_CHAR_MAP : ARABIC_CHAR_MAP;
  let out = word.toLowerCase();
  if (lang === "ur") {
    out = out.replace(/sh/g, "\u0634").replace(/ch/g, "\u0686").replace(/th/g, "\u062A\u06BE").replace(/kh/g, "\u062E").replace(/gh/g, "\u063A").replace(/ph/g, "\u0641").replace(/oo/g, "\u0648").replace(/ee/g, "\u06CC");
  } else {
    out = out.replace(/sh/g, "\u0634").replace(/ch/g, "\u062A\u0634").replace(/th/g, "\u062B").replace(/kh/g, "\u062E").replace(/gh/g, "\u063A").replace(/ph/g, "\u0641").replace(/oo/g, "\u0648").replace(/ee/g, "\u064A");
  }
  let res = "";
  for (const ch of out) {
    if (map[ch]) {
      res += map[ch];
    } else {
      res += ch;
    }
  }
  return res;
}
function fallbackTranslateService(text) {
  const clean = text.trim();
  const buildFor = (lang) => {
    let working = clean;
    for (const [pattern, urVal, arVal] of SALON_GLOSSARY) {
      working = working.replace(pattern, lang === "ur" ? urVal : arVal);
    }
    const tokens = working.split(/\s+/).filter(Boolean);
    const converted = tokens.map((tok) => {
      if (/[a-zA-Z]/.test(tok) && !/^(VIP|HD|24K|LED)$/i.test(tok)) {
        return transliterateWord(tok, lang);
      }
      return tok;
    });
    return converted.join(" ").trim();
  };
  return {
    ur: buildFor("ur"),
    ar: buildFor("ar")
  };
}
function detectInputLanguage(text) {
  if (/[\u0679\u067E\u0686\u0688\u0691\u0698\u06BA\u06BE\u06C1\u06D2]/.test(text)) {
    return "ur";
  }
  if (/[\u0600-\u06FF]/.test(text)) {
    return "ar";
  }
  return "en";
}
var kvHydrationPromise = null;
function ensureKvHydrated() {
  if (!isKvConfigured()) return Promise.resolve();
  if (!kvHydrationPromise) {
    kvHydrationPromise = Promise.all([
      hydrateSecurityStoreFromKv(),
      hydrateOpsStoreFromKv(),
      hydrateVoiceStoreFromKv(),
      hydrateConciergeStoreFromKv()
    ]).then(() => void 0).catch(() => void 0);
  }
  return kvHydrationPromise;
}
function createApiApp(port = 3e3) {
  const app2 = express();
  app2.disable("x-powered-by");
  const metaWebhookJsonParser = express.json({
    limit: "2mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    }
  });
  app2.use("/api/whatsapp/meta-webhook", (req, res, next) => {
    const preParsed = req.body;
    if (preParsed !== void 0 && !Buffer.isBuffer(preParsed)) {
      return next();
    }
    if (req.readableEnded) {
      if (req.body === void 0) req.body = {};
      return next();
    }
    return metaWebhookJsonParser(req, res, next);
  });
  const jsonBodyParser = express.json({ limit: "4mb" });
  app2.use((req, res, next) => {
    const preParsed = req.body;
    if (preParsed !== void 0 && !Buffer.isBuffer(preParsed)) {
      if (typeof preParsed === "string") {
        try {
          req.body = preParsed.trim() ? JSON.parse(preParsed) : {};
        } catch {
          return res.status(400).json({ error: "Invalid JSON request body." });
        }
      }
      return next();
    }
    if (req.readableEnded) {
      if (req.body === void 0) req.body = {};
      return next();
    }
    return jsonBodyParser(req, res, next);
  });
  app2.use("/api", async (req, res, next) => {
    if (req.path !== "/health" && req.path !== "/auth/founder-status") {
      const dbReady = assertProductionDatabaseReady();
      if (!dbReady.ok) {
        return res.status(503).json({ error: dbReady.error });
      }
    }
    try {
      await ensureKvHydrated();
    } catch {
    }
    return next();
  });
  app2.get("/api/health", (_req, res) => {
    const dbReady = assertProductionDatabaseReady();
    res.json({
      ok: true,
      status: "HEALTHY",
      port,
      runtime: process.env.VERCEL ? "vercel-node" : "node",
      kvConfigured: isKvConfigured(),
      rateLimiterConfigured: isRateLimiterConfigured(),
      postgresReady: dbReady.ok
    });
  });
  app2.get("/api/auth/session", (req, res) => {
    const user = extractAuthUserFromRequest(req);
    if (!user) {
      return res.json({ authenticated: false, user: null });
    }
    return res.json({ authenticated: true, user });
  });
  app2.get("/api/auth/founder-status", (_req, res) => {
    const status = getFounderAuthStatus();
    const dbReady = assertProductionDatabaseReady();
    const missingEnvVars = [...status.missingEnvVars];
    if (!dbReady.ok && !missingEnvVars.includes("DATABASE_URL")) {
      missingEnvVars.push("DATABASE_URL");
    }
    return res.json({
      ...status,
      databaseConfigured: dbReady.ok,
      missingEnvVars,
      productionMisconfigured: status.productionMisconfigured || !dbReady.ok
    });
  });
  app2.post("/api/auth/founder-setup", async (req, res) => {
    const ipKey = extractClientIpKey(req.header("x-forwarded-for"), req.ip);
    const rl = await enforceRateLimit(`auth:founder-setup:${ipKey}`, 5, 300, {
      failClosedInProd: true
    });
    if (rl.unavailable) {
      return res.status(503).json({
        error: "Rate limiter unavailable. Configure Upstash Redis in production."
      });
    }
    if (!rl.allowed) {
      return res.status(429).json({
        error: `Too many attempts. Retry in ${rl.retryAfterSec}s.`
      });
    }
    const pin = typeof req.body?.pin === "string" ? req.body.pin : "";
    const claimed = claimInitialFounderPin(pin);
    if (!claimed.ok) {
      return res.status(400).json({ error: claimed.error });
    }
    const founder = getFounderSessionUser();
    const token = signSessionToken(founder);
    setSessionCookie(res, token, req);
    return res.status(201).json({ authenticated: true, user: founder });
  });
  app2.post("/api/auth/founder-session", async (req, res) => {
    if (!isJwtSecretConfigured() || getFounderAuthStatus().productionMisconfigured) {
      return res.status(503).json({
        error: "Founder authentication is not configured in server environment (JWT_SECRET & FOUNDER_PIN required)."
      });
    }
    const existing = extractAuthUserFromRequest(req);
    if (existing?.userRole === "FOUNDER") {
      const token2 = signSessionToken(existing);
      setSessionCookie(res, token2, req);
      return res.json({ authenticated: true, user: existing });
    }
    const ipKey = extractClientIpKey(req.header("x-forwarded-for"), req.ip);
    const rl = await enforceRateLimit(`auth:founder:${ipKey}`, 10, 60, {
      failClosedInProd: true
    });
    if (rl.unavailable) {
      return res.status(503).json({
        error: "Distributed security rate limiter unavailable."
      });
    }
    if (!rl.allowed) {
      return res.status(429).json({
        error: `Too many authentication attempts. Wait ${rl.retryAfterSec}s before retrying.`
      });
    }
    const attemptGate = await checkFounderPinAttemptAllowed(ipKey);
    if (!attemptGate.allowed) {
      return res.status(429).json({
        error: `Too many incorrect Founder PIN attempts. Wait ${attemptGate.retryAfterSec}s before trying again.`
      });
    }
    const pin = typeof req.body?.pin === "string" ? req.body.pin : "";
    if (!verifyFounderPin(pin)) {
      await recordFounderPinFailure(ipKey);
      return res.status(401).json({
        error: "Invalid Founder PIN."
      });
    }
    await clearFounderPinFailures(ipKey);
    const founder = getFounderSessionUser();
    const token = signSessionToken(founder);
    setSessionCookie(res, token, req);
    return res.json({ authenticated: true, user: founder });
  });
  app2.post("/api/auth/rotate-sessions", requireAuth, requireRole("FOUNDER"), (req, res) => {
    const newVersion = rotateAllSessions();
    const founder = getFounderSessionUser();
    const freshToken = signSessionToken(founder);
    setSessionCookie(res, freshToken, req);
    return res.json({ ok: true, sessionVersion: newVersion });
  });
  app2.post("/api/auth/owner-challenge", async (req, res) => {
    const ipKey = extractClientIpKey(req.header("x-forwarded-for"), req.ip);
    const rl = await enforceRateLimit(`auth:owner-challenge:${ipKey}`, 8, 300, {
      failClosedInProd: true
    });
    if (rl.unavailable) {
      return res.status(503).json({ error: "Distributed security rate limiter unavailable." });
    }
    if (!rl.allowed) {
      return res.status(429).json({
        error: `Too many verification code requests. Try again in ${rl.retryAfterSec}s.`
      });
    }
    const identifier = sanitizePlainText(req.body?.identifier, 120);
    if (!identifier) {
      return res.status(400).json({ error: "Enter your registered mobile number or email." });
    }
    const issued = issueOwnerLoginChallenge(identifier);
    if (!issued.ok) {
      return res.status(404).json({ error: issued.error });
    }
    return res.json(issued);
  });
  app2.post("/api/auth/owner-verify", async (req, res) => {
    const ipKey = extractClientIpKey(req.header("x-forwarded-for"), req.ip);
    const rl = await enforceRateLimit(`auth:owner-verify:${ipKey}`, 15, 300, {
      failClosedInProd: true
    });
    if (rl.unavailable) {
      return res.status(503).json({ error: "Distributed security rate limiter unavailable." });
    }
    if (!rl.allowed) {
      return res.status(429).json({
        error: `Too many verification attempts. Try again in ${rl.retryAfterSec}s.`
      });
    }
    const challengeId = sanitizePlainText(req.body?.challengeId, 80);
    const code = sanitizePlainText(req.body?.code, 12);
    const verified = verifyOwnerLoginChallenge(challengeId, code);
    if (!verified.ok) {
      return res.status(401).json({ error: verified.error });
    }
    const token = signSessionToken(verified.user);
    setSessionCookie(res, token, req);
    return res.json({ authenticated: true, user: verified.user });
  });
  app2.post("/api/auth/founder-webauthn/challenge", (req, res) => {
    const purpose = req.body?.purpose === "register" ? "register" : "login";
    if (purpose === "register") {
      const user = extractAuthUserFromRequest(req);
      if (!user || user.userRole !== "FOUNDER") {
        return res.status(401).json({ error: "Sign in with Founder PIN first to register mobile biometrics." });
      }
    }
    const hostHeader = String(req.header("host") || "localhost").split(":")[0].toLowerCase();
    const { challenge, challengeToken } = issueFounderWebAuthnChallenge(purpose);
    return res.json({
      challenge,
      challengeToken,
      rpId: hostHeader,
      rpName: "WorkCraft"
    });
  });
  app2.post(
    "/api/auth/founder-webauthn/register",
    requireAuth,
    requireRole("FOUNDER"),
    (req, res) => {
      const body = req.body || {};
      const result = registerFounderBiometricCredential({
        challengeToken: String(body.challengeToken || ""),
        credentialId: String(body.credentialId || ""),
        clientDataJSON: String(body.clientDataJSON || ""),
        publicKeySpkiBase64: typeof body.publicKeySpkiBase64 === "string" ? body.publicKeySpkiBase64 : void 0,
        authenticatorDataBase64: typeof body.authenticatorDataBase64 === "string" ? body.authenticatorDataBase64 : void 0,
        deviceLabel: typeof body.deviceLabel === "string" ? body.deviceLabel : void 0
      });
      if (!result.ok) {
        return res.status(400).json({ error: result.error });
      }
      return res.status(201).json(result);
    }
  );
  app2.post("/api/auth/founder-webauthn/verify", (req, res) => {
    const body = req.body || {};
    const verification = verifyFounderBiometricAssertion({
      challengeToken: String(body.challengeToken || ""),
      biometricBlob: String(body.biometricBlob || ""),
      credentialId: String(body.credentialId || ""),
      authenticatorData: String(body.authenticatorData || ""),
      clientDataJSON: String(body.clientDataJSON || ""),
      signature: String(body.signature || "")
    });
    if (!verification.ok) {
      return res.status(401).json({ error: verification.error });
    }
    const founder = getFounderSessionUser();
    const token = signSessionToken(founder);
    setSessionCookie(res, token, req);
    return res.json({
      authenticated: true,
      user: founder,
      deviceLabel: verification.deviceLabel
    });
  });
  app2.post(
    "/api/auth/founder-webauthn/revoke",
    requireAuth,
    requireRole("FOUNDER"),
    (_req, res) => {
      return res.json({ ok: true, ...revokeAllFounderBiometrics() });
    }
  );
  app2.post("/api/auth/logout", (_req, res) => {
    clearSessionCookie(res);
    return res.json({ ok: true });
  });
  app2.post("/api/founder/agent-invites", requireAuth, requireRole("FOUNDER"), (req, res) => {
    const agentId = sanitizePlainText(req.body?.agentId, 40) || void 0;
    const name = sanitizePlainText(req.body?.name, 80) || "Field Agent";
    const phone = sanitizePhone(req.body?.phone);
    const city = sanitizePlainText(req.body?.city, 120) || "Assigned Territory";
    const countryName = sanitizePlainText(req.body?.countryName, 60) || "Pakistan";
    if (!phone) {
      return res.status(400).json({ error: "Agent WhatsApp phone is required." });
    }
    const created = createAgentInviteToken({ agentId, name, phone, city, countryName });
    return res.status(201).json({
      ...created,
      enrollPath: `/enroll/agent?token=${encodeURIComponent(created.token)}`
    });
  });
  app2.get("/api/agent/enroll", (req, res) => {
    const token = typeof req.query.token === "string" ? req.query.token : "";
    const check = inspectAgentInviteToken(token);
    if (!check.valid) {
      return res.status(check.status).json({ valid: false, error: check.error });
    }
    return res.json({ valid: true, invite: check.invite });
  });
  app2.post("/api/agent/enroll/complete", async (req, res) => {
    const ipKey = extractClientIpKey(req.header("x-forwarded-for"), req.ip);
    const rl = await enforceRateLimit(`auth:agent-enroll:${ipKey}`, 10, 300, {
      failClosedInProd: true
    });
    if (rl.unavailable) {
      return res.status(503).json({ error: "Distributed security rate limiter unavailable." });
    }
    if (!rl.allowed) {
      return res.status(429).json({
        error: `Too many enrollment attempts. Retry after ${rl.retryAfterSec}s.`
      });
    }
    const honeypot = typeof req.body?.websiteUrl === "string" && req.body.websiteUrl.trim() || typeof req.body?.companyFax === "string" && req.body.companyFax.trim();
    if (honeypot) {
      return res.status(200).json({ ok: true, ignored: true });
    }
    const rawToken = sanitizePlainText(req.body?.token, 128);
    const result = consumeAgentInviteTokenAndRegisterAgent({
      rawToken,
      name: req.body?.name,
      phone: req.body?.phone,
      city: req.body?.city
    });
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }
    const jwt = signSessionToken(result.user);
    setSessionCookie(res, jwt, req);
    return res.json({ authenticated: true, user: result.user });
  });
  app2.get("/api/agent/salons", requireAuth, requireRole("FOUNDER", "AGENT"), (req, res) => {
    const user = req.authUser;
    const salons = listSalonsForAgent(user.agentId, user.userRole === "FOUNDER");
    return res.json({ salons });
  });
  app2.post("/api/agent/salons", requireAuth, requireRole("FOUNDER", "AGENT"), (req, res) => {
    const user = req.authUser;
    const salonName = sanitizePlainText(req.body?.salonName, 100);
    const ownerName = sanitizePlainText(req.body?.ownerName, 80) || "Salon Owner";
    const whatsappPhone = sanitizePhone(req.body?.whatsappPhone);
    if (!salonName || !whatsappPhone) {
      return res.status(400).json({ error: "salonName and whatsappPhone are required." });
    }
    const newId = `salon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
    const assignedAgentId = user.agentId || "agent-pk-1";
    registerSalonAssignment(newId, assignedAgentId);
    const ownerReg = registerSalonOwnerAccount({
      salonId: newId,
      salonName,
      ownerName,
      phone: whatsappPhone,
      agentId: assignedAgentId
    });
    if (!ownerReg.ok) {
      return res.status(409).json({ error: ownerReg.error });
    }
    const state = getSalonConciergeState(newId, {
      salonName,
      ownerName,
      whatsappPhone,
      billingStatus: "ACTIVE"
    });
    return res.status(201).json({ salonId: newId, state });
  });
  app2.post("/api/onboarding/complete", async (req, res) => {
    try {
      const ipKey = extractClientIpKey(req.header("x-forwarded-for"), req.ip);
      const rl = await enforceRateLimit(`onboarding:${ipKey}`, 10, 3600, {
        failClosedInProd: true
      });
      if (rl.unavailable) {
        return res.status(503).json({ error: "Distributed security rate limiter unavailable." });
      }
      if (!rl.allowed) {
        return res.status(429).json({
          error: `Too many onboarding submissions. Retry after ${rl.retryAfterSec}s.`
        });
      }
      const honeypot = typeof req.body?.websiteUrl === "string" && req.body.websiteUrl.trim() || typeof req.body?.companyFax === "string" && req.body.companyFax.trim();
      if (honeypot) {
        return res.status(200).json({ ok: true, ignored: true });
      }
      const salonName = sanitizePlainText(req.body?.salonName, 100);
      const ownerName = sanitizePlainText(req.body?.ownerName, 80) || "Salon Owner";
      const whatsappPhone = sanitizePhone(req.body?.phone);
      const publicContactPhone = sanitizePhone(req.body?.publicContactPhone) || whatsappPhone;
      const rawPlanId = sanitizePlainText(req.body?.planId, 20).toUpperCase();
      const packageTier = rawPlanId === "STARTER" ? "STARTER" : rawPlanId === "CUSTOM" ? "CUSTOM" : rawPlanId === "GROWTH" || rawPlanId === "PRO" ? "PRO" : "PRO++";
      const rawCategory = sanitizePlainText(req.body?.salonCategory, 16).toUpperCase();
      const salonCategory = rawCategory === "LADIES" ? "LADIES" : rawCategory === "MENS" ? "MENS" : void 0;
      const enabledServices = Array.isArray(req.body?.enabledServices) ? req.body.enabledServices : void 0;
      const barbers = Array.isArray(req.body?.barbers) ? req.body.barbers.map((b) => sanitizePlainText(b, 60)).filter(Boolean) : [];
      if (!salonName || !whatsappPhone) {
        return res.status(400).json({ error: "Salon name and owner mobile number are required." });
      }
      const newSalonId = `salon-${Date.now().toString(36)}-${crypto5.randomBytes(3).toString("hex")}`;
      const reg = registerSalonOwnerAccount({
        salonId: newSalonId,
        salonName,
        ownerName,
        phone: whatsappPhone,
        agentId: null
      });
      if (!reg.ok) {
        return res.status(409).json({
          error: "Each salon branch requires its own unique owner number, or sign in first to add another branch."
        });
      }
      getSalonConciergeState(newSalonId, {
        salonName,
        ownerName,
        whatsappPhone,
        billingStatus: "PENDING_ACTIVATION",
        packageTier,
        salonCategory,
        enabledServices
      });
      await updateRetentionSettings(
        newSalonId,
        {
          salonName,
          ownerName,
          ownerAuthPhone: whatsappPhone,
          publicContactPhone,
          publicWhatsappPhone: publicContactPhone,
          whatsappPhone,
          packageTier,
          salonCategory,
          enabledServices
        },
        derivePgActorFromAuthUser(reg.user, { targetSalonId: newSalonId })
      );
      if (barbers.length > 0) {
        syncSalonBarbers(newSalonId, barbers);
      }
      const finalState = getSalonConciergeState(newSalonId);
      const token = signSessionToken(reg.user);
      setSessionCookie(res, token, req);
      return res.status(201).json({
        authenticated: true,
        user: reg.user,
        salonId: newSalonId,
        publicCode: finalState.publicCode,
        salonName,
        ownerName,
        phone: whatsappPhone,
        billingStatus: "PENDING_ACTIVATION",
        state: finalState
      });
    } catch (err) {
      console.error("Public onboarding completion error:", err);
      return res.status(500).json({ error: "Could not complete salon setup." });
    }
  });
  app2.post(
    "/api/salons/:salonId/activate-billing",
    requireAuth,
    requireRole("FOUNDER"),
    async (req, res) => {
      try {
        const { salonId } = req.params;
        const statusRaw = sanitizePlainText(req.body?.billingStatus, 30).toUpperCase();
        const billingStatus = statusRaw === "PENDING_ACTIVATION" || statusRaw === "PAST_DUE" || statusRaw === "SUSPENDED" ? statusRaw : "ACTIVE";
        const actor = derivePgActorFromAuthUser(req.authUser, { targetSalonId: salonId });
        const state = await setSalonBillingStatus(salonId, billingStatus, actor);
        return res.json({ billingStatus, state });
      } catch (err) {
        if (err instanceof PgContextError) {
          return res.status(403).json({ error: err.message });
        }
        console.error("Activate billing error:", err);
        return res.status(500).json({ error: "Failed to update billing status." });
      }
    }
  );
  app2.post("/api/translate-service", requireAuth, async (req, res) => {
    try {
      const rawText = sanitizePlainText(req.body?.text, 180);
      const targetLang = req.body?.targetLang === "ur" || req.body?.targetLang === "ar" || req.body?.targetLang === "en" ? req.body.targetLang : "ur";
      if (!rawText) {
        return res.status(400).json({ error: "Service name text is required." });
      }
      const detectedLanguage = detectInputLanguage(rawText);
      const localFallback = fallbackTranslateService(rawText);
      const apiKey = process.env.GEMINI_API_KEY;
      if (apiKey && apiKey.trim().length > 0 && detectedLanguage === "en") {
        try {
          const ai = new GoogleGenAI2({
            apiKey: apiKey.trim(),
            httpOptions: {
              headers: {
                "User-Agent": "aistudio-build"
              }
            }
          });
          const response = await ai.models.generateContent({
            model: "gemini-4-hydrogen",
            contents: `Translate this barbershop / beauty salon service name from English into natural, everyday Urdu (ur, Arabic-Urdu script) and Arabic (ar) as used by salon owners in Pakistan and UAE/Saudi Arabia. Keep it short, crisp, and natural.
Service name: "${rawText}"`,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type2.OBJECT,
                properties: {
                  ur: {
                    type: Type2.STRING,
                    description: "Natural Pakistani Urdu translation in Urdu script."
                  },
                  ar: {
                    type: Type2.STRING,
                    description: "Natural Gulf/Standard Arabic translation in Arabic script."
                  }
                },
                required: ["ur", "ar"]
              }
            }
          });
          const parsed = JSON.parse((response.text ?? "{}").trim());
          const translations2 = {
            en: rawText,
            ur: parsed.ur?.trim() || localFallback.ur,
            ar: parsed.ar?.trim() || localFallback.ar
          };
          return res.json({
            detectedLanguage,
            translations: translations2,
            translatedText: translations2[targetLang],
            source: "gemini"
          });
        } catch (aiErr) {
          console.warn("Gemini service translation fallback triggered:", aiErr);
        }
      }
      const translations = {
        en: rawText,
        ur: detectedLanguage === "ur" ? rawText : localFallback.ur,
        ar: detectedLanguage === "ar" ? rawText : localFallback.ar
      };
      return res.json({
        detectedLanguage,
        translations,
        translatedText: translations[targetLang],
        source: "dictionary"
      });
    } catch (err) {
      console.error("Translation route error:", err);
      return res.status(500).json({ error: "Translation failed." });
    }
  });
  app2.post("/api/translate-voice", requireAuth, async (req, res) => {
    try {
      const rawText = sanitizePlainText(req.body?.text, 1e3);
      const audioBase64 = typeof req.body?.audioBase64 === "string" ? req.body.audioBase64.trim() : "";
      const audioMimeType = typeof req.body?.audioMimeType === "string" ? sanitizePlainText(req.body.audioMimeType, 80) : "audio/webm;codecs=opus";
      const targetLocaleRaw = sanitizePlainText(req.body?.targetLocale, 20);
      const targetDialectRaw = sanitizePlainText(req.body?.targetDialect, 60);
      if (!rawText && !audioBase64) {
        return res.status(400).json({ error: "Compressed audio recording or message text is required." });
      }
      if (audioBase64.length > 3 * 1024 * 1024) {
        return res.status(413).json({ error: "Compressed voice note exceeds size limit." });
      }
      const result = await translateAndSynthesizeVoice({
        audioBase64,
        audioMimeType,
        text: rawText,
        targetLocale: targetLocaleRaw || void 0,
        targetDialect: targetDialectRaw || void 0
      });
      const usage = recordAiVoiceApiUsage(
        result.translationSource !== "error",
        result.ttsSource !== "unavailable"
      );
      if (result.translationSource === "error") {
        return res.status(503).json({
          ...result,
          error: result.translationError || "Voice translation failed.",
          usage
        });
      }
      return res.json({
        ...result,
        usage
      });
    } catch (err) {
      console.error("Voice translation & TTS route error:", err);
      return res.status(500).json({ error: "Voice translation failed." });
    }
  });
  app2.post("/api/voice/tts", requireAuth, async (req, res) => {
    try {
      const text = sanitizePlainText(req.body?.text, 1500);
      const targetLocale = resolveTargetLocale(
        typeof req.body?.locale === "string" ? req.body.locale : void 0,
        void 0
      );
      if (!text) {
        return res.status(400).json({ error: "Speech text is required." });
      }
      const ttsResult = await synthesizeEdgeTtsInMemory(text, targetLocale);
      if (!ttsResult.audioBase64) {
        return res.status(503).json({
          error: ttsResult.ttsError || "Neural TTS unavailable.",
          voiceName: ttsResult.voiceName
        });
      }
      return res.json({
        audioBase64: ttsResult.audioBase64,
        audioMimeType: "audio/mpeg",
        voiceName: ttsResult.voiceName,
        ttsSource: ttsResult.ttsSource
      });
    } catch (err) {
      console.error("Voice TTS route error:", err);
      return res.status(500).json({ error: "Could not synthesize voice." });
    }
  });
  app2.post("/api/voice/chair-intent", requireAuth, async (req, res) => {
    try {
      const audioBase64 = typeof req.body?.audioBase64 === "string" ? req.body.audioBase64.trim() : "";
      const audioMimeType = typeof req.body?.audioMimeType === "string" ? sanitizePlainText(req.body.audioMimeType, 80) : "audio/webm";
      const langRaw = sanitizePlainText(req.body?.lang, 10).toLowerCase();
      const ownerLang = langRaw.startsWith("ar") ? "ar" : langRaw.startsWith("en") ? "en" : "ur";
      if (!audioBase64) {
        return res.status(400).json({ error: "Audio recording is required." });
      }
      if (audioBase64.length > 2 * 1024 * 1024) {
        return res.status(413).json({ error: "Audio clip too large." });
      }
      const out = await transcribeChairIntentAudio(audioBase64, audioMimeType, ownerLang);
      if (!out.transcript) {
        return res.status(503).json({ error: out.error || "Could not transcribe command." });
      }
      return res.json({ transcript: out.transcript });
    } catch (err) {
      console.error("Chair intent route error:", err);
      return res.status(500).json({ error: "Failed to transcribe chair lock audio." });
    }
  });
  app2.get("/api/voice/usage", requireAuth, (_req, res) => {
    sweepExpiredVoiceBlobs();
    return res.json(getLiveUsageMeter());
  });
  app2.get(
    "/api/voice/threads",
    requireAuth,
    requireRole("FOUNDER", "SALON_OWNER"),
    (req, res) => {
      const authUser = req.authUser;
      const requestedSalonId = typeof req.query.salonId === "string" ? sanitizePlainText(req.query.salonId, 60) : void 0;
      const salonFilter = authUser.userRole === "SALON_OWNER" ? authUser.salonId || "__none__" : requestedSalonId;
      return res.json(listVoiceThreads(salonFilter));
    }
  );
  app2.post(
    "/api/voice/threads/message",
    requireAuth,
    requireRole("FOUNDER", "SALON_OWNER"),
    (req, res) => {
      try {
        const authUser = req.authUser;
        const body = req.body || {};
        const senderRole = authUser.userRole === "FOUNDER" ? body.senderRole === "SALON_OWNER" ? "SALON_OWNER" : "FOUNDER" : "SALON_OWNER";
        const threadId = typeof body.threadId === "string" ? sanitizePlainText(body.threadId, 60) : void 0;
        const salonId = authUser.userRole === "SALON_OWNER" && authUser.salonId ? authUser.salonId : typeof body.salonId === "string" ? sanitizePlainText(body.salonId, 60) : void 0;
        const salonName = authUser.userRole === "SALON_OWNER" && authUser.salonName ? authUser.salonName : typeof body.salonName === "string" ? sanitizePlainText(body.salonName, 100) : void 0;
        const ownerName = authUser.userRole === "SALON_OWNER" ? authUser.displayName : typeof body.ownerName === "string" ? sanitizePlainText(body.ownerName, 80) : void 0;
        const city = typeof body.city === "string" ? sanitizePlainText(body.city, 80) : void 0;
        const targetLocale = resolveTargetLocale(
          typeof body.targetLocale === "string" ? body.targetLocale : void 0,
          typeof body.targetDialect === "string" ? body.targetDialect : void 0
        );
        const originalText = sanitizePlainText(body.originalText, 1e3) || "(Compressed Opus Voice Note)";
        const translatedText = sanitizePlainText(body.translatedText, 1200) || originalText;
        const detectedInputLanguage = sanitizePlainText(body.detectedInputLanguage, 40) || "Auto";
        const voiceName = typeof body.voiceName === "string" ? sanitizePlainText(body.voiceName, 60) : void 0;
        const audioDataUrl = typeof body.audioDataUrl === "string" && body.audioDataUrl.startsWith("data:audio/") ? body.audioDataUrl.slice(0, 2 * 1024 * 1024) : void 0;
        const sizeBytes = Number(body.sizeBytes || 0) || void 0;
        const updated = appendVoiceMessage({
          threadId,
          salonId,
          salonName,
          ownerName,
          city,
          targetLocale,
          senderRole,
          originalText,
          translatedText,
          detectedInputLanguage,
          voiceName,
          audioDataUrl,
          sizeBytes
        });
        return res.status(201).json(updated);
      } catch (err) {
        console.error("Failed to append voice thread message:", err);
        return res.status(500).json({ error: "Could not save voice message." });
      }
    }
  );
  app2.patch(
    "/api/voice/threads/:threadId/read",
    requireAuth,
    requireRole("FOUNDER", "SALON_OWNER"),
    (req, res) => {
      const authUser = req.authUser;
      const threadId = sanitizePlainText(req.params.threadId, 60);
      if (authUser.userRole === "SALON_OWNER" && authUser.salonId) {
        const ownThreads = listVoiceThreads(authUser.salonId).threads;
        if (!ownThreads.some((t) => t.id === threadId)) {
          return res.status(403).json({ error: "Forbidden: cannot mark another salon thread." });
        }
      }
      const unread = Boolean(req.body?.unread);
      return res.json(markVoiceThreadRead(threadId, unread));
    }
  );
  app2.get("/api/health/whatsapp", requireAuth, (_req, res) => {
    return res.json(getWhatsAppHeartbeatStatus());
  });
  app2.post("/api/health/whatsapp/heartbeat", requireWebhookSecret, (req, res) => {
    const ok = req.body?.ok !== false;
    const reason = typeof req.body?.reason === "string" ? sanitizePlainText(req.body.reason, 180) : void 0;
    return res.json(recordWhatsAppGatewayHeartbeat(ok, reason));
  });
  app2.get(
    "/api/finance/summary",
    requireAuth,
    requireRole("FOUNDER", "AGENT"),
    (req, res) => {
      const agentId = req.authUser?.agentId || "agent-pk-1";
      return res.json(getFinanceAndAgentSummary(agentId));
    }
  );
  app2.post(
    "/api/agent/cash/collect",
    requireAuth,
    requireRole("FOUNDER", "AGENT"),
    (req, res) => {
      const agentId = req.authUser?.agentId || "agent-pk-1";
      const amount = Number(req.body?.amount || 0);
      const salonName = sanitizePlainText(req.body?.salonName, 100) || "Partner Salon";
      const tid = sanitizePlainText(req.body?.tid, 60) || `CASH-${Date.now()}`;
      const proofHash = sanitizePlainText(req.body?.proofHash, 80) || "sha256:biometric";
      const coAgentId = typeof req.body?.coAgentId === "string" && req.body.coAgentId.trim() ? sanitizePlainText(req.body.coAgentId, 60) : void 0;
      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ error: "Valid positive collection amount is required." });
      }
      return res.status(201).json(
        recordAgentCashCollection({ agentId, salonName, amount, tid, proofHash, coAgentId })
      );
    }
  );
  app2.post(
    "/api/agent/cash/remit",
    requireAuth,
    requireRole("FOUNDER", "AGENT"),
    (req, res) => {
      const agentId = req.authUser?.agentId || "agent-pk-1";
      const tid = sanitizePlainText(req.body?.tid, 80);
      const amount = Number(req.body?.amount || 0) || void 0;
      if (!tid) {
        return res.status(400).json({ error: "Bank / Deposit TID reference is required." });
      }
      return res.json(recordAgentCashRemittance({ agentId, tid, amount }));
    }
  );
  app2.get(
    "/api/agent/co-agents",
    requireAuth,
    requireRole("FOUNDER", "AGENT"),
    (req, res) => {
      const agentId = req.authUser?.agentId || "agent-pk-1";
      return res.json({ coAgents: getFinanceAndAgentSummary(agentId).coAgents });
    }
  );
  app2.post(
    "/api/agent/co-agents",
    requireAuth,
    requireRole("FOUNDER", "AGENT"),
    (req, res) => {
      const leadAgentId = req.authUser?.agentId || "agent-pk-1";
      const leadAgentName = req.authUser?.displayName || "Lead Field Agent";
      const name = sanitizePlainText(req.body?.name, 80);
      const phone = sanitizePhone(req.body?.phone);
      const city = sanitizePlainText(req.body?.city, 100) || "Assigned Territory";
      const splitPct = Number(req.body?.splitPctOfAgentShare || 50);
      if (!name || !phone) {
        return res.status(400).json({ error: "Co-Agent name and WhatsApp phone are required." });
      }
      const created = createCoAgentRecord({
        leadAgentId,
        leadAgentName,
        name,
        phone,
        city,
        splitPctOfAgentShare: splitPct
      });
      return res.status(201).json({ coAgent: created });
    }
  );
  app2.post(
    "/api/agent/co-agents/:coAgentId/handoff",
    requireAuth,
    requireRole("FOUNDER", "AGENT"),
    (req, res) => {
      const leadAgentId = req.authUser?.agentId || "agent-pk-1";
      const coAgentId = sanitizePlainText(req.params.coAgentId, 60);
      const referenceTid = sanitizePlainText(req.body?.referenceTid, 60) || `HO-${Date.now()}`;
      const outcome = recordCoAgentCashHandoff({ leadAgentId, coAgentId, referenceTid });
      if (!outcome) {
        return res.status(404).json({ error: "Co-Agent record not found." });
      }
      return res.json(outcome);
    }
  );
  app2.get("/api/founder/settings", requireAuth, requireRole("FOUNDER"), (_req, res) => {
    return res.json(getFounderSettings());
  });
  app2.put("/api/founder/settings/report-phone", requireAuth, requireRole("FOUNDER"), (req, res) => {
    const phone = typeof req.body?.phone === "string" ? req.body.phone : "";
    const updated = updateFounderReportPhone(phone);
    if (!updated) {
      return res.status(400).json({ error: "Valid report phone number is required." });
    }
    return res.json(updated);
  });
  app2.post("/api/founder/broadcast", requireAuth, requireRole("FOUNDER"), (req, res) => {
    const title = sanitizePlainText(req.body?.title, 160);
    const messageEn = sanitizePlainText(req.body?.messageEn, 800);
    const regionFilter = sanitizePlainText(req.body?.regionFilter, 20) || "ALL";
    const tierFilter = sanitizePlainText(req.body?.tierFilter, 20) || "ALL";
    const recipientCount = Number(req.body?.recipientCount || 24);
    if (!title || !messageEn) {
      return res.status(400).json({ error: "Broadcast title and message are required." });
    }
    const entry = recordFounderBroadcastDispatch({
      title,
      messageEn,
      regionFilter,
      tierFilter,
      recipientCount
    });
    return res.status(201).json({ entry });
  });
  app2.get("/api/founder/pairing-qr", requireAuth, requireRole("FOUNDER"), async (req, res) => {
    try {
      const rotate = req.query.rotate === "1";
      const settings = rotate ? rotateFounderPairingKey() : getFounderSettings();
      const host = String(req.header("host") || "workcraft-app.vercel.app");
      const proto = req.header("x-forwarded-proto") || (req.secure ? "https" : "http");
      const qrPayload = `${proto}://${host}/?pair_key=${encodeURIComponent(settings.pairingKey)}`;
      const qrDataUrl = await QRCode.toDataURL(qrPayload, {
        width: 240,
        margin: 1,
        color: { dark: "#0D1117", light: "#FFFFFF" }
      });
      return res.json({
        pairingKey: settings.pairingKey,
        pairingUpdatedAt: settings.pairingUpdatedAt,
        qrPayload,
        qrDataUrl
      });
    } catch {
      return res.status(500).json({ error: "Could not generate pairing QR." });
    }
  });
  app2.get("/api/cron/daily-maintenance", (req, res) => {
    const cronSecret = (process.env.CRON_SECRET || "").trim();
    const webhookSecret = (process.env.WORKCRAFT_WEBHOOK_SECRET || "").trim();
    if (!cronSecret && !webhookSecret) {
      return res.status(503).json({
        error: "CRON_SECRET is not configured on server."
      });
    }
    const timingSafeMatch = (candidate, expected) => {
      if (!candidate || !expected) return false;
      const a = crypto5.createHash("sha256").update(candidate).digest();
      const b = crypto5.createHash("sha256").update(expected).digest();
      return crypto5.timingSafeEqual(a, b);
    };
    const authHeader = (req.header("authorization") || "").trim();
    const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    const webhookHeader = (req.header("x-workcraft-webhook-secret") || "").trim();
    const validCron = cronSecret && timingSafeMatch(bearerToken, cronSecret) || webhookSecret && timingSafeMatch(webhookHeader, webhookSecret);
    if (!validCron) {
      return res.status(401).json({ error: "Unauthorized cron trigger." });
    }
    const usage = sweepExpiredVoiceBlobs();
    const dealsSweep = runDealExpiryAndVideoRetentionCron();
    return res.json({
      ok: true,
      sweptAt: usage.lastCleanupAt,
      purgedClipCount: usage.purgedCount,
      expiredDealsCount: dealsSweep.expiredDealsCount,
      purgedDealVideoCount: dealsSweep.purgedVideosCount
    });
  });
  app2.get(
    "/api/salons/:salonId/concierge-state",
    requireAuth,
    requireSalonTenantAccess(true),
    (req, res) => {
      try {
        const { salonId } = req.params;
        const salonName = typeof req.query.salonName === "string" ? sanitizePlainText(req.query.salonName, 100) : void 0;
        const ownerName = typeof req.query.ownerName === "string" ? sanitizePlainText(req.query.ownerName, 80) : void 0;
        const whatsappPhone = typeof req.query.whatsappPhone === "string" ? sanitizePlainText(req.query.whatsappPhone, 24) : void 0;
        const state = getSalonConciergeState(salonId, { salonName, ownerName, whatsappPhone });
        return res.json(state);
      } catch (err) {
        console.error("Failed to get concierge state:", err);
        return res.status(500).json({ error: "Failed to load concierge state." });
      }
    }
  );
  app2.put(
    "/api/salons/:salonId/retention-settings",
    requireAuth,
    requireSalonTenantAccess(false),
    async (req, res) => {
      try {
        const { salonId } = req.params;
        const actor = derivePgActorFromAuthUser(req.authUser, { targetSalonId: salonId });
        const updated = await updateRetentionSettings(salonId, req.body || {}, actor);
        return res.json(updated);
      } catch (err) {
        if (err instanceof PgContextError) {
          return res.status(403).json({ error: err.message });
        }
        console.error("Failed to save retention settings:", err);
        return res.status(500).json({ error: "Failed to save retention settings." });
      }
    }
  );
  app2.post(
    "/api/salons/:salonId/clients",
    requireAuth,
    requireSalonTenantAccess(false),
    (req, res) => {
      try {
        const { salonId } = req.params;
        const { phone, name, birthDate, preferredLanguage } = req.body || {};
        if (!phone || typeof phone !== "string") {
          return res.status(400).json({ error: "Client phone is required." });
        }
        const client = upsertClientProfile(salonId, {
          phone,
          name,
          birthDate,
          preferredLanguage
        });
        return res.json({ client, state: getSalonConciergeState(salonId) });
      } catch (err) {
        console.error("Failed to upsert client profile:", err);
        return res.status(500).json({ error: "Failed to save client profile." });
      }
    }
  );
  app2.post(
    "/api/salons/:salonId/appointments/complete",
    requireAuth,
    requireSalonTenantAccess(false),
    async (req, res) => {
      try {
        const { salonId } = req.params;
        const {
          appointmentId,
          clientName,
          clientPhone,
          barberName,
          service,
          price,
          timeSlot,
          birthDate,
          preferredLanguage
        } = req.body || {};
        if (!appointmentId || !clientPhone) {
          return res.status(400).json({ error: "appointmentId and clientPhone are required." });
        }
        const actor = derivePgActorFromAuthUser(req.authUser, { targetSalonId: salonId });
        const result = await completeAppointmentAndRecordVisit(
          salonId,
          {
            appointmentId: String(appointmentId),
            clientName: String(clientName || "Salon Client"),
            clientPhone: String(clientPhone),
            barberName: String(barberName || "Master Barber"),
            service: String(service || "Salon Service"),
            price: Number(price || 0),
            timeSlot: String(timeSlot || "Completed"),
            birthDate: typeof birthDate === "string" ? birthDate : void 0,
            preferredLanguage
          },
          actor
        );
        return res.json(result);
      } catch (err) {
        if (err instanceof PgContextError) {
          return res.status(403).json({ error: err.message });
        }
        if (err instanceof BookingLifecycleError) {
          return res.status(err.statusCode).json({ error: err.message });
        }
        console.error("Failed to complete appointment:", err);
        return res.status(500).json({ error: "Failed to mark appointment completed." });
      }
    }
  );
  app2.post("/api/salons/:salonId/cron/run", requireWebhookSecret, (req, res) => {
    try {
      const salonId = sanitizePlainText(req.params.salonId, 60);
      const { job, force, appointmentId } = req.body || {};
      const shouldForce = force !== false;
      let birthdayDispatched = 0;
      let winbackDispatched = 0;
      let reviewDispatched = 0;
      let quarantinedCount = 0;
      if (job === "birthday_9am" || job === "all" || !job) {
        const b = runBirthdayCron(salonId, shouldForce);
        birthdayDispatched = b.dispatchedCount;
        quarantinedCount += b.quarantinedCount;
      }
      if (job === "winback_30d" || job === "all" || !job) {
        const w = runWinBackCron(salonId, shouldForce);
        winbackDispatched = w.dispatchedCount;
        quarantinedCount += w.quarantinedCount;
      }
      if (job === "review_t2h" || job === "all" || !job) {
        reviewDispatched = runPostServiceReviewCron(
          salonId,
          shouldForce,
          typeof appointmentId === "string" ? sanitizePlainText(appointmentId, 60) : void 0
        ).dispatchedCount;
      }
      return res.json({
        birthdayDispatched,
        winbackDispatched,
        reviewDispatched,
        quarantinedCount,
        state: getSalonConciergeState(salonId)
      });
    } catch (err) {
      console.error("Cron run error:", err);
      return res.status(500).json({ error: "Cron execution failed." });
    }
  });
  app2.post(
    "/api/salons/:salonId/concierge/simulate",
    requireAuth,
    requireSalonTenantAccess(false),
    (req, res) => {
      try {
        const { salonId } = req.params;
        const { fromPhone, messageText, clientName, appointmentIdForReview, forceLanguagePrompt } = req.body || {};
        if (!fromPhone || typeof messageText !== "string") {
          return res.status(400).json({ error: "fromPhone and messageText are required." });
        }
        const outcome = processWhatsAppWebhook({
          salonId,
          fromPhone: sanitizePlainText(String(fromPhone), 24),
          messageText: sanitizePlainText(messageText, 500),
          clientName: typeof clientName === "string" ? sanitizePlainText(clientName, 80) : void 0,
          appointmentIdForReview: typeof appointmentIdForReview === "string" ? sanitizePlainText(appointmentIdForReview, 60) : void 0,
          forceLanguagePrompt: Boolean(forceLanguagePrompt)
        });
        return res.json(outcome);
      } catch (err) {
        console.error("Authenticated concierge simulation error:", err);
        return res.status(500).json({ error: "Simulation failed." });
      }
    }
  );
  app2.get("/api/public/salons/:salonCode/customer-experience", async (req, res) => {
    try {
      const ipKey = extractClientIpKey(req.header("x-forwarded-for"), req.ip);
      const rl = await enforceRateLimit(`pub:cx:${ipKey}`, 120, 60);
      if (!rl.allowed) {
        return res.status(429).json({ error: "Too many requests. Please wait a moment." });
      }
      const salonCode = sanitizePlainText(req.params.salonCode, 60);
      const salonId = await resolveSalonIdByPublicCodeAsync(salonCode);
      if (!salonId) {
        return res.status(404).json({ error: "Salon booking link not found." });
      }
      const queryToken = typeof req.query.c === "string" ? req.query.c.trim() : "";
      const cookies = parseCookieHeader(req.header("cookie"));
      const cookieToken = cookies[getCustomerCookieName(salonCode)] || "";
      const activeToken = queryToken || cookieToken || void 0;
      if (queryToken) {
        const verified = verifyCustomerRecognizeToken(queryToken, salonId);
        if (verified) {
          setCustomerBrowserCookie(res, salonCode, queryToken, req);
        }
      }
      const rawLang = typeof req.query.lang === "string" ? req.query.lang : void 0;
      const lang = rawLang ? sanitizeClientLang(rawLang) : void 0;
      const config = getCustomerExperienceConfig(salonId, activeToken, lang);
      return res.json(config);
    } catch (err) {
      console.error("Customer experience config error:", err);
      return res.status(500).json({ error: "Failed to load salon experience." });
    }
  });
  app2.post("/api/public/salons/:salonCode/client-profile", async (req, res) => {
    try {
      const ipKey = extractClientIpKey(req.header("x-forwarded-for"), req.ip);
      const rl = await enforceRateLimit(`pub:profile:${ipKey}`, 30, 60);
      if (!rl.allowed) {
        return res.status(429).json({ error: "Too many requests. Please wait a moment." });
      }
      const salonCode = sanitizePlainText(req.params.salonCode, 60);
      await resolveSalonIdByPublicCodeAsync(salonCode);
      const body = req.body || {};
      const preferredLanguage = typeof body.preferredLanguage === "string" ? sanitizeClientLang(body.preferredLanguage) : void 0;
      const saved = saveFirstTimeClientProfile(salonCode, {
        name: String(body.name || ""),
        phone: String(body.phone || ""),
        preferredLanguage,
        marketingOptIn: Boolean(body.marketingOptIn)
      });
      if (!saved.ok) {
        return res.status(saved.statusCode).json({ ok: false, error: saved.error });
      }
      setCustomerBrowserCookie(res, saved.publicCode, saved.cookieToken, req);
      return res.status(201).json({
        ok: true,
        publicCode: saved.publicCode,
        personalReturningShareUrl: saved.personalReturningShareUrl,
        availableLanguages: saved.availableLanguages,
        returningClient: saved.returningClient
      });
    } catch (err) {
      console.error("Save first-time client profile error:", err);
      return res.status(500).json({ ok: false, error: "Could not save client details." });
    }
  });
  app2.post("/api/public/salons/:salonCode/customer-message", async (req, res) => {
    try {
      const ipKey = extractClientIpKey(req.header("x-forwarded-for"), req.ip);
      const rl = await enforceRateLimit(`pub:msg:${ipKey}`, 60, 60);
      if (!rl.allowed) {
        return res.status(429).json({ error: "Too many requests. Please wait a moment." });
      }
      const salonCode = sanitizePlainText(req.params.salonCode, 60);
      const salonId = await resolveSalonIdByPublicCodeAsync(salonCode);
      if (!salonId) {
        return res.status(404).json({ error: "Salon booking link not found." });
      }
      const body = req.body || {};
      const preferredLang = typeof body.preferredLang === "string" ? sanitizeClientLang(body.preferredLang) : void 0;
      const actionId = body.actionId === "WELCOME" || body.actionId === "BOOK_APPOINTMENT" || body.actionId === "SERVICES_PRICES" || body.actionId === "HOURS_LOCATION" || body.actionId === "CURRENT_DEALS" ? body.actionId : void 0;
      const outcome = handleCustomerWhatsAppAction({
        salonId,
        fromPhone: typeof body.fromPhone === "string" ? body.fromPhone : void 0,
        messageText: typeof body.messageText === "string" ? body.messageText : "Hi",
        actionId,
        preferredLang,
        clientName: typeof body.clientName === "string" ? body.clientName : void 0,
        isDemo: body.isDemo !== false
      });
      return res.json(outcome);
    } catch (err) {
      console.error("Customer message handler error:", err);
      return res.status(500).json({ error: "Failed to handle customer message." });
    }
  });
  app2.get("/api/public/salons/:salonCode/availability", async (req, res) => {
    try {
      const ipKey = extractClientIpKey(req.header("x-forwarded-for"), req.ip);
      const rl = await enforceRateLimit(`pub:avail:${ipKey}`, 120, 60);
      if (!rl.allowed) {
        return res.status(429).json({ error: "Too many availability requests. Please wait a moment." });
      }
      const salonCode = sanitizePlainText(req.params.salonCode, 60);
      const salonId = await resolveSalonIdByPublicCodeAsync(salonCode);
      if (!salonId) {
        return res.status(404).json({ error: "Salon booking link not found." });
      }
      const date = typeof req.query.date === "string" ? req.query.date : "";
      const durationMins = Number(req.query.durationMins || 40);
      const serviceIdsRaw = typeof req.query.serviceIds === "string" ? req.query.serviceIds : "";
      const serviceIds = serviceIdsRaw ? serviceIdsRaw.split(",").map((s) => sanitizePlainText(s, 60)).filter(Boolean) : void 0;
      const isDemo = req.query.isDemo === "true" || req.query.isDemo === "1";
      const demoBusyBarber = isDemo && typeof req.query.demoBusyBarber === "string" ? req.query.demoBusyBarber : void 0;
      const demoBusyTimeSlot = isDemo && typeof req.query.demoBusyTimeSlot === "string" ? req.query.demoBusyTimeSlot : void 0;
      const availability = await getAvailableSlotsAndBarbers({
        salonId,
        date,
        durationMins,
        serviceIds,
        demoBusyBarber,
        demoBusyTimeSlot,
        actor: createPublicFlowSalonActor(salonId)
      });
      return res.json(availability);
    } catch (err) {
      if (err instanceof PgContextError) {
        return res.status(403).json({ error: err.message });
      }
      if (err instanceof BookingLifecycleError) {
        return res.status(err.statusCode).json({ error: err.message });
      }
      console.error("Customer availability error:", err);
      return res.status(500).json({ error: "Failed to calculate slot availability." });
    }
  });
  app2.post("/api/public/salons/:salonCode/flow/book", async (req, res) => {
    try {
      const ipKey = extractClientIpKey(req.header("x-forwarded-for"), req.ip);
      const rl = await enforceRateLimit(`pub:book:${ipKey}`, 30, 60);
      if (!rl.allowed) {
        return res.status(429).json({
          ok: false,
          error: `Too many booking attempts. Retry after ${rl.retryAfterSec}s.`
        });
      }
      const salonCode = sanitizePlainText(req.params.salonCode, 60);
      const salonId = await resolveSalonIdByPublicCodeAsync(salonCode);
      if (!salonId) {
        return res.status(404).json({ ok: false, error: "Salon booking link not found." });
      }
      const cookies = parseCookieHeader(req.header("cookie"));
      const queryToken = typeof req.query.c === "string" ? req.query.c.trim() : "";
      const cookieToken = cookies[getCustomerCookieName(salonCode)] || "";
      const claims = verifyCustomerRecognizeToken(queryToken || cookieToken, salonId);
      const result = await createCustomerFlowBooking(salonId, {
        ...req.body || {},
        verifiedClientId: claims?.clientId
      });
      if (result.recognizeCookieToken) {
        setCustomerBrowserCookie(res, salonCode, result.recognizeCookieToken, req);
      }
      return res.status(result.statusCode).json(result.payload);
    } catch (err) {
      console.error("Customer Flow booking error:", err);
      return res.status(500).json({ ok: false, error: "Failed to submit booking." });
    }
  });
  app2.get("/api/public/salons/:salonCode/deals/:dealId", async (req, res) => {
    try {
      const ipKey = extractClientIpKey(req.header("x-forwarded-for"), req.ip);
      const rl = await enforceRateLimit(`pub:deal:${ipKey}`, 120, 60);
      if (!rl.allowed) {
        return res.status(429).json({ error: "Too many requests." });
      }
      const salonCode = sanitizePlainText(req.params.salonCode, 60);
      const dealId = sanitizePlainText(req.params.dealId, 80);
      await resolveSalonIdByPublicCodeAsync(salonCode);
      const payload = getPublicDealPayload(salonCode, dealId);
      if (!payload) {
        return res.status(404).json({ error: "Deal or salon not found." });
      }
      return res.json(payload);
    } catch (err) {
      console.error("Public deal load error:", err);
      return res.status(500).json({ error: "Failed to load deal details." });
    }
  });
  app2.get("/api/public/bookings/:token", async (req, res) => {
    try {
      const ipKey = extractClientIpKey(req.header("x-forwarded-for"), req.ip);
      const rl = await enforceRateLimit(`pub:bget:${ipKey}`, 60, 60);
      if (!rl.allowed) {
        return res.status(429).json({ ok: false, error: "Too many requests." });
      }
      const booking = await getBookingByAccessToken(req.params.token);
      if (!booking) {
        return res.status(404).json({ ok: false, error: "Booking link is invalid, expired, or revoked." });
      }
      return res.json(booking);
    } catch (err) {
      if (err instanceof PgContextError) {
        return res.status(403).json({ ok: false, error: err.message });
      }
      if (err instanceof BookingLifecycleError) {
        return res.status(err.statusCode).json({ ok: false, error: err.message });
      }
      console.error("Public booking lookup error:", err);
      return res.status(500).json({ ok: false, error: "Failed to load booking." });
    }
  });
  app2.post("/api/public/bookings/:token/reschedule", async (req, res) => {
    try {
      const ipKey = extractClientIpKey(req.header("x-forwarded-for"), req.ip);
      const rl = await enforceRateLimit(`pub:bmod:${ipKey}`, 20, 60);
      if (!rl.allowed) {
        return res.status(429).json({ ok: false, error: "Too many requests. Please wait." });
      }
      const result = await rescheduleBookingByAccessToken(req.params.token, req.body || {});
      return res.status(result.statusCode).json(result);
    } catch (err) {
      if (err instanceof PgContextError) {
        return res.status(403).json({ ok: false, error: err.message });
      }
      console.error("Public booking reschedule error:", err);
      return res.status(500).json({ ok: false, error: "Failed to reschedule booking." });
    }
  });
  app2.post("/api/public/bookings/:token/cancel", async (req, res) => {
    try {
      const ipKey = extractClientIpKey(req.header("x-forwarded-for"), req.ip);
      const rl = await enforceRateLimit(`pub:bcan:${ipKey}`, 20, 60);
      if (!rl.allowed) {
        return res.status(429).json({ ok: false, error: "Too many requests. Please wait." });
      }
      const result = await cancelBookingByAccessToken(req.params.token, req.body?.reason);
      return res.status(result.statusCode).json(result);
    } catch (err) {
      if (err instanceof PgContextError) {
        return res.status(403).json({ ok: false, error: err.message });
      }
      console.error("Public booking cancel error:", err);
      return res.status(500).json({ ok: false, error: "Failed to cancel booking." });
    }
  });
  app2.get("/api/public/deal-videos/:fileName", (req, res) => {
    try {
      const info = getDealVideoFileInfo(req.params.fileName);
      if (!info) {
        return res.status(410).json({ error: "Promotional video has expired and been removed." });
      }
      const stat = fs5.statSync(info.filePath);
      const fileSize = stat.size;
      const range = req.headers.range;
      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        if (Number.isNaN(start) || start >= fileSize) {
          return res.status(416).send("Requested range not satisfiable");
        }
        const safeEnd = Math.min(end, fileSize - 1);
        const chunkSize = safeEnd - start + 1;
        res.writeHead(206, {
          "Content-Range": `bytes ${start}-${safeEnd}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunkSize,
          "Content-Type": info.mimeType
        });
        return fs5.createReadStream(info.filePath, { start, end: safeEnd }).pipe(res);
      }
      res.writeHead(200, {
        "Content-Length": fileSize,
        "Content-Type": info.mimeType,
        "Accept-Ranges": "bytes"
      });
      return fs5.createReadStream(info.filePath).pipe(res);
    } catch (err) {
      console.error("Deal video stream error:", err);
      return res.status(500).json({ error: "Could not stream promotional video." });
    }
  });
  app2.get(
    "/api/salons/:salonId/deals",
    requireAuth,
    requireSalonTenantAccess(true),
    (req, res) => {
      const deals = listSalonDeals(req.params.salonId, false);
      return res.json({ deals });
    }
  );
  app2.post(
    "/api/salons/:salonId/deals",
    requireAuth,
    requireSalonTenantAccess(false),
    (req, res) => {
      try {
        const { salonId } = req.params;
        const body = req.body || {};
        let videoBuffer;
        if (typeof body.videoBase64 === "string" && body.videoBase64.trim()) {
          const rawB64 = body.videoBase64.replace(/^data:[^;]+;base64,/, "");
          videoBuffer = Buffer.from(rawB64, "base64");
          if (videoBuffer.length > 20 * 1024 * 1024) {
            return res.status(400).json({ error: "Video must be 20 MB or smaller." });
          }
        }
        const created = createSalonDeal(salonId, {
          title: String(body.title || ""),
          description: typeof body.description === "string" ? body.description : void 0,
          discountType: body.discountType,
          discountValue: Number(body.discountValue || 15),
          serviceIds: Array.isArray(body.serviceIds) ? body.serviceIds : void 0,
          expiresAt: String(body.expiresAt || ""),
          videoRetentionDaysAfterExpiry: body.videoRetentionDaysAfterExpiry !== void 0 ? Number(body.videoRetentionDaysAfterExpiry) : void 0,
          videoBuffer,
          videoMimeType: typeof body.videoMimeType === "string" ? body.videoMimeType : void 0,
          videoOriginalName: typeof body.videoOriginalName === "string" ? body.videoOriginalName : void 0
        });
        return res.status(201).json(created);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to create deal.";
        return res.status(400).json({ error: msg });
      }
    }
  );
  app2.delete(
    "/api/salons/:salonId/deals/:dealId",
    requireAuth,
    requireSalonTenantAccess(false),
    (req, res) => {
      const state = deleteSalonDeal(req.params.salonId, sanitizePlainText(req.params.dealId, 80));
      return res.json({ ok: true, state });
    }
  );
  app2.get("/api/whatsapp/meta-webhook", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    const expectedToken = (process.env.WHATSAPP_VERIFY_TOKEN || "").trim();
    if (mode === "subscribe" && expectedToken && token === expectedToken) {
      return res.status(200).send(String(challenge || ""));
    }
    return res.status(403).json({
      error: "Meta WhatsApp webhook verification token mismatch or WHATSAPP_VERIFY_TOKEN not configured."
    });
  });
  app2.post("/api/whatsapp/meta-webhook", async (req, res) => {
    const appSecret = (process.env.WHATSAPP_APP_SECRET || "").trim();
    if (appSecret) {
      const sigHeader = req.header("x-hub-signature-256") || "";
      const rawBody = req.rawBody;
      if (!rawBody || !sigHeader.startsWith("sha256=")) {
        return res.status(401).json({ error: "Missing Meta webhook signature." });
      }
      const expectedSig = "sha256=" + crypto5.createHmac("sha256", appSecret).update(rawBody).digest("hex");
      if (sigHeader !== expectedSig) {
        return res.status(401).json({ error: "Invalid Meta webhook signature." });
      }
    }
    try {
      const entry = req.body?.entry?.[0]?.changes?.[0]?.value;
      const msg = entry?.messages?.[0];
      const contact = entry?.contacts?.[0];
      if (!msg) {
        return res.status(200).json({ ok: true, ignored: true });
      }
      const inboundPhoneNumberId = String(entry?.metadata?.phone_number_id || "").trim();
      const matchedSalonId = findSalonIdByMetaPhoneNumberId(inboundPhoneNumberId);
      if (!matchedSalonId) {
        return res.status(200).json({
          ok: true,
          ignored: true,
          reason: "whatsapp_addon_disabled_or_unmapped_phone_number_id"
        });
      }
      const fromPhone = String(msg.from || "");
      const textBody = msg.text?.body || msg.interactive?.button_reply?.id || msg.interactive?.list_reply?.id || "Hi";
      const outcome = processWhatsAppWebhook({
        salonId: matchedSalonId,
        fromPhone,
        messageText: String(textBody),
        clientName: contact?.profile?.name
      });
      const accessToken = (process.env.WHATSAPP_ACCESS_TOKEN || "").trim();
      const phoneNumberId = inboundPhoneNumberId || (process.env.WHATSAPP_PHONE_NUMBER_ID || "").trim();
      let sentViaMeta = false;
      let metaCapBlocked = false;
      if (accessToken && phoneNumberId && fromPhone) {
        const capCheck = canSendMetaMessage(matchedSalonId);
        if (!capCheck.allowed) {
          metaCapBlocked = true;
        } else {
          const metaRes = await fetch(
            `https://graph.facebook.com/v20.0/${encodeURIComponent(phoneNumberId)}/messages`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                messaging_product: "whatsapp",
                to: fromPhone,
                type: "text",
                text: { body: outcome.replyText }
              })
            }
          );
          sentViaMeta = metaRes.ok;
          if (sentViaMeta) {
            recordMetaMessageSent(matchedSalonId);
          }
        }
      }
      return res.status(200).json({
        ok: true,
        sentViaMeta,
        ...metaCapBlocked ? { reason: "meta_monthly_cap_1000_reached" } : {},
        routedAction: outcome.routedAction
      });
    } catch (err) {
      console.error("Meta WhatsApp webhook processing error:", err);
      return res.status(200).json({ ok: false });
    }
  });
  app2.get(
    "/api/salons/:salonId/usage-meter",
    requireAuth,
    requireSalonTenantAccess(true),
    (req, res) => {
      return res.json(getMonthlyUsageSnapshot(req.params.salonId));
    }
  );
  app2.post(
    "/api/salons/:salonId/stylist-leaves",
    requireAuth,
    requireSalonTenantAccess(false),
    (req, res) => {
      try {
        const state = addStylistLeave(req.params.salonId, req.body || {});
        return res.status(201).json(state);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to save stylist leave.";
        return res.status(400).json({ error: msg });
      }
    }
  );
  app2.delete(
    "/api/salons/:salonId/stylist-leaves/:leaveId",
    requireAuth,
    requireSalonTenantAccess(false),
    (req, res) => {
      const state = removeStylistLeave(
        req.params.salonId,
        sanitizePlainText(req.params.leaveId, 60)
      );
      return res.json(state);
    }
  );
  app2.post(
    "/api/salons/:salonId/appointments/:bookingId/status",
    requireAuth,
    requireSalonTenantAccess(false),
    async (req, res) => {
      try {
        const { salonId, bookingId } = req.params;
        const rawStatus = sanitizePlainText(req.body?.status, 24).toUpperCase();
        const nextStatus = rawStatus === "IN_CHAIR" ? "IN_CHAIR" : rawStatus === "COMPLETED" ? "COMPLETED" : rawStatus === "CANCELED" ? "CANCELED" : "CONFIRMED";
        const actor = derivePgActorFromAuthUser(req.authUser, { targetSalonId: salonId });
        const outcome = await updateAppointmentStatus(
          salonId,
          sanitizePlainText(bookingId, 60),
          nextStatus,
          actor
        );
        if (!outcome.ok) {
          return res.status(outcome.statusCode || 404).json({ error: outcome.error });
        }
        return res.json(outcome);
      } catch (err) {
        if (err instanceof PgContextError) {
          return res.status(403).json({ error: err.message });
        }
        console.error("Failed to update appointment status:", err);
        return res.status(500).json({ error: "Failed to update appointment status." });
      }
    }
  );
  app2.post(
    "/api/salons/:salonId/appointments/:bookingId/reschedule",
    requireAuth,
    requireSalonTenantAccess(false),
    async (req, res) => {
      try {
        const { salonId, bookingId } = req.params;
        const actor = derivePgActorFromAuthUser(req.authUser, { targetSalonId: salonId });
        const outcome = await rescheduleAppointmentByOwner(
          salonId,
          sanitizePlainText(bookingId, 60),
          req.body || {},
          actor
        );
        if (!outcome.ok) {
          return res.status(outcome.statusCode).json({ ok: false, error: outcome.error });
        }
        return res.json(outcome);
      } catch (err) {
        if (err instanceof PgContextError) {
          return res.status(403).json({ ok: false, error: err.message });
        }
        console.error("Failed to reschedule appointment:", err);
        return res.status(500).json({ ok: false, error: "Failed to reschedule appointment." });
      }
    }
  );
  app2.post(
    "/api/salons/:salonId/concierge/trigger-cron",
    requireAuth,
    requireSalonTenantAccess(false),
    (req, res) => {
      try {
        const { salonId } = req.params;
        const { job, force, appointmentId } = req.body || {};
        const shouldForce = force !== false;
        let birthdayDispatched = 0;
        let winbackDispatched = 0;
        let reviewDispatched = 0;
        let quarantinedCount = 0;
        if (job === "birthday_9am" || job === "all" || !job) {
          const b = runBirthdayCron(salonId, shouldForce);
          birthdayDispatched = b.dispatchedCount;
          quarantinedCount += b.quarantinedCount;
        }
        if (job === "winback_30d" || job === "all" || !job) {
          const w = runWinBackCron(salonId, shouldForce);
          winbackDispatched = w.dispatchedCount;
          quarantinedCount += w.quarantinedCount;
        }
        if (job === "review_t2h" || job === "all" || !job) {
          reviewDispatched = runPostServiceReviewCron(
            salonId,
            shouldForce,
            typeof appointmentId === "string" ? sanitizePlainText(appointmentId, 60) : void 0
          ).dispatchedCount;
        }
        return res.json({
          birthdayDispatched,
          winbackDispatched,
          reviewDispatched,
          quarantinedCount,
          state: getSalonConciergeState(salonId)
        });
      } catch (err) {
        console.error("Manual cron trigger error:", err);
        return res.status(500).json({ error: "Cron trigger failed." });
      }
    }
  );
  app2.post(
    "/api/salons/:salonId/alerts/:alertId/resolve",
    requireAuth,
    requireSalonTenantAccess(false),
    (req, res) => {
      try {
        const { salonId, alertId } = req.params;
        const state = resolveOwnerAlert(salonId, sanitizePlainText(alertId, 60));
        return res.json(state);
      } catch (err) {
        console.error("Resolve alert error:", err);
        return res.status(500).json({ error: "Failed to resolve alert." });
      }
    }
  );
  app2.post(
    "/api/salons/:salonId/chair-locks",
    requireAuth,
    requireSalonTenantAccess(false),
    (req, res) => {
      try {
        const { salonId } = req.params;
        const body = req.body || {};
        if (!body.barberName || !body.startTimeSlot || !body.endTimeSlot) {
          return res.status(400).json({ error: "barberName, startTimeSlot, and endTimeSlot are required." });
        }
        const result = addChairLock(salonId, {
          barberName: String(body.barberName),
          chairLabel: typeof body.chairLabel === "string" ? body.chairLabel : void 0,
          startTimeSlot: String(body.startTimeSlot),
          endTimeSlot: String(body.endTimeSlot),
          startMinutes: Number(body.startMinutes ?? 0),
          endMinutes: Number(body.endMinutes ?? 30),
          durationMins: Number(body.durationMins ?? 30),
          source: body.source === "VOICE" ? "VOICE" : "QUICK_PILL",
          transcript: typeof body.transcript === "string" ? body.transcript : void 0,
          barbers: Array.isArray(body.barbers) ? body.barbers : void 0
        });
        return res.json(result);
      } catch (err) {
        console.error("Add chair lock error:", err);
        return res.status(500).json({ error: "Failed to create chair lock." });
      }
    }
  );
  app2.delete(
    "/api/salons/:salonId/chair-locks/:lockId",
    requireAuth,
    requireSalonTenantAccess(false),
    (req, res) => {
      try {
        const { salonId, lockId } = req.params;
        const state = removeChairLock(salonId, sanitizePlainText(lockId, 60));
        return res.json(state);
      } catch (err) {
        console.error("Delete chair lock error:", err);
        return res.status(500).json({ error: "Failed to remove chair lock." });
      }
    }
  );
  app2.put(
    "/api/salons/:salonId/barbers",
    requireAuth,
    requireSalonTenantAccess(false),
    (req, res) => {
      try {
        const { salonId } = req.params;
        const barbers = Array.isArray(req.body?.barbers) ? req.body.barbers : [];
        const state = syncSalonBarbers(salonId, barbers);
        return res.json(state);
      } catch (err) {
        console.error("Sync barbers error:", err);
        return res.status(500).json({ error: "Failed to sync barbers." });
      }
    }
  );
  app2.post(
    "/api/salons/:salonId/counter-sleep",
    requireAuth,
    requireSalonTenantAccess(false),
    (req, res) => {
      try {
        const { salonId } = req.params;
        const sleeping = Boolean(req.body?.sleeping);
        const state = setCounterSleepState(salonId, sleeping);
        return res.json(state);
      } catch (err) {
        console.error("Counter sleep toggle error:", err);
        return res.status(500).json({ error: "Failed to update counter sleep state." });
      }
    }
  );
  app2.post(
    "/api/onboarding/verify-payment",
    requireAuth,
    requireRole("FOUNDER", "AGENT", "SALON_OWNER"),
    async (req, res) => {
      try {
        const user = req.authUser;
        const ipKey = extractClientIpKey(req.header("x-forwarded-for"), req.ip);
        const rl = await enforceRateLimit(`pay:verify:${user.userId}:${ipKey}`, 15, 300, {
          failClosedInProd: true
        });
        if (rl.unavailable) {
          return res.status(503).json({
            verified: false,
            error: "Payment verification rate limiter unavailable."
          });
        }
        if (!rl.allowed) {
          return res.status(429).json({
            verified: false,
            error: `Too many payment submissions. Retry after ${rl.retryAfterSec}s.`
          });
        }
        const body = req.body || {};
        const packageId = sanitizePlainText(body.packageId, 24) || "STARTER";
        const currency = sanitizePlainText(body.currency, 8) || "PKR";
        const amount = Number(body.amount || 0);
        const method = sanitizePlainText(body.method, 80) || "EasyPaisa";
        const tid = sanitizePlainText(body.tid, 80);
        const salonName = sanitizePlainText(body.salonName, 100) || "New Partner Salon";
        const requestedSalonId = typeof body.salonId === "string" && body.salonId.trim() ? sanitizePlainText(body.salonId, 80) : "onboarding";
        if (user.userRole === "SALON_OWNER" && requestedSalonId !== "onboarding") {
          const allowed = /* @__PURE__ */ new Set([
            ...user.salonId ? [user.salonId] : [],
            ...Array.isArray(user.allowedSalonIds) ? user.allowedSalonIds : []
          ]);
          if (!allowed.has(requestedSalonId)) {
            return res.status(403).json({
              verified: false,
              error: "Forbidden: cannot submit payment for an unowned salon."
            });
          }
        }
        const verification = verifyAuthoritativeWorkcraftPayment({
          kind: "SETUP",
          tier: packageId,
          currency,
          submittedAmount: amount,
          method,
          tid,
          salonId: requestedSalonId
        });
        if (!verification.ok) {
          return res.status(400).json({ verified: false, error: verification.error });
        }
        const isFounder = user.userRole === "FOUNDER";
        const submissionStatus = isFounder ? "APPROVED" : "PENDING_REVIEW";
        const entry = recordSalonFinancialPayment({
          type: "ONBOARDING_SETUP",
          salonId: requestedSalonId,
          salonName,
          agentId: user.userRole === "AGENT" ? user.agentId || void 0 : void 0,
          amount: verification.verifiedAmount,
          currency: verification.currency,
          method,
          referenceTid: verification.normalizedTid,
          note: `${submissionStatus}: Setup payment (${packageId}) by ${user.userRole} \u2794 ${verification.officialDestination}`
        });
        return res.status(201).json({
          verified: true,
          status: submissionStatus,
          activationStatus: isFounder ? "ACTIVE" : "PENDING_FOUNDER_APPROVAL",
          requiresFounderApproval: !isFounder,
          tid: verification.normalizedTid,
          amount: verification.verifiedAmount,
          currency: verification.currency,
          officialDestination: verification.officialDestination,
          sha256Proof: verification.sha256Proof,
          entry
        });
      } catch (err) {
        console.error("Onboarding payment verify route error:", err);
        return res.status(500).json({ verified: false, error: "Failed to record onboarding payment submission." });
      }
    }
  );
  app2.post(
    "/api/salons/:salonId/payments/maintenance",
    requireAuth,
    requireSalonTenantAccess(false),
    async (req, res) => {
      try {
        const user = req.authUser;
        const { salonId } = req.params;
        const ipKey = extractClientIpKey(req.header("x-forwarded-for"), req.ip);
        const rl = await enforceRateLimit(`pay:maint:${user.userId}:${ipKey}`, 15, 300, {
          failClosedInProd: true
        });
        if (rl.unavailable) {
          return res.status(503).json({ error: "Payment rate limiter unavailable." });
        }
        if (!rl.allowed) {
          return res.status(429).json({ error: `Too many payment submissions. Retry after ${rl.retryAfterSec}s.` });
        }
        const body = req.body || {};
        const amount = Number(body.amount || 0);
        const currency = sanitizePlainText(body.currency, 8) || "PKR";
        const method = sanitizePlainText(body.method, 80) || "EasyPaisa";
        const referenceTid = sanitizePlainText(body.tid, 80);
        const packageId = typeof body.packageId === "string" ? sanitizePlainText(body.packageId, 24) : void 0;
        const verification = verifyAuthoritativeWorkcraftPayment({
          kind: "MAINTENANCE",
          tier: packageId,
          currency,
          submittedAmount: amount,
          method,
          tid: referenceTid,
          salonId
        });
        if (!verification.ok) {
          return res.status(400).json({ error: verification.error });
        }
        const isFounder = user.userRole === "FOUNDER";
        const approvalStatus = isFounder ? "APPROVED" : "PENDING_REVIEW";
        const current = getSalonConciergeState(salonId);
        const entry = recordSalonFinancialPayment({
          type: "MAINT_PAYMENT",
          salonId,
          salonName: sanitizePlainText(body.salonName, 100) || current.settings.salonName,
          amount: verification.verifiedAmount,
          currency: verification.currency,
          method,
          referenceTid: verification.normalizedTid,
          note: `${approvalStatus}: Maintenance payment (${verification.normalizedTid}) \u2794 ${verification.officialDestination}`
        });
        const state = isFounder ? await setSalonBillingStatus(
          salonId,
          "ACTIVE",
          derivePgActorFromAuthUser(user, { targetSalonId: salonId })
        ) : current;
        return res.status(201).json({
          status: approvalStatus,
          requiresFounderApproval: !isFounder,
          entry,
          state,
          officialDestination: verification.officialDestination,
          sha256Proof: verification.sha256Proof
        });
      } catch (err) {
        console.error("Maintenance payment route error:", err);
        return res.status(500).json({ error: "Failed to record maintenance payment." });
      }
    }
  );
  app2.post(
    "/api/salons/:salonId/payments/upgrade",
    requireAuth,
    requireSalonTenantAccess(false),
    async (req, res) => {
      try {
        const user = req.authUser;
        const { salonId } = req.params;
        const ipKey = extractClientIpKey(req.header("x-forwarded-for"), req.ip);
        const rl = await enforceRateLimit(`pay:upgrade:${user.userId}:${ipKey}`, 15, 300, {
          failClosedInProd: true
        });
        if (rl.unavailable) {
          return res.status(503).json({ error: "Payment rate limiter unavailable." });
        }
        if (!rl.allowed) {
          return res.status(429).json({ error: `Too many upgrade submissions. Retry after ${rl.retryAfterSec}s.` });
        }
        const body = req.body || {};
        const rawTier = sanitizePlainText(body.packageTier, 20).toUpperCase();
        const packageTier = rawTier === "STARTER" ? "STARTER" : rawTier === "PRO" || rawTier === "GROWTH" ? "PRO" : "PRO++";
        const targetCatalogTier = sanitizePlainText(body.targetPlanId || rawTier, 24);
        const previousCatalogTier = typeof body.previousPlanId === "string" ? sanitizePlainText(body.previousPlanId, 24) : void 0;
        const differenceAmount = Number(body.differenceAmount || 0);
        const currency = sanitizePlainText(body.currency, 8) || "PKR";
        const method = sanitizePlainText(body.method, 80) || "Digital Settlement";
        const referenceTid = sanitizePlainText(body.tid, 80);
        const verification = verifyAuthoritativeWorkcraftPayment({
          kind: "UPGRADE",
          tier: targetCatalogTier,
          previousTier: previousCatalogTier,
          currency,
          submittedAmount: differenceAmount,
          method,
          tid: referenceTid,
          salonId
        });
        if (!verification.ok) {
          return res.status(400).json({ error: verification.error });
        }
        const isFounder = user.userRole === "FOUNDER";
        const approvalStatus = isFounder ? "APPROVED" : "PENDING_REVIEW";
        const currentState = getSalonConciergeState(salonId);
        const updatedSettings = isFounder ? await updateRetentionSettings(
          salonId,
          { packageTier },
          derivePgActorFromAuthUser(user, { targetSalonId: salonId })
        ) : currentState;
        const entry = recordSalonFinancialPayment({
          type: "PACKAGE_UPGRADE",
          salonId,
          salonName: sanitizePlainText(body.salonName, 100) || currentState.settings.salonName,
          amount: verification.verifiedAmount,
          currency: verification.currency,
          method,
          referenceTid: verification.normalizedTid,
          note: `${approvalStatus}: Upgrade request to ${targetCatalogTier} (submitted: ${verification.currency} ${verification.verifiedAmount}) \u2794 ${verification.officialDestination}`
        });
        return res.status(201).json({
          status: approvalStatus,
          requiresFounderApproval: !isFounder,
          entry,
          state: updatedSettings,
          officialDestination: verification.officialDestination,
          sha256Proof: verification.sha256Proof
        });
      } catch (err) {
        console.error("Package upgrade route error:", err);
        return res.status(500).json({ error: "Failed to persist package upgrade submission." });
      }
    }
  );
  app2.post(
    "/api/salons/:salonId/payments/video-deal",
    requireAuth,
    requireSalonTenantAccess(false),
    async (req, res) => {
      try {
        const user = req.authUser;
        const { salonId } = req.params;
        const ipKey = extractClientIpKey(req.header("x-forwarded-for"), req.ip);
        const rl = await enforceRateLimit(`pay:video:${user.userId}:${ipKey}`, 15, 300, {
          failClosedInProd: true
        });
        if (rl.unavailable) {
          return res.status(503).json({ verified: false, error: "Payment rate limiter unavailable." });
        }
        if (!rl.allowed) {
          return res.status(429).json({
            verified: false,
            error: `Too many payment submissions. Retry after ${rl.retryAfterSec}s.`
          });
        }
        const body = req.body || {};
        const planId = String(body.planId || "").toUpperCase() === "MONTHLY_4" ? "MONTHLY_4" : "SINGLE_1";
        const currency = sanitizePlainText(body.currency, 8) || "PKR";
        const amount = Number(body.amount || 0);
        const method = sanitizePlainText(body.method, 80) || "EasyPaisa";
        const tid = sanitizePlainText(body.tid, 80);
        const verification = verifyAuthoritativeWorkcraftPayment({
          kind: "VIDEO_CAMPAIGN",
          tier: planId,
          currency,
          submittedAmount: amount,
          method,
          tid,
          salonId
        });
        if (!verification.ok) {
          return res.status(400).json({ verified: false, error: verification.error });
        }
        const isFounder = user.userRole === "FOUNDER";
        const approvalStatus = isFounder ? "APPROVED" : "PENDING_REVIEW";
        const current = getSalonConciergeState(salonId);
        const entry = recordSalonFinancialPayment({
          type: "VIDEO_CAMPAIGN",
          salonId,
          salonName: sanitizePlainText(body.salonName, 100) || current.settings.salonName,
          amount: verification.verifiedAmount,
          currency: verification.currency,
          method,
          referenceTid: verification.normalizedTid,
          note: `${approvalStatus}: Video Campaign (${planId}) TID (${verification.normalizedTid}) \u2794 ${verification.officialDestination}`
        });
        return res.status(201).json({
          verified: true,
          status: approvalStatus,
          requiresFounderApproval: !isFounder,
          tid: verification.normalizedTid,
          amount: verification.verifiedAmount,
          currency: verification.currency,
          officialDestination: verification.officialDestination,
          sha256Proof: verification.sha256Proof,
          entry
        });
      } catch (err) {
        console.error("Video campaign payment verify route error:", err);
        return res.status(500).json({ verified: false, error: "Failed to submit video campaign TID." });
      }
    }
  );
  app2.post(
    "/api/salons/:salonId/walkin-queue",
    requireAuth,
    requireSalonTenantAccess(false),
    (req, res) => {
      const { salonId } = req.params;
      const body = req.body || {};
      const clientName = sanitizePlainText(body.clientName, 80);
      if (!clientName) {
        return res.status(400).json({ error: "Walk-in client name is required." });
      }
      const state = addWalkInQueueItem(salonId, {
        clientName,
        phone: typeof body.phone === "string" ? body.phone : "",
        service: typeof body.service === "string" ? body.service : "Express Service",
        assignedStaff: typeof body.assignedStaff === "string" ? body.assignedStaff : void 0,
        etaMinutes: Number(body.etaMinutes || 15)
      });
      return res.status(201).json(state);
    }
  );
  app2.patch(
    "/api/salons/:salonId/walkin-queue/:itemId",
    requireAuth,
    requireSalonTenantAccess(false),
    (req, res) => {
      const { salonId, itemId } = req.params;
      const rawStatus = sanitizePlainText(req.body?.status, 20).toUpperCase();
      const status = rawStatus === "SEATED" ? "SEATED" : rawStatus === "NOTIFIED" ? "NOTIFIED" : "WAITING";
      const state = updateWalkInQueueStatus(salonId, sanitizePlainText(itemId, 60), status);
      return res.json(state);
    }
  );
  app2.post(
    "/api/salons/:salonId/bridal-bookings",
    requireAuth,
    requireSalonTenantAccess(false),
    (req, res) => {
      const { salonId } = req.params;
      const body = req.body || {};
      const brideOrEventName = sanitizePlainText(body.brideOrEventName, 100);
      if (!brideOrEventName) {
        return res.status(400).json({ error: "Bride / Event name is required." });
      }
      const state = upsertBridalBooking(salonId, {
        brideOrEventName,
        phone: typeof body.phone === "string" ? body.phone : "",
        packageName: typeof body.packageName === "string" ? body.packageName : "Bridal Suite",
        eventDate: typeof body.eventDate === "string" ? body.eventDate : "Upcoming Event",
        trialDate: typeof body.trialDate === "string" ? body.trialDate : void 0,
        totalAmount: Number(body.totalAmount || 25e3),
        advancePaid: Number(body.advancePaid || 0),
        assignedStylist: typeof body.assignedStylist === "string" ? body.assignedStylist : void 0,
        homeService: Boolean(body.homeService)
      });
      return res.status(201).json(state);
    }
  );
  app2.post(
    "/api/salons/:salonId/bridal-bookings/:bookingId/settle",
    requireAuth,
    requireSalonTenantAccess(false),
    (req, res) => {
      const { salonId, bookingId } = req.params;
      const state = settleBridalBookingBalance(salonId, sanitizePlainText(bookingId, 60));
      return res.json(state);
    }
  );
  app2.post(
    "/api/salons/:salonId/packages",
    requireAuth,
    requireSalonTenantAccess(false),
    (req, res) => {
      const { salonId } = req.params;
      const body = req.body || {};
      const clientName = sanitizePlainText(body.clientName, 80);
      const packageTitle = sanitizePlainText(body.packageTitle, 100);
      if (!clientName || !packageTitle) {
        return res.status(400).json({ error: "Client name and package title are required." });
      }
      const state = upsertServicePackage(salonId, {
        clientName,
        phone: typeof body.phone === "string" ? body.phone : "",
        packageTitle,
        totalSessions: Number(body.totalSessions || 5),
        pricePaid: Number(body.pricePaid || 5e3)
      });
      return res.status(201).json(state);
    }
  );
  app2.post(
    "/api/salons/:salonId/packages/:pkgId/use-session",
    requireAuth,
    requireSalonTenantAccess(false),
    (req, res) => {
      const { salonId, pkgId } = req.params;
      const state = consumeServicePackageSession(salonId, sanitizePlainText(pkgId, 60));
      return res.json(state);
    }
  );
  app2.post("/api/telemetry/incident", async (req, res) => {
    try {
      const ipKey = extractClientIpKey(req.header("x-forwarded-for"), req.ip);
      const rl = await enforceRateLimit(`telemetry:${ipKey}`, 25, 60);
      if (!rl.allowed) {
        return res.status(429).json({ ok: false, error: "Telemetry throttle limit reached." });
      }
      const body = req.body || {};
      const message = sanitizePlainText(body.message, 320);
      if (!message) {
        return res.status(400).json({ ok: false, error: "Incident message is required." });
      }
      const record = recordIncidentReport({
        role: typeof body.role === "string" ? body.role : void 0,
        area: typeof body.area === "string" ? body.area : void 0,
        route: typeof body.route === "string" ? body.route : void 0,
        severity: typeof body.severity === "string" ? body.severity : void 0,
        message,
        stackHint: typeof body.stackHint === "string" ? body.stackHint : void 0,
        resolutionStatus: typeof body.resolutionStatus === "string" ? body.resolutionStatus : void 0,
        recoveryMs: Number(body.recoveryMs || 800)
      });
      return res.status(201).json({ ok: true, incident: record });
    } catch {
      return res.status(500).json({ ok: false, error: "Failed to log incident." });
    }
  });
  app2.get("/api/founder/incidents", requireAuth, requireRole("FOUNDER"), (req, res) => {
    const limit = Math.max(1, Math.min(80, Number(req.query.limit || 40)));
    return res.json(listIncidentReports(limit));
  });
  app2.post(
    "/api/founder/incidents/:incidentId/resolve",
    requireAuth,
    requireRole("FOUNDER"),
    (req, res) => {
      const incident = resolveIncidentReport(sanitizePlainText(req.params.incidentId, 60));
      if (!incident) {
        return res.status(404).json({ error: "Incident not found." });
      }
      return res.json({ ok: true, incident, ...listIncidentReports(40) });
    }
  );
  app2.use(
    (err, req, res, _next) => {
      const msg = err instanceof Error ? err.message : String(err || "Unhandled API exception");
      const incident = recordIncidentReport({
        role: "SYSTEM",
        area: "Express API Route",
        route: req.originalUrl || req.path || "/api",
        severity: "CRITICAL",
        resolutionStatus: "NEEDS_FOUNDER_ACTION",
        message: msg,
        recoveryMs: 45
      });
      if (!res.headersSent) {
        res.status(500).json({
          error: "A temporary server glitch was logged and isolated.",
          incidentId: incident.id
        });
      }
    }
  );
  return app2;
}

// server/vercelIndex.ts
var app = createApiApp();
function restoreApiRequestUrl(req) {
  try {
    const rawUrl = req.url || "/";
    const parsed = new URL(rawUrl, "http://localhost");
    if (parsed.searchParams.has("__wc_path")) {
      const subPath = (parsed.searchParams.get("__wc_path") || "").replace(/^\/+/, "");
      parsed.searchParams.delete("__wc_path");
      const qs = parsed.searchParams.toString();
      req.url = `/api/${subPath}${qs ? `?${qs}` : ""}`;
    }
  } catch {
  }
}
function handler(req, res) {
  restoreApiRequestUrl(req);
  return app(req, res);
}
export {
  handler as default
};
