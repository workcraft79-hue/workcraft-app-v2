import fs from 'fs';
import path from 'path';
import type {
  ChairLock,
  ClientPreferredLang,
  ConciergeAppointment,
  ConciergeClientProfile,
  LanguageMenuOption,
  OwnerInterventionAlert,
  RetentionSettings,
  SalonConciergeStateResponse,
  SalonPackageTier,
  SalonRegionCode,
  WhatsAppMessageLog,
} from '../src/types/concierge';
import {
  clampInteger,
  getSalonsAssignedToAgent,
  sanitizeBirthDate,
  sanitizeHttpUrl,
  sanitizeMultilineTemplate,
  sanitizePhone,
  sanitizePlainText,
} from './security';

interface ConciergeStoreData {
  settingsBySalon: Record<string, RetentionSettings>;
  barbersBySalon: Record<string, string[]>;
  clients: ConciergeClientProfile[];
  appointments: ConciergeAppointment[];
  chairLocks: ChairLock[];
  alerts: OwnerInterventionAlert[];
  logs: WhatsAppMessageLog[];
}

const DEFAULT_SALON_BARBERS = ['Master Aslam', 'Tariq Mehmood', 'Ali Raza', 'Bilal Tariq'];

function parseTimeSlotToMinutes(slot: string): number {
  const m = slot.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!m) return -1;
  let hour = parseInt(m[1], 10);
  const mins = m[2] ? parseInt(m[2], 10) : 0;
  const meridiem = (m[3] || '').toUpperCase();
  if (meridiem === 'PM' && hour < 12) hour += 12;
  else if (meridiem === 'AM' && hour === 12) hour = 0;
  else if (!meridiem && hour >= 1 && hour <= 10) hour += 12;
  return hour * 60 + mins;
}

function formatMinutesToTimeSlot(totalMinutes: number): string {
  const norm = ((totalMinutes % 1440) + 1440) % 1440;
  const h24 = Math.floor(norm / 60);
  const mins = norm % 60;
  const meridiem = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${String(h12).padStart(2, '0')}:${String(mins).padStart(2, '0')} ${meridiem}`;
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const STORE_FILE = path.join(DATA_DIR, 'concierge-store.json');

export function extractCountryCode(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, '');
  const prefixes = ['+971', '+966', '+974', '+965', '+968', '+973', '+92', '+44', '+33', '+49', '+1'];
  for (const prefix of prefixes) {
    if (cleaned.startsWith(prefix)) return prefix;
  }
  const match = cleaned.match(/^\+\d{1,3}/);
  return match ? match[0] : '+92';
}

export function detectRegionFromPhone(phone: string): {
  region: SalonRegionCode;
  regionLabel: string;
  countryCode: string;
  timezoneOffsetHours: number;
  currency: string;
  currencySymbol: string;
} {
  const cc = extractCountryCode(phone);
  if (cc === '+92') {
    return {
      region: 'PK',
      regionLabel: 'Pakistan (+92)',
      countryCode: cc,
      timezoneOffsetHours: 5,
      currency: 'PKR',
      currencySymbol: 'PKR ',
    };
  }
  if (['+971', '+966', '+974', '+965', '+968', '+973'].includes(cc)) {
    const currencyMap: Record<string, { curr: string; sym: string; tz: number; label: string }> = {
      '+971': { curr: 'AED', sym: 'AED ', tz: 4, label: 'MENA · UAE (+971)' },
      '+966': { curr: 'SAR', sym: 'SAR ', tz: 3, label: 'MENA · Saudi Arabia (+966)' },
      '+974': { curr: 'QAR', sym: 'QAR ', tz: 3, label: 'MENA · Qatar (+974)' },
      '+965': { curr: 'KWD', sym: 'KWD ', tz: 3, label: 'MENA · Kuwait (+965)' },
      '+968': { curr: 'OMR', sym: 'OMR ', tz: 4, label: 'MENA · Oman (+968)' },
      '+973': { curr: 'BHD', sym: 'BHD ', tz: 3, label: 'MENA · Bahrain (+973)' },
    };
    const info = currencyMap[cc] || currencyMap['+971'];
    return {
      region: 'MENA',
      regionLabel: info.label,
      countryCode: cc,
      timezoneOffsetHours: info.tz,
      currency: info.curr,
      currencySymbol: info.sym,
    };
  }
  return {
    region: 'INTL',
    regionLabel: `Europe / UK / International (${cc})`,
    countryCode: cc,
    timezoneOffsetHours: cc === '+44' ? 0 : cc === '+1' ? -5 : 1,
    currency: cc === '+44' ? 'GBP' : 'USD',
    currencySymbol: cc === '+44' ? '£' : '$',
  };
}

export function getLanguageMenuForRegion(region: SalonRegionCode): LanguageMenuOption[] {
  if (region === 'PK') {
    return [
      { index: '1', lang: 'en', label: '1. English', dir: 'ltr' },
      { index: '2', lang: 'roman_ur', label: '2. Roman Urdu', dir: 'ltr' },
      { index: '3', lang: 'ur', label: '3. اردو (Urdu Script)', dir: 'rtl' },
    ];
  }
  if (region === 'MENA') {
    return [
      { index: '1', lang: 'en', label: '1. English', dir: 'ltr' },
      { index: '2', lang: 'ar', label: '2. العربية (Arabic)', dir: 'rtl' },
    ];
  }
  return [
    { index: '1', lang: 'en', label: '1. English', dir: 'ltr' },
    { index: '2', lang: 'ur', label: '2. اردو (Urdu)', dir: 'rtl' },
    { index: '3', lang: 'ar', label: '3. العربية (Arabic)', dir: 'rtl' },
  ];
}

export function getLangDirection(lang: ClientPreferredLang): 'ltr' | 'rtl' {
  return lang === 'ur' || lang === 'ar' ? 'rtl' : 'ltr';
}

export function buildGreetingMenuText(salonName: string, region: SalonRegionCode): string {
  const options = getLanguageMenuForRegion(region);
  const optionsLine = options.map((o) => `[${o.label}]`).join('  ');
  if (region === 'PK') {
    return `Assalamu Alaikum & Welcome to ${salonName}! Please choose your preferred language:\n${optionsLine}\nReply with 1, 2, or 3.`;
  }
  if (region === 'MENA') {
    return `Marhaba & Welcome to ${salonName}! Please choose your preferred language:\n${optionsLine}\nReply with 1 or 2.`;
  }
  return `Welcome to ${salonName}! Please select your preferred language:\n${optionsLine}\nReply with 1, 2, or 3.`;
}

function getLocalClockForOffset(offsetHours: number, nowDate = new Date()) {
  const utcMs = nowDate.getTime() + nowDate.getTimezoneOffset() * 60000;
  const local = new Date(utcMs + offsetHours * 3600000);
  const dd = String(local.getDate()).padStart(2, '0');
  const mm = String(local.getMonth() + 1).padStart(2, '0');
  return {
    dayMonth: `${dd}/${mm}`,
    hour: local.getHours(),
    year: local.getFullYear(),
  };
}

function defaultSettingsForSalon(
  salonId: string,
  salonName: string,
  ownerName: string,
  phone: string,
  packageTier: SalonPackageTier = 'PRO++'
): RetentionSettings {
  const regionMeta = detectRegionFromPhone(phone);
  const isPk = regionMeta.region === 'PK';
  return {
    salonId,
    salonName,
    ownerName,
    whatsappPhone: phone,
    countryCode: regionMeta.countryCode,
    timezoneOffsetHours: regionMeta.timezoneOffsetHours,
    currency: regionMeta.currency,
    currencySymbol: regionMeta.currencySymbol,
    packageTier,
    counterSleptAt: null,
    birthdayEnabled: true,
    birthdayDiscountPct: 20,
    birthdayFixedDiscount: isPk ? 500 : 25,
    birthdayGiftService: 'Free Organic Hair Mask',
    birthdayMessageTemplate:
      'Happy Birthday {client_name}! Celebrate your special day with {salon_name}. Enjoy {offer_summary} on your next visit today!',
    winbackEnabled: true,
    winbackDays: 30,
    winbackDiscountPct: 15,
    winbackAddonService: 'Complimentary Express Hair Wash & Styling',
    winbackMessageTemplate:
      'Hi {client_name}, we missed you at {salon_name}! It has been {days} days since your last visit. Come back this week for {offer_summary}.',
    reviewBoosterEnabled: packageTier !== 'STARTER',
    googleReviewUrl: `https://g.page/r/${salonName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}/review`,
    updatedAt: new Date().toISOString(),
  };
}

