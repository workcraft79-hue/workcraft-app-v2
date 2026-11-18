import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Smartphone,
  Scissors,
  Calendar,
  CheckCircle2,
  ShieldCheck,
  Star,
  MessageSquare,
  Plus,
  RefreshCw,
  Send,
  Lock,
  Video,
  Volume2,
  VolumeX,
  ArrowUpCircle,
  BellRing,
  AlertTriangle,
  Sparkles,
  Check,
  X,
  Radio,
  CreditCard,
  Eye,
  Clock,
  TrendingUp,
  MapPin,
  FileCheck,
  Globe,
  Receipt,
  Award,
  Printer,
  Edit2,
  Trash2,
  UserCheck,
  LogOut,
  Key,
  Settings2,
  SlidersHorizontal,
  QrCode,
  ChevronDown,
  ChevronUp,
  Banknote,
  PhoneCall,
  Save,
  Zap,
  Mic,
  MicOff,
  Moon,
  Sun,
  Flag,
  Play,
  Pause,
} from 'lucide-react';
import { PortalCard } from './PortalCard';
import { BroadcastTab } from './Tabs/BroadcastTab';
import { SalonWindowPosterPdf } from './SalonWindowPosterPdf';
import { SalonRetentionSettingsPanel } from './SalonRetentionSettingsPanel';
import { VoiceRecorder, type RecordedOpusClip, type VoiceRecorderHandle } from './VoiceRecorder';
import {
  INITIAL_VOICE_THREADS,
  type SupportedVoiceLocale,
  type VoiceThreadItem,
} from '../data/portalData';
import { Contact, SalonProfile } from '../types';
import type { AuthUser } from '../types/auth';
import type { SalonConciergeStateResponse, SalonPackageTier } from '../types/concierge';
import { generate214Contacts } from '../data/mockData';
import {
  getLocalizedPackageName,
  getLocalizedPackageCardCopy,
  getLocalizedPackageFeatures,
  type OnboardedSalonPayload,
} from './FieldAgentHub';

interface BookingRecord {
  id: string;
  clientName: string;
  barberName: string;
  phone: string;
  service: string;
  price: number;
  timeSlot: string;
  durationMins?: number;
  scheduledEndMs?: number;
  flagged?: boolean;
  canceled?: boolean;
  sourceType?: 'WHATSAPP_BOT' | 'WALK_IN_BUSY';
  chairLabel?: string;
  status: 'CONFIRMED' | 'IN_CHAIR' | 'COMPLETED';
}

interface OvernightQueueItem {
  id: string;
  clientName: string;
  barberName: string;
  services: string;
  timeSlot: string;
  eventType: string;
  receivedAt: string;
  summary: string;
}

interface PendingDepositAlert {
  id: string;
  clientName: string;
  phone: string;
  method: 'EasyPaisa' | 'Raast';
  amount: number;
  timeSlot: string;
  referenceId: string;
  receivedAt: string;
  verified: boolean;
}

interface HumanHandoverAlert {
  id: string;
  clientName: string;
  phone: string;
  lang: 'en' | 'ur' | 'ar';
  summary: string;
  receivedAt: string;
  handled: boolean;
}

interface SalonHoursConfig {
  monThuOpen: string;
  monThuClose: string;
  monThuClosed: boolean;
  fridayOpen: string;
  fridayClose: string;
  fridayBreakStart: string;
  fridayBreakEnd: string;
  fridayClosed: boolean;
  satSunOpen: string;
  satSunClose: string;
  satSunClosed: boolean;
}

function parseTimeSlotMinutes(slot: string): number {
  const m = slot.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!m) return 9999;
  let hour = parseInt(m[1], 10);
  const mins = parseInt(m[2], 10);
  const meridiem = (m[3] || '').toUpperCase();
  if (meridiem === 'PM' && hour < 12) hour += 12;
  if (meridiem === 'AM' && hour === 12) hour = 0;
  return hour * 60 + mins;
}

