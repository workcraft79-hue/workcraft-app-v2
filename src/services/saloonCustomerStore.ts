import {
  BarberStaffConfig,
  CustomerAppointment,
  CustomerLanguage,
  CustomerServiceOption,
  DayHours,
  DayOfWeekKey,
  SalonCustomerConfig,
  SalonDealItem,
  TimeSlotAvailability,
} from '../types/customerExperience';
import { Contact } from '../types';

const CONFIGS_KEY = 'wcl_customer_salon_configs_v1';
const APPOINTMENTS_KEY = 'wcl_customer_appointments_v1';
const DEALS_KEY = 'wcl_customer_deals_v1';
const SAVED_CUSTOMERS_KEY = 'wcl_customer_saved_names_v1';

const DAY_KEYS_ORDER: DayOfWeekKey[] = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
export const WEEK_DAYS_ORDERED: DayOfWeekKey[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

function buildStandardSchedule(includeFridayBreak = true): Record<DayOfWeekKey, DayHours> {
  return {
    MON: { open: true, openTime: '11:00', closeTime: '23:00' },
    TUE: { open: true, openTime: '11:00', closeTime: '23:00' },
    WED: { open: true, openTime: '11:00', closeTime: '23:00' },
    THU: { open: true, openTime: '11:00', closeTime: '23:00' },
    FRI: includeFridayBreak
      ? { open: true, openTime: '11:00', closeTime: '23:30', breakStart: '13:00', breakEnd: '14:30' }
      : { open: true, openTime: '14:00', closeTime: '23:30' },
    SAT: { open: true, openTime: '10:30', closeTime: '23:30' },
    SUN: { open: true, openTime: '11:00', closeTime: '22:00' },
  };
}

export function getTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysIso(baseIso: string, offsetDays: number): string {
  const [y, m, d] = baseIso.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + offsetDays);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(
    dt.getDate()
  ).padStart(2, '0')}`;
}

export function getDayKeyFromIso(dateIso: string): DayOfWeekKey {
  const [y, m, d] = dateIso.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  return DAY_KEYS_ORDER[dt.getDay()];
}

export function parseTimeToMinutes(raw: string): number {
  const trimmed = raw.trim().toUpperCase();
  const ampmMatch = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (ampmMatch) {
    let h = parseInt(ampmMatch[1], 10);
    const min = parseInt(ampmMatch[2], 10);
    const period = ampmMatch[3];
    if (period === 'PM' && h < 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    return h * 60 + min;
  }
  const h24Match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (h24Match) {
    return parseInt(h24Match[1], 10) * 60 + parseInt(h24Match[2], 10);
  }
  return 12 * 60;
}

export function formatMinutesTo12h(totalMins: number): string {
  const normalized = ((totalMins % 1440) + 1440) % 1440;
  const h24 = Math.floor(normalized / 60);
  const min = normalized % 60;
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${String(h12).padStart(2, '0')}:${String(min).padStart(2, '0')} ${period}`;
}

export function normalizePhoneDigits(phone: string): string {
  return phone.replace(/[^0-9]/g, '');
}

const DEFAULT_MENS_SERVICES: CustomerServiceOption[] = [
  { id: 's1', name: 'Master Haircut & Skin Fade', price: 800, durationMins: 35, active: true },
  { id: 's2', name: 'Classic Beard Trim & Sculpt', price: 400, durationMins: 25, active: true },
  { id: 's3', name: 'Hot Towel Steam Shave', price: 500, durationMins: 25, active: true },
  { id: 's4', name: 'Hair Color & Camo', price: 1500, durationMins: 45, active: true },
  { id: 's5', name: 'Charcoal Deep Detox Facial', price: 2500, durationMins: 40, active: true },
  { id: 's6', name: 'Keratin Hair Protein', price: 6000, durationMins: 90, active: true },
  { id: 's7', name: 'Herbal Mint Head Massage', price: 500, durationMins: 20, active: true },
  { id: 's8', name: 'Groom Signature Package', price: 12000, durationMins: 120, active: true },
];

