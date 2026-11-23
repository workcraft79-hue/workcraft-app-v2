import crypto from 'crypto';
import fs from 'fs';
import express from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import QRCode from 'qrcode';
import {
  addChairLock,
  addStylistLeave,
  addWalkInQueueItem,
  cancelBookingByAccessToken,
  completeAppointmentAndRecordVisit,
  consumeServicePackageSession,
  createCustomerFlowBooking,
  createSalonDeal,
  deleteSalonDeal,
  findSalonIdByMetaPhoneNumberId,
  getAvailableSlotsAndBarbers,
  getBookingByAccessToken,
  getCustomerExperienceConfig,
  getDealVideoFileInfo,
  getMonthlyUsageSnapshot,
  getPublicDealPayload,
  getSalonConciergeState,
  handleCustomerWhatsAppAction,
  hydrateConciergeStoreFromKv,
  listSalonDeals,
  listSalonsForAgent,
  processWhatsAppWebhook,
  removeChairLock,
  removeStylistLeave,
  rescheduleBookingByAccessToken,
  resolveOwnerAlert,
  resolveSalonIdByPublicCode,
  resolveSalonIdByPublicCodeAsync,
  runBirthdayCron,
  runDealExpiryAndVideoRetentionCron,
  runPostServiceReviewCron,
  runWinBackCron,
  saveFirstTimeClientProfile,
  setCounterSleepState,
  setSalonBillingStatus,
  settleBridalBookingBalance,
  syncSalonBarbers,
  updateAppointmentStatus,
  updateRetentionSettings,
  updateWalkInQueueStatus,
  upsertBridalBooking,
  upsertClientProfile,
  upsertServicePackage,
} from './conciergeEngine.js';
import {
  AuthenticatedRequest,
  checkFounderPinAttemptAllowed,
  claimInitialFounderPin,
  clearFounderPinFailures,
  clearSessionCookie,
  consumeAgentInviteTokenAndRegisterAgent,
  createAgentInviteToken,
  extractAuthUserFromRequest,
  getCustomerCookieName,
  getFounderAuthStatus,
  getFounderSessionUser,
  hydrateSecurityStoreFromKv,
  inspectAgentInviteToken,
  isJwtSecretConfigured,
  issueOwnerLoginChallenge,
  parseCookieHeader,
  recordFounderPinFailure,
  registerSalonAssignment,
  registerSalonOwnerAccount,
  requireAuth,
  requireRole,
  requireSalonTenantAccess,
  requireWebhookSecret,
  rotateAllSessions,
  sanitizePhone,
  sanitizePlainText,
  setCustomerBrowserCookie,
  setSessionCookie,
  signSessionToken,
  verifyCustomerRecognizeToken,
  verifyFounderPin,
  verifyOwnerLoginChallenge,
} from './security.js';
import { enforceRateLimit, extractClientIpKey } from './rateLimiter.js';
import { assertProductionDatabaseReady } from './postgresRepo.js';
import {
  resolveTargetLocale,
  synthesizeEdgeTtsInMemory,
  transcribeChairIntentAudio,
  translateAndSynthesizeVoice,
} from './voiceTranslator.js';
import {
  appendVoiceMessage,
  getLiveUsageMeter,
  getWhatsAppHeartbeatStatus,
  hydrateVoiceStoreFromKv,
  listVoiceThreads,
  markVoiceThreadRead,
  recordAiVoiceApiUsage,
  recordWhatsAppGatewayHeartbeat,
  sweepExpiredVoiceBlobs,
} from './voiceInboxStore.js';
import {
  createCoAgentRecord,
  getFinanceAndAgentSummary,
  getFounderSettings,
  hydrateOpsStoreFromKv,
  issueFounderWebAuthnChallenge,
  listIncidentReports,
  recordAgentCashCollection,
  recordAgentCashRemittance,
  recordCoAgentCashHandoff,
  recordFounderBroadcastDispatch,
  recordIncidentReport,
  recordSalonFinancialPayment,
  registerFounderBiometricCredential,
  resolveIncidentReport,
  revokeAllFounderBiometrics,
  rotateFounderPairingKey,
  updateFounderReportPhone,
  verifyAuthoritativeWorkcraftPayment,
  verifyFounderBiometricAssertion,
} from './opsStore.js';
import { isKvConfigured } from './kvBridge.js';

const SALON_GLOSSARY: Array<[RegExp, string, string]> = [
  [/\bbeard oil treatment\b/i, 'داڑھی آئل ٹریٹمنٹ', 'علاج اللحية بالزيت'],
  [/\bbeard trim\b/i, 'داڑھی کی کٹائی و سیٹنگ', 'تشذيب وتحديد اللحية'],
  [/\bbeard sculpt\b/i, 'داڑھی اسکلپٹنگ و خط', 'نحت وتحديد اللحية'],
  [/\bbeard color\b/i, 'داڑھی کلرنگ', 'صبغ اللحية'],
  [/\bbeard styling\b/i, 'داڑھی اسٹائلنگ', 'تصفيف اللحية'],
  [/\bhot towel shave\b/i, 'ہاٹ ٹاول شیو', 'حلاقة بالمنشفة الساخنة'],
  [/\broyal shave\b/i, 'شاہی شیو', 'حلاقة ملكية'],
  [/\bexecutive haircut\b/i, 'ایگزیکٹو ہیئر کٹ', 'قص شعر تنفيذي'],
  [/\bkids haircut\b/i, 'بچوں کا ہیئر کٹ', 'قص شعر للأطفال'],
  [/\bskin fade\b/i, 'اسکن فیڈ کٹنگ', 'تدريج سكن فيد'],
  [/\bclassic haircut\b/i, 'کلاسک ہیئر کٹ', 'قص شعر كلاسيكي'],
  [/\bdeep cleansing facial\b/i, 'ڈیپ کلینزنگ فیشل', 'تنظيف عميق للبشرة'],
  [/\bhydra\s*facial\b/i, 'ہائیڈرا فیشل', 'جلسة هيدرافيشل'],
  [/\bgold facial\b/i, 'گولڈ فیشل', 'جلسة الذهب للوجه'],
  [/\bcharcoal facial\b/i, 'چارکول فیشل', 'تنظيف بشرة بالفحم'],
  [/\bskin polish\b/i, 'اسکن پالش', 'صنفرة وتفتيح البشرة'],
  [/\bkeratin treatment\b/i, 'کیراٹین ٹریٹمنٹ', 'علاج الكيراتين للشعر'],
  [/\bhair protein\b/i, 'ہیئر پروٹین ٹریٹمنٹ', 'بروتين لتقوية الشعر'],
  [/\bhead massage\b/i, 'سر کا مساج', 'تدليك الرأس'],
  [/\bshoulder massage\b/i, 'کندھوں کا مساج', 'تدليك الكتفين'],
  [/\bmanicure\b/i, 'مینی کیور', 'مانيكير'],
  [/\bpedicure\b/i, 'پیڈی کیور', 'باديكير'],
  [/\bparty makeup\b/i, 'پارٹی میک اپ', 'مكياج حفلات'],
  [/\bbridal makeup\b/i, 'برائیڈل میک اپ', 'مكياج عرائس'],
  [/\bthreading\b/i, 'تھریڈنگ', 'فتلة / تنظيف الحواجب'],
  [/\bwaxing\b/i, 'ویکسنگ', 'إزالة الشعر بالشمع'],
  [/\bbleach\b/i, 'اسکن بلیچ', 'تشقير وتفتيح'],
  [/\bhair color\b/i, 'ہیئر کلر', 'صبغة شعر'],
  [/\bscalp\b/i, 'اسکیلپ', 'فروة الرأس'],
  [/\bozone\b/i, 'اوزون', 'أوزون'],
  [/\bsteam\b/i, 'اسٹیم (بھاپ)', 'بخار'],
  [/\bfacial\b/i, 'فیشل', 'تنظيف بشرة'],
  [/\bwash\b/i, 'واش', 'غسيل'],
  [/\bhaircut\b/i, 'ہیئر کٹ', 'قص شعر'],
  [/\bshave\b/i, 'شیو', 'حلاقة'],
  [/\bbeard\b/i, 'داڑھی', 'اللحية'],
  [/\bhair\b/i, 'بالوں کا', 'الشعر'],
  [/\boil\b/i, 'آئل', 'زيت'],
  [/\bmassage\b/i, 'مساج', 'مساج وتدليك'],
  [/\btreatment\b/i, 'ٹریٹمنٹ', 'علاج'],
  [/\btrim\b/i, 'ٹرم', 'تشذيب'],
  [/\bspa\b/i, 'سپا', 'سبا'],
  [/\bcombo\b/i, 'کومبو پیکیج', 'باقة شاملة'],
  [/\bpackage\b/i, 'پیکیج', 'باقة'],
  [/\bstyling\b/i, 'اسٹائلنگ', 'تصفيف'],
  [/\bscrub\b/i, 'اسکرب', 'سنفرة'],
  [/\bcleansing\b/i, 'کلینزنگ', 'تنظيف'],
  [/\bwhitening\b/i, 'وائٹننگ', 'تفتيح'],
  [/\bdetox\b/i, 'ڈیٹاکس', 'تنقية'],
  [/\bglow\b/i, 'گلو', 'نضارة'],
  [/\bpremium\b/i, 'پریمیم', 'فاخر'],
  [/\bluxury\b/i, 'لگژری', 'ملكي فاخر'],
  [/\broyal\b/i, 'رائل', 'ملكي'],
  [/\borganic\b/i, 'آرگینک', 'طبيعي عضوي'],
  [/\bherbal\b/i, 'ہربل', 'أعشاب طبيعية'],
  [/\bprotein\b/i, 'پروٹین', 'بروتين'],
  [/\bkeratin\b/i, 'کیراٹین', 'كيراتين'],
  [/\bblowdry\b/i, 'بلو ڈرائی', 'سشوار'],
];

const URDU_CHAR_MAP: Record<string, string> = {
  a: 'ا',
  b: 'ب',
  c: 'ک',
  d: 'ڈ',
  e: 'ی',
  f: 'ف',
  g: 'گ',
  h: 'ہ',
  i: 'ی',
  j: 'ج',
  k: 'ک',
  l: 'ل',
  m: 'م',
  n: 'ن',
  o: 'و',
  p: 'پ',
  q: 'ق',
  r: 'ر',
  s: 'س',
  t: 'ٹ',
  u: 'و',
  v: 'و',
  w: 'و',
  x: 'کس',
  y: 'ی',
  z: 'ز',
};

const ARABIC_CHAR_MAP: Record<string, string> = {
  a: 'ا',
  b: 'ب',
  c: 'ك',
  d: 'د',
  e: 'ي',
  f: 'ف',
  g: 'غ',
  h: 'ه',
  i: 'ي',
  j: 'ج',
  k: 'ك',
  l: 'ل',
  m: 'م',
  n: 'ن',
  o: 'و',
  p: 'ب',
  q: 'ق',
  r: 'ر',
  s: 'س',
  t: 'ت',
  u: 'و',
  v: 'ف',
  w: 'و',
  x: 'كس',
  y: 'ي',
  z: 'ز',
};

function transliterateWord(word: string, lang: 'ur' | 'ar'): string {
  const map = lang === 'ur' ? URDU_CHAR_MAP : ARABIC_CHAR_MAP;
  let out = word.toLowerCase();
  if (lang === 'ur') {
    out = out
      .replace(/sh/g, 'ش')
      .replace(/ch/g, 'چ')
      .replace(/th/g, 'تھ')
      .replace(/kh/g, 'خ')
      .replace(/gh/g, 'غ')
      .replace(/ph/g, 'ف')
      .replace(/oo/g, 'و')
      .replace(/ee/g, 'ی');
  } else {
    out = out
      .replace(/sh/g, 'ش')
      .replace(/ch/g, 'تش')
      .replace(/th/g, 'ث')
      .replace(/kh/g, 'خ')
      .replace(/gh/g, 'غ')
      .replace(/ph/g, 'ف')
      .replace(/oo/g, 'و')
      .replace(/ee/g, 'ي');
  }
  let res = '';
  for (const ch of out) {
    if (map[ch]) {
      res += map[ch];
    } else {
      res += ch;
    }
  }
  return res;
}

