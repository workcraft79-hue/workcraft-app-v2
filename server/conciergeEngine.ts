import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type {
  AdAttributionChannel,
  BookingAuditEntry,
  BookingManagementPayload,
  BridalBookingRecord,
  ChairLock,
  ClientPreferredLang,
  ConciergeAppointment,
  ConciergeClientProfile,
  CustomerActionMessageResponse,
  CustomerAvailabilityResponse,
  CustomerBarberAvailability,
  CustomerExperienceConfig,
  CustomerFlowBookingRequest,
  CustomerFlowBookingResponse,
  CustomerLanguageChoice,
  CustomerMenuActionId,
  CustomerSlotAvailability,
  CustomerWelcomeMenuResponse,
  DealDiscountType,
  LanguageMenuOption,
  MonthlyUsageMeter,
  OwnerInterventionAlert,
  PublicDealPageResponse,
  RetentionOpportunityItem,
  RetentionSettings,
  ReturningClientSnapshot,
  SalonBillingStatus,
  SalonCategory,
  SalonConciergeStateResponse,
  SalonDeal,
  SalonOperatingHours,
  SalonPackageTier,
  SalonRegionCode,
  SalonServiceRate,
  ServicePackagePass,
  StylistLeaveRecord,
  WalkInQueueItem,
  WhatsAppMessageLog,
} from '../src/types/concierge.js';
import { kvGetJson, kvSetJson } from './kvBridge.js';
import {
  findSalonByPublicCodeInPostgres,
  persistPostgresSnapshotMirror,
  recordBookingInPostgres,
} from './postgresRepo.js';
import {
  clampInteger,
  getSalonsAssignedToAgent,
  maskPhoneNumber,
  sanitizeBirthDate,
  sanitizeHttpUrl,
  sanitizeMultilineTemplate,
  sanitizePhone,
  sanitizePlainText,
  signCustomerRecognizeToken,
  verifyCustomerRecognizeToken,
} from './security.js';

interface BookingAccessTokenRecord {
  bookingId: string;
  salonId: string;
  expiresAtMs: number;
  revoked: boolean;
}