const DEFAULT_LADIES_SERVICES: CustomerServiceOption[] = [
  { id: 'l1', name: 'Signature Party Makeup & Styling', price: 4500, durationMins: 60, active: true },
  { id: 'l2', name: 'Barat / Walima Bridal Package', price: 35000, durationMins: 180, active: true },
  { id: 'l3', name: 'Hydra-Facial & Skin Polish', price: 3500, durationMins: 45, active: true },
  { id: 'l4', name: 'Keratin Hair Rebonding / Smoothing', price: 12000, durationMins: 120, active: true },
  { id: 'l5', name: 'Mani-Pedi Classic Spa', price: 2000, durationMins: 50, active: true },
  { id: 'l6', name: 'Full Face Threading & Waxing', price: 1200, durationMins: 30, active: true },
  { id: 'l7', name: 'Deep Conditioning Hair Spa', price: 2500, durationMins: 40, active: true },
];

export const DEFAULT_SALON_CONFIGS: SalonCustomerConfig[] = [
  {
    salonId: '1',
    salonName: 'Seven Cuts Studio',
    phone: '+92 321 8472910',
    currency: 'PKR',
    currencySymbol: 'PKR ',
    address: 'Plot 42-C, Commercial Sector C, DHA Phase 5, Lahore',
    googleMapsUrl: 'https://maps.google.com/?q=DHA+Phase+5+Lahore+Seven+Cuts+Studio',
    supportedLanguages: ['en', 'ur', 'roman_ur'],
    weeklySchedule: buildStandardSchedule(true),
    services: DEFAULT_MENS_SERVICES,
    barbers: [
      { id: 'b-aslam', name: 'Master Aslam', available: true },
      { id: 'b-tariq', name: 'Tariq Mehmood', available: true },
      { id: 'b-ali', name: 'Ali Raza', available: true },
      { id: 'b-bilal', name: 'Bilal Tariq', available: false, unavailableReason: 'Off duty today' },
    ],
    dealRetentionDaysAfterExpiry: 30,
  },
  {
    salonId: '2',
    salonName: 'Royal Fade Lounge',
    phone: '+92 300 9876543',
    currency: 'PKR',
    currencySymbol: 'PKR ',
    address: 'Suite 14, MM Alam Road, Gulberg III, Lahore',
    googleMapsUrl: 'https://maps.google.com/?q=MM+Alam+Road+Gulberg+III+Lahore',
    supportedLanguages: ['en', 'ur', 'roman_ur'],
    weeklySchedule: buildStandardSchedule(true),
    services: DEFAULT_MENS_SERVICES,
    barbers: [
      { id: 'b-aslam', name: 'Master Aslam', available: true },
      { id: 'b-tariq', name: 'Tariq Mehmood', available: true },
      { id: 'b-ali', name: 'Ali Raza', available: true },
    ],
    dealRetentionDaysAfterExpiry: 30,
  },
  {
    salonId: '3',
    salonName: 'Al-Noor Executive Grooming',
    phone: '+971 50 8923411',
    currency: 'AED',
    currencySymbol: 'AED ',
    address: 'Shop 9, Jumeirah Beach Road, Jumeirah 1, Dubai, UAE',
    googleMapsUrl: 'https://maps.google.com/?q=Jumeirah+1+Dubai+UAE',
    supportedLanguages: ['en', 'ar', 'ur', 'roman_ur'],
    weeklySchedule: buildStandardSchedule(false),
    services: [
      { id: 's1', name: 'Master Haircut & Skin Fade', price: 75, durationMins: 35, active: true },
      { id: 's2', name: 'Classic Beard Trim & Sculpt', price: 45, durationMins: 25, active: true },
      { id: 's3', name: 'Hot Towel Steam Shave', price: 50, durationMins: 25, active: true },
      { id: 's4', name: 'Hair Color & Camo', price: 110, durationMins: 45, active: true },
      { id: 's5', name: 'Charcoal Deep Detox Facial', price: 150, durationMins: 40, active: true },
      { id: 's6', name: 'Groom Executive VIP Suite', price: 320, durationMins: 90, active: true },
    ],
    barbers: [
      { id: 'b-aslam', name: 'Master Aslam', available: true },
      { id: 'b-tariq', name: 'Tariq Mehmood', available: true },
      { id: 'b-zayed', name: 'Omar Al-Falasi', available: true },
    ],
    dealRetentionDaysAfterExpiry: 30,
  },
  {
    salonId: '4',
    salonName: 'Mayfair Blade & Beard',
    phone: '+44 7911 123456',
    currency: 'GBP',
    currencySymbol: '£',
    address: '18 Brewer Street, Soho, London W1F 0SH, UK',
    googleMapsUrl: 'https://maps.google.com/?q=18+Brewer+Street+Soho+London',
    supportedLanguages: ['en'],
    weeklySchedule: {
      MON: { open: true, openTime: '09:30', closeTime: '20:00' },
      TUE: { open: true, openTime: '09:30', closeTime: '20:00' },
      WED: { open: true, openTime: '09:30', closeTime: '20:00' },
      THU: { open: true, openTime: '09:30', closeTime: '21:00' },
      FRI: { open: true, openTime: '09:30', closeTime: '21:00' },
      SAT: { open: true, openTime: '09:00', closeTime: '19:30' },
      SUN: { open: false, openTime: '11:00', closeTime: '17:00' },
    },
    services: [
      { id: 's1', name: 'Signature Skin Fade & Wash', price: 32, durationMins: 35, active: true },
      { id: 's2', name: 'Beard Sculpt & Hot Towel', price: 20, durationMins: 25, active: true },
      { id: 's3', name: 'Full Executive Grooming', price: 58, durationMins: 60, active: true },
    ],
    barbers: [
      { id: 'b-oliver', name: 'Oliver Bennett', available: true },
      { id: 'b-liam', name: 'Liam Carter', available: true },
    ],
    dealRetentionDaysAfterExpiry: 30,
  },
  {
    salonId: '5',
    salonName: 'Noor Beauty Lounge (Ladies Parlor)',
    phone: '+92 333 4412345',
    currency: 'PKR',
    currencySymbol: 'PKR ',
    address: 'Bungalow 12-B, Clifton Block 4, Karachi',
    googleMapsUrl: 'https://maps.google.com/?q=Clifton+Block+4+Karachi',
    supportedLanguages: ['en', 'ur', 'roman_ur'],
    weeklySchedule: buildStandardSchedule(true),
    services: DEFAULT_LADIES_SERVICES,
    barbers: [
      { id: 'b-sana', name: 'Stylist Sana', available: true },
      { id: 'b-hina', name: 'Hina Makeup Artist', available: true },
      { id: 'b-zara', name: 'Zara Hair Specialist', available: true },
    ],
    dealRetentionDaysAfterExpiry: 30,
  },
];

