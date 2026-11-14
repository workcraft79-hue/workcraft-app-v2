import fs from 'fs';
import path from 'path';
import type {
  ClientPreferredLang,
  ConciergeAppointment,
  ConciergeClientProfile,
  LanguageMenuOption,
  OwnerInterventionAlert,
  RetentionSettings,
  SalonConciergeStateResponse,
  SalonRegionCode,
  WhatsAppMessageLog,
} from '../src/types/concierge';

interface ConciergeStoreData {
  settingsBySalon: Record<string, RetentionSettings>;
  clients: ConciergeClientProfile[];
  appointments: ConciergeAppointment[];
  alerts: OwnerInterventionAlert[];
  logs: WhatsAppMessageLog[];
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
  phone: string
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
    reviewBoosterEnabled: true,
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
    '1': defaultSettingsForSalon('1', 'Seven Cuts Studio', 'Hamza Malik', '+92 321 8472910'),
    '2': defaultSettingsForSalon('2', 'Royal Fade Lounge', 'Tariq Butt', '+92 300 9876543'),
    '3': defaultSettingsForSalon('3', 'Al-Noor Executive Grooming', 'Aslam Khan', '+971 50 8923411'),
    '4': defaultSettingsForSalon('4', 'Mayfair Blade & Beard', 'Oliver Bennett', '+44 7911 123456'),
    '5': defaultSettingsForSalon('5', 'Noor Beauty Lounge (Ladies Parlor)', 'Ayesha Siddiqui', '+92 333 4412345'),
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
    clients,
    appointments,
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

export function getSalonConciergeState(
  salonId: string,
  meta?: { salonName?: string; ownerName?: string; whatsappPhone?: string }
): SalonConciergeStateResponse {
  const store = ensureStoreLoaded();
  const settings = ensureSalonExists(salonId, meta);
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
    alerts: store.alerts.filter((al) => al.salonId === salonId),
    logs: store.logs.filter((l) => l.salonId === salonId).slice(0, 40),
  };
}