function fallbackTranslateService(text: string): { ur: string; ar: string } {
  const clean = text.trim();
  const buildFor = (lang: 'ur' | 'ar') => {
    let working = clean;
    for (const [pattern, urVal, arVal] of SALON_GLOSSARY) {
      working = working.replace(pattern, lang === 'ur' ? urVal : arVal);
    }
    const tokens = working.split(/\s+/).filter(Boolean);
    const converted = tokens.map((tok) => {
      if (/[a-zA-Z]/.test(tok) && !/^(VIP|HD|24K|LED)$/i.test(tok)) {
        return transliterateWord(tok, lang);
      }
      return tok;
    });
    return converted.join(' ').trim();
  };

  return {
    ur: buildFor('ur'),
    ar: buildFor('ar'),
  };
}

function detectInputLanguage(text: string): 'en' | 'ur' | 'ar' {
  if (/[\u0679\u067E\u0686\u0688\u0691\u0698\u06BA\u06BE\u06C1\u06D2]/.test(text)) {
    return 'ur';
  }
  if (/[\u0600-\u06FF]/.test(text)) {
    return 'ar';
  }
  return 'en';
}

let kvHydrationPromise: Promise<void> | null = null;
function ensureKvHydrated(): Promise<void> {
  if (!isKvConfigured()) return Promise.resolve();
  if (!kvHydrationPromise) {
    kvHydrationPromise = Promise.all([
      hydrateSecurityStoreFromKv(),
      hydrateOpsStoreFromKv(),
      hydrateVoiceStoreFromKv(),
      hydrateConciergeStoreFromKv(),
    ])
      .then(() => undefined)
      .catch(() => undefined);
  }
  return kvHydrationPromise;
}

const telemetryRateBuckets = new Map<string, { count: number; resetAt: number }>();