function buildInitialDeals(): SalonDealItem[] {
  const now = Date.now();
  const in7Days = new Date(now + 7 * 86400_000).toISOString();
  const in10Days = new Date(now + 10 * 86400_000).toISOString();
  return [
    {
      id: 'deal-weekend-fade-1',
      salonId: '1',
      title: 'Weekend Skin Fade + Beard Sculpt VIP Deal (25% OFF)',
      description:
        'Book Master Haircut & Skin Fade + Classic Beard Trim together at 25% OFF. Valid for all confirmed slots before expiry.',
      discountPercent: 25,
      serviceIds: ['s1', 's2'],
      videoUrl: 'procedural://weekend-vip-reel',
      videoName: 'seven_cuts_weekend_fade_offer.mp4',
      expiresAtIso: in7Days,
      retentionDaysAfterExpiry: 30,
      createdAtIso: new Date(now - 86400_000).toISOString(),
    },
    {
      id: 'deal-royal-glow-2',
      salonId: '2',
      title: 'Signature Grooming + Charcoal Facial Deal (20% OFF)',
      description:
        'Refresh your look with our Master Haircut and Charcoal Deep Detox Facial combo at 20% off standard salon prices.',
      discountPercent: 20,
      serviceIds: ['s1', 's5'],
      videoUrl: 'procedural://royal-fade-reel',
      videoName: 'royal_fade_facial_deal.mp4',
      expiresAtIso: in10Days,
      retentionDaysAfterExpiry: 30,
      createdAtIso: new Date(now - 86400_000).toISOString(),
    },
    {
      id: 'deal-dubai-exec-3',
      salonId: '3',
      title: 'Dubai Executive Cut & Hot Towel Steam (25% OFF)',
      description:
        'Exclusive Jumeirah lounge offer combining Master Haircut & Skin Fade with Royal Hot Towel Steam Shave.',
      discountPercent: 25,
      serviceIds: ['s1', 's3'],
      videoUrl: 'procedural://dubai-exec-reel',
      videoName: 'al_noor_dubai_vip.mp4',
      expiresAtIso: in7Days,
      retentionDaysAfterExpiry: 30,
      createdAtIso: new Date(now - 86400_000).toISOString(),
    },
    {
      id: 'deal-soho-groom-4',
      salonId: '4',
      title: 'Soho Weekday Skin Fade & Beard Package (15% OFF)',
      description:
        'Signature Skin Fade & Wash paired with Beard Sculpt & Hot Towel in the heart of Soho.',
      discountPercent: 15,
      serviceIds: ['s1', 's2'],
      videoUrl: 'procedural://soho-groom-reel',
      videoName: 'mayfair_soho_deal.mp4',
      expiresAtIso: in7Days,
      retentionDaysAfterExpiry: 30,
      createdAtIso: new Date(now - 86400_000).toISOString(),
    },
    {
      id: 'deal-noor-glow-5',
      salonId: '5',
      title: 'Hydra-Facial + Deep Conditioning Hair Spa (25% OFF)',
      description:
        'Complete rejuvenation combo for ladies: Hydra-Facial Skin Polish + Deep Conditioning Hair Spa.',
      discountPercent: 25,
      serviceIds: ['l3', 'l7'],
      videoUrl: 'procedural://noor-beauty-reel',
      videoName: 'noor_hydra_hair_spa.mp4',
      expiresAtIso: in10Days,
      retentionDaysAfterExpiry: 30,
      createdAtIso: new Date(now - 86400_000).toISOString(),
    },
  ];
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadAllSalonConfigs(): SalonCustomerConfig[] {
  const stored = readJson<SalonCustomerConfig[] | null>(CONFIGS_KEY, null);
  if (!stored || !Array.isArray(stored) || stored.length === 0) {
    return DEFAULT_SALON_CONFIGS;
  }
  // Ensure any default salon missing from older cache is merged cleanly
  const byId = new Map(stored.map((c) => [c.salonId, c]));
  for (const def of DEFAULT_SALON_CONFIGS) {
    if (!byId.has(def.salonId)) byId.set(def.salonId, def);
  }
  return Array.from(byId.values());
}

export function getSalonCustomerConfig(salonId: string): SalonCustomerConfig {
  const all = loadAllSalonConfigs();
  return all.find((c) => c.salonId === salonId) || all[0];
}

export function saveSalonCustomerConfig(updated: SalonCustomerConfig): SalonCustomerConfig[] {
  const safeLanguages: CustomerLanguage[] = updated.supportedLanguages.includes('en')
    ? updated.supportedLanguages
    : ['en', ...updated.supportedLanguages];
  const normalized: SalonCustomerConfig = {
    ...updated,
    supportedLanguages: safeLanguages,
    dealRetentionDaysAfterExpiry: Math.max(1, Number(updated.dealRetentionDaysAfterExpiry) || 30),
  };
  const all = loadAllSalonConfigs();
  const exists = all.some((c) => c.salonId === normalized.salonId);
  const next = exists
    ? all.map((c) => (c.salonId === normalized.salonId ? normalized : c))
    : [...all, normalized];
  writeJson(CONFIGS_KEY, next);
  return next;
}

export function cleanupDealsAndVideos(
  deals: SalonDealItem[],
  retentionOverrideDays?: number,
  nowMs: number = Date.now()
): { updatedDeals: SalonDealItem[]; didMutate: boolean } {
  let didMutate = false;
  const updatedDeals = deals.map((deal) => {
    const expiryMs = Date.parse(deal.expiresAtIso);
    const retentionDays = retentionOverrideDays ?? deal.retentionDaysAfterExpiry ?? 30;
    const purgeAtMs = expiryMs + retentionDays * 86400_000;

    if (!Number.isNaN(purgeAtMs) && nowMs >= purgeAtMs && deal.videoUrl) {
      didMutate = true;
      if (deal.videoUrl.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(deal.videoUrl);
        } catch {
          // Ignore revoke error
        }
      }
      return {
        ...deal,
        videoUrl: null,
        videoDeletedAtIso: new Date(nowMs).toISOString(),
      };
    }
    return deal;
  });

  return { updatedDeals, didMutate };
}

