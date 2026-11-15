import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import {
  addChairLock,
  completeAppointmentAndRecordVisit,
  getSalonConciergeState,
  listSalonsForAgent,
  processWhatsAppWebhook,
  removeChairLock,
  resolveOwnerAlert,
  runBirthdayCron,
  runPostServiceReviewCron,
  runWinBackCron,
  setCounterSleepState,
  startConciergeSchedulers,
  syncSalonBarbers,
  updateRetentionSettings,
  upsertClientProfile,
} from './server/conciergeEngine';
import {
  AuthenticatedRequest,
  clearSessionCookie,
  createOtpChallenge,
  createWebhookRateLimiter,
  extractAuthUserFromRequest,
  findUserById,
  getDevTestAccounts,
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
  verifyOtpChallenge,
} from './server/security';

const PORT = Number(process.env.PORT || 3000);

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
const app = express();

async function startServer() {
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  const webhookRateLimiter = createWebhookRateLimiter({
    windowMs: 60_000,
    maxPerPhone: 15,
    maxPerIp: 60,
  });

  // ===========================================================================
  // AUTHENTICATION & SESSION MANAGEMENT (JWT HttpOnly Cookie + OTP Flow)
  // ===========================================================================
  app.get('/api/auth/session', (req, res) => {
    const user = extractAuthUserFromRequest(req);
    if (!user) {
      return res.json({ authenticated: false, user: null });
    }
    return res.json({ authenticated: true, user });
  });

  app.post('/api/auth/request-otp', (req, res) => {
    const identifier = sanitizePlainText(req.body?.identifier, 120);
    if (!identifier) {
      return res.status(400).json({ error: 'Email or WhatsApp phone number is required.' });
    }
    const result = createOtpChallenge(identifier);
    if (!result.ok) {
      return res.status(404).json({ error: result.error });
    }
    return res.json({
      ok: true,
      maskedTarget: result.maskedTarget,
      displayName: result.user.displayName,
      userRole: result.user.userRole,
      ...(result.devOtpPreview ? { devOtpPreview: result.devOtpPreview } : {}),
    });
  });

  app.post('/api/auth/verify-otp', (req, res) => {
    const identifier = sanitizePlainText(req.body?.identifier, 120);
    const otp = sanitizePlainText(req.body?.otp, 12);
    if (!identifier || !otp) {
      return res.status(400).json({ error: 'Identifier and 6-digit OTP code are required.' });
    }
    const verified = verifyOtpChallenge(identifier, otp);
    if (!verified.ok) {
      return res.status(401).json({ error: verified.error });
    }
    const token = signSessionToken(verified.user);
    setSessionCookie(res, token, req);
    return res.json({ authenticated: true, user: verified.user });
  });

  app.post('/api/auth/logout', (_req, res) => {
    clearSessionCookie(res);
    return res.json({ ok: true });
  });

  // Strict Development-Only Quick Switch Test Account Endpoints
  app.get('/api/auth/dev-accounts', (_req, res) => {
    if (process.env.NODE_ENV !== 'development') {
      return res.status(404).json({ error: 'Not found.' });
    }
    return res.json({ accounts: getDevTestAccounts() });
  });

  app.post('/api/auth/dev-login', (req, res) => {
    if (process.env.NODE_ENV !== 'development') {
      return res.status(403).json({ error: 'Dev account switching is disabled in production.' });
    }
    const userId = sanitizePlainText(req.body?.userId, 60);
    const found = findUserById(userId);
    if (!found) {
      return res.status(404).json({ error: 'Test account not found.' });
    }
    const user = {
      userId: found.userId,
      userRole: found.userRole,
      displayName: found.displayName,
      email: found.email,
      phone: found.phone,
      salonId: found.salonId,
      agentId: found.agentId,
      salonName: found.salonName,
    };
    const token = signSessionToken(user);
    setSessionCookie(res, token, req);
    return res.json({ authenticated: true, user });
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
    const newId = `salon-${Date.now().toString(36)}`;
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
    const state = getSalonConciergeState(newId, { salonName, ownerName, whatsappPhone });
    return res.status(201).json({ salonId: newId, state });
  });

  // Zero-Privilege Public Self-Onboarding Completion -> Triggers Mandatory Post-Install OTP Check
  const onboardingRateLimiter = createWebhookRateLimiter({
    windowMs: 60_000,
    maxPerPhone: 5,
    maxPerIp: 20,
  });

  app.post('/api/onboarding/complete', onboardingRateLimiter, (req, res) => {
    try {
      const salonName = sanitizePlainText(req.body?.salonName, 100);
      const ownerName = sanitizePlainText(req.body?.ownerName, 80) || 'Salon Owner';
      const whatsappPhone = sanitizePhone(req.body?.phone);
      const rawPlanId = sanitizePlainText(req.body?.planId, 20).toUpperCase();
      const packageTier: 'STARTER' | 'PRO' | 'PRO++' =
        rawPlanId === 'STARTER' ? 'STARTER' : rawPlanId === 'GROWTH' || rawPlanId === 'PRO' ? 'PRO' : 'PRO++';
      const barbers = Array.isArray(req.body?.barbers)
        ? req.body.barbers.map((b: unknown) => sanitizePlainText(b, 60)).filter(Boolean)
        : [];

      if (!salonName || !whatsappPhone) {
        return res.status(400).json({ error: 'Salon name and WhatsApp phone number are required.' });
      }

      const newSalonId = `salon-${Date.now().toString(36)}`;
      const reg = registerSalonOwnerAccount({
        salonId: newSalonId,
        salonName,
        ownerName,
        phone: whatsappPhone,
        agentId: null,
      });

      if (!reg.ok) {
        return res.status(409).json({ error: reg.error });
      }

      getSalonConciergeState(newSalonId, { salonName, ownerName, whatsappPhone });
      updateRetentionSettings(newSalonId, {
        salonName,
        ownerName,
        whatsappPhone,
        packageTier,
      });
      if (barbers.length > 0) {
        syncSalonBarbers(newSalonId, barbers);
      }

      // Immediately issue a 6-digit OTP challenge for Post-Installation Security Verification
      // (Never sets wc_session cookie until OTP is explicitly verified)
      const challenge = createOtpChallenge(whatsappPhone);
      if (!challenge.ok) {
        return res.status(500).json({ error: 'Could not issue post-install verification OTP.' });
      }

      return res.status(201).json({
        salonId: newSalonId,
        salonName,
        ownerName,
        phone: whatsappPhone,
        maskedTarget: challenge.maskedTarget,
        ...(challenge.devOtpPreview ? { devOtpPreview: challenge.devOtpPreview } : {}),
      });
    } catch (err) {
      console.error('Public onboarding completion error:', err);
      return res.status(500).json({ error: 'Could not complete salon setup.' });
    }
  });

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

      // If input is not English or target is English and input is already English, still supply clean translations
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
      const rawText = sanitizePlainText(req.body?.text, 800);
      const targetDialect =
        sanitizePlainText(req.body?.targetDialect, 60) || 'Roman Urdu (Lahori)';

      if (!rawText) {
        return res.status(400).json({ error: 'Message text is required.' });
      }

      const detectedLanguage = detectInputLanguage(rawText);

      // Deterministic local phrase fallback for common Founder voice notes
      const buildVoiceFallback = (input: string, dialect: string): string => {
        const lower = input.toLowerCase();
        const isApproval =
          lower.includes('approved') ||
          lower.includes('verify') ||
          lower.includes('verified') ||
          lower.includes('scheduled') ||
          lower.includes('منظور') ||
          lower.includes('موافق');
        const isRateReply =
          lower.includes('rate') ||
          lower.includes('price') ||
          lower.includes('package') ||
          lower.includes('discount') ||
          lower.includes('ریٹ') ||
          lower.includes('سعر');
        const isWaitReply =
          lower.includes('wait') ||
          lower.includes('soon') ||
          lower.includes('checking') ||
          lower.includes('minutes') ||
          lower.includes('انتظار') ||
          lower.includes('دقائق');

        if (dialect.includes('Gulf Arabic')) {
          if (isApproval && lower.includes('58')) {
            return 'تمت مراجعة فيديو العرض الترويجي الخاص بك بنجاح، ومدته 58 ثانية وتمت الموافقة عليه وجدولته للغد صباحاً.';
          }
          if (isApproval) {
            return `أهلاً بك، تمت مراجعة رسالتك والموافقة على طلبك وجدولته تلقائياً عبر نظام WorkCraft: ${input}`;
          }
          if (isRateReply) {
            return `تم تحديث قائمة الأسعار والباقات في حساب صالونك بنجاح وجاهزة للحجز التلقائي الآن.`;
          }
          if (isWaitReply) {
            return `شكراً لتواصلك، نقوم بمراجعة طلبك الآن وسنرسل لك التأكيد خلال دقائق.`;
          }
          return detectedLanguage === 'ar'
            ? input
            : `رسالة من الإدارة إلى صالونك: ${input}`;
        }

        if (dialect.includes('Standard Urdu')) {
          if (isApproval && lower.includes('58')) {
            return 'آپ کی ویڈیو ڈیل کی توثیق مکمل ہو چکی ہے، 58 سیکنڈ دورانیہ درست ہے اور کل صبح کا براڈکاسٹ شیڈول منظور کر لیا گیا ہے۔';
          }
          if (isApproval) {
            return `السلام علیکم، آپ کا پیغام اور ویڈیو ڈیل سسٹم میں منظور کر لی گئی ہے اور شیڈول کر دی گئی ہے: ${input}`;
          }
          if (isRateReply) {
            return 'جی، آپ کے سیلون کی سروسز اور پیکیج ریٹس سسٹم میں کامیابی سے اپڈیٹ کر دیے گئے ہیں۔';
          }
          if (isWaitReply) {
            return 'شکریہ، آپ کی درخواست چیک کی جا رہی ہے، جلد ہی آپ کو کنفرمیشن مل جائے گی۔';
          }
          return detectedLanguage === 'ur' ? input : `ورک کرافٹ ایڈمن پیغام: ${input}`;
        }

        if (dialect.includes('Lahori Punjabi')) {
          if (isApproval && lower.includes('58')) {
            return 'Tuhada video deal check ho gaya ae, 58 second da pura fit ae te approve ho gaya. Kal sawere broadcast chal pyega.';
          }
          if (isApproval) {
            return `Assalamu Alaikum! Tuhada paigham mil gaya ae te system vich approve ho gaya: ${input}`;
          }
          if (isRateReply) {
            return 'Ji haan, tuhade salon de naye package te rate list system vich update ho gaye ne.';
          }
          if (isWaitReply) {
            return 'Bas thori der wait karo ji, asaan tuhada kam check kar rahe haan.';
          }
          return `WorkCraft Paigham: ${input}`;
        }

        if (dialect.includes('English')) {
          return input;
        }

        // Roman Urdu (Lahori) default
        if (isApproval && lower.includes('58')) {
          return 'Aap ka video deal check ho gaya hai, bilkul 58 seconds ka hai aur approve kar diya hai. Kal subah broadcast schedule ho jayega.';
        }
        if (isApproval) {
          return `Salam! Aap ka message aur request verify kar ke approve kar di gayi hai: ${input}`;
        }
        if (isRateReply) {
          return 'Ji, aap ke salon ke updated package aur service rates system mein save ho gaye hain.';
        }
        if (isWaitReply) {
          return 'Shukriya, hum aap ki request check kar rahe hain aur thori der mein confirm kar dein gay.';
        }
        return `Assalamu Alaikum! ${input}`;
      };

      const fallbackTranslated = buildVoiceFallback(rawText, targetDialect);
      const apiKey = process.env.GEMINI_API_KEY;

      if (apiKey && apiKey.trim().length > 0) {
        try {
          const ai = new GoogleGenAI({
            apiKey: apiKey.trim(),
            httpOptions: {
              headers: {
                'User-Agent': 'aistudio-build',
              },
            },
          });

          const dialectInstruction =
            targetDialect.includes('Roman Urdu')
              ? 'Natural conversational Pakistani Roman Urdu using Latin script (as spoken in Lahore/Karachi).'
              : targetDialect.includes('Standard Urdu')
              ? 'Natural polite Pakistani Urdu in Urdu script (اردو).'
              : targetDialect.includes('Lahori Punjabi')
              ? 'Friendly respectful Lahori Punjabi in Roman/Latin script.'
              : targetDialect.includes('Gulf Arabic')
              ? 'Natural polite Gulf Arabic in Arabic script (العربية).'
              : 'Clear natural English.';

          const response = await ai.models.generateContent({
            model: 'gemini-4-hydrogen',
            contents: `You are translating a short voice/text reply from a salon software Founder to a salon owner. Detect whatever language the input is written in (English, Urdu, Roman Urdu, Arabic, Punjabi, etc.) and translate its exact meaning faithfully into: ${dialectInstruction}\n\nKeep the tone warm, concise, and professional.\nInput message: "${rawText}"`,
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  translatedText: {
                    type: Type.STRING,
                    description: 'The faithful, natural translation in the requested target dialect.',
                  },
                  detectedSourceLanguage: {
                    type: Type.STRING,
                    description: 'Short label of the detected input language, e.g. English, Urdu, Arabic, Roman Urdu.',
                  },
                },
                required: ['translatedText', 'detectedSourceLanguage'],
              },
            },
          });

          const parsed = JSON.parse((response.text ?? '{}').trim()) as {
            translatedText?: string;
            detectedSourceLanguage?: string;
          };

          if (parsed.translatedText && parsed.translatedText.trim()) {
            return res.json({
              detectedInputLanguage: parsed.detectedSourceLanguage?.trim() || detectedLanguage.toUpperCase(),
              targetDialect,
              translatedText: parsed.translatedText.trim(),
              source: 'gemini',
            });
          }
        } catch (aiErr) {
          console.warn('Gemini voice translation fallback triggered:', aiErr);
        }
      }

      return res.json({
        detectedInputLanguage:
          detectedLanguage === 'ur' ? 'Urdu' : detectedLanguage === 'ar' ? 'Arabic' : 'English / Auto',
        targetDialect,
        translatedText: fallbackTranslated,
        source: 'fallback',
      });
    } catch (err) {
      console.error('Voice translation route error:', err);
      return res.status(500).json({ error: 'Voice translation failed.' });
    }
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

  // External WhatsApp Gateway Webhook: Protected by x-workcraft-webhook-secret + Per-Number Rate Limiter
  app.post('/api/whatsapp/webhook', requireWebhookSecret, webhookRateLimiter, (req, res) => {
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

      if (job === 'birthday_9am' || job === 'all' || !job) {
        birthdayDispatched = runBirthdayCron(salonId, shouldForce).dispatchedCount;
      }
      if (job === 'winback_30d' || job === 'all' || !job) {
        winbackDispatched = runWinBackCron(salonId, shouldForce).dispatchedCount;
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
    webhookRateLimiter,
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

        if (job === 'birthday_9am' || job === 'all' || !job) {
          birthdayDispatched = runBirthdayCron(salonId, shouldForce).dispatchedCount;
        }
        if (job === 'winback_30d' || job === 'all' || !job) {
          winbackDispatched = runWinBackCron(salonId, shouldForce).dispatchedCount;
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

  startConciergeSchedulers();

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(import.meta.dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  if (!process.env.VERCEL) {
   app.Listen(PORT,'0.0.0.0', () => {
    console.log(`WORKCRAFT Local server listening on http://0.0.0.0:${PORT}`);
   });
  }
  startServer();
  export default app;