interface ConciergeStoreData {
  settingsBySalon: Record<string, RetentionSettings>;
  barbersBySalon: Record<string, string[]>;
  clients: ConciergeClientProfile[];
  appointments: ConciergeAppointment[];
  chairLocks: ChairLock[];
  stylistLeaves: StylistLeaveRecord[];
  bookingAuditLog: BookingAuditEntry[];
  bookingAccessTokens: Record<string, BookingAccessTokenRecord>;
  salonUsageMonthly: Record<string, Record<string, number>>;
  alerts: OwnerInterventionAlert[];
  logs: WhatsAppMessageLog[];
  walkInQueue: WalkInQueueItem[];
  bridalBookings: BridalBookingRecord[];
  servicePackages: ServicePackagePass[];
  deals: SalonDeal[];
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

const DATA_DIR = process.env.VERCEL
  ? path.join('/tmp', 'workcraft-data')
  : path.resolve(process.cwd(), '.data');
const STORE_FILE = path.join(DATA_DIR, 'concierge-store.json');
const DEAL_VIDEO_DIR = path.join(DATA_DIR, 'deal-videos');

const DEFAULT_SALON_OPERATING_HOURS: SalonOperatingHours = {
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
};

const SEEDED_SALON_ADDRESSES: Record<string, string> = {
  '1': 'Plot 42-C, Commercial Sector, DHA Phase 5, Lahore',
  '2': 'Shop 14, Main Boulevard, Gulberg III, Lahore',
  '3': 'Al Wasl Plaza, Jumeirah 1, Dubai, UAE',
  '4': '28 Brewer Street, Soho, London W1F 0SR, UK',
  '5': 'Building 9-B, Clifton Block 4, Karachi',
};

export const SEEDED_PUBLIC_CODES: Record<string, string> = {
  '1': 'wc_7k9m2p4x8q2a',
  '2': 'wc_3r8v5n2w9c4j',
  '3': 'wc_9p4d6t2m8y1k',
  '4': 'wc_5w2h8z4f7b3n',
  '5': 'wc_6m9q3x7v2p5d',
};

export const PLAN_QUOTAS: Record<SalonPackageTier, { limit: number; grace: number }> = {
  STARTER: { limit: 750, grace: 50 },
  PRO: { limit: 1500, grace: 100 },
  'PRO++': { limit: 3000, grace: 200 },
  CUSTOM: { limit: 10000, grace: 1000 },
};

function generateUnguessablePublicCode(salonId?: string): string {
  if (salonId && SEEDED_PUBLIC_CODES[salonId]) {
    return SEEDED_PUBLIC_CODES[salonId];
  }
  return `wc_${crypto.randomBytes(6).toString('hex')}`;
}

function detectTimezoneIana(countryCode: string): string {
  if (countryCode === '+92') return 'Asia/Karachi';
  if (countryCode === '+91') return 'Asia/Kolkata';
  if (countryCode === '+971' || countryCode === '+968') return 'Asia/Dubai';
  if (['+966', '+974', '+965', '+973'].includes(countryCode)) return 'Asia/Riyadh';
  if (countryCode === '+44') return 'Europe/London';
  if (countryCode === '+1') return 'America/Toronto';
  if (['+33', '+49', '+34', '+39', '+31', '+32', '+43', '+351', '+353', '+30', '+358'].includes(countryCode)) {
    return 'Europe/Berlin';
  }
  return 'Asia/Karachi';
}

function buildGoogleMapsSearchUrl(salonName: string, address: string): string {
  return `https://maps.google.com/?q=${encodeURIComponent(`${salonName} ${address}`.trim())}`;
}

export function getDefaultClientLanguagesForRegion(region: SalonRegionCode): ClientPreferredLang[] {
  if (region === 'PK') return ['en', 'roman_ur', 'ur'];
  return ['en', 'ur', 'ar'];
}

function getAllowedClientLanguagesForRegion(region: SalonRegionCode): ClientPreferredLang[] {
  if (region === 'PK') return ['en', 'roman_ur', 'ur'];
  return ['en', 'ur', 'ar'];
}

function normalizeClientLanguageList(
  langs: unknown,
  region: SalonRegionCode
): ClientPreferredLang[] {
  const allowed = getAllowedClientLanguagesForRegion(region);
  const allowedSet = new Set<ClientPreferredLang>(allowed);
  if (!Array.isArray(langs) || langs.length === 0) {
    return [...allowed];
  }
  const cleaned = langs.filter((l): l is ClientPreferredLang => allowedSet.has(l as ClientPreferredLang));
  if (!cleaned.includes('en')) cleaned.unshift('en');
  // Ensure MENA/Europe defaults include Urdu & Arabic and PK/IN defaults include Roman Urdu & Urdu cleanly
  for (const fallbackLang of allowed) {
    if (!cleaned.includes(fallbackLang)) cleaned.push(fallbackLang);
  }
  return Array.from(new Set(cleaned));
}

function getSalonLocalDateParts(offsetHours: number, nowDate = new Date()) {
  const utcMs = nowDate.getTime() + nowDate.getTimezoneOffset() * 60000;
  const local = new Date(utcMs + offsetHours * 3600000);
  const yyyy = local.getFullYear();
  const mm = String(local.getMonth() + 1).padStart(2, '0');
  const dd = String(local.getDate()).padStart(2, '0');
  return {
    dateStr: `${yyyy}-${mm}-${dd}`,
    minutesOfDay: local.getHours() * 60 + local.getMinutes(),
    dayOfWeek: local.getDay(), // 0=Sun .. 5=Fri .. 6=Sat
  };
}

function getIsoLocalDateStr(iso: string | undefined | null, offsetHours: number): string | null {
  if (!iso) return null;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return getSalonLocalDateParts(offsetHours, parsed).dateStr;
}

export function extractCountryCode(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, '');
  const prefixes = [
    '+971', '+966', '+974', '+965', '+968', '+973',
    '+351', '+353', '+358',
    '+92', '+91', '+44', '+33', '+49', '+34', '+39', '+31', '+32', '+43', '+30', '+1',
  ];
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
  if (cc === '+91') {
    return {
      region: 'PK',
      regionLabel: 'India (+91)',
      countryCode: cc,
      timezoneOffsetHours: 5.5,
      currency: 'INR',
      currencySymbol: '₹',
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
  const euroZoneCodes = new Set(['+33', '+49', '+34', '+39', '+31', '+32', '+43', '+351', '+353', '+30', '+358']);
  if (cc === '+44') {
    return {
      region: 'INTL',
      regionLabel: 'United Kingdom (+44)',
      countryCode: cc,
      timezoneOffsetHours: 0,
      currency: 'GBP',
      currencySymbol: '£',
    };
  }
  if (euroZoneCodes.has(cc)) {
    return {
      region: 'INTL',
      regionLabel: `Europe (${cc})`,
      countryCode: cc,
      timezoneOffsetHours: 1,
      currency: 'EUR',
      currencySymbol: '€',
    };
  }
  return {
    region: 'INTL',
    regionLabel: cc === '+1' ? 'USA / Canada (+1)' : `International (${cc})`,
    countryCode: cc,
    timezoneOffsetHours: cc === '+1' ? -5 : 1,
    currency: 'USD',
    currencySymbol: '$',
  };
}

export function getLanguageMenuForRegion(region: SalonRegionCode): LanguageMenuOption[] {
  if (region === 'PK') {
    return [
      { index: '1', digit: '1', lang: 'en', label: '1. English', nativeLabel: 'English', dir: 'ltr' },
      { index: '2', digit: '2', lang: 'roman_ur', label: '2. Roman Urdu', nativeLabel: 'Roman Urdu', dir: 'ltr' },
      { index: '3', digit: '3', lang: 'ur', label: '3. اردو (Urdu)', nativeLabel: 'اردو', dir: 'rtl' },
    ];
  }
  return [
    { index: '1', digit: '1', lang: 'en', label: '1. English', nativeLabel: 'English', dir: 'ltr' },
    { index: '2', digit: '2', lang: 'ur', label: '2. اردو (Urdu)', nativeLabel: 'اردو', dir: 'rtl' },
    { index: '3', digit: '3', lang: 'ar', label: '3. العربية (Arabic)', nativeLabel: 'العربية', dir: 'rtl' },
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
    return `Marhaba & Welcome to ${salonName}! Please choose your preferred language:\n${optionsLine}\nReply with 1, 2, or 3.`;
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

export function getDefaultServicesForCategory(
  category: SalonCategory,
  currency: string
): SalonServiceRate[] {
  const isSouthAsia = currency === 'PKR' || currency === 'INR';
  if (category === 'LADIES') {
    return [
      { id: 'l1', name: 'Signature Party Makeup & Styling', durationMins: 60, price: isSouthAsia ? 4500 : 280, active: true },
      { id: 'l2', name: 'Barat / Walima Bridal Package', durationMins: 150, price: isSouthAsia ? 35000 : 1800, active: true },
      { id: 'l3', name: 'Hydra-Facial & Skin Polish', durationMins: 50, price: isSouthAsia ? 3500 : 220, active: true },
      { id: 'l4', name: 'Keratin Hair Rebonding / Smoothing', durationMins: 120, price: isSouthAsia ? 12000 : 650, active: true },
      { id: 'l5', name: 'Mani-Pedi Classic Spa', durationMins: 45, price: isSouthAsia ? 2000 : 140, active: true },
    ];
  }
  return [
    { id: 's1', name: 'Master Haircut', durationMins: 35, price: isSouthAsia ? 600 : 50, active: true },
    { id: 's2', name: 'Skin Fade', durationMins: 30, price: isSouthAsia ? 500 : 45, active: true },
    { id: 's3', name: 'Classic Beard Trim', durationMins: 25, price: isSouthAsia ? 400 : 35, active: true },
    { id: 's4', name: 'Hot Towel Steam Shave', durationMins: 25, price: isSouthAsia ? 500 : 40, active: true },
    { id: 's5', name: 'Charcoal Deep Detox Facial', durationMins: 45, price: isSouthAsia ? 2500 : 150, active: true },
    { id: 's6', name: 'Groom Signature Package', durationMins: 120, price: isSouthAsia ? 12000 : 550, active: true },
  ];
}

function inferSalonCategory(salonName: string, salonId?: string, explicit?: SalonCategory): SalonCategory {
  if (explicit === 'LADIES' || explicit === 'MENS') return explicit;
  if (salonId === '5') return 'LADIES';
  const low = (salonName || '').toLowerCase();
  if (/parlor|parlour|ladies|beauty|bride|bridal|women/.test(low)) return 'LADIES';
  return 'MENS';
}

function defaultSettingsForSalon(
  salonId: string,
  salonName: string,
  ownerName: string,
  phone: string,
  packageTier: SalonPackageTier = 'PRO++',
  billingStatus: SalonBillingStatus = 'ACTIVE',
  salonCategory?: SalonCategory,
  enabledServices?: SalonServiceRate[]
): RetentionSettings {
  const regionMeta = detectRegionFromPhone(phone);
  const isPk = regionMeta.region === 'PK';
  const resolvedCategory = inferSalonCategory(salonName, salonId, salonCategory);
  const address =
    SEEDED_SALON_ADDRESSES[salonId] ||
    (regionMeta.region === 'MENA'
      ? 'Central Commercial Avenue, Dubai, UAE'
      : regionMeta.region === 'PK'
      ? 'Main Commercial Market, Lahore'
      : 'High Street Studio, London');
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
    metaPhoneNumberId: '',
    countryCode: regionMeta.countryCode,
    timezoneIana: detectTimezoneIana(regionMeta.countryCode),
    timezoneOffsetHours: regionMeta.timezoneOffsetHours,
    currency: regionMeta.currency,
    currencySymbol: regionMeta.currencySymbol,
    defaultLang: 'en',
    regionConfirmedByOwner: Boolean(SEEDED_PUBLIC_CODES[salonId]),
    salonCategory: resolvedCategory,
    enabledServices:
      Array.isArray(enabledServices) && enabledServices.length > 0
        ? enabledServices
        : getDefaultServicesForCategory(resolvedCategory, regionMeta.currency),
    address,
    googleMapsUrl: buildGoogleMapsSearchUrl(salonName, address),
    operatingHours: { ...DEFAULT_SALON_OPERATING_HOURS },
    enabledClientLanguages: getDefaultClientLanguagesForRegion(regionMeta.region),
    videoRetentionDaysAfterExpiry: 30,
    packageTier,
    billingStatus,
    counterSleptAt: null,
    birthdayEnabled: true,
    birthdayEventName: 'Birthday Special',
    birthdayDiscountPct: 20,
    birthdayFixedDiscount: isPk ? 500 : 25,
    birthdayGiftService: resolvedCategory === 'LADIES' ? 'Free Express Hair Mask & Blowdry' : 'Free Organic Hair Mask',
    birthdayMessageTemplate:
      'Happy Birthday {client_name}! Celebrate your special day with {salon_name}. Enjoy {offer_summary} on your next visit today!',
    winbackEnabled: true,
    winbackDays: 30,
    winbackDiscountPct: 15,
    winbackFixedDiscount: 0,
    winbackAddonService:
      resolvedCategory === 'LADIES' ? 'Complimentary Threading & Hair Spa Gloss' : 'Complimentary Express Hair Wash & Styling',
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

  const walkInQueue: WalkInQueueItem[] = [
    {
      id: 'wq-101',
      salonId: '1',
      clientName: 'Hassan Raza',
      phone: '+92 301 9988776',
      service: 'Master Haircut & Skin Fade',
      assignedStaff: 'Master Aslam',
      etaMinutes: 15,
      status: 'WAITING',
      createdAt: new Date(now - 10 * 60000).toISOString(),
    },
  ];

  const bridalBookings: BridalBookingRecord[] = [
    {
      id: 'br-501',
      salonId: '5',
      brideOrEventName: 'Zainab & Family Walima Suite',
      phone: '+92 332 8899110',
      packageName: 'Signature Barat / Walima Bridal Package',
      eventDate: 'Sat · 22 Nov 2026',
      trialDate: 'Thu · 20 Nov 2026',
      totalAmount: 35000,
      advancePaid: 15000,
      assignedStylist: 'Ayesha',
      homeService: false,
      status: 'ADVANCE_LOCKED',
      createdAt: daysAgoIso(2),
    },
  ];

  const servicePackages: ServicePackagePass[] = [
    {
      id: 'pkg-101',
      salonId: '1',
      clientName: 'Bilal Ahmed',
      phone: '+92 300 1234567',
      packageTitle: 'Monthly Hair & Beard VIP Pass (4 Visits)',
      totalSessions: 4,
      usedSessions: 1,
      pricePaid: 3600,
      updatedAt: daysAgoIso(5),
    },
    {
      id: 'pkg-501',
      salonId: '5',
      clientName: 'Hira Mansoor',
      phone: '+92 321 6677889',
      packageTitle: '5-Session HydraFacial & Skin Polish Pack',
      totalSessions: 5,
      usedSessions: 2,
      pricePaid: 14000,
      updatedAt: daysAgoIso(4),
    },
  ];

  const deals: SalonDeal[] = [
    {
      id: 'deal-1-vip',
      salonId: '1',
      title: 'Executive Haircut & Facial Combo (20% OFF)',
      description: 'Includes Master Haircut + Skin Fade + Charcoal Deep Detox Facial with priority chair access.',
      discountType: 'PCT',
      discountValue: 20,
      serviceIds: ['s1', 's2', 's5'],
      serviceNames: ['Master Haircut', 'Skin Fade', 'Charcoal Deep Detox Facial'],
      startsAt: daysAgoIso(1),
      expiresAt: new Date(now + 10 * 86400000).toISOString(),
      videoRetentionDaysAfterExpiry: 30,
      videoDeletedAt: null,
      active: true,
      createdAt: daysAgoIso(1),
    },
    {
      id: 'deal-3-dubai',
      salonId: '3',
      title: 'Jumeirah Executive Grooming Package',
      description: 'Master haircut, skin fade, classic beard trim, and hot towel shave bundle.',
      discountType: 'PCT',
      discountValue: 15,
      serviceIds: ['s1', 's2', 's3', 's4'],
      serviceNames: ['Master Haircut', 'Skin Fade', 'Classic Beard Trim', 'Hot Towel Steam Shave'],
      startsAt: daysAgoIso(1),
      expiresAt: new Date(now + 14 * 86400000).toISOString(),
      videoRetentionDaysAfterExpiry: 30,
      videoDeletedAt: null,
      active: true,
      createdAt: daysAgoIso(1),
    },
    {
      id: 'deal-5-bridal',
      salonId: '5',
      title: 'Hydra-Facial + Party Styling Glow Deal',
      description: 'Limited-time salon glow offer for ladies parlor bookings.',
      discountType: 'PCT',
      discountValue: 20,
      serviceIds: ['l1', 'l3'],
      serviceNames: ['Signature Party Makeup & Styling', 'Hydra-Facial & Skin Polish'],
      startsAt: daysAgoIso(1),
      expiresAt: new Date(now + 12 * 86400000).toISOString(),
      videoRetentionDaysAfterExpiry: 30,
      videoDeletedAt: null,
      active: true,
      createdAt: daysAgoIso(1),
    },
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
    alerts: [],
    logs: [],
    walkInQueue,
    bridalBookings,
    servicePackages,
    deals,
  };
}

let cachedStore: ConciergeStoreData | null = null;

function normalizeLoadedConciergeStore(parsed: Partial<ConciergeStoreData>): ConciergeStoreData {
  const seed = createInitialSeedData();
  const normalized: ConciergeStoreData = {
    settingsBySalon: parsed.settingsBySalon || seed.settingsBySalon,
    barbersBySalon: parsed.barbersBySalon || seed.barbersBySalon,
    clients: Array.isArray(parsed.clients) ? parsed.clients : seed.clients,
    appointments: Array.isArray(parsed.appointments) ? parsed.appointments : seed.appointments,
    chairLocks: Array.isArray(parsed.chairLocks) ? parsed.chairLocks : [],
    stylistLeaves: Array.isArray(parsed.stylistLeaves) ? parsed.stylistLeaves : [],
    bookingAuditLog: Array.isArray(parsed.bookingAuditLog) ? parsed.bookingAuditLog : [],
    bookingAccessTokens:
      parsed.bookingAccessTokens && typeof parsed.bookingAccessTokens === 'object'
        ? parsed.bookingAccessTokens
        : {},
    salonUsageMonthly:
      parsed.salonUsageMonthly && typeof parsed.salonUsageMonthly === 'object'
        ? parsed.salonUsageMonthly
        : {},
    alerts: Array.isArray(parsed.alerts) ? parsed.alerts : [],
    logs: Array.isArray(parsed.logs) ? parsed.logs : [],
    walkInQueue: Array.isArray(parsed.walkInQueue) ? parsed.walkInQueue : seed.walkInQueue,
    bridalBookings: Array.isArray(parsed.bridalBookings) ? parsed.bridalBookings : seed.bridalBookings,
    servicePackages: Array.isArray(parsed.servicePackages) ? parsed.servicePackages : seed.servicePackages,
    deals: Array.isArray(parsed.deals) ? parsed.deals : seed.deals,
  };
  const defaultTiers: Record<string, SalonPackageTier> = {
    '1': 'PRO++',
    '2': 'STARTER',
    '3': 'PRO++',
    '4': 'STARTER',
    '5': 'PRO',
  };
  for (const [sid, tier] of Object.entries(defaultTiers)) {
    if (normalized.settingsBySalon[sid] && !normalized.settingsBySalon[sid].packageTier) {
      normalized.settingsBySalon[sid].packageTier = tier;
    }
  }
  for (const s of Object.values(normalized.settingsBySalon)) {
    const regionMeta = detectRegionFromPhone(s.whatsappPhone || '+92');
    if (!s.publicCode || !s.publicCode.startsWith('wc_')) {
      s.publicCode = generateUnguessablePublicCode(s.salonId);
    }
    if (!s.ownerAuthPhone) {
      s.ownerAuthPhone = s.whatsappPhone || '+92 300 0000000';
    }
    if (!s.publicContactPhone) {
      s.publicContactPhone = s.whatsappPhone || s.ownerAuthPhone;
    }
    if (s.publicWhatsappPhone === undefined) {
      s.publicWhatsappPhone = s.publicContactPhone;
    }
    if (typeof s.whatsappAddonEnabled !== 'boolean') {
      s.whatsappAddonEnabled = false;
    }
    if (!s.timezoneIana) {
      s.timezoneIana = detectTimezoneIana(regionMeta.countryCode);
    }
    if (!s.defaultLang) {
      s.defaultLang = 'en';
    }
    if (typeof s.regionConfirmedByOwner !== 'boolean') {
      s.regionConfirmedByOwner = Boolean(SEEDED_PUBLIC_CODES[s.salonId]);
    }
    if (!s.salonCategory) {
      s.salonCategory = inferSalonCategory(s.salonName, s.salonId);
    }
    if (!Array.isArray(s.enabledServices) || s.enabledServices.length === 0) {
      s.enabledServices = getDefaultServicesForCategory(s.salonCategory, s.currency);
    } else if (s.enabledServices.some((svc) => svc.name === 'Master Haircut & Skin Fade')) {
      const expanded: SalonServiceRate[] = [];
      for (const svc of s.enabledServices) {
        if (svc.name === 'Master Haircut & Skin Fade') {
          expanded.push(
            {
              id: 's1',
              name: 'Master Haircut',
              durationMins: 35,
              price: Math.max(200, Math.round((svc.price || 800) * 0.65)),
              active: svc.active !== false,
            },
            {
              id: 's2-fade',
              name: 'Skin Fade',
              durationMins: 30,
              price: Math.max(200, Math.round((svc.price || 800) * 0.55)),
              active: svc.active !== false,
            }
          );
        } else {
          expanded.push(svc);
        }
      }
      s.enabledServices = expanded;
    }
    if (!s.address) {
      s.address =
        SEEDED_SALON_ADDRESSES[s.salonId] ||
        (regionMeta.region === 'MENA'
          ? 'Central Commercial Avenue, Dubai, UAE'
          : regionMeta.region === 'PK'
          ? 'Main Commercial Market, Lahore'
          : 'High Street Studio, London');
    }
    if (!s.googleMapsUrl) {
      s.googleMapsUrl = buildGoogleMapsSearchUrl(s.salonName, s.address);
    }
    if (!s.operatingHours) {
      s.operatingHours = { ...DEFAULT_SALON_OPERATING_HOURS };
    }
    s.enabledClientLanguages = normalizeClientLanguageList(
      s.enabledClientLanguages,
      regionMeta.region
    );
    if (typeof s.videoRetentionDaysAfterExpiry !== 'number') {
      s.videoRetentionDaysAfterExpiry = 30;
    }
  }
  return normalized;
}

interface ShardedSalonConciergeDoc {
  settings: RetentionSettings;
  clients: ConciergeClientProfile[];
  appointments: ConciergeAppointment[];
  chairLocks: ChairLock[];
  stylistLeaves?: StylistLeaveRecord[];
  bookingAuditLog?: BookingAuditEntry[];
  bookingAccessTokens?: Record<string, BookingAccessTokenRecord>;
  salonUsageMonthly?: Record<string, number>;
  barbers: string[];
  alerts: OwnerInterventionAlert[];
  logs: WhatsAppMessageLog[];
  walkInQueue: WalkInQueueItem[];
  bridalBookings: BridalBookingRecord[];
  servicePackages: ServicePackagePass[];
  deals: SalonDeal[];
}

export async function hydrateConciergeStoreFromKv(): Promise<void> {
  const indexIds = await kvGetJson<string[]>('wc:concierge:salons:index:v1');
  if (Array.isArray(indexIds) && indexIds.length > 0) {
    const shardDocs = await Promise.all(
      indexIds.map((sid) => kvGetJson<ShardedSalonConciergeDoc>(`wc:concierge:salon:${sid}`))
    );
    const merged: Partial<ConciergeStoreData> = {
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
      deals: [],
    };
    let loadedAny = false;
    indexIds.forEach((sid, idx) => {
      const doc = shardDocs[idx];
      if (!doc || !doc.settings) return;
      loadedAny = true;
      merged.settingsBySalon![sid] = doc.settings;
      if (Array.isArray(doc.clients)) merged.clients!.push(...doc.clients);
      if (Array.isArray(doc.appointments)) merged.appointments!.push(...doc.appointments);
      if (Array.isArray(doc.chairLocks)) merged.chairLocks!.push(...doc.chairLocks);
      if (Array.isArray(doc.stylistLeaves)) merged.stylistLeaves!.push(...doc.stylistLeaves);
      if (Array.isArray(doc.bookingAuditLog)) merged.bookingAuditLog!.push(...doc.bookingAuditLog);
      if (doc.bookingAccessTokens && typeof doc.bookingAccessTokens === 'object') {
        Object.assign(merged.bookingAccessTokens!, doc.bookingAccessTokens);
      }
      if (doc.salonUsageMonthly && typeof doc.salonUsageMonthly === 'object') {
        merged.salonUsageMonthly![sid] = doc.salonUsageMonthly;
      }
      if (Array.isArray(doc.barbers)) merged.barbersBySalon![sid] = doc.barbers;
      if (Array.isArray(doc.alerts)) merged.alerts!.push(...doc.alerts);
      if (Array.isArray(doc.logs)) merged.logs!.push(...doc.logs);
      if (Array.isArray(doc.walkInQueue)) merged.walkInQueue!.push(...doc.walkInQueue);
      if (Array.isArray(doc.bridalBookings)) merged.bridalBookings!.push(...doc.bridalBookings);
      if (Array.isArray(doc.servicePackages)) merged.servicePackages!.push(...doc.servicePackages);
      if (Array.isArray(doc.deals)) merged.deals!.push(...doc.deals);
    });
    if (loadedAny) {
      cachedStore = normalizeLoadedConciergeStore(merged);
      return;
    }
  }

  const remote = await kvGetJson<Partial<ConciergeStoreData>>('wc:concierge:v1');
  if (!remote || !remote.settingsBySalon || !Array.isArray(remote.clients)) return;
  cachedStore = normalizeLoadedConciergeStore(remote);
}

function ensureStoreLoaded(): ConciergeStoreData {
  if (cachedStore) return cachedStore;
  try {
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<ConciergeStoreData>;
      if (parsed && parsed.settingsBySalon && Array.isArray(parsed.clients)) {
        cachedStore = normalizeLoadedConciergeStore(parsed);
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

function persistStore(changedSalonId?: string) {
  if (!cachedStore) return;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STORE_FILE, JSON.stringify(cachedStore, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Could not persist concierge store:', err);
  }
  const salonIds = Object.keys(cachedStore.settingsBySalon);
  const targetIds = changedSalonId && cachedStore.settingsBySalon[changedSalonId] ? [changedSalonId] : salonIds;
  void kvSetJson('wc:concierge:salons:index:v1', salonIds);
  for (const sid of targetIds) {
    const salonTokens: Record<string, BookingAccessTokenRecord> = {};
    for (const [hash, rec] of Object.entries(cachedStore.bookingAccessTokens || {})) {
      if (rec.salonId === sid) salonTokens[hash] = rec;
    }
    const doc: ShardedSalonConciergeDoc = {
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
      deals: (cachedStore.deals || []).filter((d) => d.salonId === sid),
    };
    void kvSetJson(`wc:concierge:salon:${sid}`, doc);
  }
}

function ensureSalonExists(
  salonId: string,
  meta?: {
    salonName?: string;
    ownerName?: string;
    whatsappPhone?: string;
    billingStatus?: SalonBillingStatus;
    packageTier?: SalonPackageTier;
    salonCategory?: SalonCategory;
    enabledServices?: SalonServiceRate[];
  }
): RetentionSettings {
  const store = ensureStoreLoaded();
  if (!store.settingsBySalon[salonId]) {
    store.settingsBySalon[salonId] = defaultSettingsForSalon(
      salonId,
      meta?.salonName || 'WorkCraft Salon',
      meta?.ownerName || 'Salon Owner',
      meta?.whatsappPhone || '+92 300 0000000',
      meta?.packageTier || 'PRO++',
      meta?.billingStatus || 'ACTIVE',
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

export function resolveSalonIdByPublicCode(publicCode: string): string | null {
  const clean = (publicCode || '').trim();
  if (!clean || !clean.startsWith('wc_')) {
    return null;
  }
  const store = ensureStoreLoaded();
  const match = Object.values(store.settingsBySalon).find((s) => s.publicCode === clean);
  return match ? match.salonId : null;
}

export async function resolveSalonIdByPublicCodeAsync(publicCode: string): Promise<string | null> {
  const clean = (publicCode || '').trim();
  if (!clean || !clean.startsWith('wc_')) {
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
  const tier: SalonPackageTier =
    pgSalon.planTier === 'STARTER' ||
    pgSalon.planTier === 'PRO' ||
    pgSalon.planTier === 'PRO++' ||
    pgSalon.planTier === 'CUSTOM'
      ? pgSalon.planTier
      : 'PRO++';
  const billingStatus: SalonBillingStatus =
    pgSalon.billingStatus === 'PENDING_ACTIVATION' ||
    pgSalon.billingStatus === 'PAST_DUE' ||
    pgSalon.billingStatus === 'SUSPENDED'
      ? pgSalon.billingStatus
      : 'ACTIVE';
  const base = defaultSettingsForSalon(
    hydratedId,
    pgSalon.salonName,
    'Salon Owner',
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
    timezoneOffsetHours: Number.isFinite(pgSalon.timezoneOffsetHours)
      ? pgSalon.timezoneOffsetHours
      : base.timezoneOffsetHours,
    currency: pgSalon.currencyCode || base.currency,
    currencySymbol: pgSalon.currencySymbol || base.currencySymbol,
    defaultLang: pgSalon.defaultLang || base.defaultLang,
    enabledClientLanguages:
      pgSalon.enabledLangs.length > 0 ? pgSalon.enabledLangs : base.enabledClientLanguages,
    whatsappAddonEnabled: pgSalon.whatsappAddonEnabled,
    address: pgSalon.address || base.address,
    googleMapsUrl: pgSalon.googleMapsUrl || base.googleMapsUrl,
    googleReviewUrl: pgSalon.googleReviewUrl || base.googleReviewUrl,
  };
  return hydratedId;
}

export function findSalonIdByMetaPhoneNumberId(phoneNumberId: string): string | null {
  const clean = (phoneNumberId || '').trim();
  if (!clean) return null;
  const store = ensureStoreLoaded();
  const match = Object.values(store.settingsBySalon).find(
    (s) => Boolean(s.whatsappAddonEnabled) && (s.metaPhoneNumberId || '').trim() === clean
  );
  return match ? match.salonId : null;
}

function getSalonBillingMonthKey(settings: RetentionSettings): string {
  return getSalonLocalDateParts(settings.timezoneOffsetHours).dateStr.slice(0, 7);
}

export function getMonthlyUsageSnapshot(salonId: string): MonthlyUsageMeter {
  const store = ensureStoreLoaded();
  const settings = ensureSalonExists(salonId);
  const billingMonth = getSalonBillingMonthKey(settings);
  const tier: SalonPackageTier = PLAN_QUOTAS[settings.packageTier] ? settings.packageTier : 'PRO++';
  const quota = PLAN_QUOTAS[tier];
  const recordedCount = Number(store.salonUsageMonthly?.[salonId]?.[billingMonth] ?? 0);
  const billableBookings = Math.max(0, recordedCount);
  const overageBookings = Math.max(0, billableBookings - quota.limit);
  const remainingInPlan = Math.max(0, quota.limit - billableBookings);
  const pctUsed = quota.limit > 0 ? Math.min(200, Math.round((billableBookings / quota.limit) * 100)) : 0;

  let status: MonthlyUsageMeter['status'] = 'OK';
  if (billableBookings >= quota.limit + quota.grace) {
    status = 'BLOCKED';
  } else if (billableBookings >= quota.limit) {
    status = 'GRACE';
  } else if (pctUsed >= 90) {
    status = 'WARN_90';
  } else if (pctUsed >= 80) {
    status = 'WARN_80';
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
  };
}

function incrementMonthlyUsage(salonId: string) {
  const store = ensureStoreLoaded();
  const settings = ensureSalonExists(salonId);
  const billingMonth = getSalonBillingMonthKey(settings);
  if (!store.salonUsageMonthly[salonId]) {
    store.salonUsageMonthly[salonId] = {};
  }
  store.salonUsageMonthly[salonId][billingMonth] =
    Number(store.salonUsageMonthly[salonId][billingMonth] ?? 0) + 1;
}

function appendBookingAudit(
  salonId: string,
  bookingId: string,
  actorType: BookingAuditEntry['actorType'],
  action: BookingAuditEntry['action'],
  note: string
) {
  const store = ensureStoreLoaded();
  const entry: BookingAuditEntry = {
    id: `aud-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    salonId,
    bookingId,
    actorType,
    action,
    note: sanitizePlainText(note, 260),
    createdAt: new Date().toISOString(),
  };
  store.bookingAuditLog = [entry, ...(store.bookingAuditLog || [])].slice(0, 1200);
}

function syncSalonSettingsToPostgres(settings: RetentionSettings) {
  const tier: SalonPackageTier = PLAN_QUOTAS[settings.packageTier] ? settings.packageTier : 'PRO++';
  const quota = PLAN_QUOTAS[tier];
  void persistPostgresSnapshotMirror({
    salonId: settings.salonId,
    publicCode: settings.publicCode,
    salonName: settings.salonName,
    salonCategory: settings.salonCategory,
    ownerAuthPhone: settings.ownerAuthPhone || settings.whatsappPhone,
    publicContactPhone: settings.publicContactPhone || settings.whatsappPhone,
    publicWhatsappPhone: settings.publicWhatsappPhone,
    timezoneIana: settings.timezoneIana || 'Asia/Karachi',
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
    googleReviewUrl: settings.googleReviewUrl,
  });
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
    const eventLabel = settings.birthdayEventName?.trim() || 'Special Event';
    const joined = parts.join(' + ') || 'VIP Priority Chair';
    if (lang === 'ur') return `${eventLabel}: ${joined}`;
    if (lang === 'ar') return `${eventLabel}: ${joined}`;
    if (lang === 'roman_ur') return `${eventLabel}: ${joined}`;
    return `${eventLabel} (${joined})`;
  }

  const parts: string[] = [];
  if (settings.winbackDiscountPct > 0) {
    parts.push(`${settings.winbackDiscountPct}% OFF`);
  }
  if ((settings.winbackFixedDiscount ?? 0) > 0) {
    parts.push(`${settings.currencySymbol}${Number(settings.winbackFixedDiscount).toLocaleString()} OFF`);
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

function resolveClientConversationLang(
  client: ConciergeClientProfile | undefined,
  rawText: string,
  region: SalonRegionCode
): ClientPreferredLang {
  if (client?.preferredLanguage) return client.preferredLanguage;
  const trimmed = (rawText || '').trim();
  const isIndiaPhone = (client?.phone || '').replace(/\s+/g, '').startsWith('+91');
  if (/[\u0679\u0688\u0691\u06BA\u06BE\u06C1\u06D2\u06AF]/.test(trimmed)) return 'ur';
  if (/[\u0600-\u06FF]/.test(trimmed)) return region === 'PK' || isIndiaPhone ? 'ur' : 'ar';
  if (region === 'PK' || isIndiaPhone) return 'roman_ur';
  if (region === 'MENA') return 'ar';
  return 'en';
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
  // Keep up to 200 recent logs per salon cleanly
  let salonCount = 0;
  store.logs = store.logs.filter((log) => {
    if (log.salonId !== salonId) return true;
    salonCount += 1;
    return salonCount <= 200;
  });
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
  durationMins = 35,
  targetDateStr?: string,
  demoBusyBarber?: string,
  demoBusyTimeSlot?: string
): { busy: boolean; busyUntilMinutes: number; reason?: string } {
  const store = ensureStoreLoaded();
  const settings = ensureSalonExists(salonId);
  const todayDateStr = getSalonLocalDateParts(settings.timezoneOffsetHours).dateStr;
  const resolvedTargetDate = targetDateStr || todayDateStr;
  const endMinutes = startMinutes + durationMins;
  const normTarget = barberName.toLowerCase();

  if (demoBusyBarber) {
    const normDemo = demoBusyBarber.trim().toLowerCase();
    const matchesDemoBarber =
      normDemo === normTarget ||
      normTarget.includes(normDemo) ||
      normDemo.includes(normTarget.split(' ')[0]);
    if (matchesDemoBarber) {
      if (!demoBusyTimeSlot) {
        return {
          busy: true,
          busyUntilMinutes: endMinutes,
          reason: 'Barber Busy (Demo Test)',
        };
      }
      const demoStart = parseTimeSlotToMinutes(demoBusyTimeSlot);
      if (demoStart >= 0 && startMinutes < demoStart + 45 && endMinutes > demoStart) {
        return {
          busy: true,
          busyUntilMinutes: demoStart + 45,
          reason: `Booked at ${demoBusyTimeSlot} (Demo Test)`,
        };
      }
    }
  }

  for (const lock of store.chairLocks) {
    if (lock.salonId !== salonId) continue;
    const lockDateStr = getIsoLocalDateStr(lock.createdAt, settings.timezoneOffsetHours) || todayDateStr;
    if (lockDateStr !== resolvedTargetDate) continue;
    if (
      lock.barberName.toLowerCase() === normTarget ||
      lock.barberName.toLowerCase().includes(normTarget) ||
      normTarget.includes(lock.barberName.toLowerCase().split(' ')[0])
    ) {
      if (startMinutes < lock.endMinutes && endMinutes > lock.startMinutes) {
        return {
          busy: true,
          busyUntilMinutes: lock.endMinutes,
          reason: `Chair Locked (${lock.startTimeSlot}–${lock.endTimeSlot})`,
        };
      }
    }
  }

  for (const lv of store.stylistLeaves || []) {
    if (lv.salonId !== salonId) continue;
    if (lv.date !== resolvedTargetDate) continue;
    const normLeaveStylist = lv.stylistName.toLowerCase();
    if (
      normLeaveStylist === normTarget ||
      normLeaveStylist.includes(normTarget) ||
      normTarget.includes(normLeaveStylist.split(' ')[0])
    ) {
      if (lv.fullDay !== false && !lv.startTime && !lv.endTime) {
        return {
          busy: true,
          busyUntilMinutes: 1440,
          reason: lv.reason || 'Stylist on Leave',
        };
      }
      const lvStart = lv.startTime ? parseTimeSlotToMinutes(lv.startTime) : 0;
      const lvEnd = lv.endTime ? parseTimeSlotToMinutes(lv.endTime) : 1440;
      if (lvStart >= 0 && lvEnd > lvStart && startMinutes < lvEnd && endMinutes > lvStart) {
        return {
          busy: true,
          busyUntilMinutes: lvEnd,
          reason: lv.reason || `On Leave (${lv.startTime}–${lv.endTime})`,
        };
      }
    }
  }

  for (const appt of store.appointments) {
    if (appt.salonId !== salonId || appt.status === 'COMPLETED' || appt.status === 'CANCELED' || appt.canceled) {
      continue;
    }
    const apptDateStr =
      appt.appointmentDate ||
      getIsoLocalDateStr(appt.scheduledForIso, settings.timezoneOffsetHours) ||
      todayDateStr;
    if (apptDateStr !== resolvedTargetDate) continue;

    if (
      appt.barberName.toLowerCase() === normTarget ||
      appt.barberName.toLowerCase().includes(normTarget) ||
      normTarget.includes(appt.barberName.toLowerCase().split(' ')[0])
    ) {
      const apptStart = parseTimeSlotToMinutes(appt.timeSlot);
      if (apptStart >= 0) {
        const apptEnd = apptStart + (appt.durationMins || 35);
        if (startMinutes < apptEnd && endMinutes > apptStart) {
          return {
            busy: true,
            busyUntilMinutes: apptEnd,
            reason: `Booked (${appt.timeSlot})`,
          };
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
  meta?: {
    salonName?: string;
    ownerName?: string;
    whatsappPhone?: string;
    billingStatus?: SalonBillingStatus;
    packageTier?: SalonPackageTier;
    salonCategory?: SalonCategory;
    enabledServices?: SalonServiceRate[];
  }
): SalonConciergeStateResponse {
  const store = ensureStoreLoaded();
  const settings = ensureSalonExists(salonId, meta);
  if (!settings.billingStatus) {
    settings.billingStatus = 'ACTIVE';
  }
  if (!settings.salonCategory) {
    settings.salonCategory = inferSalonCategory(settings.salonName, salonId);
  }
  if (!Array.isArray(settings.enabledServices) || settings.enabledServices.length === 0) {
    settings.enabledServices = getDefaultServicesForCategory(settings.salonCategory, settings.currency);
  }
  runAutoCompleteAppointmentsCron(salonId);
  runDealExpiryAndVideoRetentionCron(salonId);
  const regionMeta = detectRegionFromPhone(settings.whatsappPhone);
  const languageOptions = getLanguageMenuForRegion(regionMeta.region);
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
    bookingAuditLog: (store.bookingAuditLog || []).filter((e) => e.salonId === salonId).slice(0, 80),
  };
}

export function updateRetentionSettings(
  salonId: string,
  patch: Partial<RetentionSettings>
): SalonConciergeStateResponse {
  const store = ensureStoreLoaded();
  const current = ensureSalonExists(salonId);
  const regionMeta = detectRegionFromPhone(patch.whatsappPhone || patch.ownerAuthPhone || current.whatsappPhone);
  const cleanCategory: SalonCategory | undefined =
    patch.salonCategory === 'LADIES' || patch.salonCategory === 'MENS' ? patch.salonCategory : undefined;
  const cleanServices: SalonServiceRate[] | undefined = Array.isArray(patch.enabledServices)
    ? patch.enabledServices
        .slice(0, 30)
        .map((svc, idx) => ({
          id: sanitizePlainText(svc?.id || `svc-${idx + 1}`, 40),
          name: sanitizePlainText(svc?.name, 80),
          price: clampInteger(svc?.price, 0, 500000, 1000),
          durationMins: clampInteger(svc?.durationMins ?? 35, 5, 360, 35),
          bufferAfterMins:
            svc?.bufferAfterMins !== undefined
              ? clampInteger(svc.bufferAfterMins, 0, 120, 0)
              : undefined,
          eligibleStylists: Array.isArray(svc?.eligibleStylists)
            ? svc.eligibleStylists.map((st) => sanitizePlainText(st, 60)).filter(Boolean).slice(0, 20)
            : undefined,
          active: svc?.active !== false,
        }))
        .filter((s) => Boolean(s.name))
    : undefined;

  const cleanOperatingHours: SalonOperatingHours | undefined = patch.operatingHours
    ? {
        monThuOpen: sanitizePlainText(patch.operatingHours.monThuOpen, 20) || current.operatingHours?.monThuOpen || '11:00 AM',
        monThuClose: sanitizePlainText(patch.operatingHours.monThuClose, 20) || current.operatingHours?.monThuClose || '11:00 PM',
        monThuClosed: Boolean(patch.operatingHours.monThuClosed),
        fridayOpen: sanitizePlainText(patch.operatingHours.fridayOpen, 20) || current.operatingHours?.fridayOpen || '11:00 AM',
        fridayClose: sanitizePlainText(patch.operatingHours.fridayClose, 20) || current.operatingHours?.fridayClose || '11:30 PM',
        fridayBreakStart: sanitizePlainText(patch.operatingHours.fridayBreakStart, 20) || current.operatingHours?.fridayBreakStart || '01:00 PM',
        fridayBreakEnd: sanitizePlainText(patch.operatingHours.fridayBreakEnd, 20) || current.operatingHours?.fridayBreakEnd || '02:30 PM',
        fridayClosed: Boolean(patch.operatingHours.fridayClosed),
        satSunOpen: sanitizePlainText(patch.operatingHours.satSunOpen, 20) || current.operatingHours?.satSunOpen || '10:30 AM',
        satSunClose: sanitizePlainText(patch.operatingHours.satSunClose, 20) || current.operatingHours?.satSunClose || '11:30 PM',
        satSunClosed: Boolean(patch.operatingHours.satSunClosed),
      }
    : current.operatingHours;

  const nextAddress =
    patch.address !== undefined
      ? sanitizePlainText(patch.address, 220) || current.address || ''
      : current.address;
  const nextSalonName =
    patch.salonName !== undefined
      ? sanitizePlainText(patch.salonName, 100) || current.salonName
      : current.salonName;
  const validTier: SalonPackageTier | undefined =
    patch.packageTier === 'STARTER' ||
    patch.packageTier === 'PRO' ||
    patch.packageTier === 'PRO++' ||
    patch.packageTier === 'CUSTOM'
      ? patch.packageTier
      : undefined;
  const validDefaultLang: ClientPreferredLang | undefined =
    patch.defaultLang === 'en' ||
    patch.defaultLang === 'roman_ur' ||
    patch.defaultLang === 'ur' ||
    patch.defaultLang === 'ar'
      ? patch.defaultLang
      : undefined;

  const safePatch: Partial<RetentionSettings> = {
    salonName: nextSalonName,
    ownerName: patch.ownerName !== undefined ? sanitizePlainText(patch.ownerName, 80) || current.ownerName : current.ownerName,
    ownerAuthPhone:
      patch.ownerAuthPhone !== undefined
        ? sanitizePhone(patch.ownerAuthPhone) || current.ownerAuthPhone
        : current.ownerAuthPhone,
    publicContactPhone:
      patch.publicContactPhone !== undefined
        ? sanitizePhone(patch.publicContactPhone) || current.publicContactPhone
        : current.publicContactPhone,
    publicWhatsappPhone:
      patch.publicWhatsappPhone !== undefined
        ? sanitizePhone(patch.publicWhatsappPhone)
        : current.publicWhatsappPhone,
    whatsappPhone: patch.whatsappPhone !== undefined ? sanitizePhone(patch.whatsappPhone) || current.whatsappPhone : current.whatsappPhone,
    whatsappAddonEnabled:
      patch.whatsappAddonEnabled !== undefined
        ? Boolean(patch.whatsappAddonEnabled)
        : current.whatsappAddonEnabled,
    metaPhoneNumberId:
      patch.metaPhoneNumberId !== undefined
        ? sanitizePlainText(patch.metaPhoneNumberId, 64)
        : current.metaPhoneNumberId,
    timezoneIana:
      patch.timezoneIana !== undefined
        ? sanitizePlainText(patch.timezoneIana, 64) || current.timezoneIana
        : current.timezoneIana,
    defaultLang: validDefaultLang || current.defaultLang || 'en',
    regionConfirmedByOwner:
      patch.regionConfirmedByOwner !== undefined
        ? Boolean(patch.regionConfirmedByOwner)
        : current.regionConfirmedByOwner,
    packageTier: validTier || current.packageTier,
    salonCategory: cleanCategory || current.salonCategory || inferSalonCategory(current.salonName, salonId),
    enabledServices: cleanServices && cleanServices.length > 0 ? cleanServices : current.enabledServices,
    address: nextAddress,
    googleMapsUrl:
      patch.googleMapsUrl !== undefined
        ? sanitizeHttpUrl(patch.googleMapsUrl, buildGoogleMapsSearchUrl(nextSalonName, nextAddress || ''))
        : current.googleMapsUrl || buildGoogleMapsSearchUrl(nextSalonName, nextAddress || ''),
    operatingHours: cleanOperatingHours,
    enabledClientLanguages:
      patch.enabledClientLanguages !== undefined
        ? normalizeClientLanguageList(patch.enabledClientLanguages, regionMeta.region)
        : normalizeClientLanguageList(current.enabledClientLanguages, regionMeta.region),
    videoRetentionDaysAfterExpiry:
      patch.videoRetentionDaysAfterExpiry !== undefined
        ? clampInteger(patch.videoRetentionDaysAfterExpiry, 1, 365, 30)
        : current.videoRetentionDaysAfterExpiry ?? 30,
    birthdayEnabled: patch.birthdayEnabled !== undefined ? Boolean(patch.birthdayEnabled) : current.birthdayEnabled,
    birthdayEventName:
      patch.birthdayEventName !== undefined
        ? sanitizePlainText(patch.birthdayEventName, 80) || 'Birthday Special'
        : current.birthdayEventName || 'Birthday Special',
    birthdayDiscountPct:
      patch.birthdayDiscountPct !== undefined
        ? clampInteger(patch.birthdayDiscountPct, 0, 100, 0)
        : current.birthdayDiscountPct,
    birthdayFixedDiscount:
      patch.birthdayFixedDiscount !== undefined
        ? clampInteger(patch.birthdayFixedDiscount, 0, 100000, 0)
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
        ? clampInteger(patch.winbackDiscountPct, 0, 100, 0)
        : current.winbackDiscountPct,
    winbackFixedDiscount:
      patch.winbackFixedDiscount !== undefined
        ? clampInteger(patch.winbackFixedDiscount, 0, 100000, 0)
        : current.winbackFixedDiscount ?? 0,
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
  if ((safePatch.whatsappPhone && patch.whatsappPhone) || (safePatch.ownerAuthPhone && patch.ownerAuthPhone)) {
    updated.countryCode = regionMeta.countryCode;
    updated.timezoneOffsetHours = regionMeta.timezoneOffsetHours;
    updated.timezoneIana = updated.timezoneIana || detectTimezoneIana(regionMeta.countryCode);
    updated.currency = regionMeta.currency;
    updated.currencySymbol = regionMeta.currencySymbol;
  }
  store.settingsBySalon[salonId] = updated;
  syncSalonSettingsToPostgres(updated);
  persistStore(salonId);
  return getSalonConciergeState(salonId);
}

export function addWalkInQueueItem(
  salonId: string,
  input: {
    clientName: string;
    phone?: string;
    service: string;
    assignedStaff?: string;
    etaMinutes?: number;
  }
): SalonConciergeStateResponse {
  const store = ensureStoreLoaded();
  ensureSalonExists(salonId);
  const barbers = getSalonBarbers(salonId);
  const item: WalkInQueueItem = {
    id: `wq-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 4)}`,
    salonId,
    clientName: sanitizePlainText(input.clientName, 80) || 'Walk-In Guest',
    phone: sanitizePhone(input.phone || '') || '',
    service: sanitizePlainText(input.service, 100) || 'Express Service',
    assignedStaff: sanitizePlainText(input.assignedStaff, 60) || barbers[0] || 'Next Available',
    etaMinutes: clampInteger(input.etaMinutes ?? 15, 5, 180, 15),
    status: 'WAITING',
    createdAt: new Date().toISOString(),
  };
  store.walkInQueue.unshift(item);
  store.walkInQueue = store.walkInQueue.slice(0, 60);
  persistStore();
  return getSalonConciergeState(salonId);
}

export function updateWalkInQueueStatus(
  salonId: string,
  itemId: string,
  status: 'WAITING' | 'NOTIFIED' | 'SEATED'
): SalonConciergeStateResponse {
  const store = ensureStoreLoaded();
  const target = store.walkInQueue.find((w) => w.salonId === salonId && w.id === itemId);
  if (target) {
    target.status = status;
    persistStore();
  }
  return getSalonConciergeState(salonId);
}

export function upsertBridalBooking(
  salonId: string,
  input: {
    brideOrEventName: string;
    phone: string;
    packageName: string;
    eventDate: string;
    trialDate?: string;
    totalAmount: number;
    advancePaid: number;
    assignedStylist?: string;
    homeService?: boolean;
  }
): SalonConciergeStateResponse {
  const store = ensureStoreLoaded();
  ensureSalonExists(salonId);
  const totalAmount = clampInteger(input.totalAmount, 0, 2000000, 25000);
  const advancePaid = clampInteger(input.advancePaid, 0, totalAmount, 0);
  const barbers = getSalonBarbers(salonId);
  const record: BridalBookingRecord = {
    id: `br-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 4)}`,
    salonId,
    brideOrEventName: sanitizePlainText(input.brideOrEventName, 100) || 'Bridal Event',
    phone: sanitizePhone(input.phone || '') || '+92 300 0000000',
    packageName: sanitizePlainText(input.packageName, 100) || 'Bridal Makeup & Styling',
    eventDate: sanitizePlainText(input.eventDate, 40) || 'Upcoming Event',
    trialDate: input.trialDate ? sanitizePlainText(input.trialDate, 40) : undefined,
    totalAmount,
    advancePaid,
    assignedStylist: sanitizePlainText(input.assignedStylist, 60) || barbers[0] || 'Lead Stylist',
    homeService: Boolean(input.homeService),
    status: advancePaid >= totalAmount ? 'SETTLED' : 'ADVANCE_LOCKED',
    createdAt: new Date().toISOString(),
  };
  store.bridalBookings.unshift(record);
  store.bridalBookings = store.bridalBookings.slice(0, 60);
  persistStore();
  return getSalonConciergeState(salonId);
}

export function settleBridalBookingBalance(
  salonId: string,
  bookingId: string
): SalonConciergeStateResponse {
  const store = ensureStoreLoaded();
  const target = store.bridalBookings.find((b) => b.salonId === salonId && b.id === bookingId);
  if (target) {
    target.advancePaid = target.totalAmount;
    target.status = 'SETTLED';
    persistStore();
  }
  return getSalonConciergeState(salonId);
}

export function upsertServicePackage(
  salonId: string,
  input: {
    clientName: string;
    phone?: string;
    packageTitle: string;
    totalSessions: number;
    pricePaid: number;
  }
): SalonConciergeStateResponse {
  const store = ensureStoreLoaded();
  ensureSalonExists(salonId);
  const pass: ServicePackagePass = {
    id: `pkg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 4)}`,
    salonId,
    clientName: sanitizePlainText(input.clientName, 80) || 'VIP Member',
    phone: sanitizePhone(input.phone || '') || '',
    packageTitle: sanitizePlainText(input.packageTitle, 100) || 'Multi-Session Package',
    totalSessions: clampInteger(input.totalSessions, 2, 30, 5),
    usedSessions: 0,
    pricePaid: clampInteger(input.pricePaid, 0, 1000000, 5000),
    updatedAt: new Date().toISOString(),
  };
  store.servicePackages.unshift(pass);
  store.servicePackages = store.servicePackages.slice(0, 80);
  persistStore();
  return getSalonConciergeState(salonId);
}

export function consumeServicePackageSession(
  salonId: string,
  pkgId: string
): SalonConciergeStateResponse {
  const store = ensureStoreLoaded();
  const target = store.servicePackages.find((p) => p.salonId === salonId && p.id === pkgId);
  if (target && target.usedSessions < target.totalSessions) {
    target.usedSessions += 1;
    target.updatedAt = new Date().toISOString();
    persistStore();
  }
  return getSalonConciergeState(salonId);
}

export function setSalonBillingStatus(
  salonId: string,
  billingStatus: SalonBillingStatus
): SalonConciergeStateResponse {
  const store = ensureStoreLoaded();
  const current = ensureSalonExists(salonId);
  current.billingStatus = billingStatus;
  current.updatedAt = new Date().toISOString();
  store.settingsBySalon[salonId] = current;
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
    marketingOptIn?: boolean;
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
      marketingOptIn: Boolean(input.marketingOptIn),
      totalVisits: 0,
      lastServiceIds: [],
      lastBarberName: null,
    };
    store.clients.unshift(existing);
  } else {
    if (cleanName) existing.name = cleanName;
    if (cleanBirthDate !== undefined) existing.birthDate = cleanBirthDate;
    if (validLang !== undefined) {
      existing.preferredLanguage = validLang;
      existing.awaitingLanguageSelection = false;
    }
    if (typeof input.marketingOptIn === 'boolean') {
      existing.marketingOptIn = input.marketingOptIn;
    }
  }
  persistStore(salonId);
  return existing;
}

export function addStylistLeave(
  salonId: string,
  input: {
    stylistName: string;
    date: string;
    startTime?: string;
    endTime?: string;
    fullDay?: boolean;
    reason?: string;
  }
): SalonConciergeStateResponse {
  const store = ensureStoreLoaded();
  ensureSalonExists(salonId);
  const cleanStylist = sanitizePlainText(input.stylistName, 60);
  const cleanDate = /^\d{4}-\d{2}-\d{2}$/.test(input.date || '') ? input.date : '';
  if (!cleanStylist || !cleanDate) {
    throw new Error('Stylist name and YYYY-MM-DD date are required.');
  }
  const lv: StylistLeaveRecord = {
    id: `lv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    salonId,
    stylistName: cleanStylist,
    date: cleanDate,
    startTime: input.startTime ? sanitizePlainText(input.startTime, 20) : undefined,
    endTime: input.endTime ? sanitizePlainText(input.endTime, 20) : undefined,
    fullDay: input.fullDay !== false && !(input.startTime && input.endTime),
    reason: input.reason ? sanitizePlainText(input.reason, 120) : 'Scheduled Off / Leave',
    createdAt: new Date().toISOString(),
  };
  store.stylistLeaves = [lv, ...(store.stylistLeaves || [])].slice(0, 200);
  persistStore(salonId);
  return getSalonConciergeState(salonId);
}

export function removeStylistLeave(salonId: string, leaveId: string): SalonConciergeStateResponse {
  const store = ensureStoreLoaded();
  store.stylistLeaves = (store.stylistLeaves || []).filter(
    (lv) => !(lv.salonId === salonId && lv.id === leaveId)
  );
  persistStore(salonId);
  return getSalonConciergeState(salonId);
}

export function getRetentionOpportunities(salonId: string): RetentionOpportunityItem[] {
  const store = ensureStoreLoaded();
  const settings = ensureSalonExists(salonId);
  const localClock = getLocalClockForOffset(settings.timezoneOffsetHours);
  const nowMs = Date.now();
  const winbackThresholdMs = Math.max(1, settings.winbackDays) * 86400000;
  const opportunities: RetentionOpportunityItem[] = [];

  for (const cli of store.clients.filter((c) => c.salonId === salonId)) {
    const lang: ClientPreferredLang = cli.preferredLanguage || 'en';
    const cleanPhoneDigits = cli.phone.replace(/\D/g, '');
    if (!cleanPhoneDigits) continue;
    const bookUrlHint = `/s/${settings.publicCode}`;

    if (settings.birthdayEnabled && cli.birthDate && cli.birthDate === localClock.dayMonth) {
      const msg = `${renderBirthdayMessage(settings, cli.name, lang)} Book instantly: ${bookUrlHint}`;
      opportunities.push({
        clientId: cli.id,
        clientName: cli.name,
        clientPhone: cli.phone,
        reason: 'BIRTHDAY',
        suggestedMessage: msg,
        whatsappHandoffUrl: `https://wa.me/${cleanPhoneDigits}?text=${encodeURIComponent(msg)}`,
      });
      continue;
    }

    if (settings.winbackEnabled && cli.lastCompletedVisitAt) {
      const lastVisitMs = new Date(cli.lastCompletedVisitAt).getTime();
      if (!Number.isNaN(lastVisitMs) && nowMs - lastVisitMs >= winbackThresholdMs) {
        const hasUpcoming = store.appointments.some(
          (a) =>
            a.salonId === salonId &&
            a.clientId === cli.id &&
            (a.status === 'CONFIRMED' || a.status === 'IN_CHAIR')
        );
        if (!hasUpcoming) {
          const daysSince = Math.floor((nowMs - lastVisitMs) / 86400000);
          const msg = `${renderWinBackMessage(settings, cli.name, lang)} Instant rebook: ${bookUrlHint}`;
          opportunities.push({
            clientId: cli.id,
            clientName: cli.name,
            clientPhone: cli.phone,
            reason: 'DORMANT_30D',
            daysSinceLastVisit: daysSince,
            suggestedMessage: msg,
            whatsappHandoffUrl: `https://wa.me/${cleanPhoneDigits}?text=${encodeURIComponent(msg)}`,
          });
        }
      }
    }
  }
  return opportunities;
}

export function saveFirstTimeClientProfile(
  publicCode: string,
  input: {
    name: string;
    phone: string;
    preferredLanguage?: ClientPreferredLang;
    marketingOptIn?: boolean;
  }
): {
  ok: true;
  salonId: string;
  publicCode: string;
  cookieToken: string;
  personalReturningShareUrl: string;
  returningClient: ReturningClientSnapshot;
} | { ok: false; statusCode: number; error: string } {
  const salonId = resolveSalonIdByPublicCode(publicCode);
  if (!salonId) {
    return { ok: false, statusCode: 404, error: 'Salon booking link not found.' };
  }
  const settings = ensureSalonExists(salonId);
  const cleanName = sanitizePlainText(input.name, 80);
  const cleanPhone = sanitizePhone(input.phone);
  if (!cleanName || cleanName.length < 2) {
    return { ok: false, statusCode: 400, error: 'Please enter your complete full name.' };
  }
  if (!cleanPhone || cleanPhone.replace(/\D/g, '').length < 6) {
    return { ok: false, statusCode: 400, error: 'Please enter a valid mobile number.' };
  }
  const validLang: ClientPreferredLang =
    input.preferredLanguage === 'roman_ur' ||
    input.preferredLanguage === 'ur' ||
    input.preferredLanguage === 'ar'
      ? input.preferredLanguage
      : 'en';

  const client = upsertClientProfile(salonId, {
    name: cleanName,
    phone: cleanPhone,
    preferredLanguage: validLang,
    marketingOptIn: Boolean(input.marketingOptIn),
  });

  const cookieToken = signCustomerRecognizeToken({
    salonId,
    publicCode: settings.publicCode,
    clientId: client.id,
  });

  return {
    ok: true,
    salonId,
    publicCode: settings.publicCode,
    cookieToken,
    personalReturningShareUrl: `/s/${encodeURIComponent(settings.publicCode)}?c=${encodeURIComponent(cookieToken)}`,
    returningClient: {
      clientId: client.id,
      clientName: client.name,
      maskedPhone: maskPhoneNumber(client.phone),
      preferredLanguage: (client.preferredLanguage || validLang) as ClientPreferredLang,
      totalVisits: Number(client.totalVisits || 0),
      lastServiceIds: Array.isArray(client.lastServiceIds) ? client.lastServiceIds : [],
      lastBarberName: client.lastBarberName || null,
      marketingOptIn: Boolean(client.marketingOptIn),
    },
  };
}

export function updateAppointmentStatus(
  salonId: string,
  bookingId: string,
  nextStatus: 'CONFIRMED' | 'IN_CHAIR' | 'COMPLETED' | 'CANCELED'
): { ok: true; appointment: ConciergeAppointment; state: SalonConciergeStateResponse } | { ok: false; error: string } {
  const store = ensureStoreLoaded();
  ensureSalonExists(salonId);
  const appt = store.appointments.find((a) => a.salonId === salonId && a.id === bookingId);
  if (!appt) {
    return { ok: false, error: 'Appointment not found for this salon.' };
  }
  appt.status = nextStatus;
  if (nextStatus === 'CANCELED') {
    appt.canceled = true;
    store.chairLocks = store.chairLocks.filter((l) => !(l.salonId === salonId && l.id === bookingId));
    appendBookingAudit(salonId, bookingId, 'OWNER', 'CANCELED', 'Marked canceled by salon owner (quota unchanged).');
  } else if (nextStatus === 'COMPLETED') {
    const nowIso = new Date().toISOString();
    appt.completedAt = nowIso;
    const cli = store.clients.find((c) => c.id === appt.clientId);
    if (cli) {
      cli.lastCompletedVisitAt = nowIso;
      cli.totalVisits = (cli.totalVisits || 0) + 1;
    }
    store.chairLocks = store.chairLocks.filter((l) => !(l.salonId === salonId && l.id === bookingId));
    appendBookingAudit(salonId, bookingId, 'OWNER', 'COMPLETED', 'Appointment marked completed by salon owner.');
  } else {
    appendBookingAudit(salonId, bookingId, 'OWNER', nextStatus === 'IN_CHAIR' ? 'IN_CHAIR' : 'CREATED', `Status updated to ${nextStatus}.`);
  }
  persistStore(salonId);
  return { ok: true, appointment: appt, state: getSalonConciergeState(salonId) };
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

  const isPendingRescheduleReply = Boolean(
    client.pendingReschedule &&
      client.pendingReschedule.alternatives.some((alt) => alt.index === raw)
  );

  const isGreeting = /^(hi|hello|hey|salam|assalam|assalamu|marhaba|السلام|مرحبا)\b/i.test(lower);
  const starMatch = raw.match(/^([1-5])(\s*(stars?|★|\*)?.*)?$/i);
  const reviewApptId = payload.appointmentIdForReview || client.awaitingReviewAppointmentId;
  const isStarFeedback = Boolean(
    !isPendingRerouteReply &&
      !isPendingRescheduleReply &&
      starMatch &&
      (reviewApptId || lower.includes('star') || (raw.length <= 2 && !client.awaitingLanguageSelection))
  );
  const isWinbackRebook =
    !isPendingRerouteReply &&
    !isPendingRescheduleReply &&
    (lower.includes('rebook') || (client.awaitingWinbackRebook && raw === '1'));
  const isPriceListQuery =
    !isPendingRerouteReply &&
    !isPendingRescheduleReply &&
    !client.awaitingLanguageSelection &&
    (/\b(price|prices|rate|rates|menu|charges|fee|list|kitne|qeemat)\b|قیمت|ریٹ|اسعار|أسعار|قائمة/i.test(lower) ||
      (raw === '2' && !isStarFeedback));
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
    isPendingRescheduleReply ||
    isStarFeedback ||
    isWinbackRebook ||
    isPriceListQuery ||
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
    isPendingRescheduleReply ||
    isPriceListQuery ||
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

  // 1. Single Welcome Message on "Hi"/Greeting with Salon Name, Language Selector (EN default), and 4 Options
  if (
    payload.forceLanguagePrompt ||
    (!hasStructuredAction && isGreeting) ||
    (!hasStructuredAction && !client.preferredLanguage && !client.awaitingLanguageSelection)
  ) {
    const chosenLang: ClientPreferredLang = client.preferredLanguage || 'en';
    client.awaitingLanguageSelection = false;
    const welcome = buildCustomerWelcomeMenu(settings, chosenLang);
    appendLog(payload.salonId, {
      direction: 'OUTBOUND',
      module: 'LANGUAGE_MENU',
      clientName: client.name,
      clientPhone: client.phone,
      language: welcome.language,
      dir: welcome.dir,
      body: welcome.welcomeText,
    });
    persistStore(payload.salonId);
    return {
      replyText: welcome.welcomeText,
      replyDir: welcome.dir,
      lockedLanguage: welcome.language,
      routedAction: 'WELCOME_MENU_SENT',
      state: getSalonConciergeState(payload.salonId),
    };
  }

  // 2. Quick language switch or menu option pick from single Welcome message (1..4)
  if (!hasStructuredAction && matchedLangOpt) {
    client.preferredLanguage = matchedLangOpt.lang;
    client.awaitingLanguageSelection = false;
    const welcome = buildCustomerWelcomeMenu(settings, matchedLangOpt.lang);
    appendLog(payload.salonId, {
      direction: 'OUTBOUND',
      module: 'LANGUAGE_MENU',
      clientName: client.name,
      clientPhone: client.phone,
      language: welcome.language,
      dir: welcome.dir,
      body: welcome.welcomeText,
    });
    persistStore(payload.salonId);
    return {
      replyText: welcome.welcomeText,
      replyDir: welcome.dir,
      lockedLanguage: matchedLangOpt.lang,
      routedAction: `LANGUAGE_LOCKED_${matchedLangOpt.lang.toUpperCase()}`,
      state: getSalonConciergeState(payload.salonId),
    };
  }

  // Handle direct 1-4 option picks from Welcome screen
  if (!hasStructuredAction && (raw === '1' || raw === '3' || raw === '4' || /\b(hours|timing|location|address|map|deal|offer|promo)\b/i.test(lower))) {
    const targetLang: ClientPreferredLang = client.preferredLanguage || 'en';
    let actionId: CustomerMenuActionId = 'BOOK_APPOINTMENT';
    if (raw === '3' || /\b(hours|timing|location|address|map)\b/i.test(lower)) {
      actionId = 'HOURS_LOCATION';
    } else if (raw === '4' || /\b(deal|offer|promo)\b/i.test(lower)) {
      actionId = 'CURRENT_DEALS';
    }
    const resAction = handleCustomerWhatsAppAction({
      salonId: payload.salonId,
      fromPhone: cleanPhone,
      messageText: raw,
      actionId,
      preferredLang: targetLang,
      clientName: cleanClientName,
      isDemo: false,
    });
    return {
      replyText: resAction.text,
      replyDir: resAction.dir,
      lockedLanguage: resAction.language,
      routedAction: actionId,
      state: getSalonConciergeState(payload.salonId),
    };
  }

  if (hasStructuredAction && !client.preferredLanguage) {
    client.preferredLanguage = resolveClientConversationLang(client, raw, regionMeta.region);
    client.awaitingLanguageSelection = false;
  }

  const activeLang: ClientPreferredLang = resolveClientConversationLang(
    client,
    raw,
    regionMeta.region
  );
  const activeDir = getLangDirection(activeLang);

  // 3. Neutral Post-Visit Review Prompt (No 4-5 star vs 1-3 star rating gate!)
  if (isStarFeedback && starMatch) {
    const rating = Number(starMatch[1]);
    const appt =
      store.appointments.find((a) => a.id === reviewApptId) ||
      store.appointments.find((a) => a.salonId === payload.salonId && a.clientId === client!.id && a.status === 'COMPLETED');

    if (appt) {
      appt.rating = rating;
      appt.ratingComment = raw;
      appt.reviewRoutedStatus = 'PUBLIC_GOOGLE_SENT';
    }
    client.awaitingReviewAppointmentId = null;

    const thankYouMap: Record<ClientPreferredLang, string> = {
      en: `Thank you for your feedback, ${client.name}! Every review helps ${settings.salonName} serve you better. Share your honest experience on Google: ${settings.googleReviewUrl}`,
      roman_ur: `Aap ke feedback ka bohat shukriya ${client.name}! Meharbani farma kar apna imandari se review Google par share karein: ${settings.googleReviewUrl}`,
      ur: `آپ کے فیڈبیک کا بہت شکریہ ${client.name}! برائے مہربانی اپنا ایمانداری پر مبنی ریویو گوگل پر شیئر کریں: ${settings.googleReviewUrl}`,
      ar: `شكراً جزيلاً لمشاركتك رأيك يا ${client.name}! نرحب بمشاركة تجربتك الصادقة على جوجل: ${settings.googleReviewUrl}`,
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
    persistStore(payload.salonId);
    return {
      replyText,
      replyDir: activeDir,
      lockedLanguage: activeLang,
      routedAction: 'REVIEW_ROUTED_PUBLIC_GOOGLE',
      state: getSalonConciergeState(payload.salonId),
    };
  }

  // 3B. Localized Price List / Rate Menu Auto-Reply (Includes Ladies Female-Only Privacy Notice)
  if (isPriceListQuery) {
    const activeServices = (
      Array.isArray(settings.enabledServices) && settings.enabledServices.length > 0
        ? settings.enabledServices
        : getDefaultServicesForCategory(settings.salonCategory || 'MENS', settings.currency)
    )
      .filter((s) => s.active !== false)
      .slice(0, 6);

    const lines = activeServices
      .map(
        (s, idx) =>
          `${idx + 1}. ${s.name} — ${settings.currencySymbol}${Number(s.price).toLocaleString()}`
      )
      .join('\n');

    const isLadiesSalon = settings.salonCategory === 'LADIES';
    const privacyNoteMap: Record<ClientPreferredLang, string> = isLadiesSalon
      ? {
          en: '\nFemale-Only Private Cabins & Ladies Staff Assured.',
          roman_ur: '\nLadies-Only Private Cabins aur Female Staff 100% maujood hai.',
          ur: '\nخواتین کے لیے علیحدہ پرائیویٹ کیبن اور فی میل اسٹاف کی مکمل سہولت موجود ہے۔',
          ar: '\nخصوصية تامة: كابينات خاصة للسيدات وطاقم نسائي بالكامل.',
        }
      : { en: '', roman_ur: '', ur: '', ar: '' };

    const menuReplyMap: Record<ClientPreferredLang, string> = {
      en: `${settings.salonName} Rate Menu:\n${lines}${privacyNoteMap.en}\nReply with your service & time to book!`,
      roman_ur: `${settings.salonName} Ki Rate List:\n${lines}${privacyNoteMap.roman_ur}\nBook karne ke liye service aur waqt reply karein!`,
      ur: `${settings.salonName} کی ریٹ لسٹ:\n${lines}${privacyNoteMap.ur}\nاپائنٹمنٹ بک کرنے کے لیے سروس اور وقت لکھ کر بھیجیں!`,
      ar: `قائمة أسعار ${settings.salonName}:\n${lines}${privacyNoteMap.ar}\nأرسل الخدمة والوقت لحجز موعدك فوراً!`,
    };

    appendLog(payload.salonId, {
      direction: 'INBOUND',
      module: 'BOOKING',
      clientName: client.name,
      clientPhone: client.phone,
      language: activeLang,
      dir: activeDir,
      body: raw,
      eventMetadata: { eventType: 'PRICE_MENU_SENT' },
    });

    const replyText = menuReplyMap[activeLang];
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
      routedAction: 'PRICE_MENU_SENT',
      state: getSalonConciergeState(payload.salonId),
    };
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

    const lockedWinbackSummary = formatOfferSummary(settings, 'WINBACK', activeLang);
    const rebookConfirm: Record<ClientPreferredLang, string> = {
      en: `Priority Rebooking Confirmed (${newBooking.id})! Your offer (${lockedWinbackSummary}) is locked at ${settings.salonName}.`,
      roman_ur: `Mubarak ${client.name}! Aap ki priority rebooking (${newBooking.id}) confirm ho gayi hai. Offer (${lockedWinbackSummary}) lock kar diya gaya hai.`,
      ur: `آپ کی ترجیحی ری-بکنگ (${newBooking.id}) کنفرم ہو گئی ہے ${client.name}! آپ کی آفر (${lockedWinbackSummary}) محفوظ کر دی گئی ہے۔`,
      ar: `تم تأكيد إعادة الحجز الفوري (${newBooking.id}) يا ${client.name}! تم تثبيت عرضك (${lockedWinbackSummary}) في ${settings.salonName}.`,
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

  // 4C. Resolve pending 1-Tap Auto-Reschedule Slot Pick (1 / 2 / 3)
  if (isPendingRescheduleReply && client.pendingReschedule) {
    const pending = client.pendingReschedule;
    const picked =
      pending.alternatives.find((alt) => alt.index === raw) || pending.alternatives[0];
    client.pendingReschedule = null;

    if (picked) {
      const startMins = parseTimeSlotToMinutes(picked.timeSlot);
      const startDate = new Date(Date.now() + 86400000);
      if (startMins >= 0) {
        startDate.setHours(Math.floor(startMins / 60), startMins % 60, 0, 0);
      }

      const rescheduledAppt: ConciergeAppointment = {
        id: `BK-RS-${Date.now().toString().slice(-4)}`,
        salonId: payload.salonId,
        clientId: client.id,
        clientName: client.name,
        clientPhone: client.phone,
        barberName: picked.barberName,
        service: pending.preferredService,
        price: settings.currency === 'PKR' ? 1200 : 85,
        timeSlot: `${picked.timeSlot} (${picked.dateLabel})`,
        durationMins: 40,
        scheduledEndMs: startDate.getTime() + 40 * 60000,
        sourceType: 'WHATSAPP_BOT',
        status: 'CONFIRMED',
        scheduledForIso: startDate.toISOString(),
        completedAt: null,
        reviewPromptSentAt: null,
        rating: null,
        ratingComment: null,
        reviewRoutedStatus: 'PENDING',
      };
      store.appointments.unshift(rescheduledAppt);

      appendLog(payload.salonId, {
        direction: 'INBOUND',
        module: 'BOOKING',
        clientName: client.name,
        clientPhone: client.phone,
        language: activeLang,
        dir: activeDir,
        body: raw,
        eventMetadata: {
          eventType: 'RESCHEDULE_CONFIRMED',
          barberName: picked.barberName,
          services: pending.preferredService,
          timeSlot: `${picked.timeSlot} (${picked.dateLabel})`,
        },
      });

      const reschedConfirmMap: Record<ClientPreferredLang, string> = {
        en: `Rescheduled! ${client.name}, your new slot is locked for ${picked.dateLabel} at ${picked.timeSlot} with ${picked.barberName}.`,
        roman_ur: `Reschedule confirm ${client.name}! Kal ${picked.timeSlot} par ${picked.barberName} ke sath aap ka slot lock ho gaya hai.`,
        ur: `ری شیڈول کنفرم ${client.name}! کل ${picked.timeSlot} بجے ${picked.barberName} کے ساتھ آپ کا نیا وقت محفوظ ہو گیا ہے۔`,
        ar: `تم تأكيد إعادة الجدولة يا ${client.name}! موعدك الجديد ${picked.dateLabel} الساعة ${picked.timeSlot} مع ${picked.barberName}.`,
      };
      const replyText = reschedConfirmMap[activeLang];
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
        routedAction: 'RESCHEDULE_CONFIRMED',
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
      const slotTimes = ['11:30 AM', '02:00 PM', '05:30 PM'];
      const slotAlternatives = slotTimes.map((timeSlot, idx) => ({
        index: String(idx + 1),
        barberName: salonBarbers[idx % salonBarbers.length] || extractedBarber,
        timeSlot,
        dateLabel: 'Tomorrow',
      }));
      client.pendingReschedule = {
        requestedAt: new Date().toISOString(),
        preferredService: extractedServices,
        alternatives: slotAlternatives,
      };
      const slotLines = slotAlternatives
        .map((alt) => `[${alt.index}. ${alt.dateLabel} ${alt.timeSlot} · ${alt.barberName}]`)
        .join('\n');

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
        en: `Got it ${client.name}. Reply 1, 2, or 3 to lock your new tomorrow slot at ${settings.salonName}:\n${slotLines}`,
        roman_ur: `Ji ${client.name}, hum ne kal ke khali slots tayyar kiye hain — confirm karne ke liye 1, 2, ya 3 reply karein:\n${slotLines}`,
        ur: `جی ${client.name}، کل کے دستیاب اوقات میں سے بک کرنے کے لیے 1، 2 یا 3 لکھ کر بھیجیں:\n${slotLines}`,
        ar: `تم يا ${client.name}، اختر موعداً ليوم غد بالرد بـ 1 أو 2 أو 3 لتثبيته فوراً:\n${slotLines}`,
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
  quarantinedCount: number;
} {
  const store = ensureStoreLoaded();
  const targetSalons = salonId
    ? [store.settingsBySalon[salonId]].filter(Boolean)
    : Object.values(store.settingsBySalon);

  let dispatchedCount = 0;
  let quarantinedCount = 0;

  for (const settings of targetSalons) {
    if (!settings.birthdayEnabled) continue;
    if (settings.billingStatus === 'PENDING_ACTIVATION' || settings.billingStatus === 'SUSPENDED') {
      quarantinedCount++;
      continue;
    }
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
  return { dispatchedCount, salonIdsChecked: targetSalons.length, quarantinedCount };
}

export function runWinBackCron(salonId?: string, forceRun = false): {
  dispatchedCount: number;
  quarantinedCount: number;
} {
  const store = ensureStoreLoaded();
  const targetSalons = salonId
    ? [store.settingsBySalon[salonId]].filter(Boolean)
    : Object.values(store.settingsBySalon);

  const nowMs = Date.now();
  let dispatchedCount = 0;
  let quarantinedCount = 0;

  for (const settings of targetSalons) {
    if (!settings.winbackEnabled) continue;
    if (settings.billingStatus === 'PENDING_ACTIVATION' || settings.billingStatus === 'SUSPENDED') {
      quarantinedCount++;
      continue;
    }
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
  return { dispatchedCount, quarantinedCount };
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
    const regionInfo = detectRegionFromPhone(client?.phone || settings.whatsappPhone);
    const lang: ClientPreferredLang = resolveClientConversationLang(client, '', regionInfo.region);
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
  // Run initial sweep on boot for Auto-Complete + Deal Retention + T+2h / 30d dormant / 9:00 AM window
  runAutoCompleteAppointmentsCron(undefined);
  runDealExpiryAndVideoRetentionCron(undefined);
  runBirthdayCron(undefined, false);
  runWinBackCron(undefined, false);
  runPostServiceReviewCron(undefined, false);

  return setInterval(() => {
    try {
      runAutoCompleteAppointmentsCron(undefined);
      runDealExpiryAndVideoRetentionCron(undefined);
      runBirthdayCron(undefined, false);
      runWinBackCron(undefined, false);
      runPostServiceReviewCron(undefined, false);
    } catch (err) {
      console.warn('Concierge background cron sweep error:', err);
    }
  }, 60 * 1000);
}

// ============================================================================
// PHASE 1: CUSTOMER-FACING WHATSAPP EXPERIENCE, FLOW BOOKING & DEAL VIDEOS
// ============================================================================

const LANGUAGE_CHOICE_META: Record<ClientPreferredLang, CustomerLanguageChoice> = {
  en: { lang: 'en', label: 'English', nativeLabel: 'English', dir: 'ltr' },
  roman_ur: { lang: 'roman_ur', label: 'Roman Urdu', nativeLabel: 'Roman Urdu', dir: 'ltr' },
  ur: { lang: 'ur', label: 'Urdu', nativeLabel: 'اردو', dir: 'rtl' },
  ar: { lang: 'ar', label: 'Arabic', nativeLabel: 'العربية', dir: 'rtl' },
};

const CUSTOMER_SERVICE_TRANSLATIONS: Record<
  string,
  { roman_ur: string; ur: string; ar: string }
> = {
  'master haircut': {
    roman_ur: 'Master Haircut',
    ur: 'ماسٹر ہیئر کٹ',
    ar: 'قص شعر احترافي',
  },
  'skin fade': {
    roman_ur: 'Skin Fade',
    ur: 'اسکن فیڈ',
    ar: 'تدريج سكن فيد',
  },
  'classic beard trim': {
    roman_ur: 'Classic Beard Trim',
    ur: 'کلاسک داڑھی ٹرم',
    ar: 'تشذيب اللحية الكلاسيكي',
  },
  'classic beard trim & sculpt': {
    roman_ur: 'Classic Beard Trim & Setting',
    ur: 'کلاسک داڑھی ٹرم اور سیٹنگ',
    ar: 'تشذيب وتحديد اللحية الكلاسيكي',
  },
  'hot towel steam shave': {
    roman_ur: 'Hot Towel Steam Shave',
    ur: 'ہاٹ ٹاول اسٹیم شیو',
    ar: 'حلاقة بالمنشفة الساخنة والبخار',
  },
  'hair color & camo': {
    roman_ur: 'Hair Color & Camo',
    ur: 'ہیئر کلر اور کیمو',
    ar: 'صبغة وتلوين الشعر',
  },
  'charcoal deep detox facial': {
    roman_ur: 'Charcoal Deep Detox Facial',
    ur: 'چارکول ڈیپ ڈیٹوکس فیشل',
    ar: 'تنظيف عميق للبشرة بالفحم',
  },
  'keratin hair protein': {
    roman_ur: 'Keratin Hair Protein',
    ur: 'کیراٹین ہیئر پروٹین',
    ar: 'بروتين الكيراتين للشعر',
  },
  'herbal mint head massage': {
    roman_ur: 'Herbal Mint Head Massage',
    ur: 'ہربل منٹ ہیڈ مساج',
    ar: 'مساج الرأس بالنعناع والأعشاب',
  },
  'groom signature package': {
    roman_ur: 'Dulha Signature Package',
    ur: 'دولہا سگنیچر پیکیج',
    ar: 'باقة العريس المميزة',
  },
  'signature party makeup & styling': {
    roman_ur: 'Party Makeup & Styling',
    ur: 'پارٹی میک اپ اور اسٹائلنگ',
    ar: 'مكياج سهرة مميز وتصفيف',
  },
  'barat / walima bridal package': {
    roman_ur: 'Barat / Walima Bridal Package',
    ur: 'بارات / ولیمہ برائیڈل پیکیج',
    ar: 'باقة العروس للزفاف',
  },
  'hydra-facial & skin polish': {
    roman_ur: 'Hydra-Facial & Skin Polish',
    ur: 'ہائیڈرا فیشل اور اسکن پالش',
    ar: 'هيدرافيشل وصنفرة البشرة',
  },
  'keratin hair rebonding / smoothing': {
    roman_ur: 'Keratin Rebonding / Smoothing',
    ur: 'کیراٹین ریبانڈنگ / اسموتھنگ',
    ar: 'فرد وتنعيم الشعر بالكيراتين',
  },
  'mani-pedi classic spa': {
    roman_ur: 'Mani-Pedi Classic Spa',
    ur: 'مینی پیڈی کلاسک اسپا',
    ar: 'مانيكير وباديكير كلاسيكي',
  },
  'full face threading & waxing': {
    roman_ur: 'Face Threading & Waxing',
    ur: 'فل فیس تھریڈنگ اور ویکسنگ',
    ar: 'إزالة شعر الوجه بالفتلة والشمع',
  },
  'deep conditioning hair spa': {
    roman_ur: 'Deep Conditioning Hair Spa',
    ur: 'ڈیپ کنڈیشننگ ہیئر اسپا',
    ar: 'حمام كريم وعناية للشعر',
  },
};

function localizeServiceName(name: string, lang: ClientPreferredLang): string {
  if (lang === 'en') return name;
  const key = name.trim().toLowerCase();
  const exact = CUSTOMER_SERVICE_TRANSLATIONS[key];
  if (exact) return exact[lang];

  if (lang === 'roman_ur') return name;

  const tokenMapUr: Array<[RegExp, string]> = [
    [/\bmaster haircut\b/gi, 'ماسٹر ہیئر کٹ'],
    [/\bhaircut\b/gi, 'ہیئر کٹ'],
    [/\bskin fade\b/gi, 'اسکن فیڈ'],
    [/\bbeard trim\b/gi, 'داڑھی ٹرم'],
    [/\bbeard\b/gi, 'داڑھی'],
    [/\bshave\b/gi, 'شیو'],
    [/\bfacial\b/gi, 'فیشل'],
    [/\bpolish\b/gi, 'پالش'],
    [/\bmassage\b/gi, 'مساج'],
    [/\bmakeup\b/gi, 'میک اپ'],
    [/\bbridal\b/gi, 'برائیڈل'],
    [/\bgroom\b/gi, 'دولہا'],
    [/\bpackage\b/gi, 'پیکیج'],
    [/\bkeratin\b/gi, 'کیراٹین'],
    [/\bhair color\b/gi, 'ہیئر کلر'],
    [/\bthreading\b/gi, 'تھریڈنگ'],
    [/\bwaxing\b/gi, 'ویکسنگ'],
    [/\bspa\b/gi, 'اسپا'],
  ];
  const tokenMapAr: Array<[RegExp, string]> = [
    [/\bmaster haircut\b/gi, 'قص شعر احترافي'],
    [/\bhaircut\b/gi, 'قص شعر'],
    [/\bskin fade\b/gi, 'تدريج سكن فيد'],
    [/\bbeard trim\b/gi, 'تشذيب اللحية'],
    [/\bbeard\b/gi, 'لحية'],
    [/\bshave\b/gi, 'حلاقة'],
    [/\bfacial\b/gi, 'تنظيف بشرة'],
    [/\bmassage\b/gi, 'مساج'],
    [/\bmakeup\b/gi, 'مكياج'],
    [/\bbridal\b/gi, 'عروس'],
    [/\bgroom\b/gi, 'عريس'],
    [/\bpackage\b/gi, 'باقة'],
    [/\bkeratin\b/gi, 'كيراتين'],
    [/\bhair color\b/gi, 'صبغة شعر'],
    [/\bthreading\b/gi, 'إزالة شعر بالفتلة'],
    [/\bwaxing\b/gi, 'شمع'],
    [/\bspa\b/gi, 'سبا'],
  ];

  let out = name;
  const rules = lang === 'ur' ? tokenMapUr : tokenMapAr;
  for (const [rx, replacement] of rules) {
    out = out.replace(rx, replacement);
  }
  return out;
}

function enrichServicesWithTranslations(services: SalonServiceRate[]): SalonServiceRate[] {
  return services.map((s) => ({
    ...s,
    translations: {
      en: s.name,
      roman_ur: s.translations?.roman_ur || localizeServiceName(s.name, 'roman_ur'),
      ur: s.translations?.ur || localizeServiceName(s.name, 'ur'),
      ar: s.translations?.ar || localizeServiceName(s.name, 'ar'),
    },
  }));
}

const CUSTOMER_DEAL_EXACT_TRANSLATIONS: Record<
  string,
  { roman_ur: string; ur: string; ar: string }
> = {
  'executive haircut & facial combo (20% off)': {
    roman_ur: 'Executive Haircut & Facial Combo (20% OFF)',
    ur: 'ایگزیکٹو ہیئر کٹ اور فیشل کومبو (20% رعایت)',
    ar: 'باقة قص الشعر وتنظيف البشرة التنفيذية (خصم 20%)',
  },
  'includes master haircut + skin fade + charcoal deep detox facial with priority chair access.': {
    roman_ur: 'Master Haircut, Skin Fade aur Charcoal Facial ke sath priority chair shamil hai.',
    ur: 'اس آفر میں ماسٹر ہیئر کٹ، اسکن فیڈ اور چارکول ڈیپ ڈیٹوکس فیشل ترجیحی کرسی کے ساتھ شامل ہیں۔',
    ar: 'تتضمن الباقة قص شعر احترافي وتدريج الشعر وتنظيف عميق للبشرة بالفحم مع أولوية الجلوس.',
  },
  'jumeirah executive grooming package': {
    roman_ur: 'Jumeirah Executive Grooming Package',
    ur: 'جمیرہ ایگزیکٹو گرومنگ پیکیج',
    ar: 'باقة جميرا للعناية التنفيذية',
  },
  'master haircut, skin fade, classic beard trim, and hot towel shave bundle.': {
    roman_ur: 'Master Haircut, Skin Fade, Classic Beard Trim aur Hot Towel Shave ka mukammal bundle.',
    ur: 'ماسٹر ہیئر کٹ، اسکن فیڈ، کلاسک داڑھی ٹرم اور ہاٹ ٹاول شیو کا مکمل پیکیج۔',
    ar: 'باقة شاملة تتضمن قص شعر احترافي، تدريج الشعر، تشذيب اللحية، وحلاقة بالمنشفة الساخنة.',
  },
  'signature haircut, beard sculpt, and hot towel shave bundle.': {
    roman_ur: 'Signature Haircut, Beard Sculpt aur Hot Towel Shave ka mukammal bundle.',
    ur: 'سگنیچر ہیئر کٹ، داڑھی اسٹائلنگ اور ہاٹ ٹاول شیو کا مکمل پیکیج۔',
    ar: 'باقة شاملة تتضمن قص شعر مميز، تحديد اللحية، وحلاقة بالمنشفة الساخنة.',
  },
  'hydra-facial + party styling glow deal': {
    roman_ur: 'Hydra-Facial + Party Styling Glow Deal',
    ur: 'ہائیڈرا فیشل + پارٹی اسٹائلنگ گلو ڈیل',
    ar: 'عرض الهيدرافيشل وتصفيف السهرة المتألق',
  },
  'limited-time salon glow offer for ladies parlor bookings.': {
    roman_ur: 'Ladies parlor bookings ke liye mehdood muddat ki glow offer.',
    ur: 'لیڈیز پارلر بکنگز کے لیے محدود مدت کی خصوصی گلو آفر۔',
    ar: 'عرض إشراقة خاص لفترة محدودة لحجوزات صالون السيدات.',
  },
  'weekend grooming combo': {
    roman_ur: 'Weekend Grooming Combo',
    ur: 'ویک اینڈ گرومنگ کومبو',
    ar: 'باقة العناية لعطلة نهاية الأسبوع',
  },
};

function localizeDealText(text: string, lang: ClientPreferredLang): string {
  const clean = (text || '').trim();
  if (!clean || lang === 'en') return clean;
  const exact = CUSTOMER_DEAL_EXACT_TRANSLATIONS[clean.toLowerCase()];
  if (exact) return exact[lang];

  if (lang === 'roman_ur') {
    return clean
      .replace(/\bvalid until\b/gi, 'Aakhri tareekh')
      .replace(/\bspecial salon offer\b/gi, 'Khas Salon Offer')
      .replace(/\bwith\b/gi, 'ke sath');
  }

  const urRules: Array<[RegExp, string]> = [
    [/\bcharcoal deep detox facial\b/gi, 'چارکول ڈیپ ڈیٹوکس فیشل'],
    [/\bhot towel steam shave\b/gi, 'ہاٹ ٹاول اسٹیم شیو'],
    [/\bsignature party makeup & styling\b/gi, 'سگنیچر پارٹی میک اپ اور اسٹائلنگ'],
    [/\bhydra-facial & skin polish\b/gi, 'ہائیڈرا فیشل اور اسکن پالش'],
    [/\bmaster haircut\b/gi, 'ماسٹر ہیئر کٹ'],
    [/\bskin fade\b/gi, 'اسکن فیڈ'],
    [/\bclassic beard trim\b/gi, 'کلاسک داڑھی ٹرم'],
    [/\bpriority chair access\b/gi, 'ترجیحی کرسی'],
    [/\bspecial salon offer\b/gi, 'خصوصی سیلون آفر'],
    [/\blimited-time\b/gi, 'محدود مدت'],
    [/\bvalid until\b/gi, 'آخری تاریخ'],
    [/\bincludes:\s*/gi, 'شامل ہیں: '],
    [/\bincludes\b/gi, 'شامل ہیں:'],
    [/\bwith\b/gi, 'اور'],
    [/\band\b/gi, 'اور'],
    [/\s+&\s+/g, ' اور '],
    [/\bweekend\b/gi, 'ویک اینڈ'],
    [/\bgrooming\b/gi, 'گرومنگ'],
    [/\bexecutive\b/gi, 'ایگزیکٹو'],
    [/\bcombo\b/gi, 'کومبو'],
    [/\bpackage\b/gi, 'پیکیج'],
    [/\bbundle\b/gi, 'پیکیج'],
    [/\boffer\b/gi, 'آفر'],
    [/\bdeal\b/gi, 'ڈیل'],
    [/\bhaircut\b/gi, 'ہیئر کٹ'],
    [/\bbeard\b/gi, 'داڑھی'],
    [/\bfacial\b/gi, 'فیشل'],
    [/\bbridal\b/gi, 'برائیڈل'],
    [/\boff\b/gi, 'رعایت'],
  ];

  const arRules: Array<[RegExp, string]> = [
    [/\bcharcoal deep detox facial\b/gi, 'تنظيف عميق للبشرة بالفحم'],
    [/\bhot towel steam shave\b/gi, 'حلاقة بالمنشفة الساخنة والبخار'],
    [/\bsignature party makeup & styling\b/gi, 'مكياج سهرة مميز وتصفيف'],
    [/\bhydra-facial & skin polish\b/gi, 'هيدرافيشل وصنفرة البشرة'],
    [/\bmaster haircut\b/gi, 'قص شعر احترافي'],
    [/\bskin fade\b/gi, 'تدريج الشعر'],
    [/\bclassic beard trim\b/gi, 'تشذيب اللحية الكلاسيكي'],
    [/\bpriority chair access\b/gi, 'أولوية الجلوس'],
    [/\bspecial salon offer\b/gi, 'عرض صالون خاص'],
    [/\blimited-time\b/gi, 'لفترة محدودة'],
    [/\bvalid until\b/gi, 'صالح حتى'],
    [/\bincludes:\s*/gi, 'يشمل: '],
    [/\bincludes\b/gi, 'يشمل:'],
    [/\bwith\b/gi, 'مع'],
    [/\band\b/gi, 'و'],
    [/\s+&\s+/g, ' و '],
    [/\bweekend\b/gi, 'نهاية الأسبوع'],
    [/\bgrooming\b/gi, 'عناية'],
    [/\bexecutive\b/gi, 'تنفيذي'],
    [/\bcombo\b/gi, 'باقة'],
    [/\bpackage\b/gi, 'باقة'],
    [/\bbundle\b/gi, 'باقة'],
    [/\boffer\b/gi, 'عرض'],
    [/\bdeal\b/gi, 'عرض'],
    [/\bhaircut\b/gi, 'قص شعر'],
    [/\bbeard\b/gi, 'لحية'],
    [/\bfacial\b/gi, 'تنظيف بشرة'],
    [/\bbridal\b/gi, 'عروس'],
    [/\boff\b/gi, 'خصم'],
  ];

  let out = clean;
  const rules = lang === 'ur' ? urRules : arRules;
  for (const [rx, replacement] of rules) {
    out = out.replace(rx, replacement);
  }
  return out;
}

function enrichDealWithTranslations<T extends SalonDeal>(deal: T): T {
  return {
    ...deal,
    titleTranslations: {
      en: deal.title,
      roman_ur: deal.titleTranslations?.roman_ur || localizeDealText(deal.title, 'roman_ur'),
      ur: deal.titleTranslations?.ur || localizeDealText(deal.title, 'ur'),
      ar: deal.titleTranslations?.ar || localizeDealText(deal.title, 'ar'),
    },
    descriptionTranslations: {
      en: deal.description,
      roman_ur:
        deal.descriptionTranslations?.roman_ur ||
        localizeDealText(deal.description, 'roman_ur'),
      ur: deal.descriptionTranslations?.ur || localizeDealText(deal.description, 'ur'),
      ar: deal.descriptionTranslations?.ar || localizeDealText(deal.description, 'ar'),
    },
  };
}

function isUniformDailySchedule(hours: SalonOperatingHours): boolean {
  if (hours.monThuClosed || hours.fridayClosed || hours.satSunClosed) return false;
  const sameOpen =
    hours.monThuOpen.trim().toLowerCase() === hours.fridayOpen.trim().toLowerCase() &&
    hours.monThuOpen.trim().toLowerCase() === hours.satSunOpen.trim().toLowerCase();
  const sameClose =
    hours.monThuClose.trim().toLowerCase() === hours.fridayClose.trim().toLowerCase() &&
    hours.monThuClose.trim().toLowerCase() === hours.satSunClose.trim().toLowerCase();
  const bStart = (hours.fridayBreakStart || '').trim().toLowerCase();
  const bEnd = (hours.fridayBreakEnd || '').trim().toLowerCase();
  const hasBreak =
    Boolean(bStart) &&
    Boolean(bEnd) &&
    bStart !== 'none' &&
    bEnd !== 'none' &&
    bStart !== 'off' &&
    bEnd !== 'off' &&
    bStart !== bEnd;
  return sameOpen && sameClose && !hasBreak;
}

function getConfiguredLanguageChoices(settings: RetentionSettings): CustomerLanguageChoice[] {
  const regionMeta = detectRegionFromPhone(settings.whatsappPhone);
  const langs = normalizeClientLanguageList(settings.enabledClientLanguages, regionMeta.region);
  return langs.map((l) => LANGUAGE_CHOICE_META[l]);
}

function resolveSavedNameStatus(client: ConciergeClientProfile | undefined): {
  hasSavedName: boolean;
  savedName: string | null;
} {
  if (!client || !client.name) return { hasSavedName: false, savedName: null };
  const trimmed = client.name.trim();
  const placeholders = new Set(['salon client', 'whatsapp client', 'guest', 'walk-in guest', '']);
  if (placeholders.has(trimmed.toLowerCase())) {
    return { hasSavedName: false, savedName: null };
  }
  return { hasSavedName: true, savedName: trimmed };
}

function isDealCurrentlyActive(deal: SalonDeal, nowMs = Date.now()): boolean {
  if (!deal.active) return false;
  const expMs = new Date(deal.expiresAt).getTime();
  if (Number.isNaN(expMs)) return false;
  return expMs > nowMs;
}

export function runDealExpiryAndVideoRetentionCron(salonId?: string): {
  expiredDealsCount: number;
  purgedVideosCount: number;
} {
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
      const deleteAfterMs = expMs + retentionDays * 86400000;
      if (nowMs >= deleteAfterMs && (deal.videoFileName || deal.videoUrl)) {
        if (deal.videoFileName) {
          const safePath = path.join(DEAL_VIDEO_DIR, path.basename(deal.videoFileName));
          try {
            if (fs.existsSync(safePath)) {
              fs.unlinkSync(safePath);
            }
          } catch (err) {
            console.warn('Could not unlink expired deal video:', err);
          }
        }
        deal.videoFileName = undefined;
        deal.videoMimeType = undefined;
        deal.videoUrl = undefined;
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

export function listSalonDeals(salonId: string, activeOnly = false): SalonDeal[] {
  ensureSalonExists(salonId);
  runDealExpiryAndVideoRetentionCron(salonId);
  const store = ensureStoreLoaded();
  const nowMs = Date.now();
  return (store.deals || [])
    .filter((d) => d.salonId === salonId && (!activeOnly || isDealCurrentlyActive(d, nowMs)))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((d) => enrichDealWithTranslations(d));
}

export function createSalonDeal(
  salonId: string,
  input: {
    title: string;
    description?: string;
    discountType?: DealDiscountType;
    discountValue?: number;
    serviceIds?: string[];
    expiresAt: string;
    videoRetentionDaysAfterExpiry?: number;
    videoBuffer?: Buffer;
    videoOriginalName?: string;
    videoMimeType?: string;
  }
): { deal: SalonDeal; state: SalonConciergeStateResponse } {
  const store = ensureStoreLoaded();
  const settings = ensureSalonExists(salonId);
  const cleanTitle = sanitizePlainText(input.title, 100);
  if (!cleanTitle) {
    throw new Error('Deal title is required.');
  }
  const expDate = new Date(input.expiresAt);
  if (Number.isNaN(expDate.getTime())) {
    throw new Error('Valid deal expiry date is required.');
  }

  const discountType: DealDiscountType =
    input.discountType === 'FIXED' || input.discountType === 'BUNDLE_PRICE'
      ? input.discountType
      : 'PCT';
  const discountValue =
    discountType === 'PCT'
      ? clampInteger(input.discountValue ?? 15, 1, 90, 15)
      : clampInteger(input.discountValue ?? 500, 0, 500000, 500);

  const configuredServices = settings.enabledServices || [];
  const requestedIds = Array.isArray(input.serviceIds) ? input.serviceIds : [];
  const matchedServices = configuredServices.filter(
    (s) => s.active !== false && s.id && requestedIds.includes(s.id)
  );
  const finalServices =
    matchedServices.length > 0
      ? matchedServices
      : configuredServices.filter((s) => s.active !== false).slice(0, 2);

  const retentionDays = clampInteger(
    input.videoRetentionDaysAfterExpiry ?? settings.videoRetentionDaysAfterExpiry ?? 30,
    1,
    365,
    30
  );

  const dealId = `deal-${salonId}-${Date.now().toString(36)}`;
  let videoFileName: string | undefined;
  let videoMimeType: string | undefined;
  let videoUrl: string | undefined;

  if (input.videoBuffer && input.videoBuffer.length > 0) {
    const allowedMimeMap: Record<string, string> = {
      'video/mp4': '.mp4',
      'video/webm': '.webm',
      'video/quicktime': '.mov',
    };
    const rawMime = (input.videoMimeType || 'video/mp4').toLowerCase().split(';')[0].trim();
    const ext = allowedMimeMap[rawMime] || '.mp4';
    if (!fs.existsSync(DEAL_VIDEO_DIR)) {
      fs.mkdirSync(DEAL_VIDEO_DIR, { recursive: true });
    }
    videoFileName = `${dealId}${ext}`.replace(/[^a-zA-Z0-9._-]/g, '');
    videoMimeType = allowedMimeMap[rawMime] ? rawMime : 'video/mp4';
    fs.writeFileSync(path.join(DEAL_VIDEO_DIR, videoFileName), input.videoBuffer);
    videoUrl = `/api/public/deal-videos/${encodeURIComponent(videoFileName)}`;
  }

  const deal: SalonDeal = {
    id: dealId,
    salonId,
    title: cleanTitle,
    description:
      sanitizePlainText(input.description || '', 300) ||
      `Special salon offer valid until ${expDate.toLocaleDateString()}.`,
    discountType,
    discountValue,
    serviceIds: finalServices.map((s) => s.id || s.name),
    serviceNames: finalServices.map((s) => s.name),
    startsAt: new Date().toISOString(),
    expiresAt: expDate.toISOString(),
    videoRetentionDaysAfterExpiry: retentionDays,
    videoFileName,
    videoMimeType,
    videoUrl,
    videoDeletedAt: null,
    active: expDate.getTime() > Date.now(),
    createdAt: new Date().toISOString(),
  };

  store.deals = [deal, ...(store.deals || [])];
  persistStore(salonId);
  return { deal, state: getSalonConciergeState(salonId) };
}

export function deleteSalonDeal(salonId: string, dealId: string): SalonConciergeStateResponse {
  const store = ensureStoreLoaded();
  const target = (store.deals || []).find((d) => d.salonId === salonId && d.id === dealId);
  if (target?.videoFileName) {
    try {
      const p = path.join(DEAL_VIDEO_DIR, path.basename(target.videoFileName));
      if (fs.existsSync(p)) fs.unlinkSync(p);
    } catch {}
  }
  store.deals = (store.deals || []).filter((d) => !(d.salonId === salonId && d.id === dealId));
  persistStore(salonId);
  return getSalonConciergeState(salonId);
}

export function getDealVideoFileInfo(
  fileName: string
): { filePath: string; mimeType: string } | null {
  runDealExpiryAndVideoRetentionCron();
  const safeName = path.basename(fileName || '');
  if (!safeName || safeName.includes('..')) return null;
  const fullPath = path.join(DEAL_VIDEO_DIR, safeName);
  if (!fs.existsSync(fullPath)) return null;
  const ext = path.extname(safeName).toLowerCase();
  const mimeType =
    ext === '.webm' ? 'video/webm' : ext === '.mov' ? 'video/quicktime' : 'video/mp4';
  return { filePath: fullPath, mimeType };
}

export function getPublicDealPayload(
  salonCode: string,
  dealId: string
): PublicDealPageResponse | null {
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
    (s) => (s.id && deal.serviceIds.includes(s.id)) || deal.serviceNames.includes(s.name)
  );
  const enrichedActive = enrichServicesWithTranslations(activeServices);
  const enrichedMatched = enrichServicesWithTranslations(
    matchedServices.length > 0 ? matchedServices : activeServices.slice(0, 2)
  );
  const address = settings.address || SEEDED_SALON_ADDRESSES[salonId] || 'Salon Location';
  const googleMapsUrl =
    settings.googleMapsUrl || buildGoogleMapsSearchUrl(settings.salonName, address);

  return {
    salonId,
    publicCode: settings.publicCode,
    salonName: settings.salonName,
    salonCategory: settings.salonCategory || 'MENS',
    address,
    googleMapsUrl,
    currencySymbol: settings.currencySymbol,
    deal: enrichDealWithTranslations(deal),
    isExpired,
    videoPurged,
    retentionDaysAfterExpiry:
      deal.videoRetentionDaysAfterExpiry ?? settings.videoRetentionDaysAfterExpiry ?? 30,
    services: enrichedActive,
    matchedServices: enrichedMatched,
    availableLanguages: getConfiguredLanguageChoices(settings),
    defaultLanguage: settings.defaultLang || 'en',
  };
}

function getScheduleForDate(
  hours: SalonOperatingHours,
  dateStr: string
): {
  isOpen: boolean;
  dayName: string;
  openMins: number;
  closeMins: number;
  breakStartMins?: number;
  breakEndMins?: number;
  closedReason?: string;
  fridayBreakText?: string;
} {
  const parts = dateStr.split('-').map((n) => parseInt(n, 10));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    return {
      isOpen: false,
      dayName: 'Invalid Date',
      openMins: 0,
      closeMins: 0,
      closedReason: 'Invalid date selected.',
    };
  }
  const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12, 0, 0));
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dow = dt.getUTCDay();
  const dayName = dayNames[dow];

  if (dow === 5) {
    if (hours.fridayClosed) {
      return {
        isOpen: false,
        dayName,
        openMins: 0,
        closeMins: 0,
        closedReason: 'Salon is closed on Friday.',
      };
    }
    const openMins = parseTimeSlotToMinutes(hours.fridayOpen);
    const closeMins = parseTimeSlotToMinutes(hours.fridayClose);
    const bStart = parseTimeSlotToMinutes(hours.fridayBreakStart || '');
    const bEnd = parseTimeSlotToMinutes(hours.fridayBreakEnd || '');
    return {
      isOpen: openMins >= 0 && closeMins > openMins,
      dayName,
      openMins: openMins >= 0 ? openMins : 660,
      closeMins: closeMins > 0 ? closeMins : 1380,
      breakStartMins: bStart >= 0 ? bStart : undefined,
      breakEndMins: bEnd > bStart ? bEnd : undefined,
      fridayBreakText:
        bStart >= 0 && bEnd > bStart && hours.fridayBreakStart && hours.fridayBreakEnd
          ? `Friday Prayer Break: ${hours.fridayBreakStart} – ${hours.fridayBreakEnd}`
          : undefined,
    };
  }

  if (dow === 0 || dow === 6) {
    if (hours.satSunClosed) {
      return {
        isOpen: false,
        dayName,
        openMins: 0,
        closeMins: 0,
        closedReason: `Salon is closed on ${dayName}.`,
      };
    }
    const openMins = parseTimeSlotToMinutes(hours.satSunOpen);
    const closeMins = parseTimeSlotToMinutes(hours.satSunClose);
    return {
      isOpen: openMins >= 0 && closeMins > openMins,
      dayName,
      openMins: openMins >= 0 ? openMins : 630,
      closeMins: closeMins > 0 ? closeMins : 1380,
    };
  }

  if (hours.monThuClosed) {
    return {
      isOpen: false,
      dayName,
      openMins: 0,
      closeMins: 0,
      closedReason: `Salon is closed on ${dayName}.`,
    };
  }
  const openMins = parseTimeSlotToMinutes(hours.monThuOpen);
  const closeMins = parseTimeSlotToMinutes(hours.monThuClose);
  return {
    isOpen: openMins >= 0 && closeMins > openMins,
    dayName,
    openMins: openMins >= 0 ? openMins : 660,
    closeMins: closeMins > 0 ? closeMins : 1320,
  };
}

export function getCustomerExperienceConfig(
  salonId: string,
  clientToken?: string,
  requestedLang?: ClientPreferredLang
): CustomerExperienceConfig {
  const settings = ensureSalonExists(salonId);
  runDealExpiryAndVideoRetentionCron(salonId);
  const store = ensureStoreLoaded();
  const regionMeta = detectRegionFromPhone(settings.whatsappPhone);
  const availableLanguages = getConfiguredLanguageChoices(settings);

  // Returning client recognition uses ONLY verified HMAC token (?c= or HttpOnly wc_cli_<code > cookie)
  // Unverified phone query parameters NEVER leak client names or PII.
  let verifiedClient: ConciergeClientProfile | undefined;
  if (clientToken) {
    const claims = verifyCustomerRecognizeToken(clientToken, salonId);
    if (claims?.clientId) {
      verifiedClient = store.clients.find(
        (c) => c.salonId === salonId && c.id === claims.clientId
      );
    }
  }

  const returningClient: ReturningClientSnapshot | null = verifiedClient
    ? {
        clientId: verifiedClient.id,
        clientName: verifiedClient.name,
        maskedPhone: maskPhoneNumber(verifiedClient.phone),
        preferredLanguage: (verifiedClient.preferredLanguage || 'en') as ClientPreferredLang,
        totalVisits: Number(verifiedClient.totalVisits || 0),
        lastServiceIds: Array.isArray(verifiedClient.lastServiceIds)
          ? verifiedClient.lastServiceIds
          : [],
        lastBarberName: verifiedClient.lastBarberName || null,
        marketingOptIn: Boolean(verifiedClient.marketingOptIn),
      }
    : null;

  const defaultLanguage: ClientPreferredLang =
    requestedLang && availableLanguages.some((l) => l.lang === requestedLang)
      ? requestedLang
      : returningClient?.preferredLanguage &&
        availableLanguages.some((l) => l.lang === returningClient.preferredLanguage)
      ? returningClient.preferredLanguage
      : settings.defaultLang || 'en';

  const activeServices = (settings.enabledServices || []).filter((s) => s.active !== false);
  const activeDeals = listSalonDeals(salonId, true).map((d) => ({
    ...d,
    dealPagePath: `/deal/${encodeURIComponent(settings.publicCode)}/${encodeURIComponent(d.id)}`,
  }));
  const address = settings.address || SEEDED_SALON_ADDRESSES[salonId] || 'Salon Location';
  const googleMapsUrl =
    settings.googleMapsUrl || buildGoogleMapsSearchUrl(settings.salonName, address);
  const usage = getMonthlyUsageSnapshot(salonId);

  return {
    salonId,
    publicCode: settings.publicCode,
    salonName: settings.salonName,
    salonCategory: settings.salonCategory || 'MENS',
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
    usageStatus: usage.status,
  };
}

function buildCustomerWelcomeMenu(
  settings: RetentionSettings,
  lang: ClientPreferredLang,
  savedClientName?: string | null
): CustomerWelcomeMenuResponse {
  const availableLanguages = getConfiguredLanguageChoices(settings);
  const resolvedLang = availableLanguages.some((l) => l.lang === lang) ? lang : 'en';
  const dir = getLangDirection(resolvedLang);
  const cleanName = savedClientName ? sanitizePlainText(savedClientName, 80) : '';

  const copyMap: Record<
    ClientPreferredLang,
    {
      welcome: string;
      book: string;
      services: string;
      hours: string;
      deals: string;
    }
  > = {
    en: {
      welcome: cleanName
        ? `Welcome back to ${settings.salonName}, ${cleanName}! Choose a language below or pick an option:`
        : `Welcome to ${settings.salonName}! Choose a language below or pick an option to get started:`,
      book: 'Book Appointment',
      services: 'Services & Prices',
      hours: 'Opening Hours & Location',
      deals: 'Current Deals & Offers',
    },
    roman_ur: {
      welcome: cleanName
        ? `${settings.salonName} mein dobara khush amdeed, ${cleanName}! Language select karein ya neeche option chunein:`
        : `${settings.salonName} mein khush amdeed! Language select karein ya neeche diye gaye option chunein:`,
      book: 'Appointment Book Karein',
      services: 'Services aur Prices',
      hours: 'Opening Hours aur Location',
      deals: 'Current Deals aur Offers',
    },
    ur: {
      welcome: cleanName
        ? `${settings.salonName} میں دوبارہ خوش آمدید، ${cleanName}! اپنی زبان منتخب کریں یا نیچے دیے گئے آپشنز میں سے انتخاب کریں:`
        : `${settings.salonName} میں خوش آمدید! اپنی زبان منتخب کریں یا نیچے دیے گئے آپشنز میں سے انتخاب کریں:`,
      book: 'اپائنٹمنٹ بک کریں',
      services: 'سروسز اور قیمتیں',
      hours: 'اوقات اور لوکیشن',
      deals: 'موجودہ ڈیلز اور آفرز',
    },
    ar: {
      welcome: cleanName
        ? `أهلاً بعودتك إلى ${settings.salonName}، ${cleanName}! اختر لغتك المفضلة أو حدد أحد الخيارات التالية:`
        : `أهلاً بك في ${settings.salonName}! اختر لغتك المفضلة أو حدد أحد الخيارات التالية:`,
      book: 'حجز موعد',
      services: 'الخدمات والأسعار',
      hours: 'ساعات العمل والموقع',
      deals: 'العروض والباقات الحالية',
    },
  };

  const c = copyMap[resolvedLang];
  return {
    language: resolvedLang,
    dir,
    welcomeText: c.welcome,
    options: [
      { id: 'BOOK_APPOINTMENT', label: c.book },
      { id: 'SERVICES_PRICES', label: c.services },
      { id: 'HOURS_LOCATION', label: c.hours },
      { id: 'CURRENT_DEALS', label: c.deals },
    ],
    availableLanguages,
  };
}

export function handleCustomerWhatsAppAction(input: {
  salonId: string;
  fromPhone?: string;
  messageText?: string;
  actionId?: CustomerMenuActionId | 'WELCOME';
  preferredLang?: ClientPreferredLang;
  clientName?: string;
  isDemo?: boolean;
}): CustomerActionMessageResponse {
  const settings = ensureSalonExists(input.salonId);
  runDealExpiryAndVideoRetentionCron(input.salonId);
  const store = ensureStoreLoaded();
  const isDemo = Boolean(input.isDemo);
  const cleanPhone = sanitizePhone(input.fromPhone || '+92 300 0000000') || '+92 300 0000000';
  const raw = sanitizePlainText(input.messageText || '', 300);
  const lower = raw.toLowerCase();

  let client = store.clients.find(
    (c) => c.salonId === input.salonId && c.phone.replace(/\s+/g, '') === cleanPhone.replace(/\s+/g, '')
  );
  if (!isDemo && !client) {
    client = upsertClientProfile(input.salonId, {
      phone: cleanPhone,
      name: input.clientName || 'WhatsApp Client',
      preferredLanguage: input.preferredLang || 'en',
    });
  }

  const availableLanguages = getConfiguredLanguageChoices(settings);
  const activeLang: ClientPreferredLang =
    input.preferredLang && availableLanguages.some((l) => l.lang === input.preferredLang)
      ? input.preferredLang
      : client?.preferredLanguage && availableLanguages.some((l) => l.lang === client.preferredLanguage)
      ? client.preferredLanguage
      : 'en';
  const dir = getLangDirection(activeLang);

  if (!isDemo && client && input.preferredLang) {
    client.preferredLanguage = activeLang;
    client.awaitingLanguageSelection = false;
  }

  let resolvedAction: CustomerMenuActionId | 'WELCOME' = input.actionId || 'WELCOME';
  if (!input.actionId) {
    if (/^(hi|hello|hey|salam|assalam|marhaba|السلام|مرحبا)\b/i.test(lower)) {
      resolvedAction = 'WELCOME';
    } else if (/book|appointment|reserve|حجز|بک/i.test(lower) || raw === '1') {
      resolvedAction = 'BOOK_APPOINTMENT';
    } else if (/service|price|rate|menu|سروس|قیمت|أسعار/i.test(lower) || raw === '2') {
      resolvedAction = 'SERVICES_PRICES';
    } else if (/hour|timing|open|location|address|map|اوقات|لوکیشن|موقع|ساعات/i.test(lower) || raw === '3') {
      resolvedAction = 'HOURS_LOCATION';
    } else if (/deal|offer|promo|video|آفر|ڈیل|عرض/i.test(lower) || raw === '4') {
      resolvedAction = 'CURRENT_DEALS';
    }
  }

  const activeServices = enrichServicesWithTranslations(
    (settings.enabledServices || []).filter((s) => s.active !== false)
  );
  const hours = settings.operatingHours || { ...DEFAULT_SALON_OPERATING_HOURS };
  const address = settings.address || SEEDED_SALON_ADDRESSES[input.salonId] || 'Salon Location';
  const googleMapsUrl =
    settings.googleMapsUrl || buildGoogleMapsSearchUrl(settings.salonName, address);
  const activeDeals = listSalonDeals(input.salonId, true).map((d) => ({
    ...d,
    dealPagePath: `/deal/${encodeURIComponent(settings.publicCode)}/${encodeURIComponent(d.id)}`,
  }));

  const savedStatus = resolveSavedNameStatus(client);
  const greetingName =
    input.clientName !== undefined
      ? sanitizePlainText(input.clientName, 80) || null
      : savedStatus.hasSavedName
      ? savedStatus.savedName
      : null;

  const bookCtaMap: Record<ClientPreferredLang, string> = {
    en: 'Book Appointment',
    roman_ur: 'Appointment Book Karein',
    ur: 'اپائنٹمنٹ بک کریں',
    ar: 'حجز موعد',
  };

  if (resolvedAction === 'WELCOME') {
    const welcome = buildCustomerWelcomeMenu(settings, activeLang, greetingName);
    return {
      language: welcome.language,
      dir: welcome.dir,
      action: 'WELCOME',
      text: welcome.welcomeText,
      welcome,
    };
  }

  if (resolvedAction === 'BOOK_APPOINTMENT') {
    const openFlowLabel: Record<ClientPreferredLang, string> = {
      en: `Opening the instant booking form for ${settings.salonName}...`,
      roman_ur: `${settings.salonName} ka booking form khul raha hai...`,
      ur: `${settings.salonName} کا بکنگ فارم کھل رہا ہے...`,
      ar: `جاري فتح نموذج الحجز الفوري لـ ${settings.salonName}...`,
    };
    return {
      language: activeLang,
      dir,
      action: 'BOOK_APPOINTMENT',
      text: openFlowLabel[activeLang],
      openBookingFlow: true,
    };
  }

  if (resolvedAction === 'SERVICES_PRICES') {
    const minWordMap: Record<ClientPreferredLang, string> = {
      en: 'min',
      roman_ur: 'min',
      ur: 'منٹ',
      ar: 'دقيقة',
    };
    const lines = activeServices.map((s) => {
      const displayName = s.translations?.[activeLang] || localizeServiceName(s.name, activeLang);
      return `• ${displayName} — ${settings.currencySymbol}${s.price.toLocaleString()} (${s.durationMins || 35} ${minWordMap[activeLang]})`;
    });
    const header: Record<ClientPreferredLang, string> = {
      en: `${settings.salonName} — Services & Prices:\n${lines.join('\n')}`,
      roman_ur: `${settings.salonName} — Services aur Prices:\n${lines.join('\n')}`,
      ur: `${settings.salonName} — سروسز اور قیمتیں:\n${lines.join('\n')}`,
      ar: `${settings.salonName} — الخدمات والأسعار:\n${lines.join('\n')}`,
    };
    const text = header[activeLang];
    if (!isDemo && client) {
      appendLog(input.salonId, {
        direction: 'OUTBOUND',
        module: 'BOOKING',
        clientName: client.name,
        clientPhone: client.phone,
        language: activeLang,
        dir,
        body: text,
      });
      persistStore(input.salonId);
    }
    return {
      language: activeLang,
      dir,
      action: 'SERVICES_PRICES',
      text,
      showBookCta: true,
      bookCtaLabel: bookCtaMap[activeLang],
      services: activeServices,
    };
  }

  if (resolvedAction === 'HOURS_LOCATION') {
    const uniformDaily = isUniformDailySchedule(hours);
    const closedWord: Record<ClientPreferredLang, string> = {
      en: 'Closed',
      roman_ur: 'Band',
      ur: 'بند',
      ar: 'مغلق',
    };
    const breakWord: Record<ClientPreferredLang, string> = {
      en: 'Break',
      roman_ur: 'Waqfa',
      ur: 'وقفہ',
      ar: 'استراحة',
    };

    const monThu = hours.monThuClosed
      ? closedWord[activeLang]
      : `${hours.monThuOpen} – ${hours.monThuClose}`;
    const fri = hours.fridayClosed
      ? closedWord[activeLang]
      : `${hours.fridayOpen} – ${hours.fridayClose}${
          hours.fridayBreakStart &&
          hours.fridayBreakEnd &&
          hours.fridayBreakStart.toLowerCase() !== 'none' &&
          hours.fridayBreakEnd.toLowerCase() !== 'none'
            ? ` (${breakWord[activeLang]}: ${hours.fridayBreakStart} – ${hours.fridayBreakEnd})`
            : ''
        }`;
    const satSun = hours.satSunClosed
      ? closedWord[activeLang]
      : `${hours.satSunOpen} – ${hours.satSunClose}`;

    const scheduleBlock: Record<ClientPreferredLang, string> = uniformDaily
      ? {
          en: `Mon – Sun: ${hours.monThuOpen} – ${hours.monThuClose}`,
          roman_ur: `Peer – Itwar: ${hours.monThuOpen} – ${hours.monThuClose}`,
          ur: `پیر تا اتوار: ${hours.monThuOpen} – ${hours.monThuClose}`,
          ar: `الإثنين – الأحد: ${hours.monThuOpen} – ${hours.monThuClose}`,
        }
      : {
          en: `Mon–Thu: ${monThu}\nFriday: ${fri}\nSat–Sun: ${satSun}`,
          roman_ur: `Mon–Thu: ${monThu}\nJumma (Friday): ${fri}\nSat–Sun: ${satSun}`,
          ur: `پیر تا جمعرات: ${monThu}\nجمعہ: ${fri}\nہفتہ اور اتوار: ${satSun}`,
          ar: `الإثنين – الخميس: ${monThu}\nالجمعة: ${fri}\nالسبت – الأحد: ${satSun}`,
        };

    const header: Record<ClientPreferredLang, string> = {
      en: `${settings.salonName} — Opening Hours & Location:\n${scheduleBlock.en}\nAddress: ${address}`,
      roman_ur: `${settings.salonName} — Opening Hours aur Location:\n${scheduleBlock.roman_ur}\nAddress: ${address}`,
      ur: `${settings.salonName} — کھلنے کے اوقات اور لوکیشن:\n${scheduleBlock.ur}\nپتہ: ${address}`,
      ar: `${settings.salonName} — ساعات العمل والموقع:\n${scheduleBlock.ar}\nالعنوان: ${address}`,
    };
    const text = header[activeLang];
    if (!isDemo && client) {
      appendLog(input.salonId, {
        direction: 'OUTBOUND',
        module: 'BOOKING',
        clientName: client.name,
        clientPhone: client.phone,
        language: activeLang,
        dir,
        body: text,
      });
      persistStore(input.salonId);
    }
    return {
      language: activeLang,
      dir,
      action: 'HOURS_LOCATION',
      text,
      showBookCta: true,
      bookCtaLabel: bookCtaMap[activeLang],
      hours,
      address,
      googleMapsUrl,
    };
  }

  // CURRENT_DEALS — strictly active non-expired deals only (Text-first clarity)
  let text = '';
  if (activeDeals.length === 0) {
    const emptyMap: Record<ClientPreferredLang, string> = {
      en: `${settings.salonName}: No active deals right now. You can still book any regular service anytime!`,
      roman_ur: `${settings.salonName}: Is waqt koi active deal nahi hai. Aap regular service book kar sakte hain!`,
      ur: `${settings.salonName}: اس وقت کوئی فعال ڈیل دستیاب نہیں ہے۔ آپ باقاعدہ سروس بک کر سکتے ہیں!`,
      ar: `${settings.salonName}: لا توجد عروض سارية حالياً. يمكنك حجز أي خدمة اعتيادية في أي وقت!`,
    };
    text = emptyMap[activeLang];
  } else {
    const dealLines = activeDeals.map((d) => {
      const badge =
        d.discountType === 'PCT'
          ? activeLang === 'ur'
            ? `${d.discountValue}% رعایت`
            : activeLang === 'ar'
            ? `خصم ${d.discountValue}%`
            : `${d.discountValue}% OFF`
          : d.discountType === 'FIXED'
          ? activeLang === 'ur'
            ? `${settings.currencySymbol}${d.discountValue.toLocaleString()} رعایت`
            : activeLang === 'ar'
            ? `خصم ${settings.currencySymbol}${d.discountValue.toLocaleString()}`
            : `${settings.currencySymbol}${d.discountValue.toLocaleString()} OFF`
          : activeLang === 'ur'
          ? `پیکیج ${settings.currencySymbol}${d.discountValue.toLocaleString()}`
          : activeLang === 'ar'
          ? `باقة ${settings.currencySymbol}${d.discountValue.toLocaleString()}`
          : `Bundle ${settings.currencySymbol}${d.discountValue.toLocaleString()}`;
      const expDate = new Date(d.expiresAt).toLocaleDateString(
        activeLang === 'ur' ? 'ur-PK' : activeLang === 'ar' ? 'ar-AE' : 'en-GB'
      );
      const expLabel =
        activeLang === 'ur'
          ? `آخری تاریخ ${expDate}`
          : activeLang === 'ar'
          ? `ساري حتى ${expDate}`
          : activeLang === 'roman_ur'
          ? `Aakhri tareekh ${expDate}`
          : `Expires ${expDate}`;
      const localizedDealTitle = d.titleTranslations?.[activeLang] || d.title;
      const titleAlreadyShowsBadge =
        localizedDealTitle.includes(badge) ||
        (d.discountType === 'PCT' && localizedDealTitle.includes(`${d.discountValue}%`));
      return titleAlreadyShowsBadge
        ? `• ${localizedDealTitle} — ${expLabel}`
        : `• ${localizedDealTitle} (${badge}) — ${expLabel}`;
    });
    const prefix: Record<ClientPreferredLang, string> = {
      en: `${settings.salonName} — Active Deals & Offers:\n${dealLines.join('\n')}`,
      roman_ur: `${settings.salonName} — Active Deals aur Offers:\n${dealLines.join('\n')}`,
      ur: `${settings.salonName} — موجودہ فعال ڈیلز:\n${dealLines.join('\n')}`,
      ar: `${settings.salonName} — العروض السارية حالياً:\n${dealLines.join('\n')}`,
    };
    text = prefix[activeLang];
  }

  if (!isDemo && client) {
    appendLog(input.salonId, {
      direction: 'OUTBOUND',
      module: 'BOOKING',
      clientName: client.name,
      clientPhone: client.phone,
      language: activeLang,
      dir,
      body: text,
    });
    persistStore(input.salonId);
  }
  return {
    language: activeLang,
    dir,
    action: 'CURRENT_DEALS',
    text,
    deals: activeDeals,
  };
}

export function getAvailableSlotsAndBarbers(input: {
  salonId: string;
  date: string;
  durationMins?: number;
  serviceIds?: string[];
  demoBusyBarber?: string;
  demoBusyTimeSlot?: string;
}): CustomerAvailabilityResponse {
  const settings = ensureSalonExists(input.salonId);
  const hours = settings.operatingHours || { ...DEFAULT_SALON_OPERATING_HOURS };
  const barbers = getSalonBarbers(input.salonId);

  const configuredServices = (settings.enabledServices || []).filter((s) => s.active !== false);
  const requestedIds = Array.isArray(input.serviceIds) ? input.serviceIds : [];
  const selectedServices =
    requestedIds.length > 0
      ? configuredServices.filter(
          (s) => (s.id && requestedIds.includes(s.id)) || requestedIds.includes(s.name)
        )
      : [];
  const maxBufferMins = selectedServices.reduce(
    (maxB, s) => Math.max(maxB, Number(s.bufferAfterMins || 0)),
    0
  );
  const eligibleBarbersSet: Set<string> | null = (() => {
    const sets = selectedServices
      .map((s) => (Array.isArray(s.eligibleStylists) && s.eligibleStylists.length > 0 ? s.eligibleStylists : null))
      .filter((x): x is string[] => Boolean(x));
    if (sets.length === 0) return null;
    let common = new Set(sets[0].map((n) => n.toLowerCase()));
    for (const arr of sets.slice(1)) {
      const nextSet = new Set(arr.map((n) => n.toLowerCase()));
      common = new Set([...common].filter((n) => nextSet.has(n)));
    }
    return common;
  })();

  const durationMins = clampInteger(input.durationMins ?? 40, 10, 300, 40) + maxBufferMins;
  const cleanDate = /^\d{4}-\d{2}-\d{2}$/.test(input.date)
    ? input.date
    : getSalonLocalDateParts(settings.timezoneOffsetHours).dateStr;

  const schedule = getScheduleForDate(hours, cleanDate);
  if (!schedule.isOpen) {
    return {
      salonId: input.salonId,
      publicCode: settings.publicCode,
      date: cleanDate,
      dayName: schedule.dayName,
      isOpen: false,
      closedReason: schedule.closedReason || 'Salon is closed on this date.',
      totalDurationMins: durationMins,
      slots: [],
      barbers,
    };
  }

  const localNow = getSalonLocalDateParts(settings.timezoneOffsetHours);
  const isToday = cleanDate === localNow.dateStr;
  const slots: CustomerSlotAvailability[] = [];

  for (let start = schedule.openMins; start + durationMins <= schedule.closeMins; start += 30) {
    const end = start + durationMins;
    if (isToday && start < localNow.minutesOfDay + 15) {
      continue;
    }
    if (
      schedule.breakStartMins !== undefined &&
      schedule.breakEndMins !== undefined &&
      start < schedule.breakEndMins &&
      end > schedule.breakStartMins
    ) {
      continue;
    }

    const timeSlot = formatMinutesToTimeSlot(start);
    const barberStatuses: CustomerBarberAvailability[] = barbers.map((barberName) => {
      if (eligibleBarbersSet && !eligibleBarbersSet.has(barberName.toLowerCase())) {
        return {
          name: barberName,
          available: false,
          reason: 'Not assigned to selected service',
        };
      }
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
        reason: check.reason,
      };
    });

    const availableBarberCount = barberStatuses.filter((b) => b.available).length;
    if (availableBarberCount > 0 || input.demoBusyBarber) {
      slots.push({
        timeSlot,
        startMinutes: start,
        availableBarberCount,
        barbers: barberStatuses,
      });
    }
  }

  return {
    salonId: input.salonId,
    publicCode: settings.publicCode,
    date: cleanDate,
    dayName: schedule.dayName,
    isOpen: true,
    fridayBreakText: schedule.fridayBreakText,
    totalDurationMins: durationMins,
    slots,
    barbers,
  };
}

function buildIcsCalendarContent(params: {
  bookingId: string;
  salonName: string;
  service: string;
  barberName: string;
  address: string;
  startsAtIso: string;
  durationMins: number;
}): string {
  const start = new Date(params.startsAtIso);
  const end = new Date(start.getTime() + params.durationMins * 60000);
  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//WorkCraft Local//Booking//EN',
    'BEGIN:VEVENT',
    `UID:${params.bookingId}@workcraft.local`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${params.salonName} — ${params.service} (${params.barberName})`,
    `LOCATION:${params.address}`,
    `DESCRIPTION:Booking Ref ${params.bookingId} with ${params.barberName} at ${params.salonName}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

function findRawAccessTokenForBooking(bookingId: string, salonId: string, expiresAtMs: number): string {
  const store = ensureStoreLoaded();
  const rawAccessToken = crypto.randomBytes(24).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(rawAccessToken).digest('hex');
  store.bookingAccessTokens[tokenHash] = {
    bookingId,
    salonId,
    expiresAtMs,
    revoked: false,
  };
  return rawAccessToken;
}

export async function createCustomerFlowBooking(
  salonId: string,
  input: CustomerFlowBookingRequest
): Promise<{
  statusCode: number;
  payload: CustomerFlowBookingResponse;
  recognizeCookieToken?: string;
}> {
  const store = ensureStoreLoaded();
  const settings = ensureSalonExists(salonId);
  runDealExpiryAndVideoRetentionCron(salonId);

  const isDemo = Boolean(input.isDemo);
  const cleanIdempotencyKey = input.idempotencyKey
    ? sanitizePlainText(input.idempotencyKey, 96)
    : undefined;

  if (!isDemo && cleanIdempotencyKey) {
    const existingAppt = store.appointments.find(
      (a) => a.salonId === salonId && a.idempotencyKey === cleanIdempotencyKey
    );
    if (existingAppt) {
      const address = settings.address || SEEDED_SALON_ADDRESSES[salonId] || 'Salon Location';
      const googleMapsUrl =
        settings.googleMapsUrl || buildGoogleMapsSearchUrl(settings.salonName, address);
      const rawToken = findRawAccessTokenForBooking(
        existingAppt.id,
        salonId,
        (existingAppt.scheduledEndMs || Date.now()) + 7 * 86400000
      );
      const recognizeToken = signCustomerRecognizeToken({
        salonId,
        publicCode: settings.publicCode,
        clientId: existingAppt.clientId,
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
          address,
          googleMapsUrl,
          bookingManagementToken: rawToken,
          bookingManagementPath: `/b/${rawToken}`,
          personalReturningShareUrl: `/s/${encodeURIComponent(settings.publicCode)}?c=${encodeURIComponent(recognizeToken)}`,
          maskedPhone: maskPhoneNumber(existingAppt.clientPhone),
        },
      };
    }
  }

  // Monthly booking quota guard (750 / 1,500 / 3,000 / >3,000 Custom + grace)
  const usage = getMonthlyUsageSnapshot(salonId);
  if (!isDemo && usage.billableBookings >= usage.monthlyLimit + usage.graceLimit) {
    return {
      statusCode: 402,
      payload: {
        ok: false,
        code: 'QUOTA_EXCEEDED',
        error: `${settings.salonName} has reached its monthly online booking capacity. Please call the salon directly.`,
        publicContactPhone: settings.publicContactPhone || settings.whatsappPhone,
      },
    };
  }

  const verifiedClient = input.verifiedClientId
    ? store.clients.find((c) => c.salonId === salonId && c.id === input.verifiedClientId)
    : undefined;

  const cleanPhone =
    sanitizePhone(input.clientPhone || '') ||
    (verifiedClient ? verifiedClient.phone : '');
  if (!cleanPhone || cleanPhone.replace(/\D/g, '').length < 6) {
    return {
      statusCode: 400,
      payload: { ok: false, code: 'VALIDATION_ERROR', error: 'Valid phone number is required.' },
    };
  }

  const configuredServices = (settings.enabledServices || []).filter((s) => s.active !== false);
  const requestedIds = Array.isArray(input.serviceIds) ? input.serviceIds : [];
  const selectedServices = configuredServices.filter(
    (s) => (s.id && requestedIds.includes(s.id)) || requestedIds.includes(s.name)
  );
  if (selectedServices.length === 0) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        code: 'VALIDATION_ERROR',
        error: 'Please select at least one active salon service.',
      },
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
  let appliedDeal: CustomerFlowBookingResponse['appliedDeal'] = null;

  if (input.dealId) {
    const deal = (store.deals || []).find((d) => d.salonId === salonId && d.id === input.dealId);
    if (!deal || !isDealCurrentlyActive(deal)) {
      return {
        statusCode: 400,
        payload: {
          ok: false,
          code: 'INVALID_DEAL',
          error: 'This promotional deal has expired and is no longer available.',
        },
      };
    }
    if (deal.discountType === 'PCT') {
      finalTotal = Math.max(0, Math.round(originalTotal * (1 - deal.discountValue / 100)));
    } else if (deal.discountType === 'FIXED') {
      finalTotal = Math.max(0, originalTotal - deal.discountValue);
    } else if (deal.discountType === 'BUNDLE_PRICE') {
      finalTotal = Math.max(0, Math.min(originalTotal, deal.discountValue));
    }
    appliedDeal = {
      id: deal.id,
      title: deal.title,
      originalTotal,
      finalTotal,
      savings: Math.max(0, originalTotal - finalTotal),
    };
  }

  const normPhone = cleanPhone.replace(/\s+/g, '');
  const existingClient =
    verifiedClient ||
    store.clients.find(
      (c) => c.salonId === salonId && c.phone.replace(/\s+/g, '') === normPhone
    );
  const savedInfo = resolveSavedNameStatus(existingClient);
  const providedName = sanitizePlainText(input.clientName || '', 80);
  const finalClientName = providedName || (savedInfo.hasSavedName ? savedInfo.savedName! : '');

  if (!finalClientName) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        code: 'NAME_REQUIRED',
        error: 'Please enter your complete name to book this appointment.',
      },
    };
  }

  const cleanDate = sanitizePlainText(input.appointmentDate || '', 20);
  const cleanTimeSlot = sanitizePlainText(input.timeSlot || '', 24);
  const cleanBarber = sanitizePlainText(input.barberName || '', 60);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate) || !cleanTimeSlot || !cleanBarber) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        code: 'VALIDATION_ERROR',
        error: 'Date, time slot, and barber selection are required.',
      },
    };
  }