export function loadSalonDeals(salonId?: string, retentionDaysOverride?: number): SalonDealItem[] {
  const stored = readJson<SalonDealItem[] | null>(DEALS_KEY, null);
  const base = stored && Array.isArray(stored) && stored.length > 0 ? stored : buildInitialDeals();
  const { updatedDeals, didMutate } = cleanupDealsAndVideos(base, retentionDaysOverride);
  if (didMutate || !stored) {
    writeJson(DEALS_KEY, updatedDeals);
  }
  return salonId ? updatedDeals.filter((d) => d.salonId === salonId) : updatedDeals;
}

export function getActiveSalonDeals(salonId: string, nowMs: number = Date.now()): SalonDealItem[] {
  const cfg = getSalonCustomerConfig(salonId);
  const all = loadSalonDeals(salonId, cfg.dealRetentionDaysAfterExpiry);
  return all.filter((d) => Date.parse(d.expiresAtIso) > nowMs);
}

export function saveSalonDeal(deal: SalonDealItem): SalonDealItem[] {
  const all = loadSalonDeals();
  const exists = all.some((d) => d.id === deal.id);
  const next = exists ? all.map((d) => (d.id === deal.id ? deal : d)) : [deal, ...all];
  const { updatedDeals } = cleanupDealsAndVideos(next);
  writeJson(DEALS_KEY, updatedDeals);
  return updatedDeals;
}

