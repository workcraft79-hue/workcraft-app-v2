import express from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import QRCode from 'qrcode';
import {
  addChairLock,
  addWalkInQueueItem,
  completeAppointmentAndRecordVisit,
  consumeServicePackageSession,
  getSalonConciergeState,
  hydrateConciergeStoreFromKv,
  listSalonsForAgent,
  processWhatsAppWebhook,
  removeChairLock,
  resolveOwnerAlert,
  runBirthdayCron,
  runPostServiceReviewCron,
  runWinBackCron,
  setCounterSleepState,
  setSalonBillingStatus,
  settleBridalBookingBalance,
  syncSalonBarbers,
  updateRetentionSettings,
  updateWalkInQueueStatus,
  upsertBridalBooking,
  upsertClientProfile,
  upsertServicePackage,
} from './conciergeEngine.js';
import {
  AuthenticatedRequest,
  checkFounderPinAttemptAllowed,
  clearFounderPinFailures,
  clearSessionCookie,
  consumeAgentInviteTokenAndRegisterAgent,
  createAgentInviteToken,
  extractAuthUserFromRequest,
  getFounderSessionUser,
  hydrateSecurityStoreFromKv,
  inspectAgentInviteToken,
  recordFounderPinFailure,
  registerSalonAssignment,
  registerSalonOwnerAccount,
  requireAuth,
  requireRole,
  requireSalonTenantAccess,
  requireWebhookSecret,
  sanitizePhone,
  sanitizePlainText,
  setSessionCookie,
  signSessionToken,
  verifyFounderPin,
} from './security.js';
import { resolveTargetLocale, translateAndSynthesizeVoice } from './voiceTranslator.js';
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
  app.use(express.json({ limit: '4mb' }));

  app.use('/api', async (_req, _res, next) => {
    try {
      await ensureKvHydrated();
    } catch {
      // Non-fatal fallback to local/tmp stores
    }
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      status: 'HEALTHY',
      port,
      runtime: process.env.VERCEL ? 'vercel-node' : 'node',
      kvConfigured: isKvConfigured(),
    });
  });

  // ===========================================================================
  // DIRECT 4-ROLE SESSION, FOUNDER PIN + MOBILE BIOMETRIC (WEBAUTHN)
  // Zero PIN walls & zero IP rate limits for Salons, Agents, or End-Users
  // ===========================================================================
  app.get('/api/auth/session', (req, res) => {
    const user = extractAuthUserFromRequest(req);
    if (!user) {
      return res.json({ authenticated: false, user: null });
    }
    return res.json({ authenticated: true, user });
  });

  // Founder PIN Gate (WC3118) — isolated strictly to Founder Command Center access
  app.post('/api/auth/founder-session', (req, res) => {
    const existing = extractAuthUserFromRequest(req);
    if (existing?.userRole === 'FOUNDER') {
      const token = signSessionToken(existing);
      setSessionCookie(res, token, req);
      return res.json({ authenticated: true, user: existing });
    }

    const clientKey = sanitizePlainText(
      String(req.header('x-forwarded-for') || req.ip || 'founder-client').split(',')[0],
      64
    );
    const attemptGate = checkFounderPinAttemptAllowed(clientKey);
    if (!attemptGate.allowed) {
      return res.status(429).json({
        error: `Too many incorrect Founder PIN attempts. Wait ${attemptGate.retryAfterSec}s before trying again.`,
      });
    }

    const pin = typeof req.body?.pin === 'string' ? req.body.pin : '';
    if (!verifyFounderPin(pin)) {
      recordFounderPinFailure(clientKey);
      return res.status(401).json({
        error: 'Invalid Founder PIN. Enter your 6-character Founder PIN (e.g., WC3118).',
      });
    }

    clearFounderPinFailures(clientKey);
    const founder = getFounderSessionUser();
    const token = signSessionToken(founder);
    setSessionCookie(res, token, req);
    return res.json({ authenticated: true, user: founder });
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

  // Unlimited Multi-Branch Public Salon Self-Onboarding (Zero IP Limits · Honeypot Protected)
  // Assigns billing_status = 'PENDING_ACTIVATION' & immediately opens Live Salon Dashboard
  app.post('/api/onboarding/complete', (req, res) => {
    try {
      // Invisible CSS Honeypot: silently drop automated bot spam with zero friction to real users
      const honeypot =
        (typeof req.body?.websiteUrl === 'string' && req.body.websiteUrl.trim()) ||
        (typeof req.body?.companyFax === 'string' && req.body.companyFax.trim());
      if (honeypot) {
        return res.status(200).json({ ok: true, ignored: true });
      }

      const salonName = sanitizePlainText(req.body?.salonName, 100);
      const ownerName = sanitizePlainText(req.body?.ownerName, 80) || 'Salon Owner';
      const whatsappPhone = sanitizePhone(req.body?.phone);
      const rawPlanId = sanitizePlainText(req.body?.planId, 20).toUpperCase();
      const packageTier: 'STARTER' | 'PRO' | 'PRO++' =
        rawPlanId === 'STARTER' ? 'STARTER' : rawPlanId === 'GROWTH' || rawPlanId === 'PRO' ? 'PRO' : 'PRO++';
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
        return res.status(400).json({ error: 'Salon name and WhatsApp phone number are required.' });
      }

      const newSalonId = `salon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
      // Enforce strictly ONE unique WhatsApp number per salon branch
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
            'Each salon branch requires its own unique WhatsApp number. That WhatsApp number is already bound to an active branch.',
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
        whatsappPhone,
        packageTier,
        salonCategory,
        enabledServices,
      });
      if (barbers.length > 0) {
        syncSalonBarbers(newSalonId, barbers);
      }

      const finalState = getSalonConciergeState(newSalonId);
      // Directly issue verified, tenant-locked SALON_OWNER session cookie (Zero PIN walls)
      const token = signSessionToken(reg.user);
      setSessionCookie(res, token, req);

      return res.status(201).json({
        authenticated: true,
        user: reg.user,
        salonId: newSalonId,
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
        // Derive senderRole strictly from verified session cookie (prevents role spoofing)
        const senderRole: 'FOUNDER' | 'SALON_OWNER' =
          authUser.userRole === 'FOUNDER' ? 'FOUNDER' : 'SALON_OWNER';

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
    return res.json({ ok: true, sweptAt: usage.lastCleanupAt, purgedClipCount: usage.purgedCount });
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

  // External WhatsApp Gateway Webhook: Protected by x-workcraft-webhook-secret (Zero IP rate limits)
  app.post('/api/whatsapp/webhook', requireWebhookSecret, (req, res) => {
    try {
      const { salonId, fromPhone, messageText, clientName, appointmentIdForReview, forceLanguagePrompt } =
        req.body || {};
      if (!salonId || !fromPhone || typeof messageText !== 'string') {
        return res.status(400).json({ error: 'salonId, fromPhone, and messageText are required.' });
      }
      const outcome = processWhatsAppWebhook({
        salonId: sanitizePlainText(String(salonId), 60),
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
      console.error('WhatsApp webhook error:', err);
      return res.status(500).json({ error: 'Webhook processing failed.' });
    }
  });

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
