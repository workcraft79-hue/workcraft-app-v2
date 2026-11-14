import React, { useState, useEffect, useRef } from 'react';
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
} from 'lucide-react';
import { PortalCard } from './PortalCard';
import { BroadcastTab } from './Tabs/BroadcastTab';
import { SalonWindowPosterPdf } from './SalonWindowPosterPdf';
import { SalonRetentionSettingsPanel } from './SalonRetentionSettingsPanel';
import { Contact, SalonProfile } from '../types';
import type { SalonConciergeStateResponse } from '../types/concierge';
import { generate214Contacts } from '../data/mockData';
import type { OnboardedSalonPayload } from './FieldAgentHub';

interface BookingRecord {
  id: string;
  clientName: string;
  barberName: string;
  phone: string;
  service: string;
  price: number;
  timeSlot: string;
  durationMins?: number;
  chairLabel?: string;
  status: 'CONFIRMED' | 'IN_CHAIR' | 'COMPLETED';
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
        setupFee: 15000,
        monthlyMaint: 1500,
        bookingsLimit: '500 bookings/mo',
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
        setupFee: 20000,
        monthlyMaint: 2000,
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
        setupFee: 25000,
        monthlyMaint: 2500,
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
        setupFee: 35000,
        monthlyMaint: 3500,
        bookingsLimit: 'Unlimited / Multi-Branch',
        badge: 'Enterprise',
        features: [
          'Everything in VIP Executive',
          'Multi-Branch & Multi-Barber Voice Routing',
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
        setupFee: 275,
        monthlyMaint: 28,
        bookingsLimit: '500 bookings/mo',
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
        setupFee: 405,
        monthlyMaint: 41,
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
        setupFee: 590,
        monthlyMaint: 59,
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
        monthlyMaint: 92,
        bookingsLimit: 'Unlimited / Multi-Branch',
        badge: 'Enterprise',
        features: [
          'Everything in VIP Executive',
          'Multi-Branch & Multi-Barber Voice Routing',
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
        setupFee: 280,
        monthlyMaint: 28,
        bookingsLimit: '500 bookings/mo',
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
        setupFee: 415,
        monthlyMaint: 42,
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
        setupFee: 600,
        monthlyMaint: 60,
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
        monthlyMaint: 94,
        bookingsLimit: 'Unlimited / Multi-Branch',
        badge: 'Enterprise',
        features: [
          'Everything in VIP Executive',
          'Multi-Branch & Multi-Barber Voice Routing',
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
        setupFee: 60,
        monthlyMaint: 6,
        bookingsLimit: '500 bookings/mo',
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
        setupFee: 85,
        monthlyMaint: 8.5,
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
        setupFee: 125,
        monthlyMaint: 12.5,
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
        setupFee: 195,
        monthlyMaint: 19.5,
        bookingsLimit: 'Unlimited / Multi-Branch',
        badge: 'Enterprise',
        features: [
          'Everything in VIP Executive',
          'Multi-Branch & Multi-Barber Voice Routing',
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
        setupFee: 75,
        monthlyMaint: 7.5,
        bookingsLimit: '500 bookings/mo',
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
        setupFee: 110,
        monthlyMaint: 11,
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
        setupFee: 160,
        monthlyMaint: 16,
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
        monthlyMaint: 25,
        bookingsLimit: 'Unlimited / Multi-Branch',
        badge: 'Enterprise',
        features: [
          'Everything in VIP Executive',
          'Multi-Branch & Multi-Barber Voice Routing',
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
    newMaintFee: (sym, amt) => `نئی 10% ماہانہ مینٹیننس فیس: ${sym}${amt.toLocaleString()} / ماہ`,
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
    newMaintFee: (sym, amt) => `رسوم الصيانة الشهرية الجديدة (10%): ${sym}${amt.toLocaleString()} / شهرياً`,
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
    newMaintFee: (sym, amt) => `New 10% Monthly Maintenance: ${sym}${amt.toLocaleString()}/mo`,
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
    kicker: 'ماہانہ 10% مینٹیننس فیس ادائیگی · خودکار سسٹم بحالی',
    title: (salon) => `${salon} کی مینٹیننس فیس ادا کریں`,
    description: (sym, amt, phone) =>
      `ماہانہ 10% مینٹیننس فیس (${sym}${amt.toLocaleString()}) اپنے رجسٹرڈ واٹس ایپ نمبر (${phone}) سے کسی بھی چینل کے ذریعے ادا کر کے فوری Tier-1 ترجیح اور لائیو میٹرکس بحال کریں۔`,
    feeHeading: 'مقررہ ماہانہ فیس:',
    dueDateHeading: 'آخری تاریخ: ہر ماہ کی 5 تاریخ',
    channelHeading: (curr) => `ادائیگی کا چینل منتخب کریں (${curr})`,
    tidLabel: 'ٹرانزیکشن آئی ڈی یا بھیجنے والے اکاؤنٹ کی تفصیل:',
    tidPlaceholder: 'مثلاً TID یا JazzCash / EasyPaisa / بینک ریفرنس نمبر درج کریں',
    payBtn: (sym, amt) => `فیس ${sym}${amt.toLocaleString()} ادا کریں اور ترجیح بحال کریں ←`,
    processingBtn: 'تصدیق ہو رہی ہے...',
    cancelBtn: 'منسوخ کریں',
    whatsappNotice: (owner, salon, sym, amt, ch, tid) =>
      `محترم ${owner} صاحب! السلام علیکم۔ آپ کے سیلون "${salon}" کی ماہانہ 10% مینٹیننس فیس (${sym}${amt.toLocaleString()}) بذریعہ ${ch} کامیابی سے موصول ہو گئی ہے۔ (TID: ${tid})۔ آپ کا لائیو ڈیش بورڈ، میٹرکس اور Tier-1 ترجیحی واٹس ایپ سپورٹ مکمل بحال ہے۔ شکریہ!`,
  },
  ar: {
    kicker: 'سداد رسوم الصيانة الشهرية 10% · استعادة الأولوية',
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
    kicker: '10% MONTHLY MAINTENANCE PAYMENT · AUTO PRIORITY RESTORATION',
    title: (salon) => `Pay Maintenance Fee for ${salon}`,
    description: (sym, amt, phone) =>
      `Clear your 10% monthly maintenance fee (${sym}${amt.toLocaleString()}) from your registered SIM (${phone}) to unlock live metrics and maintain Tier-1 priority auto-replies.`,
    feeHeading: 'Monthly Due Fee:',
    dueDateHeading: 'Due Date: 5th of Every Month',
    channelHeading: (curr) => `Select Payment Channel (${curr})`,
    tidLabel: 'Transaction ID / Sender Account Proof:',
    tidPlaceholder: 'Enter TID or sender account reference (e.g. TID: EP-90482)',
    payBtn: (sym, amt) => `Pay ${sym}${amt.toLocaleString()} & Restore Priority →`,
    processingBtn: 'Verifying Transaction...',
    cancelBtn: 'Cancel',
    whatsappNotice: (owner, salon, sym, amt, ch, tid) =>
      `Dear ${owner}! Greetings. The 10% monthly maintenance fee of ${sym}${amt.toLocaleString()} for "${salon}" has been successfully cleared via ${ch}. (TID: ${tid}). Your live stats, business metrics, and Tier-1 concierge priority are active. Thank you!`,
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

export const INITIAL_CLIENT_SALONS: ClientSalon[] = [
  {
    id: '1',
    name: 'Seven Cuts Studio',
    owner: 'Hamza Malik',
    phone: '+92 321 8472910',
    location: 'DHA Phase 5, Lahore',
    planId: 'VIP',
    plan: 'VIP Executive',
    maint: 2500,
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
    maint: 1500,
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
    maint: 16,
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
    maint: 7.5,
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
    maint: 2000,
    language: 'ur',
    onboardingLanguage: 'ur',
  },
];

export const CLIENT_SALONS = INITIAL_CLIENT_SALONS;

interface SalonOwnerDashboardProps {
  salonName?: string;
  selectedSalonName?: string;
  ownerName?: string;
  phone?: string;
  salonCategory?: 'MENS' | 'LADIES';
  onboardedData?: OnboardedSalonPayload | null;
  isFounderInspector?: boolean;
  sectionMode?: 'LIVE' | 'MANAGE';
  onSectionModeChange?: (mode: 'LIVE' | 'MANAGE') => void;
  onOpenSimulator?: () => void;
  onClose?: () => void;
}

export const SalonOwnerDashboard: React.FC<SalonOwnerDashboardProps> = ({
  selectedSalonName,
  salonCategory,
  onboardedData,
  isFounderInspector = false,
  sectionMode,
  onSectionModeChange,
  onClose,
}) => {
  const [salonsState, setSalonsState] = useState<ClientSalon[]>(() => {
    if (!onboardedData) return INITIAL_CLIENT_SALONS;
    const customEntry: ClientSalon = {
      id: 'onboarded-live',
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
    const filtered = INITIAL_CLIENT_SALONS.filter(
      (s) => s.name.toLowerCase() !== onboardedData.salonName.trim().toLowerCase()
    );
    return [customEntry, ...filtered];
  });
  const [selectedSalonId, setSelectedSalonId] = useState<string>(
    onboardedData ? 'onboarded-live' : '1'
  );

  useEffect(() => {
    if (!onboardedData) return;
    const customEntry: ClientSalon = {
      id: 'onboarded-live',
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
      ...prev.filter((s) => s.id !== 'onboarded-live' && s.name.toLowerCase() !== onboardedData.salonName.trim().toLowerCase()),
    ]);
    setSelectedSalonId('onboarded-live');
  }, [onboardedData]);

  // Query 3: Match exact clicked salon when Founder inspects from Overview or Clients
  useEffect(() => {
    if (onboardedData) return;
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
  }, [selectedSalonName, salonsState, onboardedData]);

  const currentSalon = salonsState.find((s) => s.id === selectedSalonId) || salonsState[0];
  const regionConfig = getRegionFromPhone(currentSalon.phone, currentSalon.location);
  const currentPackage =
    regionConfig.packages.find((p) => p.id === currentSalon.planId) || regionConfig.packages[0];
  const higherPackages = regionConfig.packages.filter(
    (p) => p.setupFee > currentPackage.setupFee
  );

  // Consolidated Two-Mode Architecture: LIVE (Daily Operations) vs MANAGE (Shop Setup & Rules)
  const [internalSectionMode, setInternalSectionMode] = useState<'LIVE' | 'MANAGE'>('LIVE');
  const currentSectionMode = sectionMode ?? internalSectionMode;
  const setSectionMode = (mode: 'LIVE' | 'MANAGE') => {
    setInternalSectionMode(mode);
    onSectionModeChange?.(mode);
  };
  const [manageSubSection, setManageSubSection] = useState<
    'STAFF' | 'SERVICES' | 'HOURS' | 'AUTOMATION' | 'POSTER'
  >('STAFF');
  const [showManageAdvancedTools, setShowManageAdvancedTools] = useState(false);
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
  const [isProcessingUpgrade, setIsProcessingUpgrade] = useState(false);

  // Query 8: Maintenance Fee Payment Modal State
  const [isMaintPaymentModalOpen, setIsMaintPaymentModalOpen] = useState(false);
  const [maintPaymentChannel, setMaintPaymentChannel] = useState<string>(
    regionConfig.paymentChannels[0].id
  );
  const [maintPaymentTidInput, setMaintPaymentTidInput] = useState('');

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

  // Query 2 (Self-Service Owner Re-Login): Instant WhatsApp OTP reconnect without physical agent or Founder
  const [isOwnerLoggedOut, setIsOwnerLoggedOut] = useState<boolean>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('relogin') === 'true';
    } catch {
      return false;
    }
  });
  const [reLoginStep, setReLoginStep] = useState<'PHONE' | 'OTP'>('PHONE');
  const [reLoginPhoneInput, setReLoginPhoneInput] = useState<string>(currentSalon.phone);
  const [reLoginOtpInput, setReLoginOtpInput] = useState<string>('');
  const [reLoginGeneratedOtp, setReLoginGeneratedOtp] = useState<string>('849201');
  const [reLoginError, setReLoginError] = useState<string | null>(null);
  const [reLoginMatchedSalonId, setReLoginMatchedSalonId] = useState<string>(currentSalon.id);

  // Owner Onboarding / Voice Language & Shop-Floor Loudspeaker Controls
  const [ownerLang, setOwnerLang] = useState<VoiceLang>(currentSalon.onboardingLanguage);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [voiceFilter, setVoiceFilter] = useState<'ALL' | 'URGENT_ONLY'>('ALL');
  const [isWakeLockActive, setIsWakeLockActive] = useState(true);
  const [wakeLockNote, setWakeLockNote] = useState<string | null>(null);
  const [currentlySpeakingText, setCurrentlySpeakingText] = useState<string | null>(null);
  const wakeLockRef = useRef<{ release?: () => Promise<void> } | null>(null);

  // Rush-Hour Loudspeaker / Bluetooth Speaker Boost (ON by default so floor alerts cut through noise)
  const [isLoudspeakerBoostActive, setIsLoudspeakerBoostActive] = useState(true);
  const [showVoiceLogsDrawer, setShowVoiceLogsDrawer] = useState(false);
  const [showProofLedgerDrawer, setShowProofLedgerDrawer] = useState(false);
  const [isTestingLoudAlert, setIsTestingLoudAlert] = useState(false);

  // Stylist / Barber Top Services Breakdown Selection
  const [selectedBarberForServices, setSelectedBarberForServices] = useState<string>('ALL');

  // Interactive Walk-In Quick Modal (Multi-Service Support)
  const [isWalkInModalOpen, setIsWalkInModalOpen] = useState(false);
  const [walkInName, setWalkInName] = useState('Walk-in Client');
  const [walkInBarber, setWalkInBarber] = useState('Master Aslam');
  const [walkInSelectedServiceIds, setWalkInSelectedServiceIds] = useState<string[]>(['s1']);
  const [walkInPrice, setWalkInPrice] = useState(800);
  const [walkInPhone, setWalkInPhone] = useState('');
  const [walkInBirthDate, setWalkInBirthDate] = useState('');
  const [walkInImmediateChair, setWalkInImmediateChair] = useState(false);

  const [voiceLogs, setVoiceLogs] = useState<VoiceEventLog[]>([
    {
      id: 'vlog-init-1',
      type: 'BOOKING',
      clientName: 'Bilal Ahmed',
      clientLang: 'ur',
      ownerVoiceLang: 'ur',
      summary: 'New 03:30 PM booking · Barber: Master Aslam · Master Haircut & Skin Fade',
      spokenText:
        'Hamza Sahab! Master Aslam ki nayi appointment Bilal Ahmed kay sath 3:30 PM par confirm ho gayi hai: Master Haircut and Skin Fade.',
      time: '03:15 PM',
      isUrgent: false,
    },
    {
      id: 'vlog-init-2',
      type: 'REPLY_CONFIRMED',
      clientName: 'Saud Al-Rashid',
      clientLang: 'ar',
      ownerVoiceLang: 'ur',
      summary: 'Arabic Client Reply Translated ➔ Owner Voice: Confirmed 4:00 PM slot',
      spokenText:
        'سعود نے عربی میں 4 بجے کی اپائنٹمنٹ کنفرم کر دی ہے: ہیئر کٹ اور داڑھی کی سیٹنگ۔',
      time: '02:40 PM',
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

  // Sync salon defaults when switching test salons + poll incoming WhatsApp confirmations & reminder replies
  useEffect(() => {
    setOwnerLang(currentSalon.onboardingLanguage);
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
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [currentSalon.id, currentSalon.name, currentSalon.owner, currentSalon.onboardingLanguage, currentSalon.phone]);

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

  // Free $0/mo Web Audio Alert Chime with Rush-Hour Loudspeaker Boost + Web Speech API Reader
  const playFreeNotificationChime = (isBoost = false) => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
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

  const speakHandsFree = (text: string, lang: VoiceLang = ownerLang, romanUrduFallback?: string) => {
    if (!isVoiceEnabled || isFounderInspector) return;
    playFreeNotificationChime(isLoudspeakerBoostActive);
    setCurrentlySpeakingText(text);

    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        
        const voices = window.speechSynthesis.getVoices() || [];
        let chosenVoice: SpeechSynthesisVoice | undefined;
        let textToSpeak = text;
        let voiceLangCode = 'en-US';

        if (lang === 'ar') {
          voiceLangCode = 'ar-SA';
          chosenVoice = voices.find((v) => v.lang.startsWith('ar'));
        } else if (lang === 'ur') {
          // Look for native Urdu voice first
          chosenVoice = voices.find((v) => v.lang.startsWith('ur'));
          if (chosenVoice) {
            voiceLangCode = chosenVoice.lang;
          } else {
            // Find Hindi / Hindustani voice which shares natural Urdu phonetics
            const hiVoice = voices.find((v) => v.lang.startsWith('hi'));
            if (hiVoice) {
              chosenVoice = hiVoice;
              voiceLangCode = hiVoice.lang;
              if (romanUrduFallback) textToSpeak = romanUrduFallback;
            } else if (romanUrduFallback) {
              textToSpeak = romanUrduFallback;
              voiceLangCode = 'en-US';
            }
          }
        }

        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        if (chosenVoice) utterance.voice = chosenVoice;
        utterance.lang = voiceLangCode;
        utterance.rate = isLoudspeakerBoostActive ? 0.90 : 0.96;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        utterance.onend = () => setCurrentlySpeakingText(null);
        utterance.onerror = () => setCurrentlySpeakingText(null);
        window.speechSynthesis.speak(utterance);
        setTimeout(() => {
          setCurrentlySpeakingText((prev) => (prev === text ? null : prev));
        }, 8000);
      } else {
        setTimeout(() => setCurrentlySpeakingText(null), 5000);
      }
    } catch {
      setTimeout(() => setCurrentlySpeakingText(null), 5000);
    }
  };

  const stopSpeaking = () => {
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    } catch {
      // Ignore
    }
    setCurrentlySpeakingText(null);
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

  const handleAutoClearMaintenance = () => {
    setIsPayingMaint(true);
    setTimeout(() => {
      const tid = `${currentSalon.phone.startsWith('+92') ? 'EP' : 'ST'}-${Math.floor(
        10000000000 + Math.random() * 90000000000
      )}`;
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
    }, 650);
  };

  const handleConfirmMaintPayment = () => {
    setIsPayingMaint(true);
    const chosenTid =
      maintPaymentTidInput.trim() ||
      `${currentSalon.phone.startsWith('+92') ? 'EP' : 'ST'}-${Math.floor(
        10000000000 + Math.random() * 90000000000
      )}`;
    const channelName =
      regionConfig.paymentChannels.find((c) => c.id === maintPaymentChannel)?.label ||
      maintPaymentChannel;

    setTimeout(() => {
      setIsPayingMaint(false);
      setIsMaintPaymentModalOpen(false);
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

      // Automated WhatsApp Receipt Message to Salon Owner's phone
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
    }, 650);
  };

  const handleConfirmPackageUpgrade = () => {
    if (!selectedUpgradeTargetId) return;
    const targetPkg = regionConfig.packages.find((p) => p.id === selectedUpgradeTargetId);
    if (!targetPkg) return;
    const differenceAmount = Math.max(0, targetPkg.setupFee - currentPackage.setupFee);
    const chosenTid =
      upgradeTidInput.trim() ||
      `UP-${Math.floor(1000000000 + Math.random() * 9000000000)}`;

    setIsProcessingUpgrade(true);
    setTimeout(() => {
      setSalonsState((prev) =>
        prev.map((s) =>
          s.id === currentSalon.id
            ? { ...s, planId: targetPkg.id, plan: targetPkg.name, maint: targetPkg.monthlyMaint }
            : s
        )
      );
      setIsProcessingUpgrade(false);
      setIsUpgradeModalOpen(false);
      setSelectedUpgradeTargetId(null);
      setUpgradeTidInput('');

      const i18n = UPGRADE_MODAL_I18N[ownerLang];
      setMaintToast(i18n.successToast(targetPkg.name, regionConfig.symbol, differenceAmount));

      // Automated WhatsApp Greeting and Upgrade Confirmation to Salon Owner's WhatsApp
      const greetingMsg = i18n.whatsappGreeting(
        currentSalon.owner,
        currentSalon.name,
        targetPkg.name,
        regionConfig.symbol,
        differenceAmount,
        chosenTid
      );

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
    }, 700);
  };

  // Live Queue State
  const [bookings, setBookings] = useState<BookingRecord[]>([
    {
      id: 'BK-101',
      clientName: 'Bilal Ahmed',
      barberName: 'Master Aslam',
      phone: '+92 300 1234567',
      service: 'Master Haircut & Skin Fade',
      price: 1200,
      timeSlot: '03:30 PM',
      durationMins: 40,
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
      status: 'COMPLETED',
    },
  ]);

  const isLadies =
    onboardedData?.salonCategory === 'LADIES' ||
    salonCategory === 'LADIES' ||
    currentSalon.name.toLowerCase().includes('parlor') ||
    currentSalon.name.toLowerCase().includes('ladies') ||
    currentSalon.name.toLowerCase().includes('beauty') ||
    (typeof window !== 'undefined' && localStorage.getItem('wcl_salon_category') === 'LADIES');

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
      const firstActive = mapped.find((s) => s.active);
      if (firstActive) {
        setWalkInSelectedServiceIds([firstActive.id]);
        setWalkInPrice(firstActive.price);
      }
    }
    if (onboardedData.barbers && onboardedData.barbers.length > 0) {
      setBarbersList(onboardedData.barbers);
      setWalkInBarber(onboardedData.barbers[0]);
    }
  }, [onboardedData]);
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

  // Hands-Free Loudspeaker Engine for Incoming Appointment Confirmations & Reminder Replies
  const announceInboundEventLoudly = (params: {
    eventType:
      | 'APPOINTMENT_CONFIRMED'
      | 'REMINDER_REPLY_CONFIRMED'
      | 'REMINDER_REPLY_LATE'
      | 'REMINDER_REPLY_RESCHEDULE';
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
      eventType === 'REMINDER_REPLY_LATE' || eventType === 'REMINDER_REPLY_RESCHEDULE';

    const speechByLang: Record<VoiceLang, string> = {
      en:
        eventType === 'APPOINTMENT_CONFIRMED'
          ? `Attention! Appointment confirmed. ${clientName} wants barber ${barberName}. Services: ${servicesText}, for ${timeSlot}.`
          : eventType === 'REMINDER_REPLY_CONFIRMED'
          ? `Reminder reply! ${clientName} confirmed coming at ${timeSlot} with barber ${barberName}.`
          : eventType === 'REMINDER_REPLY_LATE'
          ? `Urgent arrival update! ${clientName} replied they are running 15 minutes late for ${timeSlot} with ${barberName}.`
          : `Urgent schedule update! ${clientName} cannot make ${timeSlot} and requested to reschedule.`,
      ur:
        eventType === 'APPOINTMENT_CONFIRMED'
          ? `توجہ فرمائیں! ${clientName} کی اپائنٹمنٹ باربر ${barberName} کے ساتھ ${timeSlot} پر کنفرم ہو گئی ہے۔ سروسز: ${servicesText}۔`
          : eventType === 'REMINDER_REPLY_CONFIRMED'
          ? `ریمائنڈر کا جواب! ${clientName} نے ${timeSlot} پر باربر ${barberName} کے پاس آنے کی تصدیق کر دی ہے۔`
          : eventType === 'REMINDER_REPLY_LATE'
          ? `ضروری اطلاع! ${clientName} نے ریمائنڈر پر جواب دیا ہے کہ وہ ${timeSlot} پر تھوڑی دیر سے پہنچیں گے۔`
          : `اہم اطلاع! ${clientName} آج ${timeSlot} پر نہیں آ سکیں گے اور نیا وقت مانگا ہے۔`,
      ar:
        eventType === 'APPOINTMENT_CONFIRMED'
          ? `تنبيه! تم تأكيد موعد جديد. ${clientName} يريد الحلاق ${barberName}. الخدمات: ${servicesText} الساعة ${timeSlot}.`
          : eventType === 'REMINDER_REPLY_CONFIRMED'
          ? `رد التذكير! أكد ${clientName} حضوره الساعة ${timeSlot} مع الحلاق ${barberName}.`
          : eventType === 'REMINDER_REPLY_LATE'
          ? `تحديث وصول عاجل! أرسل ${clientName} أنه سيتأخر عن موعد ${timeSlot}.`
          : `تنبيه جدول عاجل! طلب ${clientName} تأجيل موعد ${timeSlot}.`,
    };

    const romanUrduByEvent: Record<typeof eventType, string> = {
      APPOINTMENT_CONFIRMED: `Tawajjo farmayein! ${clientName} ki appointment barber ${barberName} kay sath ${timeSlot} par confirm ho gayi hai. Services: ${servicesText}.`,
      REMINDER_REPLY_CONFIRMED: `Reminder jawab: ${clientName} nay ${timeSlot} par barber ${barberName} kay paas aane ki tasdeeq kar di hai.`,
      REMINDER_REPLY_LATE: `Zaroori itlaa: ${clientName} nay reminder par jawab diya hai ke woh ${timeSlot} par late pohanchein gay.`,
      REMINDER_REPLY_RESCHEDULE: `Ahem itlaa: ${clientName} aaj ${timeSlot} par nahi aa sakein gay aur naya time manga hai.`,
    };

    const spokenText = speechByLang[ownerLang];
    const logType: VoiceEventLog['type'] =
      eventType === 'APPOINTMENT_CONFIRMED'
        ? 'BOOKING'
        : isUrgent
        ? 'REPLY_URGENT'
        : 'REPLY_CONFIRMED';

    setVoiceLogs((prev) => [
      {
        id: `vlog-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        type: logType,
        clientName,
        clientLang,
        ownerVoiceLang: ownerLang,
        summary:
          eventType === 'APPOINTMENT_CONFIRMED'
            ? `Confirmed ${timeSlot} · Barber: ${barberName} · ${servicesText}`
            : `Reminder Reply (${timeSlot}) · ${clientName}: "${rawBody}"`,
        spokenText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isUrgent,
      },
      ...prev,
    ]);

    if (eventType === 'APPOINTMENT_CONFIRMED') {
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

    if (voiceFilter === 'ALL' || isUrgent || eventType === 'APPOINTMENT_CONFIRMED') {
      speakHandsFree(spokenText, ownerLang, romanUrduByEvent[eventType]);
    }
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
            durationMins: 35,
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
    if (isFounderInspector || isOwnerLoggedOut) return;
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

  const handleTriggerSimulatedVoiceWebhook = async (
    kind: 'CONFIRMATION' | 'REMINDER_LATE' | 'REMINDER_COMING'
  ) => {
    setIsTestingLoudAlert(true);
    try {
      const payload =
        kind === 'CONFIRMATION'
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

      const res = await fetch('/api/whatsapp/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Webhook failed');
      const data = (await res.json()) as { state?: SalonConciergeStateResponse };
      if (data.state) {
        processIncomingConciergeState(data.state);
      }
      setMaintToast('🔊 Incoming WhatsApp message received & announced loudly!');
      setTimeout(() => setMaintToast(null), 4500);
    } catch {
      setMaintToast('Could not trigger loud announcement test.');
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

  const handleUpdateStatus = (id: string, status: 'CONFIRMED' | 'IN_CHAIR' | 'COMPLETED') => {
    const targetBooking = bookings.find((b) => b.id === id);
    setBookings((prev) =>
      prev.map((b) => {
        if (b.id === id) {
          if (status === 'COMPLETED') {
            setMaintToast(`✓ Chair freed! ${b.clientName}'s visit saved & T+2h Google Review prompt scheduled.`);
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

  const handleToggleWalkInService = (svcId: string) => {
    setWalkInSelectedServiceIds((prev) => {
      const exists = prev.includes(svcId);
      const next = exists ? prev.filter((id) => id !== svcId) : [...prev, svcId];
      const nextTotal = services
        .filter((s) => next.includes(s.id))
        .reduce((sum, s) => sum + s.price, 0);
      setWalkInPrice(nextTotal);
      return next;
    });
  };

  const handleSaveWalkIn = () => {
    const id = `WLK-${Date.now().toString().slice(-4)}`;
    const timeSlot = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const chosenServices = services.filter((s) => walkInSelectedServiceIds.includes(s.id));
    const serviceLabel =
      chosenServices.length > 0
        ? chosenServices.map((s) => s.name).join(' + ')
        : services[0]?.name || 'Master Haircut';
    const totalDuration =
      chosenServices.length > 0
        ? chosenServices.reduce((sum, s) => sum + (s.durationMins || 35), 0)
        : 35;
    const assignedBarber = barbersList.includes(walkInBarber) ? walkInBarber : barbersList[0] || walkInBarber;
    const newBooking: BookingRecord = {
      id,
      clientName: walkInName.trim() || 'Walk-in Client',
      barberName: assignedBarber,
      phone: walkInPhone.trim() || '+92 300 0000000',
      service: serviceLabel,
      price: walkInPrice,
      timeSlot,
      durationMins: totalDuration,
      chairLabel: barberChairs[assignedBarber],
      status: walkInImmediateChair ? 'IN_CHAIR' : 'CONFIRMED',
    };

    setBookings((prev) => [newBooking, ...prev]);
    setIsWalkInModalOpen(false);

    fetch(`/api/salons/${encodeURIComponent(currentSalon.id)}/clients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newBooking.clientName,
        phone: newBooking.phone,
        birthDate: walkInBirthDate.trim(),
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.state) setConciergeState(data.state);
      })
      .catch(() => {});
    setWalkInBirthDate('');

    // Speak aloud in Owner's preferred language with Roman Urdu fallback for high-fidelity audio
    const urduScript = `${assignedBarber} بھائی! نیا واک اِن کسٹمر ${newBooking.clientName} ${walkInImmediateChair ? 'کرسی پر بیٹھ گیا ہے' : 'قطار میں شامل ہو گیا ہے'}۔ سروس: ${serviceLabel}۔`;
    const romanUrdu = `${assignedBarber} Bhai! Naya walk-in customer ${newBooking.clientName} ${walkInImmediateChair ? 'chair par baith gaya hai' : 'queue mein shamil ho gaya hai'}. Service: ${serviceLabel}.`;
    const englishSpeech = `Barber ${assignedBarber}, new walk-in client ${newBooking.clientName} is ${walkInImmediateChair ? 'seated in chair' : 'in waiting queue'} for ${serviceLabel}.`;
    const arabicSpeech = `الحلاق ${assignedBarber}! عميل جديد ${newBooking.clientName} ${walkInImmediateChair ? 'في الكرسي' : 'في الانتظار'}، الخدمة: ${serviceLabel}.`;

    const speechText = ownerLang === 'ur' ? urduScript : ownerLang === 'ar' ? arabicSpeech : englishSpeech;
    speakHandsFree(speechText, ownerLang, romanUrdu);

    setVoiceLogs((prev) => [
      {
        id: `vlog-wlk-${Date.now()}`,
        type: 'BOOKING',
        clientName: newBooking.clientName,
        clientLang: ownerLang,
        ownerVoiceLang: ownerLang,
        summary: `Walk-In ${timeSlot} · Barber: ${assignedBarber} · ${serviceLabel}`,
        spokenText: speechText,
        time: timeSlot,
        isUrgent: false,
      },
      ...prev,
    ]);

    setMaintToast(`💈 Walk-in ${newBooking.clientName} added! Queue updated & voice alert dispatched.`);
    setTimeout(() => setMaintToast(null), 4500);
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
      return `بانی (Founder) پیغام برائے ${currentSalon.owner}: آپ کا سسٹم 100% آن لائن ہے۔ ماہانہ 10% مینٹیننس ہر مہینے کی 5 تاریخ کو واجب الادا ہے اور تمام اپگریڈز صرف فرق کی رقم پر دستیاب ہیں۔`;
    }
    if (lang === 'ar') {
      return `رسالة المؤسس إلى ${currentSalon.owner}: نظام الصالون يعمل بكفاءة 100%. رسوم الصيانة الشهرية 10% تستحق في 5 من كل شهر، والترقية متاحة بدفع الفرق فقط.`;
    }
    return `Founder Notice for ${currentSalon.owner}: Your WhatsApp node is 100% online. Monthly 10% maintenance is fixed to the 5th of every month, and tier upgrades charge only the remaining price difference.`;
  };

  // Query 4 (Prev): Localized 3-Stage 5th-of-Month Reminder Templates in Owner Language
  const getMaintenanceReminderMessage = (stage: MaintCycleStage, lang: VoiceLang) => {
    const amt = `${regionConfig.symbol}${currentSalon.maint.toLocaleString()}`;
    if (stage === 'STAGE_1_PREV_MONTH') {
      if (lang === 'ar') {
        return `تذكير مبكر (نهاية الشهر): رسوم الصيانة الشهرية 10% (${amt}) تستحق في 5 من الشهر القادم من رقمك ${currentSalon.phone}.`;
      }
      if (lang === 'ur') {
        return `پہلی پیشگی یاددہانی (مہینے کے آخری 2 دن): آپ کی ماہانہ 10% مینٹیننس فیس (${amt}) آنے والی 5 تاریخ کو واجب الادا ہے۔`;
      }
      return `Advance Reminder (Last 2 Days of Month): Your 10% monthly fee (${amt}) is due on the 5th via ${currentSalon.phone}.`;
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
                <span className="text-[10px] text-[#3FB950] uppercase block">10% MONTHLY FEE (DUE 5TH)</span>
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
                Today's Live Queue, Salon Strategy Matrix Boxes, Multi-Service Carts, and Voice Concierge belong exclusively inside the Salon Owner Dashboard (`?role=salon_owner`).
              </p>
            </div>
          </div>
        </PortalCard>
      </div>
    );
  }

  // ============================================================================
  // QUERY 2: SELF-SERVICE SALON OWNER RE-LOGIN (ZERO AGENT / FOUNDER NEEDED)
  // ============================================================================
  if (!isFounderInspector && isOwnerLoggedOut) {
    const normalizePhoneDigits = (val: string) => val.replace(/\D/g, '');
    const matchedReLoginSalon =
      salonsState.find((s) => s.id === reLoginMatchedSalonId) || currentSalon;
    const isReLoginRtl = ownerLang === 'ur' || ownerLang === 'ar';

    const rlText =
      ownerLang === 'ar'
        ? {
            kicker: 'تسجيل دخول ذاتي لمالك الصالون · بدون وكيل أو مؤسس',
            title: 'إعادة تسجيل الدخول واستعادة الاتصال',
            subtitle:
              'هل قمت بتسجيل الخروج أو تغيير هاتفك؟ روبوت الواتساب الخاص بصالونك لا يزال يعمل. أدخل رقم الواتساب المسجل لتصلك رسالة OTP بضغطة واحدة.',
            phoneLabel: 'رقم الواتساب المسجل للصالون',
            quickLabel: 'أو اختر صالونك المسجل للاختبار السريع:',
            sendOtpBtn: 'إرسال رمز الدخول السريع عبر الواتساب ←',
            otpTitle: 'تم إرسال رمز الدخول تلقائياً إلى واتسابك',
            otpLabel: 'أدخل رمز التحقق (6 أرقام)',
            autoFillBtn: 'تعبئة تلقائية وتسجيل الدخول فوراً ✓',
            verifyBtn: 'تأكيد الدخول واستعادة اللوحة ←',
            backPhone: 'تغيير الرقم',
            errNotFound: 'الرجاء إدخال رقم واتساب مسجل صحيح للصالون.',
            errOtp: 'رمز التحقق غير صحيح. استخدم الرمز المرسل أعلاه.',
            botSafeBadge: 'الرد التلقائي للزبائن نشط 24/7 أثناء تسجيل الخروج ✓',
          }
        : ownerLang === 'ur'
        ? {
            kicker: 'سیلون مالک کا خودکار لاگ ان · بغیر ایجنٹ یا فاؤنڈر مدد',
            title: 'خودکار ری-لاگ ان اور واٹس ایپ بحالی',
            subtitle:
              'اگر آپ لاگ آؤٹ ہو گئے ہیں یا نیا فون استعمال کر رہے ہیں تو ایجنٹ یا فاؤنڈر کے بغیر خود دوبارہ لاگ ان کریں۔ اپنا رجسٹرڈ واٹس ایپ نمبر درج کریں اور OTP سے فوراً ڈیش بورڈ کھولیں۔',
            phoneLabel: 'سیلون کا رجسٹرڈ واٹس ایپ نمبر',
            quickLabel: 'یا فوری ٹیسٹ کے لیے رجسٹرڈ سیلون منتخب کریں:',
            sendOtpBtn: 'میرے واٹس ایپ پر لاگ ان کوڈ بھیجیں ←',
            otpTitle: 'لاگ ان کوڈ آپ کے واٹس ایپ پر بھیج دیا گیا ہے',
            otpLabel: '6 ہندسوں کا OTP کوڈ درج کریں',
            autoFillBtn: 'ایک کلک میں کوڈ بھریں اور لاگ ان کریں ✓',
            verifyBtn: 'تصدیق کریں اور لائیو ڈیش بورڈ کھولیں ←',
            backPhone: 'نمبر تبدیل کریں',
            errNotFound: 'براہ کرم سیلون کا درست رجسٹرڈ واٹس ایپ نمبر درج کریں۔',
            errOtp: 'OTP کوڈ درست نہیں ہے۔ اوپر موصول ہونے والا کوڈ درج کریں۔',
            botSafeBadge: 'لاگ آؤٹ کے دوران بھی کسٹمر آٹو ریپلائی 24/7 آن ہے ✓',
          }
        : {
            kicker: 'SELF-SERVICE OWNER ACCESS · ZERO AGENT OR FOUNDER VISIT',
            title: 'Salon Owner Self Re-Login & Instant Connect',
            subtitle:
              'Logged out or switched to a new smartphone? Your salon WhatsApp concierge continues running 24/7. Enter your registered WhatsApp number to receive a 1-tap login OTP and restore your Live Dashboard in seconds.',
            phoneLabel: 'Registered Salon WhatsApp Number',
            quickLabel: 'Quick-fill a registered salon number to test:',
            sendOtpBtn: 'Send 1-Tap Login Code to My WhatsApp →',
            otpTitle: 'Automatic Login OTP Sent to Your WhatsApp',
            otpLabel: 'Enter 6-Digit Login Code',
            autoFillBtn: '1-Tap Auto-Fill & Sign Back In ✓',
            verifyBtn: 'Verify Code & Open Live Dashboard →',
            backPhone: 'Change Number',
            errNotFound: 'Please enter a valid registered salon WhatsApp number.',
            errOtp: 'Invalid OTP code. Please enter the 6-digit code sent to your WhatsApp.',
            botSafeBadge: 'Client Auto-Booking Bot Stays Live 24/7 While Logged Out ✓',
          };

    const handleSendSelfOtp = (e: React.FormEvent) => {
      e.preventDefault();
      setReLoginError(null);
      const enteredDigits = normalizePhoneDigits(reLoginPhoneInput);
      if (enteredDigits.length < 7) {
        setReLoginError(rlText.errNotFound);
        return;
      }

      const found = salonsState.find((s) => {
        const sDigits = normalizePhoneDigits(s.phone);
        return (
          sDigits === enteredDigits ||
          (enteredDigits.length >= 7 && sDigits.endsWith(enteredDigits.slice(-7)))
        );
      });

      const targetSalon = found || currentSalon;
      setReLoginMatchedSalonId(targetSalon.id);
      setOwnerLang(targetSalon.onboardingLanguage);
      const nextCode = Math.floor(100000 + Math.random() * 899999).toString();
      setReLoginGeneratedOtp(nextCode);
      setReLoginOtpInput('');
      setReLoginStep('OTP');
    };

    const completeSelfReLogin = (otpVal: string) => {
      if (otpVal.trim() !== reLoginGeneratedOtp) {
        setReLoginError(rlText.errOtp);
        return;
      }
      setSelectedSalonId(matchedReLoginSalon.id);
      setOwnerLang(matchedReLoginSalon.onboardingLanguage);
      setIsOwnerLoggedOut(false);
      setReLoginStep('PHONE');
      setReLoginOtpInput('');
      setReLoginError(null);
      setWhatsAppReceiptNotice({
        title:
          ownerLang === 'ar'
            ? 'تم تسجيل الدخول واستعادة الاتصال بنجاح'
            : ownerLang === 'ur'
            ? 'خودکار لاگ ان اور واٹس ایپ بحالی مکمل!'
            : 'Self Re-Login & Connection Restored!',
        body:
          ownerLang === 'ar'
            ? `أهلاً بعودتك ${matchedReLoginSalon.owner}! تم تسجيل دخول "${matchedReLoginSalon.name}" بنجاح دون الحاجة لوكيل أو مؤسس.`
            : ownerLang === 'ur'
            ? `خوش آمدید ${matchedReLoginSalon.owner}! "${matchedReLoginSalon.name}" بغیر ایجنٹ یا فاؤنڈر کے خودکار طور پر دوبارہ لاگ ان ہو گیا ہے۔`
            : `Welcome back ${matchedReLoginSalon.owner}! "${matchedReLoginSalon.name}" signed back in automatically via WhatsApp OTP—zero physical agent or Founder help needed.`,
        phone: matchedReLoginSalon.phone,
        timestamp: 'Just now · WhatsApp Auto-Auth ✓✓',
      });
      setTimeout(() => setWhatsAppReceiptNotice(null), 8000);
    };

    return (
      <div className="max-w-xl mx-auto py-8 px-2 pb-28 lg:pb-12">
        <div
          dir={isReLoginRtl ? 'rtl' : 'ltr'}
          className={`rounded-3xl border border-[#30363D] bg-[#161B22] p-5 sm:p-7 space-y-5 shadow-2xl ${
            isReLoginRtl ? 'text-right' : 'text-left'
          }`}
        >
          {/* Language switcher bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#21262D] pb-3.5">
            <span className="rounded-full border border-[#116329] bg-[#0D3822] px-3 py-1 text-[10px] font-mono font-bold text-[#3FB950]">
              {rlText.botSafeBadge}
            </span>
            <div className="flex items-center gap-1 p-1 rounded-xl bg-[#0D1117] border border-[#30363D]">
              {[
                { id: 'ur' as const, label: '🇵🇰 اردو' },
                { id: 'en' as const, label: '🇬🇧 EN' },
                { id: 'ar' as const, label: '🇦🇪 العربية' },
              ].map((lang) => (
                <button
                  key={lang.id}
                  type="button"
                  onClick={() => setOwnerLang(lang.id)}
                  className={`min-h-[32px] px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition ${
                    ownerLang === lang.id
                      ? 'bg-[#06B6D4] text-[#0D1117]'
                      : 'text-[#8B949E] hover:text-[#F0F6FC]'
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-[#06B6D4]">
              <Key className="size-4 shrink-0" />
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider">
                {rlText.kicker}
              </span>
            </div>
            <h2 className="text-2xl font-black text-[#F0F6FC] tracking-tight">
              {rlText.title}
            </h2>
            <p className="text-xs text-[#8B949E] font-sans leading-relaxed">
              {rlText.subtitle}
            </p>
          </div>

          {reLoginError && (
            <div className="rounded-xl border border-[#da3633] bg-[#4C1C1D] p-3 text-xs font-mono text-[#F85149]">
              {reLoginError}
            </div>
          )}

          {reLoginStep === 'PHONE' ? (
            <form onSubmit={handleSendSelfOtp} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-mono font-bold text-[#F0F6FC] block">
                  {rlText.phoneLabel}
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={reLoginPhoneInput}
                  onChange={(e) => setReLoginPhoneInput(e.target.value)}
                  placeholder="+92 321 8472910"
                  className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3.5 py-2.5 text-sm font-mono text-left text-[#06B6D4] focus:outline-none focus:border-[#06B6D4]"
                />
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] font-mono text-[#8B949E] block">
                  {rlText.quickLabel}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {salonsState.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setReLoginPhoneInput(s.phone);
                        setReLoginMatchedSalonId(s.id);
                        setOwnerLang(s.onboardingLanguage);
                      }}
                      className="min-h-[34px] rounded-lg border border-[#30363D] bg-[#0D1117] hover:border-[#06B6D4] px-2.5 py-1 text-[11px] font-mono text-[#F0F6FC] transition"
                    >
                      {s.name} (<span dir="ltr">{s.phone}</span>)
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="w-full min-h-[48px] rounded-xl bg-[#06B6D4] hover:bg-[#22D3EE] text-[#0D1117] px-5 py-3 text-xs font-mono font-black uppercase transition active:scale-95"
              >
                {rlText.sendOtpBtn}
              </button>
            </form>
          ) : (
            <div className="space-y-4 animate-in fade-in">
              <div className="rounded-2xl border border-[#116329] bg-[#0D3822] p-4 space-y-2">
                <div className="flex items-center justify-between gap-2 text-xs font-mono text-[#3FB950] font-bold">
                  <span>{rlText.otpTitle}</span>
                  <span dir="ltr">{matchedReLoginSalon.phone}</span>
                </div>
                <div className="rounded-xl border border-[#116329] bg-[#0D1117] p-3 font-mono text-xs text-[#F0F6FC] space-y-1">
                  <p className="text-[11px] text-[#8B949E]">
                    WhatsApp Message from WorkCraft System:
                  </p>
                  <p>
                    Salon: <strong className="text-[#06B6D4]">{matchedReLoginSalon.name}</strong> · Login Code:{' '}
                    <strong className="text-[#D29922] text-sm tracking-widest" dir="ltr">
                      {reLoginGeneratedOtp}
                    </strong>
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono font-bold text-[#F0F6FC] block">
                  {rlText.otpLabel}
                </label>
                <input
                  type="text"
                  dir="ltr"
                  maxLength={6}
                  value={reLoginOtpInput}
                  onChange={(e) => setReLoginOtpInput(e.target.value)}
                  placeholder="6-digit OTP (e.g. 849201)"
                  className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3.5 py-2.5 text-base font-mono font-bold tracking-widest text-center text-[#D29922] focus:outline-none focus:border-[#06B6D4]"
                />
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setReLoginOtpInput(reLoginGeneratedOtp);
                    completeSelfReLogin(reLoginGeneratedOtp);
                  }}
                  className="min-h-[48px] rounded-xl bg-[#3FB950] hover:bg-[#4ec961] text-[#0D1117] px-4 py-2.5 text-xs font-mono font-black uppercase transition active:scale-95"
                >
                  {rlText.autoFillBtn}
                </button>
                <button
                  type="button"
                  onClick={() => completeSelfReLogin(reLoginOtpInput)}
                  className="min-h-[48px] rounded-xl bg-[#06B6D4] hover:bg-[#22D3EE] text-[#0D1117] px-4 py-2.5 text-xs font-mono font-black uppercase transition active:scale-95"
                >
                  {rlText.verifyBtn}
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setReLoginStep('PHONE');
                  setReLoginError(null);
                }}
                className="text-xs font-mono text-[#8B949E] hover:text-[#F0F6FC] underline"
              >
                {rlText.backPhone}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============================================================================
  // COMPUTED OPERATIONAL METRICS FOR LIVE STATUS STRIP & TIMELINE
  // ============================================================================
  const sortedBookings = [...bookings].sort(
    (a, b) => parseTimeSlotMinutes(a.timeSlot) - parseTimeSlotMinutes(b.timeSlot)
  );
  const todayTotalRevenue = bookings.reduce((sum, b) => sum + b.price, 0);
  const unverifiedDeposits = pendingDeposits.filter((d) => !d.verified);
  const pendingDepositsTotal = unverifiedDeposits.reduce((sum, d) => sum + d.amount, 0);
  const activeReviewAlerts = (conciergeState?.alerts || []).filter(
    (a) => a.status === 'OWNER_INTERVENTION_NEEDED'
  );
  const openHandovers = handoverRequests.filter((h) => !h.handled);
  const totalUrgentCount =
    activeReviewAlerts.length + unverifiedDeposits.length + openHandovers.length;

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
          {/* WhatsApp Gateway Connection Badge (#3FB950 on #0D3822) */}
          <div className="inline-flex items-center gap-2 rounded-xl border border-[#116329] bg-[#0D3822] px-3 py-1.5 text-xs font-mono font-bold text-[#3FB950]">
            <span className="size-2 rounded-full bg-[#3FB950]" />
            <span>WhatsApp Gateway · Connected</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {/* Desktop Mode Switcher (Hidden on Mobile where fixed Bottom Nav handles Live / Manage) */}
            <div className="hidden lg:inline-flex items-center rounded-xl border border-[#30363D] bg-[#0D1117] p-1 gap-1">
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
                <span>Live Floor</span>
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
                <span>Manage</span>
              </button>
            </div>

            <button
              type="button"
              onClick={toggleScreenWakeLock}
              className={`min-h-[40px] rounded-xl border px-2.5 text-[11px] font-mono font-bold transition flex items-center gap-1.5 ${
                isWakeLockActive
                  ? 'border-[#116329] bg-[#0D3822] text-[#3FB950]'
                  : 'border-[#30363D] bg-[#0D1117] text-[#8B949E] hover:text-[#F0F6FC]'
              }`}
              title="Keep shop screen awake for hands-free announcements"
            >
              <Zap className="size-3.5 shrink-0" />
              <span className="hidden sm:inline">{isWakeLockActive ? 'Wake ON' : 'Wake OFF'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const next = !isLoudspeakerBoostActive;
                setIsLoudspeakerBoostActive(next);
                setMaintToast(
                  next
                    ? '📢 Rush-Hour Loudspeaker Boost ON: Loud 3-tone chime + clear speech cadence active.'
                    : '📢 Loudspeaker Boost set to normal volume.'
                );
                setTimeout(() => setMaintToast(null), 3500);
              }}
              className={`min-h-[40px] rounded-xl border px-2.5 text-[11px] font-mono font-bold transition flex items-center gap-1.5 ${
                isLoudspeakerBoostActive
                  ? 'border-[#9E6A03] bg-[#3B2E0B] text-[#D29922]'
                  : 'border-[#30363D] bg-[#0D1117] text-[#8B949E] hover:text-[#F0F6FC]'
              }`}
              title="Boost chime & speech clarity for noisy salon hours"
            >
              <BellRing className="size-3.5 shrink-0" />
              <span className="hidden sm:inline">{isLoudspeakerBoostActive ? 'Boost ON' : 'Boost'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsVoiceEnabled(!isVoiceEnabled)}
              className={`min-h-[40px] min-w-[40px] rounded-xl border px-2.5 grid place-items-center transition ${
                isVoiceEnabled
                  ? 'border-[#30363D] bg-[#0D1117] text-[#06B6D4]'
                  : 'border-[#30363D] bg-[#0D1117] text-[#6E7681]'
              }`}
              title={isVoiceEnabled ? 'Voice Announcements ON' : 'Voice Announcements Muted'}
              aria-label="Toggle voice announcements"
            >
              {isVoiceEnabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
            </button>

            <button
              type="button"
              onClick={() => {
                setReLoginPhoneInput(currentSalon.phone);
                setReLoginMatchedSalonId(currentSalon.id);
                setReLoginStep('PHONE');
                setIsOwnerLoggedOut(true);
              }}
              className="min-h-[40px] rounded-xl border border-[#30363D] bg-[#0D1117] hover:border-[#D29922] px-3 text-xs font-mono font-bold text-[#8B949E] hover:text-[#D29922] transition flex items-center gap-1.5"
              title="Log out"
            >
              <LogOut className="size-3.5" />
              <span className="hidden sm:inline">Log Out</span>
            </button>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="min-h-[40px] min-w-[40px] rounded-xl border border-[#30363D] bg-[#0D1117] text-[#8B949E] hover:text-[#F0F6FC] grid place-items-center transition"
                title="Close Portal"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </div>

        {/* Salon Title + Today's Total Revenue & Pending Deposits (#D29922 Gold Highlight) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-[#21262D]">
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
                Today&apos;s Revenue
              </span>
              <span className="text-base sm:text-lg font-black font-mono tabular-nums text-[#D29922]">
                {regionConfig.symbol}
                {todayTotalRevenue.toLocaleString()}
              </span>
            </div>
            <div className="rounded-xl border border-[#30363D] bg-[#0D1117] px-3.5 py-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#8B949E] block">
                Pending Deposits
              </span>
              <span className="text-base sm:text-lg font-black font-mono tabular-nums text-[#D29922]">
                {regionConfig.symbol}
                {pendingDepositsTotal.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Active Speaking Indicator or Toast */}
        {currentlySpeakingText && (
          <div className="rounded-xl border border-[#30363D] bg-[#0D1117] px-3.5 py-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-mono text-[#06B6D4] min-w-0">
              <Radio className="size-4 shrink-0" />
              <span className="font-sans text-[#F0F6FC] truncate">&ldquo;{currentlySpeakingText}&rdquo;</span>
            </div>
            <button
              type="button"
              onClick={stopSpeaking}
              className="min-h-[36px] rounded-lg border border-[#30363D] bg-[#161B22] px-2.5 text-[11px] font-mono text-[#F0F6FC] shrink-0"
            >
              Stop
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
          {/* 1. URGENT ALERTS CARD (TOP PRIORITY) */}
          {totalUrgentCount > 0 && (
            <section
              aria-label="Urgent Floor Alerts"
              className="rounded-2xl border border-[#9E6A03] bg-[#161B22] p-4 sm:p-5 space-y-3"
            >
              <div className="flex items-center justify-between gap-2 border-b border-[#30363D] pb-2.5">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-4 text-[#D29922] shrink-0" />
                  <h2 className="text-sm font-black uppercase tracking-wider text-[#F0F6FC]">
                    Urgent Alerts
                  </h2>
                </div>
                <span className="rounded-lg border border-[#9E6A03] bg-[#3B2E0B] px-2.5 py-0.5 text-[11px] font-mono font-bold text-[#D29922]">
                  {totalUrgentCount} Action Required
                </span>
              </div>

              <div className="space-y-2.5">
                {/* A. OWNER_INTERVENTION_NEEDED (1–3 Star Feedback Alerts) */}
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
                      Mark Resolved ✓
                    </button>
                  </div>
                ))}

                {/* B. Unverified Raast / EasyPaisa Deposit Screenshots */}
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
                              {dep.receivedAt} · Slot {dep.timeSlot}
                            </span>
                          </div>
                          <p className="text-sm font-bold text-[#F0F6FC]">
                            {dep.clientName} ·{' '}
                            <span className="font-mono text-[#D29922] tabular-nums">
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
                            {isExpanded ? 'Hide Proof' : 'View Screenshot'}
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
                            Verify Deposit ✓
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
                      Mark Handled ✓
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 2. TODAY'S LIVE SCHEDULE & CHAIR TIMELINE */}
          <section
            aria-label="Today's Live Schedule and Chair Timeline"
            className="rounded-2xl border border-[#30363D] bg-[#161B22] p-4 sm:p-5 space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#30363D] pb-3.5">
              <div>
                <div className="flex items-center gap-2">
                  <Calendar className="size-4 text-[#06B6D4]" />
                  <h2 className="text-base sm:text-lg font-black text-[#F0F6FC]">
                    Today&apos;s Live Schedule &amp; Chair Timeline
                  </h2>
                </div>
                <p className="text-xs text-[#8B949E] font-mono mt-0.5 tabular-nums">
                  {sortedBookings.length} scheduled ·{' '}
                  {sortedBookings.filter((b) => b.status === 'COMPLETED').length} completed
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsWalkInModalOpen(true)}
                className="min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#D29922] hover:bg-[#e0b252] text-[#0D1117] px-5 py-2.5 text-xs font-mono font-black uppercase transition active:scale-95 shrink-0"
              >
                <Plus className="size-4" />
                <span>+ Walk-In</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {sortedBookings.map((booking) => {
                const chairTag =
                  booking.chairLabel ||
                  barberChairs[booking.barberName] ||
                  `Chair #${Math.max(1, barbersList.indexOf(booking.barberName) + 1)}`;
                const duration = booking.durationMins || 35;

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
                        </div>
                        <p className="text-xs text-[#8B949E] font-sans">{booking.service}</p>
                        <p className="text-[11px] font-mono text-[#6E7681]" dir="ltr">
                          {booking.phone}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between md:justify-end gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-[#21262D] shrink-0">
                      <span className="text-sm font-mono font-black text-[#D29922] tabular-nums mr-1">
                        {regionConfig.symbol}
                        {booking.price.toLocaleString()}
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const ownerFirst = currentSalon.owner.split(' ')[0] || 'Hamza';
                            const urduText = `${ownerFirst} صاحب، آپ کے باربر ${booking.barberName} کے پاس ${booking.clientName} کی ${booking.timeSlot} پر بکنگ ہے۔ سروس: ${booking.service}۔`;
                            const romanUrdu = `${ownerFirst} Sahab! Aap kay barber ${booking.barberName} kay paas ${booking.clientName} ki ${booking.timeSlot} par booking hai. Service: ${booking.service}.`;
                            const arText = `${ownerFirst}، الحلاق ${booking.barberName} لديه موعد مع ${booking.clientName} في ${booking.timeSlot}. الخدمة: ${booking.service}.`;
                            const enText = `${ownerFirst}, your barber ${booking.barberName} has ${booking.clientName} at ${booking.timeSlot}: ${booking.service}.`;
                            const text =
                              ownerLang === 'ur' ? urduText : ownerLang === 'ar' ? arText : enText;
                            speakHandsFree(text, ownerLang, romanUrdu);
                          }}
                          className="min-h-[48px] min-w-[48px] grid place-items-center rounded-xl border border-[#30363D] bg-[#161B22] hover:border-[#06B6D4] text-[#06B6D4] transition"
                          title="Speak booking aloud"
                          aria-label="Speak booking aloud"
                        >
                          <Volume2 className="size-4" />
                        </button>

                        {booking.status === 'CONFIRMED' && (
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(booking.id, 'IN_CHAIR')}
                            className="min-h-[48px] rounded-xl border border-[#9E6A03] bg-[#3B2E0B] hover:bg-[#3B2E0B]/80 px-3 py-2 text-xs font-mono font-bold text-[#D29922] transition"
                          >
                            Seat
                          </button>
                        )}

                        {booking.status !== 'COMPLETED' ? (
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(booking.id, 'COMPLETED')}
                            className="min-h-[48px] rounded-xl border border-[#116329] bg-[#0D3822] hover:bg-[#116329]/60 px-3.5 py-2 text-xs font-mono font-bold text-[#3FB950] transition active:scale-95"
                          >
                            Mark Completed ✓
                          </button>
                        ) : (
                          <span className="min-h-[48px] inline-flex items-center gap-1.5 rounded-xl border border-[#116329] bg-[#0D3822]/50 px-3 py-2 text-[11px] font-mono font-bold text-[#3FB950]">
                            <CheckCircle2 className="size-3.5" />
                            <span>T+2h Review Queued</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: DEDICATED "MANAGE" SECTION (SHOP SETUP & RULES)                   */}
      {/* ========================================================================= */}
      {currentSectionMode === 'MANAGE' && (
        <div className="space-y-4">
          {/* Sub-Section Switcher Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 p-1.5 rounded-2xl border border-[#30363D] bg-[#161B22]">
            {[
              { id: 'STAFF' as const, label: 'Staff & Barbers', icon: Scissors },
              { id: 'SERVICES' as const, label: 'Services & Rates', icon: Receipt },
              { id: 'HOURS' as const, label: 'Salon Hours', icon: Clock },
              { id: 'AUTOMATION' as const, label: 'Automation & Rewards', icon: Settings2 },
              { id: 'POSTER' as const, label: 'Window QR Poster', icon: QrCode },
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

          {/* 1. STAFF & BARBERS (Add/Edit Barbers, Chair Assignments & Barber Stats) */}
          {manageSubSection === 'STAFF' && (
            <div className="space-y-4">
            <PortalCard
              title="Staff & Barbers"
              kicker="BARBER ROSTER & CHAIR ASSIGNMENTS"
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
                              value={editingBarberName}
                              onChange={(e) => setEditingBarberName(e.target.value)}
                              className="w-full min-h-[48px] rounded-xl border border-[#06B6D4] bg-[#161B22] px-3 py-2 text-sm text-[#F0F6FC] focus:outline-none"
                              placeholder="Barber name"
                              autoFocus
                            />
                            <input
                              type="text"
                              value={editingBarberChair}
                              onChange={(e) => setEditingBarberChair(e.target.value)}
                              className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#161B22] px-3 py-2 text-sm font-mono text-[#D29922] focus:outline-none focus:border-[#06B6D4]"
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
                    value={newBarberDashboardInput}
                    onChange={(e) => setNewBarberDashboardInput(e.target.value)}
                    placeholder="Barber / Stylist Name (e.g. Master Kamran)"
                    className="min-h-[48px] rounded-xl border border-[#30363D] bg-[#161B22] px-3.5 py-2 text-sm text-[#F0F6FC] placeholder:text-[#484F58] focus:outline-none focus:border-[#06B6D4]"
                  />
                  <input
                    type="text"
                    value={newBarberChairInput}
                    onChange={(e) => setNewBarberChairInput(e.target.value)}
                    placeholder={`Chair #${barbersList.length + 1}`}
                    className="min-h-[48px] rounded-xl border border-[#30363D] bg-[#161B22] px-3.5 py-2 text-sm font-mono text-[#D29922] placeholder:text-[#484F58] focus:outline-none focus:border-[#06B6D4]"
                  />
                  <button
                    type="submit"
                    className="min-h-[48px] rounded-xl bg-[#D29922] hover:bg-[#e0b252] text-[#0D1117] px-4 py-2 text-xs font-mono font-bold uppercase transition flex items-center justify-center gap-1.5 shrink-0"
                  >
                    <Plus className="size-4" />
                    <span>Add Barber</span>
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
                        required
                        placeholder="Service Name"
                        value={customServiceName}
                        onChange={(e) => setCustomServiceName(e.target.value)}
                        className="sm:col-span-2 min-h-[48px] rounded-xl border border-[#30363D] bg-[#161B22] px-3.5 py-2 text-sm text-[#F0F6FC] placeholder:text-[#484F58]"
                      />
                      <input
                        type="number"
                        required
                        min={5}
                        placeholder="Mins"
                        value={customServiceDuration}
                        onChange={(e) => setCustomServiceDuration(e.target.value)}
                        className="min-h-[48px] rounded-xl border border-[#30363D] bg-[#161B22] px-3.5 py-2 text-sm font-mono text-[#06B6D4] placeholder:text-[#484F58]"
                      />
                      <input
                        type="number"
                        required
                        placeholder={`Price (${regionConfig.currency})`}
                        value={customServicePrice}
                        onChange={(e) => setCustomServicePrice(e.target.value)}
                        className="min-h-[48px] rounded-xl border border-[#30363D] bg-[#161B22] px-3.5 py-2 text-sm font-mono font-bold text-[#D29922] placeholder:text-[#484F58]"
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
                        value={item.name}
                        onChange={(e) => handleUpdateServiceName(item.id, e.target.value)}
                        className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#161B22] px-3 py-2 text-sm font-bold text-[#F0F6FC] focus:outline-none focus:border-[#06B6D4]"
                      />

                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={5}
                          value={item.durationMins}
                          onChange={(e) =>
                            handleUpdateServiceDuration(item.id, parseInt(e.target.value, 10) || 15)
                          }
                          className="w-20 min-h-[48px] rounded-xl border border-[#30363D] bg-[#161B22] px-2.5 py-2 text-sm font-mono text-[#06B6D4] focus:outline-none focus:border-[#06B6D4]"
                        />
                        <span className="text-xs font-mono text-[#8B949E] shrink-0">min</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-mono text-[#8B949E] shrink-0">
                          {regionConfig.currency}
                        </span>
                        <input
                          type="number"
                          value={item.price}
                          onChange={(e) =>
                            handleUpdatePrice(item.id, parseInt(e.target.value, 10) || 0)
                          }
                          className="w-28 min-h-[48px] rounded-xl border border-[#30363D] bg-[#161B22] px-3 py-2 text-sm font-mono font-bold text-[#D29922] focus:outline-none focus:border-[#06B6D4]"
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
                          value={salonHours.monThuOpen}
                          onChange={(e) =>
                            setSalonHours((prev) => ({ ...prev, monThuOpen: e.target.value }))
                          }
                          className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#161B22] px-3 py-2 text-sm font-mono text-[#F0F6FC]"
                        />
                      </label>
                      <label className="space-y-1 block">
                        <span className="text-[11px] font-mono text-[#8B949E]">Closing Time</span>
                        <input
                          type="text"
                          value={salonHours.monThuClose}
                          onChange={(e) =>
                            setSalonHours((prev) => ({ ...prev, monThuClose: e.target.value }))
                          }
                          className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#161B22] px-3 py-2 text-sm font-mono text-[#F0F6FC]"
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
                          value={salonHours.fridayOpen}
                          onChange={(e) =>
                            setSalonHours((prev) => ({ ...prev, fridayOpen: e.target.value }))
                          }
                          className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#161B22] px-3 py-2 text-sm font-mono text-[#F0F6FC]"
                        />
                      </label>
                      <label className="space-y-1 block">
                        <span className="text-[11px] font-mono text-[#8B949E]">Close</span>
                        <input
                          type="text"
                          value={salonHours.fridayClose}
                          onChange={(e) =>
                            setSalonHours((prev) => ({ ...prev, fridayClose: e.target.value }))
                          }
                          className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#161B22] px-3 py-2 text-sm font-mono text-[#F0F6FC]"
                        />
                      </label>
                      <label className="space-y-1 block">
                        <span className="text-[11px] font-mono text-[#D29922]">Prayer Break Start</span>
                        <input
                          type="text"
                          value={salonHours.fridayBreakStart}
                          onChange={(e) =>
                            setSalonHours((prev) => ({
                              ...prev,
                              fridayBreakStart: e.target.value,
                            }))
                          }
                          className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#161B22] px-3 py-2 text-sm font-mono text-[#D29922]"
                        />
                      </label>
                      <label className="space-y-1 block">
                        <span className="text-[11px] font-mono text-[#D29922]">Prayer Break End</span>
                        <input
                          type="text"
                          value={salonHours.fridayBreakEnd}
                          onChange={(e) =>
                            setSalonHours((prev) => ({
                              ...prev,
                              fridayBreakEnd: e.target.value,
                            }))
                          }
                          className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#161B22] px-3 py-2 text-sm font-mono text-[#D29922]"
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
                          value={salonHours.satSunOpen}
                          onChange={(e) =>
                            setSalonHours((prev) => ({ ...prev, satSunOpen: e.target.value }))
                          }
                          className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#161B22] px-3 py-2 text-sm font-mono text-[#F0F6FC]"
                        />
                      </label>
                      <label className="space-y-1 block">
                        <span className="text-[11px] font-mono text-[#8B949E]">Closing Time</span>
                        <input
                          type="text"
                          value={salonHours.satSunClose}
                          onChange={(e) =>
                            setSalonHours((prev) => ({ ...prev, satSunClose: e.target.value }))
                          }
                          className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#161B22] px-3 py-2 text-sm font-mono text-[#F0F6FC]"
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
                    <span>Save Salon Hours</span>
                  </button>
                </div>
              </form>
            </PortalCard>
          )}

          {/* 4. AUTOMATION & REWARDS (Birthday %, 30-day Win-Back, Google Review URL, Regional Language Preview, Voice Logs & Proof Ledger) */}
          {manageSubSection === 'AUTOMATION' && (
            <div className="space-y-4">
              <SalonRetentionSettingsPanel
                salonId={currentSalon.id}
                salonName={currentSalon.name}
                ownerName={currentSalon.owner}
                salonPhone={currentSalon.phone}
                conciergeState={conciergeState}
                onStateUpdated={processIncomingConciergeState}
                onShowToast={(msg) => {
                  setMaintToast(msg);
                  setTimeout(() => setMaintToast(null), 5000);
                }}
              />

              {/* Collapsible 1: Hands-Free Voice Concierge & Announcement Log */}
              <div className="rounded-2xl border border-[#30363D] bg-[#161B22] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowVoiceLogsDrawer(!showVoiceLogsDrawer)}
                  className="w-full min-h-[48px] px-4 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-[#21262D]/50 transition"
                >
                  <div>
                    <span className="text-xs font-mono font-bold uppercase text-[#06B6D4] block">
                      Hands-Free Voice Alerts &amp; Translation Log ({voiceLogs.length})
                    </span>
                    <span className="text-[11px] font-sans text-[#8B949E]">
                      Announces incoming confirmations &amp; reminder replies loudly without opening your phone
                    </span>
                  </div>
                  {showVoiceLogsDrawer ? (
                    <ChevronUp className="size-4 text-[#8B949E] shrink-0" />
                  ) : (
                    <ChevronDown className="size-4 text-[#8B949E] shrink-0" />
                  )}
                </button>

                {showVoiceLogsDrawer && (
                  <div className="p-4 pt-3 border-t border-[#30363D] space-y-4">
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
                          All Alerts
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
                          Urgent Only
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
                              onClick={() => speakHandsFree(log.spokenText, log.ownerVoiceLang)}
                              className="min-h-[48px] rounded-xl border border-[#30363D] bg-[#161B22] hover:border-[#06B6D4] px-3.5 py-2 text-xs font-mono font-bold text-[#06B6D4] shrink-0 flex items-center gap-1.5 transition"
                            >
                              <Volume2 className="size-4" />
                              <span>Replay</span>
                            </button>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>

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
                      Plan Upgrades, 10% Maintenance &amp; Video Deals
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
                          <option value="ur">Owner Voice: Urdu</option>
                          <option value="en">Owner Voice: English</option>
                          <option value="ar">Owner Voice: Arabic</option>
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

                    <BroadcastTab
                      salon={activeSalonProfile}
                      contacts={salonContacts}
                      ownerLang={ownerLang}
                      onShowToast={(msg) => {
                        setMaintToast(msg);
                        setTimeout(() => setMaintToast(null), 6000);
                      }}
                    />
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
                salonCategory={
                  currentSalon.name.toLowerCase().includes('beauty') ||
                  currentSalon.name.toLowerCase().includes('parlor') ||
                  currentSalon.name.toLowerCase().includes('ladies')
                    ? 'LADIES'
                    : 'MENS'
                }
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
      {/* QUICK ADD WALK-IN CLIENT MODAL WITH LOUD OWNER-LANGUAGE DISPATCH          */}
      {/* ========================================================================= */}
      {isWalkInModalOpen && (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-[#0D1117]/85 p-4 backdrop-blur-md"
          onClick={() => setIsWalkInModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-3xl border border-[#30363D] bg-[#161B22] p-5 sm:p-6 shadow-2xl max-h-[92vh] overflow-y-auto space-y-4"
          >
            <div className="flex items-start justify-between gap-3 border-b border-[#21262D] pb-3">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#D29922]">
                  INSTANT QUEUE ENTRY · 0-TAP SPEECH DISPATCH
                </span>
                <h3 className="text-lg font-black text-[#F0F6FC] mt-0.5">
                  Add Walk-In Client to Chair
                </h3>
                <p className="text-xs text-[#8B949E] font-sans">
                  Quickly seat physical off-the-street clients. System will announce aloud in {ownerLang.toUpperCase()} and route to selected barber.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsWalkInModalOpen(false)}
                className="min-h-[40px] min-w-[40px] rounded-xl border border-[#30363D] bg-[#0D1117] grid place-items-center text-[#8B949E] hover:text-[#F0F6FC]"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-mono text-[#8B949E] mb-1">
                  Client Name / Label:
                </label>
                <input
                  type="text"
                  value={walkInName}
                  onChange={(e) => setWalkInName(e.target.value)}
                  placeholder="e.g. Walk-in Guest, Usman, Bilal"
                  className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3 text-sm text-[#F0F6FC] focus:outline-none focus:border-[#06B6D4]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-[#8B949E] mb-1">
                    Assign Barber / Stylist:
                  </label>
                  <select
                    value={barbersList.includes(walkInBarber) ? walkInBarber : barbersList[0] || ''}
                    onChange={(e) => setWalkInBarber(e.target.value)}
                    className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3 text-sm text-[#F0F6FC] focus:outline-none focus:border-[#06B6D4]"
                  >
                    {barbersList.map((b) => (
                      <option key={b} value={b}>
                        {b} {barberChairs[b] ? `(${barberChairs[b]})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono text-[#8B949E] mb-1">
                    Phone (Optional for WhatsApp Ticket):
                  </label>
                  <input
                    type="tel"
                    value={walkInPhone}
                    onChange={(e) => setWalkInPhone(e.target.value)}
                    placeholder="+92 300 0000000"
                    className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3 text-sm text-[#F0F6FC] font-mono focus:outline-none focus:border-[#06B6D4]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-[#8B949E] mb-1">
                  Client Birth Date (Day/Month, Optional for 9:00 AM Birthday Offer):
                </label>
                <input
                  type="text"
                  value={walkInBirthDate}
                  onChange={(e) => setWalkInBirthDate(e.target.value)}
                  placeholder="DD/MM (e.g. 14/11)"
                  className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3 text-sm text-[#D29922] font-mono focus:outline-none focus:border-[#06B6D4]"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-[#8B949E] mb-1.5">
                  Select Services (Multi-Service Auto Total):
                </label>
                <div className="max-h-44 overflow-y-auto space-y-1.5 rounded-xl border border-[#30363D] bg-[#0D1117] p-2">
                  {services
                    .filter((s) => s.active)
                    .map((s) => {
                      const checked = walkInSelectedServiceIds.includes(s.id);
                      return (
                        <label
                          key={s.id}
                          className={`min-h-[44px] flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 cursor-pointer border transition ${
                            checked
                              ? 'border-[#06B6D4] bg-[#161B22]'
                              : 'border-transparent hover:bg-[#161B22]/60'
                          }`}
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => handleToggleWalkInService(s.id)}
                              className="size-4 accent-[#06B6D4] shrink-0"
                            />
                            <span className="text-xs font-bold text-[#F0F6FC] truncate">{s.name}</span>
                            <span className="text-[10px] font-mono text-[#8B949E] shrink-0">
                              {s.durationMins}m
                            </span>
                          </span>
                          <span className="text-xs font-mono font-bold text-[#D29922] tabular-nums shrink-0">
                            {regionConfig.symbol}
                            {s.price.toLocaleString()}
                          </span>
                        </label>
                      );
                    })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-[#8B949E] mb-1">
                  Final Total Price ({regionConfig.currency}):
                </label>
                <input
                  type="number"
                  value={walkInPrice}
                  onChange={(e) => setWalkInPrice(Number(e.target.value) || 0)}
                  className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3 text-sm text-[#D29922] font-mono font-bold focus:outline-none focus:border-[#06B6D4]"
                />
              </div>

              <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Scissors className="size-4 text-[#D29922]" />
                  <div>
                    <p className="text-xs font-bold text-[#F0F6FC]">Seat Immediately in Chair?</p>
                    <p className="text-[11px] text-[#8B949E]">Skip waiting queue and begin cutting now</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={walkInImmediateChair}
                  onChange={(e) => setWalkInImmediateChair(e.target.checked)}
                  className="size-4 accent-[#D29922] cursor-pointer"
                />
              </div>

              <div className="rounded-xl border border-[#116329] bg-[#0D3822] p-2.5 text-xs font-mono text-[#3FB950] flex items-center gap-2">
                <Volume2 className="size-3.5 shrink-0" />
                <span>
                  Audio will speak aloud: &ldquo;{walkInBarber} Bhai! Naya walk-in customer {walkInName || 'Guest'} {walkInImmediateChair ? 'chair par baith gaya hai' : 'queue mein shamil ho gaya hai'}.&rdquo;
                </span>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsWalkInModalOpen(false)}
                className="min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-4 py-2 text-xs font-mono text-[#8B949E] hover:text-[#F0F6FC]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveWalkIn}
                className="min-h-[48px] rounded-xl bg-[#D29922] hover:bg-[#e0b252] text-[#0D1117] px-5 py-2 text-xs font-mono font-bold uppercase transition active:scale-95 flex items-center gap-2"
              >
                <Check className="size-4" />
                <span>Confirm Walk-In &amp; Speak Aloud →</span>
              </button>
            </div>
          </div>
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
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-black text-[#F0F6FC]">{pkg.name}</span>
                              <span className="rounded-md bg-[#06B6D4]/15 border border-[#06B6D4]/30 px-2 py-0.5 text-[9px] font-mono font-bold text-[#06B6D4]">
                                {pkg.badge}
                              </span>
                            </div>
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
                              {pkg.features.map((feat) => (
                                <li key={feat} className="text-[11px] text-[#8B949E] font-sans flex items-start gap-1.5">
                                  <Check className="size-3.5 text-[#3FB950] shrink-0 mt-0.5" />
                                  <span>{feat}</span>
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
                          <label className="text-xs font-mono text-[#8B949E] block">
                            {i18n.tidLabel}
                          </label>
                          <input
                            type="text"
                            value={upgradeTidInput}
                            onChange={(e) => setUpgradeTidInput(e.target.value)}
                            placeholder={i18n.tidPlaceholder}
                            className="w-full min-h-[44px] rounded-xl border border-[#30363D] bg-[#161B22] px-3.5 py-2 text-xs text-[#F0F6FC] placeholder:text-[#484F58] font-mono focus:outline-none focus:border-[#D29922]"
                          />
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
                    <label className="text-xs font-mono text-[#8B949E] block">
                      {i18n.tidLabel}
                    </label>
                    <input
                      type="text"
                      value={maintPaymentTidInput}
                      onChange={(e) => setMaintPaymentTidInput(e.target.value)}
                      placeholder={i18n.tidPlaceholder}
                      className="w-full min-h-[44px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3.5 py-2 text-xs text-[#F0F6FC] placeholder:text-[#484F58] font-mono focus:outline-none focus:border-[#06B6D4]"
                    />
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