export function isDealExpired(deal: SalonDealItem, nowMs: number = Date.now()): boolean {
  return Date.parse(deal.expiresAtIso) <= nowMs;
}

export function loadRealCustomerAppointments(salonId?: string): CustomerAppointment[] {
  const list = readJson<CustomerAppointment[]>(APPOINTMENTS_KEY, []);
  return salonId ? list.filter((a) => a.salonId === salonId) : list;
}

export function getSavedCustomerDirectory(extraContacts: Contact[] = []): Record<string, string> {
  const persisted = readJson<Record<string, string>>(SAVED_CUSTOMERS_KEY, {});
  const merged: Record<string, string> = {
    '923001234567': 'Bilal Ahmed',
    '923219876543': 'Hamza Malik',
    '971508923411': 'Zayed Al-Hashmi',
    '447911123456': 'Oliver Bennett',
    ...persisted,
  };
  for (const c of extraContacts) {
    const digits = normalizePhoneDigits(c.phone);
    if (digits && c.name) {
      merged[digits] = c.name;
    }
  }
  return merged;
}

export function lookupSavedCustomerName(phone: string, extraContacts: Contact[] = []): string | null {
  const digits = normalizePhoneDigits(phone);
  if (!digits || digits.length < 7) return null;
  const dir = getSavedCustomerDirectory(extraContacts);
  if (dir[digits]) return dir[digits];
  // Match by trailing 9 digits for local 0300 vs +92 300 variants
  const tail = digits.slice(-9);
  for (const [k, name] of Object.entries(dir)) {
    if (k.endsWith(tail)) return name;
  }
  return null;
}

export function saveCustomerNameToDirectory(phone: string, name: string): void {
  const digits = normalizePhoneDigits(phone);
  const trimmed = name.trim();
  if (!digits || !trimmed) return;
  const persisted = readJson<Record<string, string>>(SAVED_CUSTOMERS_KEY, {});
  persisted[digits] = trimmed;
  writeJson(SAVED_CUSTOMERS_KEY, persisted);
}

export function getUpcomingDatesForSalon(
  weeklySchedule: Record<DayOfWeekKey, DayHours>,
  daysCount = 7
): Array<{ dateIso: string; dayKey: DayOfWeekKey; label: string; isOpen: boolean }> {
  const todayIso = getTodayIso();
  const result: Array<{ dateIso: string; dayKey: DayOfWeekKey; label: string; isOpen: boolean }> = [];
  for (let i = 0; i < daysCount; i++) {
    const dateIso = addDaysIso(todayIso, i);
    const dayKey = getDayKeyFromIso(dateIso);
    const [y, m, d] = dateIso.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    const shortDate = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const label = i === 0 ? `Today (${shortDate})` : i === 1 ? `Tomorrow (${shortDate})` : `${dayKey} (${shortDate})`;
    result.push({
      dateIso,
      dayKey,
      label,
      isOpen: Boolean(weeklySchedule[dayKey]?.open),
    });
  }
  return result;
}