function createInitialSeedData(): ConciergeStoreData {
  const now = Date.now();
  const pkLocalToday = getLocalClockForOffset(5).dayMonth;
  const uaeLocalToday = getLocalClockForOffset(4).dayMonth;
  const ukLocalToday = getLocalClockForOffset(0).dayMonth;

  const daysAgoIso = (days: number) => new Date(now - days * 86400000).toISOString();
  const hoursAgoIso = (hours: number) => new Date(now - hours * 3600000).toISOString();

  const settingsBySalon: Record<string, RetentionSettings> = {
    '1': defaultSettingsForSalon('1', 'Seven Cuts Studio', 'Hamza Malik', '+92 321 8472910', 'PRO++'),
    '2': defaultSettingsForSalon('2', 'Royal Fade Lounge', 'Tariq Butt', '+92 300 9876543', 'STARTER'),
    '3': defaultSettingsForSalon('3', 'Al-Noor Executive Grooming', 'Aslam Khan', '+971 50 8923411', 'PRO++'),
    '4': defaultSettingsForSalon('4', 'Mayfair Blade & Beard', 'Oliver Bennett', '+44 7911 123456', 'STARTER'),
    '5': defaultSettingsForSalon('5', 'Noor Beauty Lounge (Ladies Parlor)', 'Ayesha Siddiqui', '+92 333 4412345', 'PRO'),
  };

  const barbersBySalon: Record<string, string[]> = {
    '1': [...DEFAULT_SALON_BARBERS],
    '2': ['Master Tariq', 'Hamza Ali', 'Bilal Khan'],
    '3': ['Master Aslam', 'Yousuf', 'Kamran'],
    '4': ['Oliver', 'Jack', 'Harry'],
    '5': ['Ayesha', 'Sana', 'Zara'],
  };

  const clients: ConciergeClientProfile[] = [
    {
      id: 'cli-1-bilal',
      salonId: '1',
      name: 'Bilal Ahmed',
      phone: '+92 300 1234567',
      preferredLanguage: 'roman_ur',
      awaitingLanguageSelection: false,
      birthDate: pkLocalToday,
      lastCompletedVisitAt: daysAgoIso(12),
      lastBirthdaySentYear: null,
      lastWinbackSentAt: null,
      awaitingWinbackRebook: false,
      awaitingReviewAppointmentId: null,
    },
    {
      id: 'cli-1-saad',
      salonId: '1',
      name: 'Saad Farooq',
      phone: '+92 345 6789012',
      preferredLanguage: 'ur',
      awaitingLanguageSelection: false,
      birthDate: '21/05',
      lastCompletedVisitAt: hoursAgoIso(2.5),
      lastBirthdaySentYear: null,
      lastWinbackSentAt: null,
      awaitingWinbackRebook: false,
      awaitingReviewAppointmentId: null,
    },
    {
      id: 'cli-1-fahad',
      salonId: '1',
      name: 'Fahad Mansoor',
      phone: '+92 312 5544332',
      preferredLanguage: 'roman_ur',
      awaitingLanguageSelection: false,
      birthDate: '09/08',
      lastCompletedVisitAt: daysAgoIso(34),
      lastBirthdaySentYear: null,
      lastWinbackSentAt: null,
      awaitingWinbackRebook: false,
      awaitingReviewAppointmentId: null,
    },
    {
      id: 'cli-3-zayed',
      salonId: '3',
      name: 'Zayed Al-Hashmi',
      phone: '+971 50 8923411',
      preferredLanguage: 'ar',
      awaitingLanguageSelection: false,
      birthDate: uaeLocalToday,
      lastCompletedVisitAt: daysAgoIso(35),
      lastBirthdaySentYear: null,
      lastWinbackSentAt: null,
      awaitingWinbackRebook: false,
      awaitingReviewAppointmentId: null,
    },
    {
      id: 'cli-4-oliver',
      salonId: '4',
      name: 'Daniel Brooks',
      phone: '+44 7911 887766',
      preferredLanguage: 'en',
      awaitingLanguageSelection: false,
      birthDate: ukLocalToday,
      lastCompletedVisitAt: daysAgoIso(32),
      lastBirthdaySentYear: null,
      lastWinbackSentAt: null,
      awaitingWinbackRebook: false,
      awaitingReviewAppointmentId: null,
    },
  ];

  const appointments: ConciergeAppointment[] = [
    {
      id: 'BK-101',
      salonId: '1',
      clientId: 'cli-1-bilal',
      clientName: 'Bilal Ahmed',
      clientPhone: '+92 300 1234567',
      barberName: 'Master Aslam',
      service: 'Master Haircut & Skin Fade',
      price: 1200,
      timeSlot: '03:30 PM',
      durationMins: 40,
      scheduledEndMs: now + 95 * 60000,
      sourceType: 'WHATSAPP_BOT',
      status: 'CONFIRMED',
      scheduledForIso: new Date(now + 3600000).toISOString(),
      completedAt: null,
      reviewPromptSentAt: null,
      rating: null,
      ratingComment: null,
      reviewRoutedStatus: 'PENDING',
    },
    {
      id: 'BK-104',
      salonId: '1',
      clientId: 'cli-1-saad',
      clientName: 'Saad Farooq',
      clientPhone: '+92 345 6789012',
      barberName: 'Bilal Tariq',
      service: 'Haircut + Beard Styling Combo',
      price: 1800,
      timeSlot: '05:45 PM',
      durationMins: 50,
      scheduledEndMs: now - 150 * 60000,
      sourceType: 'WHATSAPP_BOT',
      status: 'COMPLETED',
      scheduledForIso: hoursAgoIso(3),
      completedAt: hoursAgoIso(2.5),
      reviewPromptSentAt: null,
      rating: null,
      ratingComment: null,
      reviewRoutedStatus: 'PENDING',
    },
  ];

  return {
    settingsBySalon,
    barbersBySalon,
    clients,
    appointments,
    chairLocks: [],
    alerts: [],
    logs: [],
  };
}

let cachedStore: ConciergeStoreData | null = null;

function ensureStoreLoaded(): ConciergeStoreData {
  if (cachedStore) return cachedStore;
  try {
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as ConciergeStoreData;
      if (parsed && parsed.settingsBySalon && Array.isArray(parsed.clients)) {
        if (!parsed.chairLocks) parsed.chairLocks = [];
        if (!parsed.barbersBySalon) parsed.barbersBySalon = {};
        const defaultTiers: Record<string, SalonPackageTier> = {
          '1': 'PRO++',
          '2': 'STARTER',
          '3': 'PRO++',
          '4': 'STARTER',
          '5': 'PRO',
        };
        for (const [sid, tier] of Object.entries(defaultTiers)) {
          if (parsed.settingsBySalon[sid] && !parsed.settingsBySalon[sid].packageTier) {
            parsed.settingsBySalon[sid].packageTier = tier;
          }
        }
        cachedStore = parsed;
        return cachedStore;
      }
    }
  } catch {
    // Fallback to initial seed
  }
  cachedStore = createInitialSeedData();
  persistStore();
  return cachedStore;
}

function persistStore() {
  if (!cachedStore) return;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STORE_FILE, JSON.stringify(cachedStore, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Could not persist concierge store:', err);
  }
}