  const availability = getAvailableSlotsAndBarbers({
    salonId,
    date: cleanDate,
    durationMins: totalDurationMins - maxBufferMins,
    serviceIds: selectedServices.map((s) => s.id || s.name),
    demoBusyBarber: isDemo ? input.demoBusyBarber : undefined,
    demoBusyTimeSlot: isDemo ? input.demoBusyTimeSlot : undefined,
  });

  if (!availability.isOpen) {
    return {
      statusCode: 409,
      payload: {
        ok: false,
        code: 'SALON_CLOSED',
        error: availability.closedReason || 'Salon is closed on the selected date.',
      },
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
        code: 'SLOT_UNAVAILABLE',
        error: `Time slot ${formattedTime} is no longer available for ${totalDurationMins} mins on ${cleanDate}. Please pick another slot.`,
      },
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
        code: 'SLOT_UNAVAILABLE',
        error: `${cleanBarber} is unavailable at ${formattedTime}${matchedBarber?.reason ? ` (${matchedBarber.reason})` : ''}. Please choose another available barber or slot.`,
      },
    };
  }

  const [y, m, d] = cleanDate.split('-').map((n) => parseInt(n, 10));
  const startUtcMs =
    Date.UTC(y, m - 1, d, Math.floor(startMinutes / 60), startMinutes % 60, 0) -
    settings.timezoneOffsetHours * 3600000;
  const scheduledEndMs = startUtcMs + totalDurationMins * 60000;

  const address = settings.address || SEEDED_SALON_ADDRESSES[salonId] || 'Salon Location';
  const googleMapsUrl =
    settings.googleMapsUrl || buildGoogleMapsSearchUrl(settings.salonName, address);

  const serviceNamesSummary = selectedServices.map((s) => s.name).join(' + ');
  const apptId = isDemo
    ? `DEMO-${Date.now().toString().slice(-4)}`
    : `BK-WEB-${Date.now().toString().slice(-4)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

  let clientId = existingClient?.id || `demo-cli-${Date.now().toString(36)}`;
  if (!isDemo) {
    const savedClient = upsertClientProfile(salonId, {
      phone: cleanPhone,
      name: finalClientName,
      preferredLanguage: input.preferredLanguage || existingClient?.preferredLanguage || 'en',
      marketingOptIn: input.marketingOptIn !== undefined ? Boolean(input.marketingOptIn) : existingClient?.marketingOptIn,
    });
    savedClient.totalVisits = (savedClient.totalVisits || 0) + 1;
    savedClient.lastServiceIds = selectedServices.map((s) => s.id || s.name);
    savedClient.lastBarberName = matchedBarber.name;
    clientId = savedClient.id;
  }

  const adSource: AdAttributionChannel = input.adSource || 'WEB_LINK';
  const sourceTypeMap: Record<AdAttributionChannel, ConciergeAppointment['sourceType']> = {
    FB: 'FB_AD',
    IG: 'IG_AD',
    TIKTOK: 'TIKTOK_AD',
    QR: 'WEB_QR',
    WEB_LINK: 'WEB_LINK',
    DIRECT: 'WEB_LINK',
  };

  const rawAccessToken = crypto.randomBytes(24).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(rawAccessToken).digest('hex');
  const accessTokenExpiresAtMs = scheduledEndMs + 7 * 86400000;
  const proofHash = crypto
    .createHash('sha256')
    .update(`${salonId}:${apptId}:${cleanDate}:${formattedTime}:${matchedBarber.name}`)
    .digest('hex');

  const newAppointment: ConciergeAppointment = {
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
    sourceType: sourceTypeMap[adSource] || 'WEB_LINK',
    status: 'CONFIRMED',
    scheduledForIso: new Date(startUtcMs).toISOString(),
    completedAt: null,
    reviewPromptSentAt: null,
    rating: null,
    ratingComment: null,
    reviewRoutedStatus: 'PENDING',
  };

  let recognizeCookieToken: string | undefined;

  if (!isDemo) {
    const pgCheck = await recordBookingInPostgres({
      salonPublicCode: settings.publicCode,
      bookingRef: apptId,
      clientName: finalClientName,
      clientPhoneE164: cleanPhone,
      preferredLang: input.preferredLanguage || 'en',
      stylistName: matchedBarber.name,
      servicesSnapshot: selectedServices.map((s) => ({
        id: s.id,
        name: s.name,
        price: s.price,
        durationMins: s.durationMins || 35,
      })),
      totalPrice: finalTotal,
      totalDurationMins,
      startsAtIso: newAppointment.scheduledForIso,
      endsAtIso: new Date(scheduledEndMs).toISOString(),
      source: newAppointment.sourceType || 'WEB_LINK',
      idempotencyKey: cleanIdempotencyKey,
      proofHash,
      billingMonth: getSalonBillingMonthKey(settings),
      monthlyLimit: usage.monthlyLimit,
      accessTokenHash: tokenHash,
      accessTokenExpiresAtIso: new Date(accessTokenExpiresAtMs).toISOString(),
    });
    if (!pgCheck.ok && pgCheck.code === 'OVERLAP') {
      return {
        statusCode: 409,
        payload: {
          ok: false,
          code: 'SLOT_UNAVAILABLE',
          error: pgCheck.error,
        },
      };
    }

    store.appointments.unshift(newAppointment);
    store.bookingAccessTokens[tokenHash] = {
      bookingId: apptId,
      salonId,
      expiresAtMs: accessTokenExpiresAtMs,
      revoked: false,
    };
    incrementMonthlyUsage(salonId);
    appendBookingAudit(
      salonId,
      apptId,
      'CUSTOMER',
      'CREATED',
      `Booked ${serviceNamesSummary} on ${cleanDate} at ${formattedTime} with ${matchedBarber.name} via ${adSource}.`
    );
    recognizeCookieToken = signCustomerRecognizeToken({
      salonId,
      publicCode: settings.publicCode,
      clientId,
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
      personalReturningShareUrl: recognizeCookieToken
        ? `/s/${encodeURIComponent(settings.publicCode)}?c=${encodeURIComponent(recognizeCookieToken)}`
        : undefined,
      maskedPhone: maskPhoneNumber(cleanPhone),
    },
  };
}

export function getBookingByAccessToken(rawToken: string): BookingManagementPayload | null {
  const clean = (rawToken || '').trim();
  if (!clean || clean.length < 12) return null;
  const store = ensureStoreLoaded();
  const tokenHash = crypto.createHash('sha256').update(clean).digest('hex');
  const tokenRec = store.bookingAccessTokens?.[tokenHash];
  if (!tokenRec || tokenRec.revoked || tokenRec.expiresAtMs < Date.now()) {
    return null;
  }
  const appt = store.appointments.find(
    (a) => a.salonId === tokenRec.salonId && a.id === tokenRec.bookingId
  );
  if (!appt) return null;
  const settings = ensureSalonExists(tokenRec.salonId);
  const address = settings.address || SEEDED_SALON_ADDRESSES[settings.salonId] || 'Salon Location';
  const googleMapsUrl =
    settings.googleMapsUrl || buildGoogleMapsSearchUrl(settings.salonName, address);
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
    appointmentDate:
      appt.appointmentDate ||
      getIsoLocalDateStr(appt.scheduledForIso, settings.timezoneOffsetHours) ||
      getSalonLocalDateParts(settings.timezoneOffsetHours).dateStr,
    timeSlot: appt.timeSlot,
    durationMins: appt.durationMins || 35,
    totalPrice: appt.price,
    currencySymbol: settings.currencySymbol,
    status: appt.status,
    address,
    googleMapsUrl,
    // Neutral review URL revealed STRICTLY when appointment is COMPLETED (no star-rating gating!)
    googleReviewUrl: appt.status === 'COMPLETED' ? settings.googleReviewUrl : null,
    preferredLanguage: (cli?.preferredLanguage || settings.defaultLang || 'en') as ClientPreferredLang,
    icsContent: buildIcsCalendarContent({
      bookingId: appt.id,
      salonName: settings.salonName,
      service: appt.service,
      barberName: appt.barberName,
      address,
      startsAtIso: appt.scheduledForIso,
      durationMins: appt.durationMins || 35,
    }),
  };
}

export function rescheduleBookingByAccessToken(
  rawToken: string,
  input: { appointmentDate: string; timeSlot: string; barberName?: string }
): { statusCode: number; ok: boolean; error?: string; booking?: BookingManagementPayload } {
  const clean = (rawToken || '').trim();
  if (!clean) return { statusCode: 404, ok: false, error: 'Booking link not found.' };
  const store = ensureStoreLoaded();
  const tokenHash = crypto.createHash('sha256').update(clean).digest('hex');
  const tokenRec = store.bookingAccessTokens?.[tokenHash];
  if (!tokenRec || tokenRec.revoked || tokenRec.expiresAtMs < Date.now()) {
    return { statusCode: 404, ok: false, error: 'This booking management link has expired or been revoked.' };
  }
  const appt = store.appointments.find(
    (a) => a.salonId === tokenRec.salonId && a.id === tokenRec.bookingId
  );
  if (!appt) return { statusCode: 404, ok: false, error: 'Appointment not found.' };
  if (appt.status === 'COMPLETED' || appt.status === 'CANCELED') {
    return { statusCode: 409, ok: false, error: `Completed or canceled bookings cannot be rescheduled.` };
  }

  const settings = ensureSalonExists(tokenRec.salonId);
  const cleanDate = sanitizePlainText(input.appointmentDate || '', 20);
  const cleanTimeSlot = sanitizePlainText(input.timeSlot || '', 24);
  const targetBarber = sanitizePlainText(input.barberName || appt.barberName, 60);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate) || !cleanTimeSlot) {
    return { statusCode: 400, ok: false, error: 'Valid date and time slot are required.' };
  }

  // Temporarily mark current appointment as excluded via status snapshot? Or check availability excluding self:
  const prevStatus = appt.status;
  appt.status = 'CANCELED';
  const avail = getAvailableSlotsAndBarbers({
    salonId: tokenRec.salonId,
    date: cleanDate,
    durationMins: appt.durationMins || 35,
    serviceIds: appt.serviceIds,
  });
  appt.status = prevStatus;

  if (!avail.isOpen) {
    return { statusCode: 409, ok: false, error: avail.closedReason || 'Salon is closed on that date.' };
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
      error: `${targetBarber} is not available at ${formattedTime} on ${cleanDate}.`,
    };
  }

  const [y, m, d] = cleanDate.split('-').map((n) => parseInt(n, 10));
  const startUtcMs =
    Date.UTC(y, m - 1, d, Math.floor(startMinutes / 60), startMinutes % 60, 0) -
    settings.timezoneOffsetHours * 3600000;
  const dur = appt.durationMins || 35;

  const oldSummary = `${appt.appointmentDate || ''} ${appt.timeSlot} (${appt.barberName})`;
  appt.appointmentDate = cleanDate;
  appt.timeSlot = formattedTime;
  appt.barberName = matchedBarber.name;
  appt.scheduledForIso = new Date(startUtcMs).toISOString();
  appt.scheduledEndMs = startUtcMs + dur * 60000;
  tokenRec.expiresAtMs = appt.scheduledEndMs + 7 * 86400000;

  // Rescheduling NEVER increments monthly quota!
  appendBookingAudit(
    tokenRec.salonId,
    appt.id,
    'CUSTOMER',
    'RESCHEDULED',
    `Moved from ${oldSummary} to ${cleanDate} ${formattedTime} (${matchedBarber.name}). 0 quota used.`
  );
  persistStore(tokenRec.salonId);
  return { statusCode: 200, ok: true, booking: getBookingByAccessToken(rawToken) || undefined };
}

export function cancelBookingByAccessToken(
  rawToken: string,
  reason?: string
): { statusCode: number; ok: boolean; error?: string; booking?: BookingManagementPayload } {
  const clean = (rawToken || '').trim();
  if (!clean) return { statusCode: 404, ok: false, error: 'Booking link not found.' };
  const store = ensureStoreLoaded();
  const tokenHash = crypto.createHash('sha256').update(clean).digest('hex');
  const tokenRec = store.bookingAccessTokens?.[tokenHash];
  if (!tokenRec || tokenRec.revoked || tokenRec.expiresAtMs < Date.now()) {
    return { statusCode: 404, ok: false, error: 'This booking management link has expired or been revoked.' };
  }
  const appt = store.appointments.find(
    (a) => a.salonId === tokenRec.salonId && a.id === tokenRec.bookingId
  );
  if (!appt) return { statusCode: 404, ok: false, error: 'Appointment not found.' };
  if (appt.status === 'COMPLETED') {
    return { statusCode: 409, ok: false, error: 'Completed appointments cannot be canceled.' };
  }

  appt.status = 'CANCELED';
  appt.canceled = true;
  store.chairLocks = store.chairLocks.filter(
    (l) => !(l.salonId === tokenRec.salonId && l.id === appt.id)
  );
  // Cancellations NEVER decrement monthly quota!
  appendBookingAudit(
    tokenRec.salonId,
    appt.id,
    'CUSTOMER',
    'CANCELED',
    `Canceled by customer (${sanitizePlainText(reason || 'Self-service cancel', 120)}). Slot freed; quota unchanged.`
  );
  persistStore(tokenRec.salonId);
  return { statusCode: 200, ok: true, booking: getBookingByAccessToken(rawToken) || undefined };
}