export function checkBarberAvailabilityForSlot(params: {
  barber: BarberStaffConfig;
  dateIso: string;
  slotStartMins: number;
  durationMins: number;
  existingAppointments: CustomerAppointment[];
}): { available: boolean; reason?: string } {
  const { barber, dateIso, slotStartMins, durationMins, existingAppointments } = params;
  if (!barber.available) {
    return {
      available: false,
      reason: barber.unavailableReason || 'Unavailable for this shift',
    };
  }

  const requestedEnd = slotStartMins + Math.max(15, durationMins);
  const conflict = existingAppointments.find((appt) => {
    if (appt.status === 'COMPLETED') return false;
    if (appt.dateIso !== dateIso) return false;
    const sameBarber =
      appt.barberName.trim().toLowerCase() === barber.name.trim().toLowerCase() ||
      barber.name.toLowerCase().includes(appt.barberName.trim().toLowerCase()) ||
      appt.barberName.trim().toLowerCase().includes(barber.name.split(' ')[0].toLowerCase());
    if (!sameBarber) return false;

    const existingStart = appt.startMinutes;
    const existingEnd = existingStart + Math.max(20, appt.totalDurationMins);
    return slotStartMins < existingEnd && existingStart < requestedEnd;
  });

  if (conflict) {
    return {
      available: false,
      reason: `Booked at ${conflict.timeSlot}`,
    };
  }

  return { available: true };
}

export function getAvailableTimeSlotsForDate(params: {
  salonConfig: SalonCustomerConfig;
  dateIso: string;
  totalDurationMins: number;
  existingAppointments: CustomerAppointment[];
  nowDate?: Date;
}): TimeSlotAvailability[] {
  const { salonConfig, dateIso, totalDurationMins, existingAppointments, nowDate = new Date() } = params;
  const dayKey = getDayKeyFromIso(dateIso);
  const dayCfg = salonConfig.weeklySchedule[dayKey];
  if (!dayCfg || !dayCfg.open) return [];

  const openMins = parseTimeToMinutes(dayCfg.openTime);
  const closeMins = parseTimeToMinutes(dayCfg.closeTime);
  const breakStartMins = dayCfg.breakStart ? parseTimeToMinutes(dayCfg.breakStart) : null;
  const breakEndMins = dayCfg.breakEnd ? parseTimeToMinutes(dayCfg.breakEnd) : null;

  const isToday = dateIso === getTodayIso();
  const currentNowMins = nowDate.getHours() * 60 + nowDate.getMinutes();
  const effectiveDuration = Math.max(15, totalDurationMins);

  const slots: TimeSlotAvailability[] = [];
  for (let mins = openMins; mins + effectiveDuration <= closeMins; mins += 30) {
    if (isToday && mins <= currentNowMins + 15) continue;

    if (breakStartMins !== null && breakEndMins !== null) {
      const overlapsBreak = mins < breakEndMins && breakStartMins < mins + effectiveDuration;
      if (overlapsBreak) continue;
    }

    const freeBarbers = salonConfig.barbers.filter((b) =>
      checkBarberAvailabilityForSlot({
        barber: b,
        dateIso,
        slotStartMins: mins,
        durationMins: effectiveDuration,
        existingAppointments,
      }).available
    );

    if (freeBarbers.length > 0) {
      slots.push({
        timeSlot: formatMinutesTo12h(mins),
        startMinutes: mins,
        availableBarbersCount: freeBarbers.length,
        availableBarberNames: freeBarbers.map((b) => b.name),
      });
    }
  }

  return slots;
}

export async function confirmCustomerAppointment(params: {
  salonConfig: SalonCustomerConfig;
  selectedServices: CustomerServiceOption[];
  dateIso: string;
  timeSlot: string;
  barberName: string;
  customerName: string;
  customerPhone: string;
  language: CustomerLanguage;
  totalAmount: number;
  dealId?: string;
  existingAppointments: CustomerAppointment[];
  isDemo: boolean;
}): Promise<
  | { ok: true; appointment: CustomerAppointment; persistedViaApi: boolean }
  | { ok: false; errorCode: 'SLOT_TAKEN' | 'BARBER_UNAVAILABLE' | 'INVALID'; message: string }