function ensureSalonExists(
  salonId: string,
  meta?: { salonName?: string; ownerName?: string; whatsappPhone?: string }
): RetentionSettings {
  const store = ensureStoreLoaded();
  if (!store.settingsBySalon[salonId]) {
    store.settingsBySalon[salonId] = defaultSettingsForSalon(
      salonId,
      meta?.salonName || 'WorkCraft Salon',
      meta?.ownerName || 'Salon Owner',
      meta?.whatsappPhone || '+92 300 0000000'
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

function formatOfferSummary(settings: RetentionSettings, kind: 'BIRTHDAY' | 'WINBACK', lang: ClientPreferredLang): string {
  if (kind === 'BIRTHDAY') {
    const parts: string[] = [];
    if (settings.birthdayDiscountPct > 0) {
      parts.push(`${settings.birthdayDiscountPct}% OFF`);
    }
    if (settings.birthdayFixedDiscount > 0) {
      parts.push(`${settings.currencySymbol}${settings.birthdayFixedDiscount.toLocaleString()} OFF`);
    }
    if (settings.birthdayGiftService.trim()) {
      parts.push(settings.birthdayGiftService.trim());
    }
    const joined = parts.join(' + ') || 'VIP Priority Chair';
    if (lang === 'ur') return `خصوصی سالگرہ آفر: ${joined}`;
    if (lang === 'ar') return `عرض عيد الميلاد الخاص: ${joined}`;
    if (lang === 'roman_ur') return `Birthday Special Offer: ${joined}`;
    return joined;
  }

  const parts: string[] = [];
  if (settings.winbackDiscountPct > 0) {
    parts.push(`${settings.winbackDiscountPct}% OFF`);
  }
  if (settings.winbackAddonService.trim()) {
    parts.push(settings.winbackAddonService.trim());
  }
  const joined = parts.join(' + ') || 'VIP Return Treatment';
  if (lang === 'ur') return `واپسی اسپیشل آفر: ${joined}`;
  if (lang === 'ar') return `عرض العودة الخاص: ${joined}`;
  return joined;
}

export function renderBirthdayMessage(
  settings: RetentionSettings,
  clientName: string,
  lang: ClientPreferredLang
): string {
  const offer = formatOfferSummary(settings, 'BIRTHDAY', lang);
  if (lang === 'roman_ur') {
    return `Happy Birthday ${clientName}! ${settings.salonName} ki taraf se aap ko bohat mubarakbad. Aaj aap ke liye ${offer} tayyar hai. Apna slot book karne ke liye reply karein! (${settings.birthdayMessageTemplate.replace('{client_name}', clientName).replace('{salon_name}', settings.salonName).replace('{offer_summary}', offer)})`;
  }
  if (lang === 'ur') {
    return `سالگرہ مبارک ${clientName}! ${settings.salonName} کی طرف سے دلی مبارکباد۔ آج آپ کے لیے خصوصی آفر (${offer}) دستیاب ہے۔ وقت بک کرنے کے لیے جواب دیں!`;
  }
  if (lang === 'ar') {
    return `عيد ميلاد سعيد يا ${clientName}! يتمنى لك صالون ${settings.salonName} يوماً رائعاً. استمتع بـ (${offer}) في زيارتك اليوم. أرسل لنا لتأكيد موعدك!`;
  }
  return settings.birthdayMessageTemplate
    .replace(/\{client_name\}/g, clientName)
    .replace(/\{salon_name\}/g, settings.salonName)
    .replace(/\{offer_summary\}/g, offer);
}

export function renderWinBackMessage(
  settings: RetentionSettings,
  clientName: string,
  lang: ClientPreferredLang
): string {
  const offer = formatOfferSummary(settings, 'WINBACK', lang);
  if (lang === 'roman_ur') {
    return `Assalamu Alaikum ${clientName}! Hum ne aap ko ${settings.salonName} par miss kiya (${settings.winbackDays} din guzar gaye). Wapis aayein aur paayein: ${offer}. 1-tap booking ke liye sirf "REBOOK" reply karein!`;
  }
  if (lang === 'ur') {
    return `السلام علیکم ${clientName}! ${settings.salonName} پر آپ کی آخری وزٹ کو ${settings.winbackDays} دن ہو چکے ہیں۔ آپ کے لیے خصوصی آفر: ${offer}۔ فوری دوبارہ بکنگ کے لیے "REBOOK" لکھ کر بھیجیں!`;
  }
  if (lang === 'ar') {
    return `مرحباً ${clientName}! اشتقنا لزيارتك في ${settings.salonName} منذ ${settings.winbackDays} يوماً. عد إلينا واحصل على: ${offer}. للحجز الفوري بضغطة واحدة أرسل "REBOOK"!`;
  }
  const custom = settings.winbackMessageTemplate
    .replace(/\{client_name\}/g, clientName)
    .replace(/\{salon_name\}/g, settings.salonName)
    .replace(/\{days\}/g, String(settings.winbackDays))
    .replace(/\{offer_summary\}/g, offer);
  return `${custom} Reply "REBOOK" for 1-tap instant rebooking!`;
}

export function renderReviewPrompt(salonName: string, lang: ClientPreferredLang): string {
  if (lang === 'roman_ur') {
    return `Shukriya! Aaj ${salonName} par aap ka visit kaisa raha? Meharbani farma kar 1 se 5 Stars reply karein (1–5).`;
  }
  if (lang === 'ur') {
    return `آج ${salonName} پر آپ کا وزٹ کیسا رہا؟ برائے مہربانی 1 سے 5 اسٹارز (1–5 Stars) میں جواب دیں۔`;
  }
  if (lang === 'ar') {
    return `كيف كانت زيارتك إلى ${salonName} اليوم؟ يرجى الرد بتقييم من 1 إلى 5 نجوم.`;
  }
  return `How was your visit to ${salonName} today? Reply 1–5 Stars.`;
}

function appendLog(
  salonId: string,
  entry: Omit<WhatsAppMessageLog, 'id' | 'salonId' | 'timestamp'>
): WhatsAppMessageLog {
  const store = ensureStoreLoaded();
  const full: WhatsAppMessageLog = {
    id: `wlog-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    salonId,
    timestamp: new Date().toISOString(),
    ...entry,
  };
  store.logs.unshift(full);
  if (store.logs.length > 150) {
    store.logs = store.logs.slice(0, 150);
  }
  return full;
}

function getSalonBarbers(salonId: string): string[] {
  const store = ensureStoreLoaded();
  if (!store.barbersBySalon[salonId] || store.barbersBySalon[salonId].length === 0) {
    store.barbersBySalon[salonId] = [...DEFAULT_SALON_BARBERS];
  }
  return store.barbersBySalon[salonId];
}

export function syncSalonBarbers(salonId: string, barbers: string[]): SalonConciergeStateResponse {
  const store = ensureStoreLoaded();
  ensureSalonExists(salonId);
  const cleaned = barbers
    .map((b) => sanitizePlainText(b, 60))
    .filter(Boolean)
    .slice(0, 30);
  if (cleaned.length > 0) {
    store.barbersBySalon[salonId] = cleaned;
    persistStore();
  }
  return getSalonConciergeState(salonId);
}

export function setCounterSleepState(
  salonId: string,
  sleeping: boolean
): SalonConciergeStateResponse {
  const store = ensureStoreLoaded();
  const settings = ensureSalonExists(salonId);
  settings.counterSleptAt = sleeping ? new Date().toISOString() : null;
  settings.updatedAt = new Date().toISOString();
  store.settingsBySalon[salonId] = settings;
  persistStore();
  return getSalonConciergeState(salonId);
}

export function addChairLock(
  salonId: string,
  input: {
    barberName: string;
    chairLabel?: string;
    startTimeSlot: string;
    endTimeSlot: string;
    startMinutes: number;
    endMinutes: number;
    durationMins: number;
    source: 'VOICE' | 'QUICK_PILL';
    transcript?: string;
    barbers?: string[];
  }
): { lock: ChairLock; state: SalonConciergeStateResponse } {
  const store = ensureStoreLoaded();
  const settings = ensureSalonExists(salonId);
  const cleanBarber = sanitizePlainText(input.barberName, 60) || 'Master Barber';
  const cleanChair = input.chairLabel ? sanitizePlainText(input.chairLabel, 30) : undefined;
  const cleanStart = sanitizePlainText(input.startTimeSlot, 20) || 'Now';
  const cleanEnd = sanitizePlainText(input.endTimeSlot, 20) || 'Later';
  const cleanTranscript = input.transcript ? sanitizePlainText(input.transcript, 300) : undefined;
  const durationMins = clampInteger(input.durationMins, 5, 480, 30);
  const startMinutes = clampInteger(input.startMinutes, 0, 1440, 0);
  const endMinutes = clampInteger(input.endMinutes, 0, 1920, startMinutes + durationMins);

  if (Array.isArray(input.barbers) && input.barbers.length > 0) {
    const cleanBarbers = input.barbers
      .map((b) => sanitizePlainText(b, 60))
      .filter(Boolean)
      .slice(0, 30);
    if (cleanBarbers.length > 0) {
      store.barbersBySalon[salonId] = cleanBarbers;
    }
  }
  const lock: ChairLock = {
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
    createdAt: new Date().toISOString(),
  };
  store.chairLocks.unshift(lock);

  const nowMs = Date.now();
  const lockAppt: ConciergeAppointment = {
    id: lock.id,
    salonId,
    clientId: `walkin-${lock.id}`,
    clientName:
      input.source === 'VOICE'
        ? `Walk-In · Voice Lock (${input.durationMins}m)`
        : `Walk-In · Chair Busy (${input.durationMins}m)`,
    clientPhone: settings.whatsappPhone,
    barberName: input.barberName,
    service: `Chair Blocked (${input.startTimeSlot} – ${input.endTimeSlot})`,
    price: 0,
    timeSlot: input.startTimeSlot,
    durationMins: input.durationMins,
    scheduledEndMs: nowMs + input.durationMins * 60000,
    sourceType: 'WALK_IN_BUSY',
    status: 'IN_CHAIR',
    scheduledForIso: new Date(nowMs).toISOString(),
    completedAt: null,
    reviewPromptSentAt: null,
    rating: null,
    ratingComment: null,
    reviewRoutedStatus: 'PENDING',
  };
  store.appointments.unshift(lockAppt);
  persistStore();
  return { lock, state: getSalonConciergeState(salonId) };
}

export function removeChairLock(salonId: string, lockId: string): SalonConciergeStateResponse {
  const store = ensureStoreLoaded();
  store.chairLocks = store.chairLocks.filter(
    (l) => !(l.salonId === salonId && l.id === lockId)
  );
  persistStore();
  return getSalonConciergeState(salonId);
}

function isBarberBusyAtWindow(
  salonId: string,
  barberName: string,
  startMinutes: number,
  durationMins = 35
): { busy: boolean; busyUntilMinutes: number } {
  const store = ensureStoreLoaded();
  const endMinutes = startMinutes + durationMins;
  const normTarget = barberName.toLowerCase();

  for (const lock of store.chairLocks) {
    if (lock.salonId !== salonId) continue;
    if (
      lock.barberName.toLowerCase() === normTarget ||
      lock.barberName.toLowerCase().includes(normTarget) ||
      normTarget.includes(lock.barberName.toLowerCase().split(' ')[0])
    ) {
      if (startMinutes < lock.endMinutes && endMinutes > lock.startMinutes) {
        return { busy: true, busyUntilMinutes: lock.endMinutes };
      }
    }
  }

  for (const appt of store.appointments) {
    if (appt.salonId !== salonId || appt.status === 'COMPLETED' || appt.canceled) continue;
    if (
      appt.barberName.toLowerCase() === normTarget ||
      appt.barberName.toLowerCase().includes(normTarget) ||
      normTarget.includes(appt.barberName.toLowerCase().split(' ')[0])
    ) {
      const apptStart = parseTimeSlotToMinutes(appt.timeSlot);
      if (apptStart >= 0) {
        const apptEnd = apptStart + (appt.durationMins || 35);
        if (startMinutes < apptEnd && endMinutes > apptStart) {
          return { busy: true, busyUntilMinutes: apptEnd };
        }
      }
    }
  }

  return { busy: false, busyUntilMinutes: startMinutes };
}

export function runAutoCompleteAppointmentsCron(salonId?: string): { completedCount: number } {
  const store = ensureStoreLoaded();
  const nowMs = Date.now();
  const fifteenMinMs = 15 * 60 * 1000;
  let completedCount = 0;

  for (const appt of store.appointments) {
    if (salonId && appt.salonId !== salonId) continue;
    if (appt.status === 'COMPLETED' || appt.flagged || appt.canceled) continue;

    let endMs = appt.scheduledEndMs;
    if (!endMs && appt.scheduledForIso) {
      const startMs = new Date(appt.scheduledForIso).getTime();
      if (!Number.isNaN(startMs)) {
        endMs = startMs + (appt.durationMins || 35) * 60000;
      }
    }
    if (!endMs) continue;

    if (nowMs >= endMs + fifteenMinMs) {
      appt.status = 'COMPLETED';
      appt.completedAt = new Date(nowMs).toISOString();
      const client = store.clients.find((c) => c.id === appt.clientId);
      if (client) {
        client.lastCompletedVisitAt = appt.completedAt;
      }
      // Free matching chair lock if any
      store.chairLocks = store.chairLocks.filter(
        (l) => !(l.salonId === appt.salonId && l.id === appt.id)
      );
      completedCount++;
    }
  }

  if (completedCount > 0) persistStore();
  return { completedCount };
}

export function getSalonConciergeState(
  salonId: string,
  meta?: { salonName?: string; ownerName?: string; whatsappPhone?: string }
): SalonConciergeStateResponse {
  const store = ensureStoreLoaded();
  const settings = ensureSalonExists(salonId, meta);
  runAutoCompleteAppointmentsCron(salonId);
  const regionMeta = detectRegionFromPhone(settings.whatsappPhone);
  const languageOptions = getLanguageMenuForRegion(regionMeta.region);
  const greetingPromptPreview = buildGreetingMenuText(settings.salonName, regionMeta.region);

  return {
    region: regionMeta.region,
    regionLabel: regionMeta.regionLabel,
    languageOptions,
    greetingPromptPreview,
    settings,
    clients: store.clients.filter((c) => c.salonId === salonId),
    appointments: store.appointments.filter((a) => a.salonId === salonId),
    chairLocks: store.chairLocks.filter((l) => l.salonId === salonId),
    barbers: getSalonBarbers(salonId),
    alerts: store.alerts.filter((al) => al.salonId === salonId),
    logs: store.logs.filter((l) => l.salonId === salonId).slice(0, 50),
  };
}

export function updateRetentionSettings(
  salonId: string,
  patch: Partial<RetentionSettings>
): SalonConciergeStateResponse {
  const store = ensureStoreLoaded();
  const current = ensureSalonExists(salonId);
  const safePatch: Partial<RetentionSettings> = {
    salonName: patch.salonName !== undefined ? sanitizePlainText(patch.salonName, 100) || current.salonName : current.salonName,
    ownerName: patch.ownerName !== undefined ? sanitizePlainText(patch.ownerName, 80) || current.ownerName : current.ownerName,
    whatsappPhone: patch.whatsappPhone !== undefined ? sanitizePhone(patch.whatsappPhone) || current.whatsappPhone : current.whatsappPhone,
    birthdayEnabled: patch.birthdayEnabled !== undefined ? Boolean(patch.birthdayEnabled) : current.birthdayEnabled,
    birthdayDiscountPct:
      patch.birthdayDiscountPct !== undefined
        ? clampInteger(patch.birthdayDiscountPct, 0, 100, current.birthdayDiscountPct)
        : current.birthdayDiscountPct,
    birthdayFixedDiscount:
      patch.birthdayFixedDiscount !== undefined
        ? clampInteger(patch.birthdayFixedDiscount, 0, 100000, current.birthdayFixedDiscount)
        : current.birthdayFixedDiscount,
    birthdayGiftService:
      patch.birthdayGiftService !== undefined
        ? sanitizePlainText(patch.birthdayGiftService, 120)
        : current.birthdayGiftService,
    birthdayMessageTemplate:
      patch.birthdayMessageTemplate !== undefined
        ? sanitizeMultilineTemplate(patch.birthdayMessageTemplate, 600)
        : current.birthdayMessageTemplate,
    winbackEnabled: patch.winbackEnabled !== undefined ? Boolean(patch.winbackEnabled) : current.winbackEnabled,
    winbackDays:
      patch.winbackDays !== undefined
        ? clampInteger(patch.winbackDays, 1, 365, current.winbackDays)
        : current.winbackDays,
    winbackDiscountPct:
      patch.winbackDiscountPct !== undefined
        ? clampInteger(patch.winbackDiscountPct, 0, 100, current.winbackDiscountPct)
        : current.winbackDiscountPct,
    winbackAddonService:
      patch.winbackAddonService !== undefined
        ? sanitizePlainText(patch.winbackAddonService, 120)
        : current.winbackAddonService,
    winbackMessageTemplate:
      patch.winbackMessageTemplate !== undefined
        ? sanitizeMultilineTemplate(patch.winbackMessageTemplate, 600)
        : current.winbackMessageTemplate,
    reviewBoosterEnabled:
      patch.reviewBoosterEnabled !== undefined
        ? Boolean(patch.reviewBoosterEnabled)
        : current.reviewBoosterEnabled,
    googleReviewUrl:
      patch.googleReviewUrl !== undefined
        ? sanitizeHttpUrl(patch.googleReviewUrl, current.googleReviewUrl)
        : current.googleReviewUrl,
  };

  const updated: RetentionSettings = {
    ...current,
    ...safePatch,
    salonId,
    updatedAt: new Date().toISOString(),
  };
  if (safePatch.whatsappPhone && patch.whatsappPhone) {
    const meta = detectRegionFromPhone(safePatch.whatsappPhone);
    updated.countryCode = meta.countryCode;
    updated.timezoneOffsetHours = meta.timezoneOffsetHours;
    updated.currency = meta.currency;
    updated.currencySymbol = meta.currencySymbol;
  }
  store.settingsBySalon[salonId] = updated;
  persistStore();
  return getSalonConciergeState(salonId);
}

export function listSalonsForAgent(agentId: string | null, isFounder = false): RetentionSettings[] {
  const store = ensureStoreLoaded();
  const all = Object.values(store.settingsBySalon);
  if (isFounder) return all;
  if (!agentId) return [];
  const allowedIds = new Set(getSalonsAssignedToAgent(agentId));
  return all.filter((s) => allowedIds.has(s.salonId));
}

export function upsertClientProfile(
  salonId: string,
  input: {
    phone: string;
    name?: string;
    birthDate?: string;
    preferredLanguage?: ClientPreferredLang | null;
  }
): ConciergeClientProfile {
  const store = ensureStoreLoaded();
  ensureSalonExists(salonId);
  const cleanPhone = sanitizePhone(input.phone);
  const normPhone = cleanPhone.replace(/\s+/g, '');
  const cleanName = sanitizePlainText(input.name, 80);
  const cleanBirthDate = input.birthDate !== undefined ? sanitizeBirthDate(input.birthDate) : undefined;
  const validLang =
    input.preferredLanguage === 'en' ||
    input.preferredLanguage === 'roman_ur' ||
    input.preferredLanguage === 'ur' ||
    input.preferredLanguage === 'ar'
      ? input.preferredLanguage
      : input.preferredLanguage === null
      ? null
      : undefined;

  let existing = store.clients.find(
    (c) => c.salonId === salonId && c.phone.replace(/\s+/g, '') === normPhone
  );
  if (!existing) {
    existing = {
      id: `cli-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      salonId,
      name: cleanName || 'Salon Client',
      phone: cleanPhone,
      preferredLanguage: validLang ?? null,
      awaitingLanguageSelection: validLang ? false : true,
      birthDate: cleanBirthDate || '',
      lastCompletedVisitAt: null,
      lastBirthdaySentYear: null,
      lastWinbackSentAt: null,
      awaitingWinbackRebook: false,
      awaitingReviewAppointmentId: null,
    };
    store.clients.unshift(existing);
  } else {
    if (cleanName) existing.name = cleanName;
    if (cleanBirthDate !== undefined) existing.birthDate = cleanBirthDate;
    if (validLang !== undefined) {
      existing.preferredLanguage = validLang;
      existing.awaitingLanguageSelection = false;
    }
  }
  persistStore();
  return existing;
}

export function completeAppointmentAndRecordVisit(
  salonId: string,
  payload: {
    appointmentId: string;
    clientName: string;
    clientPhone: string;
    barberName: string;
    service: string;
    price: number;
    timeSlot: string;
    birthDate?: string;
    preferredLanguage?: ClientPreferredLang;
  }
): {
  appointment: ConciergeAppointment;
  client: ConciergeClientProfile;
  state: SalonConciergeStateResponse;
} {
  const store = ensureStoreLoaded();
  const settings = ensureSalonExists(salonId);
  const regionMeta = detectRegionFromPhone(settings.whatsappPhone);
  const defaultLang: ClientPreferredLang =
    payload.preferredLanguage || (regionMeta.region === 'PK' ? 'roman_ur' : regionMeta.region === 'MENA' ? 'ar' : 'en');

  const cleanApptId = sanitizePlainText(payload.appointmentId, 60) || `BK-${Date.now()}`;
  const cleanClientName = sanitizePlainText(payload.clientName, 80) || 'Salon Client';
  const cleanClientPhone = sanitizePhone(payload.clientPhone);
  const cleanBarber = sanitizePlainText(payload.barberName, 60) || 'Master Barber';
  const cleanService = sanitizePlainText(payload.service, 160) || 'Salon Service';
  const cleanTimeSlot = sanitizePlainText(payload.timeSlot, 40) || 'Completed';
  const cleanPrice = clampInteger(payload.price, 0, 1000000, 0);

  const client = upsertClientProfile(salonId, {
    phone: cleanClientPhone,
    name: cleanClientName,
    birthDate: payload.birthDate,
  });
  if (!client.preferredLanguage) {
    client.preferredLanguage = defaultLang;
    client.awaitingLanguageSelection = false;
  }

  const nowIso = new Date().toISOString();
  client.lastCompletedVisitAt = nowIso;

  let appt = store.appointments.find(
    (a) => a.salonId === salonId && a.id === cleanApptId
  );
  if (!appt) {
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
      sourceType: 'WHATSAPP_BOT',
      status: 'COMPLETED',
      scheduledForIso: nowIso,
      completedAt: nowIso,
      reviewPromptSentAt: null,
      rating: null,
      ratingComment: null,
      reviewRoutedStatus: 'PENDING',
    };
    store.appointments.unshift(appt);
  } else {
    appt.status = 'COMPLETED';
    appt.completedAt = nowIso;
    appt.clientId = client.id;
  }

  // Free any chair lock matching this completed entry
  store.chairLocks = store.chairLocks.filter(
    (l) => !(l.salonId === salonId && l.id === payload.appointmentId)
  );

  persistStore();
  return {
    appointment: appt,
    client,
    state: getSalonConciergeState(salonId),
  };
}

export function processWhatsAppWebhook(payload: {
  salonId: string;
  fromPhone: string;
  messageText: string;
  clientName?: string;
  appointmentIdForReview?: string;
  forceLanguagePrompt?: boolean;
}): {
  replyText: string;
  replyDir: 'ltr' | 'rtl';
  lockedLanguage: ClientPreferredLang | null;
  routedAction: string;
  state: SalonConciergeStateResponse;
} {
  const store = ensureStoreLoaded();
  const settings = ensureSalonExists(payload.salonId);
  const regionMeta = detectRegionFromPhone(settings.whatsappPhone);
  const menuOptions = getLanguageMenuForRegion(regionMeta.region);
  const cleanPhone = sanitizePhone(payload.fromPhone);
  const cleanClientName = payload.clientName ? sanitizePlainText(payload.clientName, 80) : undefined;
  const raw = sanitizePlainText(payload.messageText, 500);
  const lower = raw.toLowerCase();

  let client = store.clients.find(
    (c) =>
      c.salonId === payload.salonId &&
      c.phone.replace(/\s+/g, '') === cleanPhone.replace(/\s+/g, '')
  );

  if (!client) {
    client = upsertClientProfile(payload.salonId, {
      phone: cleanPhone,
      name: cleanClientName || 'WhatsApp Client',
      preferredLanguage: null,
    });
  } else if (cleanClientName && client.name === 'WhatsApp Client') {
    client.name = cleanClientName;
  }

  const isPendingRerouteReply = Boolean(
    client.pendingReroute &&
      (client.pendingReroute.alternatives.some((alt) => alt.index === raw) ||
        client.pendingReroute.alternatives.some((alt) =>
          lower.includes(alt.barberName.toLowerCase().split(' ')[0])
        ))
  );

  const isGreeting = /^(hi|hello|hey|salam|assalam|assalamu|marhaba|السلام|مرحبا)\b/i.test(lower);
  const starMatch = raw.match(/^([1-5])(\s*(stars?|★|\*)?.*)?$/i);
  const reviewApptId = payload.appointmentIdForReview || client.awaitingReviewAppointmentId;
  const isStarFeedback = Boolean(
    !isPendingRerouteReply &&
      starMatch &&
      (reviewApptId || lower.includes('star') || (raw.length <= 2 && !client.awaitingLanguageSelection))
  );
  const isWinbackRebook =
    !isPendingRerouteReply &&
    (lower.includes('rebook') || (client.awaitingWinbackRebook && raw === '1'));
  const isLateReply =
    /\b(late|delay|minutes?\s*late|min\s*late|der\s*ho|تأخير|متأخر)\b/i.test(lower);
  const isRescheduleReply =
    /\b(reschedule|tomorrow|cancel|can'?t\s*(make|come)|nahi\s*aa|kal\s*ka|تأجيل|إلغاء|غداً)\b/i.test(lower);
  const isBridalOrGroom =
    /\b(bridal|bride|groom|baraat|walima|nikah|wedding|dulha|dulhan|عروس|عريس|دلہن|دولہا)\b/i.test(
      lower
    );
  const isBookingOrConfirm =
    isBridalOrGroom ||
    /\b(confirm|confirmed|book|want|wants|coming|on\s*my\s*way|be\s*there|haircut|beard|facial|fade|shave|groom|slot|aa\s*raha|کنفرم|بک|حجز|أؤكد|تأكيد|قادم)\b/i.test(
      lower
    ) ||
    /\b\d{1,2}(:\d{2})?\s*(am|pm|a\.m\.|p\.m\.)\b/i.test(lower);

  const hasStructuredAction =
    isPendingRerouteReply ||
    isStarFeedback ||
    isWinbackRebook ||
    isLateReply ||
    isRescheduleReply ||
    isBookingOrConfirm;

  const matchedLangOpt =
    menuOptions.find((o) => o.index === raw) ||
    menuOptions.find((o) =>
      lower.includes(
        o.lang === 'roman_ur' ? 'roman' : o.lang === 'ur' ? 'urdu' : o.lang === 'ar' ? 'arab' : 'eng'
      )
    );

  const isStep5Action =
    isPendingRerouteReply ||
    (!isStarFeedback &&
      !isWinbackRebook &&
      (isLateReply || isRescheduleReply || isBookingOrConfirm));

  // Defer INBOUND log for step 5 so booking/reminder events get rich eventMetadata without duplicate rows
  if (!(isStep5Action && !payload.forceLanguagePrompt && !(client.awaitingLanguageSelection && matchedLangOpt))) {
    appendLog(payload.salonId, {
      direction: 'INBOUND',
      module: client.awaitingReviewAppointmentId ? 'REVIEW_T2H' : isWinbackRebook ? 'WINBACK_30D' : 'LANGUAGE_MENU',
      clientName: client.name,
      clientPhone: client.phone,
      language: client.preferredLanguage || 'en',
      dir: getLangDirection(client.preferredLanguage || 'en'),
      body: raw,
    });
  }

  // 1. Trigger Region-Aware Language Selector Menu on initial "Hi"/Greeting or explicit reset
  if (
    payload.forceLanguagePrompt ||
    (!hasStructuredAction &&
      ((!client.preferredLanguage && !client.awaitingLanguageSelection) ||
        (isGreeting && !client.preferredLanguage)))
  ) {
    client.awaitingLanguageSelection = true;
    const greetingText = buildGreetingMenuText(settings.salonName, regionMeta.region);
    appendLog(payload.salonId, {
      direction: 'OUTBOUND',
      module: 'LANGUAGE_MENU',
      clientName: client.name,
      clientPhone: client.phone,
      language: 'en',
      dir: 'ltr',
      body: greetingText,
    });
    persistStore();
    return {
      replyText: greetingText,
      replyDir: 'ltr',
      lockedLanguage: client.preferredLanguage,
      routedAction: 'LANGUAGE_MENU_SENT',
      state: getSalonConciergeState(payload.salonId),
    };
  }

  // 2. Lock preferred_language when client responds with 1 / 2 / 3 (or language name)
  if (client.awaitingLanguageSelection && (!hasStructuredAction || Boolean(matchedLangOpt))) {
    if (matchedLangOpt) {
      client.preferredLanguage = matchedLangOpt.lang;
      client.awaitingLanguageSelection = false;
      const dir = getLangDirection(matchedLangOpt.lang);

      const confirmationMap: Record<ClientPreferredLang, string> = {
        en: `Language locked: English. Welcome to ${settings.salonName}! Choose an option:\n1. Book Appointment\n2. Service Rates\n3. Location & Hours`,
        roman_ur: `Zuban set ho gayi: Roman Urdu. ${settings.salonName} mein khush amdeed! Option chunein:\n1. Appointment Book Karein\n2. Rates List\n3. Location aur Timing`,
        ur: `زبان محفوظ کر لی گئی: اردو۔ ${settings.salonName} میں خوش آمدید! منتخب کریں:\n1. اپائنٹمنٹ بک کریں\n2. ریٹ لسٹ\n3. لوکیشن اور اوقات`,
        ar: `تم تثبيت اللغة: العربية. أهلاً بك في ${settings.salonName}! اختر:\n1. حجز موعد\n2. قائمة الأسعار\n3. الموقع وساعات العمل`,
      };
      const replyText = confirmationMap[matchedLangOpt.lang];
      appendLog(payload.salonId, {
        direction: 'OUTBOUND',
        module: 'LANGUAGE_MENU',
        clientName: client.name,
        clientPhone: client.phone,
        language: matchedLangOpt.lang,
        dir,
        body: replyText,
      });
      persistStore();
      return {
        replyText,
        replyDir: dir,
        lockedLanguage: matchedLangOpt.lang,
        routedAction: `LANGUAGE_LOCKED_${matchedLangOpt.lang.toUpperCase()}`,
        state: getSalonConciergeState(payload.salonId),
      };
    }

    // Re-prompt menu if invalid option
    const retryText = buildGreetingMenuText(settings.salonName, regionMeta.region);
    persistStore();
    return {
      replyText: retryText,
      replyDir: 'ltr',
      lockedLanguage: null,
      routedAction: 'LANGUAGE_MENU_REPROMPT',
      state: getSalonConciergeState(payload.salonId),
    };
  }

  if (hasStructuredAction && !client.preferredLanguage) {
    client.preferredLanguage = 'en';
    client.awaitingLanguageSelection = false;
  }

  const activeLang: ClientPreferredLang = client.preferredLanguage || 'en';
  const activeDir = getLangDirection(activeLang);

  // 3. Smart Reputation Routing for 1–5 Star Feedback (Module 4)
  if (isStarFeedback && starMatch) {
    const rating = Number(starMatch[1]);
    const appt =
      store.appointments.find((a) => a.id === reviewApptId) ||
      store.appointments.find((a) => a.salonId === payload.salonId && a.clientId === client!.id && a.status === 'COMPLETED');

    if (rating >= 4) {
      if (appt) {
        appt.rating = rating;
        appt.ratingComment = raw;
        appt.reviewRoutedStatus = 'PUBLIC_GOOGLE_SENT';
      }
      client.awaitingReviewAppointmentId = null;

      const thankYouMap: Record<ClientPreferredLang, string> = {
        en: `Thank you for the ${rating}★ rating, ${client.name}! We would love it if you shared your quick review on Google: ${settings.googleReviewUrl}`,
        roman_ur: `Bohat shukriya ${client.name} (${rating}★)! Agar aap apna review Google par share kar dein to bohat meharbani hogi: ${settings.googleReviewUrl}`,
        ur: `${rating}★ ریٹنگ کا بہت شکریہ ${client.name}! برائے مہربانی اپنا قیمتی ریویو گوگل پر شیئر کریں: ${settings.googleReviewUrl}`,
        ar: `شكراً جزيلاً لتقييمك (${rating}★) يا ${client.name}! يسعدنا مشاركة تقييمك على جوجل: ${settings.googleReviewUrl}`,
      };
      const replyText = thankYouMap[activeLang];
      appendLog(payload.salonId, {
        direction: 'OUTBOUND',
        module: 'REVIEW_T2H',
        clientName: client.name,
        clientPhone: client.phone,
        language: activeLang,
        dir: activeDir,
        body: replyText,
      });
      persistStore();
      return {
        replyText,
        replyDir: activeDir,
        lockedLanguage: activeLang,
        routedAction: 'REVIEW_ROUTED_PUBLIC_GOOGLE',
        state: getSalonConciergeState(payload.salonId),
      };
    } else {
      // 1-3 Stars: Strictly suppress Google URL & create OWNER_INTERVENTION_NEEDED alert!
      if (appt) {
        appt.rating = rating;
        appt.ratingComment = raw;
        appt.reviewRoutedStatus = 'OWNER_INTERVENTION_NEEDED';
      }
      client.awaitingReviewAppointmentId = null;

      const alert: OwnerInterventionAlert = {
        id: `al-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        salonId: payload.salonId,
        appointmentId: appt?.id || 'DIRECT-WA',
        clientId: client.id,
        clientName: client.name,
        clientPhone: client.phone,
        service: appt?.service || 'Salon Service',
        rating,
        feedbackText: raw,
        status: 'OWNER_INTERVENTION_NEEDED',
        createdAt: new Date().toISOString(),
        resolvedAt: null,
      };
      store.alerts.unshift(alert);

      const apologyMap: Record<ClientPreferredLang, string> = {
        en: `We are truly sorry your visit did not earn 5 stars, ${client.name}. Thank you for your honest ${rating}★ feedback—our Salon Owner (${settings.ownerName}) has been alerted privately and will reach out personally to make this right.`,
        roman_ur: `Maazrat chahte hain ${client.name} ke aaj ka tajurba aap ki umeed ke mutabiq nahi raha. Hum ne aap ka ${rating}★ feedback Salon Owner (${settings.ownerName}) tak fori pohncha diya hai—woh khud aap se rabta karein gay.`,
        ur: `ہم دل سے معذرت خواہ ہیں ${client.name} کہ آج کا تجربہ آپ کی توقعات پر پورا نہ اتر سکا۔ آپ کا ${rating}★ فیڈبیک فوری طور پر سیلون مالک (${settings.ownerName}) کو بھیج دیا گیا ہے اور وہ ذاتی طور پر آپ سے رابطہ کریں گے۔`,
        ar: `نعتذر بشدة يا ${client.name} لأن تجربتك لم تكن بالمستوى المطلوب. تم إبلاغ مالك الصالون (${settings.ownerName}) فوراً بتقييمك (${rating}★) وسيتواصل معك شخصياً لتعويضك.`,
      };
      const replyText = apologyMap[activeLang];
      appendLog(payload.salonId, {
        direction: 'OUTBOUND',
        module: 'REVIEW_T2H',
        clientName: client.name,
        clientPhone: client.phone,
        language: activeLang,
        dir: activeDir,
        body: replyText,
      });
      persistStore();
      return {
        replyText,
        replyDir: activeDir,
        lockedLanguage: activeLang,
        routedAction: 'OWNER_INTERVENTION_NEEDED',
        state: getSalonConciergeState(payload.salonId),
      };
    }
  }

  // 4. 1-Tap Rebooking from 30-Day Dormant Win-Back (Module 3)
  if (lower.includes('rebook') || (client.awaitingWinbackRebook && raw === '1')) {
    client.awaitingWinbackRebook = false;
    const newBooking: ConciergeAppointment = {
      id: `BK-WB-${Date.now().toString().slice(-4)}`,
      salonId: payload.salonId,
      clientId: client.id,
      clientName: client.name,
      clientPhone: client.phone,
      barberName: 'Master Aslam',
      service: settings.winbackAddonService
        ? `VIP Return Visit + ${settings.winbackAddonService}`
        : 'VIP Return Haircut & Styling',
      price: settings.currency === 'PKR' ? 1200 : 80,
      timeSlot: '05:00 PM (Priority Rebook)',
      status: 'CONFIRMED',
      scheduledForIso: new Date(Date.now() + 86400000).toISOString(),
      completedAt: null,
      reviewPromptSentAt: null,
      rating: null,
      ratingComment: null,
      reviewRoutedStatus: 'PENDING',
    };
    store.appointments.unshift(newBooking);

    const rebookConfirm: Record<ClientPreferredLang, string> = {
      en: `Priority Rebooking Confirmed (${newBooking.id})! Your ${settings.winbackDiscountPct}% OFF win-back offer + ${settings.winbackAddonService} is locked at ${settings.salonName}.`,
      roman_ur: `Mubarak ${client.name}! Aap ki priority rebooking (${newBooking.id}) confirm ho gayi hai. ${settings.winbackDiscountPct}% OFF + ${settings.winbackAddonService} lock kar diya gaya hai.`,
      ur: `آپ کی ترجیحی ری-بکنگ (${newBooking.id}) کنفرم ہو گئی ہے ${client.name}! آپ کا ${settings.winbackDiscountPct}% ڈسکاؤنٹ اور ${settings.winbackAddonService} محفوظ کر دیا گیا ہے۔`,
      ar: `تم تأكيد إعادة الحجز الفوري (${newBooking.id}) يا ${client.name}! تم تثبيت خصم ${settings.winbackDiscountPct}% مع ${settings.winbackAddonService} في ${settings.salonName}.`,
    };
    const replyText = rebookConfirm[activeLang];
    appendLog(payload.salonId, {
      direction: 'OUTBOUND',
      module: 'WINBACK_30D',
      clientName: client.name,
      clientPhone: client.phone,
      language: activeLang,
      dir: activeDir,
      body: replyText,
    });
    persistStore();
    return {
      replyText,
      replyDir: activeDir,
      lockedLanguage: activeLang,
      routedAction: 'WINBACK_REBOOKED',
      state: getSalonConciergeState(payload.salonId),
    };
  }

  // 4B. Resolve pending Barber Busy-Reroute choice (1 / 2 / 3)
  if (isPendingRerouteReply && client.pendingReroute) {
    const pending = client.pendingReroute;
    const chosen =
      pending.alternatives.find((alt) => alt.index === raw) ||
      pending.alternatives.find((alt) =>
        lower.includes(alt.barberName.toLowerCase().split(' ')[0])
      ) ||
      pending.alternatives[0];

    client.pendingReroute = null;
    if (chosen) {
      const startMins = parseTimeSlotToMinutes(chosen.timeSlot);
      const nowBase = new Date();
      const startDate = new Date(nowBase);
      if (startMins >= 0) {
        startDate.setHours(Math.floor(startMins / 60), startMins % 60, 0, 0);
      }

      const reroutedAppt: ConciergeAppointment = {
        id: `BK-WA-${Date.now().toString().slice(-4)}`,
        salonId: payload.salonId,
        clientId: client.id,
        clientName: client.name,
        clientPhone: client.phone,
        barberName: chosen.barberName,
        service: pending.services,
        price: settings.currency === 'PKR' ? 1500 : 85,
        timeSlot: chosen.timeSlot,
        durationMins: 35,
        scheduledEndMs: startDate.getTime() + 35 * 60000,
        sourceType: 'WHATSAPP_BOT',
        status: 'CONFIRMED',
        scheduledForIso: startDate.toISOString(),
        completedAt: null,
        reviewPromptSentAt: null,
        rating: null,
        ratingComment: null,
        reviewRoutedStatus: 'PENDING',
      };
      store.appointments.unshift(reroutedAppt);

      appendLog(payload.salonId, {
        direction: 'INBOUND',
        module: 'BOOKING',
        clientName: client.name,
        clientPhone: client.phone,
        language: activeLang,
        dir: activeDir,
        body: raw,
        eventMetadata: {
          eventType: 'APPOINTMENT_CONFIRMED',
          barberName: chosen.barberName,
          services: pending.services,
          timeSlot: chosen.timeSlot,
        },
      });

      const confirmMap: Record<ClientPreferredLang, string> = {
        en: `Confirmed! ${client.name}, we booked you with ${chosen.barberName} at ${chosen.timeSlot} (${pending.services}).`,
        roman_ur: `Confirm ho gaya ${client.name}! Aap ki booking ${chosen.barberName} ke sath ${chosen.timeSlot} par (${pending.services}) lock ho gayi hai.`,
        ur: `کنفرم ہو گیا ${client.name}! آپ کی بکنگ باربر ${chosen.barberName} کے ساتھ ${chosen.timeSlot} پر (${pending.services}) محفوظ کر دی گئی ہے۔`,
        ar: `تم التأكيد يا ${client.name}! تم حجز موعدك مع الحلاق ${chosen.barberName} الساعة ${chosen.timeSlot} (${pending.services}).`,
      };
      const replyText = confirmMap[activeLang];
      appendLog(payload.salonId, {
        direction: 'OUTBOUND',
        module: 'BOOKING',
        clientName: client.name,
        clientPhone: client.phone,
        language: activeLang,
        dir: activeDir,
        body: replyText,
      });
      persistStore();
      return {
        replyText,
        replyDir: activeDir,
        lockedLanguage: activeLang,
        routedAction: 'BARBER_REROUTE_CONFIRMED',
        state: getSalonConciergeState(payload.salonId),
      };
    }
  }

  // 5. Appointment Confirmations, Busy-Rerouting & Reminder Replies (triggers hands-free loud owner announcements)
  if (isLateReply || isRescheduleReply || isBookingOrConfirm) {
    const salonBarbers = getSalonBarbers(payload.salonId);
    // Extract optional barber, time slot, and services from message
    const timeMatch = raw.match(/\b(\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.))\b/i);
    const extractedTimeRaw = timeMatch
      ? timeMatch[1].replace(/\./g, '').toUpperCase().replace(/^(\d{1,2})\s/, '$1:00 ')
      : '04:30 PM';
    const parsedTimeMins = parseTimeSlotToMinutes(extractedTimeRaw);
    const extractedTime = parsedTimeMins >= 0 ? formatMinutesToTimeSlot(parsedTimeMins) : extractedTimeRaw;

    // First match against active salon barber roster, then fallback to regex after "barber/with"
    const rosterMatchedBarber = salonBarbers.find((b) => {
      const firstToken = b.toLowerCase().replace(/^master\s+/i, '').split(/\s+/)[0];
      return lower.includes(b.toLowerCase()) || (firstToken.length >= 3 && lower.includes(firstToken));
    });
    const barberMatch =
      raw.match(/(?:barber|stylist|حلاق|باربر)\s+([A-Za-z]+)/i) ||
      raw.match(/\bwith\s+(?!(?:barber|stylist|the|my|our)\b)([A-Za-z]+)/i);
    const extractedBarber = rosterMatchedBarber || (barberMatch ? barberMatch[1] : salonBarbers[0] || 'Master Aslam');

    const matchedServices: string[] = [];
    if (/bridal|bride|dulhan|عروس|دلہن/i.test(lower)) matchedServices.push('Bridal Package');
    if (/groom|baraat|walima|dulha|عريس|دولہا/i.test(lower)) matchedServices.push('Groom Executive Package');
    if (/haircut|fade|cut|قص|کٹ/i.test(lower)) matchedServices.push('Haircut');
    if (/beard|shave|trim|لحية|داڑھی/i.test(lower)) matchedServices.push('Beard');
    if (/facial|scrub|polish|بشرة|فیشل/i.test(lower)) matchedServices.push('Facial');
    if (/massage|مساج/i.test(lower)) matchedServices.push('Head Massage');
    const extractedServices =
      matchedServices.length > 0 ? matchedServices.join(' & ') : 'Haircut & Beard';

    if (isLateReply) {
      appendLog(payload.salonId, {
        direction: 'INBOUND',
        module: 'BOOKING',
        clientName: client.name,
        clientPhone: client.phone,
        language: activeLang,
        dir: activeDir,
        body: raw,
        eventMetadata: {
          eventType: 'REMINDER_REPLY_LATE',
          barberName: extractedBarber,
          timeSlot: extractedTime,
        },
      });
      const lateReplyMap: Record<ClientPreferredLang, string> = {
        en: `No problem ${client.name}! We have notified ${extractedBarber} that you will arrive shortly for your ${extractedTime} slot.`,
        roman_ur: `Koi masla nahi ${client.name}! Hum ne barber ${extractedBarber} ko inform kar diya hai ke aap ${extractedTime} ke liye thori der mein pohanch rahe hain.`,
        ur: `کوئی بات نہیں ${client.name}! ہم نے باربر ${extractedBarber} کو اطلاع دے دی ہے کہ آپ ${extractedTime} کے وقت پر تھوڑی دیر سے پہنچیں گے۔`,
        ar: `لا بأس يا ${client.name}! أبلغنا الحلاق ${extractedBarber} بأنك ستتأخر قليلاً عن موعد ${extractedTime}.`,
      };
      const replyText = lateReplyMap[activeLang];
      appendLog(payload.salonId, {
        direction: 'OUTBOUND',
        module: 'BOOKING',
        clientName: client.name,
        clientPhone: client.phone,
        language: activeLang,
        dir: activeDir,
        body: replyText,
      });
      persistStore();
      return {
        replyText,
        replyDir: activeDir,
        lockedLanguage: activeLang,
        routedAction: 'REMINDER_REPLY_LATE',
        state: getSalonConciergeState(payload.salonId),
      };
    }

    if (isRescheduleReply) {
      appendLog(payload.salonId, {
        direction: 'INBOUND',
        module: 'BOOKING',
        clientName: client.name,
        clientPhone: client.phone,
        language: activeLang,
        dir: activeDir,
        body: raw,
        eventMetadata: {
          eventType: 'REMINDER_REPLY_RESCHEDULE',
          barberName: extractedBarber,
          timeSlot: extractedTime,
        },
      });
      const reschedMap: Record<ClientPreferredLang, string> = {
        en: `Got it ${client.name}. We alerted ${settings.salonName} so your chair can be offered to the waitlist and we will send tomorrow's slots.`,
        roman_ur: `Ji ${client.name}, hum ne salon ko update kar diya hai aur kal ke available slots aap ko bhej rahe hain.`,
        ur: `جی ${client.name}، ہم نے سیلون کو آگاہ کر دیا ہے اور کل کے دستیاب اوقات آپ کو بھیج رہے ہیں۔`,
        ar: `تم استلام طلبك يا ${client.name}. أبلغنا الصالون وسنرسل لك المواعيد المتاحة ليوم غد.`,
      };
      const replyText = reschedMap[activeLang];
      appendLog(payload.salonId, {
        direction: 'OUTBOUND',
        module: 'BOOKING',
        clientName: client.name,
        clientPhone: client.phone,
        language: activeLang,
        dir: activeDir,
        body: replyText,
      });
      persistStore();
      return {
        replyText,
        replyDir: activeDir,
        lockedLanguage: activeLang,
        routedAction: 'REMINDER_REPLY_RESCHEDULE',
        state: getSalonConciergeState(payload.salonId),
      };
    }

    const isReminderOnly =
      !isBridalOrGroom &&
      /\b(i'?m coming|on my way|coming|yes\s*confirm|aa\s*raha|جی آ رہا|قادم)\b/i.test(lower) &&
      matchedServices.length === 0;

    // Automatic WhatsApp Bot Busy-Rerouting Check (when requested barber has active Voice/Pill Chair Lock or conflicting appointment)
    if (!isReminderOnly && parsedTimeMins >= 0) {
      const busyCheck = isBarberBusyAtWindow(payload.salonId, extractedBarber, parsedTimeMins, 35);
      if (busyCheck.busy) {
        const freeBarbers = salonBarbers.filter(
          (b) =>
            b.toLowerCase() !== extractedBarber.toLowerCase() &&
            !isBarberBusyAtWindow(payload.salonId, b, parsedTimeMins, 35).busy
        );
        const nextOpenSlot = formatMinutesToTimeSlot(busyCheck.busyUntilMinutes);

        const alternatives: Array<{
          index: string;
          type: 'ALT_BARBER' | 'NEXT_SLOT';
          barberName: string;
          timeSlot: string;
        }> = [];
        freeBarbers.slice(0, 2).forEach((b, idx) => {
          alternatives.push({
            index: String(idx + 1),
            type: 'ALT_BARBER',
            barberName: b,
            timeSlot: extractedTime,
          });
        });
        alternatives.push({
          index: String(alternatives.length + 1),
          type: 'NEXT_SLOT',
          barberName: extractedBarber,
          timeSlot: nextOpenSlot,
        });

        client.pendingReroute = {
          requestedBarber: extractedBarber,
          requestedTimeSlot: extractedTime,
          requestedMinutes: parsedTimeMins,
          services: extractedServices,
          alternatives,
        };

        const menuLines = alternatives
          .map((alt) =>
            alt.type === 'ALT_BARBER'
              ? `[${alt.index}. ${alt.barberName} @ ${alt.timeSlot} (Available Now)]`
              : `[${alt.index}. ${alt.barberName} @ ${alt.timeSlot} (Next Open Slot)]`
          )
          .join('\n');

        const busyReplyMap: Record<ClientPreferredLang, string> = {
          en: `Status: ${extractedBarber} is currently Busy at ${extractedTime}. Please choose an instant alternative:\n${menuLines}`,
          roman_ur: `Itlaa: ${extractedBarber} ${extractedTime} par abhi Busy hain. Foran neechay se option chunein:\n${menuLines}`,
          ur: `اطلاع: باربر ${extractedBarber} اس وقت ${extractedTime} پر مصروف (Busy) ہیں۔ فوری متبادل منتخب کریں:\n${menuLines}`,
          ar: `تنبيه: الحلاق ${extractedBarber} مشغول حالياً الساعة ${extractedTime}. اختر بديلاً فورياً:\n${menuLines}`,
        };

        appendLog(payload.salonId, {
          direction: 'INBOUND',
          module: 'BOOKING',
          clientName: client.name,
          clientPhone: client.phone,
          language: activeLang,
          dir: activeDir,
          body: raw,
          eventMetadata: {
            eventType: 'BARBER_BUSY_REROUTED',
            barberName: extractedBarber,
            services: extractedServices,
            timeSlot: extractedTime,
          },
        });

        const replyText = busyReplyMap[activeLang];
        appendLog(payload.salonId, {
          direction: 'OUTBOUND',
          module: 'BOOKING',
          clientName: client.name,
          clientPhone: client.phone,
          language: activeLang,
          dir: activeDir,
          body: replyText,
        });
        persistStore();
        return {
          replyText,
          replyDir: activeDir,
          lockedLanguage: activeLang,
          routedAction: 'BARBER_BUSY_REROUTE_OFFERED',
          state: getSalonConciergeState(payload.salonId),
        };
      }
    }

    // Appointment Confirmation / New Booking (or Urgent Bridal/Groom Alert)
    const eventType = isBridalOrGroom
      ? 'URGENT_BRIDAL_GROOM'
      : isReminderOnly
      ? 'REMINDER_REPLY_CONFIRMED'
      : 'APPOINTMENT_CONFIRMED';

    const startDate = new Date();
    if (parsedTimeMins >= 0) {
      startDate.setHours(Math.floor(parsedTimeMins / 60), parsedTimeMins % 60, 0, 0);
    }

    const newAppt: ConciergeAppointment = {
      id: `BK-WA-${Date.now().toString().slice(-4)}`,
      salonId: payload.salonId,
      clientId: client.id,
      clientName: client.name,
      clientPhone: client.phone,
      barberName: extractedBarber,
      service: extractedServices,
      price: isBridalOrGroom
        ? settings.currency === 'PKR'
          ? 12000
          : 450
        : settings.currency === 'PKR'
        ? 1500
        : 85,
      timeSlot: extractedTime,
      durationMins: isBridalOrGroom ? 90 : 35,
      scheduledEndMs: startDate.getTime() + (isBridalOrGroom ? 90 : 35) * 60000,
      sourceType: 'WHATSAPP_BOT',
      status: 'CONFIRMED',
      scheduledForIso: startDate.toISOString(),
      completedAt: null,
      reviewPromptSentAt: null,
      rating: null,
      ratingComment: null,
      reviewRoutedStatus: 'PENDING',
    };
    if (!isReminderOnly) {
      store.appointments.unshift(newAppt);
    }

    appendLog(payload.salonId, {
      direction: 'INBOUND',
      module: 'BOOKING',
      clientName: client.name,
      clientPhone: client.phone,
      language: activeLang,
      dir: activeDir,
      body: raw,
      eventMetadata: {
        eventType,
        barberName: extractedBarber,
        services: extractedServices,
        timeSlot: extractedTime,
      },
    });

    const confirmReplyMap: Record<ClientPreferredLang, string> = {
      en: `Confirmed! ${client.name}, your ${extractedServices} with ${extractedBarber} at ${extractedTime} is locked at ${settings.salonName}.`,
      roman_ur: `Confirm ho gaya ${client.name}! ${extractedBarber} ke sath ${extractedTime} par (${extractedServices}) lock kar diya gaya hai.`,
      ur: `کنفرم ہو گیا ${client.name}! باربر ${extractedBarber} کے ساتھ ${extractedTime} پر (${extractedServices}) بک ہو گیا ہے۔`,
      ar: `تم التأكيد يا ${client.name}! موعدك (${extractedServices}) مع الحلاق ${extractedBarber} الساعة ${extractedTime} مؤكد في ${settings.salonName}.`,
    };
    const replyText = confirmReplyMap[activeLang];
    appendLog(payload.salonId, {
      direction: 'OUTBOUND',
      module: 'BOOKING',
      clientName: client.name,
      clientPhone: client.phone,
      language: activeLang,
      dir: activeDir,
      body: replyText,
    });
    persistStore();
    return {
      replyText,
      replyDir: activeDir,
      lockedLanguage: activeLang,
      routedAction: eventType,
      state: getSalonConciergeState(payload.salonId),
    };
  }

  // 6. General localized concierge acknowledgment in locked preferred_language
  const generalAck: Record<ClientPreferredLang, string> = {
    en: `Received "${raw}" at ${settings.salonName}. Pick a service or reply BOOK to reserve your chair!`,
    roman_ur: `Aap ka message "${raw}" mil gaya hai. ${settings.salonName} par slot reserve karne ke liye apna waqt aur service batayein!`,
    ur: `${settings.salonName} میں آپ کا پیغام "${raw}" موصول ہو گیا ہے۔ وقت اور سروس منتخب کر کے اپائنٹمنٹ کنفرم کریں!`,
    ar: `تم استلام رسالتك "${raw}" في ${settings.salonName}. اختر الخدمة والوقت لتأكيد موعدك فوراً!`,
  };
  const replyText = generalAck[activeLang];
  appendLog(payload.salonId, {
    direction: 'OUTBOUND',
    module: 'BOOKING',
    clientName: client.name,
    clientPhone: client.phone,
    language: activeLang,
    dir: activeDir,
    body: replyText,
  });
  persistStore();
  return {
    replyText,
    replyDir: activeDir,
    lockedLanguage: activeLang,
    routedAction: 'CONCIERGE_REPLIED',
    state: getSalonConciergeState(payload.salonId),
  };
}

export function runBirthdayCron(salonId?: string, forceRun = false): {
  dispatchedCount: number;
  salonIdsChecked: number;
} {
  const store = ensureStoreLoaded();
  const targetSalons = salonId
    ? [store.settingsBySalon[salonId]].filter(Boolean)
    : Object.values(store.settingsBySalon);

  let dispatchedCount = 0;

  for (const settings of targetSalons) {
    if (!settings.birthdayEnabled) continue;
    const local = getLocalClockForOffset(settings.timezoneOffsetHours);
    if (!forceRun && local.hour !== 9) continue;

    const matchingClients = store.clients.filter(
      (c) =>
        c.salonId === settings.salonId &&
        c.birthDate === local.dayMonth &&
        (forceRun || c.lastBirthdaySentYear !== local.year)
    );

    for (const cli of matchingClients) {
      const lang: ClientPreferredLang = cli.preferredLanguage || 'en';
      const body = renderBirthdayMessage(settings, cli.name, lang);
      cli.lastBirthdaySentYear = local.year;
      appendLog(settings.salonId, {
        direction: 'OUTBOUND',
        module: 'BIRTHDAY_9AM',
        clientName: cli.name,
        clientPhone: cli.phone,
        language: lang,
        dir: getLangDirection(lang),
        body,
      });
      dispatchedCount++;
    }
  }

  if (dispatchedCount > 0) persistStore();
  return { dispatchedCount, salonIdsChecked: targetSalons.length };
}

export function runWinBackCron(salonId?: string, forceRun = false): {
  dispatchedCount: number;
} {
  const store = ensureStoreLoaded();
  const targetSalons = salonId
    ? [store.settingsBySalon[salonId]].filter(Boolean)
    : Object.values(store.settingsBySalon);

  const nowMs = Date.now();
  let dispatchedCount = 0;

  for (const settings of targetSalons) {
    if (!settings.winbackEnabled) continue;
    const thresholdMs = Math.max(1, settings.winbackDays) * 86400000;

    const salonClients = store.clients.filter((c) => c.salonId === settings.salonId);
    for (const cli of salonClients) {
      if (!cli.lastCompletedVisitAt) continue;
      const lastVisitMs = new Date(cli.lastCompletedVisitAt).getTime();
      if (Number.isNaN(lastVisitMs) || nowMs - lastVisitMs < thresholdMs) continue;

      const hasUpcomingAppointment = store.appointments.some(
        (a) =>
          a.salonId === settings.salonId &&
          (a.clientId === cli.id || a.clientPhone.replace(/\s+/g, '') === cli.phone.replace(/\s+/g, '')) &&
          (a.status === 'CONFIRMED' || a.status === 'IN_CHAIR')
      );
      if (hasUpcomingAppointment) continue;

      if (!forceRun && cli.lastWinbackSentAt) {
        const lastSentMs = new Date(cli.lastWinbackSentAt).getTime();
        if (!Number.isNaN(lastSentMs) && nowMs - lastSentMs < 14 * 86400000) continue;
      }

      const lang: ClientPreferredLang = cli.preferredLanguage || 'en';
      const body = renderWinBackMessage(settings, cli.name, lang);
      cli.lastWinbackSentAt = new Date(nowMs).toISOString();
      cli.awaitingWinbackRebook = true;

      appendLog(settings.salonId, {
        direction: 'OUTBOUND',
        module: 'WINBACK_30D',
        clientName: cli.name,
        clientPhone: cli.phone,
        language: lang,
        dir: getLangDirection(lang),
        body,
      });
      dispatchedCount++;
    }
  }

  if (dispatchedCount > 0) persistStore();
  return { dispatchedCount };
}

export function runPostServiceReviewCron(
  salonId?: string,
  forceImmediate = false,
  targetAppointmentId?: string
): {
  dispatchedCount: number;
} {
  const store = ensureStoreLoaded();
  const nowMs = Date.now();
  const twoHoursMs = 2 * 3600 * 1000;
  let dispatchedCount = 0;

  for (const appt of store.appointments) {
    if (salonId && appt.salonId !== salonId) continue;
    if (targetAppointmentId && appt.id !== targetAppointmentId) continue;
    if (appt.status !== 'COMPLETED') continue;
    if (!forceImmediate && appt.reviewPromptSentAt) continue;

    const settings = ensureSalonExists(appt.salonId);
    if (!settings.reviewBoosterEnabled) continue;

    const completedMs = appt.completedAt ? new Date(appt.completedAt).getTime() : 0;
    if (!forceImmediate && (!completedMs || nowMs - completedMs < twoHoursMs)) continue;

    const client = store.clients.find((c) => c.id === appt.clientId);
    const lang: ClientPreferredLang = client?.preferredLanguage || 'en';
    const promptBody = renderReviewPrompt(settings.salonName, lang);

    appt.reviewPromptSentAt = new Date(nowMs).toISOString();
    appt.reviewRoutedStatus = 'PROMPT_SENT';
    if (client) {
      client.awaitingReviewAppointmentId = appt.id;
    }

    appendLog(appt.salonId, {
      direction: 'OUTBOUND',
      module: 'REVIEW_T2H',
      clientName: appt.clientName,
      clientPhone: appt.clientPhone,
      language: lang,
      dir: getLangDirection(lang),
      body: promptBody,
    });
    dispatchedCount++;
  }

  if (dispatchedCount > 0) persistStore();
  return { dispatchedCount };
}

export function resolveOwnerAlert(salonId: string, alertId: string): SalonConciergeStateResponse {
  const store = ensureStoreLoaded();
  const alert = store.alerts.find((a) => a.salonId === salonId && a.id === alertId);
  if (alert) {
    alert.status = 'RESOLVED';
    alert.resolvedAt = new Date().toISOString();
    persistStore();
  }
  return getSalonConciergeState(salonId);
}

export function startConciergeSchedulers() {
  ensureStoreLoaded();
  // Run initial sweep on boot for Auto-Complete + T+2h / 30d dormant / 9:00 AM window
  runAutoCompleteAppointmentsCron(undefined);
  runBirthdayCron(undefined, false);
  runWinBackCron(undefined, false);
  runPostServiceReviewCron(undefined, false);

  return setInterval(() => {
    try {
      runAutoCompleteAppointmentsCron(undefined);
      runBirthdayCron(undefined, false);
      runWinBackCron(undefined, false);
      runPostServiceReviewCron(undefined, false);
    } catch (err) {
      console.warn('Concierge background cron sweep error:', err);
    }
  }, 60 * 1000);
}
