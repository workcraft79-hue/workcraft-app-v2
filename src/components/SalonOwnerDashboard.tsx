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

  // Query 3 & 5: Interactive WhatsApp Chat Prompts (Barber Conflict & Ambiguous Time Disambiguation)
  const [barberConflictPrompt, setBarberConflictPrompt] = useState<{
    slot: string;
    requestedBarber: string;
    suggestedBarber: string;
  } | null>(null);
  const [timeDisambiguationPrompt, setTimeDisambiguationPrompt] = useState<{
    rawHour: string;
  } | null>(null);
  const [selectedCartBarber, setSelectedCartBarber] = useState<string>('Master Aslam');

  // Query 1 & 4 (New): Owner Onboarding / Voice Language vs End-User Chat Language
  const [ownerLang, setOwnerLang] = useState<VoiceLang>(currentSalon.onboardingLanguage);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [voiceFilter, setVoiceFilter] = useState<'ALL' | 'URGENT_ONLY'>('ALL');
  const [isWakeLockActive, setIsWakeLockActive] = useState(true);
  const [wakeLockNote, setWakeLockNote] = useState<string | null>(null);
  const [currentlySpeakingText, setCurrentlySpeakingText] = useState<string | null>(null);
  const wakeLockRef = useRef<{ release?: () => Promise<void> } | null>(null);

  // Rush-Hour Loudspeaker / Bluetooth Speaker Boost & Auto-Chair Advance
  const [isLoudspeakerBoostActive, setIsLoudspeakerBoostActive] = useState(false);
  const [autoAdvanceChairs, setAutoAdvanceChairs] = useState(false);

  // Stylist / Barber Top Services Breakdown Selection
  const [selectedBarberForServices, setSelectedBarberForServices] = useState<string>('ALL');

  // Interactive Walk-In Quick Modal
  const [isWalkInModalOpen, setIsWalkInModalOpen] = useState(false);
  const [walkInName, setWalkInName] = useState('Walk-in Client');
  const [walkInBarber, setWalkInBarber] = useState('Tariq');
  const [walkInService, setWalkInService] = useState('Master Haircut & Beard Sculpt');
  const [walkInPrice, setWalkInPrice] = useState(2000);
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
      summary: 'New 03:30 PM booking · Barber: Aslam · Master Haircut & Skin Fade',
      spokenText:
        'Hamza Sahab! Aslam ki nayi appointment Bilal Ahmed kay sath 3:30 PM par confirm ho gayi hai: Master Haircut and Skin Fade.',
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

  // Query 4 (Prev): 5th-of-Month Maintenance Cycle Stage & Automated Reminders
  const [maintCycleStage, setMaintCycleStage] = useState<MaintCycleStage>('PAID_ACTIVE');
  const [maintTid, setMaintTid] = useState<string | null>('EP-90482716455');
  const [isPayingMaint, setIsPayingMaint] = useState(false);
  const [maintPaidDate, setMaintPaidDate] = useState<string>('5 Nov 2026');
  const [maintToast, setMaintToast] = useState<string | null>(null);

  const isMaintenanceOverdue = maintCycleStage === 'OVERDUE_TIER_2';
  const isMaintPaid = maintCycleStage === 'PAID_ACTIVE';

  // Query 5 & 6: End-User Regional Chatbot, Day-of-Week / 7-10 Day VIP Deal Engine, Multi-Service Cart & Immutable Proof
  const [endUserLang, setEndUserLang] = useState<ClientChatLang>(
    regionConfig.clientLanguages[0].id
  );
  const [isLanguageConfirmedByClient, setIsLanguageConfirmedByClient] = useState(true);
  const [dayScheduleMode, setDayScheduleMode] = useState<'FRI_SUN_WEEKEND' | 'MON_THU_NORMAL'>(
    'FRI_SUN_WEEKEND'
  );
  const [vipCampaignMode, setVipCampaignMode] = useState<'WEEKEND_ONLY' | 'CONTINUOUS_7_10_DAYS'>(
    'WEEKEND_ONLY'
  );
  const [selectedCartServiceIds, setSelectedCartServiceIds] = useState<string[]>(['s1', 's2']);
  const [selectedCartSlot, setSelectedCartSlot] = useState<string>('04:30 PM');
  const [cartClientName, setCartClientName] = useState<string>('Ali Raza');
  const [cartClientPhone, setCartClientPhone] = useState<string>('+92 300 4411223');
  const [cartClientBirthDate, setCartClientBirthDate] = useState<string>('');

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

  // Query 4 & 5: Automated Birthday & Festival Wishes (100% Full Standard Rate — Zero Discounts Until Market Review)
  const [noShowChecks, setNoShowChecks] = useState<Record<string, 'PENDING' | 'CONFIRMED' | 'WAITLIST_FILLED'>>({
    'BK-101': 'CONFIRMED',
    'BK-103': 'PENDING',
  });
  const [rebookWhisperSentIds, setRebookWhisperSentIds] = useState<string[]>([]);
  const [openChairAlertSent, setOpenChairAlertSent] = useState(false);

  const [celebrations, setCelebrations] = useState<CelebrationClient[]>([
    {
      id: 'cel-1',
      clientName: 'Ali Raza',
      phone: '+92 300 1234567',
      preferredLang: 'ur',
      eventType: 'BIRTHDAY',
      eventDate: 'Today (Nov 10)',
      lastService: 'Master Haircut & Beard',
      sent: false,
    },
    {
      id: 'cel-2',
      clientName: 'Khalid Al-Mansoor',
      phone: '+971 50 8923411',
      preferredLang: 'ar',
      eventType: 'BIRTHDAY',
      eventDate: 'Tomorrow (Nov 11)',
      lastService: 'Royal Grooming VIP',
      sent: false,
    },
    {
      id: 'cel-3',
      clientName: 'Bilal Ahmed',
      phone: '+92 321 9876543',
      preferredLang: 'en',
      eventType: 'EID_UL_FITR',
      eventDate: 'Upcoming Festival Campaign',
      lastService: 'Charcoal Detox Facial',
      sent: true,
    },
  ]);

  // Sync salon defaults when switching test salons
  useEffect(() => {
    setOwnerLang(currentSalon.onboardingLanguage);
    const cfg = getRegionFromPhone(currentSalon.phone);
    setSelectedUpgradeChannel(cfg.paymentChannels[0].id);
    setSelectedUpgradeTargetId(null);
    setEndUserLang(cfg.clientLanguages[0].id);

    let cancelled = false;
    const params = new URLSearchParams({
      salonName: currentSalon.name,
      ownerName: currentSalon.owner,
      whatsappPhone: currentSalon.phone,
    });
    fetch(`/api/salons/${encodeURIComponent(currentSalon.id)}/concierge-state?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: SalonConciergeStateResponse | null) => {
        if (!cancelled && data) setConciergeState(data);
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

  // Query 6: VIP Deal Applicability Calculation (Fri-Sun Weekend vs Mon-Thu Normal + 7-10 Day Validation)
  const isVipPackage = currentSalon.planId === 'VIP' || currentSalon.planId === 'CUSTOM';
  const isVipDealActiveNow =
    isVipPackage &&
    (dayScheduleMode === 'FRI_SUN_WEEKEND' || vipCampaignMode === 'CONTINUOUS_7_10_DAYS');
  const vipDealDiscountRate = isVipDealActiveNow ? 0.25 : 0; // 25% OFF on Fri-Sun or during active 7-10 Day Validation Deal
  const pricingRuleBadge = !isVipPackage
    ? 'Standard Rates (Upgrade to VIP for Auto Deals)'
    : dayScheduleMode === 'FRI_SUN_WEEKEND'
    ? 'Fri–Sun Weekend VIP Deal Active (25% OFF)'
    : vipCampaignMode === 'CONTINUOUS_7_10_DAYS'
    ? '7–10 Day VIP Validation Campaign Active (25% OFF Mon–Thu)'
    : 'Mon–Thu Normal Days · Standard Menu Rates Applied';

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
    setEndUserLang(onboardedData.language);
    if (onboardedData.services && onboardedData.services.length > 0) {
      setServices(
        onboardedData.services.map((s) => {
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
        })
      );
    }
    if (onboardedData.barbers && onboardedData.barbers.length > 0) {
      setBarbersList(onboardedData.barbers);
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

  // Query 2 Voice Booking Announcement (Speaks in Owner's Own Voice Language)
  const triggerVoiceBookingAnnouncement = (
    ownerFirst: string,
    barber: string,
    client: string,
    time: string,
    servicesText: string,
    priceVal: number,
    clientLangUsed: ClientChatLang = 'ur'
  ) => {
    const newClient: BookingRecord = {
      id: `BK-${Date.now().toString().slice(-3)}`,
      clientName: client,
      barberName: barber,
      phone: cartClientPhone,
      service: servicesText,
      price: priceVal,
      timeSlot: time,
      status: 'CONFIRMED',
    };
    setBookings((prev) => [newClient, ...prev]);

    const speechByOwnerLang: Record<VoiceLang, string> = {
      en: `${ownerFirst}, your barber ${barber} has a new appointment from ${client} at ${time}. Services: ${servicesText}.`,
      ur: `${ownerFirst} صاحب، آپ کے باربر ${barber} کی نئی اپائنٹمنٹ ${client} کے ساتھ ${time} پر کنفرم ہو گئی ہے۔ سروسز: ${servicesText}۔`,
      ar: `${ownerFirst}، الحلاق ${barber} لديه موعد جديد مع ${client} في الساعة ${time}. الخدمات: ${servicesText}.`,
    };

    const spokenText = speechByOwnerLang[ownerLang];
    setVoiceLogs((prev) => [
      {
        id: `vlog-${Date.now()}`,
        type: 'BOOKING',
        clientName: client,
        clientLang: clientLangUsed,
        ownerVoiceLang: ownerLang,
        summary: `New ${time} booking (${clientLangUsed.toUpperCase()} chat ➔ ${ownerLang.toUpperCase()} voice) · Barber: ${barber}`,
        spokenText,
        time: 'Just now',
        isUrgent: false,
      },
      ...prev,
    ]);

    const romanUrduText = `${ownerFirst} Sahab! Aap kay barber ${barber} ki nayi appointment ${client} kay sath ${time} par confirm ho gayi hai. Services: ${servicesText}.`;

    if (voiceFilter === 'ALL') {
      speakHandsFree(spokenText, ownerLang, romanUrduText);
    }
  };

  // Query 4 Cross-Language Client Reply Voice Translator (Client Chat Language -> Owner's Voice Language!)
  const triggerCrossLanguageClientReply = (
    client: string,
    clientLang: ClientChatLang,
    slotTime: string,
    replyType: 'CONFIRMED' | 'DECLINED' | 'LATE',
    rawClientText: string
  ) => {
    const isUrgent = replyType === 'DECLINED' || replyType === 'LATE';
    setSimChatMessages((prev) => [
      ...prev,
      { sender: 'CLIENT', text: `[${clientLang.toUpperCase()}] ${rawClientText}`, time: 'Just now' },
    ]);

    // Bot replies back to end-user in CLIENT'S OWN LANGUAGE
    const botAckByClientLang: Record<ClientChatLang, Record<'CONFIRMED' | 'DECLINED' | 'LATE', string>> = {
      ar: {
        CONFIRMED: `شكراً ${client}! تم تأكيد موعدك الساعة ${slotTime} في ${currentSalon.name}. بانتظارك!`,
        DECLINED: `تم استلام طلبك يا ${client}. سنقوم بإعادة جدولة موعدك ليوم غد وإرسال الأوقات المتاحة.`,
        LATE: `لا بأس يا ${client}! أبلغنا الحلاق أنك ستتأخر 15 دقيقة لموعد ${slotTime}.`,
      },
      ur: {
        CONFIRMED: `شکریہ ${client}! آپ کی ${slotTime} کی اپائنٹمنٹ ${currentSalon.name} میں کنفرم ہے۔ ہم منتظر ہیں!`,
        DECLINED: `جی ${client}، کوئی بات نہیں۔ ہم کل کے دستیاب ٹائم آپ کو بھیج رہے ہیں۔`,
        LATE: `کوئی مسئلہ نہیں ${client}، ہم نے باربر کو بتا دیا ہے کہ آپ 15 منٹ لیٹ آئیں گے۔`,
      },
      en: {
        CONFIRMED: `Thank you ${client}! Your ${slotTime} slot at ${currentSalon.name} is confirmed. See you soon!`,
        DECLINED: `Got it ${client}. We will send available slots to reschedule for tomorrow.`,
        LATE: `No problem ${client}! We notified your barber you will be 15 minutes late for ${slotTime}.`,
      },
    };

    // Dashboard speaks aloud in OWNER'S OWN PREFERRED VOICE LANGUAGE (e.g. Asian barber in Dubai hears Urdu/English!)
    const ownerSpeechByOwnerLang: Record<VoiceLang, Record<'CONFIRMED' | 'DECLINED' | 'LATE', string>> = {
      en: {
        CONFIRMED: `Translated from ${clientLang.toUpperCase()}: Client ${client} confirmed he is coming today at ${slotTime}.`,
        DECLINED: `Urgent from ${clientLang.toUpperCase()} chat: ${client} cannot come at ${slotTime} and requested tomorrow.`,
        LATE: `Arrival alert from ${clientLang.toUpperCase()}: ${client} replied he is 15 minutes late for ${slotTime}.`,
      },
      ur: {
        CONFIRMED: `${clientLang === 'ar' ? 'عربی' : clientLang === 'en' ? 'انگلش' : 'اردو'} پیغام کا ترجمہ: کسٹمر ${client} نے آج ${slotTime} آنے کی تصدیق کر دی ہے۔`,
        DECLINED: `اہم اطلاع (${clientLang.toUpperCase()} میسج): کسٹمر ${client} آج ${slotTime} نہیں آ سکیں گے، کل کا وقت مانگا ہے۔`,
        LATE: `کسٹمر ${client} کا پیغام (${clientLang.toUpperCase()}): وہ ${slotTime} اپائنٹمنٹ پر 15 منٹ لیٹ پہنچیں گے۔`,
      },
      ar: {
        CONFIRMED: `ترجمة رد العميل (${clientLang.toUpperCase()}): أكد ${client} حضوره اليوم الساعة ${slotTime}.`,
        DECLINED: `تنبيه عاجل (${clientLang.toUpperCase()}): اعتذر ${client} عن موعد ${slotTime} ويطلب التأجيل للغد.`,
        LATE: `تحديث وصول (${clientLang.toUpperCase()}): أرسل ${client} أنه سيتأخر 15 دقيقة عن ${slotTime}.`,
      },
    };

    const spokenText = ownerSpeechByOwnerLang[ownerLang][replyType];
    setVoiceLogs((prev) => [
      {
        id: `vlog-${Date.now()}`,
        type: isUrgent ? 'REPLY_URGENT' : 'REPLY_CONFIRMED',
        clientName: client,
        clientLang,
        ownerVoiceLang: ownerLang,
        summary: `Client (${clientLang.toUpperCase()}) ➔ Owner Voice (${ownerLang.toUpperCase()}): "${rawClientText}"`,
        spokenText,
        time: 'Just now',
        isUrgent,
      },
      ...prev,
    ]);

    setTimeout(() => {
      setSimChatMessages((prev) => [
        ...prev,
        {
          sender: 'BOT',
          text: `[Bot Replied in ${clientLang.toUpperCase()}] ${botAckByClientLang[clientLang][replyType]}`,
          time: 'Just now',
        },
      ]);
    }, 350);

    const romanUrduReplyByReplyType: Record<'CONFIRMED' | 'DECLINED' | 'LATE', string> = {
      CONFIRMED: `${clientLang.toUpperCase()} message ka tarjuma: Customer ${client} nay aaj ${slotTime} aane ki tasdeeq kar di hai.`,
      DECLINED: `Zaroori itlaa: Customer ${client} aaj ${slotTime} nahi aa sakte, kal ka time manga hai.`,
      LATE: `Customer ${client} ka paigham: Woh ${slotTime} appointment par 15 minute late pohanchein gay.`,
    };

    if (voiceFilter === 'ALL' || isUrgent) {
      speakHandsFree(spokenText, ownerLang, romanUrduReplyByReplyType[replyType]);
    }
  };

  // Query 5 & 6: End-User Multi-Service Selection & Permanent Immutable Confirmation
  const selectedCartServices = services.filter((s) => selectedCartServiceIds.includes(s.id));
  const cartRawSubtotal = selectedCartServices.reduce((sum, s) => sum + s.price, 0);
  const cartDiscountAmount = Math.round(cartRawSubtotal * vipDealDiscountRate);
  const cartFinalTotal = Math.max(0, cartRawSubtotal - cartDiscountAmount);

  const handleConfirmEndUserCartBooking = () => {
    if (selectedCartServices.length === 0) return;
    const svcNames = selectedCartServices.map((s) => s.name);
    const svcListJoined = svcNames.join(', ');
    const confirmMsgByLang: Record<ClientChatLang, string> = {
      en: `YES, I confirm ${svcListJoined} at ${selectedCartSlot} for ${regionConfig.symbol}${cartFinalTotal.toLocaleString()} (${pricingRuleBadge}).`,
      ur: `جی ہاں، میں ${selectedCartSlot} کے لیے ${svcListJoined} اور کل بل ${regionConfig.symbol}${cartFinalTotal.toLocaleString()} کنفرم کرتا ہوں۔`,
      ar: `نعم، أؤكد حجز (${svcListJoined}) الساعة ${selectedCartSlot} بمبلغ إجمالي ${regionConfig.symbol}${cartFinalTotal.toLocaleString()}.`,
    };

    const confirmedMessage = confirmMsgByLang[endUserLang];
    const hash = `SHA256:${Math.random().toString(36).substring(2, 6).toUpperCase()}...${Math.random()
      .toString(36)
      .substring(2, 6)
      .toUpperCase()}`;

    const newProof: ImmutableProofRecord = {
      id: `PRF-${Date.now().toString().slice(-4)}`,
      clientName: cartClientName || 'Walk-in Client',
      clientPhone: cartClientPhone,
      clientLang: endUserLang,
      services: svcNames,
      totalAmount: cartFinalTotal,
      pricingModeLabel: pricingRuleBadge,
      slotTime: selectedCartSlot,
      confirmedMessage,
      timestamp: `${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (Immutable)`,
      hash,
    };

    setImmutableProofs((prev) => [newProof, ...prev]);
    setSimChatMessages((prev) => [
      ...prev,
      { sender: 'CLIENT', text: confirmedMessage, time: 'Just now' },
      {
        sender: 'BOT',
        text:
          endUserLang === 'ar'
            ? `تم تأكيد الحجز وحفظ الفاتورة الدائمة (${newProof.id}). ننتظرك في ${currentSalon.name}!`
            : endUserLang === 'ur'
            ? `آپ کا حتمی آرڈر (${newProof.id}) محفوظ کر لیا گیا ہے۔ ${currentSalon.name} میں خوش آمدید!`
            : `Confirmed! Permanent receipt ${newProof.id} locked. ${currentSalon.name} location pin sent!`,
        time: 'Just now',
      },
    ]);

    triggerVoiceBookingAnnouncement(
      currentSalon.owner.split(' ')[0] || 'Hamza',
      'Aslam',
      cartClientName || 'Client',
      selectedCartSlot,
      svcListJoined,
      cartFinalTotal,
      endUserLang
    );

    if (cartClientPhone.trim()) {
      fetch(`/api/salons/${encodeURIComponent(currentSalon.id)}/clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cartClientName || 'WhatsApp Client',
          phone: cartClientPhone.trim(),
          birthDate: cartClientBirthDate.trim(),
          preferredLanguage: endUserLang === 'ur' ? 'ur' : endUserLang === 'ar' ? 'ar' : 'en',
        }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.state) setConciergeState(data.state);
        })
        .catch(() => {});
    }

    setMaintToast(
      `🔒 Permanent Proof ${newProof.id} Saved (${hash}): Even if client deletes WhatsApp message, salon keeps full approval record.`
    );
    setTimeout(() => setMaintToast(null), 6000);
  };

  // End-User Bot Simulator Messages
  const [simChatMessages, setSimChatMessages] = useState([
    {
      sender: 'BOT',
      text: `Hi / Assalamu Alaikum / Marhaba! 👋 Welcome to ${currentSalon.name}. Please select your language:`,
      time: '03:10 PM',
    },
    {
      sender: 'CLIENT',
      text: 'Assalamu Alaikum, aaj 3:30 PM slot aur rate list?',
      time: '03:14 PM',
    },
    {
      sender: 'BOT',
      text: `Walaikum Assalam! How can I help you? Tap services below to calculate your exact total (${pricingRuleBadge}).`,
      time: '03:14 PM',
    },
  ]);
  const [customQuery, setCustomQuery] = useState('');

  const handleSendQuickMenuAction = (action: 'BOOK' | 'RATES' | 'DEALS' | 'LOCATION' | 'HOURS') => {
    if (action === 'LOCATION') {
      setIsLocationModalOpen(true);
    }
    if (action === 'HOURS') {
      setIsTimingModalOpen(true);
    }

    const isStarter = currentSalon.planId === 'STARTER';

    const labelMap: Record<ClientChatLang, Record<typeof action, { q: string; a: string }>> = {
      en: {
        BOOK: {
          q: 'I want to book an appointment date & time',
          a: 'Great! Pick your preferred barber, services and time slot in the Multi-Service Cart below to see your confirmed total.',
        },
        RATES: {
          q: 'Send me your service rates list',
          a: services
            .filter((s) => s.active)
            .map((s) => `• ${getLocalizedServiceName(s.name, 'en')}: ${regionConfig.symbol}${s.price.toLocaleString()}`)
            .join(' | '),
        },
        DEALS: {
          q: 'What VIP deals are active today?',
          a: isStarter
            ? `Our salon operates on clear, standard daily rates across all days of the week. View our complete rate card below!`
            : isVipDealActiveNow
            ? `🎉 Active VIP Deal (25% OFF): Valid on Fri–Sun & 7–10 Day Campaigns! Select multiple services below to apply discount automatically.`
            : `Today is Mon–Thu (Normal Day): Standard rates apply unless a 7–10 Day VIP Campaign is active. Fri–Sun unlocks 25% OFF VIP Deals!`,
        },
        LOCATION: {
          q: 'Send salon location & Google Maps pin',
          a: `📍 ${currentSalon.name}, ${currentSalon.location} — Google Maps Pin: maps.google.com/?q=${encodeURIComponent(currentSalon.location)} (Tap to open full interactive map)`,
        },
        HOURS: {
          q: 'What are your salon opening hours?',
          a: `🕒 Open daily 11:00 AM – 11:00 PM (Friday break 1:00 PM – 2:30 PM). Tap to see full weekly schedule!`,
        },
      },
      ur: {
        BOOK: {
          q: 'مجھے اپائنٹمنٹ کی تاریخ اور ٹائم بک کرنا ہے',
          a: 'جی بالکل! نیچے دیئے گئے کارٹ میں اپنا پسندیدہ باربر، سروسز اور وقت منتخب کریں تاکہ مکمل بل اور کنفرمیشن مل سکے۔',
        },
        RATES: {
          q: 'مجھے سروسز کی ریٹ لسٹ بھیج دیں',
          a: services
            .filter((s) => s.active)
            .map((s) => `• ${getLocalizedServiceName(s.name, 'ur')}: ${regionConfig.symbol}${s.price.toLocaleString()}`)
            .join(' | '),
        },
        DEALS: {
          q: 'آج کون سی VIP ڈیل چل رہی ہے؟',
          a: isStarter
            ? `ہمارے سیلون میں تمام دن معیاری اور یکساں ریٹس لاگو ہیں۔ نیچے دی گئی مکمل ریٹ لسٹ ملاحظہ فرمائیں!`
            : isVipDealActiveNow
            ? `🎉 VIP ڈیل فعال ہے (25% ڈسکاؤنٹ)! جمعہ، ہفتہ، اتوار یا 7 سے 10 دن کی مہم میں آٹومیٹک ڈسکاؤنٹ لگتا ہے۔`
            : `آج پیر تا جمعرات معمول کے ریٹس لاگو ہیں۔ جمعہ تا اتوار یا 7-10 دن کی VIP ڈیل پر ڈسکاؤنٹ ملتا ہے۔`,
        },
        LOCATION: {
          q: 'سیلون کی لوکیشن اور گوگل میپ پن بھیجیں',
          a: `📍 ${currentSalon.name}، ${currentSalon.location} — گوگل میپس لنک: maps.google.com/?q=${encodeURIComponent(currentSalon.location)} (مکمل لوکیشن میپ اوپن ہو گیا ہے)`,
        },
        HOURS: {
          q: 'سیلون کھلنے اور بند ہونے کا ٹائم کیا ہے؟',
          a: `🕒 روزانہ صبح 11:00 بجے سے رات 11:00 بجے تک کھلا ہے (جمعہ وقفہ 1:00 تا 2:30)۔ شیڈول باکس کھول دیا گیا ہے!`,
        },
      },
      ar: {
        BOOK: {
          q: 'أريد حجز موعد وتاريخ',
          a: 'أهلاً بك! اختر الحلاق المفضل والخدمات والوقت المناسب من القائمة بالأسفل لعرض السعر الإجمالي والتأكيد.',
        },
        RATES: {
          q: 'أرسل لي قائمة الأسعار والخدمات',
          a: services
            .filter((s) => s.active)
            .map((s) => `• ${getLocalizedServiceName(s.name, 'ar')}: ${regionConfig.symbol}${s.price.toLocaleString()}`)
            .join(' | '),
        },
        DEALS: {
          q: 'ما هي عروض VIP المتاحة اليوم؟',
          a: isStarter
            ? `تطبق في صالوننا الأسعار الاعتيادية الموحدة لجميع الخدمات طوال أيام الأسبوع. تفضل بالاطلاع على قائمة الأسعار أدناه!`
            : isVipDealActiveNow
            ? `🎉 عرض VIP مفعل (خصم 25%): يسري الجمعة والسبت والأحد وعروض 7-10 أيام!`
            : `اليوم من الإثنين إلى الخميس تطبق الأسعار العادية ما لم يكن عرض 7-10 أيام مفعلاً.`,
        },
        LOCATION: {
          q: 'أرسل موقع الصالون وخريطة جوجل',
          a: `📍 ${currentSalon.name}، ${currentSalon.location} — رابط الخريطة: maps.google.com/?q=${encodeURIComponent(currentSalon.location)} (تم فتح تفاصيل الموقع والملاحة)`,
        },
        HOURS: {
          q: 'ما هي ساعات العمل؟',
          a: `🕒 يومياً من 11:00 صباحاً حتى 11:00 مساءً (استراحة الجمعة 1:00 - 2:30). تم فتح جدول الأوقات!`,
        },
      },
    };

    const entry = labelMap[endUserLang][action];
    setSimChatMessages((prev) => [
      ...prev,
      { sender: 'CLIENT', text: entry.q, time: 'Just now' },
      { sender: 'BOT', text: entry.a, time: 'Just now' },
    ]);
  };

  const handleSendSimQuery = (textToSend?: string) => {
    const text = (textToSend || customQuery).trim();
    if (!text) return;
    const lower = text.toLowerCase();

    // Query 5 Check: Ambiguous time e.g. "9", "at 9", "9 baje", "الساعة 9"
    const isBare9 =
      /^(at\s*)?9(\s*(o'clock|baje)?)?$/i.test(text) ||
      lower === '9' ||
      lower === 'at 9' ||
      lower === '9 baje' ||
      text.includes('الساعة 9');
    const hasAmPm =
      lower.includes('am') ||
      lower.includes('pm') ||
      lower.includes('صبح') ||
      lower.includes('شام') ||
      lower.includes('رات') ||
      lower.includes('صباح') ||
      lower.includes('مساء');

    if (isBare9 && !hasAmPm) {
      setTimeDisambiguationPrompt({ rawHour: '9' });
      const promptText =
        endUserLang === 'ur'
          ? 'کیا آپ کا مطلب صبح 9:00 AM ہے یا رات 9:00 PM؟ برائے مہربانی اپنا مطلوبہ وقت منتخب کریں:'
          : endUserLang === 'ar'
          ? 'هل تقصد 9:00 صباحاً (AM) أم 9:00 مساءً (PM)؟ يرجى تحديد الوقت المفضل:'
          : 'Did you mean 9:00 AM (Morning) or 9:00 PM (Night)? Please select:';
      setSimChatMessages((prev) => [
        ...prev,
        { sender: 'CLIENT', text: `[${endUserLang.toUpperCase()}] ${text}`, time: 'Just now' },
        { sender: 'BOT', text: promptText, time: 'Just now' },
      ]);
      if (!textToSend) setCustomQuery('');
      return;
    }

    // Query 3 Check: Barber Tariq occupied at 04:15 PM -> Suggest Barber Ali
    const mentionsTariq = lower.includes('tariq') || lower.includes('طارق');
    const mentions415 =
      lower.includes('4:15') ||
      lower.includes('04:15') ||
      lower.includes('4') ||
      lower.includes('سوا چار') ||
      lower.includes('الأربعة');

    if (mentionsTariq && mentions415) {
      setBarberConflictPrompt({
        slot: '04:15 PM',
        requestedBarber: 'Tariq',
        suggestedBarber: 'Ali Raza',
      });
      const conflictText =
        endUserLang === 'ur'
          ? '⚠️ باربر طارق اس وقت (04:15 PM) پر پہلے سے مصروف ہیں۔ باربر علی اس ٹائم پر بالکل دستیاب ہیں! کیا آپ باربر علی کے ساتھ اپائنٹمنٹ بک کرنا چاہتے ہیں؟'
          : endUserLang === 'ar'
          ? '⚠️ الحلاق طارق مشغول في هذا الوقت (04:15 PM). الحلاق علي متاح في هذا الوقت! هل ترغب في حجز الموعد مع الحلاق علي؟'
          : '⚠️ Barber Tariq is currently occupied at 04:15 PM. Barber Ali is free on that slot! Do you want to book your appointment with Barber Ali?';
      setSimChatMessages((prev) => [
        ...prev,
        { sender: 'CLIENT', text: `[${endUserLang.toUpperCase()}] ${text}`, time: 'Just now' },
        { sender: 'BOT', text: conflictText, time: 'Just now' },
      ]);
      if (!textToSend) setCustomQuery('');
      return;
    }

    triggerCrossLanguageClientReply('WhatsApp Client', endUserLang, '05:00 PM', 'CONFIRMED', text);
    if (!textToSend) setCustomQuery('');
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

  const handleSaveWalkIn = () => {
    const id = `WLK-${Date.now().toString().slice(-4)}`;
    const timeSlot = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const matchedSvc = services.find((s) => s.name === walkInService);
    const assignedBarber = barbersList.includes(walkInBarber) ? walkInBarber : barbersList[0] || walkInBarber;
    const newBooking: BookingRecord = {
      id,
      clientName: walkInName.trim() || 'Walk-in Client',
      barberName: assignedBarber,
      phone: walkInPhone.trim() || '+92 300 0000000',
      service: walkInService,
      price: walkInPrice,
      timeSlot,
      durationMins: matchedSvc?.durationMins || 35,
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
    const urduScript = `${walkInBarber} بھائی! نیا واک اِن کسٹمر ${newBooking.clientName} ${walkInImmediateChair ? 'کرسی پر بیٹھ گیا ہے' : 'قطار میں شامل ہو گیا ہے'}۔ سروس: ${walkInService}۔`;
    const romanUrdu = `${walkInBarber} Bhai! Naya walk-in customer ${newBooking.clientName} ${walkInImmediateChair ? 'chair par baith gaya hai' : 'queue mein shamil ho gaya hai'}. Service: ${walkInService}.`;
    const englishSpeech = `Barber ${walkInBarber}, new walk-in client ${newBooking.clientName} is ${walkInImmediateChair ? 'seated in chair' : 'in waiting queue'} for ${walkInService}.`;
    const arabicSpeech = `الحلاق ${walkInBarber}! عميل جديد ${newBooking.clientName} ${walkInImmediateChair ? 'في الكرسي' : 'في الانتظار'}، الخدمة: ${walkInService}.`;

    const speechText = ownerLang === 'ur' ? urduScript : ownerLang === 'ar' ? arabicSpeech : englishSpeech;
    speakHandsFree(speechText, ownerLang, romanUrdu);

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

  // Query 4 (Approved): 100% Complete Full Rate Wishes (Birthday & Festivals — Zero Discount Until Field Visit)
  const getCelebrationPreview = (cel: CelebrationClient) => {
    if (cel.eventType === 'BIRTHDAY') {
      if (cel.preferredLang === 'ar') {
        return `عيد ميلاد سعيد يا ${cel.clientName}! يتمنى لك ${currentSalon.owner} وفريق ${currentSalon.name} يوماً سعيداً. يسعدنا خدمتك اليوم بأولوية VIP وبالأسعار الرسمية الكاملة.`;
      }
      if (cel.preferredLang === 'ur') {
        return `سالگرہ مبارک ${cel.clientName}! ${currentSalon.owner} اور ${currentSalon.name} کی طرف سے دلی مبارکباد۔ آج آپ کے لیے VIP ترجیحی وقت دستیاب ہے (مکمل معیاری ریٹس پر)۔`;
      }
      return `Happy Birthday ${cel.clientName}! Warm wishes from ${currentSalon.owner} at ${currentSalon.name}. Reply to reserve a priority VIP chair today at our standard menu rates.`;
    }

    if (cel.preferredLang === 'ar') {
      return `عيد مبارك ${cel.clientName}! يتمنى لك ${currentSalon.owner} وفريق ${currentSalon.name} عيداً سعيداً. احجز موعدك مبكراً بالأسعار الرسمية قبل امتلاء المقاعد.`;
    }
    if (cel.preferredLang === 'ur') {
      return `عید مبارک ${cel.clientName}! ${currentSalon.owner} اور ${currentSalon.name} کی جانب سے عید کی خوشیاں مبارک۔ رش سے بچنے کے لیے معیاری ریٹس پر اپنا وقت پہلے بک کریں۔`;
    }
    return `Season's Greetings ${cel.clientName}! Warm wishes from ${currentSalon.owner} & ${currentSalon.name}. Book your priority slot ahead of the rush at full standard rates.`;
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

          {/* 1. STAFF & BARBERS (Add/Edit Barbers & Chair Assignments) */}
          {manageSubSection === 'STAFF' && (
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

          {/* 4. AUTOMATION & REWARDS (Birthday %, 30-day Win-Back, Google Review URL, Regional Language Preview) */}
          {manageSubSection === 'AUTOMATION' && (
            <div className="space-y-4">
              <SalonRetentionSettingsPanel
                salonId={currentSalon.id}
                salonName={currentSalon.name}
                ownerName={currentSalon.owner}
                salonPhone={currentSalon.phone}
                conciergeState={conciergeState}
                onStateUpdated={(next) => setConciergeState(next)}
                onShowToast={(msg) => {
                  setMaintToast(msg);
                  setTimeout(() => setMaintToast(null), 5000);
                }}
              />

              {/* Collapsible Plan, Billing & Video Broadcast Drawer inside Manage */}
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
                <label className="block text-xs font-mono text-[#8B949E] mb-1">
                  Select Primary Service:
                </label>
                <select
                  value={walkInService}
                  onChange={(e) => {
                    setWalkInService(e.target.value);
                    const matchedSvc = services.find((s) => s.name === e.target.value);
                    if (matchedSvc) setWalkInPrice(matchedSvc.price);
                  }}
                  className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3 text-sm text-[#F0F6FC] focus:outline-none focus:border-[#06B6D4]"
                >
                  {services
                    .filter((s) => s.active)
                    .map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name} ({s.durationMins} min) — {regionConfig.symbol}{s.price.toLocaleString()}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono text-[#8B949E] mb-1">
                  Custom Final Price ({regionConfig.currency}):
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
                  Audio will speak aloud: "{walkInBarber} Bhai! Naya walk-in customer {walkInName || 'Guest'} chair par baith gaya hai."
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