export function createApiApp(port = 3000): express.Express {
  const app = express();
  app.disable('x-powered-by');
  const metaWebhookJsonParser = express.json({
    limit: '2mb',
    verify: (req, _res, buf) => {
      (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
    },
  });
  app.use('/api/whatsapp/meta-webhook', (req, res, next) => {
    const preParsed = (req as express.Request & { body?: unknown }).body;
    if (preParsed !== undefined && !Buffer.isBuffer(preParsed)) {
      return next();
    }
    if (req.readableEnded) {
      if (req.body === undefined) req.body = {};
      return next();
    }
    return metaWebhookJsonParser(req, res, next);
  });

  const jsonBodyParser = express.json({ limit: '4mb' });
  app.use((req, res, next) => {
    const preParsed = (req as express.Request & { body?: unknown }).body;
    if (preParsed !== undefined && !Buffer.isBuffer(preParsed)) {
      if (typeof preParsed === 'string') {
        try {
          req.body = preParsed.trim() ? JSON.parse(preParsed) : {};
        } catch {
          return res.status(400).json({ error: 'Invalid JSON request body.' });
        }
      }
      return next();
    }
    if (req.readableEnded) {
      if (req.body === undefined) req.body = {};
      return next();
    }
    return jsonBodyParser(req, res, next);
  });

  app.use('/api', async (req, res, next) => {
    if (req.path !== '/health' && req.path !== '/auth/founder-status') {
      const dbReady = assertProductionDatabaseReady();
      if (!dbReady.ok) {
        return res.status(503).json({ error: dbReady.error });
      }
    }
    try {
      await ensureKvHydrated();
    } catch {
      // Non-fatal fallback to local/tmp stores in non-production preview
    }
    return next();
  });

  app.get('/api/health', (_req, res) => {
    const dbReady = assertProductionDatabaseReady();
    res.json({
      ok: true,
      status: 'HEALTHY',
      port,
      runtime: process.env.VERCEL ? 'vercel-node' : 'node',
      kvConfigured: isKvConfigured(),
      postgresReady: dbReady.ok,
    });
  });

  // ===========================================================================
  // 4-ROLE SESSION AUTH, FOUNDER PIN/BIOMETRICS & OWNER/AGENT CHALLENGE SIGN-IN
  // ===========================================================================
  app.get('/api/auth/session', (req, res) => {
    const user = extractAuthUserFromRequest(req);
    if (!user) {
      return res.json({ authenticated: false, user: null });
    }
    return res.json({ authenticated: true, user });
  });

  app.get('/api/auth/founder-status', (_req, res) => {
    const status = getFounderAuthStatus();
    const dbReady = assertProductionDatabaseReady();
    const missingEnvVars = [...status.missingEnvVars];
    if (!dbReady.ok && !missingEnvVars.includes('DATABASE_URL')) {
      missingEnvVars.push('DATABASE_URL');
    }
    return res.json({
      ...status,
      databaseConfigured: dbReady.ok,
      missingEnvVars,
      productionMisconfigured: status.productionMisconfigured || !dbReady.ok,
    });
  });

  // Initial Founder PIN setup (strictly non-production preview when no PIN is configured yet)
  app.post('/api/auth/founder-setup', async (req, res) => {
    const ipKey = extractClientIpKey(req.header('x-forwarded-for'), req.ip);
    const rl = await enforceRateLimit(`auth:founder-setup:${ipKey}`, 5, 300);
    if (!rl.allowed) {
      return res.status(429).json({
        error: `Too many attempts. Retry in ${rl.retryAfterSec}s.`,
      });
    }
    const pin = typeof req.body?.pin === 'string' ? req.body.pin : '';
    const claimed = claimInitialFounderPin(pin);
    if (!claimed.ok) {
      return res.status(400).json({ error: claimed.error });
    }
    const founder = getFounderSessionUser();
    const token = signSessionToken(founder);
    setSessionCookie(res, token, req);
    return res.status(201).json({ authenticated: true, user: founder });
  });

  // Founder PIN Verification (Fail-closed when unconfigured; zero default PINs or hints)
  app.post('/api/auth/founder-session', async (req, res) => {
    if (!isJwtSecretConfigured() || getFounderAuthStatus().productionMisconfigured) {
      return res.status(503).json({
        error: 'Founder authentication is not configured in server environment (JWT_SECRET & FOUNDER_PIN required).',
      });
    }
    const existing = extractAuthUserFromRequest(req);
    if (existing?.userRole === 'FOUNDER') {
      const token = signSessionToken(existing);
      setSessionCookie(res, token, req);
      return res.json({ authenticated: true, user: existing });
    }

    const ipKey = extractClientIpKey(req.header('x-forwarded-for'), req.ip);
    const rl = await enforceRateLimit(`auth:founder:${ipKey}`, 10, 60);
    if (!rl.allowed) {
      return res.status(429).json({
        error: `Too many authentication attempts. Wait ${rl.retryAfterSec}s before retrying.`,
      });
    }

    const attemptGate = checkFounderPinAttemptAllowed(ipKey);
    if (!attemptGate.allowed) {
      return res.status(429).json({
        error: `Too many incorrect Founder PIN attempts. Wait ${attemptGate.retryAfterSec}s before trying again.`,
      });
    }

    const pin = typeof req.body?.pin === 'string' ? req.body.pin : '';
    if (!verifyFounderPin(pin)) {
      recordFounderPinFailure(ipKey);
      return res.status(401).json({
        error: 'Invalid Founder PIN.',
      });
    }

    clearFounderPinFailures(ipKey);
    const founder = getFounderSessionUser();
    const token = signSessionToken(founder);
    setSessionCookie(res, token, req);
    return res.json({ authenticated: true, user: founder });
  });

  app.post('/api/auth/rotate-sessions', requireAuth, requireRole('FOUNDER'), (req, res) => {
    const newVersion = rotateAllSessions();
    const founder = getFounderSessionUser();
    const freshToken = signSessionToken(founder);
    setSessionCookie(res, freshToken, req);
    return res.json({ ok: true, sessionVersion: newVersion });
  });

  // Standalone Salon Owner / Field Agent OTP Challenge Login (works directly on /salon or /agent URL)
  app.post('/api/auth/owner-challenge', async (req, res) => {
    const ipKey = extractClientIpKey(req.header('x-forwarded-for'), req.ip);
    const rl = await enforceRateLimit(`auth:owner-challenge:${ipKey}`, 8, 300);
    if (!rl.allowed) {
      return res.status(429).json({
        error: `Too many verification code requests. Try again in ${rl.retryAfterSec}s.`,
      });
    }
    const identifier = sanitizePlainText(req.body?.identifier, 120);
    if (!identifier) {
      return res.status(400).json({ error: 'Enter your registered mobile number or email.' });
    }
    const issued = issueOwnerLoginChallenge(identifier);
    if (!issued.ok) {
      return res.status(404).json({ error: issued.error });
    }
    return res.json(issued);
  });

  app.post('/api/auth/owner-verify', async (req, res) => {
    const ipKey = extractClientIpKey(req.header('x-forwarded-for'), req.ip);
    const rl = await enforceRateLimit(`auth:owner-verify:${ipKey}`, 15, 300);
    if (!rl.allowed) {
      return res.status(429).json({
        error: `Too many verification attempts. Try again in ${rl.retryAfterSec}s.`,
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

  // WebAuthn Mobile Biometric Challenge (Thumb / Face ID)
  app.post('/api/auth/founder-webauthn/challenge', (req: AuthenticatedRequest, res) => {
    const purpose = req.body?.purpose === 'register' ? 'register' : 'login';
    if (purpose === 'register') {
      const user = extractAuthUserFromRequest(req);
      if (!user || user.userRole !== 'FOUNDER') {
        return res.status(401).json({ error: 'Sign in with Founder PIN first to register mobile biometrics.' });
      }
    }
    const hostHeader = String(req.header('host') || 'localhost').split(':')[0].toLowerCase();
    const { challenge, challengeToken } = issueFounderWebAuthnChallenge(purpose);
    return res.json({
      challenge,
      challengeToken,
      rpId: hostHeader,
      rpName: 'WorkCraft',
    });
  });

  // Register Mobile Biometric Credential (Requires active Founder PIN session)
  app.post(
    '/api/auth/founder-webauthn/register',
    requireAuth,
    requireRole('FOUNDER'),
    (req, res) => {
      const body = req.body || {};
      const result = registerFounderBiometricCredential({
        challengeToken: String(body.challengeToken || ''),
        credentialId: String(body.credentialId || ''),
        clientDataJSON: String(body.clientDataJSON || ''),
        publicKeySpkiBase64:
          typeof body.publicKeySpkiBase64 === 'string' ? body.publicKeySpkiBase64 : undefined,
        authenticatorDataBase64:
          typeof body.authenticatorDataBase64 === 'string' ? body.authenticatorDataBase64 : undefined,
        deviceLabel: typeof body.deviceLabel === 'string' ? body.deviceLabel : undefined,
      });
      if (!result.ok) {
        return res.status(400).json({ error: result.error });
      }
      return res.status(201).json(result);
    }
  );

  // Login via Hardware Biometric Assertion (Thumb / Face ID)
  app.post('/api/auth/founder-webauthn/verify', (req, res) => {
    const body = req.body || {};
    const verification = verifyFounderBiometricAssertion({
      challengeToken: String(body.challengeToken || ''),
      biometricBlob: String(body.biometricBlob || ''),
      credentialId: String(body.credentialId || ''),
      authenticatorData: String(body.authenticatorData || ''),
      clientDataJSON: String(body.clientDataJSON || ''),
      signature: String(body.signature || ''),
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
      deviceLabel: verification.deviceLabel,
    });
  });

  // Revoke all previously registered Founder biometric credentials
  app.post(
    '/api/auth/founder-webauthn/revoke',
    requireAuth,
    requireRole('FOUNDER'),
    (_req, res) => {
      return res.json({ ok: true, ...revokeAllFounderBiometrics() });
    }
  );

  app.post('/api/auth/logout', (_req, res) => {
    clearSessionCookie(res);
    return res.json({ ok: true });
  });

  // Founder mints a single-use /enroll/agent?token=... invite link (ZERO PIN)
  app.post('/api/founder/agent-invites', requireAuth, requireRole('FOUNDER'), (req, res) => {
    const agentId = sanitizePlainText(req.body?.agentId, 40) || undefined;
    const name = sanitizePlainText(req.body?.name, 80) || 'Field Agent';
    const phone = sanitizePhone(req.body?.phone);
    const city = sanitizePlainText(req.body?.city, 120) || 'Assigned Territory';
    const countryName = sanitizePlainText(req.body?.countryName, 60) || 'Pakistan';
    if (!phone) {
      return res.status(400).json({ error: 'Agent WhatsApp phone is required.' });
    }
    const created = createAgentInviteToken({ agentId, name, phone, city, countryName });
    return res.status(201).json({
      ...created,
      enrollPath: `/enroll/agent?token=${encodeURIComponent(created.token)}`,
    });
  });

  // Single-use Field Agent Invite Verification (/enroll/agent?token=...)
  app.get('/api/agent/enroll', (req, res) => {
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    const check = inspectAgentInviteToken(token);
    if (!check.valid) {
      return res.status(check.status).json({ valid: false, error: check.error });
    }
    return res.json({ valid: true, invite: check.invite });
  });

  // Complete Agent Enrollment -> Locks invite token permanently & issues AGENT session
  app.post('/api/agent/enroll/complete', (req, res) => {
    // Invisible CSS Honeypot check
    const honeypot =
      (typeof req.body?.websiteUrl === 'string' && req.body.websiteUrl.trim()) ||
      (typeof req.body?.companyFax === 'string' && req.body.companyFax.trim());
    if (honeypot) {
      return res.status(200).json({ ok: true, ignored: true });
    }

    const rawToken = sanitizePlainText(req.body?.token, 128);
    const result = consumeAgentInviteTokenAndRegisterAgent({
      rawToken,
      name: req.body?.name,
      phone: req.body?.phone,
      city: req.body?.city,
    });
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }

    const jwt = signSessionToken(result.user);
    setSessionCookie(res, jwt, req);
    return res.json({ authenticated: true, user: result.user });
  });

  // Agent & Founder Scoped Salon Directory
  app.get('/api/agent/salons', requireAuth, requireRole('FOUNDER', 'AGENT'), (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const salons = listSalonsForAgent(user.agentId, user.userRole === 'FOUNDER');
    return res.json({ salons });
  });

  app.post('/api/agent/salons', requireAuth, requireRole('FOUNDER', 'AGENT'), (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const salonName = sanitizePlainText(req.body?.salonName, 100);
    const ownerName = sanitizePlainText(req.body?.ownerName, 80) || 'Salon Owner';
    const whatsappPhone = sanitizePhone(req.body?.whatsappPhone);
    if (!salonName || !whatsappPhone) {
      return res.status(400).json({ error: 'salonName and whatsappPhone are required.' });
    }
    const newId = `salon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
    const assignedAgentId = user.agentId || 'agent-pk-1';
    registerSalonAssignment(newId, assignedAgentId);
    const ownerReg = registerSalonOwnerAccount({
      salonId: newId,
      salonName,
      ownerName,
      phone: whatsappPhone,
      agentId: assignedAgentId,
    });
    if (!ownerReg.ok) {
      return res.status(409).json({ error: ownerReg.error });
    }
    const state = getSalonConciergeState(newId, {
      salonName,
      ownerName,
      whatsappPhone,
      billingStatus: 'ACTIVE',
    });
    return res.status(201).json({ salonId: newId, state });
  });

  // Public Salon Self-Onboarding (Distributed Rate-Limit + Honeypot Protected)
  app.post('/api/onboarding/complete', async (req, res) => {
    try {
      const ipKey = extractClientIpKey(req.header('x-forwarded-for'), req.ip);
      const rl = await enforceRateLimit(`onboarding:${ipKey}`, 10, 3600);
      if (!rl.allowed) {
        return res.status(429).json({
          error: `Too many onboarding submissions. Retry after ${rl.retryAfterSec}s.`,
        });
      }

      const honeypot =
        (typeof req.body?.websiteUrl === 'string' && req.body.websiteUrl.trim()) ||
        (typeof req.body?.companyFax === 'string' && req.body.companyFax.trim());
      if (honeypot) {
        return res.status(200).json({ ok: true, ignored: true });
      }

      const salonName = sanitizePlainText(req.body?.salonName, 100);
      const ownerName = sanitizePlainText(req.body?.ownerName, 80) || 'Salon Owner';
      const whatsappPhone = sanitizePhone(req.body?.phone);
      const publicContactPhone = sanitizePhone(req.body?.publicContactPhone) || whatsappPhone;
      const rawPlanId = sanitizePlainText(req.body?.planId, 20).toUpperCase();
      const packageTier: 'STARTER' | 'PRO' | 'PRO++' | 'CUSTOM' =
        rawPlanId === 'STARTER'
          ? 'STARTER'
          : rawPlanId === 'CUSTOM'
          ? 'CUSTOM'
          : rawPlanId === 'GROWTH' || rawPlanId === 'PRO'
          ? 'PRO'
          : 'PRO++';
      const rawCategory = sanitizePlainText(req.body?.salonCategory, 16).toUpperCase();
      const salonCategory: 'MENS' | 'LADIES' | undefined =
        rawCategory === 'LADIES' ? 'LADIES' : rawCategory === 'MENS' ? 'MENS' : undefined;
      const enabledServices = Array.isArray(req.body?.enabledServices)
        ? req.body.enabledServices
        : undefined;
      const barbers = Array.isArray(req.body?.barbers)
        ? req.body.barbers.map((b: unknown) => sanitizePlainText(b, 60)).filter(Boolean)
        : [];

      if (!salonName || !whatsappPhone) {
        return res.status(400).json({ error: 'Salon name and owner mobile number are required.' });
      }

      const newSalonId = `salon-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
      const reg = registerSalonOwnerAccount({
        salonId: newSalonId,
        salonName,
        ownerName,
        phone: whatsappPhone,
        agentId: null,
      });

      if (!reg.ok) {
        return res.status(409).json({
          error:
            'Each salon branch requires its own unique owner number, or sign in first to add another branch.',
        });
      }

      getSalonConciergeState(newSalonId, {
        salonName,
        ownerName,
        whatsappPhone,
        billingStatus: 'PENDING_ACTIVATION',
        packageTier,
        salonCategory,
        enabledServices,
      });
      updateRetentionSettings(newSalonId, {
        salonName,
        ownerName,
        ownerAuthPhone: whatsappPhone,
        publicContactPhone,
        publicWhatsappPhone: publicContactPhone,
        whatsappPhone,
        packageTier,
        salonCategory,
        enabledServices,
      });
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
        billingStatus: 'PENDING_ACTIVATION',
        state: finalState,
      });
    } catch (err) {
      console.error('Public onboarding completion error:', err);
      return res.status(500).json({ error: 'Could not complete salon setup.' });
    }
  });

  // Founder-Only Billing Activation (Unlocks Automated Mass WhatsApp Blasts)
  app.post(
    '/api/salons/:salonId/activate-billing',
    requireAuth,
    requireRole('FOUNDER'),
    (req, res) => {
      const { salonId } = req.params;
      const statusRaw = sanitizePlainText(req.body?.billingStatus, 30).toUpperCase();
      const billingStatus =
        statusRaw === 'PENDING_ACTIVATION' ||
        statusRaw === 'PAST_DUE' ||
        statusRaw === 'SUSPENDED'
          ? statusRaw
          : 'ACTIVE';
      const state = setSalonBillingStatus(salonId, billingStatus);
      return res.json({ billingStatus, state });
    }
  );

  app.post('/api/translate-service', requireAuth, async (req, res) => {
    try {
      const rawText = sanitizePlainText(req.body?.text, 180);
      const targetLang: 'ur' | 'ar' | 'en' =
        req.body?.targetLang === 'ur' || req.body?.targetLang === 'ar' || req.body?.targetLang === 'en'
          ? req.body.targetLang
          : 'ur';

      if (!rawText) {
        return res.status(400).json({ error: 'Service name text is required.' });
      }

      const detectedLanguage = detectInputLanguage(rawText);
      const localFallback = fallbackTranslateService(rawText);

      const apiKey = process.env.GEMINI_API_KEY;
      if (apiKey && apiKey.trim().length > 0 && detectedLanguage === 'en') {
        try {
          const ai = new GoogleGenAI({
            apiKey: apiKey.trim(),
            httpOptions: {
              headers: {
                'User-Agent': 'aistudio-build',
              },
            },
          });

          const response = await ai.models.generateContent({
            model: 'gemini-4-hydrogen',
            contents: `Translate this barbershop / beauty salon service name from English into natural, everyday Urdu (ur, Arabic-Urdu script) and Arabic (ar) as used by salon owners in Pakistan and UAE/Saudi Arabia. Keep it short, crisp, and natural.\nService name: "${rawText}"`,
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  ur: {
                    type: Type.STRING,
                    description: 'Natural Pakistani Urdu translation in Urdu script.',
                  },
                  ar: {
                    type: Type.STRING,
                    description: 'Natural Gulf/Standard Arabic translation in Arabic script.',
                  },
                },
                required: ['ur', 'ar'],
              },
            },
          });

          const parsed = JSON.parse((response.text ?? '{}').trim()) as { ur?: string; ar?: string };
          const translations: { en: string; ur: string; ar: string } = {
            en: rawText,
            ur: parsed.ur?.trim() || localFallback.ur,
            ar: parsed.ar?.trim() || localFallback.ar,
          };

          return res.json({
            detectedLanguage,
            translations,
            translatedText: translations[targetLang],
            source: 'gemini',
          });
        } catch (aiErr) {
          console.warn('Gemini service translation fallback triggered:', aiErr);
        }
      }

      const translations: { en: string; ur: string; ar: string } = {
        en: rawText,
        ur: detectedLanguage === 'ur' ? rawText : localFallback.ur,
        ar: detectedLanguage === 'ar' ? rawText : localFallback.ar,
      };

      return res.json({
        detectedLanguage,
        translations,
        translatedText: translations[targetLang],
        source: 'dictionary',
      });
    } catch (err) {
      console.error('Translation route error:', err);
      return res.status(500).json({ error: 'Translation failed.' });
    }
  });

  app.post('/api/translate-voice', requireAuth, async (req, res) => {
    try {
      const rawText = sanitizePlainText(req.body?.text, 1000);
      const audioBase64 = typeof req.body?.audioBase64 === 'string' ? req.body.audioBase64.trim() : '';
      const audioMimeType =
        typeof req.body?.audioMimeType === 'string'
          ? sanitizePlainText(req.body.audioMimeType, 80)
          : 'audio/webm;codecs=opus';
      const targetLocaleRaw = sanitizePlainText(req.body?.targetLocale, 20);
      const targetDialectRaw = sanitizePlainText(req.body?.targetDialect, 60);

      if (!rawText && !audioBase64) {
        return res.status(400).json({ error: 'Compressed audio recording or message text is required.' });
      }
      if (audioBase64.length > 3 * 1024 * 1024) {
        return res.status(413).json({ error: 'Compressed voice note exceeds size limit.' });
      }

      const result = await translateAndSynthesizeVoice({
        audioBase64,
        audioMimeType,
        text: rawText,
        targetLocale: targetLocaleRaw || undefined,
        targetDialect: targetDialectRaw || undefined,
      });

      const usage = recordAiVoiceApiUsage(
        result.translationSource !== 'error',
        result.ttsSource !== 'unavailable'
      );

      if (result.translationSource === 'error') {
        return res.status(503).json({
          ...result,
          error: result.translationError || 'Voice translation failed.',
          usage,
        });
      }

      return res.json({
        ...result,
        usage,
      });
    } catch (err) {
      console.error('Voice translation & TTS route error:', err);
      return res.status(500).json({ error: 'Voice translation failed.' });
    }
  });

  // Zero-quota natural human voice neural TTS endpoint for Salon Owner Dashboard hands-free alerts
  app.post('/api/voice/tts', requireAuth, async (req, res) => {
    try {
      const text = sanitizePlainText(req.body?.text, 1500);
      const targetLocale = resolveTargetLocale(
        typeof req.body?.locale === 'string' ? req.body.locale : undefined,
        undefined
      );
      if (!text) {
        return res.status(400).json({ error: 'Speech text is required.' });
      }
      const ttsResult = await synthesizeEdgeTtsInMemory(text, targetLocale);
      if (!ttsResult.audioBase64) {
        return res.status(503).json({
          error: ttsResult.ttsError || 'Neural TTS unavailable.',
          voiceName: ttsResult.voiceName,
        });
      }
      return res.json({
        audioBase64: ttsResult.audioBase64,
        audioMimeType: 'audio/mpeg',
        voiceName: ttsResult.voiceName,
        ttsSource: ttsResult.ttsSource,
      });
    } catch (err) {
      console.error('Voice TTS route error:', err);
      return res.status(500).json({ error: 'Could not synthesize voice.' });
    }
  });

  // Transcribe short spoken chair-lock voice command when browser SpeechRecognition is unavailable
  app.post('/api/voice/chair-intent', requireAuth, async (req, res) => {
    try {
      const audioBase64 = typeof req.body?.audioBase64 === 'string' ? req.body.audioBase64.trim() : '';
      const audioMimeType =
        typeof req.body?.audioMimeType === 'string'
          ? sanitizePlainText(req.body.audioMimeType, 80)
          : 'audio/webm';
      const langRaw = sanitizePlainText(req.body?.lang, 10).toLowerCase();
      const ownerLang: 'ur' | 'ar' | 'en' =
        langRaw.startsWith('ar') ? 'ar' : langRaw.startsWith('en') ? 'en' : 'ur';

      if (!audioBase64) {
        return res.status(400).json({ error: 'Audio recording is required.' });
      }
      if (audioBase64.length > 2 * 1024 * 1024) {
        return res.status(413).json({ error: 'Audio clip too large.' });
      }
      const out = await transcribeChairIntentAudio(audioBase64, audioMimeType, ownerLang);
      if (!out.transcript) {
        return res.status(503).json({ error: out.error || 'Could not transcribe command.' });
      }
      return res.json({ transcript: out.transcript });
    } catch (err) {
      console.error('Chair intent route error:', err);
      return res.status(500).json({ error: 'Failed to transcribe chair lock audio.' });
    }
  });

  // ===========================================================================
  // UNIFIED VOICE INBOX, LIVE USAGE METER (7-DAY CLEANUP) & WHATSAPP HEARTBEAT
  // ===========================================================================
  app.get('/api/voice/usage', requireAuth, (_req, res) => {
    sweepExpiredVoiceBlobs();
    return res.json(getLiveUsageMeter());
  });

  app.get(
    '/api/voice/threads',
    requireAuth,
    requireRole('FOUNDER', 'SALON_OWNER'),
    (req: AuthenticatedRequest, res) => {
      const authUser = req.authUser!;
      const requestedSalonId =
        typeof req.query.salonId === 'string' ? sanitizePlainText(req.query.salonId, 60) : undefined;
      // Strict tenant isolation when logged in as SALON_OWNER
      const salonFilter =
        authUser.userRole === 'SALON_OWNER'
          ? authUser.salonId || '__none__'
          : requestedSalonId;
      return res.json(listVoiceThreads(salonFilter));
    }
  );

  app.post(
    '/api/voice/threads/message',
    requireAuth,
    requireRole('FOUNDER', 'SALON_OWNER'),
    (req: AuthenticatedRequest, res) => {
      try {
        const authUser = req.authUser!;
        const body = req.body || {};
        // SALON_OWNER sessions are strictly locked to SALON_OWNER; FOUNDER can post as FOUNDER or simulate SALON_OWNER from Preview mode
        const senderRole: 'FOUNDER' | 'SALON_OWNER' =
          authUser.userRole === 'FOUNDER'
            ? body.senderRole === 'SALON_OWNER'
              ? 'SALON_OWNER'
              : 'FOUNDER'
            : 'SALON_OWNER';

        const threadId =
          typeof body.threadId === 'string' ? sanitizePlainText(body.threadId, 60) : undefined;
        const salonId =
          authUser.userRole === 'SALON_OWNER' && authUser.salonId
            ? authUser.salonId
            : typeof body.salonId === 'string'
            ? sanitizePlainText(body.salonId, 60)
            : undefined;
        const salonName =
          authUser.userRole === 'SALON_OWNER' && authUser.salonName
            ? authUser.salonName
            : typeof body.salonName === 'string'
            ? sanitizePlainText(body.salonName, 100)
            : undefined;
        const ownerName =
          authUser.userRole === 'SALON_OWNER'
            ? authUser.displayName
            : typeof body.ownerName === 'string'
            ? sanitizePlainText(body.ownerName, 80)
            : undefined;
        const city = typeof body.city === 'string' ? sanitizePlainText(body.city, 80) : undefined;
        const targetLocale = resolveTargetLocale(
          typeof body.targetLocale === 'string' ? body.targetLocale : undefined,
          typeof body.targetDialect === 'string' ? body.targetDialect : undefined
        );
        const originalText = sanitizePlainText(body.originalText, 1000) || '(Compressed Opus Voice Note)';
        const translatedText = sanitizePlainText(body.translatedText, 1200) || originalText;
        const detectedInputLanguage = sanitizePlainText(body.detectedInputLanguage, 40) || 'Auto';
        const voiceName = typeof body.voiceName === 'string' ? sanitizePlainText(body.voiceName, 60) : undefined;
        const audioDataUrl =
          typeof body.audioDataUrl === 'string' && body.audioDataUrl.startsWith('data:audio/')
            ? body.audioDataUrl.slice(0, 2 * 1024 * 1024)
            : undefined;
        const sizeBytes = Number(body.sizeBytes || 0) || undefined;

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
          sizeBytes,
        });

        return res.status(201).json(updated);
      } catch (err) {
        console.error('Failed to append voice thread message:', err);
        return res.status(500).json({ error: 'Could not save voice message.' });
      }
    }
  );

  app.patch(
    '/api/voice/threads/:threadId/read',
    requireAuth,
    requireRole('FOUNDER', 'SALON_OWNER'),
    (req: AuthenticatedRequest, res) => {
      const authUser = req.authUser!;
      const threadId = sanitizePlainText(req.params.threadId, 60);
      if (authUser.userRole === 'SALON_OWNER' && authUser.salonId) {
        const ownThreads = listVoiceThreads(authUser.salonId).threads;
        if (!ownThreads.some((t) => t.id === threadId)) {
          return res.status(403).json({ error: 'Forbidden: cannot mark another salon thread.' });
        }
      }
      const unread = Boolean(req.body?.unread);
      return res.json(markVoiceThreadRead(threadId, unread));
    }
  );

  app.get('/api/health/whatsapp', requireAuth, (_req, res) => {
    return res.json(getWhatsAppHeartbeatStatus());
  });

  app.post('/api/health/whatsapp/heartbeat', requireWebhookSecret, (req, res) => {
    const ok = req.body?.ok !== false;
    const reason = typeof req.body?.reason === 'string' ? sanitizePlainText(req.body.reason, 180) : undefined;
    return res.json(recordWhatsAppGatewayHeartbeat(ok, reason));
  });

  // ===========================================================================
  // PERSISTENT FINANCE LEDGER, AGENT CASH, CO-AGENT SPLITS, SETTINGS & QR
  // ===========================================================================
  app.get(
    '/api/finance/summary',
    requireAuth,
    requireRole('FOUNDER', 'AGENT'),
    (req: AuthenticatedRequest, res) => {
      const agentId = req.authUser?.agentId || 'agent-pk-1';
      return res.json(getFinanceAndAgentSummary(agentId));
    }
  );

  app.post(
    '/api/agent/cash/collect',
    requireAuth,
    requireRole('FOUNDER', 'AGENT'),
    (req: AuthenticatedRequest, res) => {
      const agentId = req.authUser?.agentId || 'agent-pk-1';
      const amount = Number(req.body?.amount || 0);
      const salonName = sanitizePlainText(req.body?.salonName, 100) || 'Partner Salon';
      const tid = sanitizePlainText(req.body?.tid, 60) || `CASH-${Date.now()}`;
      const proofHash = sanitizePlainText(req.body?.proofHash, 80) || 'sha256:biometric';
      const coAgentId =
        typeof req.body?.coAgentId === 'string' && req.body.coAgentId.trim()
          ? sanitizePlainText(req.body.coAgentId, 60)
          : undefined;
      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ error: 'Valid positive collection amount is required.' });
      }
      return res.status(201).json(
        recordAgentCashCollection({ agentId, salonName, amount, tid, proofHash, coAgentId })
      );
    }
  );

  app.post(
    '/api/agent/cash/remit',
    requireAuth,
    requireRole('FOUNDER', 'AGENT'),
    (req: AuthenticatedRequest, res) => {
      const agentId = req.authUser?.agentId || 'agent-pk-1';
      const tid = sanitizePlainText(req.body?.tid, 80);
      const amount = Number(req.body?.amount || 0) || undefined;
      if (!tid) {
        return res.status(400).json({ error: 'Bank / Deposit TID reference is required.' });
      }
      return res.json(recordAgentCashRemittance({ agentId, tid, amount }));
    }
  );

  app.get(
    '/api/agent/co-agents',
    requireAuth,
    requireRole('FOUNDER', 'AGENT'),
    (req: AuthenticatedRequest, res) => {
      const agentId = req.authUser?.agentId || 'agent-pk-1';
      return res.json({ coAgents: getFinanceAndAgentSummary(agentId).coAgents });
    }
  );

  app.post(
    '/api/agent/co-agents',
    requireAuth,
    requireRole('FOUNDER', 'AGENT'),
    (req: AuthenticatedRequest, res) => {
      const leadAgentId = req.authUser?.agentId || 'agent-pk-1';
      const leadAgentName = req.authUser?.displayName || 'Lead Field Agent';
      const name = sanitizePlainText(req.body?.name, 80);
      const phone = sanitizePhone(req.body?.phone);
      const city = sanitizePlainText(req.body?.city, 100) || 'Assigned Territory';
      const splitPct = Number(req.body?.splitPctOfAgentShare || 50);
      if (!name || !phone) {
        return res.status(400).json({ error: 'Co-Agent name and WhatsApp phone are required.' });
      }
      const created = createCoAgentRecord({
        leadAgentId,
        leadAgentName,
        name,
        phone,
        city,
        splitPctOfAgentShare: splitPct,
      });
      return res.status(201).json({ coAgent: created });
    }
  );

  app.post(
    '/api/agent/co-agents/:coAgentId/handoff',
    requireAuth,
    requireRole('FOUNDER', 'AGENT'),
    (req: AuthenticatedRequest, res) => {
      const leadAgentId = req.authUser?.agentId || 'agent-pk-1';
      const coAgentId = sanitizePlainText(req.params.coAgentId, 60);
      const referenceTid = sanitizePlainText(req.body?.referenceTid, 60) || `HO-${Date.now()}`;
      const outcome = recordCoAgentCashHandoff({ leadAgentId, coAgentId, referenceTid });
      if (!outcome) {
        return res.status(404).json({ error: 'Co-Agent record not found.' });
      }
      return res.json(outcome);
    }
  );

  app.get('/api/founder/settings', requireAuth, requireRole('FOUNDER'), (_req, res) => {
    return res.json(getFounderSettings());
  });

  app.put('/api/founder/settings/report-phone', requireAuth, requireRole('FOUNDER'), (req, res) => {
    const phone = typeof req.body?.phone === 'string' ? req.body.phone : '';
    const updated = updateFounderReportPhone(phone);
    if (!updated) {
      return res.status(400).json({ error: 'Valid report phone number is required.' });
    }
    return res.json(updated);
  });

  app.post('/api/founder/broadcast', requireAuth, requireRole('FOUNDER'), (req, res) => {
    const title = sanitizePlainText(req.body?.title, 160);
    const messageEn = sanitizePlainText(req.body?.messageEn, 800);
    const regionFilter = sanitizePlainText(req.body?.regionFilter, 20) || 'ALL';
    const tierFilter = sanitizePlainText(req.body?.tierFilter, 20) || 'ALL';
    const recipientCount = Number(req.body?.recipientCount || 24);
    if (!title || !messageEn) {
      return res.status(400).json({ error: 'Broadcast title and message are required.' });
    }
    const entry = recordFounderBroadcastDispatch({
      title,
      messageEn,
      regionFilter,
      tierFilter,
      recipientCount,
    });
    return res.status(201).json({ entry });
  });

  app.get('/api/founder/pairing-qr', requireAuth, requireRole('FOUNDER'), async (req, res) => {
    try {
      const rotate = req.query.rotate === '1';
      const settings = rotate ? rotateFounderPairingKey() : getFounderSettings();
      const host = String(req.header('host') || 'workcraft-app.vercel.app');
      const proto = req.header('x-forwarded-proto') || (req.secure ? 'https' : 'http');
      const qrPayload = `${proto}://${host}/?pair_key=${encodeURIComponent(settings.pairingKey)}`;
      const qrDataUrl = await QRCode.toDataURL(qrPayload, {
        width: 240,
        margin: 1,
        color: { dark: '#0D1117', light: '#FFFFFF' },
      });
      return res.json({
        pairingKey: settings.pairingKey,
        pairingUpdatedAt: settings.pairingUpdatedAt,
        qrPayload,
        qrDataUrl,
      });
    } catch {
      return res.status(500).json({ error: 'Could not generate pairing QR.' });
    }
  });

  // Scheduled Daily Autonomous Cron Handler (Vercel Cron Authorization or Webhook Secret)
  app.get('/api/cron/daily-maintenance', (req, res) => {
    const cronSecret = (process.env.CRON_SECRET || '').trim();
    const authHeader = req.header('authorization') || '';
    const webhookHeader = req.header('x-workcraft-webhook-secret') || '';
    const validCron =
      (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
      (process.env.WORKCRAFT_WEBHOOK_SECRET &&
        webhookHeader === process.env.WORKCRAFT_WEBHOOK_SECRET);
    if (process.env.VERCEL && !validCron && (cronSecret || process.env.WORKCRAFT_WEBHOOK_SECRET)) {
      return res.status(401).json({ error: 'Unauthorized cron trigger.' });
    }
    const usage = sweepExpiredVoiceBlobs();
    const dealsSweep = runDealExpiryAndVideoRetentionCron();
    return res.json({
      ok: true,
      sweptAt: usage.lastCleanupAt,
      purgedClipCount: usage.purgedCount,
      expiredDealsCount: dealsSweep.expiredDealsCount,
      purgedDealVideoCount: dealsSweep.purgedVideosCount,
    });
  });

  // ===========================================================================
  // WHATSAPP CONCIERGE & RETENTION AUTOMATION ENDPOINTS (TENANT-ISOLATED)
  // ===========================================================================
  app.get(
    '/api/salons/:salonId/concierge-state',
    requireAuth,
    requireSalonTenantAccess(true),
    (req, res) => {
      try {
        const { salonId } = req.params;
        const salonName =
          typeof req.query.salonName === 'string' ? sanitizePlainText(req.query.salonName, 100) : undefined;
        const ownerName =
          typeof req.query.ownerName === 'string' ? sanitizePlainText(req.query.ownerName, 80) : undefined;
        const whatsappPhone =
          typeof req.query.whatsappPhone === 'string' ? sanitizePlainText(req.query.whatsappPhone, 24) : undefined;
        const state = getSalonConciergeState(salonId, { salonName, ownerName, whatsappPhone });
        return res.json(state);
      } catch (err) {
        console.error('Failed to get concierge state:', err);
        return res.status(500).json({ error: 'Failed to load concierge state.' });
      }
    }
  );

  app.put(
    '/api/salons/:salonId/retention-settings',
    requireAuth,
    requireSalonTenantAccess(false),
    (req, res) => {
      try {
        const { salonId } = req.params;
        const updated = updateRetentionSettings(salonId, req.body || {});
        return res.json(updated);
      } catch (err) {
        console.error('Failed to save retention settings:', err);
        return res.status(500).json({ error: 'Failed to save retention settings.' });
      }
    }
  );

  app.post(
    '/api/salons/:salonId/clients',
    requireAuth,
    requireSalonTenantAccess(false),
    (req, res) => {
      try {
        const { salonId } = req.params;
        const { phone, name, birthDate, preferredLanguage } = req.body || {};
        if (!phone || typeof phone !== 'string') {
          return res.status(400).json({ error: 'Client phone is required.' });
        }
        const client = upsertClientProfile(salonId, {
          phone,
          name,
          birthDate,
          preferredLanguage,
        });
        return res.json({ client, state: getSalonConciergeState(salonId) });
      } catch (err) {
        console.error('Failed to upsert client profile:', err);
        return res.status(500).json({ error: 'Failed to save client profile.' });
      }
    }
  );

  app.post(
    '/api/salons/:salonId/appointments/complete',
    requireAuth,
    requireSalonTenantAccess(false),
    (req, res) => {
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
          preferredLanguage,
        } = req.body || {};

        if (!appointmentId || !clientPhone) {
          return res.status(400).json({ error: 'appointmentId and clientPhone are required.' });
        }

        const result = completeAppointmentAndRecordVisit(salonId, {
          appointmentId: String(appointmentId),
          clientName: String(clientName || 'Salon Client'),
          clientPhone: String(clientPhone),
          barberName: String(barberName || 'Master Barber'),
          service: String(service || 'Salon Service'),
          price: Number(price || 0),
          timeSlot: String(timeSlot || 'Completed'),
          birthDate: typeof birthDate === 'string' ? birthDate : undefined,
          preferredLanguage,
        });
        return res.json(result);
      } catch (err) {
        console.error('Failed to complete appointment:', err);
        return res.status(500).json({ error: 'Failed to mark appointment completed.' });
      }
    }
  );

  // Unofficial third-party WhatsApp gateway webhook removed. Only official Meta Cloud API (/api/whatsapp/meta-webhook) is supported when enabled as an optional paid add-on.

  // External Cron Trigger: Protected by x-workcraft-webhook-secret
  app.post('/api/salons/:salonId/cron/run', requireWebhookSecret, (req, res) => {
    try {
      const salonId = sanitizePlainText(req.params.salonId, 60);
      const { job, force, appointmentId } = req.body || {};
      const shouldForce = force !== false;

      let birthdayDispatched = 0;
      let winbackDispatched = 0;
      let reviewDispatched = 0;
      let quarantinedCount = 0;

      if (job === 'birthday_9am' || job === 'all' || !job) {
        const b = runBirthdayCron(salonId, shouldForce);
        birthdayDispatched = b.dispatchedCount;
        quarantinedCount += b.quarantinedCount;
      }
      if (job === 'winback_30d' || job === 'all' || !job) {
        const w = runWinBackCron(salonId, shouldForce);
        winbackDispatched = w.dispatchedCount;
        quarantinedCount += w.quarantinedCount;
      }
      if (job === 'review_t2h' || job === 'all' || !job) {
        reviewDispatched = runPostServiceReviewCron(
          salonId,
          shouldForce,
          typeof appointmentId === 'string' ? sanitizePlainText(appointmentId, 60) : undefined
        ).dispatchedCount;
      }

      return res.json({
        birthdayDispatched,
        winbackDispatched,
        reviewDispatched,
        quarantinedCount,
        state: getSalonConciergeState(salonId),
      });
    } catch (err) {
      console.error('Cron run error:', err);
      return res.status(500).json({ error: 'Cron execution failed.' });
    }
  });

  // Authenticated In-App Concierge Simulator & Manual Cron Proxy (zero webhook secret in browser JS)
  app.post(
    '/api/salons/:salonId/concierge/simulate',
    requireAuth,
    requireSalonTenantAccess(false),
    (req, res) => {
      try {
        const { salonId } = req.params;
        const { fromPhone, messageText, clientName, appointmentIdForReview, forceLanguagePrompt } =
          req.body || {};
        if (!fromPhone || typeof messageText !== 'string') {
          return res.status(400).json({ error: 'fromPhone and messageText are required.' });
        }
        const outcome = processWhatsAppWebhook({
          salonId,
          fromPhone: sanitizePlainText(String(fromPhone), 24),
          messageText: sanitizePlainText(messageText, 500),
          clientName: typeof clientName === 'string' ? sanitizePlainText(clientName, 80) : undefined,
          appointmentIdForReview:
            typeof appointmentIdForReview === 'string'
              ? sanitizePlainText(appointmentIdForReview, 60)
              : undefined,
          forceLanguagePrompt: Boolean(forceLanguagePrompt),
        });
        return res.json(outcome);
      } catch (err) {
        console.error('Authenticated concierge simulation error:', err);
        return res.status(500).json({ error: 'Simulation failed.' });
      }
    }
  );

  // ===========================================================================
  // WEB-FIRST PUBLIC CUSTOMER BOOKING, RETURNING TOKEN/COOKIE, DEALS & /b/:token
  // Strictly keyed by unguessable public `salonCode` (raw numeric IDs return 404).
  // ===========================================================================
  app.get('/api/public/salons/:salonCode/customer-experience', async (req, res) => {
    try {
      const ipKey = extractClientIpKey(req.header('x-forwarded-for'), req.ip);
      const rl = await enforceRateLimit(`pub:cx:${ipKey}`, 120, 60);
      if (!rl.allowed) {
        return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
      }

      const salonCode = sanitizePlainText(req.params.salonCode, 60);
      const salonId = await resolveSalonIdByPublicCodeAsync(salonCode);
      if (!salonId) {
        return res.status(404).json({ error: 'Salon booking link not found.' });
      }

      const queryToken = typeof req.query.c === 'string' ? req.query.c.trim() : '';
      const cookies = parseCookieHeader(req.header('cookie'));
      const cookieToken = cookies[getCustomerCookieName(salonCode)] || '';
      const activeToken = queryToken || cookieToken || undefined;

      // Refresh HttpOnly cookie when client arrives weeks later via their saved personal ?c= link
      if (queryToken) {
        const verified = verifyCustomerRecognizeToken(queryToken, salonId);
        if (verified) {
          setCustomerBrowserCookie(res, salonCode, queryToken, req);
        }
      }

      const rawLang = typeof req.query.lang === 'string' ? req.query.lang : undefined;
      const lang =
        rawLang === 'en' || rawLang === 'roman_ur' || rawLang === 'ur' || rawLang === 'ar'
          ? rawLang
          : undefined;
      const config = getCustomerExperienceConfig(salonId, activeToken, lang);
      return res.json(config);
    } catch (err) {
      console.error('Customer experience config error:', err);
      return res.status(500).json({ error: 'Failed to load salon experience.' });
    }
  });

  // First-time QR onboarding: saves Name + Phone + opt-in, sets HttpOnly cookie & returns signed WhatsApp share link
  app.post('/api/public/salons/:salonCode/client-profile', async (req, res) => {
    try {
      const ipKey = extractClientIpKey(req.header('x-forwarded-for'), req.ip);
      const rl = await enforceRateLimit(`pub:profile:${ipKey}`, 30, 60);
      if (!rl.allowed) {
        return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
      }

      const salonCode = sanitizePlainText(req.params.salonCode, 60);
      await resolveSalonIdByPublicCodeAsync(salonCode);
      const body = req.body || {};
      const preferredLanguage =
        body.preferredLanguage === 'en' ||
        body.preferredLanguage === 'roman_ur' ||
        body.preferredLanguage === 'ur' ||
        body.preferredLanguage === 'ar'
          ? body.preferredLanguage
          : undefined;

      const saved = saveFirstTimeClientProfile(salonCode, {
        name: String(body.name || ''),
        phone: String(body.phone || ''),
        preferredLanguage,
        marketingOptIn: Boolean(body.marketingOptIn),
      });
      if (!saved.ok) {
        return res.status(saved.statusCode).json({ ok: false, error: saved.error });
      }
      setCustomerBrowserCookie(res, saved.publicCode, saved.cookieToken, req);
      return res.status(201).json({
        ok: true,
        publicCode: saved.publicCode,
        personalReturningShareUrl: saved.personalReturningShareUrl,
        returningClient: saved.returningClient,
      });
    } catch (err) {
      console.error('Save first-time client profile error:', err);
      return res.status(500).json({ ok: false, error: 'Could not save client details.' });
    }
  });

  app.post('/api/public/salons/:salonCode/customer-message', async (req, res) => {
    try {
      const ipKey = extractClientIpKey(req.header('x-forwarded-for'), req.ip);
      const rl = await enforceRateLimit(`pub:msg:${ipKey}`, 60, 60);
      if (!rl.allowed) {
        return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
      }

      const salonCode = sanitizePlainText(req.params.salonCode, 60);
      const salonId = await resolveSalonIdByPublicCodeAsync(salonCode);
      if (!salonId) {
        return res.status(404).json({ error: 'Salon booking link not found.' });
      }

      const body = req.body || {};
      const preferredLang =
        body.preferredLang === 'en' ||
        body.preferredLang === 'roman_ur' ||
        body.preferredLang === 'ur' ||
        body.preferredLang === 'ar'
          ? body.preferredLang
          : undefined;
      const actionId =
        body.actionId === 'WELCOME' ||
        body.actionId === 'BOOK_APPOINTMENT' ||
        body.actionId === 'SERVICES_PRICES' ||
        body.actionId === 'HOURS_LOCATION' ||
        body.actionId === 'CURRENT_DEALS'
          ? body.actionId
          : undefined;

      const outcome = handleCustomerWhatsAppAction({
        salonId,
        fromPhone: typeof body.fromPhone === 'string' ? body.fromPhone : undefined,
        messageText: typeof body.messageText === 'string' ? body.messageText : 'Hi',
        actionId,
        preferredLang,
        clientName: typeof body.clientName === 'string' ? body.clientName : undefined,
        isDemo: body.isDemo !== false,
      });
      return res.json(outcome);
    } catch (err) {
      console.error('Customer message handler error:', err);
      return res.status(500).json({ error: 'Failed to handle customer message.' });
    }
  });

  app.get('/api/public/salons/:salonCode/availability', async (req, res) => {
    try {
      const ipKey = extractClientIpKey(req.header('x-forwarded-for'), req.ip);
      const rl = await enforceRateLimit(`pub:avail:${ipKey}`, 120, 60);
      if (!rl.allowed) {
        return res.status(429).json({ error: 'Too many availability requests. Please wait a moment.' });
      }

      const salonCode = sanitizePlainText(req.params.salonCode, 60);
      const salonId = await resolveSalonIdByPublicCodeAsync(salonCode);
      if (!salonId) {
        return res.status(404).json({ error: 'Salon booking link not found.' });
      }

      const date = typeof req.query.date === 'string' ? req.query.date : '';
      const durationMins = Number(req.query.durationMins || 40);
      const serviceIdsRaw = typeof req.query.serviceIds === 'string' ? req.query.serviceIds : '';
      const serviceIds = serviceIdsRaw
        ? serviceIdsRaw.split(',').map((s) => sanitizePlainText(s, 60)).filter(Boolean)
        : undefined;
      const isDemo = req.query.isDemo === 'true' || req.query.isDemo === '1';
      const demoBusyBarber =
        isDemo && typeof req.query.demoBusyBarber === 'string'
          ? req.query.demoBusyBarber
          : undefined;
      const demoBusyTimeSlot =
        isDemo && typeof req.query.demoBusyTimeSlot === 'string'
          ? req.query.demoBusyTimeSlot
          : undefined;

      const availability = getAvailableSlotsAndBarbers({
        salonId,
        date,
        durationMins,
        serviceIds,
        demoBusyBarber,
        demoBusyTimeSlot,
      });
      return res.json(availability);
    } catch (err) {
      console.error('Customer availability error:', err);
      return res.status(500).json({ error: 'Failed to calculate slot availability.' });
    }
  });

  app.post('/api/public/salons/:salonCode/flow/book', async (req, res) => {
    try {
      const ipKey = extractClientIpKey(req.header('x-forwarded-for'), req.ip);
      const rl = await enforceRateLimit(`pub:book:${ipKey}`, 30, 60);
      if (!rl.allowed) {
        return res.status(429).json({
          ok: false,
          error: `Too many booking attempts. Retry after ${rl.retryAfterSec}s.`,
        });
      }

      const salonCode = sanitizePlainText(req.params.salonCode, 60);
      const salonId = await resolveSalonIdByPublicCodeAsync(salonCode);
      if (!salonId) {
        return res.status(404).json({ ok: false, error: 'Salon booking link not found.' });
      }

      const cookies = parseCookieHeader(req.header('cookie'));
      const queryToken = typeof req.query.c === 'string' ? req.query.c.trim() : '';
      const cookieToken = cookies[getCustomerCookieName(salonCode)] || '';
      const claims = verifyCustomerRecognizeToken(queryToken || cookieToken, salonId);

      const result = await createCustomerFlowBooking(salonId, {
        ...(req.body || {}),
        verifiedClientId: claims?.clientId,
      });
      if (result.recognizeCookieToken) {
        setCustomerBrowserCookie(res, salonCode, result.recognizeCookieToken, req);
      }
      return res.status(result.statusCode).json(result.payload);
    } catch (err) {
      console.error('Customer Flow booking error:', err);
      return res.status(500).json({ ok: false, error: 'Failed to submit booking.' });
    }
  });

  app.get('/api/public/salons/:salonCode/deals/:dealId', async (req, res) => {
    try {
      const ipKey = extractClientIpKey(req.header('x-forwarded-for'), req.ip);
      const rl = await enforceRateLimit(`pub:deal:${ipKey}`, 120, 60);
      if (!rl.allowed) {
        return res.status(429).json({ error: 'Too many requests.' });
      }

      const salonCode = sanitizePlainText(req.params.salonCode, 60);
      const dealId = sanitizePlainText(req.params.dealId, 80);
      await resolveSalonIdByPublicCodeAsync(salonCode);
      const payload = getPublicDealPayload(salonCode, dealId);
      if (!payload) {
        return res.status(404).json({ error: 'Deal or salon not found.' });
      }
      return res.json(payload);
    } catch (err) {
      console.error('Public deal load error:', err);
      return res.status(500).json({ error: 'Failed to load deal details.' });
    }
  });

  // Signed Expiring & Revocable "My Booking" Portal (/b/:token)
  app.get('/api/public/bookings/:token', async (req, res) => {
    const ipKey = extractClientIpKey(req.header('x-forwarded-for'), req.ip);
    const rl = await enforceRateLimit(`pub:bget:${ipKey}`, 60, 60);
    if (!rl.allowed) {
      return res.status(429).json({ ok: false, error: 'Too many requests.' });
    }
    const booking = getBookingByAccessToken(req.params.token);
    if (!booking) {
      return res.status(404).json({ ok: false, error: 'Booking link is invalid, expired, or revoked.' });
    }
    return res.json(booking);
  });

  app.post('/api/public/bookings/:token/reschedule', async (req, res) => {
    const ipKey = extractClientIpKey(req.header('x-forwarded-for'), req.ip);
    const rl = await enforceRateLimit(`pub:bmod:${ipKey}`, 20, 60);
    if (!rl.allowed) {
      return res.status(429).json({ ok: false, error: 'Too many requests. Please wait.' });
    }
    const result = rescheduleBookingByAccessToken(req.params.token, req.body || {});
    return res.status(result.statusCode).json(result);
  });

  app.post('/api/public/bookings/:token/cancel', async (req, res) => {
    const ipKey = extractClientIpKey(req.header('x-forwarded-for'), req.ip);
    const rl = await enforceRateLimit(`pub:bcan:${ipKey}`, 20, 60);
    if (!rl.allowed) {
      return res.status(429).json({ ok: false, error: 'Too many requests. Please wait.' });
    }
    const result = cancelBookingByAccessToken(req.params.token, req.body?.reason);
    return res.status(result.statusCode).json(result);
  });

  app.get('/api/public/deal-videos/:fileName', (req, res) => {
    try {
      const info = getDealVideoFileInfo(req.params.fileName);
      if (!info) {
        return res.status(410).json({ error: 'Promotional video has expired and been removed.' });
      }
      const stat = fs.statSync(info.filePath);
      const fileSize = stat.size;
      const range = req.headers.range;
      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        if (Number.isNaN(start) || start >= fileSize) {
          return res.status(416).send('Requested range not satisfiable');
        }
        const safeEnd = Math.min(end, fileSize - 1);
        const chunkSize = safeEnd - start + 1;
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${safeEnd}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize,
          'Content-Type': info.mimeType,
        });
        return fs.createReadStream(info.filePath, { start, end: safeEnd }).pipe(res);
      }
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': info.mimeType,
        'Accept-Ranges': 'bytes',
      });
      return fs.createReadStream(info.filePath).pipe(res);
    } catch (err) {
      console.error('Deal video stream error:', err);
      return res.status(500).json({ error: 'Could not stream promotional video.' });
    }
  });

  // Owner Deal Management & Video Retention Config
  app.get(
    '/api/salons/:salonId/deals',
    requireAuth,
    requireSalonTenantAccess(true),
    (req, res) => {
      const deals = listSalonDeals(req.params.salonId, false);
      return res.json({ deals });
    }
  );

  app.post(
    '/api/salons/:salonId/deals',
    requireAuth,
    requireSalonTenantAccess(false),
    (req, res) => {
      try {
        const { salonId } = req.params;
        const body = req.body || {};
        let videoBuffer: Buffer | undefined;
        if (typeof body.videoBase64 === 'string' && body.videoBase64.trim()) {
          const rawB64 = body.videoBase64.replace(/^data:[^;]+;base64,/, '');
          videoBuffer = Buffer.from(rawB64, 'base64');
          if (videoBuffer.length > 20 * 1024 * 1024) {
            return res.status(400).json({ error: 'Video must be 20 MB or smaller.' });
          }
        }
        const created = createSalonDeal(salonId, {
          title: String(body.title || ''),
          description: typeof body.description === 'string' ? body.description : undefined,
          discountType: body.discountType,
          discountValue: Number(body.discountValue || 15),
          serviceIds: Array.isArray(body.serviceIds) ? body.serviceIds : undefined,
          expiresAt: String(body.expiresAt || ''),
          videoRetentionDaysAfterExpiry:
            body.videoRetentionDaysAfterExpiry !== undefined
              ? Number(body.videoRetentionDaysAfterExpiry)
              : undefined,
          videoBuffer,
          videoMimeType: typeof body.videoMimeType === 'string' ? body.videoMimeType : undefined,
          videoOriginalName:
            typeof body.videoOriginalName === 'string' ? body.videoOriginalName : undefined,
        });
        return res.status(201).json(created);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to create deal.';
        return res.status(400).json({ error: msg });
      }
    }
  );

  app.delete(
    '/api/salons/:salonId/deals/:dealId',
    requireAuth,
    requireSalonTenantAccess(false),
    (req, res) => {
      const state = deleteSalonDeal(req.params.salonId, sanitizePlainText(req.params.dealId, 80));
      return res.json({ ok: true, state });
    }
  );

  // Optional Paid Add-On: Official Meta WhatsApp Cloud API Webhook (strictly disabled unless salon enables add-on + matches phone_number_id)
  app.get('/api/whatsapp/meta-webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    const expectedToken = (process.env.WHATSAPP_VERIFY_TOKEN || '').trim();
    if (mode === 'subscribe' && expectedToken && token === expectedToken) {
      return res.status(200).send(String(challenge || ''));
    }
    return res.status(403).json({
      error: 'Meta WhatsApp webhook verification token mismatch or WHATSAPP_VERIFY_TOKEN not configured.',
    });
  });

  app.post('/api/whatsapp/meta-webhook', async (req, res) => {
    const appSecret = (process.env.WHATSAPP_APP_SECRET || '').trim();
    if (appSecret) {
      const sigHeader = req.header('x-hub-signature-256') || '';
      const rawBody = (req as express.Request & { rawBody?: Buffer }).rawBody;
      if (!rawBody || !sigHeader.startsWith('sha256=')) {
        return res.status(401).json({ error: 'Missing Meta webhook signature.' });
      }
      const expectedSig =
        'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
      if (sigHeader !== expectedSig) {
        return res.status(401).json({ error: 'Invalid Meta webhook signature.' });
      }
    }

    try {
      const entry = req.body?.entry?.[0]?.changes?.[0]?.value;
      const msg = entry?.messages?.[0];
      const contact = entry?.contacts?.[0];
      if (!msg) {
        return res.status(200).json({ ok: true, ignored: true });
      }
      const inboundPhoneNumberId = String(entry?.metadata?.phone_number_id || '').trim();
      const matchedSalonId = findSalonIdByMetaPhoneNumberId(inboundPhoneNumberId);
      if (!matchedSalonId) {
        return res.status(200).json({
          ok: true,
          ignored: true,
          reason: 'whatsapp_addon_disabled_or_unmapped_phone_number_id',
        });
      }

      const fromPhone = String(msg.from || '');
      const textBody =
        msg.text?.body ||
        msg.interactive?.button_reply?.id ||
        msg.interactive?.list_reply?.id ||
        'Hi';
      const outcome = processWhatsAppWebhook({
        salonId: matchedSalonId,
        fromPhone,
        messageText: String(textBody),
        clientName: contact?.profile?.name,
      });

      const accessToken = (process.env.WHATSAPP_ACCESS_TOKEN || '').trim();
      const phoneNumberId =
        inboundPhoneNumberId || (process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim();
      let sentViaMeta = false;
      if (accessToken && phoneNumberId && fromPhone) {
        const metaRes = await fetch(
          `https://graph.facebook.com/v20.0/${encodeURIComponent(phoneNumberId)}/messages`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: fromPhone,
              type: 'text',
              text: { body: outcome.replyText },
            }),
          }
        );
        sentViaMeta = metaRes.ok;
      }

      return res.status(200).json({ ok: true, sentViaMeta, routedAction: outcome.routedAction });
    } catch (err) {
      console.error('Meta WhatsApp webhook processing error:', err);
      return res.status(200).json({ ok: false });
    }
  });

  // Salon Owner Monthly Usage Meter, Stylist Leaves & Booking Status Mutations
  app.get(
    '/api/salons/:salonId/usage-meter',
    requireAuth,
    requireSalonTenantAccess(true),
    (req, res) => {
      return res.json(getMonthlyUsageSnapshot(req.params.salonId));
    }
  );

  app.post(
    '/api/salons/:salonId/stylist-leaves',
    requireAuth,
    requireSalonTenantAccess(false),
    (req, res) => {
      try {
        const state = addStylistLeave(req.params.salonId, req.body || {});
        return res.status(201).json(state);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to save stylist leave.';
        return res.status(400).json({ error: msg });
      }
    }
  );

  app.delete(
    '/api/salons/:salonId/stylist-leaves/:leaveId',
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

  app.post(
    '/api/salons/:salonId/appointments/:bookingId/status',
    requireAuth,
    requireSalonTenantAccess(false),
    (req, res) => {
      const rawStatus = sanitizePlainText(req.body?.status, 24).toUpperCase();
      const nextStatus: 'CONFIRMED' | 'IN_CHAIR' | 'COMPLETED' | 'CANCELED' =
        rawStatus === 'IN_CHAIR'
          ? 'IN_CHAIR'
          : rawStatus === 'COMPLETED'
          ? 'COMPLETED'
          : rawStatus === 'CANCELED'
          ? 'CANCELED'
          : 'CONFIRMED';
      const outcome = updateAppointmentStatus(
        req.params.salonId,
        sanitizePlainText(req.params.bookingId, 60),
        nextStatus
      );
      if (!outcome.ok) {
        return res.status(404).json({ error: outcome.error });
      }
      return res.json(outcome);
    }
  );

  app.post(
    '/api/salons/:salonId/concierge/trigger-cron',
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

        if (job === 'birthday_9am' || job === 'all' || !job) {
          const b = runBirthdayCron(salonId, shouldForce);
          birthdayDispatched = b.dispatchedCount;
          quarantinedCount += b.quarantinedCount;
        }
        if (job === 'winback_30d' || job === 'all' || !job) {
          const w = runWinBackCron(salonId, shouldForce);
          winbackDispatched = w.dispatchedCount;
          quarantinedCount += w.quarantinedCount;
        }
        if (job === 'review_t2h' || job === 'all' || !job) {
          reviewDispatched = runPostServiceReviewCron(
            salonId,
            shouldForce,
            typeof appointmentId === 'string' ? sanitizePlainText(appointmentId, 60) : undefined
          ).dispatchedCount;
        }

        return res.json({
          birthdayDispatched,
          winbackDispatched,
          reviewDispatched,
          quarantinedCount,
          state: getSalonConciergeState(salonId),
        });
      } catch (err) {
        console.error('Manual cron trigger error:', err);
        return res.status(500).json({ error: 'Cron trigger failed.' });
      }
    }
  );

  app.post(
    '/api/salons/:salonId/alerts/:alertId/resolve',
    requireAuth,
    requireSalonTenantAccess(false),
    (req, res) => {
      try {
        const { salonId, alertId } = req.params;
        const state = resolveOwnerAlert(salonId, sanitizePlainText(alertId, 60));
        return res.json(state);
      } catch (err) {
        console.error('Resolve alert error:', err);
        return res.status(500).json({ error: 'Failed to resolve alert.' });
      }
    }
  );

  app.post(
    '/api/salons/:salonId/chair-locks',
    requireAuth,
    requireSalonTenantAccess(false),
    (req, res) => {
      try {
        const { salonId } = req.params;
        const body = req.body || {};
        if (!body.barberName || !body.startTimeSlot || !body.endTimeSlot) {
          return res
            .status(400)
            .json({ error: 'barberName, startTimeSlot, and endTimeSlot are required.' });
        }
        const result = addChairLock(salonId, {
          barberName: String(body.barberName),
          chairLabel: typeof body.chairLabel === 'string' ? body.chairLabel : undefined,
          startTimeSlot: String(body.startTimeSlot),
          endTimeSlot: String(body.endTimeSlot),
          startMinutes: Number(body.startMinutes ?? 0),
          endMinutes: Number(body.endMinutes ?? 30),
          durationMins: Number(body.durationMins ?? 30),
          source: body.source === 'VOICE' ? 'VOICE' : 'QUICK_PILL',
          transcript: typeof body.transcript === 'string' ? body.transcript : undefined,
          barbers: Array.isArray(body.barbers) ? body.barbers : undefined,
        });
        return res.json(result);
      } catch (err) {
        console.error('Add chair lock error:', err);
        return res.status(500).json({ error: 'Failed to create chair lock.' });
      }
    }
  );

  app.delete(
    '/api/salons/:salonId/chair-locks/:lockId',
    requireAuth,
    requireSalonTenantAccess(false),
    (req, res) => {
      try {
        const { salonId, lockId } = req.params;
        const state = removeChairLock(salonId, sanitizePlainText(lockId, 60));
        return res.json(state);
      } catch (err) {
        console.error('Delete chair lock error:', err);
        return res.status(500).json({ error: 'Failed to remove chair lock.' });
      }
    }
  );

  app.put(
    '/api/salons/:salonId/barbers',
    requireAuth,
    requireSalonTenantAccess(false),
    (req, res) => {
      try {
        const { salonId } = req.params;
        const barbers = Array.isArray(req.body?.barbers) ? req.body.barbers : [];
        const state = syncSalonBarbers(salonId, barbers);
        return res.json(state);
      } catch (err) {
        console.error('Sync barbers error:', err);
        return res.status(500).json({ error: 'Failed to sync barbers.' });
      }
    }
  );

  app.post(
    '/api/salons/:salonId/counter-sleep',
    requireAuth,
    requireSalonTenantAccess(false),
    (req, res) => {
      try {
        const { salonId } = req.params;
        const sleeping = Boolean(req.body?.sleeping);
        const state = setCounterSleepState(salonId, sleeping);
        return res.json(state);
      } catch (err) {
        console.error('Counter sleep toggle error:', err);
        return res.status(500).json({ error: 'Failed to update counter sleep state.' });
      }
    }
  );

  // Authoritative 4-Layer Onboarding Payment Verification (Founder / Agent / Self-Serve Salon)
  app.post('/api/onboarding/verify-payment', (req, res) => {
    try {
      const body = req.body || {};
      const packageId = sanitizePlainText(body.packageId, 24) || 'STARTER';
      const currency = sanitizePlainText(body.currency, 8) || 'PKR';
      const amount = Number(body.amount || 0);
      const method = sanitizePlainText(body.method, 80) || 'EasyPaisa';
      const tid = sanitizePlainText(body.tid, 80);
      const salonName = sanitizePlainText(body.salonName, 100) || 'New Partner Salon';

      const verification = verifyAuthoritativeWorkcraftPayment({
        kind: 'SETUP',
        tier: packageId,
        currency,
        submittedAmount: amount,
        method,
        tid,
      });

      if (!verification.ok) {
        return res.status(400).json({ verified: false, error: verification.error });
      }

      const entry = recordSalonFinancialPayment({
        type: 'ONBOARDING_SETUP',
        salonId: 'onboarding',
        salonName,
        amount: verification.verifiedAmount,
        currency: verification.currency,
        method,
        referenceTid: verification.normalizedTid,
        note: `Verified setup settlement (${packageId}) ➔ ${verification.officialDestination}`,
      });

      return res.status(201).json({
        verified: true,
        status: 'paid',
        tid: verification.normalizedTid,
        amount: verification.verifiedAmount,
        currency: verification.currency,
        officialDestination: verification.officialDestination,
        sha256Proof: verification.sha256Proof,
        entry,
      });
    } catch (err) {
      console.error('Onboarding payment verify route error:', err);
      return res.status(500).json({ verified: false, error: 'Failed to verify onboarding payment.' });
    }
  });

  // Persistent Salon Owner Maintenance Settlement & Zero-Loss Package Upgrade
  app.post(
    '/api/salons/:salonId/payments/maintenance',
    requireAuth,
    requireSalonTenantAccess(false),
    (req, res) => {
      try {
        const { salonId } = req.params;
        const body = req.body || {};
        const amount = Number(body.amount || 0);
        const currency = sanitizePlainText(body.currency, 8) || 'PKR';
        const method = sanitizePlainText(body.method, 80) || 'EasyPaisa Webhook';
        const referenceTid = sanitizePlainText(body.tid, 80);
        const packageId = typeof body.packageId === 'string' ? sanitizePlainText(body.packageId, 24) : undefined;

        const verification = verifyAuthoritativeWorkcraftPayment({
          kind: 'MAINTENANCE',
          tier: packageId,
          currency,
          submittedAmount: amount,
          method,
          tid: referenceTid,
          salonId,
        });
        if (!verification.ok) {
          return res.status(400).json({ error: verification.error });
        }

        const current = getSalonConciergeState(salonId);
        const entry = recordSalonFinancialPayment({
          type: 'MAINT_PAYMENT',
          salonId,
          salonName: sanitizePlainText(body.salonName, 100) || current.settings.salonName,
          amount: verification.verifiedAmount,
          currency: verification.currency,
          method,
          referenceTid: verification.normalizedTid,
          note: `Monthly maintenance settled (${verification.normalizedTid}) ➔ ${verification.officialDestination}`,
        });
        const state = setSalonBillingStatus(salonId, 'ACTIVE');
        return res.status(201).json({
          entry,
          state,
          officialDestination: verification.officialDestination,
          sha256Proof: verification.sha256Proof,
        });
      } catch (err) {
        console.error('Maintenance payment route error:', err);
        return res.status(500).json({ error: 'Failed to record maintenance payment.' });
      }
    }
  );

  app.post(
    '/api/salons/:salonId/payments/upgrade',
    requireAuth,
    requireSalonTenantAccess(false),
    (req, res) => {
      try {
        const { salonId } = req.params;
        const body = req.body || {};
        const rawTier = sanitizePlainText(body.packageTier, 20).toUpperCase();
        const packageTier: 'STARTER' | 'PRO' | 'PRO++' =
          rawTier === 'STARTER' ? 'STARTER' : rawTier === 'PRO' || rawTier === 'GROWTH' ? 'PRO' : 'PRO++';
        const targetCatalogTier = sanitizePlainText(body.targetPlanId || rawTier, 24);
        const previousCatalogTier = typeof body.previousPlanId === 'string' ? sanitizePlainText(body.previousPlanId, 24) : undefined;
        const differenceAmount = Number(body.differenceAmount || 0);
        const currency = sanitizePlainText(body.currency, 8) || 'PKR';
        const method = sanitizePlainText(body.method, 80) || 'Digital Settlement';
        const referenceTid = sanitizePlainText(body.tid, 80);

        const verification = verifyAuthoritativeWorkcraftPayment({
          kind: 'UPGRADE',
          tier: targetCatalogTier,
          previousTier: previousCatalogTier,
          currency,
          submittedAmount: differenceAmount,
          method,
          tid: referenceTid,
          salonId,
        });
        if (!verification.ok) {
          return res.status(400).json({ error: verification.error });
        }

        const updatedSettings = updateRetentionSettings(salonId, { packageTier });
        const entry = recordSalonFinancialPayment({
          type: 'PACKAGE_UPGRADE',
          salonId,
          salonName: sanitizePlainText(body.salonName, 100) || updatedSettings.settings.salonName,
          amount: verification.verifiedAmount,
          currency: verification.currency,
          method,
          referenceTid: verification.normalizedTid,
          note: `Zero-loss upgrade to ${targetCatalogTier} (paid: ${verification.currency} ${verification.verifiedAmount}) ➔ ${verification.officialDestination}`,
        });
        return res.status(201).json({
          entry,
          state: updatedSettings,
          officialDestination: verification.officialDestination,
          sha256Proof: verification.sha256Proof,
        });
      } catch (err) {
        console.error('Package upgrade route error:', err);
        return res.status(500).json({ error: 'Failed to persist package upgrade.' });
      }
    }
  );

  // Authoritative Server TID Verification for Video Deal Campaigns (1 Video vs 4 Videos/mo)
  app.post(
    '/api/salons/:salonId/payments/video-deal',
    requireAuth,
    requireSalonTenantAccess(false),
    (req, res) => {
      try {
        const { salonId } = req.params;
        const body = req.body || {};
        const planId =
          String(body.planId || '').toUpperCase() === 'MONTHLY_4' ? 'MONTHLY_4' : 'SINGLE_1';
        const currency = sanitizePlainText(body.currency, 8) || 'PKR';
        const amount = Number(body.amount || 0);
        const method = sanitizePlainText(body.method, 80) || 'EasyPaisa';
        const tid = sanitizePlainText(body.tid, 80);

        const verification = verifyAuthoritativeWorkcraftPayment({
          kind: 'VIDEO_CAMPAIGN',
          tier: planId,
          currency,
          submittedAmount: amount,
          method,
          tid,
          salonId,
        });

        if (!verification.ok) {
          return res.status(400).json({ verified: false, error: verification.error });
        }

        const current = getSalonConciergeState(salonId);
        const entry = recordSalonFinancialPayment({
          type: 'VIDEO_CAMPAIGN',
          salonId,
          salonName: sanitizePlainText(body.salonName, 100) || current.settings.salonName,
          amount: verification.verifiedAmount,
          currency: verification.currency,
          method,
          referenceTid: verification.normalizedTid,
          note: `Video Campaign (${planId}) unlocked (${verification.normalizedTid}) ➔ ${verification.officialDestination}`,
        });

        return res.status(201).json({
          verified: true,
          tid: verification.normalizedTid,
          amount: verification.verifiedAmount,
          currency: verification.currency,
          officialDestination: verification.officialDestination,
          sha256Proof: verification.sha256Proof,
          entry,
        });
      } catch (err) {
        console.error('Video campaign payment verify route error:', err);
        return res.status(500).json({ verified: false, error: 'Failed to verify video campaign TID.' });
      }
    }
  );

  // ===========================================================================
  // LIVE WALK-IN QUEUE, BRIDAL ADVANCE TRACKER & PREPAID SERVICE PACKAGES
  // ===========================================================================
  app.post(
    '/api/salons/:salonId/walkin-queue',
    requireAuth,
    requireSalonTenantAccess(false),
    (req, res) => {
      const { salonId } = req.params;
      const body = req.body || {};
      const clientName = sanitizePlainText(body.clientName, 80);
      if (!clientName) {
        return res.status(400).json({ error: 'Walk-in client name is required.' });
      }
      const state = addWalkInQueueItem(salonId, {
        clientName,
        phone: typeof body.phone === 'string' ? body.phone : '',
        service: typeof body.service === 'string' ? body.service : 'Express Service',
        assignedStaff: typeof body.assignedStaff === 'string' ? body.assignedStaff : undefined,
        etaMinutes: Number(body.etaMinutes || 15),
      });
      return res.status(201).json(state);
    }
  );

  app.patch(
    '/api/salons/:salonId/walkin-queue/:itemId',
    requireAuth,
    requireSalonTenantAccess(false),
    (req, res) => {
      const { salonId, itemId } = req.params;
      const rawStatus = sanitizePlainText(req.body?.status, 20).toUpperCase();
      const status: 'WAITING' | 'NOTIFIED' | 'SEATED' =
        rawStatus === 'SEATED' ? 'SEATED' : rawStatus === 'NOTIFIED' ? 'NOTIFIED' : 'WAITING';
      const state = updateWalkInQueueStatus(salonId, sanitizePlainText(itemId, 60), status);
      return res.json(state);
    }
  );

  app.post(
    '/api/salons/:salonId/bridal-bookings',
    requireAuth,
    requireSalonTenantAccess(false),
    (req, res) => {
      const { salonId } = req.params;
      const body = req.body || {};
      const brideOrEventName = sanitizePlainText(body.brideOrEventName, 100);
      if (!brideOrEventName) {
        return res.status(400).json({ error: 'Bride / Event name is required.' });
      }
      const state = upsertBridalBooking(salonId, {
        brideOrEventName,
        phone: typeof body.phone === 'string' ? body.phone : '',
        packageName: typeof body.packageName === 'string' ? body.packageName : 'Bridal Suite',
        eventDate: typeof body.eventDate === 'string' ? body.eventDate : 'Upcoming Event',
        trialDate: typeof body.trialDate === 'string' ? body.trialDate : undefined,
        totalAmount: Number(body.totalAmount || 25000),
        advancePaid: Number(body.advancePaid || 0),
        assignedStylist: typeof body.assignedStylist === 'string' ? body.assignedStylist : undefined,
        homeService: Boolean(body.homeService),
      });
      return res.status(201).json(state);
    }
  );

  app.post(
    '/api/salons/:salonId/bridal-bookings/:bookingId/settle',
    requireAuth,
    requireSalonTenantAccess(false),
    (req, res) => {
      const { salonId, bookingId } = req.params;
      const state = settleBridalBookingBalance(salonId, sanitizePlainText(bookingId, 60));
      return res.json(state);
    }
  );

  app.post(
    '/api/salons/:salonId/packages',
    requireAuth,
    requireSalonTenantAccess(false),
    (req, res) => {
      const { salonId } = req.params;
      const body = req.body || {};
      const clientName = sanitizePlainText(body.clientName, 80);
      const packageTitle = sanitizePlainText(body.packageTitle, 100);
      if (!clientName || !packageTitle) {
        return res.status(400).json({ error: 'Client name and package title are required.' });
      }
      const state = upsertServicePackage(salonId, {
        clientName,
        phone: typeof body.phone === 'string' ? body.phone : '',
        packageTitle,
        totalSessions: Number(body.totalSessions || 5),
        pricePaid: Number(body.pricePaid || 5000),
      });
      return res.status(201).json(state);
    }
  );

  app.post(
    '/api/salons/:salonId/packages/:pkgId/use-session',
    requireAuth,
    requireSalonTenantAccess(false),
    (req, res) => {
      const { salonId, pkgId } = req.params;
      const state = consumeServicePackageSession(salonId, sanitizePlainText(pkgId, 60));
      return res.json(state);
    }
  );

  // ===========================================================================
  // $0.00 REAL-TIME ERROR TELEMETRY & FOUNDER INCIDENT FEED (ALL 4 ROLES)
  // ===========================================================================
  app.post('/api/telemetry/incident', (req, res) => {
    try {
      const clientKey = sanitizePlainText(
        String(req.header('x-forwarded-for') || req.ip || 'anon').split(',')[0],
        64
      );
      const now = Date.now();
      const bucket = telemetryRateBuckets.get(clientKey);
      if (!bucket || bucket.resetAt < now) {
        telemetryRateBuckets.set(clientKey, { count: 1, resetAt: now + 60_000 });
      } else {
        bucket.count += 1;
        if (bucket.count > 25) {
          return res.status(429).json({ ok: false, error: 'Telemetry throttle limit reached.' });
        }
      }

      const body = req.body || {};
      const message = sanitizePlainText(body.message, 320);
      if (!message) {
        return res.status(400).json({ ok: false, error: 'Incident message is required.' });
      }
      const record = recordIncidentReport({
        role: typeof body.role === 'string' ? body.role : undefined,
        area: typeof body.area === 'string' ? body.area : undefined,
        route: typeof body.route === 'string' ? body.route : undefined,
        severity: typeof body.severity === 'string' ? body.severity : undefined,
        message,
        stackHint: typeof body.stackHint === 'string' ? body.stackHint : undefined,
        resolutionStatus:
          typeof body.resolutionStatus === 'string' ? body.resolutionStatus : undefined,
        recoveryMs: Number(body.recoveryMs || 800),
      });
      return res.status(201).json({ ok: true, incident: record });
    } catch {
      return res.status(500).json({ ok: false, error: 'Failed to log incident.' });
    }
  });

  app.get('/api/founder/incidents', requireAuth, requireRole('FOUNDER'), (req, res) => {
    const limit = Math.max(1, Math.min(80, Number(req.query.limit || 40)));
    return res.json(listIncidentReports(limit));
  });

  app.post(
    '/api/founder/incidents/:incidentId/resolve',
    requireAuth,
    requireRole('FOUNDER'),
    (req, res) => {
      const incident = resolveIncidentReport(sanitizePlainText(req.params.incidentId, 60));
      if (!incident) {
        return res.status(404).json({ error: 'Incident not found.' });
      }
      return res.json({ ok: true, incident, ...listIncidentReports(40) });
    }
  );

  // Global Express Error Boundary -> Captures any unhandled API exception cleanly
  app.use(
    (
      err: unknown,
      req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      const msg = err instanceof Error ? err.message : String(err || 'Unhandled API exception');
      const incident = recordIncidentReport({
        role: 'SYSTEM',
        area: 'Express API Route',
        route: req.originalUrl || req.path || '/api',
        severity: 'CRITICAL',
        resolutionStatus: 'NEEDS_FOUNDER_ACTION',
        message: msg,
        recoveryMs: 45,
      });
      if (!res.headersSent) {
        res.status(500).json({
          error: 'A temporary server glitch was logged and isolated.',
          incidentId: incident.id,
        });
      }
    }
  );

  return app;
}