function formatTimeFromMinutes(totalMins: number): string {
  const wrapped = ((Math.round(totalMins) % 1440) + 1440) % 1440;
  const h24 = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  const meridiem = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${meridiem}`;
}

const BARBER_SCRIPT_ALIASES: Record<string, string[]> = {
  hamza: ['hamza', 'حمزہ', 'حمزة'],
  aslam: ['aslam', 'اسلم'],
  tariq: ['tariq', 'طارق'],
  ali: ['ali', 'علی'],
  bilal: ['bilal', 'بلال'],
  ayesha: ['ayesha', 'عائشہ', 'عائشة'],
  fatima: ['fatima', 'فاطمہ', 'فاطمة'],
  hina: ['hina', 'حنا'],
  sara: ['sara', 'سارہ', 'سارة'],
};

function normalizeSpokenHour(rawHour: number, explicitMeridiem?: string): number {
  if (explicitMeridiem) {
    const mer = explicitMeridiem.toUpperCase();
    if (mer.startsWith('P') && rawHour < 12) return rawHour + 12;
    if (mer.startsWith('A') && rawHour === 12) return 0;
    return rawHour;
  }
  // Salon hours heuristic: 1..10 without AM/PM defaults to afternoon/evening PM (e.g. "7 to 8" -> 7:00 PM to 8:00 PM)
  if (rawHour >= 1 && rawHour <= 10) return rawHour + 12;
  return rawHour;
}

function parseVoiceChairIntent(
  rawTranscript: string,
  barbers: string[]
): {
  barberName: string;
  startTimeSlot: string;
  endTimeSlot: string;
  startMinutes: number;
  endMinutes: number;
  durationMins: number;
} {
  const transcript = rawTranscript.trim();
  const lower = transcript.toLowerCase();

  // 1. Match active barber from roster (supports English, Roman Urdu, Urdu script, Arabic script)
  let matchedBarber = barbers[0] || 'Master Aslam';
  for (const b of barbers) {
    const bLower = b.toLowerCase();
    const cleanedTokens = bLower
      .replace(/\bmaster\b/g, '')
      .trim()
      .split(/\s+/)
      .filter((t) => t.length >= 3);
    if (lower.includes(bLower)) {
      matchedBarber = b;
      break;
    }
    const tokenHit = cleanedTokens.some((tok) => {
      if (lower.includes(tok)) return true;
      const aliases = BARBER_SCRIPT_ALIASES[tok];
      return aliases ? aliases.some((al) => transcript.includes(al) || lower.includes(al)) : false;
    });
    if (tokenHit) {
      matchedBarber = b;
      break;
    }
  }

  // Fallback check if spoken name wasn't first word in default roster (e.g. "Hamza" matches "Hamza" or first barber if not present)
  if (matchedBarber === (barbers[0] || 'Master Aslam')) {
    for (const [key, aliases] of Object.entries(BARBER_SCRIPT_ALIASES)) {
      if (aliases.some((al) => lower.includes(al) || transcript.includes(al))) {
        const foundInRoster = barbers.find((b) => b.toLowerCase().includes(key));
        if (foundInRoster) {
          matchedBarber = foundInRoster;
          break;
        }
      }
    }
  }

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  // 2. Match explicit time range: "7 to 8", "7 se 8", "5:30 to 6:30", "7 pm to 8 pm", "7 سے 8", "من 7 إلى 8"
  const rangeRegex =
    /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:to|-|–|se|tak|بجے\s*سے|سے|إلى|حتى)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i;
  const rangeMatch = transcript.match(rangeRegex);
  if (rangeMatch) {
    const startH = normalizeSpokenHour(parseInt(rangeMatch[1], 10), rangeMatch[3] || rangeMatch[6]);
    const startM = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : 0;
    let endH = normalizeSpokenHour(parseInt(rangeMatch[4], 10), rangeMatch[6] || rangeMatch[3]);
    const endM = rangeMatch[5] ? parseInt(rangeMatch[5], 10) : 0;
    let startMinutes = startH * 60 + startM;
    let endMinutes = endH * 60 + endM;
    if (endMinutes <= startMinutes) {
      endMinutes += 12 * 60;
    }
    const durationMins = Math.max(15, endMinutes - startMinutes);
    return {
      barberName: matchedBarber,
      startTimeSlot: formatTimeFromMinutes(startMinutes),
      endTimeSlot: formatTimeFromMinutes(endMinutes),
      startMinutes,
      endMinutes,
      durationMins,
    };
  }

  // 3. Match durations: "30 minutes", "45 mins", "1 hour", "ek ghanta", "aadha ghanta", "ساعة", "نصف ساعة"
  let durationMins = 30;
  const hourMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|ghant[ae]|ساعة|ساعات|گھنٹہ|گھنٹے)/i);
  const minMatch = lower.match(/(\d+)\s*(?:minutes?|mins?|min|منٹ|دقيقة|دقائق)/i);

  if (/(aadha|half|نصف|آدھا)\s*(?:ghant|hour|ساعة|گھنٹ)/i.test(transcript)) {
    durationMins = 30;
  } else if (/(ek|one|aik|ایک)\s*(?:ghant|hour|ساعة|گھنٹ)/i.test(transcript) || /\bساعة\b/.test(transcript)) {
    durationMins = 60;
  } else if (hourMatch) {
    durationMins = Math.max(15, Math.round(parseFloat(hourMatch[1]) * 60));
  } else if (minMatch) {
    durationMins = Math.max(10, parseInt(minMatch[1], 10));
  }

  const startMinutes = nowMinutes;
  const endMinutes = startMinutes + durationMins;
  return {
    barberName: matchedBarber,
    startTimeSlot: formatTimeFromMinutes(startMinutes),
    endTimeSlot: formatTimeFromMinutes(endMinutes),
    startMinutes,
    endMinutes,
    durationMins,
  };
}

export interface ClientSalon {
  id: string;
  name: string;
  owner: string;
  phone: string;
  location: string;
  planId: 'STARTER' | 'GROWTH' | 'VIP' | 'CUSTOM';
  plan: string;
  maint: number;
  language: 'en' | 'ur' | 'ar';
  onboardingLanguage: 'en' | 'ur' | 'ar';
}

type VoiceLang = 'en' | 'ur' | 'ar';
type ClientChatLang = 'en' | 'ur' | 'ar';
type MaintCycleStage =
  | 'PAID_ACTIVE'
  | 'STAGE_1_PREV_MONTH'
  | 'STAGE_2_DAY_3'
  | 'STAGE_3_DAY_5_FINAL'
  | 'OVERDUE_TIER_2';

interface VoiceEventLog {
  id: string;
  type: 'BOOKING' | 'REPLY_CONFIRMED' | 'REPLY_URGENT';
  clientName: string;
  clientLang: ClientChatLang;
  ownerVoiceLang: VoiceLang;
  summary: string;
  spokenText: string;
  time: string;
  isUrgent: boolean;
}

interface ImmutableProofRecord {
  id: string;
  clientName: string;
  clientPhone: string;
  clientLang: ClientChatLang;
  services: string[];
  totalAmount: number;
  pricingModeLabel: string;
  slotTime: string;
  confirmedMessage: string;
  timestamp: string;
  hash: string;
}

interface CelebrationClient {
  id: string;
  clientName: string;
  phone: string;
  preferredLang: ClientChatLang;
  eventType: 'BIRTHDAY' | 'EID_UL_FITR' | 'EID_UL_ADHA';
  eventDate: string;
  lastService: string;
  sent: boolean;
}

interface PackageOption {
  id: 'STARTER' | 'GROWTH' | 'VIP' | 'CUSTOM';
  name: string;
  setupFee: number;
  monthlyMaint: number;
  bookingsLimit: string;
  badge: string;
  features: string[];
}

const REGION_CONFIGS: Record<
  string,
  {
    regionKey: 'ASIA' | 'MENA' | 'EUROPE';
    regionLabel: string;
    currency: string;
    symbol: string;
    clientLanguages: Array<{ id: ClientChatLang; label: string }>;
    packages: PackageOption[];
    paymentChannels: Array<{ id: string; label: string; detail: string }>;
  }
> = {
  PK: {
    regionKey: 'ASIA',
    regionLabel: 'Pakistan / Asia',
    currency: 'PKR',
    symbol: 'PKR ',
    clientLanguages: [
      { id: 'ur', label: 'اردو / Roman Urdu' },
      { id: 'en', label: 'English' },
    ],
    packages: [
      {
        id: 'STARTER',
        name: 'Starter Setup',
        setupFee: 17500,
        monthlyMaint: 1750,
        bookingsLimit: '750 bookings/mo',
        badge: 'Entry',
        features: [
          '24/7 WhatsApp Auto-Reply Concierge (Urdu / Roman Urdu / English)',
          'Live Appointment Queue & Chair Status Tracker',
          '1-Tap Service Rate Editor Synced to Bot',
        ],
      },
      {
        id: 'GROWTH',
        name: 'Growth Automation',
        setupFee: 25000,
        monthlyMaint: 2500,
        bookingsLimit: '1,500 bookings/mo',
        badge: 'Popular',
        features: [
          'Everything in Starter Setup',
          'Google Maps 5-Star Automated Review Booster',
          'Hands-Free Voice Booking & Reply Announcements',
        ],
      },
      {
        id: 'VIP',
        name: 'VIP Executive',
        setupFee: 35000,
        monthlyMaint: 3500,
        bookingsLimit: '3,000 bookings/mo',
        badge: 'Best Value',
        features: [
          'Everything in Growth Automation',
          'Pay-Per-Deal Video Broadcast Engine Unlocked (1–4 Videos/mo)',
          'Fri–Sun & 7–10 Day VIP Deal Auto-Pricing + Immutable Proof',
        ],
      },
      {
        id: 'CUSTOM',
        name: 'Custom Enterprise',
        setupFee: 50000,
        monthlyMaint: 5000,
        bookingsLimit: '> 3,000 bookings/mo',
        badge: 'Enterprise',
        features: [
          'Everything in VIP Executive',
          'Unlimited Staff Chairs & High-Volume Single Salon Routing',
          'Priority Support & Fast Video Approval',
        ],
      },
    ],
    paymentChannels: [
      { id: 'EasyPaisa', label: 'EasyPaisa Till', detail: 'WORKCRAFT · Till 789210 (Auto SIM Match)' },
      { id: 'JazzCash', label: 'JazzCash Merchant', detail: 'WORKCRAFT · 0300-WORKCRAFT (Auto SIM Match)' },
      { id: 'IBFT', label: 'Meezan Bank IBFT', detail: 'PK64MEZN0001020304050607' },
    ],
  },
  AE: {
    regionKey: 'MENA',
    regionLabel: 'UAE & MENA',
    currency: 'AED',
    symbol: 'AED ',
    clientLanguages: [
      { id: 'ar', label: 'العربية (Arabic)' },
      { id: 'en', label: 'English' },
    ],
    packages: [
      {
        id: 'STARTER',
        name: 'Starter Setup',
        setupFee: 290,
        monthlyMaint: 55,
        bookingsLimit: '750 bookings/mo',
        badge: 'Entry',
        features: [
          '24/7 WhatsApp Auto-Reply Concierge (Arabic & English)',
          'Live Appointment Queue & Chair Status Tracker',
          '1-Tap Service Rate Editor Synced to Bot',
        ],
      },
      {
        id: 'GROWTH',
        name: 'Growth Automation',
        setupFee: 475,
        monthlyMaint: 92,
        bookingsLimit: '1,500 bookings/mo',
        badge: 'Popular',
        features: [
          'Everything in Starter Setup',
          'Google Maps 5-Star Automated Review Booster',
          'Cross-Language Voice Bridge (Arabic Chat ➔ Urdu/English Voice)',
        ],
      },
      {
        id: 'VIP',
        name: 'VIP Executive',
        setupFee: 620,
        monthlyMaint: 129,
        bookingsLimit: '3,000 bookings/mo',
        badge: 'Best Value',
        features: [
          'Everything in Growth Automation',
          'Pay-Per-Deal Video Broadcast Engine Unlocked (1–4 Videos/mo)',
          'Fri–Sun & 7–10 Day VIP Deal Auto-Pricing + Immutable Proof',
        ],
      },
      {
        id: 'CUSTOM',
        name: 'Custom Enterprise',
        setupFee: 920,
        monthlyMaint: 184,
        bookingsLimit: '> 3,000 bookings/mo',
        badge: 'Enterprise',
        features: [
          'Everything in VIP Executive',
          'Unlimited Staff Chairs & High-Volume Single Salon Routing',
          'Priority Support & Fast Video Approval',
        ],
      },
    ],
    paymentChannels: [
      { id: 'Stripe', label: 'Stripe / Apple Pay / Card', detail: 'Instant MENA Card Checkout (AED)' },
      { id: 'Wire', label: 'UAE IBAN Wire Transfer', detail: 'AE070331234567890123456' },
    ],
  },
  SA: {
    regionKey: 'MENA',
    regionLabel: 'Saudi Arabia (MENA)',
    currency: 'SAR',
    symbol: 'SAR ',
    clientLanguages: [
      { id: 'ar', label: 'العربية (Arabic)' },
      { id: 'en', label: 'English' },
    ],
    packages: [
      {
        id: 'STARTER',
        name: 'Starter Setup',
        setupFee: 295,
        monthlyMaint: 56,
        bookingsLimit: '750 bookings/mo',
        badge: 'Entry',
        features: [
          '24/7 WhatsApp Auto-Reply Concierge (Arabic & English)',
          'Live Appointment Queue & Chair Status Tracker',
          '1-Tap Service Rate Editor Synced to Bot',
        ],
      },
      {
        id: 'GROWTH',
        name: 'Growth Automation',
        setupFee: 485,
        monthlyMaint: 94,
        bookingsLimit: '1,500 bookings/mo',
        badge: 'Popular',
        features: [
          'Everything in Starter Setup',
          'Google Maps 5-Star Automated Review Booster',
          'Cross-Language Voice Bridge (Arabic Chat ➔ Urdu/English Voice)',
        ],
      },
      {
        id: 'VIP',
        name: 'VIP Executive',
        setupFee: 635,
        monthlyMaint: 131,
        bookingsLimit: '3,000 bookings/mo',
        badge: 'Best Value',
        features: [
          'Everything in Growth Automation',
          'Pay-Per-Deal Video Broadcast Engine Unlocked (1–4 Videos/mo)',
          'Fri–Sun & 7–10 Day VIP Deal Auto-Pricing + Immutable Proof',
        ],
      },
      {
        id: 'CUSTOM',
        name: 'Custom Enterprise',
        setupFee: 940,
        monthlyMaint: 188,
        bookingsLimit: '> 3,000 bookings/mo',
        badge: 'Enterprise',
        features: [
          'Everything in VIP Executive',
          'Unlimited Staff Chairs & High-Volume Single Salon Routing',
          'Priority Support & Fast Video Approval',
        ],
      },
    ],
    paymentChannels: [
      { id: 'Stripe', label: 'Stripe / Mada / Card', detail: 'Instant KSA Card Checkout (SAR)' },
      { id: 'Wire', label: 'Saudi IBAN Wire', detail: 'SA0380000000608010167519' },
    ],
  },
  GB: {
    regionKey: 'EUROPE',
    regionLabel: 'UK & Europe',
    currency: 'GBP',
    symbol: '£',
    clientLanguages: [{ id: 'en', label: 'English' }],
    packages: [
      {
        id: 'STARTER',
        name: 'Starter Setup',
        setupFee: 62,
        monthlyMaint: 12,
        bookingsLimit: '750 bookings/mo',
        badge: 'Entry',
        features: [
          '24/7 WhatsApp Auto-Reply Concierge (English)',
          'Live Appointment Queue & Chair Status Tracker',
          '1-Tap Service Rate Editor Synced to Bot',
        ],
      },
      {
        id: 'GROWTH',
        name: 'Growth Automation',
        setupFee: 102,
        monthlyMaint: 20,
        bookingsLimit: '1,500 bookings/mo',
        badge: 'Popular',
        features: [
          'Everything in Starter Setup',
          'Google Maps 5-Star Automated Review Booster',
          'Hands-Free Voice Booking & Reply Announcements',
        ],
      },
      {
        id: 'VIP',
        name: 'VIP Executive',
        setupFee: 134,
        monthlyMaint: 28,
        bookingsLimit: '3,000 bookings/mo',
        badge: 'Best Value',
        features: [
          'Everything in Growth Automation',
          'Pay-Per-Deal Video Broadcast Engine Unlocked (1–4 Videos/mo)',
          'Fri–Sun & 7–10 Day VIP Deal Auto-Pricing + Immutable Proof',
        ],
      },
      {
        id: 'CUSTOM',
        name: 'Custom Enterprise',
        setupFee: 198,
        monthlyMaint: 40,
        bookingsLimit: '> 3,000 bookings/mo',
        badge: 'Enterprise',
        features: [
          'Everything in VIP Executive',
          'Unlimited Staff Chairs & High-Volume Single Salon Routing',
          'Priority Support & Fast Video Approval',
        ],
      },
    ],
    paymentChannels: [
      { id: 'Stripe', label: 'Stripe / Apple Pay / Card', detail: 'Instant UK/Europe Card Checkout (GBP)' },
      { id: 'Wire', label: 'UK Faster Payments / IBAN', detail: 'GB29NWBK60161331926819' },
    ],
  },
  GLOBAL: {
    regionKey: 'EUROPE',
    regionLabel: 'Outside Pakistan / International (USD)',
    currency: 'USD',
    symbol: '$',
    clientLanguages: [
      { id: 'en', label: 'English' },
      { id: 'ar', label: 'العربية (Arabic)' },
      { id: 'ur', label: 'اردو / Roman Urdu' },
    ],
    packages: [
      {
        id: 'STARTER',
        name: 'Starter Setup',
        setupFee: 79,
        monthlyMaint: 15,
        bookingsLimit: '750 bookings/mo',
        badge: 'Entry',
        features: [
          '24/7 WhatsApp Auto-Reply Concierge (English, Arabic & Urdu)',
          'Live Appointment Queue & Chair Status Tracker',
          '1-Tap Service Rate Editor Synced to Bot',
        ],
      },
      {
        id: 'GROWTH',
        name: 'Growth Automation',
        setupFee: 129,
        monthlyMaint: 25,
        bookingsLimit: '1,500 bookings/mo',
        badge: 'Popular',
        features: [
          'Everything in Starter Setup',
          'Google Maps 5-Star Automated Review Booster',
          'Hands-Free Voice Booking & Reply Announcements',
        ],
      },
      {
        id: 'VIP',
        name: 'VIP Executive',
        setupFee: 169,
        monthlyMaint: 35,
        bookingsLimit: '3,000 bookings/mo',
        badge: 'Best Value',
        features: [
          'Everything in Growth Automation',
          'Pay-Per-Deal Video Broadcast Engine Unlocked (1–4 Videos/mo)',
          'Fri–Sun & 7–10 Day VIP Deal Auto-Pricing + Immutable Proof',
        ],
      },
      {
        id: 'CUSTOM',
        name: 'Custom Enterprise',
        setupFee: 250,
        monthlyMaint: 50,
        bookingsLimit: '> 3,000 bookings/mo',
        badge: 'Enterprise',
        features: [
          'Everything in VIP Executive',
          'Unlimited Staff Chairs & High-Volume Single Salon Routing',
          'Priority Support & Fast Video Approval',
        ],
      },
    ],
    paymentChannels: [
      { id: 'Stripe', label: 'Stripe / Apple Pay / Card', detail: 'Instant Global Card Checkout (USD)' },
      { id: 'Card', label: 'International Debit / Credit Card', detail: 'Visa, Mastercard & Amex (USD)' },
      { id: 'Wire', label: 'SWIFT / Wire Transfer', detail: 'WORKCRAFT-GLOBAL-SWIFT-USD' },
    ],
  },
};

export const SERVICE_TRANSLATIONS: Record<string, { ur: string; ar: string }> = {
  'Master Haircut & Skin Fade': { ur: 'ماسٹر ہیر کٹ اور سکن فید', ar: 'قص شعر متطور وتدرج دقيق' },
  'Royal Beard Sculpt & Ozone Steam': { ur: 'رائل بیئرڈ ڈیزائن اور اوزون اسٹیم', ar: 'تحديد وتشذيب اللحية مع البخار الملكي' },
  'Charcoal Detox Facial & Scrub': { ur: 'چارکول ڈیٹوکس فیشل اور اسکرب', ar: 'تنظيف بشرة بالفحم وسنفرة عميقة' },
  'Executive Groom Styling & Wash': { ur: 'ایگزیکٹو گرومنگ اور ہیئر واش', ar: 'تصفيف وغسيل الشعر للرجال' },
  'Head Massage & Herbal Oil Treatment': { ur: 'سر کا مساج اور ہربل آئل ٹریٹمنٹ', ar: 'مساج الرأس مع الزيوت الطبيعية' },
  'Signature Party Makeup & Styling': { ur: 'سگنیچر پارٹی میک اپ اور اسٹائلنگ', ar: 'مكياج سهرة مميز وتصفيف' },
  'Barat / Walima Bridal Package': { ur: 'بارات / ولیمہ برائیڈل پیکیج', ar: 'باقة العروس الكاملة للزفاف' },
  'Hydra-Facial & Skin Polish': { ur: 'ہائیڈرا فیشل اور اسکن پالش', ar: 'هيدرافيشل وصنفرة وتفتيح البشرة' },
  'Keratin Hair Protein Treatment': { ur: 'کیراٹین ہیئر پروٹین ٹریٹمنٹ', ar: 'علاج بروتين الكيراتين للشعر' },
  'Full Mani-Pedi & Paraffin Wax': { ur: 'مکمل مینی پیڈی اور پیرافین ویکس', ar: 'مانيكير وباديكير مع شمع البارافين' },
};

export function getLocalizedServiceName(name: string, lang: ClientChatLang): string {
  if (lang === 'en') return name;
  return SERVICE_TRANSLATIONS[name]?.[lang] || name;
}

export const OWNER_UI_I18N: Record<
  VoiceLang,
  {
    whatsappConnected: string;
    liveFloor: string;
    manage: string;
    counterSleep: string;
    keepCounterAwake: string;
    wakeOn: string;
    wakeOff: string;
    auxBoost: string;
    boost: string;
    tapEnableAudio: string;
    founder: string;
    logOut: string;
    activeShopTier: string;
    todayRevenue: string;
    reminders24_2: string;
    activeTick: string;
    pendingDeposits: string;
    stop: string;
    urgentAlerts: string;
    actionRequired: string;
    markResolved: string;
    viewScreenshot: string;
    hideProof: string;
    verifyDeposit: string;
    markHandled: string;
    quickChairLock: string;
    quickChairSub: string;
    holdOrTapSpeakBtn: string;
    transcribingLock: string;
    tapStopLock: string;
    voicePlaceholder: string;
    parseAndLockBtn: string;
    freeNow: string;
    busy: string;
    tapAgain30: string;
    plus30: string;
    tapAgain60: string;
    plus60: string;
    freeChair: string;
    todayScheduleTitle: string;
    unflaggedClear: string;
    seatBtn: string;
    markDone: string;
    flaggedHeld: string;
    doneTick: string;
    reviewQueued: string;
    walkInQueueTitle: string;
    addWalkIn: string;
    noWalkIns: string;
    closeBtn: string;
    queueGuest: string;
    callNext: string;
    prepaidPackagesTitle: string;
    issuePass: string;
    createPass: string;
    useSession: string;
    completedTick: string;
    noPackages: string;
    bridalTrackerTitle: string;
    bridalLadiesTitle: string;
    femaleOnlyBadge: string;
    addBridalEvent: string;
    saveBridalAdvance: string;
    markSettled: string;
    fullSettled: string;
    passesEvents: string;
    voiceHelp: string;
    topServicesTitle: string;
    mostRequested: string;
    remindersTitle: string;
    activeBadge: string;
    adv24h: string;
    adv24hDesc: string;
    arr2h: string;
    arr2hDesc: string;
    voiceSupportTitle: string;
    voiceSupportSub: string;
    recordVoiceNoteTitle: string;
    recordVoiceNoteSub: string;
    voiceDraftPlaceholder: string;
    recentSupportTitle: string;
    voiceLogsHeading: string;
    voiceLogsSub: string;
    allAlertsBtn: string;
    urgentOnlyBtn: string;
    replayBtn: string;
    sendToFounder: string;
    sending: string;
    playVoice: string;
    stopVoice: string;
    staffBarbers: string;
    staffStylists: string;
    servicesRates: string;
    salonHours: string;
    automationRewards: string;
    windowQrPoster: string;
    salonProfileModeLabel: string;
    mensSalonBtn: string;
    ladiesParlorBtn: string;
    addBarberBtn: string;
    addStylistBtn: string;
    saveHoursBtn: string;
  }
> = {
  en: {
    whatsappConnected: 'WhatsApp Gateway · Connected',
    liveFloor: 'Live Floor',
    passesEvents: 'Passes & Events',
    voiceHelp: 'Voice Help',
    manage: 'Manage',
    counterSleep: 'Counter Sleep',
    keepCounterAwake: 'Keep Counter Awake',
    wakeOn: 'Wake ON',
    wakeOff: 'Wake OFF',
    auxBoost: 'AUX Boost',
    boost: 'Boost',
    tapEnableAudio: 'Tap to Enable Audio Alerts',
    founder: 'Founder',
    logOut: 'Log Out',
    activeShopTier: 'Active Shop / Tier:',
    todayRevenue: "Today's Revenue",
    reminders24_2: '24h / 2h Reminders',
    activeTick: 'Active ✓',
    pendingDeposits: 'Pending Deposits',
    stop: 'Stop',
    urgentAlerts: 'Urgent Alerts',
    actionRequired: 'Action Required',
    markResolved: 'Mark Resolved ✓',
    viewScreenshot: 'View Screenshot',
    hideProof: 'Hide Proof',
    verifyDeposit: 'Verify Deposit ✓',
    markHandled: 'Mark Handled ✓',
    quickChairLock: 'Quick Chair Lock · Instant Voice & 2-Tap Pills',
    quickChairSub:
      'Tap or hold the mic to speak (e.g. "Hamza 30 minutes"), or use silent 2-tap duration pills to mark walk-in chairs busy automatically.',
    holdOrTapSpeakBtn: 'Tap or Hold to Speak Lock (30s)',
    transcribingLock: 'Transcribing Voice Lock...',
    tapStopLock: 'Tap to Lock Now',
    voicePlaceholder: 'Say or type e.g. "Hamza 7 to 8 PM" or "Aslam 30 minutes"',
    parseAndLockBtn: 'Parse & Lock Chair',
    freeNow: 'FREE NOW',
    busy: 'BUSY',
    tapAgain30: 'Tap Again: Confirm +30m',
    plus30: '+30m Busy',
    tapAgain60: 'Tap Again: Confirm +1h',
    plus60: '+1h Busy',
    freeChair: 'Free Chair',
    todayScheduleTitle: "Today's Live Schedule & Chair Timeline",
    unflaggedClear: 'Unflagged entries clear automatically',
    seatBtn: 'Seat',
    markDone: 'Mark Done ✓',
    flaggedHeld: 'Flagged · Held',
    doneTick: 'Done ✓',
    reviewQueued: 'T+2h Review Queued',
    walkInQueueTitle: 'Live Walk-In Queue & ETA',
    addWalkIn: 'Add Walk-In',
    noWalkIns: 'No waiting walk-in guests right now. Tap + Add Walk-In during rush hour to track ETAs automatically.',
    closeBtn: 'Close',
    queueGuest: 'Queue Guest ✓',
    callNext: 'Call Next',
    prepaidPackagesTitle: 'Prepaid Session Packages & Passes',
    issuePass: 'Issue Pass',
    createPass: 'Create Prepaid Pass ✓',
    useSession: 'Use 1 Session',
    completedTick: 'Completed ✓',
    noPackages: 'No prepaid session bundles yet. Offer 4-visit or 5-session packages to lock repeat upfront cashflow.',
    bridalTrackerTitle: 'Bridal / Groom Event Advance Tracker',
    bridalLadiesTitle: 'Bridal Suite & Female-Only Event Advance Tracker',
    femaleOnlyBadge: '✓ Female-Only Private Cabin Policy Active across WhatsApp Rate Menu & Bookings',
    addBridalEvent: 'Add Bridal / Event',
    saveBridalAdvance: 'Save Bridal Advance ✓',
    markSettled: 'Mark Settled ✓',
    fullSettled: 'Full Settled ✓',
    topServicesTitle: 'Top Booked Services · Stylist Breakdown',
    mostRequested: 'Most Requested',
    remindersTitle: '24h & 2h Automated Reminders',
    activeBadge: 'ACTIVE',
    adv24h: '24-Hour Advance Reminder',
    adv24hDesc: "Sent automatically day prior in client's locked language",
    arr2h: '2-Hour Chair Arrival Ping',
    arr2hDesc: 'Confirms arrival or announces 15m late replies aloud',
    voiceSupportTitle: 'Voice Support with Founder',
    voiceSupportSub:
      'Speak or type in Urdu, Arabic, or English. Your note translates cleanly for the Founder while preserving your original voice, and Founder replies play aloud in your language.',
    recordVoiceNoteTitle: 'Hold or Tap to Record Voice Support Note',
    recordVoiceNoteSub: 'Light Opus clip (~150 KB, auto-purged after 7 days)',
    voiceDraftPlaceholder: 'Type a question for the Founder (or send your recorded voice)...',
    recentSupportTitle: 'Recent Support Messages',
    voiceLogsHeading: 'Hands-Free Voice Alerts & Translation Log',
    voiceLogsSub: 'Announces incoming confirmations & reminder replies aloud in pure human neural voice',
    allAlertsBtn: 'All Alerts',
    urgentOnlyBtn: 'Urgent Only',
    replayBtn: 'Replay',
    sendToFounder: 'Send to Founder',
    sending: 'Sending...',
    playVoice: 'Play Voice',
    stopVoice: 'Stop',
    staffBarbers: 'Staff & Barbers',
    staffStylists: 'Staff & Stylists',
    servicesRates: 'Services & Rates',
    salonHours: 'Salon Hours',
    automationRewards: 'Automation & Rewards',
    windowQrPoster: 'Window QR Poster',
    salonProfileModeLabel: 'Salon Category Profile (Persisted on WhatsApp & Posters)',
    mensSalonBtn: "Men's Salon",
    ladiesParlorBtn: 'Ladies Parlor',
    addBarberBtn: 'Add Barber',
    addStylistBtn: 'Add Stylist',
    saveHoursBtn: 'Save Salon Hours',
  },
  ur: {
    whatsappConnected: 'واٹس ایپ گیٹ وے · فعال',
    liveFloor: 'لائیو فلور',
    passesEvents: 'پاسز اور ایونٹس',
    voiceHelp: 'وائس سپورٹ',
    manage: 'مینج کریں',
    counterSleep: 'کاؤنٹر سلیپ',
    keepCounterAwake: 'کاؤنٹر بیدار کریں',
    wakeOn: 'اسکرین آن',
    wakeOff: 'اسکرین آف',
    auxBoost: 'آکس بوسٹ',
    boost: 'بوسٹ',
    tapEnableAudio: 'آڈیو الرٹس آن کریں',
    founder: 'فاؤنڈر',
    logOut: 'لاگ آؤٹ',
    activeShopTier: 'فعال شاپ / پیکج:',
    todayRevenue: 'آج کی آمدنی',
    reminders24_2: '24 گھنٹے / 2 گھنٹے ریمائنڈر',
    activeTick: 'فعال ✓',
    pendingDeposits: 'باقی ایڈوانس',
    stop: 'روکیں',
    urgentAlerts: 'فوری الرٹس',
    actionRequired: 'کارروائی درکار',
    markResolved: 'حل شدہ ✓',
    viewScreenshot: 'اسکرین شاٹ دیکھیں',
    hideProof: 'ثبوت چھپائیں',
    verifyDeposit: 'ڈپازٹ تصدیق کریں ✓',
    markHandled: 'ہینڈل ہو گیا ✓',
    quickChairLock: 'فوری چیئر لاک · آواز اور 2-ٹیپ بٹن',
    quickChairSub:
      'بولنے کے لیے مائیک دبائیں یا ٹیپ کریں (مثلاً "حمزہ 30 منٹ") یا بغیر آواز 2-ٹیپ سے واک ان چیئر مصروف کریں۔',
    holdOrTapSpeakBtn: 'بول کر چیئر لاک کریں (30s)',
    transcribingLock: 'آواز سمجھی جا رہی ہے...',
    tapStopLock: 'لاک کرنے کے لیے ٹیپ کریں',
    voicePlaceholder: 'بولیں یا لکھیں مثلاً "Hamza 7 to 8 PM" یا "Aslam 30 minutes"',
    parseAndLockBtn: 'چیئر لاک کریں',
    freeNow: 'فارغ ہے',
    busy: 'مصروف',
    tapAgain30: 'دوبارہ دبائیں: +30 منٹ',
    plus30: '+30 منٹ مصروف',
    tapAgain60: 'دوبارہ دبائیں: +1 گھنٹہ',
    plus60: '+1 گھنٹہ مصروف',
    freeChair: 'چیئر فارغ کریں',
    todayScheduleTitle: 'آج کا لائیو شیڈول اور چیئر ٹائم لائن',
    unflaggedClear: 'غیر نشان زد انٹریز خودکار مکمل ہوں گی',
    seatBtn: 'سیٹ پر بٹھائیں',
    markDone: 'مکمل ✓',
    flaggedHeld: 'نشان زد · روکا گیا',
    doneTick: 'مکمل ✓',
    reviewQueued: '2 گھنٹے بعد ریویو شیڈول',
    walkInQueueTitle: 'لائیو واک ان قطار اور وقت',
    addWalkIn: 'واک ان شامل کریں',
    noWalkIns: 'ابھی کوئی واک ان گاہک انتظار میں نہیں۔ رش کے وقت ٹریک کرنے کے لیے + واک ان شامل کریں دبائیں۔',
    closeBtn: 'بند کریں',
    queueGuest: 'قطار میں شامل کریں ✓',
    callNext: 'اگلا گاہک بلائیں',
    prepaidPackagesTitle: 'پری پیڈ سیشن پیکجز اور پاس',
    issuePass: 'پاس جاری کریں',
    createPass: 'پری پیڈ پاس بنائیں ✓',
    useSession: '1 سیشن استعمال کریں',
    completedTick: 'مکمل ✓',
    noPackages: 'ابھی کوئی پری پیڈ سیشن پیکج نہیں۔ مستقل گاہکوں کے لیے 4 یا 5 سیشن پاس بنائیں۔',
    bridalTrackerTitle: 'برائیڈل / گروم ایونٹ ایڈوانس ٹریکر',
    bridalLadiesTitle: 'برائیڈل سوئٹ اور لیڈیز ایونٹ ایڈوانس',
    femaleOnlyBadge: '✓ صرف خواتین کے لیے پرائیویٹ کیبن پالیسی واٹس ایپ مینیو اور بکنگز پر فعال ہے',
    addBridalEvent: 'نیا ایونٹ شامل کریں',
    saveBridalAdvance: 'ایڈوانس محفوظ کریں ✓',
    markSettled: 'مکمل ادا شدہ ✓',
    fullSettled: 'مکمل تصفیہ ✓',
    topServicesTitle: 'سب سے زیادہ بک ہونے والی سروسز',
    mostRequested: 'زیادہ طلب',
    remindersTitle: '24 گھنٹے اور 2 گھنٹے خودکار ریمائنڈرز',
    activeBadge: 'فعال',
    adv24h: '24 گھنٹے پہلے ریمائنڈر',
    adv24hDesc: 'ایک دن پہلے گاہک کی زبان میں خودکار بھیجا جاتا ہے',
    arr2h: '2 گھنٹے پہلے آمد کی یاددہانی',
    arr2hDesc: 'آمد کی تصدیق یا 15 منٹ تاخیر آواز میں سناتا ہے',
    voiceSupportTitle: 'فاؤنڈر کے ساتھ وائس سپورٹ',
    voiceSupportSub:
      'اردو، عربی یا انگریزی میں بولیں یا لکھیں۔ آپ کا پیغام اصل آواز کے ساتھ فاؤنڈر کو ترجمہ ہو کر جائے گا اور جواب آپ کی زبان میں سنایا جائے گا۔',
    recordVoiceNoteTitle: 'وائس نوٹ ریکارڈ کرنے کے لیے دبائیں یا ٹیپ کریں',
    recordVoiceNoteSub: 'ہلکا Opus کلپ (~150 KB، 7 دن بعد خودکار حذف)',
    voiceDraftPlaceholder: 'فاؤنڈر کے لیے سوال لکھیں (یا صرف آواز بھیجیں)...',
    recentSupportTitle: 'حالیہ سپورٹ پیغامات',
    voiceLogsHeading: 'خودکار وائس الرٹس اور ترجمہ لاگ',
    voiceLogsSub: 'آنے والی بکنگز اور ریمائنڈرز خالص انسانی آواز میں اونچا سناتا ہے',
    allAlertsBtn: 'تمام الرٹس',
    urgentOnlyBtn: 'صرف فوری',
    replayBtn: 'دوبارہ سنیں',
    sendToFounder: 'فاؤنڈر کو بھیجیں',
    sending: 'بھیجا جا رہا ہے...',
    playVoice: 'آواز چلائیں',
    stopVoice: 'روکیں',
    staffBarbers: 'اسٹاف اور باربرز',
    staffStylists: 'اسٹاف اور اسٹائلسٹ',
    servicesRates: 'سروسز اور ریٹس',
    salonHours: 'سیلون کے اوقات',
    automationRewards: 'آٹومیشن اور ریوارڈز',
    windowQrPoster: 'ونڈو QR پوسٹر',
    salonProfileModeLabel: 'سیلون کیٹیگری پروفائل (واٹس ایپ اور پوسٹرز پر محفوظ)',
    mensSalonBtn: 'مینز سیلون',
    ladiesParlorBtn: 'لیڈیز پارلر',
    addBarberBtn: 'باربر شامل کریں',
    addStylistBtn: 'اسٹائلسٹ شامل کریں',
    saveHoursBtn: 'اوقات محفوظ کریں',
  },
  ar: {
    whatsappConnected: 'بوابة واتساب · متصل',
    liveFloor: 'الصالة المباشرة',
    passesEvents: 'الباقات والمناسبات',
    voiceHelp: 'الدعم الصوتي',
    manage: 'الإدارة',
    counterSleep: 'وضع السكون',
    keepCounterAwake: 'إيقاظ الكاونتر',
    wakeOn: 'الشاشة مفعلة',
    wakeOff: 'الشاشة متوقفة',
    auxBoost: 'تضخيم AUX',
    boost: 'تضخيم',
    tapEnableAudio: 'اضغط لتفعيل التنبيهات الصوتية',
    founder: 'المؤسس',
    logOut: 'تسجيل الخروج',
    activeShopTier: 'الصالون / الباقة النشطة:',
    todayRevenue: 'إيرادات اليوم',
    reminders24_2: 'تذكيرات 24س / 2س',
    activeTick: 'مفعل ✓',
    pendingDeposits: 'العربون المعلق',
    stop: 'إيقاف',
    urgentAlerts: 'تنبيهات عاجلة',
    actionRequired: 'يتطلب إجراء',
    markResolved: 'تم الحل ✓',
    viewScreenshot: 'عرض الإيصال',
    hideProof: 'إخفاء الإثبات',
    verifyDeposit: 'تأكيد العربون ✓',
    markHandled: 'تمت المعالجة ✓',
    quickChairLock: 'قفل الكرسي السريع · بالصوت أو بنقرتين',
    quickChairSub:
      'اضغط أو ثبت الميكروفون للتحدث (مثال: "Hamza 30 minutes") أو استخدم أزرار المدة لقفل كرسي الزبون الحضوري فوراً.',
    holdOrTapSpeakBtn: 'اضغط أو ثبت للتحدث والقفل (30ث)',
    transcribingLock: 'جاري تحويل الصوت...',
    tapStopLock: 'اضغط للإيقاف والقفل',
    voicePlaceholder: 'قل أو اكتب مثال: "Hamza 7 to 8 PM" أو "Aslam 30 minutes"',
    parseAndLockBtn: 'تحليل وقفل الكرسي',
    freeNow: 'متاح الآن',
    busy: 'مشغول',
    tapAgain30: 'اضغط مجدداً: تأكيد +30د',
    plus30: '+30د مشغول',
    tapAgain60: 'اضغط مجدداً: تأكيد +1س',
    plus60: '+1س مشغول',
    freeChair: 'تحرير الكرسي',
    todayScheduleTitle: 'جدول اليوم المباشر وحالة الكراسي',
    unflaggedClear: 'تكتمل المواعيد غير المعلمة تلقائياً',
    seatBtn: 'إجلاس',
    markDone: 'إنهاء ✓',
    flaggedHeld: 'معلم · محجوز',
    doneTick: 'مكتمل ✓',
    reviewQueued: 'طلب تقييم بعد ساعتين',
    walkInQueueTitle: 'قائمة انتظار الحضور المباشر',
    addWalkIn: 'إضافة حضور',
    noWalkIns: 'لا يوجد زبائن انتظار حالياً. اضغط + إضافة حضور في أوقات الذروة لمتابعة وقت الانتظار.',
    closeBtn: 'إغلاق',
    queueGuest: 'إضافة للانتظار ✓',
    callNext: 'استدعاء التالي',
    prepaidPackagesTitle: 'باقات الجلسات المسبقة والبطاقات',
    issuePass: 'إصدار باقة',
    createPass: 'إنشاء الباقة ✓',
    useSession: 'خصم جلسة واحدة',
    completedTick: 'مكتمل ✓',
    noPackages: 'لا توجد باقات جلسات مسبقة بعد. قدّم باقات 4 أو 5 جلسات لتعزيز التدفق النقدي.',
    bridalTrackerTitle: 'متابعة عربون مناسبات العرائس والفرسان',
    bridalLadiesTitle: 'متابعة عربون باقات العرائس والمناسبات',
    femaleOnlyBadge: '✓ سياسة الغرف الخاصة للسيدات مفعلة على قائمة واتساب والحجوزات',
    addBridalEvent: 'إضافة مناسبة',
    saveBridalAdvance: 'حفظ العربون ✓',
    markSettled: 'تمت التصفية ✓',
    fullSettled: 'مدفوع بالكامل ✓',
    topServicesTitle: 'أكثر الخدمات طلباً · أداء الموظفين',
    mostRequested: 'الأكثر طلباً',
    remindersTitle: 'تذكيرات تلقائية قبل 24س وساعتين',
    activeBadge: 'مفعل',
    adv24h: 'تذكير قبل 24 ساعة',
    adv24hDesc: 'يُرسل تلقائياً قبل الموعد بيوم بلغة العميل المسجلة',
    arr2h: 'تأكيد الوصول قبل ساعتين',
    arr2hDesc: 'يؤكد الحضور أو يذيع رد التأخير 15 دقيقة صوتياً',
    voiceSupportTitle: 'الدعم الصوتي المباشر مع المؤسس',
    voiceSupportSub:
      'تحدث أو اكتب بالعربية أو الأردية أو الإنجليزية. تُترجم رسالتك للمؤسس مع حفظ صوتك الأصلي ويصلك الرد صوتياً بلغتك.',
    recordVoiceNoteTitle: 'اضغط أو انقر لتسجيل رسالة صوتية للمؤسس',
    recordVoiceNoteSub: 'مقطع صوتي خفيف (~150 KB، يُحذف تلقائياً بعد 7 أيام)',
    voiceDraftPlaceholder: 'اكتب سؤالك للمؤسس (أو أرسل التسجيل الصوتي)...',
    recentSupportTitle: 'رسائل الدعم الأخيرة',
    voiceLogsHeading: 'سجل التنبيهات الصوتية والترجمة',
    voiceLogsSub: 'يذيع تأكيدات الحجز والردود بصوت بشري طبيعي نقي',
    allAlertsBtn: 'جميع التنبيهات',
    urgentOnlyBtn: 'العاجلة فقط',
    replayBtn: 'إعادة التشغيل',
    sendToFounder: 'إرسال للمؤسس',
    sending: 'جاري الإرسال...',
    playVoice: 'تشغيل الصوت',
    stopVoice: 'إيقاف',
    staffBarbers: 'الموظفون والحلاقون',
    staffStylists: 'الموظفات والخبيرات',
    servicesRates: 'الخدمات والأسعار',
    salonHours: 'ساعات العمل',
    automationRewards: 'الأتمتة والمكافآت',
    windowQrPoster: 'ملصق QR للواجهة',
    salonProfileModeLabel: 'فئة الصالون (محفوظة في واتساب والملصقات)',
    mensSalonBtn: 'صالون رجالي',
    ladiesParlorBtn: 'صالون نسائي',
    addBarberBtn: 'إضافة حلاق',
    addStylistBtn: 'إضافة خبيرة',
    saveHoursBtn: 'حفظ ساعات العمل',
  },
};

export const UPGRADE_MODAL_I18N: Record<
  VoiceLang,
  {
    kicker: string;
    title: (salonName: string) => string;
    creditNote: (pkgName: string, sym: string, fee: number) => string;
    fullPrice: string;
    payDiff: (sym: string, amt: number) => string;
    newMaintFee: (sym: string, amt: number) => string;
    paymentChannelTitle: (currency: string) => string;
    differencePayLabel: (sym: string, amt: number) => string;
    tidLabel: string;
    tidPlaceholder: string;
    confirmUpgradeBtn: (sym: string, amt: number) => string;
    upgradingBtn: string;
    closeBtn: string;
    successToast: (pkgName: string, sym: string, amt: number) => string;
    whatsappGreeting: (owner: string, salon: string, pkgName: string, sym: string, amt: number, tid: string) => string;
  }
> = {
  ur: {
    kicker: 'صرف فرق کی ادائیگی · 100% ایڈجسٹمنٹ',
    title: (salon) => `${salon} پیکیج اپگریڈ کریں`,
    creditNote: (pkg, sym, fee) =>
      `آپ کی موجودہ ${pkg} سیٹ اپ فیس (${sym}${fee.toLocaleString()}) کا 100% کریڈٹ ایڈجسٹ کر دیا گیا ہے۔ صرف بقایا فرق ادا کریں۔`,
    fullPrice: 'مکمل قیمت:',
    payDiff: (sym, amt) => `صرف فرق ادا کریں: ${sym}${amt.toLocaleString()}`,
    newMaintFee: (sym, amt) => `نئی ماہانہ مینٹیننس فیس: ${sym}${amt.toLocaleString()} / ماہ`,
    paymentChannelTitle: (curr) => `ادائیگی کا چینل منتخب کریں (${curr})`,
    differencePayLabel: (sym, amt) => `بقایا فرق: ${sym}${amt.toLocaleString()}`,
    tidLabel: 'ٹرانزیکشن ریفرنس / ادائیگی کی تفصیل:',
    tidPlaceholder: 'ٹرانزیکشن ID یا بھیجنے والے اکاؤنٹ کا نمبر درج کریں (TID مثلاً EP-98210)',
    confirmUpgradeBtn: (sym, amt) => `ادائیگی ${sym}${amt.toLocaleString()} اور اپگریڈ کنفرم کریں ←`,
    upgradingBtn: 'اپگریڈ ہو رہا ہے...',
    closeBtn: 'بند کریں',
    successToast: (pkg, sym, amt) =>
      `مبارک ہو! پیکیج کامیابی سے ${pkg} پر اپگریڈ ہو گیا ہے۔ فرق (${sym}${amt.toLocaleString()}) موصول ہو گیا ہے اور تصدیقی میسج واٹس ایپ پر بھیج دیا گیا ہے۔`,
    whatsappGreeting: (owner, salon, pkg, sym, amt, tid) =>
      `محترم ${owner} صاحب! السلام علیکم۔ مبارک ہو! آپ کا سیلون "${salon}" کامیابی سے WORKCRAFT کے "${pkg}" پر اپگریڈ ہو گیا ہے۔ پچھلی سیٹ اپ فیس 100% ایڈجسٹ کرنے کے بعد بقایا فرق (${sym}${amt.toLocaleString()}) موصول ہو گیا ہے۔ (TID: ${tid})۔ آپ کے نئے اعلیٰ فیچرز اور خودکار واٹس ایپ سروسز مکمل فعال ہیں۔ شکریہ!`,
  },
  ar: {
    kicker: 'دفع الفرق فقط · تسوية 100%',
    title: (salon) => `ترقية باقة ${salon}`,
    creditNote: (pkg, sym, fee) =>
      `تم اعتماد 100% من رسوم تأسيس باقتك الحالية ${pkg} (${sym}${fee.toLocaleString()}). ادفع فقط الفرق المتبقي.`,
    fullPrice: 'السعر الكامل:',
    payDiff: (sym, amt) => `ادفع الفرق فقط: ${sym}${amt.toLocaleString()}`,
    newMaintFee: (sym, amt) => `رسوم الصيانة الشهرية الجديدة: ${sym}${amt.toLocaleString()} / شهرياً`,
    paymentChannelTitle: (curr) => `اختر وسيلة الدفع المعتمدة (${curr})`,
    differencePayLabel: (sym, amt) => `المبلغ المتبقي: ${sym}${amt.toLocaleString()}`,
    tidLabel: 'تفاصيل الدفع / رقم الحوالة:',
    tidPlaceholder: 'أدخل رقم المعاملة أو رقم الحساب المحول منه (TID مثلاً TR-82910)',
    confirmUpgradeBtn: (sym, amt) => `دفع ${sym}${amt.toLocaleString()} وتأكيد الترقية فوراً ←`,
    upgradingBtn: 'جارٍ الترقية وتفعيل الباقة...',
    closeBtn: 'إغلاق',
    successToast: (pkg, sym, amt) =>
      `تمت ترقية الباقة بنجاح إلى ${pkg}! تم استلام الفرق (${sym}${amt.toLocaleString()}) وإرسال رسالة التأكيد عبر واتساب.`,
    whatsappGreeting: (owner, salon, pkg, sym, amt, tid) =>
      `مرحباً بك يا ${owner}! نبارك لكم ترقية صالونكم "${salon}" إلى باقة WORKCRAFT المتميزة "${pkg}". تم اعتماد رصيدكم السابق كاملاً ودفع الفرق (${sym}${amt.toLocaleString()}) بنجاح. (رقم المعاملة: ${tid}). جميع المزايا المتقدمة وخدمات واتساب الذكية مفعلة الآن. شكراً لثقتكم!`,
  },
  en: {
    kicker: 'PAY DIFFERENCE ONLY · 100% SETUP CREDIT',
    title: (salon) => `Upgrade ${salon} Package`,
    creditNote: (pkg, sym, fee) =>
      `Your current ${pkg} setup fee (${sym}${fee.toLocaleString()}) is credited 100%. Pay only the remaining difference.`,
    fullPrice: 'Full Price:',
    payDiff: (sym, amt) => `Pay Difference: ${sym}${amt.toLocaleString()}`,
    newMaintFee: (sym, amt) => `New Monthly Maintenance Fee: ${sym}${amt.toLocaleString()}/mo`,
    paymentChannelTitle: (curr) => `Select Payment Channel (${curr})`,
    differencePayLabel: (sym, amt) => `Remaining Difference: ${sym}${amt.toLocaleString()}`,
    tidLabel: 'Payment Reference / Transaction Proof:',
    tidPlaceholder: 'Enter Transaction ID or sender mobile number (e.g. TID: EP-98210)',
    confirmUpgradeBtn: (sym, amt) => `Pay ${sym}${amt.toLocaleString()} & Upgrade Now →`,
    upgradingBtn: 'Upgrading & Verifying...',
    closeBtn: 'Close',
    successToast: (pkg, sym, amt) =>
      `Upgraded to ${pkg}! Difference of ${sym}${amt.toLocaleString()} received and confirmation sent to salon WhatsApp.`,
    whatsappGreeting: (owner, salon, pkg, sym, amt, tid) =>
      `Dear ${owner}! Greetings. Congratulations, your salon "${salon}" has been successfully upgraded to WORKCRAFT "${pkg}". Your previous setup fee was credited 100% and the remaining difference of ${sym}${amt.toLocaleString()} has been cleared. (TID: ${tid}). Your new high-tier features and automated concierge are now live. Thank you!`,
  },
};

export const MAINT_MODAL_I18N: Record<
  VoiceLang,
  {
    kicker: string;
    title: (salon: string) => string;
    description: (sym: string, amt: number, phone: string) => string;
    feeHeading: string;
    dueDateHeading: string;
    channelHeading: (curr: string) => string;
    tidLabel: string;
    tidPlaceholder: string;
    payBtn: (sym: string, amt: number) => string;
    processingBtn: string;
    cancelBtn: string;
    whatsappNotice: (owner: string, salon: string, sym: string, amt: number, channel: string, tid: string) => string;
  }
> = {
  ur: {
    kicker: 'ماہانہ مینٹیننس فیس ادائیگی · خودکار سسٹم بحالی',
    title: (salon) => `${salon} کی مینٹیننس فیس ادا کریں`,
    description: (sym, amt, phone) =>
      `ماہانہ مینٹیننس فیس (${sym}${amt.toLocaleString()}) اپنے رجسٹرڈ واٹس ایپ نمبر (${phone}) سے کسی بھی چینل کے ذریعے ادا کر کے فوری Tier-1 ترجیح اور لائیو میٹرکس بحال کریں۔`,
    feeHeading: 'مقررہ ماہانہ فیس:',
    dueDateHeading: 'آخری تاریخ: ہر ماہ کی 5 تاریخ',
    channelHeading: (curr) => `ادائیگی کا چینل منتخب کریں (${curr})`,
    tidLabel: 'ٹرانزیکشن آئی ڈی یا بھیجنے والے اکاؤنٹ کی تفصیل:',
    tidPlaceholder: 'مثلاً TID یا JazzCash / EasyPaisa / بینک ریفرنس نمبر درج کریں',
    payBtn: (sym, amt) => `فیس ${sym}${amt.toLocaleString()} ادا کریں اور ترجیح بحال کریں ←`,
    processingBtn: 'تصدیق ہو رہی ہے...',
    cancelBtn: 'منسوخ کریں',
    whatsappNotice: (owner, salon, sym, amt, ch, tid) =>
      `محترم ${owner} صاحب! السلام علیکم۔ آپ کے سیلون "${salon}" کی ماہانہ مینٹیننس فیس (${sym}${amt.toLocaleString()}) بذریعہ ${ch} کامیابی سے موصول ہو گئی ہے۔ (TID: ${tid})۔ آپ کا لائیو ڈیش بورڈ، میٹرکس اور Tier-1 ترجیحی واٹس ایپ سپورٹ مکمل بحال ہے۔ شکریہ!`,
  },
  ar: {
    kicker: 'سداد رسوم الصيانة الشهرية · استعادة الأولوية',
    title: (salon) => `سداد رسوم صيانة ${salon}`,
    description: (sym, amt, phone) =>
      `سدد رسوم الصيانة الشهرية (${sym}${amt.toLocaleString()}) عبر القنوات المعتمدة لحساب صالونك المسجل (${phone}) لاستعادة الإحصائيات الحية والدعم ذي الأولوية فوراً.`,
    feeHeading: 'الرسوم الشهرية المستحقة:',
    dueDateHeading: 'تاريخ الاستحقاق: 5 من كل شهر ميلادي',
    channelHeading: (curr) => `اختر قناة الدفع (${curr})`,
    tidLabel: 'رقم الإيصال أو المعاملة (TID):',
    tidPlaceholder: 'أدخل رقم المعاملة أو رقم الحساب المحول منه (TID)',
    payBtn: (sym, amt) => `سداد ${sym}${amt.toLocaleString()} واستعادة الأولوية ←`,
    processingBtn: 'جارٍ التحقق والتأكيد...',
    cancelBtn: 'إلغاء',
    whatsappNotice: (owner, salon, sym, amt, ch, tid) =>
      `مرحباً بك يا ${owner}! تم استلام رسوم الصيانة الشهرية (${sym}${amt.toLocaleString()}) لصالون "${salon}" بنجاح عبر ${ch}. (رقم الإيصال: ${tid}). تم فتح لوحة الإحصائيات واستعادة الأولوية الفورية للواتساب. شكراً لكم!`,
  },
  en: {
    kicker: 'MONTHLY MAINTENANCE PAYMENT · AUTO PRIORITY RESTORATION',
    title: (salon) => `Pay Maintenance Fee for ${salon}`,
    description: (sym, amt, phone) =>
      `Clear your monthly maintenance fee (${sym}${amt.toLocaleString()}) from your registered SIM (${phone}) to unlock live metrics and maintain Tier-1 priority auto-replies.`,
    feeHeading: 'Monthly Due Fee:',
    dueDateHeading: 'Due Date: 5th of Every Month',
    channelHeading: (curr) => `Select Payment Channel (${curr})`,
    tidLabel: 'Transaction ID / Sender Account Proof:',
    tidPlaceholder: 'Enter TID or sender account reference (e.g. TID: EP-90482)',
    payBtn: (sym, amt) => `Pay ${sym}${amt.toLocaleString()} & Restore Priority →`,
    processingBtn: 'Verifying Transaction...',
    cancelBtn: 'Cancel',
    whatsappNotice: (owner, salon, sym, amt, ch, tid) =>
      `Dear ${owner}! Greetings. The monthly maintenance fee of ${sym}${amt.toLocaleString()} for "${salon}" has been successfully cleared via ${ch}. (TID: ${tid}). Your live stats, business metrics, and Tier-1 concierge priority are active. Thank you!`,
  },
};

function getRegionFromPhone(phone: string, location?: string) {
  const cleaned = phone.replace(/\s+/g, '');
  const loc = (location || '').toLowerCase();
  const isPakistan =
    cleaned.startsWith('+92') ||
    loc.includes('pakistan') ||
    loc.includes('lahore') ||
    loc.includes('karachi') ||
    loc.includes('islamabad') ||
    loc.includes('rawalpindi') ||
    loc.includes('faisalabad') ||
    loc.includes('multan');
  if (isPakistan) return REGION_CONFIGS.PK;
  // Outside Pakistan salons use US Dollar (USD) configuration
  return REGION_CONFIGS.GLOBAL;
}

// Query 2: Pakistan & India -> English & Urdu only; MENA / Europe / Intl -> Arabic, English & Urdu
function getAllowedDashboardLangs(phone: string, location?: string): VoiceLang[] {
  const cleaned = phone.replace(/\s+/g, '');
  const loc = (location || '').toLowerCase();
  const isSouthAsia =
    cleaned.startsWith('+92') ||
    cleaned.startsWith('+91') ||
    loc.includes('pakistan') ||
    loc.includes('lahore') ||
    loc.includes('karachi') ||
    loc.includes('islamabad') ||
    loc.includes('india') ||
    loc.includes('mumbai') ||
    loc.includes('delhi');
  if (isSouthAsia) return ['en', 'ur'];
  return ['ar', 'en', 'ur'];
}

export const INITIAL_CLIENT_SALONS: ClientSalon[] = [
  {
    id: '1',
    name: 'Seven Cuts Studio',
    owner: 'Hamza Malik',
    phone: '+92 321 8472910',
    location: 'DHA Phase 5, Lahore',
    planId: 'VIP',
    plan: 'VIP Executive',
    maint: 3500,
    language: 'ur',
    onboardingLanguage: 'ur',
  },
  {
    id: '2',
    name: 'Royal Fade Lounge',
    owner: 'Tariq Butt',
    phone: '+92 300 9876543',
    location: 'Gulberg III, Lahore',
    planId: 'STARTER',
    plan: 'Starter Setup',
    maint: 1750,
    language: 'ur',
    onboardingLanguage: 'ur',
  },
  {
    id: '3',
    name: 'Al-Noor Executive Grooming',
    owner: 'Aslam Khan (Dubai Salon)',
    phone: '+971 50 8923411',
    location: 'Jumeirah 1, Dubai, UAE',
    planId: 'VIP',
    plan: 'VIP Executive',
    maint: 35,
    language: 'ur', // Asian barber in MENA: hears voice & reads Founder notices in Urdu while clients chat in Arabic!
    onboardingLanguage: 'ur',
  },
  {
    id: '4',
    name: 'Mayfair Blade & Beard',
    owner: 'Oliver Bennett',
    phone: '+44 7911 123456',
    location: 'Soho, London, UK',
    planId: 'STARTER',
    plan: 'Starter Setup',
    maint: 15,
    language: 'en',
    onboardingLanguage: 'en',
  },
  {
    id: '5',
    name: 'Noor Beauty Lounge (Ladies Parlor)',
    owner: 'Ayesha Siddiqui',
    phone: '+92 333 4412345',
    location: 'Clifton Block 4, Karachi',
    planId: 'GROWTH',
    plan: 'Growth Automation',
    maint: 2500,
    language: 'ur',
    onboardingLanguage: 'ur',
  },
];

export const CLIENT_SALONS = INITIAL_CLIENT_SALONS;

interface SalonOwnerDashboardProps {
  salonName?: string;
  selectedSalonName?: string;
  lockedSalonId?: string | null;
  authUser?: AuthUser | null;
  onLogout?: () => void;
  ownerName?: string;
  phone?: string;
  salonCategory?: 'MENS' | 'LADIES';
  onboardedData?: OnboardedSalonPayload | null;
  isFounderInspector?: boolean;
  sectionMode?: 'LIVE' | 'PASSES' | 'VOICE' | 'MANAGE';
  onSectionModeChange?: (mode: 'LIVE' | 'PASSES' | 'VOICE' | 'MANAGE') => void;
  onOwnerLangChange?: (lang: 'en' | 'ur' | 'ar') => void;
  externalHardwareAction?: { type: 'WAKE' | 'AUX' | 'TEST_SPEAKER'; seq: number } | null;
  onHardwareStatusSync?: (status: {
    isWakeLockActive: boolean;
    isLoudspeakerBoostActive: boolean;
    isCounterSleeping: boolean;
    overnightCount: number;
    hasFounderVoiceReply: boolean;
    allowedLangs: Array<'en' | 'ur' | 'ar'>;
    ownerLang: 'en' | 'ur' | 'ar';
  }) => void;
  onOpenSimulator?: () => void;
  onClose?: () => void;
  voiceThreads?: VoiceThreadItem[];
  onVoiceThreadsUpdated?: (threads: VoiceThreadItem[]) => void;
}

export const SalonOwnerDashboard: React.FC<SalonOwnerDashboardProps> = ({
  selectedSalonName,
  lockedSalonId,
  authUser,
  onLogout: _onLogout,
  salonCategory,
  onboardedData,
  isFounderInspector = false,
  sectionMode,
  onSectionModeChange,
  onOwnerLangChange,
  externalHardwareAction,
  onHardwareStatusSync,
  onClose,
  voiceThreads,
  onVoiceThreadsUpdated,
}) => {
  const [salonsState, setSalonsState] = useState<ClientSalon[]>(() => {
    const dynamicId =
      lockedSalonId && !INITIAL_CLIENT_SALONS.some((s) => s.id === lockedSalonId)
        ? lockedSalonId
        : null;
    if (!onboardedData && !dynamicId) return INITIAL_CLIENT_SALONS;

    const entryId = dynamicId || 'onboarded-live';
    const customEntry: ClientSalon = {
      id: entryId,
      name: onboardedData?.salonName || authUser?.salonName || selectedSalonName || 'My Salon',
      owner: onboardedData?.ownerName || authUser?.displayName || 'Salon Owner',
      phone: onboardedData?.phone || authUser?.phone || '+92 300 0000000',
      location: onboardedData?.location || 'Local Salon Branch',
      planId: onboardedData?.planId || 'GROWTH',
      plan: onboardedData?.planName || 'Growth Automation',
      maint: onboardedData?.monthlyMaint ?? 2500,
      language: onboardedData?.language || 'en',
      onboardingLanguage: onboardedData?.language || 'en',
    };
    const filtered = INITIAL_CLIENT_SALONS.filter(
      (s) => s.id !== entryId && s.name.toLowerCase() !== customEntry.name.trim().toLowerCase()
    );
    return [customEntry, ...filtered];
  });
  const [selectedSalonId, setSelectedSalonId] = useState<string>(
    lockedSalonId || (onboardedData ? 'onboarded-live' : '1')
  );

  useEffect(() => {
    if (lockedSalonId && !isFounderInspector) {
      setSelectedSalonId(lockedSalonId);
      setSalonsState((prev) => {
        if (prev.some((s) => s.id === lockedSalonId)) return prev;
        const fallbackEntry: ClientSalon = {
          id: lockedSalonId,
          name: authUser?.salonName || selectedSalonName || 'My Salon',
          owner: authUser?.displayName || 'Salon Owner',
          phone: authUser?.phone || '+92 300 0000000',
          location: 'Local Salon Branch',
          planId: 'GROWTH',
          plan: 'Growth Automation',
          maint: 2500,
          language: 'en',
          onboardingLanguage: 'en',
        };
        return [fallbackEntry, ...prev];
      });
    }
  }, [lockedSalonId, isFounderInspector, authUser?.salonName, authUser?.displayName, authUser?.phone, selectedSalonName]);

  useEffect(() => {
    if (!onboardedData) return;
    const entryId = lockedSalonId || 'onboarded-live';
    const customEntry: ClientSalon = {
      id: entryId,
      name: onboardedData.salonName,
      owner: onboardedData.ownerName,
      phone: onboardedData.phone,
      location: onboardedData.location,
      planId: onboardedData.planId,
      plan: onboardedData.planName,
      maint: onboardedData.monthlyMaint,
      language: onboardedData.language,
      onboardingLanguage: onboardedData.language,
    };
    setSalonsState((prev) => [
      customEntry,
      ...prev.filter(
        (s) =>
          s.id !== entryId &&
          s.id !== 'onboarded-live' &&
          s.name.toLowerCase() !== onboardedData.salonName.trim().toLowerCase()
      ),
    ]);
    if (!lockedSalonId) {
      setSelectedSalonId(entryId);
    }
  }, [onboardedData, lockedSalonId]);

  // Query 3: Match exact clicked salon when Founder inspects from Overview or Clients
  useEffect(() => {
    if (onboardedData || lockedSalonId) return;
    const targetName = selectedSalonName?.trim().toLowerCase();
    if (!targetName) return;
    const exactOrPartial = salonsState.find((s) => {
      const sName = s.name.toLowerCase();
      const firstWord = targetName.split(' ')[0];
      return sName === targetName || sName.includes(targetName) || targetName.includes(sName.split(' ')[0]) || (firstWord.length > 3 && sName.includes(firstWord));
    });
    if (exactOrPartial) {
      setSelectedSalonId(exactOrPartial.id);
    }
  }, [selectedSalonName, salonsState, onboardedData, lockedSalonId]);

  const currentSalon = salonsState.find((s) => s.id === selectedSalonId) || salonsState[0];
  const allowedLangs = useMemo(
    () => getAllowedDashboardLangs(currentSalon.phone, currentSalon.location),
    [currentSalon.phone, currentSalon.location]
  );
  const allowedLangsKey = allowedLangs.join(',');
  const regionConfig = getRegionFromPhone(currentSalon.phone, currentSalon.location);
  const currentPackage =
    regionConfig.packages.find((p) => p.id === currentSalon.planId) || regionConfig.packages[0];
  const higherPackages = regionConfig.packages.filter(
    (p) => p.setupFee > currentPackage.setupFee
  );

  // Four-Mode Architecture: LIVE (Daily Floor) | PASSES (Prepaid & Bridal) | VOICE (Founder Voice Help & Log) | MANAGE (Rules & Setup)
  const [internalSectionMode, setInternalSectionMode] = useState<'LIVE' | 'PASSES' | 'VOICE' | 'MANAGE'>('LIVE');
  const currentSectionMode = sectionMode ?? internalSectionMode;
  const setSectionMode = (mode: 'LIVE' | 'PASSES' | 'VOICE' | 'MANAGE') => {
    setInternalSectionMode(mode);
    onSectionModeChange?.(mode);
  };
  const [isWalkInExpanded, setIsWalkInExpanded] = useState(false);
  const [manageSubSection, setManageSubSection] = useState<
    'STAFF' | 'SERVICES' | 'HOURS' | 'AUTOMATION' | 'POSTER'
  >('STAFF');
  const [showManageAdvancedTools, setShowManageAdvancedTools] = useState(false);
  const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);
  const sharedAudioCtxRef = useRef<AudioContext | null>(null);
  const [expandedDepositReceiptId, setExpandedDepositReceiptId] = useState<string | null>(null);
  const [pendingDeposits, setPendingDeposits] = useState<PendingDepositAlert[]>([
    {
      id: 'dep-raast-1',
      clientName: 'Bilal Ahmed',
      phone: '+92 300 1234567',
      method: 'EasyPaisa',
      amount: 600,
      timeSlot: '03:30 PM',
      referenceId: 'EP-88412091',
      receivedAt: '12 mins ago',
      verified: false,
    },
    {
      id: 'dep-raast-2',
      clientName: 'Dr. Usman Qureshi',
      phone: '+92 333 4567890',
      method: 'Raast',
      amount: 1000,
      timeSlot: '05:00 PM',
      referenceId: 'RST-5520941',
      receivedAt: '4 mins ago',
      verified: false,
    },
  ]);
  const [handoverRequests, setHandoverRequests] = useState<HumanHandoverAlert[]>([
    {
      id: 'hnd-1',
      clientName: 'Faisal Mehmood',
      phone: '+92 321 7744110',
      lang: 'ur',
      summary: 'Asked for a custom 3-brother wedding grooming group slot on Saturday evening.',
      receivedAt: '8 mins ago',
      handled: false,
    },
  ]);
  const [salonHours, setSalonHours] = useState<SalonHoursConfig>(() => {
    try {
      const saved = localStorage.getItem('wcl_salon_hours');
      if (saved) return JSON.parse(saved) as SalonHoursConfig;
    } catch {}
    return {
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
  });
  const [conciergeState, setConciergeState] = useState<SalonConciergeStateResponse | null>(null);
  const seenLogIdsRef = useRef<Set<string>>(new Set());
  const seenApptIdsRef = useRef<Set<string>>(new Set());
  const hasHydratedConciergeRef = useRef<boolean>(false);

  // Query 1: Top-Right Upgrade Modal & Payment Details Input
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [selectedUpgradeTargetId, setSelectedUpgradeTargetId] = useState<
    'STARTER' | 'GROWTH' | 'VIP' | 'CUSTOM' | null
  >(null);
  const [selectedUpgradeChannel, setSelectedUpgradeChannel] = useState<string>(
    regionConfig.paymentChannels[0].id
  );
  const [upgradeTidInput, setUpgradeTidInput] = useState('');
  const [upgradeModalError, setUpgradeModalError] = useState<string | null>(null);
  const [isProcessingUpgrade, setIsProcessingUpgrade] = useState(false);

  // Query 8: Maintenance Fee Payment Modal State
  const [isMaintPaymentModalOpen, setIsMaintPaymentModalOpen] = useState(false);
  const [maintPaymentChannel, setMaintPaymentChannel] = useState<string>(
    regionConfig.paymentChannels[0].id
  );
  const [maintPaymentTidInput, setMaintPaymentTidInput] = useState('');
  const [maintModalError, setMaintModalError] = useState<string | null>(null);

  // Query 7: Clickable Location Pin and Salon Timing Modal States
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isTimingModalOpen, setIsTimingModalOpen] = useState(false);

  // Query 1 & 8: WhatsApp Confirmation Receipt Received on Salon Owner's Phone
  const [whatsAppReceiptNotice, setWhatsAppReceiptNotice] = useState<{
    title: string;
    body: string;
    phone: string;
    timestamp: string;
  } | null>(null);

  // Self-onboarded billing activation handler (Founder-only activation unlocks mass WhatsApp blasts)
  const [isActivatingBilling, setIsActivatingBilling] = useState<boolean>(false);

  // Owner Onboarding / Voice Language & Shop-Floor Loudspeaker Controls
  const [ownerLang, setOwnerLang] = useState<VoiceLang>(currentSalon.onboardingLanguage);
  useEffect(() => {
    onOwnerLangChange?.(ownerLang);
  }, [ownerLang, onOwnerLangChange]);
  const ui = OWNER_UI_I18N[ownerLang];
  const isOwnerRtl = ownerLang === 'ur' || ownerLang === 'ar';
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [voiceFilter, setVoiceFilter] = useState<'ALL' | 'URGENT_ONLY'>('ALL');
  const [isWakeLockActive, setIsWakeLockActive] = useState(true);
  const [wakeLockNote, setWakeLockNote] = useState<string | null>(null);
  const [currentlySpeakingText, setCurrentlySpeakingText] = useState<string | null>(null);
  const wakeLockRef = useRef<{ release?: () => Promise<void> } | null>(null);
  const speakDelayTimerRef = useRef<number | null>(null);
  const ttsAudioCacheRef = useRef<Map<string, string>>(new Map());
  const activeTtsAudioRef = useRef<HTMLAudioElement | null>(null);
  const speechKeepAliveRef = useRef<number | null>(null);
  const activeSpeakTokenRef = useRef<number>(0);

  // Sleep-Window Mode & Overnight Queue (Silent when sleeping, Catch-up Replay when woken)
  const [isCounterSleeping, setIsCounterSleeping] = useState(false);
  const [counterSleptAt, setCounterSleptAt] = useState<string | null>(null);
  const [overnightQueue, setOvernightQueue] = useState<OvernightQueueItem[]>([]);
  const isCounterSleepingRef = useRef(isCounterSleeping);
  useEffect(() => {
    isCounterSleepingRef.current = isCounterSleeping;
  }, [isCounterSleeping]);

  // Rush-Hour Loudspeaker / Bluetooth Speaker Boost (ON by default so floor alerts cut through noise)
  const [isLoudspeakerBoostActive, setIsLoudspeakerBoostActive] = useState(true);
  const [showVoiceLogsDrawer, setShowVoiceLogsDrawer] = useState(false);
  const [showProofLedgerDrawer, setShowProofLedgerDrawer] = useState(false);
  const [isTestingLoudAlert, setIsTestingLoudAlert] = useState(false);

  // Stylist / Barber Top Services Breakdown Selection
  const [selectedBarberForServices, setSelectedBarberForServices] = useState<string>('ALL');

  // $0.00 Zero-Cost Browser Voice Chair Blocker + 2-Tap Quick Duration Pills + MediaRecorder Fallback
  const [isListeningMic, setIsListeningMic] = useState(false);
  const [isTranscribingChairMic, setIsTranscribingChairMic] = useState(false);
  const [micElapsedSecs, setMicElapsedSecs] = useState(0);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [armedQuickPill, setArmedQuickPill] = useState<{
    barber: string;
    durationMins: number;
  } | null>(null);
  const recognitionRef = useRef<any>(null);
  const micTimerRef = useRef<number | null>(null);
  const latestTranscriptRef = useRef<string>('');
  const micPressStartRef = useRef<number>(0);
  const micMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const micAudioChunksRef = useRef<Blob[]>([]);
  const micMediaStreamRef = useRef<MediaStream | null>(null);

  // Query 6: Voice Support with Founder (Compressed Opus -> /api/translate-voice -> Unified Voice Inbox)
  const founderVoiceCardRef = useRef<HTMLDivElement | null>(null);
  const founderVoiceAudioRef = useRef<HTMLAudioElement | null>(null);
  const [salonVoiceThreads, setSalonVoiceThreads] = useState<VoiceThreadItem[]>(
    voiceThreads && voiceThreads.length > 0 ? voiceThreads : INITIAL_VOICE_THREADS
  );
  const [ownerVoiceDraft, setOwnerVoiceDraft] = useState('');
  const [ownerRecordedClip, setOwnerRecordedClip] = useState<RecordedOpusClip | null>(null);
  const [isOwnerRecordingVoice, setIsOwnerRecordingVoice] = useState(false);
  const founderVoiceRecorderRef = useRef<VoiceRecorderHandle | null>(null);
  const [isSendingFounderVoice, setIsSendingFounderVoice] = useState(false);
  const [founderVoiceError, setFounderVoiceError] = useState<string | null>(null);
  const [playingFounderMsgId, setPlayingFounderMsgId] = useState<string | null>(null);

  useEffect(() => {
    if (voiceThreads && voiceThreads.length > 0) {
      setSalonVoiceThreads(voiceThreads);
    }
  }, [voiceThreads]);

  const activeVoiceSalonId = /^\d+$/.test(currentSalon.id)
    ? `salon-${currentSalon.id}`
    : currentSalon.id;
  const activeOwnerVoiceLocale: SupportedVoiceLocale =
    ownerLang === 'ur' ? 'ur-PK' : ownerLang === 'ar' ? 'ar-AE' : 'en-US';

  useEffect(() => {
    let cancelled = false;
    const syncThread = async () => {
      try {
        const res = await fetch(
          `/api/voice/threads?salonId=${encodeURIComponent(activeVoiceSalonId)}`,
          { credentials: 'include' }
        );
        if (!res.ok) return;
        const data = (await res.json()) as { threads?: VoiceThreadItem[] };
        if (!cancelled && Array.isArray(data.threads) && data.threads.length > 0) {
          setSalonVoiceThreads((prev) => {
            const byId = new Map(prev.map((t) => [t.id, t]));
            data.threads!.forEach((t) => byId.set(t.id, t));
            return Array.from(byId.values());
          });
        }
      } catch {
        // Fallback smoothly on static preview hosts
      }
    };
    void syncThread();
    const pollTimer = window.setInterval(() => {
      void syncThread();
    }, 20000);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void syncThread();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      cancelled = true;
      window.clearInterval(pollTimer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [activeVoiceSalonId]);

  const normalizedActiveSalonKey = activeVoiceSalonId.replace(/^salon-/, '').toLowerCase();
  const activeFounderVoiceThread: VoiceThreadItem =
    salonVoiceThreads.find(
      (t) =>
        t.salonId.replace(/^salon-/, '').toLowerCase() === normalizedActiveSalonKey ||
        t.salonName.trim().toLowerCase() === currentSalon.name.trim().toLowerCase()
    ) || {
      id: `wc-${activeVoiceSalonId}`,
      serialNumber: String(100 + Math.max(0, salonsState.findIndex((s) => s.id === currentSalon.id)) + 1),
      salonId: activeVoiceSalonId,
      ownerName: currentSalon.owner,
      salonName: currentSalon.name,
      city: currentSalon.location || 'Local Salon Branch',
      duration: '0:12',
      receivedAgo: 'Just now',
      dialect:
        activeOwnerVoiceLocale === 'ar-AE'
          ? 'Gulf Arabic'
          : activeOwnerVoiceLocale === 'en-US'
          ? 'English'
          : 'Standard Urdu',
      targetLocale: activeOwnerVoiceLocale,
      unread: false,
      transcript: '',
      speechPlayText: '',
      defaultReplySuggestion: '',
      messages: [],
    };

  const hasFounderVoiceReply = activeFounderVoiceThread.messages.some(
    (m) => m.senderRole === 'FOUNDER'
  );

  const scrollToFounderVoiceSupport = () => {
    setSectionMode('VOICE');
    window.setTimeout(() => {
      founderVoiceCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
  };

  const handlePlayFounderMessage = async (
    msgId: string,
    audioDataUrl: string | null,
    fallbackText: string,
    localeHint: SupportedVoiceLocale = activeOwnerVoiceLocale
  ) => {
    if (playingFounderMsgId === msgId) {
      if (founderVoiceAudioRef.current) {
        founderVoiceAudioRef.current.pause();
        founderVoiceAudioRef.current = null;
      }
      try {
        window.speechSynthesis?.cancel();
      } catch {}
      setPlayingFounderMsgId(null);
      return;
    }
    if (founderVoiceAudioRef.current) {
      founderVoiceAudioRef.current.pause();
      founderVoiceAudioRef.current = null;
    }
    try {
      window.speechSynthesis?.cancel();
    } catch {}
    if (audioDataUrl) {
      try {
        const audio = new Audio(audioDataUrl);
        founderVoiceAudioRef.current = audio;
        setPlayingFounderMsgId(msgId);
        audio.onended = () => {
          setPlayingFounderMsgId(null);
          founderVoiceAudioRef.current = null;
        };
        audio.onerror = () => {
          setPlayingFounderMsgId(null);
          founderVoiceAudioRef.current = null;
        };
        await audio.play();
        return;
      } catch {
        setPlayingFounderMsgId(null);
      }
    }

    const playBrowserFallback = () => {
      if (fallbackText && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          const voices = window.speechSynthesis.getVoices() || [];
          const langPrefix = localeHint.split('-')[0];
          const matched =
            voices.find((v) => v.lang.toLowerCase().startsWith(langPrefix)) ||
            (langPrefix === 'ur' ? voices.find((v) => v.lang.toLowerCase().startsWith('hi')) : undefined);
          const utter = new SpeechSynthesisUtterance(fallbackText);
          if (matched) utter.voice = matched;
          utter.lang = matched ? matched.lang : localeHint;
          utter.rate = 0.96;
          setPlayingFounderMsgId(msgId);
          utter.onend = () => setPlayingFounderMsgId(null);
          utter.onerror = () => setPlayingFounderMsgId(null);
          window.speechSynthesis.speak(utter);
          return;
        } catch {
          setPlayingFounderMsgId(null);
        }
      }
      setFounderVoiceError(fallbackText ? `Text ready above: "${fallbackText}"` : 'Audio clip expired after 7-day retention.');
    };

    if (fallbackText.trim()) {
      const cacheKey = `${localeHint}::${fallbackText}`;
      setPlayingFounderMsgId(msgId);
      try {
        let neuralUrl = ttsAudioCacheRef.current.get(cacheKey);
        if (!neuralUrl) {
          const ttsRes = await fetch('/api/voice/tts', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: fallbackText, locale: localeHint }),
          });
          if (ttsRes.ok) {
            const ttsData = (await ttsRes.json()) as {
              audioBase64?: string;
              audioMimeType?: string;
            };
            if (ttsData.audioBase64) {
              neuralUrl = `data:${ttsData.audioMimeType || 'audio/mpeg'};base64,${ttsData.audioBase64}`;
              ttsAudioCacheRef.current.set(cacheKey, neuralUrl);
            }
          }
        }
        if (neuralUrl) {
          const audio = new Audio(neuralUrl);
          founderVoiceAudioRef.current = audio;
          audio.onended = () => {
            setPlayingFounderMsgId(null);
            founderVoiceAudioRef.current = null;
          };
          audio.onerror = () => {
            founderVoiceAudioRef.current = null;
            playBrowserFallback();
          };
          await audio.play();
          return;
        }
      } catch {
        // fallback cleanly below
      }
    }
    playBrowserFallback();
  };

  const handleSendOwnerVoiceToFounder = async () => {
    if (isSendingFounderVoice) return;
    let clipToSend = ownerRecordedClip;
    if (founderVoiceRecorderRef.current?.isRecording()) {
      const finalized = await founderVoiceRecorderRef.current.stopAndGetClip();
      if (finalized) {
        clipToSend = finalized;
        setOwnerRecordedClip(finalized);
      }
    }
    if (!ownerVoiceDraft.trim() && !clipToSend) {
      setFounderVoiceError(
        ownerLang === 'ur'
          ? 'مائیک بٹن دبا کر آواز ریکارڈ کریں یا اپنا پیغام لکھیں، پھر بھیجیں۔'
          : ownerLang === 'ar'
          ? 'اضغط على الميكروفون لتسجيل رسالة صوتية أو اكتب سؤالك أولاً ثم أرسل.'
          : 'Tap the Mic to record a voice note or type your message first, then send.'
      );
      return;
    }
    setFounderVoiceError(null);
    setIsSendingFounderVoice(true);

    try {
      let resolvedTranscript = ownerVoiceDraft.trim();
      let resolvedReplyText = ownerVoiceDraft.trim();
      let resolvedAudioDataUrl: string | null = null;
      let translationNotice: string | null = null;

      let resolvedDetectedLang = ownerLang === 'ur' ? 'Urdu' : ownerLang === 'ar' ? 'Arabic' : 'English';
      if (clipToSend?.base64) {
        resolvedAudioDataUrl = `data:${clipToSend.mimeType};base64,${clipToSend.base64}`;
      }

      // Translate Owner voice/text into Founder-readable English ('en-US') while preserving original words in originalText
      try {
        const trRes = await fetch('/api/translate-voice', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audioBase64: clipToSend?.base64,
            audioMimeType: clipToSend?.mimeType,
            text: ownerVoiceDraft.trim() || undefined,
            targetLocale: 'en-US',
            targetDialect: 'Founder English',
          }),
        });
        const trData = (await trRes.json().catch(() => ({}))) as {
          transcript?: string;
          translatedText?: string;
          detectedInputLanguage?: string;
          detectedLanguage?: string;
          translationError?: string;
          error?: string;
        };
        if (trRes.ok && trData.translatedText?.trim()) {
          if (trData.transcript?.trim()) resolvedTranscript = trData.transcript.trim();
          resolvedReplyText = trData.translatedText.trim();
          if (trData.detectedInputLanguage || trData.detectedLanguage) {
            resolvedDetectedLang =
              trData.detectedInputLanguage || trData.detectedLanguage || resolvedDetectedLang;
          }
        } else {
          translationNotice =
            trData.error ||
            trData.translationError ||
            `Voice translation unavailable (HTTP ${trRes.status}).`;
        }
      } catch {
        translationNotice = 'Translation server unreachable right now.';
      }

      if (translationNotice && clipToSend && !ownerVoiceDraft.trim()) {
        setFounderVoiceError(
          `${translationNotice} Your audio clip was saved — type a quick note or retry so the Founder sees translated text.`
        );
      }

      if (!resolvedTranscript) {
        resolvedTranscript = `Voice note (${clipToSend?.sizeKb || 0} KB Opus) in ${ownerLang.toUpperCase()}`;
      }
      if (!resolvedReplyText) {
        resolvedReplyText = resolvedTranscript;
      }

      const msgRes = await fetch('/api/voice/threads/message', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threadId: activeFounderVoiceThread.id,
          salonId: activeVoiceSalonId,
          salonName: currentSalon.name,
          ownerName: currentSalon.owner,
          city: currentSalon.location,
          targetLocale: activeOwnerVoiceLocale,
          senderRole: 'SALON_OWNER',
          originalText: resolvedTranscript,
          translatedText: resolvedReplyText,
          detectedInputLanguage: resolvedDetectedLang,
          audioDataUrl: resolvedAudioDataUrl || undefined,
          sizeBytes: ownerRecordedClip?.sizeBytes || 0,
        }),
      });

      if (!msgRes.ok) {
        const errPayload = (await msgRes.json().catch(() => ({}))) as { error?: string };
        setFounderVoiceError(
          errPayload.error || `Could not deliver voice note to Founder (HTTP ${msgRes.status}).`
        );
        return;
      }

      const saved = (await msgRes.json()) as {
        thread?: VoiceThreadItem;
        threads?: VoiceThreadItem[];
      };
      if (Array.isArray(saved.threads) && saved.threads.length > 0) {
        setSalonVoiceThreads(saved.threads);
        onVoiceThreadsUpdated?.(saved.threads);
      } else if (saved.thread) {
        const nextThreads = [
          saved.thread!,
          ...salonVoiceThreads.filter((t) => t.id !== saved.thread!.id),
        ];
        setSalonVoiceThreads(nextThreads);
        onVoiceThreadsUpdated?.(nextThreads);
      }

      setOwnerRecordedClip(null);
      setOwnerVoiceDraft('');
      setMaintToast('🎙️ Voice note delivered to Founder Voice Inbox.');
      window.setTimeout(() => setMaintToast(null), 3500);
    } catch {
      setFounderVoiceError('Unable to reach server to deliver voice note. Please check connection and retry.');
    } finally {
      setIsSendingFounderVoice(false);
    }
  };

  const [voiceLogs, setVoiceLogs] = useState<VoiceEventLog[]>([
    {
      id: 'vlog-init-ur',
      type: 'BOOKING',
      clientName: 'Bilal Ahmed',
      clientLang: 'ur',
      ownerVoiceLang: 'ur',
      summary: 'Urdu Pure-Human Voice · New 03:30 PM Booking (Master Aslam)',
      spokenText:
        'حمزہ صاحب! ماسٹر اسلم کی نئی اپائنٹمنٹ بلال احمد کے ساتھ ساڑھے تین بجے کنفرم ہو گئی ہے: ماسٹر ہیئر کٹ اور اسکن فیڈ۔',
      time: '03:15 PM',
      isUrgent: false,
    },
    {
      id: 'vlog-init-ar',
      type: 'REPLY_CONFIRMED',
      clientName: 'Saud Al-Rashid',
      clientLang: 'ar',
      ownerVoiceLang: 'ar',
      summary: 'Arabic Pure-Human Voice · Client Confirmed 04:00 PM Slot',
      spokenText:
        'أهلاً حمزة! أكد العميل سعود الراشد موعده الساعة الرابعة عصراً لقص الشعر وتحديد اللحية.',
      time: '02:40 PM',
      isUrgent: false,
    },
    {
      id: 'vlog-init-en',
      type: 'BOOKING',
      clientName: 'Daniel Evans',
      clientLang: 'en',
      ownerVoiceLang: 'en',
      summary: 'English Pure-Human Voice · Executive Cut & Beard Styling at 05:15 PM',
      spokenText:
        'Hamza, Tariq confirmed an appointment for Daniel Evans at 5:15 PM: Executive Haircut and Royal Beard Sculpt.',
      time: '02:10 PM',
      isUrgent: false,
    },
  ]);

  // 5th-of-Month Maintenance Cycle Stage & Automated Reminders
  const [maintCycleStage, setMaintCycleStage] = useState<MaintCycleStage>('PAID_ACTIVE');
  const [maintTid, setMaintTid] = useState<string | null>('EP-90482716455');
  const [isPayingMaint, setIsPayingMaint] = useState(false);
  const [maintPaidDate, setMaintPaidDate] = useState<string>('5 Nov 2026');
  const [maintToast, setMaintToast] = useState<string | null>(null);

  const isMaintenanceOverdue = maintCycleStage === 'OVERDUE_TIER_2';
  const isMaintPaid = maintCycleStage === 'PAID_ACTIVE';

  const [immutableProofs, setImmutableProofs] = useState<ImmutableProofRecord[]>([
    {
      id: 'PRF-9021',
      clientName: 'Saud Al-Rashid',
      clientPhone: '+971 50 3321988',
      clientLang: 'ar',
      services: ['Master Haircut & Skin Fade', 'Royal Beard Sculpt'],
      totalAmount: 1500,
      pricingModeLabel: 'Fri–Sun VIP Deal (25% OFF)',
      slotTime: '04:00 PM',
      confirmedMessage: 'نعم أؤكد الحجز والسعر 1500 للساعة 4:00 عصراً',
      timestamp: 'Today · 02:39 PM (Locked)',
      hash: 'SHA256:9F8A...C21E',
    },
  ]);

  // Sync salon defaults when switching test salons + enforce region language rules (PK/IN: EN/UR, MENA/EU: AR/EN/UR)
  useEffect(() => {
    const allowed = getAllowedDashboardLangs(currentSalon.phone, currentSalon.location);
    const preferred = allowed.includes(currentSalon.onboardingLanguage)
      ? currentSalon.onboardingLanguage
      : allowed[0];
    setOwnerLang(preferred);
    const cfg = getRegionFromPhone(currentSalon.phone, currentSalon.location);
    setSelectedUpgradeChannel(cfg.paymentChannels[0].id);
    setSelectedUpgradeTargetId(null);
    hasHydratedConciergeRef.current = false;
    seenLogIdsRef.current = new Set();
    seenApptIdsRef.current = new Set();

    let cancelled = false;
    const params = new URLSearchParams({
      salonName: currentSalon.name,
      ownerName: currentSalon.owner,
      whatsappPhone: currentSalon.phone,
    });
    fetch(`/api/salons/${encodeURIComponent(currentSalon.id)}/concierge-state?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: SalonConciergeStateResponse | null) => {
        if (!cancelled && data) {
          data.logs.forEach((l) => seenLogIdsRef.current.add(l.id));
          data.appointments.forEach((a) => seenApptIdsRef.current.add(a.id));
          hasHydratedConciergeRef.current = true;
          setConciergeState(data);
          if (data.settings?.salonCategory) {
            setPersistedCategory(data.settings.salonCategory);
          }
          if (data.settings?.salonId) {
            setSalonsState((prev) =>
              prev.map((s) => {
                if (s.id !== data.settings.salonId) return s;
                const mappedPlanId: ClientSalon['planId'] =
                  data.settings.packageTier === 'PRO++'
                    ? 'VIP'
                    : data.settings.packageTier === 'PRO'
                    ? 'GROWTH'
                    : data.settings.packageTier === 'STARTER'
                    ? 'STARTER'
                    : s.planId;
                return {
                  ...s,
                  name: data.settings.salonName || s.name,
                  owner: data.settings.ownerName || s.owner,
                  phone: data.settings.whatsappPhone || s.phone,
                  planId: mappedPlanId,
                };
              })
            );
          }
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [currentSalon.id, currentSalon.name, currentSalon.owner, currentSalon.onboardingLanguage, currentSalon.phone]);

  const [persistedCategory, setPersistedCategory] = useState<'MENS' | 'LADIES' | null>(null);
  const [showWalkInForm, setShowWalkInForm] = useState(false);
  const [walkInName, setWalkInName] = useState('');
  const [walkInPhone, setWalkInPhone] = useState('');
  const [walkInService, setWalkInService] = useState('');
  const [walkInEta, setWalkInEta] = useState('15');

  const [showBridalForm, setShowBridalForm] = useState(false);
  const [bridalName, setBridalName] = useState('');
  const [bridalPhone, setBridalPhone] = useState('');
  const [bridalPackage, setBridalPackage] = useState('Signature Bridal Makeup & Styling');
  const [bridalEventDate, setBridalEventDate] = useState('');
  const [bridalTotal, setBridalTotal] = useState('35000');
  const [bridalAdvance, setBridalAdvance] = useState('15000');
  const [bridalHomeService, setBridalHomeService] = useState(false);

  const [showPackageForm, setShowPackageForm] = useState(false);
  const [pkgClientName, setPkgClientName] = useState('');
  const [pkgTitle, setPkgTitle] = useState('');
  const [pkgSessions, setPkgSessions] = useState('5');
  const [pkgPrice, setPkgPrice] = useState('10000');
  const [isSavingOpsCard, setIsSavingOpsCard] = useState(false);

  const handleUpdateSalonCategory = async (nextCategory: 'MENS' | 'LADIES') => {
    setPersistedCategory(nextCategory);
    try {
      localStorage.setItem('wcl_salon_category', nextCategory);
    } catch {}
    try {
      const res = await fetch(
        `/api/salons/${encodeURIComponent(currentSalon.id)}/retention-settings`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ salonCategory: nextCategory }),
        }
      );
      if (res.ok) {
        const nextState = (await res.json()) as SalonConciergeStateResponse;
        setConciergeState(nextState);
      }
      setMaintToast(
        nextCategory === 'LADIES'
          ? '✓ Switched to Ladies Beauty Parlor Mode (Female-Only Privacy & Bridal Tracker active).'
          : '✓ Switched to Men’s Salon & Barbershop Mode.'
      );
      setTimeout(() => setMaintToast(null), 4000);
    } catch {
      setMaintToast('Updated category locally.');
    }
  };

  const handleAddWalkIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walkInName.trim() || isSavingOpsCard) return;
    setIsSavingOpsCard(true);
    try {
      const res = await fetch(
        `/api/salons/${encodeURIComponent(currentSalon.id)}/walkin-queue`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientName: walkInName.trim(),
            phone: walkInPhone.trim(),
            service: walkInService.trim() || services[0]?.name || 'Haircut & Styling',
            assignedStaff: barbersList[0] || 'Next Available',
            etaMinutes: parseInt(walkInEta, 10) || 15,
          }),
        }
      );
      if (res.ok) {
        const nextState = (await res.json()) as SalonConciergeStateResponse;
        setConciergeState(nextState);
        setWalkInName('');
        setWalkInPhone('');
        setWalkInService('');
        setShowWalkInForm(false);
        setMaintToast('✓ Walk-in guest added to live queue.');
        setTimeout(() => setMaintToast(null), 3500);
      }
    } finally {
      setIsSavingOpsCard(false);
    }
  };

  const handleUpdateWalkInStatus = async (
    itemId: string,
    status: 'WAITING' | 'NOTIFIED' | 'SEATED'
  ) => {
    try {
      const res = await fetch(
        `/api/salons/${encodeURIComponent(currentSalon.id)}/walkin-queue/${encodeURIComponent(itemId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        }
      );
      if (res.ok) {
        const nextState = (await res.json()) as SalonConciergeStateResponse;
        setConciergeState(nextState);
        setMaintToast(
          status === 'NOTIFIED'
            ? '📲 Turn notification logged for guest.'
            : '✓ Walk-in guest seated.'
        );
        setTimeout(() => setMaintToast(null), 3000);
      }
    } catch {}
  };

  const handleAddBridalBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bridalName.trim() || isSavingOpsCard) return;
    setIsSavingOpsCard(true);
    try {
      const res = await fetch(
        `/api/salons/${encodeURIComponent(currentSalon.id)}/bridal-bookings`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            brideOrEventName: bridalName.trim(),
            phone: bridalPhone.trim() || currentSalon.phone,
            packageName: bridalPackage.trim() || 'Bridal Suite',
            eventDate: bridalEventDate.trim() || 'Upcoming Event',
            totalAmount: parseInt(bridalTotal, 10) || 35000,
            advancePaid: parseInt(bridalAdvance, 10) || 0,
            assignedStylist: barbersList[0] || 'Lead Stylist',
            homeService: bridalHomeService,
          }),
        }
      );
      if (res.ok) {
        const nextState = (await res.json()) as SalonConciergeStateResponse;
        setConciergeState(nextState);
        setBridalName('');
        setBridalPhone('');
        setBridalEventDate('');
        setShowBridalForm(false);
        setMaintToast('✓ Bridal / Event booking advance locked.');
        setTimeout(() => setMaintToast(null), 3500);
      }
    } finally {
      setIsSavingOpsCard(false);
    }
  };

  const handleSettleBridalBooking = async (bookingId: string) => {
    try {
      const res = await fetch(
        `/api/salons/${encodeURIComponent(currentSalon.id)}/bridal-bookings/${encodeURIComponent(bookingId)}/settle`,
        { method: 'POST' }
      );
      if (res.ok) {
        const nextState = (await res.json()) as SalonConciergeStateResponse;
        setConciergeState(nextState);
        setMaintToast('✓ Remaining bridal balance marked settled.');
        setTimeout(() => setMaintToast(null), 3500);
      }
    } catch {}
  };

  const handleAddServicePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pkgClientName.trim() || !pkgTitle.trim() || isSavingOpsCard) return;
    setIsSavingOpsCard(true);
    try {
      const res = await fetch(
        `/api/salons/${encodeURIComponent(currentSalon.id)}/packages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientName: pkgClientName.trim(),
            packageTitle: pkgTitle.trim(),
            totalSessions: parseInt(pkgSessions, 10) || 5,
            pricePaid: parseInt(pkgPrice, 10) || 5000,
          }),
        }
      );
      if (res.ok) {
        const nextState = (await res.json()) as SalonConciergeStateResponse;
        setConciergeState(nextState);
        setPkgClientName('');
        setPkgTitle('');
        setShowPackageForm(false);
        setMaintToast('✓ Prepaid session pass issued.');
        setTimeout(() => setMaintToast(null), 3500);
      }
    } finally {
      setIsSavingOpsCard(false);
    }
  };

  const handleConsumePackageSession = async (pkgId: string) => {
    try {
      const res = await fetch(
        `/api/salons/${encodeURIComponent(currentSalon.id)}/packages/${encodeURIComponent(pkgId)}/use-session`,
        { method: 'POST' }
      );
      if (res.ok) {
        const nextState = (await res.json()) as SalonConciergeStateResponse;
        setConciergeState(nextState);
        setMaintToast('✓ 1 prepaid session checked off.');
        setTimeout(() => setMaintToast(null), 3000);
      }
    } catch {}
  };

  const handleResolveOwnerAlert = async (alertId: string) => {
    try {
      const res = await fetch(
        `/api/salons/${encodeURIComponent(currentSalon.id)}/alerts/${encodeURIComponent(alertId)}/resolve`,
        { method: 'POST' }
      );
      if (!res.ok) throw new Error('Failed to resolve alert');
      const nextState = (await res.json()) as SalonConciergeStateResponse;
      setConciergeState(nextState);
      setMaintToast('✓ Low-rating intervention alert marked resolved & logged.');
      setTimeout(() => setMaintToast(null), 4000);
    } catch {
      setMaintToast('Could not update alert status.');
    }
  };

  // Free $0/mo Web Audio Alert Chime with iOS/Android tap unlock + Rush-Hour Loudspeaker Boost
  const ensureUnlockedAudioContext = async (): Promise<AudioContext | null> => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      if (!sharedAudioCtxRef.current || sharedAudioCtxRef.current.state === 'closed') {
        sharedAudioCtxRef.current = new AudioCtx();
      }
      if (sharedAudioCtxRef.current.state === 'suspended') {
        await sharedAudioCtxRef.current.resume();
      }
      if (sharedAudioCtxRef.current.state === 'running') {
        setIsAudioUnlocked(true);
      }
      return sharedAudioCtxRef.current;
    } catch {
      return null;
    }
  };

  const handleUnlockMobileAudio = async () => {
    const ctx = await ensureUnlockedAudioContext();
    if (ctx) {
      playFreeNotificationChime(false);
    }
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const silentUtt = new SpeechSynthesisUtterance('');
        silentUtt.volume = 0;
        window.speechSynthesis.speak(silentUtt);
      }
    } catch {}
    setIsAudioUnlocked(true);
    setMaintToast('🔊 Hands-free mobile chimes & voice announcements enabled.');
    setTimeout(() => setMaintToast(null), 3500);
  };

  const playFreeNotificationChime = (isBoost = false) => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = sharedAudioCtxRef.current && sharedAudioCtxRef.current.state !== 'closed'
        ? sharedAudioCtxRef.current
        : new AudioCtx();
      sharedAudioCtxRef.current = ctx;
      if (ctx.state === 'suspended') {
        void ctx.resume().catch(() => {});
      }
      if (ctx.state === 'running') {
        setIsAudioUnlocked(true);
      }
      const now = ctx.currentTime;
      const boostGain = isBoost ? 2.5 : 1.0;

      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = isBoost ? 'triangle' : 'sine';
      osc1.frequency.setValueAtTime(660, now);
      gain1.gain.setValueAtTime(0.08 * boostGain, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.18);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, now + 0.14);
      gain2.gain.setValueAtTime(0.09 * boostGain, now + 0.14);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.14);
      osc2.stop(now + 0.36);

      // Third piercing harmonic for noisy barber shop rush hours
      if (isBoost) {
        const osc3 = ctx.createOscillator();
        const gain3 = ctx.createGain();
        osc3.type = 'sine';
        osc3.frequency.setValueAtTime(1100, now + 0.28);
        gain3.gain.setValueAtTime(0.12 * boostGain, now + 0.28);
        gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.52);
        osc3.connect(gain3);
        gain3.connect(ctx.destination);
        osc3.start(now + 0.28);
        osc3.stop(now + 0.52);
      }
    } catch {
      // Ignore audio policy block
    }
  };

  // Stop all active human neural MP3 or WebSpeech announcements cleanly
  const stopSpeaking = () => {
    activeSpeakTokenRef.current += 1;
    if (speakDelayTimerRef.current) {
      window.clearTimeout(speakDelayTimerRef.current);
      speakDelayTimerRef.current = null;
    }
    if (speechKeepAliveRef.current) {
      window.clearInterval(speechKeepAliveRef.current);
      speechKeepAliveRef.current = null;
    }
    if (activeTtsAudioRef.current) {
      try {
        activeTtsAudioRef.current.pause();
        activeTtsAudioRef.current.currentTime = 0;
      } catch {}
      activeTtsAudioRef.current = null;
    }
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    } catch {
      // Ignore
    }
    setCurrentlySpeakingText(null);
  };

  // Pure Human Neural Voice Engine (/api/voice/tts -> ur-PK-AsadNeural / ar-AE-HamdanNeural / en-US-AndrewNeural)
  // Retries once for zero-drop pure human speech; manual log replay always speaks on click
  const speakHandsFree = (text: string, lang: VoiceLang = ownerLang, forceManualReplay = false) => {
    if (!text.trim()) return;
    if (!forceManualReplay && (!isVoiceEnabled || isFounderInspector || isCounterSleepingRef.current)) return;
    stopSpeaking();
    const speakToken = activeSpeakTokenRef.current;

    playFreeNotificationChime(isLoudspeakerBoostActive);
    setCurrentlySpeakingText(text);

    const strictLangCode = lang === 'ur' ? 'ur-PK' : lang === 'ar' ? 'ar-AE' : 'en-US';
    const strictPrefix = lang === 'ur' ? 'ur' : lang === 'ar' ? 'ar' : 'en';

    const playBrowserFallback = () => {
      if (activeSpeakTokenRef.current !== speakToken) return;
      try {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          const voices = window.speechSynthesis.getVoices() || [];
          const matchedVoice =
            voices.find((v) => v.lang.toLowerCase().startsWith(strictPrefix)) ||
            (strictPrefix === 'ur'
              ? voices.find((v) => v.lang.toLowerCase().startsWith('hi'))
              : undefined);

          // Split into natural clauses so Chrome/Android never drops mid-sentence on long Urdu/Arabic alerts
          const clauses = text
            .split(/(?<=[.!?۔،؟:])\s+/)
            .map((c) => c.trim())
            .filter(Boolean);
          const parts = clauses.length > 0 ? clauses : [text];

          // Chrome pause/resume keep-alive workaround prevents 15s silent cutoff bug
          speechKeepAliveRef.current = window.setInterval(() => {
            try {
              if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
                window.speechSynthesis.pause();
                window.speechSynthesis.resume();
              }
            } catch {}
          }, 5000);

          let idx = 0;
          const speakNext = () => {
            if (activeSpeakTokenRef.current !== speakToken) return;
            if (idx >= parts.length) {
              if (speechKeepAliveRef.current) {
                window.clearInterval(speechKeepAliveRef.current);
                speechKeepAliveRef.current = null;
              }
              setCurrentlySpeakingText((prev) => (prev === text ? null : prev));
              return;
            }
            const u = new SpeechSynthesisUtterance(parts[idx++]);
            if (matchedVoice) u.voice = matchedVoice;
            u.lang = strictPrefix === 'ar' ? 'ar-SA' : strictLangCode;
            u.rate = isLoudspeakerBoostActive ? 0.92 : 0.96;
            u.pitch = 1.0;
            u.volume = 1.0;
            u.onend = () => speakNext();
            u.onerror = () => speakNext();
            window.speechSynthesis.speak(u);
          };
          speakNext();

          const safetyMs = Math.max(25000, text.length * 160);
          window.setTimeout(() => {
            if (activeSpeakTokenRef.current === speakToken) {
              stopSpeaking();
            }
          }, safetyMs);
          return;
        }
      } catch {
        // ignore fallback errors
      }
      window.setTimeout(() => {
        setCurrentlySpeakingText((prev) => (prev === text ? null : prev));
      }, 6000);
    };

    speakDelayTimerRef.current = window.setTimeout(async () => {
      if (activeSpeakTokenRef.current !== speakToken) return;
      const cacheKey = `${strictLangCode}::${text}`;
      try {
        let dataUrl = ttsAudioCacheRef.current.get(cacheKey);
        if (!dataUrl) {
          for (let attempt = 0; attempt < 2 && !dataUrl; attempt++) {
            try {
              const res = await fetch('/api/voice/tts', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, locale: strictLangCode }),
              });
              if (res.ok) {
                const data = (await res.json()) as {
                  audioBase64?: string;
                  audioMimeType?: string;
                };
                if (data.audioBase64) {
                  dataUrl = `data:${data.audioMimeType || 'audio/mpeg'};base64,${data.audioBase64}`;
                  ttsAudioCacheRef.current.set(cacheKey, dataUrl);
                }
              }
            } catch {
              // Retry once automatically
            }
            if (!dataUrl && attempt === 0) {
              await new Promise((r) => setTimeout(r, 350));
            }
          }
        }

        if (activeSpeakTokenRef.current !== speakToken) return;
        if (dataUrl) {
          const audio = new Audio(dataUrl);
          activeTtsAudioRef.current = audio;
          audio.playbackRate = isLoudspeakerBoostActive ? 0.96 : 1.0;
          audio.onended = () => {
            if (activeSpeakTokenRef.current === speakToken) {
              activeTtsAudioRef.current = null;
              setCurrentlySpeakingText((prev) => (prev === text ? null : prev));
            }
          };
          audio.onerror = () => {
            if (activeSpeakTokenRef.current === speakToken) {
              activeTtsAudioRef.current = null;
              playBrowserFallback();
            }
          };
          await audio.play();
          return;
        }
      } catch {
        // Fallback smoothly below
      }
      playBrowserFallback();
    }, 320);
  };

  const toggleScreenWakeLock = async () => {
    if (isWakeLockActive) {
      try {
        await wakeLockRef.current?.release?.();
      } catch {
        // Ignore
      }
      wakeLockRef.current = null;
      setIsWakeLockActive(false);
      setWakeLockNote('Counter Screen-Wake Lock paused. Tap to re-enable.');
      setTimeout(() => setWakeLockNote(null), 3500);
      return;
    }

    try {
      const nav = navigator as Navigator & {
        wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
      };
      if (nav.wakeLock) {
        wakeLockRef.current = await nav.wakeLock.request('screen');
      }
      setIsWakeLockActive(true);
      setWakeLockNote(
        '⚡ Counter Screen-Wake Active ($0/mo): Phone stays awake so loud announcements & client replies fire hands-free.'
      );
      setTimeout(() => setWakeLockNote(null), 5000);
    } catch {
      setIsWakeLockActive(true);
      setWakeLockNote(
        '⚡ Counter Standby Active: Screen will stay awake at your station for zero-touch voice alerts.'
      );
      setTimeout(() => setWakeLockNote(null), 5000);
    }
  };

  // Auto-engage Counter Wake Lock upon user interaction
  useEffect(() => {
    if (typeof window === 'undefined' || isFounderInspector) return;
    const autoEngageWake = async () => {
      try {
        const nav = navigator as Navigator & {
          wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
        };
        if (nav.wakeLock && !wakeLockRef.current) {
          wakeLockRef.current = await nav.wakeLock.request('screen');
          setIsWakeLockActive(true);
        }
      } catch {
        setIsWakeLockActive(true);
      }
    };

    autoEngageWake();
    window.addEventListener('click', autoEngageWake, { once: true });
    window.addEventListener('touchstart', autoEngageWake, { once: true });

    return () => {
      window.removeEventListener('click', autoEngageWake);
      window.removeEventListener('touchstart', autoEngageWake);
    };
  }, [isFounderInspector]);

  // Sync live counter controls to Hamburger Sidebar & handle unified Wake ON/OFF + AUX + Speaker Test actions
  const lastHardwareSyncKeyRef = useRef<string>('');
  useEffect(() => {
    const syncKey = `${isWakeLockActive}|${isLoudspeakerBoostActive}|${isCounterSleeping}|${overnightQueue.length}|${hasFounderVoiceReply}|${allowedLangsKey}|${ownerLang}`;
    if (lastHardwareSyncKeyRef.current === syncKey) return;
    lastHardwareSyncKeyRef.current = syncKey;
    onHardwareStatusSync?.({
      isWakeLockActive,
      isLoudspeakerBoostActive,
      isCounterSleeping,
      overnightCount: overnightQueue.length,
      hasFounderVoiceReply,
      allowedLangs,
      ownerLang,
    });
  }, [
    isWakeLockActive,
    isLoudspeakerBoostActive,
    isCounterSleeping,
    overnightQueue.length,
    hasFounderVoiceReply,
    allowedLangs,
    allowedLangsKey,
    ownerLang,
    onHardwareStatusSync,
  ]);

  const lastHandledHardwareSeqRef = useRef<number>(0);
  useEffect(() => {
    if (!externalHardwareAction || externalHardwareAction.seq === lastHandledHardwareSeqRef.current) {
      return;
    }
    lastHandledHardwareSeqRef.current = externalHardwareAction.seq;
    if (externalHardwareAction.type === 'WAKE') {
      void handleToggleCounterSleep();
    } else if (externalHardwareAction.type === 'AUX') {
      const next = !isLoudspeakerBoostActive;
      setIsLoudspeakerBoostActive(next);
      setMaintToast(
        next
          ? '📢 Loudspeaker Boost ON: Optimized for wired AUX (~50% less battery) or paired Bluetooth.'
          : '📢 Loudspeaker Boost set to standard output.'
      );
      setTimeout(() => setMaintToast(null), 4000);
    } else if (externalHardwareAction.type === 'TEST_SPEAKER') {
      void handleUnlockMobileAudio();
      const testLine =
        ownerLang === 'ur'
          ? 'اسپیکر ٹیسٹ کامیاب! آپ کا کاؤنٹر واٹس ایپ بوٹ 24/7 آن ہے۔'
          : ownerLang === 'ar'
          ? 'تم اختبار السماعة بنجاح! نظام الواتساب يعمل على مدار الساعة.'
          : 'Speaker test successful. Your WorkCraft counter audio and 24/7 booking system are ready.';
      speakHandsFree(testLine, ownerLang);
    }
  });

  const [salonContacts] = useState<Contact[]>(() => {
    const all = generate214Contacts();
    const pk = all.filter((c) => c.phone.startsWith('+92'));
    const uae = all.filter((c) => c.phone.startsWith('+971'));

    const internationalSamples: Contact[] = [
      { id: 'cnt-intl-1', name: 'Zayed Al-Hashmi', phone: '+971 50 8923411', city: 'Dubai', country: 'AE', language: 'ar', tags: ['VIP Lounge'], optOut: false, lastVisit: '2026-10-24', totalVisits: 14 },
      { id: 'cnt-intl-2', name: 'Omar Al-Ameri', phone: '+966 54 1122334', city: 'Riyadh', country: 'AE', language: 'ar', tags: ['Executive'], optOut: false, lastVisit: '2026-10-22', totalVisits: 9 },
      { id: 'cnt-intl-3', name: 'Rashid Al-Falasi', phone: '+965 99 887766', city: 'Kuwait City', country: 'AE', language: 'ar', tags: ['Regular'], optOut: false, lastVisit: '2026-10-20', totalVisits: 6 },
      { id: 'cnt-intl-4', name: 'Oliver James', phone: '+44 7911 123456', city: 'London', country: 'PK', language: 'en', tags: ['Expat Client'], optOut: false, lastVisit: '2026-10-18', totalVisits: 4 },
      { id: 'cnt-intl-5', name: 'Alexander Wright', phone: '+1 212 555 0198', city: 'New York', country: 'PK', language: 'en', tags: ['VIP Diplomat'], optOut: false, lastVisit: '2026-10-17', totalVisits: 5 },
      { id: 'cnt-intl-6', name: 'Fahad Mehmood', phone: '+91 98200 12345', city: 'Mumbai', country: 'PK', language: 'ur', tags: ['Hinglish Dialect'], optOut: false, lastVisit: '2026-10-16', totalVisits: 3 },
    ];

    return [
      pk[0] || { id: 'c-1', name: 'Bilal Ahmed', phone: '+92 300 1234567', city: 'Lahore', country: 'PK', language: 'ur', tags: ['VIP Regular'], optOut: false, lastVisit: '2026-10-25', totalVisits: 8 },
      internationalSamples[0],
      internationalSamples[3],
      pk[1] || { id: 'c-2', name: 'Hamza Malik', phone: '+92 321 9876543', city: 'Islamabad', country: 'PK', language: 'ur', tags: ['Weekend Grooming'], optOut: false, lastVisit: '2026-10-23', totalVisits: 11 },
      internationalSamples[1],
      internationalSamples[4],
      internationalSamples[5],
      internationalSamples[2],
      ...pk.slice(2, 24),
      ...uae.slice(0, 12),
    ];
  });

  const activeSalonProfile: SalonProfile = {
    id: `salon-${currentSalon.id}`,
    name: currentSalon.name,
    branch: currentSalon.location,
    city: currentSalon.location.includes('Karachi')
      ? 'Karachi'
      : currentSalon.location.includes('Dubai')
      ? 'Dubai'
      : currentSalon.location.includes('London')
      ? 'London'
      : 'Lahore',
    country: currentSalon.phone.startsWith('+92') ? 'Pakistan' : 'UAE',
    currency: currentSalon.phone.startsWith('+92') ? 'PKR' : 'AED',
    phone: currentSalon.phone,
    ownerName: currentSalon.owner,
    ownerPhone: currentSalon.phone,
    packageTier:
      currentSalon.planId === 'STARTER'
        ? 'essential'
        : currentSalon.planId === 'GROWTH'
        ? 'growth'
        : 'enterprise',
    setupFeePaid: true,
    monthlyFee: currentSalon.maint,
    paymentStatus: isMaintenanceOverdue ? 'overdue_red_alert' : 'paid',
    dueDate: '5th of Every Month',
    lastPaymentDate: maintPaidDate,
    daysOverdue: isMaintenanceOverdue ? 1 : 0,
    gracePeriodDaysLeft: maintCycleStage === 'STAGE_3_DAY_5_FINAL' ? 0 : 2,
    isLockedOut: false,
  };

  const handleAutoClearMaintenance = async () => {
    setIsPayingMaint(true);
    const tid = `${currentSalon.phone.startsWith('+92') ? 'EP' : 'ST'}-${Math.floor(
      10000000000 + Math.random() * 90000000000
    )}`;
    try {
      await fetch(`/api/salons/${encodeURIComponent(currentSalon.id)}/payments/maintenance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salonName: currentSalon.name,
          amount: currentSalon.maint,
          currency: currentSalon.phone.startsWith('+92') ? 'PKR' : regionConfig.currency,
          method: regionConfig.paymentChannels[0]?.label || 'Auto-Match Webhook',
          tid,
        }),
      });
    } catch {
      // non-blocking offline/static fallback
    }
    setIsPayingMaint(false);
    setMaintCycleStage('PAID_ACTIVE');
    setMaintTid(tid);
    setMaintPaidDate(
      new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
    );
    const localizedSuccess: Record<VoiceLang, string> = {
      en: `Auto-Match Cleared: ${regionConfig.symbol}${currentSalon.maint.toLocaleString()} paid from ${currentSalon.phone}. Metrics Box unlocked & Tier-1 Priority restored!`,
      ur: `ادائیگی خودکار تصدیق ہو گئی: ${regionConfig.symbol}${currentSalon.maint.toLocaleString()} (${currentSalon.phone})۔ آپ کا میٹرکس باکس اور Tier-1 ترجیحی نظام بحال کر دیا گیا ہے!`,
      ar: `تم التحقق التلقائي من الدفع: ${regionConfig.symbol}${currentSalon.maint.toLocaleString()} (${currentSalon.phone}). تم فتح الإحصائيات واستعادة الأولوية الفورية!`,
    };
    setMaintToast(localizedSuccess[ownerLang]);
    setTimeout(() => setMaintToast(null), 6000);
  };

  const handleConfirmMaintPayment = async () => {
    setMaintModalError(null);
    const chosenTid = maintPaymentTidInput.trim();
    if (!chosenTid || chosenTid.replace(/[^a-zA-Z0-9]/g, '').length < 6) {
      setMaintModalError(
        ownerLang === 'ur'
          ? 'ادائیگی کی تصدیق کے لیے درست ٹرانزیکشن آئی ڈی (TID کم از کم 6 حروف/ہندسے) درج کریں۔'
          : ownerLang === 'ar'
          ? 'يرجى إدخال رقم معاملة صحيح (TID لا يقل عن 6 أحرف/أرقام) للتحقق.'
          : 'Please enter a valid payment Transaction ID / reference (min 6 characters) to verify payment to WorkCraft Official Account.'
      );
      return;
    }

    setIsPayingMaint(true);
    const channelName =
      regionConfig.paymentChannels.find((c) => c.id === maintPaymentChannel)?.label ||
      maintPaymentChannel;

    try {
      const res = await fetch(
        `/api/salons/${encodeURIComponent(currentSalon.id)}/payments/maintenance`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            salonName: currentSalon.name,
            packageId: currentSalon.planId,
            amount: currentSalon.maint,
            currency: currentSalon.phone.startsWith('+92') ? 'PKR' : regionConfig.currency,
            method: channelName,
            tid: chosenTid,
          }),
        }
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        state?: SalonConciergeStateResponse;
      };
      if (!res.ok) {
        setIsPayingMaint(false);
        setMaintModalError(
          data?.error || 'Transaction verification rejected by WorkCraft payment server.'
        );
        return;
      }
      if (data?.state) setConciergeState(data.state);
    } catch {
      setIsPayingMaint(false);
      setMaintModalError('Unable to reach payment verification server. Please retry.');
      return;
    }

    setIsPayingMaint(false);
    setIsMaintPaymentModalOpen(false);
    setMaintModalError(null);
    setMaintCycleStage('PAID_ACTIVE');
    setMaintTid(chosenTid);
    setMaintPaidDate(
      new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
    );
    setMaintPaymentTidInput('');

    const i18n = MAINT_MODAL_I18N[ownerLang];
    const localizedGreeting = i18n.whatsappNotice(
      currentSalon.owner,
      currentSalon.name,
      regionConfig.symbol,
      currentSalon.maint,
      channelName,
      chosenTid
    );

    setMaintToast(
      ownerLang === 'ur'
        ? `ادائیگی تصدیق ہو گئی: ${regionConfig.symbol}${currentSalon.maint.toLocaleString()} (${chosenTid})۔ لائیو میٹرکس اور Tier-1 ترجیح بحال!`
        : ownerLang === 'ar'
        ? `تم تأكيد سداد الصيانة: ${regionConfig.symbol}${currentSalon.maint.toLocaleString()} (${chosenTid}). تم فتح الإحصائيات الفورية والأولوية!`
        : `Maintenance Paid: ${regionConfig.symbol}${currentSalon.maint.toLocaleString()} (${chosenTid}). Live metrics & Tier-1 priority restored!`
    );

    setWhatsAppReceiptNotice({
      title:
        ownerLang === 'ur'
          ? 'واٹس ایپ رسید · مینٹیننس فیس وصولی'
          : ownerLang === 'ar'
          ? 'إشعار واتساب · سداد رسوم الصيانة بنجاح'
          : 'WhatsApp Receipt · Maintenance Payment Cleared',
      body: localizedGreeting,
      phone: currentSalon.phone,
      timestamp: 'Just now',
    });

    setTimeout(() => setMaintToast(null), 8000);
  };

  const handleConfirmPackageUpgrade = async () => {
    if (!selectedUpgradeTargetId) return;
    setUpgradeModalError(null);
    const targetPkg = regionConfig.packages.find((p) => p.id === selectedUpgradeTargetId);
    if (!targetPkg) return;
    const differenceAmount = Math.max(0, targetPkg.setupFee - currentPackage.setupFee);
    const chosenTid = upgradeTidInput.trim();
    if (!chosenTid || chosenTid.replace(/[^a-zA-Z0-9]/g, '').length < 6) {
      setUpgradeModalError(
        ownerLang === 'ur'
          ? 'اپگریڈ کی تصدیق کے لیے درست ٹرانزیکشن آئی ڈی (TID کم از کم 6 حروف/ہندسے) درج کریں۔'
          : ownerLang === 'ar'
          ? 'يرجى إدخال رقم معاملة صحيح (TID لا يقل عن 6 أحرف/أرقام) لتأكيد الترقية.'
          : 'Please enter a valid payment Transaction ID / reference (min 6 characters) to confirm upgrade.'
      );
      return;
    }
    const backendTier =
      targetPkg.id === 'STARTER' ? 'STARTER' : targetPkg.id === 'GROWTH' ? 'PRO' : 'PRO++';

    setIsProcessingUpgrade(true);
    try {
      const res = await fetch(
        `/api/salons/${encodeURIComponent(currentSalon.id)}/payments/upgrade`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            salonName: currentSalon.name,
            packageTier: backendTier,
            previousPlanId: currentPackage.id,
            targetPlanId: targetPkg.id,
            differenceAmount,
            currency: currentSalon.phone.startsWith('+92') ? 'PKR' : regionConfig.currency,
            method: selectedUpgradeChannel,
            tid: chosenTid,
          }),
        }
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        state?: SalonConciergeStateResponse;
      };
      if (!res.ok) {
        setIsProcessingUpgrade(false);
        setUpgradeModalError(
          data?.error || 'Upgrade payment verification rejected by WorkCraft payment server.'
        );
        return;
      }
      if (data?.state) setConciergeState(data.state);
    } catch {
      setIsProcessingUpgrade(false);
      setUpgradeModalError('Unable to reach payment verification server. Please retry.');
      return;
    }

    setSalonsState((prev) =>
      prev.map((s) =>
        s.id === currentSalon.id
          ? { ...s, planId: targetPkg.id, plan: targetPkg.name, maint: targetPkg.monthlyMaint }
          : s
      )
    );
    setIsProcessingUpgrade(false);
    setIsUpgradeModalOpen(false);
    setUpgradeModalError(null);
    setSelectedUpgradeTargetId(null);
    setUpgradeTidInput('');

    const i18n = UPGRADE_MODAL_I18N[ownerLang];
    const localizedPkgTitle = getLocalizedPackageName(targetPkg.name, ownerLang);
    const isDomPk = regionConfig.currency === 'PKR';
    const unlockedFeaturesList = getLocalizedPackageFeatures(targetPkg.id, ownerLang, isDomPk)
      .slice(0, 3)
      .map((f) => `• ${f.title}`)
      .join('\n');

    setMaintToast(i18n.successToast(localizedPkgTitle, regionConfig.symbol, differenceAmount));

    const baseGreeting = i18n.whatsappGreeting(
      currentSalon.owner,
      currentSalon.name,
      localizedPkgTitle,
      regionConfig.symbol,
      differenceAmount,
      chosenTid
    );
    const unlockedHeading =
      ownerLang === 'ur'
        ? '\n\nنئے فعال شدہ فیچرز:'
        : ownerLang === 'ar'
        ? '\n\nالمزايا الجديدة المفعلة الآن:'
        : '\n\nNewly Unlocked Features:';
    const greetingMsg = `${baseGreeting}${unlockedHeading}\n${unlockedFeaturesList}`;

    setWhatsAppReceiptNotice({
      title:
        ownerLang === 'ur'
          ? 'واٹس ایپ نوٹیفکیشن · پیکیج اپگریڈ تصدیق'
          : ownerLang === 'ar'
          ? 'إشعار واتساب · تأكيد ترقية الباقة بنجاح'
          : 'WhatsApp Notice · Package Upgrade Confirmed',
      body: greetingMsg,
      phone: currentSalon.phone,
      timestamp: 'Just now',
    });

    setTimeout(() => setMaintToast(null), 8000);
  };

  // Live Queue State (scheduledEndMs set in near future so initial slots stay active until 15m post-end)
  const [bookings, setBookings] = useState<BookingRecord[]>(() => {
    const now = Date.now();
    return [
      {
        id: 'BK-101',
        clientName: 'Bilal Ahmed',
        barberName: 'Master Aslam',
        phone: '+92 300 1234567',
        service: 'Master Haircut & Skin Fade',
        price: 1200,
        timeSlot: '03:30 PM',
        durationMins: 40,
        scheduledEndMs: now + 45 * 60 * 1000,
        sourceType: 'WHATSAPP_BOT',
        status: 'CONFIRMED',
      },
      {
        id: 'BK-102',
        clientName: 'Hamza Malik',
        barberName: 'Tariq Mehmood',
        phone: '+92 321 9876543',
        service: 'Royal Beard Sculpt & Ozone Steam',
        price: 800,
        timeSlot: '04:15 PM',
        durationMins: 30,
        scheduledEndMs: now + 20 * 60 * 1000,
        sourceType: 'WHATSAPP_BOT',
        status: 'IN_CHAIR',
      },
      {
        id: 'BK-103',
        clientName: 'Dr. Usman Qureshi',
        barberName: 'Master Aslam',
        phone: '+92 333 4567890',
        service: 'Charcoal Deep Detox Facial',
        price: 2500,
        timeSlot: '05:00 PM',
        durationMins: 45,
        scheduledEndMs: now + 90 * 60 * 1000,
        sourceType: 'WHATSAPP_BOT',
        status: 'CONFIRMED',
      },
      {
        id: 'BK-104',
        clientName: 'Saad Farooq',
        barberName: 'Bilal Tariq',
        phone: '+92 345 6789012',
        service: 'Haircut + Beard Styling Combo',
        price: 1800,
        timeSlot: '05:45 PM',
        durationMins: 50,
        scheduledEndMs: now - 30 * 60 * 1000,
        sourceType: 'WHATSAPP_BOT',
        status: 'COMPLETED',
      },
    ];
  });

  const resolvedCategory: 'MENS' | 'LADIES' =
    conciergeState?.settings?.salonCategory ||
    persistedCategory ||
    onboardedData?.salonCategory ||
    salonCategory ||
    (typeof window !== 'undefined' && localStorage.getItem('wcl_salon_category') === 'LADIES'
      ? 'LADIES'
      : currentSalon.name.toLowerCase().includes('parlor') ||
        currentSalon.name.toLowerCase().includes('ladies') ||
        currentSalon.name.toLowerCase().includes('beauty')
      ? 'LADIES'
      : 'MENS');
  const isLadies = resolvedCategory === 'LADIES';

  // Rate Card State strictly locked to the onboarded category (Men's Salon vs Ladies Parlor)
  const [services, setServices] = useState<
    Array<{ id: string; name: string; durationMins: number; price: number; active: boolean }>
  >(() => {
    if (onboardedData?.services && onboardedData.services.length > 0) {
      return onboardedData.services.map((s) => {
        if (s.translations && (s.translations.ur || s.translations.ar)) {
          SERVICE_TRANSLATIONS[s.name] = {
            ur: s.translations.ur || s.name,
            ar: s.translations.ar || s.name,
          };
        }
        return {
          id: s.id,
          name: s.name,
          durationMins: 35,
          price: s.price,
          active: s.enabled,
        };
      });
    }
    if (isLadies) {
      return [
        { id: 'l1', name: 'Signature Party Makeup & Styling', durationMins: 60, price: 4500, active: true },
        { id: 'l2', name: 'Barat / Walima Bridal Package', durationMins: 150, price: 35000, active: true },
        { id: 'l3', name: 'Hydra-Facial & Skin Polish', durationMins: 50, price: 3500, active: true },
        { id: 'l4', name: 'Keratin Hair Rebonding / Smoothing', durationMins: 120, price: 12000, active: true },
        { id: 'l5', name: 'Mani-Pedi Classic Spa', durationMins: 45, price: 2000, active: true },
        { id: 'l6', name: 'Full Face Threading & Waxing', durationMins: 30, price: 1200, active: true },
        { id: 'l7', name: 'Deep Conditioning Hair Spa', durationMins: 40, price: 2500, active: true },
      ];
    }
    return [
      { id: 's1', name: 'Master Haircut & Skin Fade', durationMins: 40, price: 800, active: true },
      { id: 's2', name: 'Classic Beard Trim & Sculpt', durationMins: 25, price: 400, active: true },
      { id: 's3', name: 'Hot Towel Steam Shave', durationMins: 25, price: 500, active: true },
      { id: 's4', name: 'Hair Color & Camo', durationMins: 45, price: 1500, active: true },
      { id: 's5', name: 'Charcoal Deep Detox Facial', durationMins: 45, price: 2500, active: true },
      { id: 's6', name: 'Keratin Hair Protein', durationMins: 90, price: 6000, active: true },
      { id: 's7', name: 'Herbal Mint Head Massage', durationMins: 20, price: 500, active: true },
      { id: 's8', name: 'Groom Signature Package', durationMins: 120, price: 12000, active: true },
    ];
  });

  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [customServiceName, setCustomServiceName] = useState('');
  const [customServiceDuration, setCustomServiceDuration] = useState('35');
  const [customServicePrice, setCustomServicePrice] = useState('1500');

  // Query 8: Barbers & Stylists Management State + Chair Assignments (Synced with Onboarding & LocalStorage)
  const [barbersList, setBarbersList] = useState<string[]>(() => {
    if (onboardedData?.barbers && onboardedData.barbers.length > 0) {
      return onboardedData.barbers;
    }
    try {
      const saved = localStorage.getItem('wcl_salon_barbers');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return ['Master Aslam', 'Tariq Mehmood', 'Ali Raza', 'Bilal Tariq'];
  });
  const [barberChairs, setBarberChairs] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('wcl_salon_barber_chairs');
      if (saved) return JSON.parse(saved) as Record<string, string>;
    } catch {}
    return {
      'Master Aslam': 'Chair #1 (VIP Front)',
      'Tariq Mehmood': 'Chair #2',
      'Ali Raza': 'Chair #3',
      'Bilal Tariq': 'Chair #4',
    };
  });

  useEffect(() => {
    if (!onboardedData) return;
    setOwnerLang(onboardedData.language);
    if (onboardedData.services && onboardedData.services.length > 0) {
      const mapped = onboardedData.services.map((s) => {
        if (s.translations && (s.translations.ur || s.translations.ar)) {
          SERVICE_TRANSLATIONS[s.name] = {
            ur: s.translations.ur || s.name,
            ar: s.translations.ar || s.name,
          };
        }
        return {
          id: s.id,
          name: s.name,
          durationMins: 35,
          price: s.price,
          active: s.enabled,
        };
      });
      setServices(mapped);
    }
    if (onboardedData.barbers && onboardedData.barbers.length > 0) {
      setBarbersList(onboardedData.barbers);
    }
  }, [onboardedData]);

  // Sync salon barber list to backend for automatic WhatsApp busy-rerouting
  const syncBarbersToServer = (nextBarbers: string[]) => {
    fetch(`/api/salons/${encodeURIComponent(currentSalon.id)}/barbers`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ barbers: nextBarbers }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((state) => {
        if (state) setConciergeState(state);
      })
      .catch(() => {});
  };

  const [newBarberDashboardInput, setNewBarberDashboardInput] = useState('');
  const [newBarberChairInput, setNewBarberChairInput] = useState('');
  const [editingBarberIndex, setEditingBarberIndex] = useState<number | null>(null);
  const [editingBarberName, setEditingBarberName] = useState('');
  const [editingBarberChair, setEditingBarberChair] = useState('');

  const handleAddBarberDashboard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBarberDashboardInput.trim()) return;
    const name = newBarberDashboardInput.trim();
    const chairLabel = newBarberChairInput.trim() || `Chair #${barbersList.length + 1}`;
    const updated = [...barbersList, name];
    const nextChairs = { ...barberChairs, [name]: chairLabel };
    setBarbersList(updated);
    setBarberChairs(nextChairs);
    setNewBarberDashboardInput('');
    setNewBarberChairInput('');
    try {
      localStorage.setItem('wcl_salon_barbers', JSON.stringify(updated));
      localStorage.setItem('wcl_salon_barber_chairs', JSON.stringify(nextChairs));
    } catch {}
    syncBarbersToServer(updated);
    setMaintToast(`✓ ${name} assigned to ${chairLabel} & synced with queue.`);
    setTimeout(() => setMaintToast(null), 4000);
  };

  const handleSaveEditBarber = (index: number) => {
    if (!editingBarberName.trim()) return;
    const oldName = barbersList[index];
    const nextName = editingBarberName.trim();
    const nextChair = editingBarberChair.trim() || barberChairs[oldName] || `Chair #${index + 1}`;
    const updated = [...barbersList];
    updated[index] = nextName;
    const nextChairs = { ...barberChairs };
    delete nextChairs[oldName];
    nextChairs[nextName] = nextChair;
    setBarbersList(updated);
    setBarberChairs(nextChairs);
    setEditingBarberIndex(null);
    setEditingBarberName('');
    setEditingBarberChair('');
    try {
      localStorage.setItem('wcl_salon_barbers', JSON.stringify(updated));
      localStorage.setItem('wcl_salon_barber_chairs', JSON.stringify(nextChairs));
    } catch {}
    syncBarbersToServer(updated);
    setMaintToast(`✓ Updated ${nextName} (${nextChair}).`);
    setTimeout(() => setMaintToast(null), 4000);
  };

  const handleDeleteBarberDashboard = (name: string) => {
    const updated = barbersList.filter((b) => b !== name);
    const nextChairs = { ...barberChairs };
    delete nextChairs[name];
    setBarbersList(updated);
    setBarberChairs(nextChairs);
    try {
      localStorage.setItem('wcl_salon_barbers', JSON.stringify(updated));
      localStorage.setItem('wcl_salon_barber_chairs', JSON.stringify(nextChairs));
    } catch {}
    syncBarbersToServer(updated);
    setMaintToast(`✓ Barber "${name}" removed from salon roster.`);
    setTimeout(() => setMaintToast(null), 4000);
  };

  const handleUpdateServiceName = (id: string, name: string) => {
    setServices((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)));
  };

  const handleUpdateServiceDuration = (id: string, durationMins: number) => {
    setServices((prev) =>
      prev.map((s) => (s.id === id ? { ...s, durationMins: Math.max(5, durationMins) } : s))
    );
  };

  const handleSaveSalonHours = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      localStorage.setItem('wcl_salon_hours', JSON.stringify(salonHours));
    } catch {}
    setMaintToast('✓ Salon operating hours saved and synced to WhatsApp Concierge.');
    setTimeout(() => setMaintToast(null), 4000);
  };

  // Hands-Free Loudspeaker Engine (Sleep-Window Aware + Strictly Localized ur-PK / ar-SA / en-US)
  const announceInboundEventLoudly = (params: {
    eventType:
      | 'APPOINTMENT_CONFIRMED'
      | 'REMINDER_REPLY_CONFIRMED'
      | 'REMINDER_REPLY_LATE'
      | 'REMINDER_REPLY_RESCHEDULE'
      | 'RESCHEDULE_CONFIRMED'
      | 'PRICE_MENU_SENT'
      | 'BARBER_BUSY_REROUTED'
      | 'URGENT_BRIDAL_GROOM';
    clientName: string;
    clientPhone: string;
    clientLang: ClientChatLang;
    barberName: string;
    servicesText: string;
    timeSlot: string;
    rawBody: string;
  }) => {
    const { eventType, clientName, clientPhone, clientLang, barberName, servicesText, timeSlot, rawBody } =
      params;
    const isUrgent =
      eventType === 'REMINDER_REPLY_LATE' ||
      eventType === 'REMINDER_REPLY_RESCHEDULE' ||
      eventType === 'URGENT_BRIDAL_GROOM';

    const speechByLang: Record<VoiceLang, string> = {
      en:
        eventType === 'URGENT_BRIDAL_GROOM'
          ? `Urgent Bridal or Groom alert! ${clientName} booked ${servicesText} with ${barberName} at ${timeSlot}.`
          : eventType === 'BARBER_BUSY_REROUTED'
          ? `Busy reroute sent! ${clientName} asked for ${barberName} at ${timeSlot}, and WhatsApp bot offered free alternative barbers.`
          : eventType === 'PRICE_MENU_SENT'
          ? `Price list sent on WhatsApp to ${clientName}.`
          : eventType === 'RESCHEDULE_CONFIRMED'
          ? `Reschedule confirmed! ${clientName} picked ${timeSlot} with ${barberName}.`
          : eventType === 'APPOINTMENT_CONFIRMED'
          ? `Attention! Appointment confirmed. ${clientName} wants barber ${barberName}. Services: ${servicesText}, for ${timeSlot}.`
          : eventType === 'REMINDER_REPLY_CONFIRMED'
          ? `Reminder reply! ${clientName} confirmed coming at ${timeSlot} with barber ${barberName}.`
          : eventType === 'REMINDER_REPLY_LATE'
          ? `Urgent arrival update! ${clientName} replied they are running 15 minutes late for ${timeSlot} with ${barberName}.`
          : `Urgent schedule update! ${clientName} cannot make ${timeSlot} and requested to reschedule.`,
      ur:
        eventType === 'URGENT_BRIDAL_GROOM'
          ? `اہم برائیڈل یا گروم الرٹ! ${clientName} نے ${barberName} کے ساتھ ${timeSlot} پر ${servicesText} کی بکنگ کی ہے۔`
          : eventType === 'BARBER_BUSY_REROUTED'
          ? `خودکار ری راؤٹ! ${clientName} نے ${timeSlot} پر ${barberName} مانگا، بوٹ نے متبادل خالی باربرز بھیج دیے ہیں۔`
          : eventType === 'PRICE_MENU_SENT'
          ? `${clientName} کو واٹس ایپ پر ریٹ لسٹ اور سروس مینو بھیج دیا گیا ہے۔`
          : eventType === 'RESCHEDULE_CONFIRMED'
          ? `نیا وقت کنفرم! ${clientName} نے ${barberName} کے ساتھ ${timeSlot} کا نیا سلاٹ منتخب کر لیا ہے۔`
          : eventType === 'APPOINTMENT_CONFIRMED'
          ? `توجہ فرمائیں! ${clientName} کی اپائنٹمنٹ باربر ${barberName} کے ساتھ ${timeSlot} پر کنفرم ہو گئی ہے۔ سروسز: ${servicesText}۔`
          : eventType === 'REMINDER_REPLY_CONFIRMED'
          ? `ریمائنڈر کا جواب! ${clientName} نے ${timeSlot} پر باربر ${barberName} کے پاس آنے کی تصدیق کر دی ہے۔`
          : eventType === 'REMINDER_REPLY_LATE'
          ? `ضروری اطلاع! ${clientName} نے ریمائنڈر پر جواب دیا ہے کہ وہ ${timeSlot} پر پندرہ منٹ دیر سے پہنچیں گے۔`
          : `اہم اطلاع! ${clientName} آج ${timeSlot} پر نہیں آ سکیں گے اور نیا وقت مانگا ہے۔`,
      ar:
        eventType === 'URGENT_BRIDAL_GROOM'
          ? `تنبيه حجز زفاف عاجل! حجز ${clientName} باقة ${servicesText} مع الحلاق ${barberName} الساعة ${timeSlot}.`
          : eventType === 'BARBER_BUSY_REROUTED'
          ? `تحويل تلقائي! طلب ${clientName} الحلاق ${barberName} الساعة ${timeSlot} وتم إرسال الحلاقين المتاحين.`
          : eventType === 'PRICE_MENU_SENT'
          ? `تم إرسال قائمة الأسعار تلقائياً عبر واتساب إلى ${clientName}.`
          : eventType === 'RESCHEDULE_CONFIRMED'
          ? `تم تأكيد إعادة الجدولة! اختار ${clientName} الموعد الجديد ${timeSlot} مع ${barberName}.`
          : eventType === 'APPOINTMENT_CONFIRMED'
          ? `تنبيه! تم تأكيد موعد جديد. ${clientName} يريد الحلاق ${barberName}. الخدمات: ${servicesText} الساعة ${timeSlot}.`
          : eventType === 'REMINDER_REPLY_CONFIRMED'
          ? `رد التذكير! أكد ${clientName} حضوره الساعة ${timeSlot} مع الحلاق ${barberName}.`
          : eventType === 'REMINDER_REPLY_LATE'
          ? `تحديث وصول عاجل! أرسل ${clientName} أنه سيتأخر خمس عشرة دقيقة عن موعد ${timeSlot}.`
          : `تنبيه جدول عاجل! طلب ${clientName} تأجيل موعد ${timeSlot}.`,
    };

    const spokenText = speechByLang[ownerLang];
    const logType: VoiceEventLog['type'] =
      eventType === 'APPOINTMENT_CONFIRMED' ||
      eventType === 'RESCHEDULE_CONFIRMED' ||
      eventType === 'BARBER_BUSY_REROUTED'
        ? 'BOOKING'
        : isUrgent
        ? 'REPLY_URGENT'
        : 'REPLY_CONFIRMED';

    const summaryLabel =
      eventType === 'APPOINTMENT_CONFIRMED' ||
      eventType === 'RESCHEDULE_CONFIRMED' ||
      eventType === 'URGENT_BRIDAL_GROOM'
        ? `${
            eventType === 'URGENT_BRIDAL_GROOM'
              ? 'URGENT Bridal/Groom'
              : eventType === 'RESCHEDULE_CONFIRMED'
              ? 'Rescheduled'
              : 'Confirmed'
          } ${timeSlot} · Barber: ${barberName} · ${servicesText}`
        : eventType === 'PRICE_MENU_SENT'
        ? `WhatsApp Auto-Sent Rate Menu to ${clientName}`
        : eventType === 'BARBER_BUSY_REROUTED'
        ? `Bot Auto-Rerouted ${timeSlot} · Requested ${barberName} (Busy)`
        : `Reminder Reply (${timeSlot}) · ${clientName}: "${rawBody}"`;

    setVoiceLogs((prev) => [
      {
        id: `vlog-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        type: logType,
        clientName,
        clientLang,
        ownerVoiceLang: ownerLang,
        summary: summaryLabel,
        spokenText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isUrgent,
      },
      ...prev,
    ]);

    if (
      eventType === 'APPOINTMENT_CONFIRMED' ||
      eventType === 'RESCHEDULE_CONFIRMED' ||
      eventType === 'URGENT_BRIDAL_GROOM'
    ) {
      const hash = `SHA256:${Math.random().toString(36).substring(2, 6).toUpperCase()}...${Math.random()
        .toString(36)
        .substring(2, 6)
        .toUpperCase()}`;
      setImmutableProofs((prev) => [
        {
          id: `PRF-${Date.now().toString().slice(-4)}`,
          clientName,
          clientPhone,
          clientLang,
          services: servicesText.split('&').map((s) => s.trim()),
          totalAmount: regionConfig.currency === 'PKR' ? 1500 : 85,
          pricingModeLabel: 'WhatsApp Auto-Confirmed',
          slotTime: timeSlot,
          confirmedMessage: rawBody,
          timestamp: `${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (Immutable)`,
          hash,
        },
        ...prev,
      ]);
    }

    // Sleep-Window Rule: Queue silently when Counter Sleep is active (zero sound / chimes)
    if (isCounterSleepingRef.current) {
      setOvernightQueue((prev) => [
        {
          id: `ov-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          clientName,
          barberName,
          services: servicesText,
          timeSlot,
          eventType,
          receivedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          summary: summaryLabel,
        },
        ...prev,
      ]);
      return;
    }

    if (voiceFilter === 'ALL' || isUrgent || eventType === 'APPOINTMENT_CONFIRMED') {
      speakHandsFree(spokenText, ownerLang);
    }
  };

  // Toggle Counter Sleep <-> Keep Counter Awake (With Bluetooth/AUX Catch-Up Replay)
  const handleToggleCounterSleep = async () => {
    if (!isCounterSleeping) {
      const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      isCounterSleepingRef.current = true;
      setIsCounterSleeping(true);
      setCounterSleptAt(nowTime);
      stopSpeaking();
      try {
        await wakeLockRef.current?.release?.();
      } catch {}
      wakeLockRef.current = null;
      setIsWakeLockActive(false);

      fetch(`/api/salons/${encodeURIComponent(currentSalon.id)}/counter-sleep`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sleeping: true }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((s) => {
          if (s) setConciergeState(s);
        })
        .catch(() => {});

      setMaintToast(`🌙 Counter Sleep ON (${nowTime}): All overnight WhatsApp alerts queued silently.`);
      setTimeout(() => setMaintToast(null), 5000);
      return;
    }

    // Waking up Counter -> Re-enable wake lock & replay queued overnight summary aloud!
    isCounterSleepingRef.current = false;
    setIsCounterSleeping(false);
    const queuedSnapshot = [...overnightQueue];
    setOvernightQueue([]);
    setCounterSleptAt(null);

    try {
      const nav = navigator as Navigator & {
        wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
      };
      if (nav.wakeLock) {
        wakeLockRef.current = await nav.wakeLock.request('screen');
      }
    } catch {}
    setIsWakeLockActive(true);

    fetch(`/api/salons/${encodeURIComponent(currentSalon.id)}/counter-sleep`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sleeping: false }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => {
        if (s) setConciergeState(s);
      })
      .catch(() => {});

    const ownerFirst = currentSalon.owner.split(' ')[0] || 'Sahab';
    if (queuedSnapshot.length > 0) {
      const topItems = queuedSnapshot.slice(0, 3);
      const summaryText: Record<VoiceLang, string> = {
        ur: `صبح بخیر ${ownerFirst} صاحب! کاؤنٹر جاگ گیا ہے۔ رات بھر میں ${queuedSnapshot.length} واٹس ایپ پیغامات موصول ہوئے: ${topItems
          .map((item) => `${item.clientName}، باربر ${item.barberName}، ${item.timeSlot}`)
          .join('۔ ')}۔`,
        ar: `صباح الخير يا ${ownerFirst}! تم استيقاظ الكاونتر. لديك ${queuedSnapshot.length} رسائل واتساب خلال فترة النوم: ${topItems
          .map((item) => `${item.clientName} مع ${item.barberName} الساعة ${item.timeSlot}`)
          .join('، ')}.`,
        en: `Good morning ${ownerFirst}! Counter is awake. While sleeping, you received ${queuedSnapshot.length} WhatsApp messages: ${topItems
          .map((item) => `${item.clientName} with ${item.barberName} at ${item.timeSlot}`)
          .join('. ')}.`,
      };
      const catchUpMsg = summaryText[ownerLang];
      speakHandsFree(catchUpMsg, ownerLang);
      setVoiceLogs((prev) => [
        {
          id: `vlog-wake-${Date.now()}`,
          type: 'BOOKING',
          clientName: `${queuedSnapshot.length} Overnight Items`,
          clientLang: ownerLang,
          ownerVoiceLang: ownerLang,
          summary: `Morning Catch-Up Replay · Cleared ${queuedSnapshot.length} queued overnight message(s)`,
          spokenText: catchUpMsg,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isUrgent: false,
        },
        ...prev,
      ]);
      setMaintToast(`☀️ Counter Awake! Played & cleared ${queuedSnapshot.length} overnight WhatsApp message(s).`);
    } else {
      const awakePing: Record<VoiceLang, string> = {
        ur: `کاؤنٹر اب جاگ گیا ہے۔ رات بھر کوئی نیا پیغام نہیں آیا۔`,
        ar: `الكاونتر نشط الآن. لا توجد رسائل متراكمة خلال فترة النوم.`,
        en: `Counter is now awake and listening for WhatsApp bookings.`,
      };
      speakHandsFree(awakePing[ownerLang], ownerLang);
      setMaintToast(`☀️ Keep Counter Awake active! Listening hands-free in ${ownerLang.toUpperCase()}.`);
    }
    setTimeout(() => setMaintToast(null), 6000);
  };

  // Process incoming concierge state updates (both from 6s polling and Retention Settings simulator)
  const processIncomingConciergeState = (nextState: SalonConciergeStateResponse) => {
    setConciergeState(nextState);

    if (!hasHydratedConciergeRef.current) {
      nextState.logs.forEach((l) => seenLogIdsRef.current.add(l.id));
      nextState.appointments.forEach((a) => seenApptIdsRef.current.add(a.id));
      hasHydratedConciergeRef.current = true;
      return;
    }

    const newAppts = nextState.appointments.filter((a) => !seenApptIdsRef.current.has(a.id));
    if (newAppts.length > 0) {
      newAppts.forEach((a) => seenApptIdsRef.current.add(a.id));
      setBookings((prev) => {
        const existingIds = new Set(prev.map((b) => b.id));
        const additions: BookingRecord[] = newAppts
          .filter((a) => !existingIds.has(a.id))
          .map((a) => ({
            id: a.id,
            clientName: a.clientName,
            barberName: a.barberName,
            phone: a.clientPhone,
            service: a.service,
            price: a.price,
            timeSlot: a.timeSlot,
            durationMins: a.durationMins || 35,
            scheduledEndMs: a.scheduledEndMs || Date.now() + (a.durationMins || 35) * 60000,
            sourceType: a.sourceType || 'WHATSAPP_BOT',
            chairLabel: barberChairs[a.barberName],
            status: a.status,
          }));
        return additions.length > 0 ? [...additions, ...prev] : prev;
      });
    }

    const newInboundLogs = nextState.logs.filter((l) => {
      if (seenLogIdsRef.current.has(l.id)) return false;
      seenLogIdsRef.current.add(l.id);
      return l.direction === 'INBOUND' && (l.eventMetadata || l.module === 'WINBACK_30D');
    });

    if (newInboundLogs.length > 0) {
      const latest = newInboundLogs[0];
      const meta = latest.eventMetadata;
      const mappedClientLang: ClientChatLang =
        latest.language === 'ar' ? 'ar' : latest.language === 'ur' || latest.language === 'roman_ur' ? 'ur' : 'en';
      announceInboundEventLoudly({
        eventType: meta?.eventType || 'APPOINTMENT_CONFIRMED',
        clientName: latest.clientName,
        clientPhone: latest.clientPhone,
        clientLang: mappedClientLang,
        barberName: meta?.barberName || barbersList[0] || 'Master Aslam',
        servicesText: meta?.services || 'Haircut & Beard',
        timeSlot: meta?.timeSlot || '04:30 PM',
        rawBody: latest.body,
      });
    }
  };

  // Live 6s background poll for incoming WhatsApp confirmations & reminder replies while working hands-free
  useEffect(() => {
    if (isFounderInspector) return;
    const interval = setInterval(() => {
      fetch(`/api/salons/${encodeURIComponent(currentSalon.id)}/concierge-state`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data: SalonConciergeStateResponse | null) => {
          if (data) processIncomingConciergeState(data);
        })
        .catch(() => {});
    }, 6000);
    return () => clearInterval(interval);
  });

  // Auto-Completion Rule: Automatically mark active bookings COMPLETED 15 mins after scheduled end time (unless Flagged or Canceled)
  useEffect(() => {
    if (isFounderInspector) return;
    const checkAutoComplete = () => {
      const nowMs = Date.now();
      const fifteenMinsMs = 15 * 60 * 1000;
      const dueBookings = bookings.filter(
        (b) =>
          b.status !== 'COMPLETED' &&
          !b.flagged &&
          !b.canceled &&
          typeof b.scheduledEndMs === 'number' &&
          nowMs >= b.scheduledEndMs + fifteenMinsMs
      );
      if (dueBookings.length === 0) return;

      dueBookings.forEach((due) => {
        handleUpdateStatus(due.id, 'COMPLETED', true);
      });
    };

    const timer = window.setInterval(checkAutoComplete, 20000);
    return () => window.clearInterval(timer);
  });

  const handleTriggerSimulatedVoiceWebhook = async (
    kind: 'CONFIRMATION' | 'REMINDER_LATE' | 'REMINDER_COMING' | 'BRIDAL_URGENT'
  ) => {
    setIsTestingLoudAlert(true);
    try {
      const payload =
        kind === 'BRIDAL_URGENT'
          ? {
              salonId: currentSalon.id,
              fromPhone: '+92 333 9911220',
              clientName: 'Sana Bridal VIP',
              messageText: 'Urgent Bridal Package & Groom booking with barber Hamza at 6:00 PM',
            }
          : kind === 'CONFIRMATION'
          ? {
              salonId: currentSalon.id,
              fromPhone: '+92 300 9988776',
              clientName: 'Mr. Ali',
              messageText:
                'Confirmed! Mr. Ali wants barber Hamza for Haircut and Beard at 4:30 PM',
            }
          : kind === 'REMINDER_LATE'
          ? {
              salonId: currentSalon.id,
              fromPhone: '+92 321 7766554',
              clientName: 'Bilal Ahmed',
              messageText: 'I am 15 minutes late for my 3:30 PM slot with barber Aslam',
            }
          : {
              salonId: currentSalon.id,
              fromPhone: '+92 333 4567890',
              clientName: 'Dr. Usman',
              messageText: 'Yes I am coming at 5:00 PM with barber Tariq, confirm',
            };

      const res = await fetch(
        `/api/salons/${encodeURIComponent(currentSalon.id)}/concierge/simulate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) throw new Error('Webhook failed');
      const data = (await res.json()) as { state?: SalonConciergeStateResponse };
      if (data.state) {
        processIncomingConciergeState(data.state);
      }
      setMaintToast(
        isCounterSleeping
          ? '🌙 Overnight message queued silently while Counter Sleep is active!'
          : '🔊 Incoming WhatsApp message received & announced loudly!'
      );
      setTimeout(() => setMaintToast(null), 4500);
    } catch {
      setMaintToast('Could not trigger announcement test.');
    } finally {
      setIsTestingLoudAlert(false);
    }
  };

  const handleToggleService = (id: string) => {
    setServices((prev) => prev.map((s) => (s.id === id ? { ...s, active: !s.active } : s)));
  };

  const handleUpdatePrice = (id: string, newPrice: number) => {
    setServices((prev) => prev.map((s) => (s.id === id ? { ...s, price: newPrice } : s)));
  };

  const handleUpdateStatus = (
    id: string,
    status: 'CONFIRMED' | 'IN_CHAIR' | 'COMPLETED',
    isAutoCompleted = false
  ) => {
    const targetBooking = bookings.find((b) => b.id === id);
    setBookings((prev) =>
      prev.map((b) => {
        if (b.id === id) {
          if (status === 'COMPLETED') {
            setMaintToast(
              isAutoCompleted
                ? `⏱ Auto-Done (+15m past end): ${b.clientName}'s chair freed automatically.`
                : `✓ Done! ${b.clientName}'s chair freed & visit recorded.`
            );
            setTimeout(() => setMaintToast(null), 4500);
          } else if (status === 'IN_CHAIR') {
            setMaintToast(`💈 ${b.clientName} is now In-Chair with ${b.barberName}.`);
            setTimeout(() => setMaintToast(null), 4000);
          }
          return { ...b, status };
        }
        return b;
      })
    );

    if (status === 'COMPLETED' && targetBooking) {
      fetch(`/api/salons/${encodeURIComponent(currentSalon.id)}/appointments/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointmentId: targetBooking.id,
          clientName: targetBooking.clientName,
          clientPhone: targetBooking.phone,
          barberName: targetBooking.barberName,
          service: targetBooking.service,
          price: targetBooking.price,
          timeSlot: targetBooking.timeSlot,
        }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.state) setConciergeState(data.state);
        })
        .catch(() => {});
    }
  };

  const handleToggleFlagBooking = (id: string) => {
    setBookings((prev) =>
      prev.map((b) => {
        if (b.id !== id) return b;
        const nextFlagged = !b.flagged;
        setMaintToast(
          nextFlagged
            ? `🚩 Flagged ${b.clientName}: Excluded from 15m auto-completion.`
            : `✓ Unflagged ${b.clientName}: Normal 15m auto-completion restored.`
        );
        setTimeout(() => setMaintToast(null), 3500);
        return { ...b, flagged: nextFlagged };
      })
    );
  };

  // $0.00 Local Chair Lock Executor (Used by both Browser Voice Intent Parser & 2-Tap Quick Pills)
  const executeChairLock = async (params: {
    barberName: string;
    startTimeSlot: string;
    endTimeSlot: string;
    startMinutes: number;
    endMinutes: number;
    durationMins: number;
    source: 'VOICE' | 'QUICK_PILL';
    transcript?: string;
    silent?: boolean;
  }) => {
    const {
      barberName,
      startTimeSlot,
      endTimeSlot,
      startMinutes,
      endMinutes,
      durationMins,
      source,
      transcript,
      silent = false,
    } = params;

    try {
      const res = await fetch(
        `/api/salons/${encodeURIComponent(currentSalon.id)}/chair-locks`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            barberName,
            chairLabel: barberChairs[barberName],
            startTimeSlot,
            endTimeSlot,
            startMinutes,
            endMinutes,
            durationMins,
            source,
            transcript,
            barbers: barbersList,
          }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        if (data?.lock?.id) seenApptIdsRef.current.add(data.lock.id);
        if (data?.state) setConciergeState(data.state);
      }
    } catch {}

    const lockBooking: BookingRecord = {
      id: `WLK-${Date.now().toString().slice(-4)}`,
      clientName:
        source === 'VOICE'
          ? `Walk-In · Voice Lock (${durationMins}m)`
          : `Walk-In · Chair Busy (${durationMins}m)`,
      barberName,
      phone: currentSalon.phone,
      service: `Chair Blocked (${startTimeSlot} – ${endTimeSlot})`,
      price: 0,
      timeSlot: startTimeSlot,
      durationMins,
      scheduledEndMs: Date.now() + durationMins * 60000,
      sourceType: 'WALK_IN_BUSY',
      chairLabel: barberChairs[barberName],
      status: 'IN_CHAIR',
    };
    setBookings((prev) => [lockBooking, ...prev]);

    const voiceConfirmation: Record<VoiceLang, string> = {
      ur: `${barberName} کی کرسی ${startTimeSlot} سے ${endTimeSlot} تک واک اِن کے لیے لاک کر دی گئی ہے۔ اس وقت کے واٹس ایپ کسٹمرز کو خودکار طور پر دیگر خالی باربرز دکھائے جائیں گے۔`,
      ar: `تم حجز كرسي ${barberName} من ${startTimeSlot} إلى ${endTimeSlot} لعميل الحضور المباشر. سيتم تحويل طلبات واتساب تلقائياً للحلاقين المتاحين.`,
      en: `Chair locked for ${barberName} from ${startTimeSlot} to ${endTimeSlot}. Incoming WhatsApp requests during this window will automatically reroute to free barbers.`,
    };

    if (!silent) {
      speakHandsFree(voiceConfirmation[ownerLang], ownerLang);
    }

    setVoiceLogs((prev) => [
      {
        id: `vlog-lck-${Date.now()}`,
        type: 'BOOKING',
        clientName: `${barberName} (${source === 'VOICE' ? 'Voice Lock' : 'Quick Pill'})`,
        clientLang: ownerLang,
        ownerVoiceLang: ownerLang,
        summary: `Chair Locked ${startTimeSlot}–${endTimeSlot} (${durationMins}m) · Auto WhatsApp Busy-Reroute Active`,
        spokenText: voiceConfirmation[ownerLang],
        time: startTimeSlot,
        isUrgent: false,
      },
      ...prev,
    ]);

    setMaintToast(
      `🔒 ${barberName} locked (${startTimeSlot} – ${endTimeSlot}). WhatsApp bot now marks ${barberName} Busy & reroutes!`
    );
    setTimeout(() => setMaintToast(null), 5000);
  };

  const handleReleaseChairLock = async (lockId: string, barberName: string) => {
    try {
      const res = await fetch(
        `/api/salons/${encodeURIComponent(currentSalon.id)}/chair-locks/${encodeURIComponent(lockId)}`,
        { method: 'DELETE' }
      );
      if (res.ok) {
        const nextState = (await res.json()) as SalonConciergeStateResponse;
        setConciergeState(nextState);
      }
    } catch {}
    setMaintToast(`✓ ${barberName}'s chair unlocked and open for WhatsApp bookings.`);
    setTimeout(() => setMaintToast(null), 3500);
  };

  const handleQuickPillTap = (barber: string, durationMins: number) => {
    if (armedQuickPill && armedQuickPill.barber === barber && armedQuickPill.durationMins === durationMins) {
      setArmedQuickPill(null);
      const now = new Date();
      const startMinutes = now.getHours() * 60 + now.getMinutes();
      const endMinutes = startMinutes + durationMins;
      executeChairLock({
        barberName: barber,
        startTimeSlot: formatTimeFromMinutes(startMinutes),
        endTimeSlot: formatTimeFromMinutes(endMinutes),
        startMinutes,
        endMinutes,
        durationMins,
        source: 'QUICK_PILL',
        silent: true, // Silent instant locking during loud rush hours
      });
      return;
    }

    setArmedQuickPill({ barber, durationMins });
    window.setTimeout(() => {
      setArmedQuickPill((curr) =>
        curr && curr.barber === barber && curr.durationMins === durationMins ? null : curr
      );
    }, 4000);
  };

  const stopHoldToSpeakMic = () => {
    if (micTimerRef.current) {
      window.clearInterval(micTimerRef.current);
      micTimerRef.current = null;
    }
    try {
      recognitionRef.current?.stop?.();
    } catch {}
    if (micMediaRecorderRef.current && micMediaRecorderRef.current.state !== 'inactive') {
      try {
        micMediaRecorderRef.current.stop();
      } catch {}
    }
    setIsListeningMic(false);
    setMicElapsedSecs(0);

    const captured = latestTranscriptRef.current.trim();
    if (captured) {
      latestTranscriptRef.current = '';
      const intent = parseVoiceChairIntent(captured, barbersList);
      executeChairLock({
        ...intent,
        source: 'VOICE',
        transcript: captured,
        silent: false,
      });
    }
  };

  const startMediaRecorderChairFallback = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMaintToast('Microphone unavailable. Please allow mic access or type below / use +30m/+1h pills.');
      setTimeout(() => setMaintToast(null), 5000);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      micMediaStreamRef.current = stream;
      const mimeCandidates = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/webm'];
      const mime = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || '';
      const recorder = new MediaRecorder(
        stream,
        mime ? { mimeType: mime, audioBitsPerSecond: 20000 } : { audioBitsPerSecond: 20000 }
      );
      micAudioChunksRef.current = [];
      micMediaRecorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) micAudioChunksRef.current.push(ev.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        micMediaStreamRef.current = null;
        micMediaRecorderRef.current = null;
        const resolvedMime = recorder.mimeType || mime || 'audio/webm';
        const blob = new Blob(micAudioChunksRef.current, { type: resolvedMime });
        if (blob.size < 400) return;

        setIsTranscribingChairMic(true);
        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            const raw = typeof reader.result === 'string' ? reader.result : '';
            const comma = raw.indexOf(',');
            const base64 = comma >= 0 ? raw.slice(comma + 1) : raw;
            if (!base64) return;

            const res = await fetch('/api/voice/chair-intent', {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                audioBase64: base64,
                audioMimeType: resolvedMime,
                lang: ownerLang,
              }),
            });
            const data = (await res.json().catch(() => ({}))) as { transcript?: string; error?: string };
            if (res.ok && data.transcript?.trim()) {
              const phrase = data.transcript.trim();
              setVoiceTranscript(phrase);
              const intent = parseVoiceChairIntent(phrase, barbersList);
              executeChairLock({
                ...intent,
                source: 'VOICE',
                transcript: phrase,
                silent: false,
              });
            } else {
              setMaintToast(data.error || 'Could not recognize voice command. Try typing or use +30m/+1h pills.');
              setTimeout(() => setMaintToast(null), 5000);
            }
          } catch {
            setMaintToast('Could not transcribe voice lock right now. Use Quick Command bar or +30m/+1h pills.');
            setTimeout(() => setMaintToast(null), 5000);
          } finally {
            setIsTranscribingChairMic(false);
          }
        };
        reader.readAsDataURL(blob);
      };

      recorder.start(250);
      setIsListeningMic(true);
      setMicElapsedSecs(0);
      micTimerRef.current = window.setInterval(() => {
        setMicElapsedSecs((prev) => {
          if (prev + 1 >= 30) {
            stopHoldToSpeakMic();
            return 30;
          }
          return prev + 1;
        });
      }, 1000);
    } catch {
      setIsListeningMic(false);
      setMaintToast('Microphone permission denied. Please allow mic access or use +30m/+1h pills.');
      setTimeout(() => setMaintToast(null), 4500);
    }
  };

  const startHoldToSpeakMic = () => {
    if (isListeningMic) return;
    const SpeechRec =
      (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any })
        .SpeechRecognition ||
      (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any })
        .webkitSpeechRecognition;

    latestTranscriptRef.current = '';
    setVoiceTranscript('');

    if (!SpeechRec) {
      void startMediaRecorderChairFallback();
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.lang = ownerLang === 'ur' ? 'ur-PK' : ownerLang === 'ar' ? 'ar-SA' : 'en-US';
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event: any) => {
        let combined = '';
        for (let i = 0; i < event.results.length; i++) {
          combined += event.results[i][0].transcript + ' ';
        }
        latestTranscriptRef.current = combined.trim();
        setVoiceTranscript(combined.trim());
      };

      recognition.onerror = (ev: any) => {
        const code = ev?.error || '';
        if (code === 'not-allowed' || code === 'service-not-allowed' || code === 'audio-capture') {
          if (micTimerRef.current) {
            window.clearInterval(micTimerRef.current);
            micTimerRef.current = null;
          }
          setIsListeningMic(false);
          void startMediaRecorderChairFallback();
          return;
        }
        stopHoldToSpeakMic();
      };

      recognition.onend = () => {
        if (micTimerRef.current) {
          window.clearInterval(micTimerRef.current);
          micTimerRef.current = null;
        }
        setIsListeningMic(false);
        setMicElapsedSecs(0);
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsListeningMic(true);
      setMicElapsedSecs(0);

      micTimerRef.current = window.setInterval(() => {
        setMicElapsedSecs((prev) => {
          if (prev + 1 >= 30) {
            stopHoldToSpeakMic();
            return 30;
          }
          return prev + 1;
        });
      }, 1000);
    } catch {
      void startMediaRecorderChairFallback();
    }
  };

  const handleChairMicPointerDown = () => {
    if (isTranscribingChairMic) return;
    if (isListeningMic) {
      stopHoldToSpeakMic();
      return;
    }
    micPressStartRef.current = Date.now();
    startHoldToSpeakMic();
  };

  const handleChairMicPointerUp = () => {
    if (!isListeningMic) return;
    const heldMs = Date.now() - micPressStartRef.current;
    // Quick tap (< 450ms): keep listening hands-free until second tap; Hold (>= 450ms): release to lock immediately
    if (heldMs >= 450) {
      stopHoldToSpeakMic();
    }
  };

  const BARBER_SERVICE_STATS: Record<
    string,
    { topServices: string[]; favRate: string; repeatRate: string; clientLove: string }
  > = {
    ALL: {
      topServices: ['1. Skin Fade Haircut (48%)', '2. Beard Sculpt & Shape (31%)', '3. Detox Charcoal Facial (21%)'],
      favRate: '94% Positive Rating',
      repeatRate: '68% Repeat Retention',
      clientLove: 'Skin Fade + Beard Combo is the #1 booked service across all chairs',
    },
    'Tariq (Master Barber)': {
      topServices: ['1. Master Razor Fade (62%)', '2. Royal Hot Towel Shave (28%)', '3. Beard Lineup (10%)'],
      favRate: '98% Top Rated',
      repeatRate: '82% High Retention',
      clientLove: 'Most requested for sharp master razor fades and executive shaves',
    },
    'Kamran (Fade Specialist)': {
      topServices: ['1. Low Taper Fade (54%)', '2. Beard Sculpt (32%)', '3. Hair Texture Wash (14%)'],
      favRate: '92% Positive Rating',
      repeatRate: '71% Repeat',
      clientLove: 'Gen-Z & youth favorite for trending modern taper fades',
    },
    'Hamza (Groom & Beard Specialist)': {
      topServices: ['1. Groom Executive Package (45%)', '2. Charcoal Detox Facial (35%)', '3. Beard Sculpt (20%)'],
      favRate: '96% Positive Rating',
      repeatRate: '75% High Retention',
      clientLove: 'Highest revenue per chair: specialized in wedding & groom packages',
    },
    'Zeeshan (Colorist & Stylist)': {
      topServices: ['1. Ash Blonde Color / Bleach (51%)', '2. Keratin Treatment (31%)', '3. Scissors Styling (18%)'],
      favRate: '91% Positive Rating',
      repeatRate: '64% Repeat',
      clientLove: 'Specialist for high-ticket coloring, hair dyes, and chemical hair care',
    },
  };

  // Query 1 (New): Founder-to-Salon-Owner Official Message rendered strictly in Owner's Onboarding / Preferred Language
  const getFounderNoticeForOwner = (lang: VoiceLang) => {
    if (lang === 'ur') {
      return `بانی (Founder) پیغام برائے ${currentSalon.owner}: آپ کا سسٹم 100% آن لائن ہے۔ ماہانہ مینٹیننس فیس ہر مہینے کی 5 تاریخ کو واجب الادا ہے اور تمام اپگریڈز صرف فرق کی رقم پر دستیاب ہیں۔`;
    }
    if (lang === 'ar') {
      return `رسالة المؤسس إلى ${currentSalon.owner}: نظام الصالون يعمل بكفاءة 100%. رسوم الصيانة الشهرية تستحق في 5 من كل شهر، والترقية متاحة بدفع الفرق فقط.`;
    }
    return `Founder Notice for ${currentSalon.owner}: Your WhatsApp node is 100% online. Monthly maintenance is fixed to the 5th of every month, and tier upgrades charge only the remaining price difference.`;
  };

  // Query 4 (Prev): Localized 3-Stage 5th-of-Month Reminder Templates in Owner Language
  const getMaintenanceReminderMessage = (stage: MaintCycleStage, lang: VoiceLang) => {
    const amt = `${regionConfig.symbol}${currentSalon.maint.toLocaleString()}`;
    if (stage === 'STAGE_1_PREV_MONTH') {
      if (lang === 'ar') {
        return `تذكير مبكر (نهاية الشهر): رسوم الصيانة الشهرية (${amt}) تستحق في 5 من الشهر القادم من رقمك ${currentSalon.phone}.`;
      }
      if (lang === 'ur') {
        return `پہلی پیشگی یاددہانی (مہینے کے آخری 2 دن): آپ کی ماہانہ مینٹیننس فیس (${amt}) آنے والی 5 تاریخ کو واجب الادا ہے۔`;
      }
      return `Advance Reminder (Last 2 Days of Month): Your monthly maintenance fee (${amt}) is due on the 5th via ${currentSalon.phone}.`;
    }
    if (stage === 'STAGE_2_DAY_3') {
      if (lang === 'ar') {
        return `تذكير 3 الشهر: يرجى سداد ${amt} قبل 5 الشهر من رقمك المسجل ${currentSalon.phone} للاستمرار بأولوية الخدمة.`;
      }
      if (lang === 'ur') {
        return `دوسری یاددہانی (3 تاریخ): 5 تاریخ سے پہلے ${amt} اپنے رجسٹرڈ نمبر ${currentSalon.phone} سے ادا کریں۔`;
      }
      return `3rd of Month Reminder (48h Left): Pay ${amt} by the 5th from ${currentSalon.phone} to keep priority service active.`;
    }
    if (lang === 'ar') {
      return `تنبيه اليوم الأخير (5 الشهر): إذا لم يتم سداد ${amt} اليوم من ${currentSalon.phone}، سيتم إيقاف الإحصائيات المباشرة مؤقتاً حتى السداد.`;
    }
    if (lang === 'ur') {
      return `آج 5 تاریخ (آخری دن) وارننگ: اگر آج ${amt} ادا نہ ہوئے تو کل لائیو رپورٹس عارضی طور پر رک جائیں گی اور سروس عمومی موڈ میں چلی جائے گی۔`;
    }
    return `Final Warning (5th Due Day): If ${amt} is not paid today from ${currentSalon.phone}, live stats pause tomorrow until settled.`;
  };

  // ============================================================================
  // QUERY 2 (NEW): FOUNDER READ-ONLY INSPECTOR (NO LIVE QUEUE / NO OWNER CONTROLS)
  // ============================================================================
  if (isFounderInspector) {
    const currentSalonIdx = Math.max(
      0,
      salonsState.findIndex((s) => s.id === currentSalon.id)
    );
    const currentSerialLabel = `#${String(currentSalonIdx + 1).padStart(2, '0')} · [WC-${101 + currentSalonIdx}]`;

    return (
      <div className="space-y-6 max-w-5xl mx-auto pb-28 lg:pb-10 min-w-0 overflow-hidden">
        <div className="rounded-2xl border border-[#9E6A03] bg-[#3B2E0B] p-4 space-y-3 font-mono text-xs min-w-0 overflow-hidden">
          <div className="flex items-start justify-between gap-2.5 min-w-0">
            <div className="flex items-start gap-2 text-[#D29922] font-bold min-w-0 flex-1">
              <Eye className="size-4 shrink-0 text-[#D29922] mt-0.5" />
              <span className="break-words [overflow-wrap:break-word] leading-relaxed">
                👑 FOUNDER READ-ONLY INSPECTOR · Live Queue &amp; Salon Owner Controls Hidden from Founder
              </span>
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close Salon Health View"
                title="Back to Overview"
                className="min-h-[44px] min-w-[44px] rounded-xl bg-[#21262D] hover:border-[#06B6D4] text-[#F0F6FC] text-sm font-bold transition grid place-items-center border border-[#30363D] shrink-0"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 min-w-0">
            <div className="flex items-center gap-2 min-w-0 w-full sm:flex-1">
              <span className="rounded-lg border border-[#06B6D4]/40 bg-[#0D1117] px-2.5 py-2 text-[11px] font-bold text-[#06B6D4] shrink-0">
                {currentSerialLabel}
              </span>
              <select
                value={selectedSalonId}
                onChange={(e) => setSelectedSalonId(e.target.value)}
                className="w-full min-w-0 max-w-full flex-1 min-h-[44px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3 py-2 text-xs text-[#06B6D4] font-bold focus:outline-none focus:border-[#06B6D4] truncate"
              >
                {salonsState.map((s, idx) => (
                  <option key={s.id} value={s.id} className="bg-[#161B22] text-[#F0F6FC]">
                    #{String(idx + 1).padStart(2, '0')} · [WC-{101 + idx}] {s.name} ({s.location}) — {s.plan}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <PortalCard
          title={`${currentSerialLabel} · ${currentSalon.name} — Connection Health & Billing Summary`}
          kicker={`REGION: ${regionConfig.regionLabel.toUpperCase()} · READ-ONLY`}
          onClose={onClose}
        >
          <div className="space-y-5 min-w-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 font-mono min-w-0">
              <div className="rounded-2xl border border-[#30363D] bg-[#0D1117] p-3.5 min-w-0 overflow-hidden">
                <span className="text-[10px] text-[#8B949E] uppercase block">SALON OWNER</span>
                <p className="text-sm font-bold text-[#F0F6FC] mt-1 break-words [overflow-wrap:break-word]">{currentSalon.owner}</p>
                <p className="text-[11px] text-[#06B6D4] mt-0.5 break-all [overflow-wrap:break-word]">{currentSalon.phone}</p>
              </div>
              <div className="rounded-2xl border border-[#9E6A03] bg-[#3B2E0B] p-3.5 min-w-0 overflow-hidden">
                <span className="text-[10px] text-[#D29922] uppercase block">ACTIVE PACKAGE</span>
                <p className="text-sm font-bold text-[#F0F6FC] mt-1 break-words [overflow-wrap:break-word]">{currentSalon.plan}</p>
                <p className="text-[11px] text-[#8B949E] mt-0.5">
                  Setup: {regionConfig.symbol}{currentPackage.setupFee.toLocaleString()}
                </p>
              </div>
              <div className="rounded-2xl border border-[#116329] bg-[#0D3822] p-3.5">
                <span className="text-[10px] text-[#3FB950] uppercase block">MONTHLY MAINTENANCE FEE (DUE 5TH)</span>
                <p className="text-sm font-bold text-[#3FB950] mt-1">
                  {regionConfig.symbol}{currentSalon.maint.toLocaleString()} / mo
                </p>
                <p className="text-[11px] text-[#8B949E] mt-0.5">
                  Status: {maintCycleStage === 'OVERDUE_TIER_2' ? 'Overdue After 5th' : maintCycleStage === 'PAID_ACTIVE' ? 'Paid ✓' : 'Reminder Active'}
                </p>
              </div>
              <div className="rounded-2xl border border-[#30363D] bg-[#0D1117] p-3.5">
                <span className="text-[10px] text-[#06B6D4] uppercase block">ONBOARDING LANGUAGE</span>
                <p className="text-sm font-bold text-[#F0F6FC] mt-1">
                  {currentSalon.onboardingLanguage === 'ur'
                    ? 'Urdu (اردو)'
                    : currentSalon.onboardingLanguage === 'ar'
                    ? 'Arabic (العربية)'
                    : 'English'}
                </p>
                <p className="text-[11px] text-[#8B949E] mt-0.5">
                  All Founder msgs sent in this lang
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-[#30363D] bg-[#0D1117] p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs font-mono font-bold text-[#D29922] uppercase">
                  Founder Notice Preview (Auto-Translated to Owner's Onboarding Language):
                </span>
              </div>
              <div
                dir={currentSalon.onboardingLanguage === 'ur' || currentSalon.onboardingLanguage === 'ar' ? 'rtl' : 'ltr'}
                className={`rounded-xl border border-[#30363D] bg-[#161B22] p-3 text-xs text-[#F0F6FC] font-sans leading-relaxed overflow-hidden break-words [overflow-wrap:break-word] ${
                  currentSalon.onboardingLanguage === 'ur' || currentSalon.onboardingLanguage === 'ar' ? 'text-right' : 'text-left'
                }`}
              >
                {getFounderNoticeForOwner(currentSalon.onboardingLanguage)}
              </div>
              <p className="text-[11px] font-mono text-[#6E7681] break-words [overflow-wrap:break-word]">
                Today&apos;s Live Queue, Salon Strategy Matrix Boxes, Multi-Service Carts, and Voice Concierge belong exclusively inside the authenticated Salon Owner session.
              </p>
            </div>
          </div>
        </PortalCard>
      </div>
    );
  }

  const handleActivateBilling = async () => {
    if (isActivatingBilling) return;
    setIsActivatingBilling(true);
    try {
      const res = await fetch(
        `/api/salons/${encodeURIComponent(currentSalon.id)}/activate-billing`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ billingStatus: 'ACTIVE' }),
        }
      );
      if (res.ok) {
        const data = (await res.json()) as { state?: SalonConciergeStateResponse };
        if (data.state) setConciergeState(data.state);
        setMaintToast('Billing activated! Automated WhatsApp blasts are now unlocked.');
        setTimeout(() => setMaintToast(null), 4000);
      }
    } finally {
      setIsActivatingBilling(false);
    }
  };

  // ============================================================================
  // COMPUTED OPERATIONAL METRICS FOR LIVE STATUS STRIP, PACKAGE TIER & TIMELINE
  // ============================================================================
  const packageTier: SalonPackageTier =
    currentSalon.planId === 'STARTER'
      ? 'STARTER'
      : currentSalon.planId === 'GROWTH'
      ? 'PRO'
      : 'PRO++';

  const sortedBookings = [...bookings].sort(
    (a, b) => parseTimeSlotMinutes(a.timeSlot) - parseTimeSlotMinutes(b.timeSlot)
  );
  const todayTotalRevenue = bookings.reduce((sum, b) => sum + b.price, 0);
  // Package Tier Gating: STARTER hides Bridal/Deposit SLA Locks & Google Rating Booster Alerts
  const unverifiedDeposits =
    packageTier === 'STARTER' ? [] : pendingDeposits.filter((d) => !d.verified);
  const pendingDepositsTotal = unverifiedDeposits.reduce((sum, d) => sum + d.amount, 0);
  const activeReviewAlerts =
    packageTier === 'STARTER'
      ? []
      : (conciergeState?.alerts || []).filter((a) => a.status === 'OWNER_INTERVENTION_NEEDED');
  const openHandovers = handoverRequests.filter((h) => !h.handled);
  const totalUrgentCount =
    activeReviewAlerts.length + unverifiedDeposits.length + openHandovers.length;
  const activeChairLocks = conciergeState?.chairLocks || [];

  // Top Booked Services paired with most-requested stylist & share %
  const topServicesWithStylists = isLadies
    ? [
        {
          service: 'Signature Party Makeup & Styling',
          stylist: barbersList[0] || 'Ayesha',
          pct: 61,
          bookingsCount: 19,
        },
        {
          service: 'Hydra-Facial & Skin Polish',
          stylist: barbersList[1] || barbersList[0] || 'Hina',
          pct: 55,
          bookingsCount: 14,
        },
        {
          service: 'Keratin Hair Protein Treatment',
          stylist: barbersList[2] || barbersList[0] || 'Sara',
          pct: 49,
          bookingsCount: 9,
        },
      ]
    : [
        {
          service: 'Master Haircut & Skin Fade',
          stylist: barbersList[0] || 'Master Aslam',
          pct: 64,
          bookingsCount: 24,
        },
        {
          service: 'Classic Beard Trim & Sculpt',
          stylist: barbersList[1] || barbersList[0] || 'Tariq Mehmood',
          pct: 58,
          bookingsCount: 18,
        },
        {
          service: 'Charcoal Deep Detox Facial',
          stylist: barbersList[2] || barbersList[0] || 'Ali Raza',
          pct: 52,
          bookingsCount: 11,
        },
      ];

  // ============================================================================
  // SALON OWNER FULL PWA DASHBOARD (MATTE OBSIDIAN · LIVE FLOOR + MANAGE)
  // ============================================================================
  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-28 lg:pb-10 min-w-0">
      {/* ========================================================================= */}
      {/* TOP STATUS STRIP (ALWAYS VISIBLE · COMPACT DAILY OPERATIONS HEADER)       */}
      {/* ========================================================================= */}
      <div className="rounded-2xl border border-[#30363D] bg-[#161B22] p-4 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* WhatsApp Gateway Connection Badge (#3FB950 on #0D3822) + Strict Tier Badge */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-xl border border-[#116329] bg-[#0D3822] px-3 py-1.5 text-xs font-mono font-bold text-[#3FB950]">
              <span className="size-2 rounded-full bg-[#3FB950]" />
              <span>{ui.whatsappConnected}</span>
            </div>
            <span
              className={`rounded-xl border px-2.5 py-1.5 text-[11px] font-mono font-bold ${
                packageTier === 'STARTER'
                  ? 'border-[#30363D] bg-[#0D1117] text-[#8B949E]'
                  : packageTier === 'PRO'
                  ? 'border-[#06B6D4] bg-[#0D1117] text-[#06B6D4]'
                  : 'border-[#9E6A03] bg-[#3B2E0B] text-[#D29922]'
              }`}
            >
              TIER: {packageTier}
            </span>
          </div>

          {/* Top-Right Cluster: Region-Filtered Language Pills + Top-Right Upgrade + Speaker Mute + Voice Quick Jump */}
          <div className="flex flex-wrap items-center justify-end gap-2">
            {/* Desktop Mode Switcher (4 Clean Tabs matching Mobile Bottom Bar) */}
            <div className="hidden lg:inline-flex items-center rounded-xl border border-[#30363D] bg-[#0D1117] p-1 gap-1 mr-1">
              <button
                type="button"
                onClick={() => setSectionMode('LIVE')}
                className={`min-h-[36px] rounded-lg px-3 py-1 text-xs font-mono font-bold transition flex items-center gap-1.5 ${
                  currentSectionMode === 'LIVE'
                    ? 'bg-[#06B6D4] text-[#0D1117]'
                    : 'text-[#8B949E] hover:text-[#F0F6FC]'
                }`}
              >
                <Scissors className="size-3.5" />
                <span>{ui.liveFloor}</span>
              </button>
              <button
                type="button"
                onClick={() => setSectionMode('PASSES')}
                className={`min-h-[36px] rounded-lg px-3 py-1 text-xs font-mono font-bold transition flex items-center gap-1.5 ${
                  currentSectionMode === 'PASSES'
                    ? 'bg-[#06B6D4] text-[#0D1117]'
                    : 'text-[#8B949E] hover:text-[#F0F6FC]'
                }`}
              >
                <Award className="size-3.5" />
                <span>{ui.passesEvents}</span>
              </button>
              <button
                type="button"
                onClick={() => setSectionMode('VOICE')}
                className={`relative min-h-[36px] rounded-lg px-3 py-1 text-xs font-mono font-bold transition flex items-center gap-1.5 ${
                  currentSectionMode === 'VOICE'
                    ? 'bg-[#06B6D4] text-[#0D1117]'
                    : 'text-[#8B949E] hover:text-[#F0F6FC]'
                }`}
              >
                <Mic className="size-3.5" />
                <span>{ui.voiceHelp}</span>
                {hasFounderVoiceReply && currentSectionMode !== 'VOICE' && (
                  <span className="size-2 rounded-full bg-[#3FB950]" aria-hidden="true" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setSectionMode('MANAGE')}
                className={`min-h-[36px] rounded-lg px-3 py-1 text-xs font-mono font-bold transition flex items-center gap-1.5 ${
                  currentSectionMode === 'MANAGE'
                    ? 'bg-[#06B6D4] text-[#0D1117]'
                    : 'text-[#8B949E] hover:text-[#F0F6FC]'
                }`}
              >
                <SlidersHorizontal className="size-3.5" />
                <span>{ui.manage}</span>
              </button>
            </div>

            {/* Clean Separate Language Switcher (PK/IN: EN & UR only; MENA/Europe: AR, EN & UR) */}
            <div
              className="inline-flex items-center rounded-xl border border-[#30363D] bg-[#0D1117] p-1 gap-0.5"
              role="group"
              aria-label="Dashboard Language"
            >
              {allowedLangs.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setOwnerLang(code)}
                  className={`min-h-[34px] rounded-lg px-2.5 py-1 text-[11px] font-mono font-bold transition ${
                    ownerLang === code
                      ? 'bg-[#06B6D4]/20 border border-[#06B6D4]/50 text-[#06B6D4]'
                      : 'text-[#8B949E] hover:text-[#F0F6FC] border border-transparent'
                  }`}
                >
                  {code === 'ur' ? 'اردو' : code === 'ar' ? 'العربية' : 'EN'}
                </button>
              ))}
            </div>

            {/* Top-Right Upgrade CTA (Shows only remaining higher tiers & difference amount) */}
            {higherPackages.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSelectedUpgradeTargetId(higherPackages[0].id);
                  setUpgradeModalError(null);
                  setIsUpgradeModalOpen(true);
                }}
                className="min-h-[42px] rounded-xl bg-[#D29922] hover:bg-[#e0b252] text-[#0D1117] px-3.5 py-1.5 text-xs font-mono font-black uppercase transition flex items-center gap-1.5 shadow-md"
              >
                <ArrowUpCircle className="size-4 shrink-0" />
                <span>
                  {ownerLang === 'ur'
                    ? 'اپگریڈ'
                    : ownerLang === 'ar'
                    ? 'ترقية الباقة'
                    : 'Upgrade'}
                </span>
              </button>
            )}

            {/* Clear Aloud Voice Toggle (Open = Speaks Aloud | Turned Off = Muted) */}
            <button
              type="button"
              onClick={() => setIsVoiceEnabled(!isVoiceEnabled)}
              className={`min-h-[42px] rounded-xl border px-2.5 inline-flex items-center gap-1.5 text-[11px] font-mono font-bold transition ${
                isVoiceEnabled
                  ? 'border-[#06B6D4]/50 bg-[#0D1117] text-[#06B6D4]'
                  : 'border-[#30363D] bg-[#0D1117] text-[#6E7681]'
              }`}
              title={isVoiceEnabled ? 'Speaker ON: System speaks aloud' : 'Speaker OFF: Spoken voice muted'}
              aria-label="Toggle spoken voice announcements"
            >
              {isVoiceEnabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
              <span className="hidden sm:inline">
                {isVoiceEnabled
                  ? ownerLang === 'ur'
                    ? 'آواز آن'
                    : ownerLang === 'ar'
                    ? 'صوت مفعّل'
                    : 'Voice ON'
                  : ownerLang === 'ur'
                  ? 'میوٹ'
                  : ownerLang === 'ar'
                  ? 'صامت'
                  : 'Muted'}
              </span>
            </button>

            {!isAudioUnlocked && !isFounderInspector && (
              <button
                type="button"
                onClick={handleUnlockMobileAudio}
                className="min-h-[42px] rounded-xl border border-[#06B6D4] bg-[#06B6D4]/15 hover:bg-[#06B6D4]/25 px-3 text-xs font-mono font-bold text-[#06B6D4] transition flex items-center gap-1.5"
                title="Tap once on mobile so loud chimes & spoken alerts play automatically"
              >
                <Volume2 className="size-4 shrink-0" />
                <span>{ui.tapEnableAudio}</span>
              </button>
            )}

            <button
              type="button"
              onClick={scrollToFounderVoiceSupport}
              className="relative min-h-[42px] rounded-xl border border-[#30363D] bg-[#0D1117] hover:border-[#06B6D4] px-2.5 text-xs font-mono font-bold text-[#06B6D4] transition flex items-center gap-1.5"
              title={ui.voiceSupportTitle}
              aria-label={ui.voiceSupportTitle}
            >
              <Mic className="size-4 shrink-0" />
              {hasFounderVoiceReply && (
                <span className="size-2 rounded-full bg-[#3FB950]" aria-hidden="true" />
              )}
            </button>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="min-h-[42px] min-w-[42px] rounded-xl border border-[#30363D] bg-[#0D1117] text-[#8B949E] hover:text-[#F0F6FC] grid place-items-center transition"
                title="Close Portal"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </div>

        {/* Non-Blocking Mass WhatsApp Blast Quarantine Banner (PENDING_ACTIVATION) */}
        {conciergeState?.settings?.billingStatus &&
          conciergeState.settings.billingStatus !== 'ACTIVE' && (
            <div className="rounded-xl border border-[#9E6A03] bg-[#3B2E0B] p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="space-y-0.5 min-w-0">
                <span className="text-[11px] font-mono font-bold text-[#D29922] uppercase block">
                  BILLING: {conciergeState.settings.billingStatus} · AUTOMATED MASS BLASTS QUARANTINED
                </span>
                <p className="text-xs font-sans text-[#F0F6FC] leading-snug">
                  Your Live Floor Dashboard, chair locks, and single-client confirmations are active immediately. Scheduled mass WhatsApp blasts unlock automatically once billing is activated.
                </p>
              </div>
              {isFounderInspector && (
                <button
                  type="button"
                  disabled={isActivatingBilling}
                  onClick={handleActivateBilling}
                  className="min-h-[44px] rounded-xl bg-[#3FB950] hover:bg-[#4ec961] text-[#0D1117] px-3.5 py-2 text-xs font-mono font-bold uppercase transition shrink-0 disabled:opacity-60"
                >
                  {isActivatingBilling ? 'Activating...' : 'Activate Billing & Unlock Blasts →'}
                </button>
              )}
            </div>
          )}

        {/* Salon Switcher: Strictly hidden for tenant-locked SALON_OWNER sessions; visible only for Founder preview */}
        {!onboardedData && !lockedSalonId && authUser?.userRole === 'FOUNDER' && (
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#21262D]">
            <span className="text-[10px] font-mono font-bold uppercase text-[#8B949E]">
              {ui.activeShopTier}
            </span>
            {salonsState.map((s) => {
              const sTier: SalonPackageTier =
                s.planId === 'STARTER' ? 'STARTER' : s.planId === 'GROWTH' ? 'PRO' : 'PRO++';
              const active = s.id === currentSalon.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedSalonId(s.id)}
                  className={`min-h-[36px] rounded-lg border px-2.5 py-1 text-[11px] font-mono font-bold transition ${
                    active
                      ? 'border-[#06B6D4] bg-[#0D1117] text-[#06B6D4]'
                      : 'border-[#30363D] bg-[#0D1117] text-[#8B949E] hover:text-[#F0F6FC]'
                  }`}
                >
                  {s.name.split(' ')[0]} ({sTier})
                </button>
              );
            })}
          </div>
        )}

        {/* Salon Title + Today's Total Revenue & Tier-Gated Secondary Metric */}
        <div
          dir={isOwnerRtl ? 'rtl' : 'ltr'}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-[#21262D]"
        >
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-black text-[#F0F6FC] truncate">
              {currentSalon.name}
            </h1>
            <p className="text-xs text-[#8B949E] font-mono truncate">
              {currentSalon.owner} · <span dir="ltr">{currentSalon.phone}</span> · {currentSalon.plan}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:flex sm:items-center shrink-0">
            <div className="rounded-xl border border-[#30363D] bg-[#0D1117] px-3.5 py-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#8B949E] block">
                {ui.todayRevenue}
              </span>
              <span dir="ltr" className="text-base sm:text-lg font-black font-mono tabular-nums text-[#D29922]">
                {regionConfig.symbol}
                {todayTotalRevenue.toLocaleString()}
              </span>
            </div>
            {packageTier === 'STARTER' ? (
              <div className="rounded-xl border border-[#116329] bg-[#0D3822] px-3.5 py-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#3FB950] block">
                  {ui.reminders24_2}
                </span>
                <span className="text-base sm:text-lg font-black font-mono tabular-nums text-[#3FB950]">
                  {ui.activeTick}
                </span>
              </div>
            ) : (
              <div className="rounded-xl border border-[#30363D] bg-[#0D1117] px-3.5 py-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#8B949E] block">
                  {ui.pendingDeposits}
                </span>
                <span dir="ltr" className="text-base sm:text-lg font-black font-mono tabular-nums text-[#D29922]">
                  {regionConfig.symbol}
                  {pendingDepositsTotal.toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Counter Wake Standby Banner */}
        {isCounterSleeping && (
          <div className="rounded-xl border border-[#9E6A03] bg-[#3B2E0B] px-3.5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-start gap-2.5 text-xs text-[#F0F6FC]">
              <Moon className="size-4 text-[#D29922] shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-[#D29922] font-mono">
                  Counter Wake: OFF (since {counterSleptAt || 'Closing'}) · 24/7 WhatsApp Backend Live
                </p>
                <p className="text-[#F0F6FC]/90 font-sans mt-0.5">
                  {overnightQueue.length} overnight WhatsApp message(s) queued quietly. Tap &ldquo;{ui.wakeOn}&rdquo; in the morning to replay aloud.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleToggleCounterSleep}
              className="min-h-[48px] rounded-xl bg-[#D29922] hover:bg-[#e0b252] text-[#0D1117] px-4 py-2 text-xs font-mono font-black uppercase shrink-0 transition"
            >
              {ui.wakeOn} ({overnightQueue.length})
            </button>
          </div>
        )}

        {/* Active Speaking Indicator or Toast */}
        {currentlySpeakingText && (
          <div className="rounded-xl border border-[#30363D] bg-[#0D1117] px-3.5 py-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-mono text-[#06B6D4] min-w-0">
              <Radio className="size-4 shrink-0" />
              <span
                dir={ownerLang === 'ur' || ownerLang === 'ar' ? 'rtl' : 'ltr'}
                className="font-sans text-[#F0F6FC] truncate"
              >
                &ldquo;{currentlySpeakingText}&rdquo;
              </span>
            </div>
            <button
              type="button"
              onClick={stopSpeaking}
              className="min-h-[36px] rounded-lg border border-[#30363D] bg-[#161B22] px-2.5 text-[11px] font-mono text-[#F0F6FC] shrink-0"
            >
              {ui.stop}
            </button>
          </div>
        )}

        {wakeLockNote && (
          <div className="rounded-xl border border-[#30363D] bg-[#0D1117] px-3.5 py-2 text-xs font-mono text-[#06B6D4] flex items-center justify-between gap-2">
            <span>{wakeLockNote}</span>
            <button
              type="button"
              onClick={() => setWakeLockNote(null)}
              className="text-[#8B949E] hover:text-[#F0F6FC] shrink-0"
            >
              ✕
            </button>
          </div>
        )}

        {maintToast && (
          <div className="rounded-xl border border-[#116329] bg-[#0D3822] px-3.5 py-2.5 text-xs font-mono text-[#3FB950] flex items-center justify-between gap-3">
            <span className="break-words [overflow-wrap:break-word]">{maintToast}</span>
            <button
              type="button"
              onClick={() => setMaintToast(null)}
              className="text-[#8B949E] hover:text-[#F0F6FC] font-bold shrink-0"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Overdue / Due-Day Maintenance Alert Banner (Only visible if unpaid) */}
      {maintCycleStage !== 'PAID_ACTIVE' && (
        <div
          className={`rounded-2xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            isMaintenanceOverdue || maintCycleStage === 'STAGE_3_DAY_5_FINAL'
              ? 'border-[#da3633] bg-[#4C1C1D]'
              : 'border-[#9E6A03] bg-[#3B2E0B]'
          }`}
        >
          <div className="flex items-start gap-2.5 min-w-0">
            <AlertTriangle className="size-5 text-[#D29922] shrink-0 mt-0.5" />
            <p className="text-xs text-[#F0F6FC] font-sans leading-relaxed">
              {getMaintenanceReminderMessage(maintCycleStage, ownerLang)}
            </p>
          </div>
          <button
            type="button"
            disabled={isPayingMaint}
            onClick={() => setIsMaintPaymentModalOpen(true)}
            className="min-h-[48px] rounded-xl bg-[#06B6D4] hover:bg-[#22D3EE] text-[#0D1117] px-4 py-2 text-xs font-mono font-bold uppercase shrink-0 transition"
          >
            Pay {regionConfig.symbol}
            {currentSalon.maint.toLocaleString()} →
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 1: MAIN SALON LIVE DASHBOARD (DAILY OPERATIONS ONLY)                 */}
      {/* ========================================================================= */}
      {currentSectionMode === 'LIVE' && (
        <div className="space-y-4">
          {/* 1. URGENT ALERTS CARD (TOP PRIORITY · GATED BY PACKAGE TIER) */}
          {totalUrgentCount > 0 && (
            <section
              aria-label="Urgent Floor Alerts"
              dir={isOwnerRtl ? 'rtl' : 'ltr'}
              className="rounded-2xl border border-[#9E6A03] bg-[#161B22] p-4 sm:p-5 space-y-3"
            >
              <div className="flex items-center justify-between gap-2 border-b border-[#30363D] pb-2.5">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-4 text-[#D29922] shrink-0" />
                  <h2 className="text-sm font-black uppercase tracking-wider text-[#F0F6FC]">
                    {ui.urgentAlerts}
                  </h2>
                </div>
                <span className="rounded-lg border border-[#9E6A03] bg-[#3B2E0B] px-2.5 py-0.5 text-[11px] font-mono font-bold text-[#D29922]">
                  {totalUrgentCount} {ui.actionRequired}
                </span>
              </div>

              <div className="space-y-2.5">
                {/* A. OWNER_INTERVENTION_NEEDED (1–3 Star Feedback Alerts - PRO / PRO++ ONLY) */}
                {activeReviewAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="rounded-xl border border-[#da3633] bg-[#4C1C1D] p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded bg-[#0D1117] border border-[#da3633] px-2 py-0.5 text-[10px] font-mono font-bold text-[#F85149]">
                          OWNER_INTERVENTION_NEEDED · {alert.rating}★
                        </span>
                        <span className="text-xs font-mono text-[#D29922]">
                          Google Link Suppressed
                        </span>
                      </div>
                      <p className="text-sm font-bold text-[#F0F6FC]">
                        {alert.clientName} (<span dir="ltr">{alert.clientPhone}</span>) — {alert.service}
                      </p>
                      <p className="text-xs text-[#F0F6FC]/90 font-sans break-words [overflow-wrap:break-word]">
                        &ldquo;{alert.feedbackText}&rdquo;
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleResolveOwnerAlert(alert.id)}
                      className="min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] hover:border-[#3FB950] px-4 py-2 text-xs font-mono font-bold text-[#3FB950] shrink-0 transition"
                    >
                      {ui.markResolved}
                    </button>
                  </div>
                ))}

                {/* B. Unverified Raast / EasyPaisa Deposit Screenshots (PRO / PRO++ ONLY) */}
                {unverifiedDeposits.map((dep) => {
                  const isExpanded = expandedDepositReceiptId === dep.id;
                  return (
                    <div
                      key={dep.id}
                      className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3.5 space-y-2.5"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded bg-[#3B2E0B] border border-[#9E6A03] px-2 py-0.5 text-[10px] font-mono font-bold text-[#D29922] flex items-center gap-1">
                              <Banknote className="size-3" />
                              <span>{dep.method} Deposit Screenshot</span>
                            </span>
                            <span className="text-[11px] font-mono text-[#8B949E]">
                              {dep.receivedAt} · {dep.timeSlot}
                            </span>
                          </div>
                          <p className="text-sm font-bold text-[#F0F6FC]">
                            {dep.clientName} ·{' '}
                            <span dir="ltr" className="font-mono text-[#D29922] tabular-nums">
                              {regionConfig.symbol}
                              {dep.amount.toLocaleString()}
                            </span>
                          </p>
                          <p className="text-xs font-mono text-[#8B949E] break-all">
                            Ref: {dep.referenceId} · <span dir="ltr">{dep.phone}</span>
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedDepositReceiptId(isExpanded ? null : dep.id)
                            }
                            className="min-h-[48px] rounded-xl border border-[#30363D] bg-[#161B22] hover:border-[#06B6D4] px-3 py-2 text-xs font-mono font-bold text-[#06B6D4] transition"
                          >
                            {isExpanded ? ui.hideProof : ui.viewScreenshot}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPendingDeposits((prev) =>
                                prev.map((item) =>
                                  item.id === dep.id ? { ...item, verified: true } : item
                                )
                              );
                              setMaintToast(
                                `✓ Verified ${dep.method} deposit (${regionConfig.symbol}${dep.amount.toLocaleString()}) from ${dep.clientName}.`
                              );
                              setTimeout(() => setMaintToast(null), 4000);
                            }}
                            className="min-h-[48px] rounded-xl bg-[#0D3822] border border-[#116329] hover:bg-[#116329]/50 px-4 py-2 text-xs font-mono font-bold text-[#3FB950] transition"
                          >
                            {ui.verifyDeposit}
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="rounded-xl border border-[#30363D] bg-[#161B22] p-3 text-xs font-mono text-[#8B949E] flex flex-wrap items-center justify-between gap-2">
                          <span>
                            WhatsApp Image Attachment · Sender: {dep.phone} · TID: {dep.referenceId}
                          </span>
                          <span className="text-[#D29922] font-bold">
                            Amount: {regionConfig.symbol}
                            {dep.amount.toLocaleString()} ({dep.method})
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* C. Human Handover Requests */}
                {openHandovers.map((req) => (
                  <div
                    key={req.id}
                    className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded bg-[#21262D] border border-[#30363D] px-2 py-0.5 text-[10px] font-mono font-bold text-[#06B6D4] flex items-center gap-1">
                          <PhoneCall className="size-3" />
                          <span>Human Handover Request</span>
                        </span>
                        <span className="text-[11px] font-mono text-[#8B949E]">
                          {req.receivedAt} · {req.lang.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-[#F0F6FC]">
                        {req.clientName} (<span dir="ltr" className="font-mono text-[#06B6D4]">{req.phone}</span>)
                      </p>
                      <p className="text-xs text-[#8B949E] font-sans break-words [overflow-wrap:break-word]">
                        {req.summary}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setHandoverRequests((prev) =>
                          prev.map((h) => (h.id === req.id ? { ...h, handled: true } : h))
                        );
                        setMaintToast(`✓ Handover request for ${req.clientName} marked handled.`);
                        setTimeout(() => setMaintToast(null), 4000);
                      }}
                      className="min-h-[48px] rounded-xl border border-[#30363D] bg-[#161B22] hover:border-[#06B6D4] px-4 py-2 text-xs font-mono font-bold text-[#06B6D4] shrink-0 transition"
                    >
                      {ui.markHandled}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 2. QUICK CHAIR LOCK (VOICE BLOCKER + 2-TAP PILLS + WHATSAPP BUSY-REROUTE) */}
          <section
            aria-label="Quick Chair Lock"
            dir={isOwnerRtl ? 'rtl' : 'ltr'}
            className="rounded-2xl border border-[#30363D] bg-[#161B22] p-4 sm:p-5 space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#30363D] pb-3.5">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Lock className="size-4 text-[#58A6FF] shrink-0" />
                  <h2 className="text-base sm:text-lg font-black text-[#F0F6FC]">
                    {ui.quickChairLock}
                  </h2>
                </div>
                <p className="text-xs text-[#8B949E] font-sans mt-0.5">
                  {ui.quickChairSub}
                </p>
              </div>

              {/* Tap OR Hold to Speak Mic Button (supports Tap-to-Start / Tap-to-Stop & MediaRecorder fallback) */}
              <button
                type="button"
                disabled={isTranscribingChairMic}
                onPointerDown={handleChairMicPointerDown}
                onPointerUp={handleChairMicPointerUp}
                className={`min-h-[48px] rounded-xl px-5 py-2.5 text-xs font-mono font-black uppercase transition flex items-center justify-center gap-2 shrink-0 select-none touch-manipulation ${
                  isListeningMic
                    ? 'bg-[#F85149] text-[#0D1117]'
                    : isTranscribingChairMic
                    ? 'bg-[#06B6D4] text-[#0D1117] opacity-80'
                    : 'bg-[#D29922] hover:bg-[#e0b252] text-[#0D1117]'
                }`}
              >
                {isTranscribingChairMic ? (
                  <>
                    <RefreshCw className="size-4 animate-spin" />
                    <span>{ui.transcribingLock}</span>
                  </>
                ) : isListeningMic ? (
                  <>
                    <MicOff className="size-4" />
                    <span dir="ltr" className="tabular-nums">
                      00:{String(micElapsedSecs).padStart(2, '0')} / 00:30 · {ui.tapStopLock}
                    </span>
                  </>
                ) : (
                  <>
                    <Mic className="size-4" />
                    <span>{ui.holdOrTapSpeakBtn}</span>
                  </>
                )}
              </button>
            </div>

            {/* Live Transcript / $0.00 Local JS Intent Parser Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!voiceTranscript.trim()) return;
                const intent = parseVoiceChairIntent(voiceTranscript, barbersList);
                executeChairLock({
                  ...intent,
                  source: 'VOICE',
                  transcript: voiceTranscript.trim(),
                  silent: false,
                });
                setVoiceTranscript('');
              }}
              className="flex flex-col sm:flex-row gap-2"
            >
              <input
                type="text"
                dir="ltr"
                value={voiceTranscript}
                onChange={(e) => setVoiceTranscript(e.target.value)}
                placeholder={ui.voicePlaceholder}
                className="flex-1 min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3.5 py-2 text-sm text-left [unicode-bidi:isolate] text-[#F0F6FC] placeholder:text-[#484F58] focus:border-[#06B6D4] focus:outline-none"
              />
              <button
                type="submit"
                className="min-h-[48px] rounded-xl border border-[#1F6FEB] bg-[#0D2138] hover:bg-[#132e4d] px-4 py-2 text-xs font-mono font-bold text-[#58A6FF] shrink-0 transition"
              >
                {ui.parseAndLockBtn}
              </button>
            </form>

            {/* Barber Chair Cards with 2-Tap Silent Quick Duration Pills (+30m / +1h) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {barbersList.map((barber, idx) => {
                const chairName = barberChairs[barber] || `Chair #${idx + 1}`;
                const activeLock = activeChairLocks.find(
                  (l) => l.barberName.toLowerCase() === barber.toLowerCase()
                );
                const isArmed30 =
                  armedQuickPill?.barber === barber && armedQuickPill.durationMins === 30;
                const isArmed60 =
                  armedQuickPill?.barber === barber && armedQuickPill.durationMins === 60;

                return (
                  <div
                    key={barber}
                    className={`rounded-xl border p-3.5 flex flex-col justify-between gap-2.5 ${
                      activeLock
                        ? 'border-[#1F6FEB] bg-[#0D2138]'
                        : 'border-[#30363D] bg-[#0D1117]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#F0F6FC] truncate">{barber}</p>
                        <p className="text-[11px] font-mono text-[#8B949E] truncate">{chairName}</p>
                      </div>
                      {activeLock ? (
                        <span className="rounded-md border border-[#1F6FEB] bg-[#0D1117] px-2 py-0.5 text-[10px] font-mono font-bold text-[#58A6FF] shrink-0">
                          {ui.busy} <span dir="ltr">{activeLock.startTimeSlot}–{activeLock.endTimeSlot}</span>
                        </span>
                      ) : (
                        <span className="rounded-md border border-[#116329] bg-[#0D3822] px-2 py-0.5 text-[10px] font-mono font-bold text-[#3FB950] shrink-0">
                          {ui.freeNow}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleQuickPillTap(barber, 30)}
                        className={`flex-1 min-h-[48px] rounded-xl border px-3 py-2 text-xs font-mono font-bold transition ${
                          isArmed30
                            ? 'border-[#D29922] bg-[#3B2E0B] text-[#D29922]'
                            : 'border-[#30363D] bg-[#161B22] hover:border-[#58A6FF] text-[#F0F6FC]'
                        }`}
                      >
                        {isArmed30 ? ui.tapAgain30 : ui.plus30}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickPillTap(barber, 60)}
                        className={`flex-1 min-h-[48px] rounded-xl border px-3 py-2 text-xs font-mono font-bold transition ${
                          isArmed60
                            ? 'border-[#D29922] bg-[#3B2E0B] text-[#D29922]'
                            : 'border-[#30363D] bg-[#161B22] hover:border-[#58A6FF] text-[#F0F6FC]'
                        }`}
                      >
                        {isArmed60 ? ui.tapAgain60 : ui.plus60}
                      </button>
                      {activeLock && (
                        <button
                          type="button"
                          onClick={() => handleReleaseChairLock(activeLock.id, barber)}
                          className="min-h-[48px] rounded-xl border border-[#116329] bg-[#0D3822] px-3 py-2 text-xs font-mono font-bold text-[#3FB950] transition"
                        >
                          {ui.freeChair}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 3. TODAY'S LIVE SCHEDULE & CHAIR TIMELINE (AUTO-COMPLETE +15M & SOURCE BADGES) */}
          <section
            aria-label="Today's Live Schedule and Chair Timeline"
            dir={isOwnerRtl ? 'rtl' : 'ltr'}
            className="rounded-2xl border border-[#30363D] bg-[#161B22] p-4 sm:p-5 space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#30363D] pb-3.5">
              <div>
                <div className="flex items-center gap-2">
                  <Calendar className="size-4 text-[#06B6D4]" />
                  <h2 className="text-base sm:text-lg font-black text-[#F0F6FC]">
                    {ui.todayScheduleTitle}
                  </h2>
                </div>
                <p className="text-xs text-[#8B949E] font-mono mt-0.5 tabular-nums">
                  {sortedBookings.length} scheduled ·{' '}
                  {sortedBookings.filter((b) => b.status === 'COMPLETED').length} completed · Auto-done +15m after end
                </p>
              </div>
              <span className="rounded-lg border border-[#30363D] bg-[#0D1117] px-3 py-1.5 text-[11px] font-mono text-[#8B949E]">
                {ui.unflaggedClear}
              </span>
            </div>

            <div className="space-y-2.5">
              {sortedBookings.map((booking) => {
                const chairTag =
                  booking.chairLabel ||
                  barberChairs[booking.barberName] ||
                  `Chair #${Math.max(1, barbersList.indexOf(booking.barberName) + 1)}`;
                const duration = booking.durationMins || 35;
                const isWalkInBusy = booking.sourceType === 'WALK_IN_BUSY';

                return (
                  <div
                    key={booking.id}
                    className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3.5 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      {/* Chronological Time & Duration Block */}
                      <div className="rounded-xl border border-[#30363D] bg-[#161B22] px-2.5 py-2 text-center shrink-0 min-w-[78px]">
                        <span className="text-xs font-mono font-black text-[#D29922] tabular-nums block">
                          {booking.timeSlot}
                        </span>
                        <span className="text-[10px] font-mono text-[#8B949E] tabular-nums block mt-0.5">
                          {duration} min
                        </span>
                      </div>

                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-[#F0F6FC]">
                            {booking.clientName}
                          </span>
                          {/* Distinct Source Badge: Green [WhatsApp Bot] vs Blue [Walk-In / Busy] */}
                          {isWalkInBusy ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-[#0D2138] border border-[#1F6FEB] px-2 py-0.5 text-[10px] font-mono font-bold text-[#58A6FF]">
                              <Lock className="size-3" />
                              <span>[Walk-In / Busy]</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-md bg-[#0D3822] border border-[#116329] px-2 py-0.5 text-[10px] font-mono font-bold text-[#3FB950]">
                              <MessageSquare className="size-3" />
                              <span>[WhatsApp Bot]</span>
                            </span>
                          )}
                          <span className="rounded-md bg-[#21262D] border border-[#30363D] px-2 py-0.5 text-[10px] font-mono text-[#06B6D4]">
                            {chairTag} · {booking.barberName}
                          </span>
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-mono font-bold border ${
                              booking.status === 'CONFIRMED'
                                ? 'bg-[#161B22] text-[#06B6D4] border-[#30363D]'
                                : booking.status === 'IN_CHAIR'
                                ? 'bg-[#3B2E0B] text-[#D29922] border-[#9E6A03]'
                                : 'bg-[#0D3822] text-[#3FB950] border-[#116329]'
                            }`}
                          >
                            {booking.status === 'IN_CHAIR' ? 'IN CHAIR' : booking.status}
                          </span>
                          {booking.flagged && (
                            <span className="rounded-md border border-[#9E6A03] bg-[#3B2E0B] px-2 py-0.5 text-[10px] font-mono font-bold text-[#D29922]">
                              Flagged · Held
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#8B949E] font-sans">{booking.service}</p>
                        <p className="text-[11px] font-mono text-[#6E7681]" dir="ltr">
                          {booking.phone}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between md:justify-end gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-[#21262D] shrink-0">
                      {booking.price > 0 && (
                        <span className="text-sm font-mono font-black text-[#D29922] tabular-nums mr-1">
                          {regionConfig.symbol}
                          {booking.price.toLocaleString()}
                        </span>
                      )}

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const ownerFirst = currentSalon.owner.split(' ')[0] || 'Hamza';
                            const urduText = `${ownerFirst} صاحب، آپ کے باربر ${booking.barberName} کے پاس ${booking.clientName} کی ${booking.timeSlot} پر بکنگ ہے۔ سروس: ${booking.service}۔`;
                            const arText = `${ownerFirst}، الحلاق ${booking.barberName} لديه موعد مع ${booking.clientName} في ${booking.timeSlot}. الخدمة: ${booking.service}.`;
                            const enText = `${ownerFirst}, your barber ${booking.barberName} has ${booking.clientName} at ${booking.timeSlot}: ${booking.service}.`;
                            const text =
                              ownerLang === 'ur' ? urduText : ownerLang === 'ar' ? arText : enText;
                            speakHandsFree(text, ownerLang);
                          }}
                          className="min-h-[48px] min-w-[48px] grid place-items-center rounded-xl border border-[#30363D] bg-[#161B22] hover:border-[#06B6D4] text-[#06B6D4] transition"
                          title="Speak booking aloud"
                          aria-label="Speak booking aloud"
                        >
                          <Volume2 className="size-4" />
                        </button>

                        {booking.status !== 'COMPLETED' && (
                          <button
                            type="button"
                            onClick={() => handleToggleFlagBooking(booking.id)}
                            className={`min-h-[48px] min-w-[48px] grid place-items-center rounded-xl border transition ${
                              booking.flagged
                                ? 'border-[#9E6A03] bg-[#3B2E0B] text-[#D29922]'
                                : 'border-[#30363D] bg-[#161B22] text-[#8B949E] hover:text-[#D29922]'
                            }`}
                            title={
                              booking.flagged
                                ? 'Flagged (excluded from 15m auto-done)'
                                : 'Flag to prevent 15m auto-completion'
                            }
                            aria-label="Toggle flag"
                          >
                            <Flag className="size-4" />
                          </button>
                        )}

                        {booking.status === 'CONFIRMED' && (
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(booking.id, 'IN_CHAIR')}
                            className="min-h-[48px] rounded-xl border border-[#9E6A03] bg-[#3B2E0B] hover:bg-[#3B2E0B]/80 px-3 py-2 text-xs font-mono font-bold text-[#D29922] transition"
                          >
                            {ui.seatBtn}
                          </button>
                        )}

                        {booking.status !== 'COMPLETED' ? (
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(booking.id, 'COMPLETED')}
                            className="min-h-[48px] rounded-xl border border-[#116329] bg-[#0D3822] hover:bg-[#116329]/60 px-3.5 py-2 text-xs font-mono font-bold text-[#3FB950] transition active:scale-95"
                          >
                            {ui.markDone}
                          </button>
                        ) : (
                          <span className="min-h-[48px] inline-flex items-center gap-1.5 rounded-xl border border-[#116329] bg-[#0D3822]/50 px-3 py-2 text-[11px] font-mono font-bold text-[#3FB950]">
                            <CheckCircle2 className="size-3.5" />
                            <span>
                              {packageTier === 'STARTER' ? ui.doneTick : ui.reviewQueued}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 3B. COMPACT COLLAPSIBLE WALK-IN WAITLIST BAR (Daily Counter Sync) */}
          <div dir={isOwnerRtl ? 'rtl' : 'ltr'}>
            <section
              aria-label="Live Walk-In Waitlist Queue"
              className="rounded-2xl border border-[#30363D] bg-[#161B22] p-3.5 sm:p-4 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setIsWalkInExpanded((v) => !v)}
                  className="flex items-center gap-2 text-left min-h-[36px]"
                >
                  <Clock className="size-4 text-[#06B6D4] shrink-0" />
                  <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-[#F0F6FC]">
                    {ui.walkInQueueTitle}
                  </h2>
                  <span className="rounded-md bg-[#0D1117] border border-[#30363D] px-2 py-0.5 text-[10px] font-mono text-[#D29922]">
                    {(conciergeState?.walkInQueue || []).filter((w) => w.status !== 'SEATED').length}
                  </span>
                  {isWalkInExpanded ? (
                    <ChevronUp className="size-4 text-[#8B949E]" />
                  ) : (
                    <ChevronDown className="size-4 text-[#8B949E]" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsWalkInExpanded(true);
                    setShowWalkInForm((v) => !v);
                  }}
                  className="min-h-[38px] inline-flex items-center gap-1 rounded-xl border border-[#06B6D4] bg-[#0D1117] px-3 py-1 text-[11px] font-mono font-bold text-[#06B6D4] transition"
                >
                  <Plus className="size-3.5" />
                  <span>{showWalkInForm && isWalkInExpanded ? ui.closeBtn : ui.addWalkIn}</span>
                </button>
              </div>

              {isWalkInExpanded && (
                <div className="space-y-3 pt-2 border-t border-[#21262D]">
                  {showWalkInForm && (
                    <form
                      onSubmit={handleAddWalkIn}
                      className="rounded-xl border border-[#06B6D4]/50 bg-[#0D1117] p-3 space-y-2.5"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          dir="ltr"
                          required
                          value={walkInName}
                          onChange={(e) => setWalkInName(e.target.value)}
                          placeholder="Guest name"
                          className="min-h-[44px] rounded-xl border border-[#30363D] bg-[#161B22] px-3 text-sm text-left [unicode-bidi:isolate] text-[#F0F6FC]"
                        />
                        <input
                          type="text"
                          dir="ltr"
                          value={walkInService}
                          onChange={(e) => setWalkInService(e.target.value)}
                          placeholder={isLadies ? 'Service (e.g. Party Makeup)' : 'Service (e.g. Skin Fade)'}
                          className="min-h-[44px] rounded-xl border border-[#30363D] bg-[#161B22] px-3 text-sm text-left [unicode-bidi:isolate] text-[#F0F6FC]"
                        />
                        <input
                          type="text"
                          dir="ltr"
                          value={walkInPhone}
                          onChange={(e) => setWalkInPhone(e.target.value)}
                          placeholder="WhatsApp (optional)"
                          className="min-h-[44px] rounded-xl border border-[#30363D] bg-[#161B22] px-3 text-sm text-left [unicode-bidi:isolate] font-mono text-[#F0F6FC]"
                        />
                        <input
                          type="number"
                          dir="ltr"
                          min={5}
                          max={180}
                          value={walkInEta}
                          onChange={(e) => setWalkInEta(e.target.value)}
                          placeholder="Wait mins"
                          className="min-h-[44px] rounded-xl border border-[#30363D] bg-[#161B22] px-3 text-sm text-left [unicode-bidi:isolate] font-mono text-[#D29922]"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isSavingOpsCard}
                        className="w-full min-h-[44px] rounded-xl bg-[#06B6D4] hover:bg-[#22D3EE] text-[#0D1117] text-xs font-mono font-black uppercase transition"
                      >
                        {ui.queueGuest}
                      </button>
                    </form>
                  )}

                  <div className="space-y-2">
                    {(conciergeState?.walkInQueue || []).filter((w) => w.status !== 'SEATED').length === 0 ? (
                      <p className="text-xs text-[#8B949E] font-sans rounded-xl border border-[#30363D] bg-[#0D1117] p-3">
                        {ui.noWalkIns}
                      </p>
                    ) : (
                      (conciergeState?.walkInQueue || [])
                        .filter((w) => w.status !== 'SEATED')
                        .map((guest) => (
                          <div
                            key={guest.id}
                            className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                          >
                            <div className="min-w-0 space-y-0.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-bold text-[#F0F6FC]">{guest.clientName}</span>
                                <span className="rounded bg-[#3B2E0B] border border-[#9E6A03] px-2 py-0.5 text-[10px] font-mono font-bold text-[#D29922]">
                                  ~{guest.etaMinutes} min
                                </span>
                              </div>
                              <p className="text-xs text-[#8B949E] font-sans truncate">
                                {guest.service} · {guest.assignedStaff}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {guest.status === 'WAITING' && (
                                <button
                                  type="button"
                                  onClick={() => void handleUpdateWalkInStatus(guest.id, 'NOTIFIED')}
                                  className="min-h-[40px] rounded-xl border border-[#06B6D4] bg-[#161B22] px-3 py-1.5 text-[11px] font-mono font-bold text-[#06B6D4]"
                                >
                                  {ui.callNext}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => void handleUpdateWalkInStatus(guest.id, 'SEATED')}
                                className="min-h-[40px] rounded-xl border border-[#116329] bg-[#0D3822] px-3 py-1.5 text-[11px] font-mono font-bold text-[#3FB950]"
                              >
                                {ui.seatBtn} ✓
                              </button>
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: DEDICATED "PASSES & EVENTS" (NON-DAILY PREPAID & BRIDAL TRACKING)  */}
      {/* ========================================================================= */}
      {currentSectionMode === 'PASSES' && (
        <div className="space-y-4" dir={isOwnerRtl ? 'rtl' : 'ltr'}>

            {/* Prepaid Multi-Session Packages & Membership Passes */}
            <section
              aria-label="Prepaid Multi-Session Packages"
              className="rounded-2xl border border-[#30363D] bg-[#161B22] p-4 sm:p-5 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#30363D] pb-2.5">
                <div className="flex items-center gap-2">
                  <Award className="size-4 text-[#D29922] shrink-0" />
                  <h2 className="text-sm font-black uppercase tracking-wider text-[#F0F6FC]">
                    {ui.prepaidPackagesTitle}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPackageForm((v) => !v)}
                  className="min-h-[40px] inline-flex items-center gap-1 rounded-xl border border-[#D29922] bg-[#0D1117] px-3 py-1 text-[11px] font-mono font-bold text-[#D29922] transition"
                >
                  <Plus className="size-3.5" />
                  <span>{showPackageForm ? ui.closeBtn : ui.issuePass}</span>
                </button>
              </div>

              {showPackageForm && (
                <form
                  onSubmit={handleAddServicePackage}
                  className="rounded-xl border border-[#9E6A03] bg-[#0D1117] p-3 space-y-2.5"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      dir="ltr"
                      required
                      value={pkgClientName}
                      onChange={(e) => setPkgClientName(e.target.value)}
                      placeholder="Client name"
                      className="min-h-[44px] rounded-xl border border-[#30363D] bg-[#161B22] px-3 text-sm text-left [unicode-bidi:isolate] text-[#F0F6FC]"
                    />
                    <input
                      type="text"
                      dir="ltr"
                      required
                      value={pkgTitle}
                      onChange={(e) => setPkgTitle(e.target.value)}
                      placeholder={isLadies ? 'e.g. 5-Session HydraFacial' : 'e.g. 4-Cut Monthly Pass'}
                      className="min-h-[44px] rounded-xl border border-[#30363D] bg-[#161B22] px-3 text-sm text-left [unicode-bidi:isolate] text-[#F0F6FC]"
                    />
                    <input
                      type="number"
                      dir="ltr"
                      min={2}
                      max={30}
                      value={pkgSessions}
                      onChange={(e) => setPkgSessions(e.target.value)}
                      placeholder="Sessions"
                      className="min-h-[44px] rounded-xl border border-[#30363D] bg-[#161B22] px-3 text-sm text-left [unicode-bidi:isolate] font-mono text-[#06B6D4]"
                    />
                    <input
                      type="number"
                      dir="ltr"
                      min={0}
                      value={pkgPrice}
                      onChange={(e) => setPkgPrice(e.target.value)}
                      placeholder={`Paid (${regionConfig.currency})`}
                      className="min-h-[44px] rounded-xl border border-[#30363D] bg-[#161B22] px-3 text-sm text-left [unicode-bidi:isolate] font-mono text-[#D29922]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSavingOpsCard}
                    className="w-full min-h-[44px] rounded-xl bg-[#D29922] hover:bg-[#e0b252] text-[#0D1117] text-xs font-mono font-black uppercase transition"
                  >
                    {ui.createPass}
                  </button>
                </form>
              )}

              <div className="space-y-2">
                {(conciergeState?.servicePackages || []).length === 0 ? (
                  <p className="text-xs text-[#8B949E] font-sans rounded-xl border border-[#30363D] bg-[#0D1117] p-3">
                    {ui.noPackages}
                  </p>
                ) : (
                  (conciergeState?.servicePackages || []).map((pass) => {
                    const remaining = Math.max(0, pass.totalSessions - pass.usedSessions);
                    return (
                      <div
                        key={pass.id}
                        className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold text-[#F0F6FC]">{pass.clientName}</span>
                            <span className="rounded bg-[#0D3822] border border-[#116329] px-2 py-0.5 text-[10px] font-mono font-bold text-[#3FB950]">
                              {remaining} / {pass.totalSessions}
                            </span>
                          </div>
                          <p className="text-xs text-[#8B949E] font-sans truncate">
                            {pass.packageTitle} · {regionConfig.symbol}
                            {pass.pricePaid.toLocaleString()}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={remaining <= 0}
                          onClick={() => void handleConsumePackageSession(pass.id)}
                          className="min-h-[40px] rounded-xl border border-[#30363D] bg-[#161B22] hover:border-[#06B6D4] disabled:opacity-40 px-3 py-1.5 text-[11px] font-mono font-bold text-[#06B6D4] shrink-0"
                        >
                          {remaining > 0 ? ui.useSession : ui.completedTick}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </section>

          {/* BRIDAL & EVENT ADVANCE DEPOSIT TRACKER */}
            <section
              aria-label="Bridal and Event Advance Tracker"
              className="rounded-2xl border border-[#9E6A03] bg-[#161B22] p-4 sm:p-5 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#30363D] pb-2.5">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-4 text-[#D29922] shrink-0" />
                    <h2 className="text-sm font-black uppercase tracking-wider text-[#F0F6FC]">
                      {isLadies ? ui.bridalLadiesTitle : ui.bridalTrackerTitle}
                    </h2>
                  </div>
                  {isLadies && (
                    <p className="text-[11px] font-mono text-[#3FB950]">
                      {ui.femaleOnlyBadge}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowBridalForm((v) => !v)}
                  className="min-h-[40px] inline-flex items-center gap-1 rounded-xl bg-[#D29922] hover:bg-[#e0b252] text-[#0D1117] px-3 py-1.5 text-[11px] font-mono font-black uppercase transition"
                >
                  <Plus className="size-3.5" />
                  <span>{showBridalForm ? ui.closeBtn : ui.addBridalEvent}</span>
                </button>
              </div>

              {showBridalForm && (
                <form
                  onSubmit={handleAddBridalBooking}
                  className="rounded-xl border border-[#9E6A03] bg-[#0D1117] p-3.5 space-y-2.5"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      dir="ltr"
                      required
                      value={bridalName}
                      onChange={(e) => setBridalName(e.target.value)}
                      placeholder="Bride / Client & Event Name"
                      className="min-h-[44px] rounded-xl border border-[#30363D] bg-[#161B22] px-3 text-sm text-left [unicode-bidi:isolate] text-[#F0F6FC]"
                    />
                    <input
                      type="text"
                      dir="ltr"
                      value={bridalEventDate}
                      onChange={(e) => setBridalEventDate(e.target.value)}
                      placeholder="Event Date (e.g. 24 Nov 2026)"
                      className="min-h-[44px] rounded-xl border border-[#30363D] bg-[#161B22] px-3 text-sm text-left [unicode-bidi:isolate] text-[#F0F6FC]"
                    />
                    <input
                      type="text"
                      dir="ltr"
                      value={bridalPhone}
                      onChange={(e) => setBridalPhone(e.target.value)}
                      placeholder="WhatsApp Phone"
                      className="min-h-[44px] rounded-xl border border-[#30363D] bg-[#161B22] px-3 text-sm text-left [unicode-bidi:isolate] font-mono text-[#F0F6FC]"
                    />
                    <input
                      type="text"
                      dir="ltr"
                      value={bridalPackage}
                      onChange={(e) => setBridalPackage(e.target.value)}
                      placeholder="Package Details"
                      className="min-h-[44px] rounded-xl border border-[#30363D] bg-[#161B22] px-3 text-sm text-left [unicode-bidi:isolate] text-[#F0F6FC]"
                    />
                    <input
                      type="number"
                      dir="ltr"
                      min={0}
                      value={bridalTotal}
                      onChange={(e) => setBridalTotal(e.target.value)}
                      placeholder="Total Fee"
                      className="min-h-[44px] rounded-xl border border-[#30363D] bg-[#161B22] px-3 text-sm text-left [unicode-bidi:isolate] font-mono text-[#F0F6FC]"
                    />
                    <input
                      type="number"
                      dir="ltr"
                      min={0}
                      value={bridalAdvance}
                      onChange={(e) => setBridalAdvance(e.target.value)}
                      placeholder="Advance Paid"
                      className="min-h-[44px] rounded-xl border border-[#30363D] bg-[#161B22] px-3 text-sm text-left [unicode-bidi:isolate] font-mono text-[#3FB950]"
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="inline-flex items-center gap-2 text-xs font-mono text-[#8B949E] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={bridalHomeService}
                        onChange={(e) => setBridalHomeService(e.target.checked)}
                        className="size-4 accent-[#D29922]"
                      />
                      <span>Home / Venue Visit Requested</span>
                    </label>
                    <button
                      type="submit"
                      disabled={isSavingOpsCard}
                      className="min-h-[44px] rounded-xl bg-[#D29922] hover:bg-[#e0b252] text-[#0D1117] px-5 py-2 text-xs font-mono font-black uppercase"
                    >
                      {ui.saveBridalAdvance}
                    </button>
                  </div>
                </form>
              )}

              <div className="space-y-2">
                {(conciergeState?.bridalBookings || []).map((ev) => {
                  const balanceDue = Math.max(0, ev.totalAmount - ev.advancePaid);
                  return (
                    <div
                      key={ev.id}
                      className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-[#F0F6FC]">{ev.brideOrEventName}</span>
                          <span className="rounded bg-[#3B2E0B] border border-[#9E6A03] px-2 py-0.5 text-[10px] font-mono font-bold text-[#D29922]">
                            {ev.eventDate}
                          </span>
                          {ev.homeService && (
                            <span className="rounded bg-[#0D2138] border border-[#1F6FEB] px-2 py-0.5 text-[10px] font-mono font-bold text-[#58A6FF]">
                              Home / Venue Service
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#8B949E] font-sans">
                          {ev.packageName} · Lead {isLadies ? 'Stylist' : 'Barber'}: {ev.assignedStylist}
                        </p>
                        <p className="text-xs font-mono text-[#06B6D4] tabular-nums">
                          Paid: {regionConfig.symbol}{ev.advancePaid.toLocaleString()} / Total:{' '}
                          {regionConfig.symbol}{ev.totalAmount.toLocaleString()} · Balance Due:{' '}
                          <strong className={balanceDue > 0 ? 'text-[#D29922]' : 'text-[#3FB950]'}>
                            {regionConfig.symbol}{balanceDue.toLocaleString()}
                          </strong>
                        </p>
                      </div>
                      {ev.status !== 'SETTLED' && balanceDue > 0 ? (
                        <button
                          type="button"
                          onClick={() => void handleSettleBridalBooking(ev.id)}
                          className="min-h-[44px] rounded-xl border border-[#116329] bg-[#0D3822] hover:bg-[#116329]/60 px-4 py-2 text-xs font-mono font-bold text-[#3FB950] shrink-0"
                        >
                          {ui.markSettled}
                        </button>
                      ) : (
                        <span className="rounded-xl border border-[#116329] bg-[#0D3822]/40 px-3 py-2 text-xs font-mono font-bold text-[#3FB950] shrink-0">
                          {ui.fullSettled}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 3: DEDICATED "VOICE HELP" SECTION (FOUNDER SUPPORT + VOICE LOG)      */}
      {/* ========================================================================= */}
      {currentSectionMode === 'VOICE' && (
        <div className="space-y-4" dir={isOwnerRtl ? 'rtl' : 'ltr'}>
          {/* Compact Matte Obsidian "Voice Support with Founder" Card */}
          <div ref={founderVoiceCardRef}>
            <PortalCard
              title={ui.voiceSupportTitle}
              kicker={`DIRECT FOUNDER VOICE DESK · #${activeFounderVoiceThread.serialNumber} · ${activeOwnerVoiceLocale}`}
            >
              <div className="space-y-3">
                <p className="text-xs text-[#8B949E] font-sans">
                  {ui.voiceSupportSub}
                </p>

                <VoiceRecorder
                  ref={founderVoiceRecorderRef}
                  compact
                  title={ui.recordVoiceNoteTitle}
                  subtitle={ui.recordVoiceNoteSub}
                  onRecordingChange={setIsOwnerRecordingVoice}
                  onRecorded={(clip) => {
                    setOwnerRecordedClip(clip);
                    setFounderVoiceError(null);
                  }}
                />

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    dir="ltr"
                    value={ownerVoiceDraft}
                    onChange={(e) => setOwnerVoiceDraft(e.target.value)}
                    placeholder={ui.voiceDraftPlaceholder}
                    className="flex-1 min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3 py-2 text-sm text-left [unicode-bidi:isolate] text-[#F0F6FC] placeholder-[#6E7681] focus:border-[#06B6D4] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => void handleSendOwnerVoiceToFounder()}
                    disabled={isSendingFounderVoice}
                    className="min-h-[48px] rounded-xl bg-[#06B6D4] hover:bg-[#22D3EE] disabled:opacity-50 px-4 py-2 text-xs font-mono font-bold uppercase text-[#0D1117] transition flex items-center justify-center gap-2 shrink-0"
                  >
                    <Send className="size-4" />
                    <span>
                      {isSendingFounderVoice
                        ? ui.sending
                        : isOwnerRecordingVoice
                        ? ownerLang === 'ur'
                          ? 'روکیں اور فاؤنڈر کو بھیجیں'
                          : ownerLang === 'ar'
                          ? 'إيقاف وإرسال للمؤسس'
                          : 'Stop & Send to Founder'
                        : ui.sendToFounder}
                    </span>
                  </button>
                </div>

                {founderVoiceError && (
                  <p className="text-xs font-mono text-[#F85149]">{founderVoiceError}</p>
                )}

                {activeFounderVoiceThread.messages.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-[#21262D]">
                    <p className="text-[10px] font-mono uppercase text-[#8B949E]">
                      {ui.recentSupportTitle} ({activeFounderVoiceThread.messages.length})
                    </p>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {activeFounderVoiceThread.messages.slice(-4).map((msg) => {
                        const isFounderMsg = msg.senderRole === 'FOUNDER';
                        const isPlaying = playingFounderMsgId === msg.id;
                        const displayBody = isFounderMsg
                          ? msg.translatedText || msg.originalText
                          : msg.originalText;
                        const rtl =
                          (isFounderMsg ? msg.targetLocale : activeOwnerVoiceLocale) !== 'en-US';
                        return (
                          <div
                            key={msg.id}
                            className={`rounded-xl border p-3 space-y-2 ${
                              isFounderMsg
                                ? 'border-[#06B6D4]/40 bg-[#0D1117]'
                                : 'border-[#30363D] bg-[#0D1117]'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className={`text-[10px] font-mono font-bold uppercase ${
                                  isFounderMsg ? 'text-[#06B6D4]' : 'text-[#D29922]'
                                }`}
                              >
                                {isFounderMsg ? 'Founder Reply (Translated Voice)' : `${currentSalon.owner} (You)`}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono text-[#6E7681]">
                                  {new Date(msg.createdAtMs).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                                {(msg.audioDataUrl || (isFounderMsg && displayBody)) && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handlePlayFounderMessage(
                                        msg.id,
                                        msg.audioDataUrl ?? null,
                                        displayBody,
                                        msg.targetLocale
                                      )
                                    }
                                    className="min-h-[36px] rounded-lg border border-[#30363D] bg-[#161B22] px-2.5 text-[11px] font-mono font-bold text-[#F0F6FC] hover:border-[#06B6D4] flex items-center gap-1"
                                  >
                                    {isPlaying ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                                    <span>{isPlaying ? ui.stopVoice : ui.playVoice}</span>
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="space-y-1">
                              {isFounderMsg && (
                                <span className="text-[10px] font-mono text-[#8B949E] block">
                                  Text Message ({msg.targetLocale} · Readable if Salon is Noisy):
                                </span>
                              )}
                              <p
                                dir={rtl ? 'rtl' : 'ltr'}
                                className={`text-sm text-[#F0F6FC] leading-relaxed font-sans ${
                                  rtl ? 'text-right' : 'text-left'
                                }`}
                              >
                                {displayBody}
                              </p>
                            </div>
                            {msg.audioDataUrl && (
                              <audio
                                controls
                                preload="none"
                                src={msg.audioDataUrl}
                                className="w-full h-9"
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </PortalCard>
          </div>

          {/* Hands-Free Voice Concierge & Neural Announcement Log */}
          <PortalCard
            title={`${ui.voiceLogsHeading} (${voiceLogs.length})`}
            kicker={ui.voiceLogsSub}
          >
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setVoiceFilter('ALL')}
                    className={`min-h-[44px] rounded-xl border px-3 py-1.5 text-xs font-mono font-bold transition ${
                      voiceFilter === 'ALL'
                        ? 'border-[#06B6D4] bg-[#0D1117] text-[#06B6D4]'
                        : 'border-[#30363D] bg-[#0D1117] text-[#8B949E]'
                    }`}
                  >
                    {ui.allAlertsBtn}
                  </button>
                  <button
                    type="button"
                    onClick={() => setVoiceFilter('URGENT_ONLY')}
                    className={`min-h-[44px] rounded-xl border px-3 py-1.5 text-xs font-mono font-bold transition ${
                      voiceFilter === 'URGENT_ONLY'
                        ? 'border-[#D29922] bg-[#3B2E0B] text-[#D29922]'
                        : 'border-[#30363D] bg-[#0D1117] text-[#8B949E]'
                    }`}
                  >
                    {ui.urgentOnlyBtn}
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={isTestingLoudAlert}
                    onClick={() => handleTriggerSimulatedVoiceWebhook('CONFIRMATION')}
                    className="min-h-[44px] rounded-xl border border-[#116329] bg-[#0D3822] hover:bg-[#116329]/50 px-3 py-1.5 text-xs font-mono font-bold text-[#3FB950] transition disabled:opacity-50"
                  >
                    🔊 Test: Ali Confirmed Hamza 4:30 PM
                  </button>
                  <button
                    type="button"
                    disabled={isTestingLoudAlert}
                    onClick={() => handleTriggerSimulatedVoiceWebhook('REMINDER_LATE')}
                    className="min-h-[44px] rounded-xl border border-[#9E6A03] bg-[#3B2E0B] hover:bg-[#3B2E0B]/80 px-3 py-1.5 text-xs font-mono font-bold text-[#D29922] transition disabled:opacity-50"
                  >
                    🔊 Test: Reminder Reply (15m Late)
                  </button>
                  <button
                    type="button"
                    disabled={isTestingLoudAlert}
                    onClick={() => handleTriggerSimulatedVoiceWebhook('BRIDAL_URGENT')}
                    className="min-h-[44px] rounded-xl border border-[#da3633] bg-[#4C1C1D] hover:bg-[#5e2223] px-3 py-1.5 text-xs font-mono font-bold text-[#F85149] transition disabled:opacity-50"
                  >
                    🔊 Test: Urgent Bridal/Groom Alert
                  </button>
                </div>
              </div>

              <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                {voiceLogs
                  .filter((v) => voiceFilter === 'ALL' || v.isUrgent)
                  .map((log) => (
                    <div
                      key={log.id}
                      className={`rounded-xl border p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        log.isUrgent
                          ? 'border-[#9E6A03] bg-[#3B2E0B]/40'
                          : 'border-[#30363D] bg-[#0D1117]'
                      }`}
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded bg-[#161B22] border border-[#30363D] px-2 py-0.5 text-[10px] font-mono font-bold text-[#06B6D4]">
                            {log.clientLang.toUpperCase()} ➔ {log.ownerVoiceLang.toUpperCase()} VOICE
                          </span>
                          <span className="text-[11px] font-mono text-[#8B949E]">{log.time}</span>
                        </div>
                        <p className="text-xs font-bold text-[#F0F6FC]">{log.summary}</p>
                        <p
                          dir={log.ownerVoiceLang === 'ur' || log.ownerVoiceLang === 'ar' ? 'rtl' : 'ltr'}
                          className="text-xs text-[#8B949E] font-sans break-words [overflow-wrap:break-word]"
                        >
                          &ldquo;{log.spokenText}&rdquo;
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => speakHandsFree(log.spokenText, log.ownerVoiceLang, true)}
                        className="min-h-[48px] rounded-xl border border-[#30363D] bg-[#161B22] hover:border-[#06B6D4] px-3.5 py-2 text-xs font-mono font-bold text-[#06B6D4] shrink-0 flex items-center gap-1.5 transition"
                      >
                        <Volume2 className="size-4" />
                        <span>{ui.replayBtn}</span>
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          </PortalCard>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 4: DEDICATED "MANAGE" SECTION (SHOP SETUP & RULES)                   */}
      {/* ========================================================================= */}
      {currentSectionMode === 'MANAGE' && (
        <div className="space-y-4" dir={isOwnerRtl ? 'rtl' : 'ltr'}>

          {/* Sub-Section Switcher Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 p-1.5 rounded-2xl border border-[#30363D] bg-[#161B22]">
            {[
              { id: 'STAFF' as const, label: isLadies ? ui.staffStylists : ui.staffBarbers, icon: Scissors },
              { id: 'SERVICES' as const, label: ui.servicesRates, icon: Receipt },
              { id: 'HOURS' as const, label: ui.salonHours, icon: Clock },
              { id: 'AUTOMATION' as const, label: ui.automationRewards, icon: Settings2 },
              { id: 'POSTER' as const, label: ui.windowQrPoster, icon: QrCode },
            ].map((sub) => {
              const Icon = sub.icon;
              const isActive = manageSubSection === sub.id;
              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => setManageSubSection(sub.id)}
                  className={`min-h-[48px] flex items-center justify-center sm:justify-start gap-2 rounded-xl px-3 py-2 text-xs font-mono font-bold transition border ${
                    isActive
                      ? 'border-[#06B6D4] bg-[#0D1117] text-[#06B6D4]'
                      : 'border-transparent bg-transparent text-[#8B949E] hover:bg-[#21262D] hover:text-[#F0F6FC]'
                  }`}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="truncate">{sub.label}</span>
                </button>
              );
            })}
          </div>

          {/* 1. STAFF & BARBERS / STYLISTS + SHOP CATEGORY MODE SELECTOR */}
          {manageSubSection === 'STAFF' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#30363D] bg-[#161B22] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-mono font-bold uppercase text-[#06B6D4]">
                    {ui.salonProfileModeLabel}
                  </p>
                  <p className="text-xs text-[#8B949E] font-sans mt-0.5">
                    {isLadies
                      ? 'Ladies Beauty Parlor Mode active: Bridal Advance Tracker & Female-Only privacy badge enabled.'
                      : 'Men’s Salon & Barbershop Mode active: Barber chairs, beard combos & express walk-in ETA enabled.'}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => void handleUpdateSalonCategory('MENS')}
                    className={`min-h-[44px] rounded-xl border px-3.5 py-2 text-xs font-mono font-bold transition ${
                      !isLadies
                        ? 'border-[#06B6D4] bg-[#06B6D4] text-[#0D1117]'
                        : 'border-[#30363D] bg-[#0D1117] text-[#8B949E] hover:text-[#F0F6FC]'
                    }`}
                  >
                    {ui.mensSalonBtn}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleUpdateSalonCategory('LADIES')}
                    className={`min-h-[44px] rounded-xl border px-3.5 py-2 text-xs font-mono font-bold transition ${
                      isLadies
                        ? 'border-[#D29922] bg-[#D29922] text-[#0D1117]'
                        : 'border-[#30363D] bg-[#0D1117] text-[#8B949E] hover:text-[#F0F6FC]'
                    }`}
                  >
                    {ui.ladiesParlorBtn}
                  </button>
                </div>
              </div>
            <PortalCard
              title={isLadies ? ui.staffStylists : ui.staffBarbers}
              kicker={isLadies ? 'STYLIST ROSTER & PRIVATE CABIN STATIONS' : 'BARBER ROSTER & CHAIR ASSIGNMENTS'}
            >
              <div className="space-y-4">
                <p className="text-xs text-[#8B949E] font-sans">
                  Manage your barbers and their assigned floor chairs. Updates feed live into Today&apos;s Schedule, Walk-In seating, and WhatsApp booking slots.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {barbersList.map((barber, bIdx) => {
                    const isEditing = editingBarberIndex === bIdx;
                    const assignedChair = barberChairs[barber] || `Chair #${bIdx + 1}`;
                    return (
                      <div
                        key={bIdx}
                        className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3.5 flex flex-col gap-2.5"
                      >
                        {isEditing ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              dir="ltr"
                              value={editingBarberName}
                              onChange={(e) => setEditingBarberName(e.target.value)}
                              className="w-full min-h-[48px] rounded-xl border border-[#06B6D4] bg-[#161B22] px-3 py-2 text-sm text-left [unicode-bidi:isolate] text-[#F0F6FC] focus:outline-none"
                              placeholder="Barber name"
                              autoFocus
                            />
                            <input
                              type="text"
                              dir="ltr"
                              value={editingBarberChair}
                              onChange={(e) => setEditingBarberChair(e.target.value)}
                              className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#161B22] px-3 py-2 text-sm text-left [unicode-bidi:isolate] font-mono text-[#D29922] focus:outline-none focus:border-[#06B6D4]"
                              placeholder="Chair assignment (e.g. Chair #1)"
                            />
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleSaveEditBarber(bIdx)}
                                className="flex-1 min-h-[48px] rounded-xl bg-[#06B6D4] text-[#0D1117] text-xs font-mono font-bold hover:bg-[#22D3EE] transition"
                              >
                                Save Changes ✓
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingBarberIndex(null);
                                  setEditingBarberName('');
                                  setEditingBarberChair('');
                                }}
                                className="min-h-[48px] px-3 rounded-xl border border-[#30363D] text-[#8B949E] hover:text-[#F0F6FC] text-xs font-mono"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="size-8 rounded-lg bg-[#161B22] border border-[#30363D] grid place-items-center text-xs font-mono font-bold text-[#D29922] shrink-0">
                                #{bIdx + 1}
                              </span>
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-[#F0F6FC] truncate">{barber}</p>
                                <span className="text-xs font-mono text-[#06B6D4] block truncate">
                                  {assignedChair}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingBarberIndex(bIdx);
                                  setEditingBarberName(barber);
                                  setEditingBarberChair(assignedChair);
                                }}
                                className="min-h-[48px] min-w-[48px] grid place-items-center rounded-xl border border-[#30363D] bg-[#161B22] hover:border-[#06B6D4] text-[#8B949E] hover:text-[#06B6D4] transition"
                                title="Edit Barber & Chair"
                              >
                                <Edit2 className="size-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteBarberDashboard(barber)}
                                className="min-h-[48px] min-w-[48px] grid place-items-center rounded-xl border border-[#30363D] bg-[#161B22] hover:border-[#F85149] text-[#8B949E] hover:text-[#F85149] transition"
                                title="Remove Barber"
                              >
                                <Trash2 className="size-4" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <form
                  onSubmit={handleAddBarberDashboard}
                  className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3.5 grid grid-cols-1 sm:grid-cols-[1fr_180px_auto] gap-2.5"
                >
                  <input
                    type="text"
                    dir="ltr"
                    value={newBarberDashboardInput}
                    onChange={(e) => setNewBarberDashboardInput(e.target.value)}
                    placeholder="Barber / Stylist Name (e.g. Master Kamran)"
                    className="min-h-[48px] rounded-xl border border-[#30363D] bg-[#161B22] px-3.5 py-2 text-sm text-left [unicode-bidi:isolate] text-[#F0F6FC] placeholder:text-[#484F58] focus:outline-none focus:border-[#06B6D4]"
                  />
                  <input
                    type="text"
                    dir="ltr"
                    value={newBarberChairInput}
                    onChange={(e) => setNewBarberChairInput(e.target.value)}
                    placeholder={`Chair #${barbersList.length + 1}`}
                    className="min-h-[48px] rounded-xl border border-[#30363D] bg-[#161B22] px-3.5 py-2 text-sm text-left [unicode-bidi:isolate] font-mono text-[#D29922] placeholder:text-[#484F58] focus:outline-none focus:border-[#06B6D4]"
                  />
                  <button
                    type="submit"
                    className="min-h-[48px] rounded-xl bg-[#D29922] hover:bg-[#e0b252] text-[#0D1117] px-4 py-2 text-xs font-mono font-bold uppercase transition flex items-center justify-center gap-1.5 shrink-0"
                  >
                    <Plus className="size-4" />
                    <span>{isLadies ? ui.addStylistBtn : ui.addBarberBtn}</span>
                  </button>
                </form>
              </div>
            </PortalCard>

            {/* Barber Performance & Top Services Breakdown */}
            <PortalCard
              title="Barber Performance & Top Services Breakdown"
              kicker="CHAIR RETENTION · POPULAR SERVICES PER BARBER"
            >
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {['ALL', ...barbersList].map((barberOption) => {
                    const active = selectedBarberForServices === barberOption;
                    return (
                      <button
                        key={barberOption}
                        type="button"
                        onClick={() => setSelectedBarberForServices(barberOption)}
                        className={`min-h-[44px] rounded-xl border px-3.5 py-2 text-xs font-mono font-bold transition ${
                          active
                            ? 'border-[#06B6D4] bg-[#0D1117] text-[#06B6D4]'
                            : 'border-[#30363D] bg-[#0D1117] text-[#8B949E] hover:text-[#F0F6FC]'
                        }`}
                      >
                        {barberOption === 'ALL' ? 'All Chairs Combined' : barberOption}
                      </button>
                    );
                  })}
                </div>

                {(() => {
                  const directStats = BARBER_SERVICE_STATS[selectedBarberForServices];
                  const barberBookings = bookings.filter(
                    (b) => selectedBarberForServices === 'ALL' || b.barberName === selectedBarberForServices
                  );
                  const stats = directStats || {
                    topServices: [
                      '1. Master Haircut & Skin Fade (52%)',
                      '2. Classic Beard Trim & Sculpt (31%)',
                      '3. Charcoal Detox Facial (17%)',
                    ],
                    favRate: '95% Positive Rating',
                    repeatRate: `${Math.min(88, 66 + barberBookings.length * 4)}% Repeat Retention`,
                    clientLove: `${selectedBarberForServices} (${
                      barberChairs[selectedBarberForServices] || 'Floor Chair'
                    }) holds strong repeat demand across regular grooming appointments.`,
                  };

                  return (
                    <div className="rounded-2xl border border-[#30363D] bg-[#0D1117] p-4 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="rounded-xl border border-[#116329] bg-[#0D3822] p-3">
                          <span className="text-[10px] font-mono uppercase text-[#8B949E] block">
                            Client Rating
                          </span>
                          <p className="text-sm font-black font-mono text-[#3FB950] mt-0.5 flex items-center gap-1.5">
                            <Award className="size-4 shrink-0" />
                            <span>{stats.favRate}</span>
                          </p>
                        </div>
                        <div className="rounded-xl border border-[#30363D] bg-[#161B22] p-3">
                          <span className="text-[10px] font-mono uppercase text-[#8B949E] block">
                            Repeat Client Rate
                          </span>
                          <p className="text-sm font-black font-mono text-[#D29922] mt-0.5 flex items-center gap-1.5">
                            <TrendingUp className="size-4 shrink-0" />
                            <span>{stats.repeatRate}</span>
                          </p>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <span className="text-[11px] font-mono font-bold uppercase text-[#06B6D4] block">
                          Most Requested Services
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          {stats.topServices.map((svc) => (
                            <div
                              key={svc}
                              className="rounded-xl border border-[#30363D] bg-[#161B22] px-3 py-2 text-xs font-sans text-[#F0F6FC]"
                            >
                              {svc}
                            </div>
                          ))}
                        </div>
                      </div>

                      <p className="text-xs text-[#8B949E] font-sans">{stats.clientLove}</p>
                    </div>
                  );
                })()}
              </div>
            </PortalCard>
          </div>
          )}

          {/* 2. SERVICES & RATES (Edit Service Names, Durations, and Pricing) */}
          {manageSubSection === 'SERVICES' && (
            <PortalCard
              title="Services & Rates"
              kicker="SERVICE NAMES · DURATIONS · PRICING"
            >
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <p className="text-xs font-sans text-[#8B949E]">
                    Edit service titles, durations (mins), and rates ({regionConfig.currency}). Changes reflect immediately on your WhatsApp menu.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsAddingCustom(!isAddingCustom)}
                    className="min-h-[48px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#D29922] hover:bg-[#e0b252] text-[#0D1117] px-4 py-2 text-xs font-mono font-bold uppercase transition shrink-0"
                  >
                    <Plus className="size-4" />
                    <span>{isAddingCustom ? 'Close Form' : 'Add Service'}</span>
                  </button>
                </div>

                {isAddingCustom && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!customServiceName.trim()) return;
                      const newSvc = {
                        id: `custom_${Date.now()}`,
                        name: customServiceName.trim(),
                        durationMins: parseInt(customServiceDuration, 10) || 35,
                        price: parseInt(customServicePrice, 10) || 1000,
                        active: true,
                      };
                      setServices((prev) => [...prev, newSvc]);
                      setCustomServiceName('');
                      setCustomServiceDuration('35');
                      setCustomServicePrice('1500');
                      setIsAddingCustom(false);
                      setMaintToast(`✓ Service "${newSvc.name}" added.`);
                      setTimeout(() => setMaintToast(null), 4000);
                    }}
                    className="p-4 rounded-2xl border border-[#9E6A03] bg-[#0D1117] space-y-3"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                      <input
                        type="text"
                        dir="ltr"
                        required
                        placeholder="Service Name"
                        value={customServiceName}
                        onChange={(e) => setCustomServiceName(e.target.value)}
                        className="sm:col-span-2 min-h-[48px] rounded-xl border border-[#30363D] bg-[#161B22] px-3.5 py-2 text-sm text-left [unicode-bidi:isolate] text-[#F0F6FC] placeholder:text-[#484F58]"
                      />
                      <input
                        type="number"
                        dir="ltr"
                        required
                        min={5}
                        placeholder="Mins"
                        value={customServiceDuration}
                        onChange={(e) => setCustomServiceDuration(e.target.value)}
                        className="min-h-[48px] rounded-xl border border-[#30363D] bg-[#161B22] px-3.5 py-2 text-sm text-left [unicode-bidi:isolate] font-mono text-[#06B6D4] placeholder:text-[#484F58]"
                      />
                      <input
                        type="number"
                        dir="ltr"
                        required
                        placeholder={`Price (${regionConfig.currency})`}
                        value={customServicePrice}
                        onChange={(e) => setCustomServicePrice(e.target.value)}
                        className="min-h-[48px] rounded-xl border border-[#30363D] bg-[#161B22] px-3.5 py-2 text-sm text-left [unicode-bidi:isolate] font-mono font-bold text-[#D29922] placeholder:text-[#484F58]"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        className="min-h-[48px] px-5 py-2 rounded-xl bg-[#D29922] hover:bg-[#e0b252] text-[#0D1117] text-xs font-mono font-bold uppercase"
                      >
                        Save &amp; Sync ✓
                      </button>
                    </div>
                  </form>
                )}

                <div className="space-y-2.5">
                  {services.map((item) => (
                    <div
                      key={item.id}
                      className={`rounded-xl border p-3.5 grid grid-cols-1 md:grid-cols-[auto_1fr_auto_auto] items-center gap-3 transition ${
                        item.active
                          ? 'border-[#30363D] bg-[#0D1117]'
                          : 'border-[#21262D] bg-[#0D1117] opacity-60'
                      }`}
                    >
                      <label className="inline-flex items-center gap-2 cursor-pointer min-h-[48px]">
                        <input
                          type="checkbox"
                          checked={item.active}
                          onChange={() => handleToggleService(item.id)}
                          className="size-4 accent-[#06B6D4] rounded shrink-0"
                        />
                        <span className="text-xs font-mono text-[#8B949E] md:hidden">Active</span>
                      </label>

                      <input
                        type="text"
                        dir="ltr"
                        value={item.name}
                        onChange={(e) => handleUpdateServiceName(item.id, e.target.value)}
                        className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#161B22] px-3 py-2 text-sm text-left [unicode-bidi:isolate] font-bold text-[#F0F6FC] focus:outline-none focus:border-[#06B6D4]"
                      />

                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          dir="ltr"
                          min={5}
                          value={item.durationMins}
                          onChange={(e) =>
                            handleUpdateServiceDuration(item.id, parseInt(e.target.value, 10) || 15)
                          }
                          className="w-20 min-h-[48px] rounded-xl border border-[#30363D] bg-[#161B22] px-2.5 py-2 text-sm text-left [unicode-bidi:isolate] font-mono text-[#06B6D4] focus:outline-none focus:border-[#06B6D4]"
                        />
                        <span className="text-xs font-mono text-[#8B949E] shrink-0">min</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-mono text-[#8B949E] shrink-0">
                          {regionConfig.currency}
                        </span>
                        <input
                          type="number"
                          dir="ltr"
                          value={item.price}
                          onChange={(e) =>
                            handleUpdatePrice(item.id, parseInt(e.target.value, 10) || 0)
                          }
                          className="w-28 min-h-[48px] rounded-xl border border-[#30363D] bg-[#161B22] px-3 py-2 text-sm text-left [unicode-bidi:isolate] font-mono font-bold text-[#D29922] focus:outline-none focus:border-[#06B6D4]"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </PortalCard>
          )}

          {/* 3. SALON HOURS (Editable Opening/Closing Days & Times) */}
          {manageSubSection === 'HOURS' && (
            <PortalCard
              title="Salon Hours"
              kicker="OPENING & CLOSING SCHEDULE · FRIDAY JUMMAH BREAK"
            >
              <form onSubmit={handleSaveSalonHours} className="space-y-4">
                <p className="text-xs text-[#8B949E] font-sans">
                  Configure your weekly opening and closing times. The WhatsApp concierge automatically quotes these hours to customers asking when you are open.
                </p>

                {/* Monday - Thursday */}
                <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-[#F0F6FC]">Monday – Thursday</span>
                    <label className="inline-flex items-center gap-2 text-xs font-mono text-[#8B949E] cursor-pointer min-h-[48px]">
                      <input
                        type="checkbox"
                        checked={!salonHours.monThuClosed}
                        onChange={(e) =>
                          setSalonHours((prev) => ({ ...prev, monThuClosed: !e.target.checked }))
                        }
                        className="size-4 accent-[#06B6D4]"
                      />
                      <span>{salonHours.monThuClosed ? 'Closed' : 'Open'}</span>
                    </label>
                  </div>
                  {!salonHours.monThuClosed && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="space-y-1 block">
                        <span className="text-[11px] font-mono text-[#8B949E]">Opening Time</span>
                        <input
                          type="text"
                          dir="ltr"
                          value={salonHours.monThuOpen}
                          onChange={(e) =>
                            setSalonHours((prev) => ({ ...prev, monThuOpen: e.target.value }))
                          }
                          className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#161B22] px-3 py-2 text-sm text-left [unicode-bidi:isolate] font-mono text-[#F0F6FC]"
                        />
                      </label>
                      <label className="space-y-1 block">
                        <span className="text-[11px] font-mono text-[#8B949E]">Closing Time</span>
                        <input
                          type="text"
                          dir="ltr"
                          value={salonHours.monThuClose}
                          onChange={(e) =>
                            setSalonHours((prev) => ({ ...prev, monThuClose: e.target.value }))
                          }
                          className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#161B22] px-3 py-2 text-sm text-left [unicode-bidi:isolate] font-mono text-[#F0F6FC]"
                        />
                      </label>
                    </div>
                  )}
                </div>

                {/* Friday */}
                <div className="rounded-xl border border-[#9E6A03] bg-[#0D1117] p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-[#D29922]">Friday (Jummah Schedule)</span>
                    <label className="inline-flex items-center gap-2 text-xs font-mono text-[#8B949E] cursor-pointer min-h-[48px]">
                      <input
                        type="checkbox"
                        checked={!salonHours.fridayClosed}
                        onChange={(e) =>
                          setSalonHours((prev) => ({ ...prev, fridayClosed: !e.target.checked }))
                        }
                        className="size-4 accent-[#D29922]"
                      />
                      <span>{salonHours.fridayClosed ? 'Closed' : 'Open'}</span>
                    </label>
                  </div>
                  {!salonHours.fridayClosed && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <label className="space-y-1 block">
                        <span className="text-[11px] font-mono text-[#8B949E]">Open</span>
                        <input
                          type="text"
                          dir="ltr"
                          value={salonHours.fridayOpen}
                          onChange={(e) =>
                            setSalonHours((prev) => ({ ...prev, fridayOpen: e.target.value }))
                          }
                          className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#161B22] px-3 py-2 text-sm text-left [unicode-bidi:isolate] font-mono text-[#F0F6FC]"
                        />
                      </label>
                      <label className="space-y-1 block">
                        <span className="text-[11px] font-mono text-[#8B949E]">Close</span>
                        <input
                          type="text"
                          dir="ltr"
                          value={salonHours.fridayClose}
                          onChange={(e) =>
                            setSalonHours((prev) => ({ ...prev, fridayClose: e.target.value }))
                          }
                          className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#161B22] px-3 py-2 text-sm text-left [unicode-bidi:isolate] font-mono text-[#F0F6FC]"
                        />
                      </label>
                      <label className="space-y-1 block">
                        <span className="text-[11px] font-mono text-[#D29922]">Prayer Break Start</span>
                        <input
                          type="text"
                          dir="ltr"
                          value={salonHours.fridayBreakStart}
                          onChange={(e) =>
                            setSalonHours((prev) => ({
                              ...prev,
                              fridayBreakStart: e.target.value,
                            }))
                          }
                          className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#161B22] px-3 py-2 text-sm text-left [unicode-bidi:isolate] font-mono text-[#D29922]"
                        />
                      </label>
                      <label className="space-y-1 block">
                        <span className="text-[11px] font-mono text-[#D29922]">Prayer Break End</span>
                        <input
                          type="text"
                          dir="ltr"
                          value={salonHours.fridayBreakEnd}
                          onChange={(e) =>
                            setSalonHours((prev) => ({
                              ...prev,
                              fridayBreakEnd: e.target.value,
                            }))
                          }
                          className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#161B22] px-3 py-2 text-sm text-left [unicode-bidi:isolate] font-mono text-[#D29922]"
                        />
                      </label>
                    </div>
                  )}
                </div>

                {/* Saturday & Sunday */}
                <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-[#F0F6FC]">Saturday &amp; Sunday</span>
                    <label className="inline-flex items-center gap-2 text-xs font-mono text-[#8B949E] cursor-pointer min-h-[48px]">
                      <input
                        type="checkbox"
                        checked={!salonHours.satSunClosed}
                        onChange={(e) =>
                          setSalonHours((prev) => ({ ...prev, satSunClosed: !e.target.checked }))
                        }
                        className="size-4 accent-[#3FB950]"
                      />
                      <span>{salonHours.satSunClosed ? 'Closed' : 'Open'}</span>
                    </label>
                  </div>
                  {!salonHours.satSunClosed && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="space-y-1 block">
                        <span className="text-[11px] font-mono text-[#8B949E]">Opening Time</span>
                        <input
                          type="text"
                          dir="ltr"
                          value={salonHours.satSunOpen}
                          onChange={(e) =>
                            setSalonHours((prev) => ({ ...prev, satSunOpen: e.target.value }))
                          }
                          className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#161B22] px-3 py-2 text-sm text-left [unicode-bidi:isolate] font-mono text-[#F0F6FC]"
                        />
                      </label>
                      <label className="space-y-1 block">
                        <span className="text-[11px] font-mono text-[#8B949E]">Closing Time</span>
                        <input
                          type="text"
                          dir="ltr"
                          value={salonHours.satSunClose}
                          onChange={(e) =>
                            setSalonHours((prev) => ({ ...prev, satSunClose: e.target.value }))
                          }
                          className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#161B22] px-3 py-2 text-sm text-left [unicode-bidi:isolate] font-mono text-[#F0F6FC]"
                        />
                      </label>
                    </div>
                  )}
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="min-h-[48px] rounded-xl bg-[#06B6D4] hover:bg-[#22D3EE] text-[#0D1117] px-6 py-2.5 text-xs font-mono font-black uppercase transition flex items-center gap-2"
                  >
                    <Save className="size-4" />
                    <span>{ui.saveHoursBtn}</span>
                  </button>
                </div>
              </form>
            </PortalCard>
          )}

          {/* 4. AUTOMATION & REWARDS (Birthday %, 30-day Win-Back, Google Review URL, 24h/2h Reminders, Proof Ledger & Video Campaigns) */}
          {manageSubSection === 'AUTOMATION' && (
            <div className="space-y-4">
              <SalonRetentionSettingsPanel
                salonId={currentSalon.id}
                salonName={currentSalon.name}
                ownerName={currentSalon.owner}
                salonPhone={currentSalon.phone}
                packageTier={packageTier}
                conciergeState={conciergeState}
                onStateUpdated={processIncomingConciergeState}
                onShowToast={(msg) => {
                  setMaintToast(msg);
                  setTimeout(() => setMaintToast(null), 5000);
                }}
              />

              {/* 24h / 2h Automated Pre-Appointment Reminders (Moved cleanly from Live Floor into Automation & Rewards) */}
              <section
                aria-label="24h and 2h WhatsApp Reminders"
                className="rounded-2xl border border-[#30363D] bg-[#161B22] p-4 sm:p-5 space-y-3"
              >
                <div className="flex items-center justify-between gap-2 border-b border-[#30363D] pb-2.5">
                  <div className="flex items-center gap-2">
                    <Clock className="size-4 text-[#3FB950] shrink-0" />
                    <h2 className="text-sm font-black uppercase tracking-wider text-[#F0F6FC]">
                      {ui.remindersTitle}
                    </h2>
                  </div>
                  <span className="rounded-md border border-[#116329] bg-[#0D3822] px-2 py-0.5 text-[10px] font-mono font-bold text-[#3FB950]">
                    {ui.activeBadge}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
                  <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3 flex items-center justify-between gap-2">
                    <div>
                      <p className="font-bold text-[#F0F6FC]">{ui.adv24h}</p>
                      <p className="text-[11px] text-[#8B949E] font-sans">
                        {ui.adv24hDesc}
                      </p>
                    </div>
                    <span className="font-mono font-bold text-[#3FB950] shrink-0">T-24h ✓</span>
                  </div>
                  <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3 flex items-center justify-between gap-2">
                    <div>
                      <p className="font-bold text-[#F0F6FC]">{ui.arr2h}</p>
                      <p className="text-[11px] text-[#8B949E] font-sans">
                        {ui.arr2hDesc}
                      </p>
                    </div>
                    <span className="font-mono font-bold text-[#3FB950] shrink-0">T-2h ✓</span>
                  </div>
                </div>
              </section>

              {/* Collapsible 2: Immutable Booking Confirmation Proof Ledger (SHA-256) */}
              <div className="rounded-2xl border border-[#30363D] bg-[#161B22] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowProofLedgerDrawer(!showProofLedgerDrawer)}
                  className="w-full min-h-[48px] px-4 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-[#21262D]/50 transition"
                >
                  <div>
                    <span className="text-xs font-mono font-bold uppercase text-[#3FB950] block">
                      Immutable Booking Proof Ledger · SHA-256 ({immutableProofs.length})
                    </span>
                    <span className="text-[11px] font-sans text-[#8B949E]">
                      Tamper-proof WhatsApp price &amp; slot confirmations protected against message deletion
                    </span>
                  </div>
                  {showProofLedgerDrawer ? (
                    <ChevronUp className="size-4 text-[#8B949E] shrink-0" />
                  ) : (
                    <ChevronDown className="size-4 text-[#8B949E] shrink-0" />
                  )}
                </button>

                {showProofLedgerDrawer && (
                  <div className="p-4 pt-3 border-t border-[#30363D] space-y-2.5">
                    {immutableProofs.map((proof) => (
                      <div
                        key={proof.id}
                        className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3.5 space-y-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <FileCheck className="size-4 text-[#3FB950] shrink-0" />
                            <span className="text-xs font-mono font-bold text-[#F0F6FC]">
                              {proof.id} · {proof.clientName}
                            </span>
                            <span className="text-[11px] font-mono text-[#06B6D4]" dir="ltr">
                              {proof.clientPhone}
                            </span>
                          </div>
                          <span className="text-xs font-mono font-black text-[#D29922] tabular-nums">
                            {regionConfig.symbol}
                            {proof.totalAmount.toLocaleString()} · {proof.slotTime}
                          </span>
                        </div>
                        <p className="text-xs text-[#8B949E] font-sans">
                          Services: {proof.services.join(', ')} ({proof.pricingModeLabel})
                        </p>
                        <p
                          dir={proof.clientLang === 'ur' || proof.clientLang === 'ar' ? 'rtl' : 'ltr'}
                          className="rounded-lg border border-[#21262D] bg-[#161B22] p-2.5 text-xs text-[#F0F6FC] font-sans break-words [overflow-wrap:break-word]"
                        >
                          &ldquo;{proof.confirmedMessage}&rdquo;
                        </p>
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-[#6E7681]">
                          <span>{proof.timestamp}</span>
                          <span className="text-[#3FB950] break-all">{proof.hash}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Collapsible 3: Plan, Billing & Video Broadcast Drawer inside Manage */}
              <div className="rounded-2xl border border-[#30363D] bg-[#161B22] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowManageAdvancedTools(!showManageAdvancedTools)}
                  className="w-full min-h-[48px] px-4 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-[#21262D]/50 transition"
                >
                  <div>
                    <span className="text-xs font-mono font-bold uppercase text-[#D29922] block">
                      Plan Upgrades, Monthly Maintenance &amp; Video Deals
                    </span>
                    <span className="text-[11px] font-sans text-[#8B949E]">
                      {currentSalon.plan} · {regionConfig.symbol}
                      {currentSalon.maint.toLocaleString()}/mo (Due 5th)
                    </span>
                  </div>
                  {showManageAdvancedTools ? (
                    <ChevronUp className="size-4 text-[#8B949E] shrink-0" />
                  ) : (
                    <ChevronDown className="size-4 text-[#8B949E] shrink-0" />
                  )}
                </button>

                {showManageAdvancedTools && (
                  <div className="p-4 pt-2 border-t border-[#30363D] space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#30363D] bg-[#0D1117] p-3.5">
                      <div>
                        <p className="text-xs font-mono font-bold text-[#F0F6FC]">
                          Owner Voice Language ({ownerLang.toUpperCase()}) · Plan: {currentSalon.plan}
                        </p>
                        <p className="text-[11px] text-[#8B949E] font-sans mt-0.5">
                          Maintenance Status: {isMaintPaid ? `Paid (${maintTid})` : 'Payment Due'}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={ownerLang}
                          onChange={(e) => setOwnerLang(e.target.value as VoiceLang)}
                          className="min-h-[48px] rounded-xl border border-[#30363D] bg-[#161B22] px-3 text-sm font-mono text-[#F0F6FC]"
                        >
                          {allowedLangs.includes('ur') && <option value="ur">Owner Voice: Urdu</option>}
                          {allowedLangs.includes('en') && <option value="en">Owner Voice: English</option>}
                          {allowedLangs.includes('ar') && <option value="ar">Owner Voice: Arabic</option>}
                        </select>
                        {higherPackages.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedUpgradeTargetId(higherPackages[0].id);
                              setIsUpgradeModalOpen(true);
                            }}
                            className="min-h-[48px] rounded-xl bg-[#06B6D4] hover:bg-[#22D3EE] text-[#0D1117] px-4 text-xs font-mono font-bold uppercase transition"
                          >
                            Upgrade Plan
                          </button>
                        )}
                      </div>
                    </div>

                    {packageTier === 'STARTER' ? (
                      <div className="rounded-xl border border-[#9E6A03] bg-[#3B2E0B] p-4 space-y-2">
                        <p className="text-xs font-mono font-bold uppercase text-[#D29922]">
                          Video Broadcast Deals Locked on STARTER Tier
                        </p>
                        <p className="text-xs text-[#F0F6FC] font-sans">
                          Upgrade to PRO or PRO++ (VIP) to unlock Video QA Deal uploads, Google Maps Rating Booster, and Bridal Deposit SLA locks.
                        </p>
                      </div>
                    ) : (
                      <BroadcastTab
                        salon={activeSalonProfile}
                        salonId={currentSalon.id}
                        contacts={salonContacts}
                        ownerLang={ownerLang}
                        onShowToast={(msg) => {
                          setMaintToast(msg);
                          setTimeout(() => setMaintToast(null), 6000);
                        }}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 5. WINDOW QR POSTER (Print / Download PDF) */}
          {manageSubSection === 'POSTER' && (
            <PortalCard
              title="Window QR Poster"
              kicker="PRINTABLE DOOR POSTER & CABIN PAMPHLET (PDF)"
            >
              <SalonWindowPosterPdf
                salonName={currentSalon.name}
                salonCategory={isLadies ? 'LADIES' : 'MENS'}
                whatsappNumber={currentSalon.phone}
                location={currentSalon.location}
                initialLanguage={ownerLang}
                onDownloaded={(fileName) => {
                  setMaintToast(`✓ Downloaded Printable PDF: ${fileName}`);
                  setTimeout(() => setMaintToast(null), 5000);
                }}
              />
            </PortalCard>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. TOP-RIGHT DIFFERENCE-ONLY REGIONAL UPGRADE MODAL (FULLY LOCALIZED)     */}
      {/* ========================================================================= */}
      {isUpgradeModalOpen && (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-[#0D1117]/80 p-4 backdrop-blur-md"
          onClick={() => setIsUpgradeModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            dir={ownerLang === 'ur' || ownerLang === 'ar' ? 'rtl' : 'ltr'}
            className="w-full max-w-3xl rounded-3xl border border-[#30363D] bg-[#161B22] p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-5"
          >
            {(() => {
              const i18n = UPGRADE_MODAL_I18N[ownerLang];
              return (
                <>
                  <div className="flex items-start justify-between gap-3 border-b border-[#21262D] pb-4">
                    <div>
                      <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#D29922]">
                        {i18n.kicker} · {regionConfig.regionLabel.toUpperCase()}
                      </span>
                      <h2 className="text-xl font-black text-[#F0F6FC] mt-0.5">
                        {i18n.title(currentSalon.name)}
                      </h2>
                      <p className="text-xs text-[#8B949E] font-sans mt-1 leading-relaxed">
                        {i18n.creditNote(currentPackage.name, regionConfig.symbol, currentPackage.setupFee)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsUpgradeModalOpen(false)}
                      className="min-h-[44px] min-w-[44px] rounded-xl border border-[#30363D] bg-[#0D1117] grid place-items-center text-[#8B949E] hover:text-[#F0F6FC] hover:border-[#484F58]"
                    >
                      <X className="size-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {higherPackages.map((pkg) => {
                      const differenceAmount = Math.max(0, pkg.setupFee - currentPackage.setupFee);
                      const isSelected = selectedUpgradeTargetId === pkg.id;
                      const isDomPk = regionConfig.currency === 'PKR';
                      const localizedTitle = getLocalizedPackageName(pkg.name, ownerLang);
                      const cardCopy = getLocalizedPackageCardCopy(pkg.id, ownerLang, isDomPk);
                      const detailedFeatures = getLocalizedPackageFeatures(pkg.id, ownerLang, isDomPk);
                      return (
                        <button
                          key={pkg.id}
                          type="button"
                          onClick={() => setSelectedUpgradeTargetId(pkg.id)}
                          className={`rounded-2xl border p-4 text-left transition flex flex-col justify-between space-y-3 ${
                            isSelected
                              ? 'border-[#D29922] bg-[#3B2E0B]/40'
                              : 'border-[#30363D] bg-[#0D1117] hover:border-[#484F58]'
                          } ${ownerLang === 'ur' || ownerLang === 'ar' ? 'text-right' : 'text-left'}`}
                        >
                          <div className="space-y-2.5 w-full">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-black text-[#F0F6FC]">{localizedTitle}</span>
                              <span className="rounded-md bg-[#06B6D4]/15 border border-[#06B6D4]/30 px-2 py-0.5 text-[9px] font-mono font-bold text-[#06B6D4]">
                                {cardCopy.bookings}
                              </span>
                            </div>
                            <p className="text-[11px] font-sans text-[#8B949E] leading-snug">
                              {cardCopy.scope}
                            </p>
                            <div className="rounded-xl bg-[#161B22] border border-[#30363D] p-2.5 font-mono">
                              <span className="text-[10px] text-[#6E7681] block">
                                {i18n.fullPrice} <span className="line-through">{regionConfig.symbol}{pkg.setupFee.toLocaleString()}</span>
                              </span>
                              <p className="text-lg font-black text-[#D29922] mt-0.5">
                                {i18n.payDiff(regionConfig.symbol, differenceAmount)}
                              </p>
                              <span className="text-[10px] text-[#8B949E] block">
                                {i18n.newMaintFee(regionConfig.symbol, pkg.monthlyMaint)}
                              </span>
                            </div>
                            <ul className="space-y-1.5 pt-1">
                              {detailedFeatures.map((feat) => (
                                <li key={feat.title} className="text-[11px] text-[#8B949E] font-sans flex items-start gap-1.5">
                                  <Check className={`size-3.5 shrink-0 mt-0.5 ${feat.highlight ? 'text-[#06B6D4]' : 'text-[#3FB950]'}`} />
                                  <span className={feat.highlight ? 'text-[#F0F6FC] font-medium' : ''}>
                                    {feat.title}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {selectedUpgradeTargetId && (() => {
                    const chosenPkg = higherPackages.find((p) => p.id === selectedUpgradeTargetId);
                    if (!chosenPkg) return null;
                    const diff = Math.max(0, chosenPkg.setupFee - currentPackage.setupFee);
                    return (
                      <div className="rounded-2xl border border-[#30363D] bg-[#0D1117] p-4 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-mono font-bold text-[#F0F6FC] uppercase flex items-center gap-1.5">
                            <CreditCard className="size-4 text-[#D29922]" />
                            <span>{i18n.paymentChannelTitle(regionConfig.currency)}</span>
                          </span>
                          <span className="text-xs font-mono text-[#3FB950] font-bold">
                            {i18n.differencePayLabel(regionConfig.symbol, diff)}
                          </span>
                        </div>

                        {/* Payment Channels for Detected Region */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          {regionConfig.paymentChannels.map((ch) => (
                            <button
                              key={ch.id}
                              type="button"
                              onClick={() => setSelectedUpgradeChannel(ch.id)}
                              className={`min-h-[48px] rounded-xl border p-2.5 text-xs font-mono transition ${
                                selectedUpgradeChannel === ch.id
                                  ? 'border-[#06B6D4] bg-[#06B6D4]/15 text-[#F0F6FC]'
                                  : 'border-[#30363D] bg-[#161B22] text-[#8B949E] hover:border-[#484F58]'
                              } ${ownerLang === 'ur' || ownerLang === 'ar' ? 'text-right' : 'text-left'}`}
                            >
                              <p className="font-bold text-[#06B6D4]">{ch.label}</p>
                              <p className="text-[10px] text-[#8B949E] mt-0.5">{ch.detail}</p>
                            </button>
                          ))}
                        </div>

                        {/* Payment Details / Transaction Reference Input Field */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <label className="text-xs font-mono text-[#8B949E] block">
                              {i18n.tidLabel}
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                setUpgradeModalError(null);
                                setUpgradeTidInput(
                                  `UP-${Math.floor(10000000 + Math.random() * 90000000)}`
                                );
                              }}
                              className="text-[10px] font-mono text-[#06B6D4] hover:underline font-bold"
                            >
                              Fill Verified TID
                            </button>
                          </div>
                          <input
                            type="text"
                            dir="ltr"
                            value={upgradeTidInput}
                            onChange={(e) => {
                              setUpgradeTidInput(e.target.value);
                              if (upgradeModalError) setUpgradeModalError(null);
                            }}
                            placeholder={i18n.tidPlaceholder}
                            className="w-full min-h-[44px] rounded-xl border border-[#30363D] bg-[#161B22] px-3.5 py-2 text-xs text-left [unicode-bidi:isolate] text-[#F0F6FC] placeholder:text-[#484F58] font-mono focus:outline-none focus:border-[#D29922]"
                          />
                          {upgradeModalError && (
                            <p className="text-[11px] font-mono text-[#F85149] bg-[#4C1C1D] border border-[#da3633] rounded-xl px-3 py-2">
                              {upgradeModalError}
                            </p>
                          )}
                        </div>

                        <div className="flex justify-end pt-1">
                          <button
                            type="button"
                            disabled={isProcessingUpgrade}
                            onClick={handleConfirmPackageUpgrade}
                            className="min-h-[48px] rounded-xl bg-[#D29922] hover:bg-[#e0b252] text-[#0D1117] px-6 py-2.5 text-xs font-mono font-black uppercase transition active:scale-95 flex items-center gap-2 shadow-lg"
                          >
                            {isProcessingUpgrade ? (
                              <>
                                <RefreshCw className="size-4 animate-spin" />
                                <span>{i18n.upgradingBtn}</span>
                              </>
                            ) : (
                              <>
                                <Receipt className="size-4" />
                                <span>{i18n.confirmUpgradeBtn(regionConfig.symbol, diff)}</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. DEDICATED MAINTENANCE FEE PAYMENT MODAL (QUERY 8)                      */}
      {/* ========================================================================= */}
      {isMaintPaymentModalOpen && (
        <div
          className="fixed inset-0 z-[96] flex items-center justify-center bg-[#0D1117]/85 p-4 backdrop-blur-md"
          onClick={() => setIsMaintPaymentModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            dir={ownerLang === 'ur' || ownerLang === 'ar' ? 'rtl' : 'ltr'}
            className="w-full max-w-xl rounded-3xl border border-[#30363D] bg-[#161B22] p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-5"
          >
            {(() => {
              const i18n = MAINT_MODAL_I18N[ownerLang];
              return (
                <>
                  <div className="flex items-start justify-between gap-3 border-b border-[#21262D] pb-4">
                    <div>
                      <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#06B6D4]">
                        {i18n.kicker}
                      </span>
                      <h2 className="text-xl font-black text-[#F0F6FC] mt-0.5">
                        {i18n.title(currentSalon.name)}
                      </h2>
                      <p className="text-xs text-[#8B949E] font-sans mt-1 leading-relaxed">
                        {i18n.description(regionConfig.symbol, currentSalon.maint, currentSalon.phone)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsMaintPaymentModalOpen(false)}
                      className="min-h-[44px] min-w-[44px] rounded-xl border border-[#30363D] bg-[#0D1117] grid place-items-center text-[#8B949E] hover:text-[#F0F6FC]"
                    >
                      <X className="size-4" />
                    </button>
                  </div>

                  {/* Summary Box */}
                  <div className="rounded-2xl border border-[#116329] bg-[#0D3822]/40 p-4 flex items-center justify-between gap-3 font-mono">
                    <div>
                      <span className="text-[10px] text-[#8B949E] uppercase block">{i18n.feeHeading}</span>
                      <p className="text-2xl font-black text-[#3FB950] mt-0.5">
                        {regionConfig.symbol}{currentSalon.maint.toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-[#8B949E] block">{i18n.dueDateHeading}</span>
                      <span className="text-xs font-bold text-[#06B6D4]">Auto-cleared via SIM</span>
                    </div>
                  </div>

                  {/* Payment Channels for Region */}
                  <div className="space-y-2">
                    <span className="text-xs font-mono font-bold text-[#F0F6FC] block">
                      {i18n.channelHeading(regionConfig.currency)}:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {regionConfig.paymentChannels.map((ch) => (
                        <button
                          key={ch.id}
                          type="button"
                          onClick={() => setMaintPaymentChannel(ch.id)}
                          className={`min-h-[48px] rounded-xl border p-2.5 text-xs font-mono transition ${
                            maintPaymentChannel === ch.id
                              ? 'border-[#06B6D4] bg-[#06B6D4]/15 text-[#F0F6FC]'
                              : 'border-[#30363D] bg-[#0D1117] text-[#8B949E] hover:border-[#484F58]'
                          } ${ownerLang === 'ur' || ownerLang === 'ar' ? 'text-right' : 'text-left'}`}
                        >
                          <p className="font-bold text-[#06B6D4]">{ch.label}</p>
                          <p className="text-[10px] text-[#8B949E] mt-0.5">{ch.detail}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Transaction ID / Sender SIM input */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-xs font-mono text-[#8B949E] block">
                        {i18n.tidLabel}
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setMaintModalError(null);
                          setMaintPaymentTidInput(
                            `${currentSalon.phone.startsWith('+92') ? 'EP' : 'ST'}-${Math.floor(
                              10000000 + Math.random() * 90000000
                            )}`
                          );
                        }}
                        className="text-[10px] font-mono text-[#06B6D4] hover:underline font-bold"
                      >
                        Fill Verified TID
                      </button>
                    </div>
                    <input
                      type="text"
                      dir="ltr"
                      value={maintPaymentTidInput}
                      onChange={(e) => {
                        setMaintPaymentTidInput(e.target.value);
                        if (maintModalError) setMaintModalError(null);
                      }}
                      placeholder={i18n.tidPlaceholder}
                      className="w-full min-h-[44px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3.5 py-2 text-xs text-left [unicode-bidi:isolate] text-[#F0F6FC] placeholder:text-[#484F58] font-mono focus:outline-none focus:border-[#06B6D4]"
                    />
                    {maintModalError && (
                      <p className="text-[11px] font-mono text-[#F85149] bg-[#4C1C1D] border border-[#da3633] rounded-xl px-3 py-2">
                        {maintModalError}
                      </p>
                    )}
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsMaintPaymentModalOpen(false)}
                      className="min-h-[44px] px-4 py-2 rounded-xl border border-[#30363D] text-[#8B949E] hover:text-[#F0F6FC] text-xs font-mono"
                    >
                      {i18n.cancelBtn}
                    </button>
                    <button
                      type="button"
                      disabled={isPayingMaint}
                      onClick={handleConfirmMaintPayment}
                      className="min-h-[48px] rounded-xl bg-[#06B6D4] hover:bg-[#22D3EE] text-[#0D1117] px-6 py-2.5 text-xs font-mono font-black uppercase transition active:scale-95 flex items-center gap-2 shadow-lg"
                    >
                      {isPayingMaint ? (
                        <>
                          <RefreshCw className="size-4 animate-spin" />
                          <span>{i18n.processingBtn}</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="size-4" />
                          <span>{i18n.payBtn(regionConfig.symbol, currentSalon.maint)}</span>
                        </>
                      )}
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. INTERACTIVE LOCATION & GOOGLE MAPS PIN MODAL (QUERY 7)                 */}
      {/* ========================================================================= */}
      {isLocationModalOpen && (
        <div
          className="fixed inset-0 z-[96] flex items-center justify-center bg-[#0D1117]/80 p-4 backdrop-blur-md"
          onClick={() => setIsLocationModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-3xl border border-[#30363D] bg-[#161B22] p-5 sm:p-6 shadow-2xl space-y-4 animate-in fade-in"
          >
            <div className="flex items-start justify-between gap-3 border-b border-[#21262D] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="size-10 rounded-xl bg-[#0D3822] border border-[#116329] grid place-items-center text-[#3FB950]">
                  <MapPin className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#F0F6FC]">
                    {currentSalon.name} · Location Pin
                  </h3>
                  <p className="text-xs text-[#8B949E] font-sans">
                    {currentSalon.location} ({regionConfig.regionLabel})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsLocationModalOpen(false)}
                className="size-9 rounded-xl border border-[#30363D] grid place-items-center text-[#8B949E] hover:text-[#F0F6FC]"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Simulated Google Map View Card */}
            <div className="rounded-2xl border border-[#30363D] bg-[#0D1117] p-4 relative overflow-hidden space-y-3">
              <div className="h-40 rounded-xl bg-gradient-to-br from-[#161B22] via-[#21262D] to-[#0D1117] border border-[#30363D] flex flex-col items-center justify-center text-center p-4 relative">
                <div className="size-12 rounded-full bg-[#116329]/80 border-2 border-[#3FB950] grid place-items-center text-[#3FB950] shadow-xl animate-bounce">
                  <MapPin className="size-6" />
                </div>
                <p className="text-xs font-bold text-[#F0F6FC] mt-2">{currentSalon.name}</p>
                <p className="text-[11px] text-[#8B949E] font-sans max-w-xs truncate">{currentSalon.location}</p>
                <div className="absolute top-2 right-2 rounded-md bg-[#0D1117]/80 border border-[#30363D] px-2 py-0.5 text-[9px] font-mono text-[#06B6D4]">
                  GPS PIN VERIFIED
                </div>
              </div>

              <div className="rounded-xl bg-[#161B22] p-3 border border-[#30363D] text-xs font-mono space-y-1">
                <div className="flex justify-between text-[#8B949E]">
                  <span>Full Address:</span>
                  <span className="text-[#F0F6FC] font-sans font-bold">{currentSalon.location}</span>
                </div>
                <div className="flex justify-between text-[#8B949E]">
                  <span>WhatsApp Contact:</span>
                  <span className="text-[#06B6D4]">{currentSalon.phone}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(currentSalon.name + ' ' + currentSalon.location)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-h-[44px] rounded-xl bg-[#3FB950] hover:bg-[#2ea043] text-[#0D1117] font-mono font-bold text-xs uppercase grid place-items-center shadow-lg transition"
              >
                <span>🌐 Open in Google Maps →</span>
              </a>
              <button
                type="button"
                onClick={() => {
                  setMaintToast(`✓ Location Pin sent to client via WhatsApp link.`);
                  setIsLocationModalOpen(false);
                  setTimeout(() => setMaintToast(null), 4000);
                }}
                className="min-h-[44px] rounded-xl border border-[#30363D] bg-[#21262D] hover:bg-[#30363D] text-[#F0F6FC] text-xs font-mono px-4 transition"
              >
                Send via WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. SALON TIMING & WEEKLY SCHEDULE MODAL (QUERY 7)                         */}
      {/* ========================================================================= */}
      {isTimingModalOpen && (
        <div
          className="fixed inset-0 z-[96] flex items-center justify-center bg-[#0D1117]/80 p-4 backdrop-blur-md"
          onClick={() => setIsTimingModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-3xl border border-[#30363D] bg-[#161B22] p-5 sm:p-6 shadow-2xl space-y-4 animate-in fade-in"
          >
            <div className="flex items-start justify-between gap-3 border-b border-[#21262D] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="size-10 rounded-xl bg-[#3B2E0B] border border-[#9E6A03] grid place-items-center text-[#D29922]">
                  <Clock className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#F0F6FC]">
                    {currentSalon.name} · Operating Hours
                  </h3>
                  <p className="text-xs text-[#3FB950] font-mono flex items-center gap-1.5 mt-0.5">
                    <span className="size-2 rounded-full bg-[#3FB950] animate-pulse" />
                    <span>🟢 Currently Open · Daily Service</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTimingModalOpen(false)}
                className="size-9 rounded-xl border border-[#30363D] grid place-items-center text-[#8B949E] hover:text-[#F0F6FC]"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="rounded-2xl border border-[#30363D] bg-[#0D1117] p-4 space-y-2.5 text-xs font-mono">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#161B22] border border-[#30363D]">
                <span className="text-[#F0F6FC] font-bold">Monday – Thursday:</span>
                <span className="text-[#06B6D4]">
                  {salonHours.monThuClosed
                    ? 'Closed'
                    : `${salonHours.monThuOpen} – ${salonHours.monThuClose}`}
                </span>
              </div>
              <div className="flex flex-col p-2.5 rounded-xl bg-[#3B2E0B]/30 border border-[#9E6A03] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[#D29922] font-bold">Friday (Jummah Schedule):</span>
                  <span className="text-[#D29922]">
                    {salonHours.fridayClosed
                      ? 'Closed'
                      : `${salonHours.fridayOpen} – ${salonHours.fridayClose}`}
                  </span>
                </div>
                {!salonHours.fridayClosed && (
                  <span className="text-[10px] text-[#F85149] font-sans">
                    ⚠️ Friday Prayer Break: Closed {salonHours.fridayBreakStart} –{' '}
                    {salonHours.fridayBreakEnd}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#161B22] border border-[#30363D]">
                <span className="text-[#F0F6FC] font-bold">Saturday &amp; Sunday:</span>
                <span className="text-[#3FB950]">
                  {salonHours.satSunClosed
                    ? 'Closed'
                    : `${salonHours.satSunOpen} – ${salonHours.satSunClose}`}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-[#8B949E] font-sans">
              ℹ️ Walk-ins are always welcomed in-chair. Pre-booking via WhatsApp is advised for weekend rush hours.
            </p>

            <div className="pt-1 flex justify-end">
              <button
                type="button"
                onClick={() => setIsTimingModalOpen(false)}
                className="min-h-[44px] px-6 rounded-xl bg-[#06B6D4] hover:bg-[#22D3EE] text-[#0D1117] text-xs font-mono font-bold uppercase transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. FLOATING WHATSAPP RECEIPT NOTICE DRAWER (QUERY 1 & 8)                  */}
      {/* ========================================================================= */}
      {whatsAppReceiptNotice && (
        <div className="fixed bottom-4 right-4 z-[98] max-w-md w-full p-2 animate-in slide-in-from-bottom-5">
          <div className="rounded-3xl border-2 border-[#3FB950] bg-[#161B22] p-4 shadow-2xl space-y-2.5">
            <div className="flex items-center justify-between gap-2 border-b border-[#21262D] pb-2">
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#3FB950]">
                <span className="size-2 rounded-full bg-[#3FB950] animate-pulse" />
                <MessageSquare className="size-4" />
                <span>{whatsAppReceiptNotice.title}</span>
              </div>
              <button
                type="button"
                onClick={() => setWhatsAppReceiptNotice(null)}
                className="size-7 rounded-lg border border-[#30363D] grid place-items-center text-[#8B949E] hover:text-[#F0F6FC]"
              >
                <X className="size-3.5" />
              </button>
            </div>

            <div className="text-[11px] font-mono text-[#8B949E] flex items-center justify-between">
              <span>To: {whatsAppReceiptNotice.phone}</span>
              <span>{whatsAppReceiptNotice.timestamp}</span>
            </div>

            <p
              dir={ownerLang === 'ur' || ownerLang === 'ar' ? 'rtl' : 'ltr'}
              className="text-xs text-[#F0F6FC] font-sans leading-relaxed bg-[#0D1117] p-3 rounded-2xl border border-[#30363D]"
            >
              {whatsAppReceiptNotice.body}
            </p>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setWhatsAppReceiptNotice(null)}
                className="text-[10px] font-mono font-bold text-[#3FB950] hover:underline"
              >
                ✓ Dismiss WhatsApp Notice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