> {
  const {
    salonConfig,
    selectedServices,
    dateIso,
    timeSlot,
    barberName,
    customerName,
    customerPhone,
    language,
    totalAmount,
    dealId,
    existingAppointments,
    isDemo,
  } = params;

  if (selectedServices.length === 0) {
    return { ok: false, errorCode: 'INVALID', message: 'No services selected.' };
  }
  if (!customerName.trim()) {
    return { ok: false, errorCode: 'INVALID', message: 'Customer name is required.' };
  }

  const totalDurationMins = selectedServices.reduce((sum, s) => sum + (s.durationMins || 30), 0);
  const startMinutes = parseTimeToMinutes(timeSlot);

  // Re-check latest state (for live mode, merge latest saved storage too)
  const latestAppointments = isDemo
    ? existingAppointments
    : mergeUniqueAppointments(existingAppointments, loadRealCustomerAppointments(salonConfig.salonId));

  // Verify salon is open at that slot
  const dayKey = getDayKeyFromIso(dateIso);
  const dayCfg = salonConfig.weeklySchedule[dayKey];
  if (!dayCfg || !dayCfg.open) {
    return { ok: false, errorCode: 'SLOT_TAKEN', message: 'Salon is closed on selected date.' };
  }

  const openMins = parseTimeToMinutes(dayCfg.openTime);
  const closeMins = parseTimeToMinutes(dayCfg.closeTime);
  if (startMinutes < openMins || startMinutes + totalDurationMins > closeMins) {
    return { ok: false, errorCode: 'SLOT_TAKEN', message: 'Time slot falls outside salon hours.' };
  }

  const chosenBarber = salonConfig.barbers.find((b) => b.name === barberName);
  if (!chosenBarber) {
    return { ok: false, errorCode: 'BARBER_UNAVAILABLE', message: 'Selected barber not found.' };
  }

  const avail = checkBarberAvailabilityForSlot({
    barber: chosenBarber,
    dateIso,
    slotStartMins: startMinutes,
    durationMins: totalDurationMins,
    existingAppointments: latestAppointments,
  });

  if (!avail.available) {
    return {
      ok: false,
      errorCode: 'BARBER_UNAVAILABLE',
      message: avail.reason || 'Barber is no longer available at this time.',
    };
  }

  const appointment: CustomerAppointment = {
    id: `${isDemo ? 'DEMO' : 'WC'}-${Date.now().toString().slice(-5)}`,
    salonId: salonConfig.salonId,
    customerName: customerName.trim(),
    customerPhone: customerPhone.trim() || salonConfig.phone,
    serviceIds: selectedServices.map((s) => s.id),
    serviceNames: selectedServices.map((s) => s.name),
    totalDurationMins,
    totalAmount,
    dealId,
    dateIso,
    timeSlot,
    startMinutes,
    barberName: chosenBarber.name,
    language,
    status: 'CONFIRMED',
    createdAtIso: new Date().toISOString(),
    isDemo,
  };

  if (isDemo) {
    // Strictly isolated: never writes to real storage or backend API
    return { ok: true, appointment, persistedViaApi: false };
  }

  // Real mode: call backend endpoint for concurrency verification if available, and persist locally
  let persistedViaApi = false;
  try {
    const res = await fetch('/api/customer/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(appointment),
    });
    if (res.status === 409) {
      const errData = (await res.json().catch(() => null)) as { error?: string } | null;
      return {
        ok: false,
        errorCode: 'SLOT_TAKEN',
        message: errData?.error || 'Slot was just booked.',
      };
    }
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      persistedViaApi = true;
    }
  } catch {
    // Local Vite preview fallback: browser persistence remains active
  }

  const nextReal = [appointment, ...loadRealCustomerAppointments()];
  writeJson(APPOINTMENTS_KEY, nextReal);
  saveCustomerNameToDirectory(appointment.customerPhone, appointment.customerName);

  return { ok: true, appointment, persistedViaApi };
}

export function mergeUniqueAppointments(
  primary: CustomerAppointment[],
  secondary: CustomerAppointment[]
): CustomerAppointment[] {
  const map = new Map<string, CustomerAppointment>();
  for (const item of [...primary, ...secondary]) {
    map.set(item.id, item);
  }
  return Array.from(map.values());
}