export function updateRetentionSettings(
  salonId: string,
  patch: Partial<RetentionSettings>
): SalonConciergeStateResponse {
  const store = ensureStoreLoaded();
  const current = ensureSalonExists(salonId);
  const updated: RetentionSettings = {
    ...current,
    ...patch,
    salonId,
    updatedAt: new Date().toISOString(),
  };
  if (patch.whatsappPhone) {
    const meta = detectRegionFromPhone(patch.whatsappPhone);
    updated.countryCode = meta.countryCode;
    updated.timezoneOffsetHours = meta.timezoneOffsetHours;
    updated.currency = meta.currency;
    updated.currencySymbol = meta.currencySymbol;
  }
  store.settingsBySalon[salonId] = updated;
  persistStore();
  return getSalonConciergeState(salonId);
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
  const normPhone = input.phone.replace(/\s+/g, '');
  let existing = store.clients.find(
    (c) => c.salonId === salonId && c.phone.replace(/\s+/g, '') === normPhone
  );
  if (!existing) {
    existing = {
      id: `cli-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      salonId,
      name: input.name?.trim() || 'Salon Client',
      phone: input.phone.trim(),
      preferredLanguage: input.preferredLanguage ?? null,
      awaitingLanguageSelection: input.preferredLanguage ? false : true,
      birthDate: (input.birthDate || '').trim(),
      lastCompletedVisitAt: null,
      lastBirthdaySentYear: null,
      lastWinbackSentAt: null,
      awaitingWinbackRebook: false,
      awaitingReviewAppointmentId: null,
    };
    store.clients.unshift(existing);
  } else {
    if (input.name && input.name.trim()) existing.name = input.name.trim();
    if (input.birthDate !== undefined) existing.birthDate = input.birthDate.trim();
    if (input.preferredLanguage !== undefined) {
      existing.preferredLanguage = input.preferredLanguage;
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

  const client = upsertClientProfile(salonId, {
    phone: payload.clientPhone,
    name: payload.clientName,
    birthDate: payload.birthDate,
  });
  if (!client.preferredLanguage) {
    client.preferredLanguage = defaultLang;
    client.awaitingLanguageSelection = false;
  }

  const nowIso = new Date().toISOString();
  client.lastCompletedVisitAt = nowIso;

  let appt = store.appointments.find(
    (a) => a.salonId === salonId && a.id === payload.appointmentId
  );
  if (!appt) {
    appt = {
      id: payload.appointmentId,
      salonId,
      clientId: client.id,
      clientName: payload.clientName,
      clientPhone: payload.clientPhone,
      barberName: payload.barberName,
      service: payload.service,
      price: payload.price,
      timeSlot: payload.timeSlot,
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
  const raw = payload.messageText.trim();
  const lower = raw.toLowerCase();

  let client = store.clients.find(
    (c) =>
      c.salonId === payload.salonId &&
      c.phone.replace(/\s+/g, '') === payload.fromPhone.replace(/\s+/g, '')
  );

  if (!client) {
    client = upsertClientProfile(payload.salonId, {
      phone: payload.fromPhone,
      name: payload.clientName || 'WhatsApp Client',
      preferredLanguage: null,
    });
  }

  const isGreeting = /^(hi|hello|hey|salam|assalam|assalamu|marhaba|السلام|مرحبا)/i.test(lower);

  appendLog(payload.salonId, {
    direction: 'INBOUND',
    module: client.awaitingReviewAppointmentId ? 'REVIEW_T2H' : 'LANGUAGE_MENU',
    clientName: client.name,
    clientPhone: client.phone,
    language: client.preferredLanguage || 'en',
    dir: getLangDirection(client.preferredLanguage || 'en'),
    body: raw,
  });

  // 1. Trigger Region-Aware Language Selector Menu on initial "Hi"/Greeting or explicit reset
  if (payload.forceLanguagePrompt || (!client.preferredLanguage && !client.awaitingLanguageSelection) || (isGreeting && !client.preferredLanguage)) {
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
  if (client.awaitingLanguageSelection) {
    const matchedOpt =
      menuOptions.find((o) => o.index === raw) ||
      menuOptions.find((o) => lower.includes(o.lang === 'roman_ur' ? 'roman' : o.lang === 'ur' ? 'urdu' : o.lang === 'ar' ? 'arab' : 'eng'));

    if (matchedOpt) {
      client.preferredLanguage = matchedOpt.lang;
      client.awaitingLanguageSelection = false;
      const dir = getLangDirection(matchedOpt.lang);

      const confirmationMap: Record<ClientPreferredLang, string> = {
        en: `Language locked: English. Welcome to ${settings.salonName}! Choose an option:\n1. Book Appointment\n2. Service Rates\n3. Location & Hours`,
        roman_ur: `Zuban set ho gayi: Roman Urdu. ${settings.salonName} mein khush amdeed! Option chunein:\n1. Appointment Book Karein\n2. Rates List\n3. Location aur Timing`,
        ur: `زبان محفوظ کر لی گئی: اردو۔ ${settings.salonName} میں خوش آمدید! منتخب کریں:\n1. اپائنٹمنٹ بک کریں\n2. ریٹ لسٹ\n3. لوکیشن اور اوقات`,
        ar: `تم تثبيت اللغة: العربية. أهلاً بك في ${settings.salonName}! اختر:\n1. حجز موعد\n2. قائمة الأسعار\n3. الموقع وساعات العمل`,
      };
      const replyText = confirmationMap[matchedOpt.lang];
      appendLog(payload.salonId, {
        direction: 'OUTBOUND',
        module: 'LANGUAGE_MENU',
        clientName: client.name,
        clientPhone: client.phone,
        language: matchedOpt.lang,
        dir,
        body: replyText,
      });
      persistStore();
      return {
        replyText,
        replyDir: dir,
        lockedLanguage: matchedOpt.lang,
        routedAction: `LANGUAGE_LOCKED_${matchedOpt.lang.toUpperCase()}`,
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

  const activeLang: ClientPreferredLang = client.preferredLanguage || 'en';
  const activeDir = getLangDirection(activeLang);

  // 3. Smart Reputation Routing for 1–5 Star Feedback (Module 4)
  const starMatch = raw.match(/^([1-5])(\s*(stars?|★|\*)?.*)?$/i);
  const reviewApptId = payload.appointmentIdForReview || client.awaitingReviewAppointmentId;
  if (starMatch && (reviewApptId || lower.includes('star') || raw.length <= 2)) {
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

  // 5. General localized concierge acknowledgment in locked preferred_language
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
  // Run initial sweep on boot for T+2h / 30d dormant / 9:00 AM window
  runBirthdayCron(undefined, false);
  runWinBackCron(undefined, false);
  runPostServiceReviewCron(undefined, false);

  return setInterval(() => {
    try {
      runBirthdayCron(undefined, false);
      runWinBackCron(undefined, false);
      runPostServiceReviewCron(undefined, false);
    } catch (err) {
      console.warn('Concierge background cron sweep error:', err);
    }
  }, 60 * 1000);
}
