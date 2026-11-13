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
} from 'lucide-react';
import { PortalCard } from './PortalCard';
import { BroadcastTab } from './Tabs/BroadcastTab';
import { SalonWindowPosterPdf } from './SalonWindowPosterPdf';
import { Contact, SalonProfile } from '../types';
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
  status: 'CONFIRMED' | 'IN_CHAIR' | 'COMPLETED';
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
  onOpenSimulator?: () => void;
  onClose?: () => void;
}

export const SalonOwnerDashboard: React.FC<SalonOwnerDashboardProps> = ({
  selectedSalonName,
  salonCategory,
  onboardedData,
  isFounderInspector = false,
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

  // Query 6: Consolidated 5-Tab Navigation (All 8 sections preserved inside 5 mobile-friendly tabs)
  const [activeTab, setActiveTab] = useState<
    'QUEUE' | 'RATES_BOT' | 'MARKETING' | 'GROWTH_KIT' | 'BILLING_SLA'
  >('QUEUE');

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
  }, [currentSalon.id, currentSalon.onboardingLanguage, currentSalon.phone]);

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
      barberName: 'Aslam',
      phone: '+92 300 1234567',
      service: 'Master Haircut & Skin Fade',
      price: 1200,
      timeSlot: '03:30 PM',
      status: 'CONFIRMED',
    },
    {
      id: 'BK-102',
      clientName: 'Hamza Malik',
      barberName: 'Tariq',
      phone: '+92 321 9876543',
      service: 'Royal Beard Sculpt & Ozone Steam',
      price: 800,
      timeSlot: '04:15 PM',
      status: 'IN_CHAIR',
    },
    {
      id: 'BK-103',
      clientName: 'Dr. Usman Qureshi',
      barberName: 'Aslam',
      phone: '+92 333 4567890',
      service: 'Charcoal Deep Detox Facial',
      price: 2500,
      timeSlot: '05:00 PM',
      status: 'CONFIRMED',
    },
    {
      id: 'BK-104',
      clientName: 'Saad Farooq',
      barberName: 'Bilal',
      phone: '+92 345 6789012',
      service: 'Haircut + Beard Styling Combo',
      price: 1800,
      timeSlot: '05:45 PM',
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
  const [services, setServices] = useState(() => {
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
          price: s.price,
          active: s.enabled,
        };
      });
    }
    if (isLadies) {
      return [
        { id: 'l1', name: 'Signature Party Makeup & Styling', price: 4500, active: true },
        { id: 'l2', name: 'Barat / Walima Bridal Package', price: 35000, active: true },
        { id: 'l3', name: 'Hydra-Facial & Skin Polish', price: 3500, active: true },
        { id: 'l4', name: 'Keratin Hair Rebonding / Smoothing', price: 12000, active: true },
        { id: 'l5', name: 'Mani-Pedi Classic Spa', price: 2000, active: true },
        { id: 'l6', name: 'Full Face Threading & Waxing', price: 1200, active: true },
        { id: 'l7', name: 'Deep Conditioning Hair Spa', price: 2500, active: true },
      ];
    }
    return [
      { id: 's1', name: 'Master Haircut & Skin Fade', price: 800, active: true },
      { id: 's2', name: 'Classic Beard Trim & Sculpt', price: 400, active: true },
      { id: 's3', name: 'Hot Towel Steam Shave', price: 500, active: true },
      { id: 's4', name: 'Hair Color & Camo', price: 1500, active: true },
      { id: 's5', name: 'Charcoal Deep Detox Facial', price: 2500, active: true },
      { id: 's6', name: 'Keratin Hair Protein', price: 6000, active: true },
      { id: 's7', name: 'Herbal Mint Head Massage', price: 500, active: true },
      { id: 's8', name: 'Groom Signature Package', price: 12000, active: true },
    ];
  });

  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [customServiceName, setCustomServiceName] = useState('');
  const [customServicePrice, setCustomServicePrice] = useState('1500');

  // Query 8: Barbers & Stylists Management State (Synced with Onboarding & LocalStorage)
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
  const [editingBarberIndex, setEditingBarberIndex] = useState<number | null>(null);
  const [editingBarberName, setEditingBarberName] = useState('');

  const handleAddBarberDashboard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBarberDashboardInput.trim()) return;
    const updated = [...barbersList, newBarberDashboardInput.trim()];
    setBarbersList(updated);
    setNewBarberDashboardInput('');
    try {
      localStorage.setItem('wcl_salon_barbers', JSON.stringify(updated));
    } catch {}
    setMaintToast(`✓ Barber "${newBarberDashboardInput.trim()}" added to active roster & voice engine.`);
    setTimeout(() => setMaintToast(null), 4000);
  };

  const handleSaveEditBarber = (index: number) => {
    if (!editingBarberName.trim()) return;
    const oldName = barbersList[index];
    const updated = [...barbersList];
    updated[index] = editingBarberName.trim();
    setBarbersList(updated);
    setEditingBarberIndex(null);
    setEditingBarberName('');
    try {
      localStorage.setItem('wcl_salon_barbers', JSON.stringify(updated));
    } catch {}
    setMaintToast(`✓ Barber "${oldName}" updated to "${editingBarberName.trim()}".`);
    setTimeout(() => setMaintToast(null), 4000);
  };

  const handleDeleteBarberDashboard = (name: string) => {
    const updated = barbersList.filter((b) => b !== name);
    setBarbersList(updated);
    try {
      localStorage.setItem('wcl_salon_barbers', JSON.stringify(updated));
    } catch {}
    setMaintToast(`✓ Barber "${name}" removed from salon roster.`);
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
    setBookings((prev) =>
      prev.map((b) => {
        if (b.id === id) {
          if (status === 'COMPLETED') {
            setMaintToast(`✓ Chair freed! ${b.clientName}'s appointment marked Done & thank-you note sent.`);
            setTimeout(() => setMaintToast(null), 4000);
          } else if (status === 'IN_CHAIR') {
            setMaintToast(`💈 ${b.clientName} is now In-Chair with ${b.barberName}.`);
            setTimeout(() => setMaintToast(null), 4000);
          }
          return { ...b, status };
        }
        return b;
      })
    );
  };

  const handleSaveWalkIn = () => {
    const id = `WLK-${Date.now().toString().slice(-4)}`;
    const timeSlot = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newBooking: BookingRecord = {
      id,
      clientName: walkInName.trim() || 'Walk-in Client',
      barberName: walkInBarber,
      phone: walkInPhone.trim() || '+92 300 0000000',
      service: walkInService,
      price: walkInPrice,
      timeSlot,
      status: walkInImmediateChair ? 'IN_CHAIR' : 'CONFIRMED',
    };

    setBookings((prev) => [newBooking, ...prev]);
    setIsWalkInModalOpen(false);

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
  // SALON OWNER FULL PWA DASHBOARD
  // ============================================================================
  return (
    <div className="space-y-5 max-w-5xl mx-auto pb-28 lg:pb-10 min-w-0">
      {/* ========================================================================= */}
      {/* 0. POST-ONBOARDING WELCOME SEQUENCE DISPATCH CONFIRMATION (Query 3)       */}
      {/* ========================================================================= */}
      <div className="rounded-2xl border border-[#116329] bg-[#0D3822] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in shadow-lg">
        <div className="flex items-start gap-3">
          <div className="size-10 rounded-xl bg-[#161B22] border border-[#116329] grid place-items-center text-[#3FB950] shrink-0">
            <CheckCircle2 className="size-5" />
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono font-bold uppercase text-[#3FB950]">
                Automated WhatsApp Welcome Sequence Dispatched
              </span>
              <span className="rounded bg-[#161B22] border border-[#116329] px-2 py-0.5 text-[9px] font-mono text-[#3FB950]">
                2 MESSAGES DELIVERED ✓✓
              </span>
            </div>
            <p className="text-xs text-[#F0F6FC] font-sans">
              Welcome to your live Salon Owner Dashboard! Message 1 (Package &amp; SLA Confirmation) and Message 2 (Direct Home Shortcut Link) have been dispatched to <strong className="text-[#06B6D4] font-mono">{currentSalon.phone}</strong>.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="size-2 rounded-full bg-[#3FB950] animate-ping" />
          <span className="text-[11px] font-mono font-bold text-[#3FB950]">
            ONLINE &amp; TAKING BOOKINGS
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. TOP HEADER: SALON BRAND + TOP LANGUAGE SWITCHER + ACTIVE STATUS        */}
      {/* ========================================================================= */}
      <div className="rounded-3xl border border-[#30363D] bg-[#161B22] p-5 sm:p-7 relative overflow-hidden">
        {/* TOP BAR: ACTIVE STATUS BADGE + TOP LANGUAGE SWITCHER (Query 3) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-[#21262D]">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#116329] bg-[#0D3822] px-3.5 py-1 text-xs font-mono font-bold text-[#3FB950] shadow-sm">
              <span className="size-2 rounded-full bg-[#3FB950] animate-pulse" />
              <span>ACTIVE &amp; CONNECTED · 24/7 WHATSAPP CONCIERGE LIVE</span>
            </div>
            <span className="rounded-md bg-[#0D1117] border border-[#30363D] px-2.5 py-0.5 text-[10px] font-mono text-[#06B6D4]">
              {regionConfig.regionLabel.toUpperCase()}
            </span>
          </div>

          {/* Top 4-Language Switcher (Query 3) */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#0D1117] border border-[#30363D]">
            {[
              { id: 'ur' as const, label: '🇵🇰 اردو', full: 'Urdu' },
              { id: 'en' as const, label: '🇬🇧 EN', full: 'English' },
              { id: 'ar' as const, label: '🇦🇪 العربية', full: 'Arabic' },
            ].map((lang) => {
              const isSelected = ownerLang === lang.id;
              return (
                <button
                  key={lang.id}
                  type="button"
                  onClick={() => {
                    setOwnerLang(lang.id);
                    setMaintToast(`Language updated to ${lang.full} (${lang.label})`);
                    setTimeout(() => setMaintToast(null), 3000);
                  }}
                  className={`min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1 ${
                    isSelected
                      ? 'bg-[#06B6D4] text-[#0D1117]'
                      : 'text-[#8B949E] hover:text-[#F0F6FC] hover:bg-[#21262D]'
                  }`}
                  title={`Switch language to ${lang.full}`}
                >
                  <span>{lang.label}</span>
                  {isSelected && <Check className="size-3 text-[#0D1117]" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-[10px] font-mono font-bold uppercase tracking-[.22em] text-[#06B6D4]">
                SALON OWNER PORTAL · MANAGED REVENUE CONTROL
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#F0F6FC] tracking-tight mt-1">
              {currentSalon.name}
            </h1>
            <p className="text-xs text-[#8B949E] font-sans mt-0.5">
              Owner: <strong className="text-[#F0F6FC]">{currentSalon.owner}</strong> · SIM:{' '}
              <span className="font-mono text-[#D29922]">{currentSalon.phone}</span> · {currentSalon.location}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-mono">
              <span className="rounded-lg border border-[#30363D] bg-[#0D1117] px-2.5 py-1 text-[#F0F6FC]">
                Plan: <strong className="text-[#D29922]">{currentSalon.plan}</strong>
              </span>
              <span className="rounded-lg border border-[#116329] bg-[#0D3822] px-2.5 py-1 text-[#3FB950]">
                10% Monthly Fee Due: <strong>5th of Every Month</strong>
              </span>
              <select
                value={selectedSalonId}
                onChange={(e) => setSelectedSalonId(e.target.value)}
                className="min-h-[40px] rounded-lg border border-[#30363D] bg-[#0D1117] px-2 py-1 text-xs font-mono text-[#06B6D4] focus:outline-none focus:border-[#06B6D4]"
                title="Switch test salon region"
              >
                {salonsState.map((s) => (
                  <option key={s.id} value={s.id} className="bg-[#161B22] text-[#F0F6FC]">
                    Salon: {s.name} ({getRegionFromPhone(s.phone).currency})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* TOP-RIGHT CORNER: CONTINUOUS UPGRADE BUTTON */}
          <div className="flex flex-wrap items-center gap-2.5 md:justify-end">
            {higherPackages.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setSelectedUpgradeTargetId(higherPackages[0].id);
                  setIsUpgradeModalOpen(true);
                }}
                className="min-h-[48px] px-4 py-2 rounded-xl bg-[#06B6D4] hover:bg-[#22D3EE] text-[#0D1117] text-xs font-mono font-bold uppercase tracking-wider transition active:scale-95 flex items-center gap-2"
              >
                <ArrowUpCircle className="size-4 text-[#0D1117]" />
                <span>Upgrade Plan ({higherPackages.length} Tiers)</span>
              </button>
            ) : (
              <div className="min-h-[48px] px-3.5 py-2 rounded-xl border border-[#9E6A03] bg-[#3B2E0B] text-[#D29922] text-xs font-mono font-bold flex items-center gap-1.5">
                <Sparkles className="size-4" />
                <span>Top Enterprise Tier Active</span>
              </div>
            )}

            <button
              type="button"
              onClick={() => setActiveTab('BILLING_SLA')}
              className={`min-h-[48px] flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-mono font-bold transition hover:opacity-90 ${
                isMaintenanceOverdue
                  ? 'border-[#da3633] bg-[#4C1C1D] text-[#F85149]'
                  : maintCycleStage !== 'PAID_ACTIVE'
                  ? 'border-[#9E6A03] bg-[#3B2E0B] text-[#D29922]'
                  : 'border-[#116329] bg-[#0D3822] text-[#3FB950]'
              }`}
              title="Open Plan & Monthly Fee Details"
            >
              <ShieldCheck className="size-4" />
              <span>
                {isMaintenanceOverdue
                  ? 'Overdue Grace (Post-5th)'
                  : maintCycleStage === 'STAGE_3_DAY_5_FINAL'
                  ? '5th Final Due Day'
                  : 'Priority Service Active'}
              </span>
            </button>

            {onClose && (
              <button
                onClick={onClose}
                className="min-h-[44px] min-w-[44px] rounded-xl border border-[#30363D] bg-[#21262D] p-2 text-[#8B949E] hover:text-[#F0F6FC] grid place-items-center transition"
                title="Close Portal"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </div>

        {/* QUERY 1 (NEW): OFFICIAL FOUNDER NOTICE IN OWNER'S ONBOARDING / VOICE-NOTE LANGUAGE */}
        <div
          dir={ownerLang === 'ar' || ownerLang === 'ur' ? 'rtl' : 'ltr'}
          className={`mt-4 rounded-2xl border border-[#9E6A03] bg-[#3B2E0B] p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs overflow-hidden break-words [overflow-wrap:break-word] ${
            ownerLang === 'ar' || ownerLang === 'ur' ? 'text-right' : 'text-left'
          }`}
        >
          <div className="flex items-start gap-2.5 min-w-0">
            <Globe className="size-4 text-[#D29922] shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-mono font-bold uppercase text-[#D29922] block">
                Founder Message · Onboarding / Voice-Note Language ({ownerLang.toUpperCase()})
              </span>
              <p className="text-[#F0F6FC] font-sans mt-0.5 leading-relaxed break-words [overflow-wrap:break-word]">
                {getFounderNoticeForOwner(ownerLang)}
              </p>
            </div>
          </div>
        </div>

        {/* QUERY 2 & 4: $0/MO HANDS-FREE CROSS-LANGUAGE VOICE CONCIERGE BAR */}
        <div className="mt-4 pt-4 border-t border-[#21262D] space-y-3">
          <div className="rounded-2xl border border-[#30363D] bg-[#0D1117] p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3">
              <button
                type="button"
                onClick={() => setIsVoiceEnabled(!isVoiceEnabled)}
                className={`size-12 rounded-xl border grid place-items-center shrink-0 transition ${
                  isVoiceEnabled
                    ? 'border-[#06B6D4] bg-[#21262D] text-[#06B6D4]'
                    : 'border-[#30363D] bg-[#161B22] text-[#6E7681]'
                }`}
              >
                {isVoiceEnabled ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
              </button>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-mono font-bold text-[#F0F6FC] uppercase">
                    Owner Voice Language &amp; Translator: {isVoiceEnabled ? 'ON' : 'MUTED'}
                  </span>
                  <span className="rounded-md bg-[#0D3822] border border-[#116329] px-2 py-0.5 text-[9px] font-mono font-bold text-[#3FB950]">
                    $0/MO FREE · TRANSLATES CLIENT REPLIES
                  </span>
                </div>
                <p className="text-[11px] text-[#8B949E] font-sans mt-0.5">
                  Client chats in their language (e.g., Arabic in MENA); dashboard speaks aloud to you in your chosen language ({ownerLang.toUpperCase()}).
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
              <select
                value={ownerLang}
                onChange={(e) => setOwnerLang(e.target.value as VoiceLang)}
                className="min-h-[44px] rounded-xl border border-[#30363D] bg-[#161B22] px-2.5 py-1.5 text-xs text-[#F0F6FC] focus:outline-none focus:border-[#06B6D4]"
              >
                <option value="ur" className="bg-[#161B22] text-[#F0F6FC]">Owner Voice: Urdu (اردو)</option>
                <option value="en" className="bg-[#161B22] text-[#F0F6FC]">Owner Voice: English</option>
                <option value="ar" className="bg-[#161B22] text-[#F0F6FC]">Owner Voice: Arabic (العربية)</option>
              </select>

              <button
                type="button"
                onClick={() =>
                  setVoiceFilter((prev) => (prev === 'ALL' ? 'URGENT_ONLY' : 'ALL'))
                }
                className={`min-h-[44px] rounded-xl border px-3 py-1.5 transition ${
                  voiceFilter === 'URGENT_ONLY'
                    ? 'border-[#9E6A03] bg-[#3B2E0B] text-[#D29922] font-bold'
                    : 'border-[#30363D] bg-[#161B22] text-[#F0F6FC] hover:border-[#06B6D4]'
                }`}
              >
                {voiceFilter === 'URGENT_ONLY' ? 'Filter: Urgent & Arrivals' : 'Filter: All Alerts'}
              </button>

              <button
                type="button"
                onClick={toggleScreenWakeLock}
                className={`min-h-[44px] rounded-xl border px-3 py-1.5 transition flex items-center gap-1.5 ${
                  isWakeLockActive
                    ? 'border-[#116329] bg-[#0D3822] text-[#3FB950] font-bold'
                    : 'border-[#30363D] bg-[#161B22] text-[#8B949E] hover:text-[#F0F6FC] hover:border-[#3FB950]'
                }`}
              >
                <Smartphone className="size-3.5" />
                <span>{isWakeLockActive ? 'Counter Wake: ON' : 'Keep Counter Awake'}</span>
              </button>
            </div>
          </div>

          {currentlySpeakingText && (
            <div className="rounded-xl border border-[#06B6D4] bg-[#21262D] px-3.5 py-2.5 flex items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-2.5 text-xs font-mono text-[#06B6D4]">
                <Radio className="size-4 animate-ping shrink-0" />
                <span className="font-bold">SPEAKING ({ownerLang.toUpperCase()}):</span>
                <span className="text-[#F0F6FC] font-sans">"{currentlySpeakingText}"</span>
              </div>
              <button
                type="button"
                onClick={stopSpeaking}
                className="min-h-[36px] rounded-lg bg-[#0D1117] border border-[#30363D] px-2.5 py-1 text-[10px] font-mono text-[#F0F6FC] hover:border-[#06B6D4] shrink-0"
              >
                Stop Voice
              </button>
            </div>
          )}

          {wakeLockNote && (
            <div className="rounded-xl border border-[#116329] bg-[#0D3822] px-3.5 py-2 text-[11px] font-mono text-[#3FB950]">
              {wakeLockNote}
            </div>
          )}
        </div>

        {/* QUERY 5: LIVE MONTHLY ROI METER RIGHT ABOVE / BESIDE UPGRADE PATH */}
        {(() => {
          const monthlyEarnedAmount =
            regionConfig.currency === 'PKR'
              ? 68500
              : regionConfig.currency === 'AED' || regionConfig.currency === 'SAR'
              ? 4200
              : regionConfig.currency === 'GBP'
              ? 1480
              : 1850;
          const roiMultiple = Math.max(12, Math.round(monthlyEarnedAmount / Math.max(1, currentSalon.maint)));
          return (
            <div className="mt-4 rounded-2xl border border-[#116329] bg-[#0D1117] p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="size-10 rounded-xl border border-[#116329] bg-[#0D3822] grid place-items-center text-[#3FB950] shrink-0">
                  <TrendingUp className="size-5" />
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#3FB950]">
                      MONEY WORKCRAFT EARNED YOU THIS MONTH
                    </span>
                    <span className="rounded-md bg-[#0D3822] border border-[#116329] px-2 py-0.5 text-[10px] font-mono font-black text-[#3FB950]">
                      {roiMultiple}x RETURN
                    </span>
                  </div>
                  <p className="text-sm sm:text-base font-black text-[#F0F6FC] mt-0.5 font-mono">
                    {regionConfig.symbol}{monthlyEarnedAmount.toLocaleString()}{' '}
                    <span className="text-xs font-sans font-normal text-[#8B949E]">
                      from 38 automated bookings · vs {regionConfig.symbol}{currentSalon.maint.toLocaleString()}/mo plan fee
                    </span>
                  </p>
                </div>
              </div>
              {higherPackages.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedUpgradeTargetId(higherPackages[0].id);
                    setIsUpgradeModalOpen(true);
                  }}
                  className="min-h-[44px] rounded-xl border border-[#9E6A03] bg-[#3B2E0B] hover:border-[#D29922] px-3.5 py-2 text-xs font-mono font-bold text-[#D29922] transition shrink-0"
                >
                  Unlock More With {higherPackages[0].name} →
                </button>
              )}
            </div>
          );
        })()}

        {maintToast && (
          <div className="mt-4 rounded-xl border border-[#116329] bg-[#0D3822] p-3 text-xs font-mono text-[#3FB950] animate-in fade-in flex items-center justify-between gap-3">
            <span>{maintToast}</span>
            <button onClick={() => setMaintToast(null)} className="text-[#8B949E] hover:text-[#F0F6FC] font-bold">
              ✕
            </button>
          </div>
        )}
      </div>

      {/* 5TH-OF-MONTH REMINDER BANNER */}
      {maintCycleStage !== 'PAID_ACTIVE' && maintCycleStage !== 'OVERDUE_TIER_2' && (
        <div
          className={`rounded-2xl border p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 animate-in fade-in ${
            maintCycleStage === 'STAGE_3_DAY_5_FINAL'
              ? 'border-[#da3633] bg-[#4C1C1D] text-[#F0F6FC]'
              : 'border-[#9E6A03] bg-[#3B2E0B] text-[#F0F6FC]'
          }`}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              className={`size-5 shrink-0 mt-0.5 ${
                maintCycleStage === 'STAGE_3_DAY_5_FINAL' ? 'text-[#F85149] animate-pulse' : 'text-[#D29922]'
              }`}
            />
            <div className="space-y-1">
              <span className={`text-xs font-mono font-black uppercase tracking-wider block ${
                maintCycleStage === 'STAGE_3_DAY_5_FINAL' ? 'text-[#F85149]' : 'text-[#D29922]'
              }`}>
                {maintCycleStage === 'STAGE_1_PREV_MONTH'
                  ? '📅 Reminder 1/3 · Last 2 Days of Previous Month'
                  : maintCycleStage === 'STAGE_2_DAY_3'
                  ? '⏰ Reminder 2/3 · 3rd of Month (48h Until 5th Due Date)'
                  : '🚨 Final Due Warning · 5th of Month (Due Today)'}
              </span>
              <p
                dir={ownerLang === 'ar' || ownerLang === 'ur' ? 'rtl' : 'ltr'}
                className={`text-xs leading-relaxed font-sans text-[#F0F6FC] overflow-hidden break-words [overflow-wrap:break-word] ${
                  ownerLang === 'ar' || ownerLang === 'ur' ? 'text-right' : 'text-left'
                }`}
              >
                {getMaintenanceReminderMessage(maintCycleStage, ownerLang)}
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isPayingMaint}
            onClick={() => setIsMaintPaymentModalOpen(true)}
            className="min-h-[48px] rounded-xl bg-[#06B6D4] hover:bg-[#22D3EE] text-[#0D1117] px-4 py-2 text-xs font-mono font-bold uppercase shrink-0 transition active:scale-95 flex items-center gap-2"
          >
            <CreditCard className="size-4" />
            <span>Pay {regionConfig.symbol}{currentSalon.maint.toLocaleString()} Maintenance →</span>
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. METRIC CARDS + QUERY 2 LIGHTWEIGHT STRATEGY ANALYTICS MATRIX BOXES     */}
      {/* ========================================================================= */}
      <div className="relative space-y-3">
        <div
          className={`space-y-3 transition-all duration-300 ${
            isMaintenanceOverdue ? 'filter blur-sm opacity-25 select-none pointer-events-none' : ''
          }`}
        >
          {/* Core 4 Live Operational Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-[#30363D] bg-[#161B22] p-4 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#3FB950]">
                  TODAY'S APPOINTMENTS
                </span>
                <Calendar className="size-4 text-[#3FB950]" />
              </div>
              <p className="text-2xl font-black text-[#F0F6FC] font-mono">{bookings.length}</p>
              <p className="text-[11px] text-[#8B949E] font-sans">
                Voice-announced to barbers · 0 calls
              </p>
            </div>

            <div className="rounded-2xl border border-[#30363D] bg-[#161B22] p-4 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#F0F6FC]">
                  10% MONTHLY FEE (DUE 5TH)
                </span>
                <ShieldCheck className="size-4 text-[#D29922]" />
              </div>
              <p className="text-2xl font-black text-[#D29922] font-mono">
                {regionConfig.symbol}{currentSalon.maint.toLocaleString()}
              </p>
              <p className="text-[11px] text-[#8B949E] font-sans">
                {isMaintPaid ? 'Paid & Priority Active ✓' : 'Pay from registered SIM'}
              </p>
            </div>

            <div className="rounded-2xl border border-[#30363D] bg-[#161B22] p-4 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#06B6D4]">
                  AUTOMATIC REPLIES
                </span>
                <MessageSquare className="size-4 text-[#06B6D4]" />
              </div>
              <p className="text-2xl font-black text-[#06B6D4] font-mono">89</p>
              <p className="text-[11px] text-[#8B949E] font-sans">
                Instant auto-replies (UR / AR / EN)
              </p>
            </div>

            <div className="rounded-2xl border border-[#30363D] bg-[#161B22] p-4 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#D29922]">
                  {currentSalon.planId === 'STARTER' ? 'CLIENT SATISFACTION' : 'GOOGLE REVIEWS'}
                </span>
                <Star className="size-4 text-[#D29922] fill-[#D29922]" />
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-black text-[#D29922] font-mono">4.9 ★</p>
                {currentSalon.planId === 'STARTER' && (
                  <span className="rounded bg-[#21262D] px-1.5 py-0.5 text-[9px] font-mono text-[#D29922] font-bold">
                    Starter Feedback
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#8B949E] font-sans">
                {currentSalon.planId === 'STARTER'
                  ? '+31 WhatsApp survey ratings · Upgrade for Google Sync'
                  : '+31 Positive reviews boosted'}
              </p>
            </div>
          </div>

          {/* ZERO-STORAGE STRATEGY ANALYTICS BOXES (SALON OWNER ONLY) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-[#30363D] bg-[#161B22] p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase text-[#06B6D4]">
                  TOP BOOKED SERVICES
                </span>
                <Scissors className="size-3.5 text-[#06B6D4]" />
              </div>

              {/* Barber Stylist Selector for Top Booked Services */}
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-mono text-[#8B949E]">Stylist:</span>
                <select
                  value={selectedBarberForServices}
                  onChange={(e) => setSelectedBarberForServices(e.target.value)}
                  className="rounded-lg border border-[#30363D] bg-[#0D1117] px-2 py-0.5 text-[10px] font-mono font-bold text-[#F0F6FC] focus:outline-none focus:border-[#06B6D4]"
                >
                  <option value="ALL">All Stylists (Combined)</option>
                  {barbersList.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              {(() => {
                const stats =
                  BARBER_SERVICE_STATS[selectedBarberForServices] ||
                  BARBER_SERVICE_STATS['Tariq (Master Barber)'] ||
                  BARBER_SERVICE_STATS['ALL'];
                return (
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-[#F0F6FC]">{stats.topServices[0]}</p>
                    <p className="text-[11px] text-[#8B949E] font-sans">
                      {stats.topServices.slice(1).join(' · ')}
                    </p>
                    <div className="pt-1 border-t border-[#21262D] flex items-center justify-between text-[10px] font-mono text-[#06B6D4]">
                      <span>{stats.favRate}</span>
                      <span className="text-[#8B949E]">{stats.repeatRate}</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            {currentSalon.planId === 'STARTER' ? (
              <div className="rounded-2xl border border-[#30363D] bg-[#161B22] p-3.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold uppercase text-[#06B6D4]">
                    CHAIR QUEUE CAPACITY
                  </span>
                  <span className="rounded bg-[#21262D] px-1.5 py-0.5 text-[9px] font-mono font-bold text-[#8B949E]">
                    Starter Plan
                  </span>
                </div>
                <p className="text-xs font-bold text-[#F0F6FC] font-mono">
                  28 / 30 Slots Filled (93% Chair Capacity)
                </p>
                <p className="text-[11px] text-[#8B949E] font-sans">
                  Avg wait: 8 mins · Zero missed bookings
                </p>
                <div className="pt-1 border-t border-[#21262D] flex items-center justify-between text-[10px]">
                  <span className="text-[#8B949E]">Video Deals:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedUpgradeTargetId('GROWTH');
                      setIsUpgradeModalOpen(true);
                    }}
                    className="text-[#D29922] font-mono font-bold hover:underline"
                  >
                    Upgrade to Unlock →
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-[#30363D] bg-[#161B22] p-3.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold uppercase text-[#D29922]">
                    VIDEO DEAL RESULTS
                  </span>
                  <Video className="size-3.5 text-[#D29922]" />
                </div>
                <p className="text-xs font-bold text-[#D29922] font-mono">
                  450 Sent ➔ 380 Viewed ➔ 50 Booked
                </p>
                <p className="text-[11px] text-[#8B949E] font-sans">
                  {regionConfig.symbol}{(currentSalon.phone.startsWith('+92') ? 75000 : 2250).toLocaleString()} deal revenue · 13.2% conversion
                </p>
              </div>
            )}

            <div className="rounded-2xl border border-[#30363D] bg-[#161B22] p-3.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase text-[#3FB950]">
                  PEAK RUSH HOURS
                </span>
                <TrendingUp className="size-3.5 text-[#3FB950]" />
              </div>
              <p className="text-xs font-bold text-[#F0F6FC]">4:00 PM – 8:00 PM (64%)</p>
              <p className="text-[11px] text-[#8B949E] font-sans">
                Keep 3+ barbers active during evening rush
              </p>
            </div>

            <div className="rounded-2xl border border-[#30363D] bg-[#161B22] p-3.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase text-[#58A6FF]">
                  REPEAT CLIENT RETURN
                </span>
                <Award className="size-3.5 text-[#58A6FF]" />
              </div>
              <p className="text-xs font-bold text-[#F0F6FC]">68% Repeat Visitors</p>
              <p className="text-[11px] text-[#8B949E] font-sans">
                Avg return cycle: 21 days · Zero media storage
              </p>
            </div>
          </div>
        </div>

        {/* Tier-2 Post-5th Unpaid Metrics Lock Overlay */}
        {isMaintenanceOverdue && (
          <div className="absolute inset-0 z-20 rounded-3xl border border-[#da3633] bg-[#0D1117]/80 backdrop-blur-md p-5 flex flex-col items-center justify-center text-center space-y-3 animate-in fade-in">
            <div className="size-11 rounded-2xl bg-[#4C1C1D] border border-[#da3633] grid place-items-center text-[#F85149]">
              <Lock className="size-6" />
            </div>
            <div className="max-w-xl space-y-1">
              <h3 className="text-base font-black text-[#F0F6FC]">
                Account Overdue (Past 5th Due Date) · Live Stats Paused
              </h3>
              <p className="text-xs text-[#8B949E] font-sans leading-relaxed">
                Send <strong className="text-[#F0F6FC]">{regionConfig.symbol}{currentSalon.maint.toLocaleString()}</strong> from your registered SIM (
                <span className="text-[#06B6D4] font-mono font-bold">{currentSalon.phone}</span>) to unlock Live Stats, Business Insights &amp; Priority Service.
              </p>
            </div>
            <button
              type="button"
              disabled={isPayingMaint}
              onClick={() => setIsMaintPaymentModalOpen(true)}
              className="min-h-[48px] rounded-xl bg-[#06B6D4] hover:bg-[#22D3EE] text-[#0D1117] px-5 py-2.5 text-xs font-mono font-bold uppercase transition active:scale-95 flex items-center gap-2"
            >
              <CreditCard className="size-4 text-[#0D1117]" />
              <span>
                Pay {regionConfig.symbol}{currentSalon.maint.toLocaleString()} via {currentSalon.phone} &amp; Restore Priority →
              </span>
            </button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 3. CONSOLIDATED 5-TAB MOBILE NAVIGATION (ZERO FEATURES REMOVED)           */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 p-1.5 rounded-2xl bg-[#0D1117] border border-[#30363D]">
        {[
          { id: 'QUEUE' as const, label: 'Live Queue & Voice', icon: Calendar, badge: `${bookings.length} today` },
          { id: 'RATES_BOT' as const, label: 'Rates, Bot & Proof', icon: Scissors, badge: `${services.length} · ${immutableProofs.length} locked` },
          { id: 'MARKETING' as const, label: 'Video & Events', icon: Video, badge: isVipPackage ? 'Live' : 'Deals' },
          { id: 'GROWTH_KIT' as const, label: 'Growth Kit & PDF', icon: Printer, badge: 'PDF + 4.9★' },
          { id: 'BILLING_SLA' as const, label: 'Plan & Monthly Fee', icon: ShieldCheck, badge: isMaintPaid ? 'Paid ✓' : 'Due 5th' },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-[48px] flex items-center justify-between gap-1.5 px-3 py-2.5 rounded-xl text-xs font-mono font-bold transition ${
                isActive
                  ? 'bg-[#06B6D4] text-[#0D1117] border border-[#06B6D4]'
                  : 'text-[#8B949E] hover:text-[#F0F6FC] hover:bg-[#21262D] border border-transparent'
              }`}
            >
              <span className="flex items-center gap-1.5 truncate">
                <Icon className="size-3.5 shrink-0" />
                <span className="truncate">{tab.label}</span>
              </span>
              <span className={`rounded-full px-1.5 py-0.5 text-[9px] shrink-0 ${
                isActive ? 'bg-[#0D1117]/20 text-[#0D1117]' : 'bg-[#21262D] text-[#8B949E]'
              }`}>
                {tab.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* 4. TAB 1: LIVE BOOKING QUEUE + VOICE DISPATCHER                            */}
      {/* ========================================================================= */}
      {activeTab === 'QUEUE' && (
        <PortalCard title="Today's Live Client Queue & Voice Dispatcher" kicker="SALON OWNER ONLY · HANDS-FREE">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs font-sans text-[#8B949E]">
              <p>
                Visible strictly to salon owners. Every new booking speaks aloud in your preferred language ({ownerLang.toUpperCase()}) with barber, client, time, and services.
              </p>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    triggerVoiceBookingAnnouncement(
                      currentSalon.owner.split(' ')[0] || 'Hamza',
                      'Aslam',
                      'Ali',
                      '3:00 PM',
                      'Haircut, Beard Setting, and Hair Color',
                      3200
                    )
                  }
                  className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl bg-[#06B6D4] hover:bg-[#22D3EE] text-[#0D1117] px-3 py-1.5 text-xs font-mono font-bold uppercase transition active:scale-95"
                >
                  <Volume2 className="size-3.5" />
                  <span>Test Booking (Ali · 3:00 PM)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsWalkInModalOpen(true)}
                  className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl bg-[#D29922] hover:bg-[#e0b252] text-[#0D1117] px-3.5 py-1.5 text-xs font-mono font-bold uppercase transition active:scale-95 shadow-md"
                >
                  <Plus className="size-3.5" />
                  <span>+ Add Walk-In</span>
                </button>
              </div>
            </div>

            {/* Quick Auto-Advance & Bluetooth Alert Bar */}
            <div className="rounded-xl border border-[#30363D] bg-[#161B22] p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-[11px] font-mono text-[#8B949E]">
                <Clock className="size-3.5 text-[#06B6D4]" />
                <span>Chair Automation:</span>
                <label className="inline-flex items-center gap-1.5 cursor-pointer text-[#F0F6FC]">
                  <input
                    type="checkbox"
                    checked={autoAdvanceChairs}
                    onChange={(e) => {
                      setAutoAdvanceChairs(e.target.checked);
                      setMaintToast(
                        e.target.checked
                          ? '⚡ Auto-Advance Active: Chairs will auto-complete after estimated service time.'
                          : 'Manual Done Mode: Barbers mark Done when finishing client.'
                      );
                      setTimeout(() => setMaintToast(null), 4000);
                    }}
                    className="accent-[#06B6D4] size-3.5"
                  />
                  <span className="font-bold">Auto-Complete by Duration (Hands-Free)</span>
                </label>
              </div>

              <div className="flex items-center gap-2 text-[11px] font-mono">
                <span className="text-[#8B949E]">Shop Speaker:</span>
                <span className={isLoudspeakerBoostActive ? 'text-[#06B6D4] font-bold' : 'text-[#8B949E]'}>
                  {isLoudspeakerBoostActive ? '🔊 Bluetooth / Aux Boosted' : 'Normal Mobile Speaker'}
                </span>
              </div>
            </div>

            <div className="space-y-2.5">
              {bookings.map((booking) => (
                <div
                  key={booking.id}
                  className="rounded-2xl border border-[#30363D] bg-[#0D1117] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-[#484F58] transition"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="grid size-10 place-items-center rounded-xl bg-[#161B22] border border-[#30363D] font-mono text-xs font-bold text-[#D29922] shrink-0">
                      {booking.timeSlot.split(' ')[0]}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-[#F0F6FC]">{booking.clientName}</span>
                        <span className="rounded-md bg-[#21262D] border border-[#30363D] px-2 py-0.5 text-[10px] font-mono text-[#D29922]">
                          Barber: {booking.barberName}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[9px] font-mono font-bold border ${
                            booking.status === 'CONFIRMED'
                              ? 'bg-[#06B6D4]/15 text-[#06B6D4] border-[#06B6D4]/30'
                              : booking.status === 'IN_CHAIR'
                              ? 'bg-[#3B2E0B] text-[#D29922] border-[#9E6A03] animate-pulse'
                              : 'bg-[#0D3822] text-[#3FB950] border-[#116329]'
                          }`}
                        >
                          {booking.status}
                        </span>
                      </div>
                      <p className="text-xs text-[#8B949E] font-sans mt-0.5">{booking.service}</p>
                      <p className="text-[11px] font-mono text-[#6E7681] mt-0.5">
                        Client: {booking.phone} · Slot: {booking.timeSlot}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <span className="text-sm font-mono font-bold text-[#D29922] mr-1">
                      {regionConfig.symbol}{booking.price.toLocaleString()}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const ownerFirst = currentSalon.owner.split(' ')[0] || 'Hamza';
                        const urduText = `${ownerFirst} صاحب، آپ کے باربر ${booking.barberName} کے پاس ${booking.clientName} کی ${booking.timeSlot} پر بکنگ ہے۔ سروس: ${booking.service}۔`;
                        const romanUrdu = `${ownerFirst} Sahab! Aap kay barber ${booking.barberName} kay paas ${booking.clientName} ki ${booking.timeSlot} par booking hai. Service: ${booking.service}.`;
                        const arText = `${ownerFirst}، الحلاق ${booking.barberName} لديه موعد مع ${booking.clientName} في ${booking.timeSlot}. الخدمة: ${booking.service}.`;
                        const enText = `${ownerFirst}, your barber ${booking.barberName} has ${booking.clientName} at ${booking.timeSlot}: ${booking.service}.`;
                        const text = ownerLang === 'ur' ? urduText : ownerLang === 'ar' ? arText : enText;
                        speakHandsFree(text, ownerLang, romanUrdu);
                      }}
                      className="min-h-[40px] min-w-[40px] grid place-items-center p-1.5 rounded-lg border border-[#06B6D4]/30 bg-[#06B6D4]/10 text-[#06B6D4] hover:bg-[#06B6D4]/20 transition"
                      title="Announce aloud in owner language"
                    >
                      <Volume2 className="size-4" />
                    </button>
                    {booking.status === 'CONFIRMED' && (
                      <button
                        onClick={() => handleUpdateStatus(booking.id, 'IN_CHAIR')}
                        className="min-h-[40px] rounded-lg border border-[#9E6A03] bg-[#3B2E0B] hover:bg-[#3B2E0B]/80 px-2.5 py-1.5 text-[10px] font-mono font-bold text-[#D29922] transition"
                      >
                        Seat in Chair →
                      </button>
                    )}
                    {booking.status === 'IN_CHAIR' && (
                      <button
                        onClick={() => handleUpdateStatus(booking.id, 'COMPLETED')}
                        className="min-h-[40px] rounded-lg border border-[#116329] bg-[#0D3822] hover:bg-[#0D3822]/80 px-2.5 py-1.5 text-[10px] font-mono font-bold text-[#3FB950] transition"
                      >
                        Mark Done ✓
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Query 8: Barbers & Stylists Staff Management Card (Owner Editable 24/7) */}
            <div className="rounded-2xl border border-[#30363D] bg-[#0D1117] p-4 space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#21262D] pb-3">
                <div className="flex items-center gap-2">
                  <div className="size-8 rounded-lg bg-[#3B2E0B] border border-[#9E6A03] grid place-items-center text-[#D29922]">
                    <Scissors className="size-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-[#F0F6FC] flex items-center gap-2">
                      <span>Manage Barbers &amp; Stylists Staff</span>
                      <span className="rounded-md bg-[#21262D] border border-[#30363D] px-2 py-0.5 text-[10px] font-mono font-bold text-[#06B6D4]">
                        {barbersList.length} Active Staff
                      </span>
                    </h4>
                    <p className="text-[11px] text-[#8B949E] font-sans">
                      Add, edit, or remove your salon barbers. Changes automatically feed into WhatsApp booking assignment and voice dispatch announcements.
                    </p>
                  </div>
                </div>
              </div>

              {/* Barbers Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {barbersList.map((barber, bIdx) => {
                  const isEditing = editingBarberIndex === bIdx;
                  return (
                    <div
                      key={bIdx}
                      className="rounded-xl border border-[#30363D] bg-[#161B22] p-3 flex items-center justify-between gap-2"
                    >
                      {isEditing ? (
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <input
                            type="text"
                            value={editingBarberName}
                            onChange={(e) => setEditingBarberName(e.target.value)}
                            className="min-h-[38px] flex-1 rounded-lg border border-[#06B6D4] bg-[#0D1117] px-2.5 py-1 text-xs text-[#F0F6FC] focus:outline-none"
                            placeholder="Barber name"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveEditBarber(bIdx)}
                            className="min-h-[38px] px-2.5 py-1 rounded-lg bg-[#06B6D4] text-[#0D1117] text-xs font-mono font-bold hover:bg-[#22D3EE] transition"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingBarberIndex(null);
                              setEditingBarberName('');
                            }}
                            className="min-h-[38px] px-2 py-1 rounded-lg border border-[#30363D] text-[#8B949E] hover:text-[#F0F6FC] text-xs font-mono"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="size-6 rounded-md bg-[#21262D] border border-[#30363D] grid place-items-center text-[10px] font-mono font-bold text-[#D29922] shrink-0">
                              #{bIdx + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-[#F0F6FC] truncate">{barber}</p>
                              <span className="text-[10px] font-mono text-[#3FB950] flex items-center gap-1">
                                <span className="size-1.5 rounded-full bg-[#3FB950]" />
                                <span>Chair #{bIdx + 1} · Ready</span>
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingBarberIndex(bIdx);
                                setEditingBarberName(barber);
                              }}
                              className="size-8 grid place-items-center rounded-lg border border-[#30363D] bg-[#0D1117] hover:border-[#06B6D4] text-[#8B949E] hover:text-[#06B6D4] transition"
                              title="Rename Barber"
                            >
                              <Edit2 className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteBarberDashboard(barber)}
                              className="size-8 grid place-items-center rounded-lg border border-[#30363D] bg-[#0D1117] hover:border-[#F85149] text-[#8B949E] hover:text-[#F85149] transition"
                              title="Remove Barber"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Add New Barber Input Form */}
              <form onSubmit={handleAddBarberDashboard} className="flex flex-col sm:flex-row gap-2 pt-1">
                <input
                  type="text"
                  value={newBarberDashboardInput}
                  onChange={(e) => setNewBarberDashboardInput(e.target.value)}
                  placeholder="Enter new barber / stylist name (e.g. Master Kamran or Salman)"
                  className="flex-1 min-h-[44px] rounded-xl border border-[#30363D] bg-[#161B22] px-3.5 py-2 text-xs text-[#F0F6FC] placeholder:text-[#484F58] focus:outline-none focus:border-[#06B6D4]"
                />
                <button
                  type="submit"
                  className="min-h-[44px] rounded-xl bg-[#D29922] hover:bg-[#e0b252] text-[#0D1117] px-4 py-2 text-xs font-mono font-bold uppercase transition flex items-center justify-center gap-1.5 shrink-0"
                >
                  <Plus className="size-4" />
                  <span>+ Add Barber to Staff</span>
                </button>
              </form>
            </div>

            {/* QUERY 5: 2-Hour Pre-Appointment "Are You Coming?" Auto-Check & Waitlist Shield */}
            <div className="rounded-2xl border border-[#116329] bg-[#0D3822]/40 p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-[11px] font-mono font-bold uppercase text-[#3FB950] flex items-center gap-1.5">
                    <Clock className="size-3.5" />
                    <span>2-Hour Auto Check-In &amp; Empty-Chair Waitlist Shield</span>
                  </span>
                  <p className="text-xs text-[#F0F6FC] font-sans mt-0.5">
                    Sends an automatic WhatsApp check 2 hours before every booking. If someone cancels, the open chair is offered to the next waiting client at <strong>100% full standard rate</strong>.
                  </p>
                </div>
                <span className="rounded-lg border border-[#116329] bg-[#0D3822] px-2.5 py-1 text-[10px] font-mono font-bold text-[#3FB950] shrink-0">
                  AUTO-RUNNING ✓
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
                {[
                  { id: 'BK-101', name: 'Bilal Ahmed', slot: '03:30 PM', svc: 'Master Haircut & Skin Fade' },
                  { id: 'BK-103', name: 'Dr. Usman Qureshi', slot: '05:00 PM', svc: 'Charcoal Deep Detox Facial' },
                ].map((item) => {
                  const status = noShowChecks[item.id] || 'PENDING';
                  return (
                    <div
                      key={item.id}
                      className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3 flex flex-col justify-between gap-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-[#F0F6FC]">
                          {item.name} · <span className="font-mono text-[#06B6D4]">{item.slot}</span>
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[9px] font-mono font-bold border ${
                            status === 'CONFIRMED'
                              ? 'border-[#116329] bg-[#0D3822] text-[#3FB950]'
                              : status === 'WAITLIST_FILLED'
                              ? 'border-[#9E6A03] bg-[#3B2E0B] text-[#D29922]'
                              : 'border-[#9E6A03] bg-[#3B2E0B] text-[#D29922]'
                          }`}
                        >
                          {status === 'CONFIRMED'
                            ? 'Client Confirmed Coming ✓'
                            : status === 'WAITLIST_FILLED'
                            ? 'Waitlist Client Seated (Full Rate)'
                            : '2h Ping Awaiting Reply'}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setNoShowChecks((prev) => ({ ...prev, [item.id]: 'CONFIRMED' }));
                            setMaintToast(`✓ ${item.name} confirmed ${item.slot} via 2h WhatsApp check-in.`);
                            setTimeout(() => setMaintToast(null), 4500);
                          }}
                          className="min-h-[40px] rounded-lg border border-[#116329] bg-[#0D3822] hover:bg-[#0D3822]/80 px-2.5 py-1 text-[10px] font-mono font-bold text-[#3FB950] transition"
                        >
                          Client Replied &ldquo;Coming&rdquo;
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setNoShowChecks((prev) => ({ ...prev, [item.id]: 'WAITLIST_FILLED' }));
                            setMaintToast(`Chair auto-offered at 100% full standard rate to Waitlist Client for ${item.slot}.`);
                            setTimeout(() => setMaintToast(null), 5000);
                          }}
                          className="min-h-[40px] rounded-lg border border-[#9E6A03] bg-[#3B2E0B] hover:bg-[#3B2E0B]/80 px-2.5 py-1 text-[10px] font-mono font-bold text-[#D29922] transition"
                        >
                          Cancelled ➔ Auto-Fill Waitlist
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Voice Feed Log */}
            <div className="rounded-2xl border border-[#30363D] bg-[#0D1117] p-4 space-y-2.5">
              <span className="text-[11px] font-mono font-bold uppercase text-[#06B6D4] flex items-center gap-1.5">
                <BellRing className="size-3.5" />
                <span>Cross-Language Voice Log ($0/mo On-Device)</span>
              </span>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {voiceLogs.map((log) => (
                  <div
                    key={log.id}
                    className="rounded-xl border border-[#30363D] bg-[#161B22] p-2.5 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 min-w-0">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[9px] font-mono font-bold shrink-0 border ${
                            log.isUrgent
                              ? 'bg-[#3B2E0B] text-[#D29922] border-[#9E6A03]'
                              : 'bg-[#06B6D4]/15 text-[#06B6D4] border-[#06B6D4]/30'
                          }`}
                        >
                          {log.type === 'BOOKING' ? 'BOOKING' : log.isUrgent ? 'URGENT' : 'CONFIRMED'}
                        </span>
                        <span className="font-bold text-[#F0F6FC] break-words [overflow-wrap:break-word] min-w-0">{log.summary}</span>
                        <span className="text-[10px] font-mono text-[#6E7681] shrink-0">{log.time}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => speakHandsFree(log.spokenText, ownerLang)}
                      className="min-h-[36px] rounded-lg border border-[#30363D] bg-[#21262D] hover:border-[#06B6D4] px-2.5 py-1 text-[10px] font-mono text-[#06B6D4] shrink-0"
                    >
                      🔊 Replay
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </PortalCard>
      )}

      {/* ========================================================================= */}
      {/* 5. TAB 2: RATES, BOT CHAT & IMMUTABLE PROOF (CONSOLIDATED)                */}
      {/* ========================================================================= */}
      {activeTab === 'RATES_BOT' && (
        <div className="space-y-5">
          {/* Separate Service Rates & Menu Editor (Salon Owner Only Edit) */}
          <PortalCard title="Separate Service Rates & WhatsApp Menu" kicker="SALON OWNER ONLY EDIT · END USERS READ-ONLY">
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-sans text-[#8B949E]">
                <p>
                  Every service is listed separately with its individual price. <strong className="text-[#06B6D4]">Only the Salon Owner</strong> can edit or toggle rates—end users can only select services in their booking cart.
                </p>
                <button
                  type="button"
                  onClick={() => setIsAddingCustom(!isAddingCustom)}
                  className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl bg-[#D29922] hover:bg-[#e0b252] text-[#0D1117] px-3.5 py-1.5 text-xs font-mono font-bold uppercase transition shrink-0"
                >
                  <Plus className="size-3.5" />
                  <span>{isAddingCustom ? 'Close' : 'Add Custom Service'}</span>
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
                      price: parseInt(customServicePrice, 10) || 1000,
                      active: true,
                    };
                    setServices((prev) => [...prev, newSvc]);
                    setCustomServiceName('');
                    setCustomServicePrice('1500');
                    setIsAddingCustom(false);
                  }}
                  className="p-3.5 rounded-2xl border border-[#9E6A03] bg-[#0D1117] space-y-3"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      required
                      placeholder="Service Name"
                      value={customServiceName}
                      onChange={(e) => setCustomServiceName(e.target.value)}
                      className="sm:col-span-2 min-h-[48px] rounded-xl border border-[#30363D] bg-[#161B22] px-3.5 py-2 text-xs text-[#F0F6FC] placeholder:text-[#484F58]"
                    />
                    <input
                      type="number"
                      required
                      placeholder={`Price (${regionConfig.currency})`}
                      value={customServicePrice}
                      onChange={(e) => setCustomServicePrice(e.target.value)}
                      className="min-h-[48px] rounded-xl border border-[#30363D] bg-[#161B22] px-3.5 py-2 text-xs font-mono font-bold text-[#D29922] placeholder:text-[#484F58]"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="submit"
                      className="min-h-[44px] px-4 py-1.5 rounded-xl bg-[#D29922] hover:bg-[#e0b252] text-[#0D1117] text-xs font-mono font-bold uppercase"
                    >
                      Save &amp; Sync ✓
                    </button>
                  </div>
                </form>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {services.map((item) => (
                  <div
                    key={item.id}
                    className={`rounded-2xl border p-3 flex items-center justify-between gap-3 transition ${
                      item.active ? 'border-[#30363D] bg-[#161B22]' : 'border-[#21262D] bg-[#0D1117] opacity-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={item.active}
                        onChange={() => handleToggleService(item.id)}
                        className="size-4 rounded shrink-0"
                      />
                      <span className="text-xs font-bold text-[#F0F6FC] truncate">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-mono text-[#8B949E]">{regionConfig.currency}</span>
                      <input
                        type="number"
                        value={item.price}
                        onChange={(e) => handleUpdatePrice(item.id, parseInt(e.target.value, 10) || 0)}
                        className="w-24 min-h-[40px] rounded-lg border border-[#30363D] bg-[#0D1117] px-2.5 py-1 text-xs font-mono font-bold text-[#D29922]"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </PortalCard>

          {/* A. Cross-Language Voice Bridge Simulator (Query 4) */}
          <PortalCard title="Cross-Language Voice Bridge (Client Reply ➔ Owner Voice)" kicker="QUERY 4 · ZERO LANGUAGE BARRIER">
            <div className="space-y-3">
              <p className="text-xs text-[#8B949E] font-sans">
                Clients reply in their chosen language (e.g. Arabic in MENA), the bot responds in their language, and your dashboard translates and speaks the alert aloud in <strong className="text-[#F0F6FC]">your own voice language ({ownerLang.toUpperCase()})</strong>.
              </p>
              <div className="flex flex-wrap gap-2 text-xs font-mono">
                <button
                  type="button"
                  onClick={() =>
                    triggerCrossLanguageClientReply(
                      'Saud Al-Rashid',
                      'ar',
                      '4:00 PM',
                      'CONFIRMED',
                      'نعم، سأحضر الساعة 4 عصراً لحلاقة الشعر واللحية'
                    )
                  }
                  className="min-h-[44px] rounded-xl border border-[#116329] bg-[#0D3822] hover:bg-[#0D3822]/80 px-3 py-1.5 text-[#3FB950] font-bold transition"
                >
                  🔊 MENA Demo: Arabic Client Confirms ➔ Speak in {ownerLang.toUpperCase()}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    triggerCrossLanguageClientReply(
                      'Zain',
                      'ur',
                      '4:30 PM',
                      'DECLINED',
                      'Sorry bhai, aaj nahi aa sakta, kal par shift kar dein.'
                    )
                  }
                  className="min-h-[44px] rounded-xl border border-[#da3633] bg-[#4C1C1D] hover:bg-[#4C1C1D]/80 px-3 py-1.5 text-[#F85149] font-bold transition"
                >
                  🔊 Urgent: Client Reschedules (Urdu ➔ {ownerLang.toUpperCase()})
                </button>
                <button
                  type="button"
                  onClick={() =>
                    triggerCrossLanguageClientReply(
                      'Oliver',
                      'en',
                      '5:15 PM',
                      'LATE',
                      'Running 15 minutes late due to traffic!'
                    )
                  }
                  className="min-h-[44px] rounded-xl border border-[#9E6A03] bg-[#3B2E0B] hover:bg-[#3B2E0B]/80 px-3 py-1.5 text-[#D29922] font-bold transition"
                >
                  🔊 Arrival: Client 15m Late (English ➔ {ownerLang.toUpperCase()})
                </button>
              </div>
            </div>
          </PortalCard>

          {/* B. Regional End-User Chatbot + Multi-Service VIP Deal Cart (Query 5 & 6) */}
          <PortalCard title="End-User WhatsApp Concierge, VIP Deal Rules & Multi-Service Cart" kicker={`QUERY 5 & 6 · REGION: ${regionConfig.regionLabel.toUpperCase()}`}>
            <div className="space-y-4">
              {/* Step 1: Greeting + Region-Locked Language Switcher */}
              <div className="rounded-2xl border border-[#30363D] bg-[#0D1117] p-3.5 space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-[11px] font-mono font-bold text-[#06B6D4] uppercase">
                    1. Client Greeting ("Hi / Assalamu Alaikum / Marhaba") &amp; Regional Language:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {regionConfig.clientLanguages.map((l) => (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => {
                          setEndUserLang(l.id);
                          setIsLanguageConfirmedByClient(true);
                        }}
                        className={`min-h-[40px] rounded-xl border px-3 py-1 text-xs font-mono font-bold transition ${
                          endUserLang === l.id
                            ? 'border-[#06B6D4] bg-[#06B6D4]/20 text-[#06B6D4]'
                            : 'border-[#30363D] bg-[#161B22] text-[#8B949E] hover:text-[#F0F6FC]'
                        }`}
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Step 2: Quick Action Menu ("How can I help you?") */}
                {isLanguageConfirmedByClient && (
                  <div className="pt-2 border-t border-[#21262D] flex flex-wrap items-center gap-2 text-[11px] font-mono">
                    <span className="text-[#8B949E]">
                      {endUserLang === 'ar'
                        ? 'كيف أساعدك؟'
                        : endUserLang === 'ur'
                        ? 'میں آپ کی کیا مدد کر سکتا ہوں؟'
                        : 'How can I help you?'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSendQuickMenuAction('BOOK')}
                      className="min-h-[36px] rounded-lg border border-[#30363D] bg-[#161B22] hover:border-[#06B6D4] px-2.5 py-1 text-[#F0F6FC]"
                    >
                      📅 Book Date &amp; Time
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendQuickMenuAction('RATES')}
                      className="min-h-[36px] rounded-lg border border-[#30363D] bg-[#161B22] hover:border-[#06B6D4] px-2.5 py-1 text-[#F0F6FC]"
                    >
                      ✂️ Services &amp; Rates
                    </button>
                    {currentSalon.planId !== 'STARTER' ? (
                      <button
                        type="button"
                        onClick={() => handleSendQuickMenuAction('DEALS')}
                        className="min-h-[36px] rounded-lg border border-[#9E6A03] bg-[#3B2E0B]/40 hover:border-[#D29922] px-2.5 py-1 text-[#D29922]"
                      >
                        🔥 {endUserLang === 'ur' ? 'VIP ڈیلز' : endUserLang === 'ar' ? 'عروض VIP' : 'Active VIP Deals'}
                      </button>
                    ) : (
                      <span
                        className="min-h-[36px] rounded-lg border border-[#30363D] bg-[#161B22] px-2.5 py-1 text-[#6E7681] text-[10px] font-mono flex items-center gap-1 cursor-not-allowed"
                        title="VIP Deals are exclusive to Growth and VIP tiers"
                      >
                        <Lock className="size-3 text-[#6E7681]" />
                        <span>{endUserLang === 'ur' ? 'معمول کے ریٹس' : endUserLang === 'ar' ? 'أسعار عادية' : 'Standard Rates Only'}</span>
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleSendQuickMenuAction('LOCATION')}
                      className="min-h-[36px] rounded-lg border border-[#116329] bg-[#0D3822] hover:border-[#3FB950] px-2.5 py-1 text-[#3FB950] flex items-center gap-1"
                    >
                      <MapPin className="size-3" />
                      <span>{endUserLang === 'ur' ? 'لوکیشن پن' : endUserLang === 'ar' ? 'موقع الصالون' : 'Location Pin'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendQuickMenuAction('HOURS')}
                      className="min-h-[36px] rounded-lg border border-[#30363D] bg-[#161B22] hover:border-[#06B6D4] px-2.5 py-1 text-[#F0F6FC]"
                    >
                      🕒 {endUserLang === 'ur' ? 'سیلون ٹائمنگ' : endUserLang === 'ar' ? 'ساعات العمل' : 'Salon Timing'}
                    </button>
                  </div>
                )}
              </div>

              {/* Step 3: VIP Deal Day-of-Week & 7-10 Day Validation Engine (Strict Package Gating) */}
              {currentSalon.planId === 'STARTER' ? (
                <div className="rounded-2xl border border-[#9E6A03]/60 bg-[#3B2E0B]/30 p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="size-9 rounded-xl bg-[#3B2E0B] border border-[#9E6A03] grid place-items-center text-[#D29922] shrink-0 mt-0.5">
                        <Lock className="size-4" />
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs font-mono font-bold text-[#D29922] uppercase block">
                          2. VIP Deal Pricing Engine (Locked on Starter Plan)
                        </span>
                        <p className="text-xs text-[#8B949E] font-sans leading-relaxed">
                          Automatic Friday–Sunday weekend deals, dynamic 25% discounts, and continuous 7–10 day promotional campaigns are exclusive to <strong className="text-[#06B6D4]">Growth Automation</strong> and <strong className="text-[#D29922]">VIP Executive</strong> packages. Your salon is currently on <strong className="text-[#F0F6FC]">Starter Setup</strong>.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedUpgradeTargetId('GROWTH');
                        setIsUpgradeModalOpen(true);
                      }}
                      className="min-h-[44px] rounded-xl bg-[#D29922] hover:bg-[#e0b252] text-[#0D1117] px-4 py-2 text-xs font-mono font-black uppercase transition shrink-0 flex items-center justify-center gap-1.5 shadow-lg active:scale-95"
                    >
                      <span>⚡ Upgrade to Unlock Deals →</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-[#9E6A03] bg-[#3B2E0B]/25 p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-mono font-bold text-[#D29922] uppercase block">
                        2. VIP Deal Pricing Engine (Fri–Sun vs Mon–Thu &amp; 7–10 Day Validation)
                      </span>
                      <p className="text-[11px] text-[#8B949E] font-sans mt-0.5">
                        Deals auto-apply on <strong className="text-[#F0F6FC]">Friday, Saturday &amp; Sunday</strong>. Monday–Thursday uses normal rates unless a <strong className="text-[#F0F6FC]">7-to-10 day continuous VIP deal</strong> is active.
                      </p>
                    </div>
                    <span
                      className={`rounded-lg border px-2.5 py-1 text-[10px] font-mono font-bold shrink-0 ${
                        isVipDealActiveNow
                          ? 'border-[#116329] bg-[#0D3822] text-[#3FB950]'
                          : 'border-[#30363D] bg-[#0D1117] text-[#8B949E]'
                      }`}
                    >
                      {pricingRuleBadge}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs font-mono">
                    <div className="flex items-center gap-1.5 rounded-xl bg-[#0D1117] border border-[#30363D] p-1.5">
                      <button
                        type="button"
                        onClick={() => setDayScheduleMode('FRI_SUN_WEEKEND')}
                        className={`min-h-[40px] flex-1 rounded-lg px-2.5 py-1.5 font-bold transition ${
                          dayScheduleMode === 'FRI_SUN_WEEKEND'
                            ? 'bg-[#D29922] text-[#0D1117]'
                            : 'text-[#8B949E] hover:text-[#F0F6FC]'
                        }`}
                      >
                        Fri – Sun (Weekend Deal)
                      </button>
                      <button
                        type="button"
                        onClick={() => setDayScheduleMode('MON_THU_NORMAL')}
                        className={`min-h-[40px] flex-1 rounded-lg px-2.5 py-1.5 font-bold transition ${
                          dayScheduleMode === 'MON_THU_NORMAL'
                            ? 'bg-[#06B6D4] text-[#0D1117]'
                            : 'text-[#8B949E] hover:text-[#F0F6FC]'
                        }`}
                      >
                        Mon – Thu (Normal Days)
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5 rounded-xl bg-[#0D1117] border border-[#30363D] p-1.5">
                      <button
                        type="button"
                        onClick={() => setVipCampaignMode('WEEKEND_ONLY')}
                        className={`min-h-[40px] flex-1 rounded-lg px-2.5 py-1.5 font-bold transition ${
                          vipCampaignMode === 'WEEKEND_ONLY'
                            ? 'bg-[#21262D] text-[#F0F6FC] border border-[#484F58]'
                            : 'text-[#8B949E] hover:text-[#F0F6FC]'
                        }`}
                      >
                        Standard Fri–Sun Deal
                      </button>
                      <button
                        type="button"
                        onClick={() => setVipCampaignMode('CONTINUOUS_7_10_DAYS')}
                        className={`min-h-[40px] flex-1 rounded-lg px-2.5 py-1.5 font-bold transition ${
                          vipCampaignMode === 'CONTINUOUS_7_10_DAYS'
                            ? 'bg-[#0D3822] text-[#3FB950] border border-[#116329]'
                            : 'text-[#8B949E] hover:text-[#F0F6FC]'
                        }`}
                      >
                        7–10 Day VIP Valid Deal
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Multi-Service Picker + Combined Total Confirmation */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div className="space-y-2">
                  <span className="text-[10px] font-mono font-bold text-[#8B949E] uppercase block">
                    {endUserLang === 'ur'
                      ? 'سروسز منتخب کریں (کسٹمر ویو):'
                      : endUserLang === 'ar'
                      ? 'اختر الخدمات المتعددة (عرض العميل):'
                      : 'Select Multiple Services (Client View):'}
                  </span>
                  <div className="space-y-1.5">
                    {services
                      .filter((s) => s.active)
                      .map((svc) => {
                        const checked = selectedCartServiceIds.includes(svc.id);
                        const effectivePrice = Math.round(svc.price * (1 - vipDealDiscountRate));
                        const localizedTitle = getLocalizedServiceName(svc.name, endUserLang);
                        return (
                          <label
                            key={svc.id}
                            className={`min-h-[44px] flex items-center justify-between rounded-xl border px-3 py-2 text-xs cursor-pointer transition ${
                              checked
                                ? 'border-[#06B6D4] bg-[#06B6D4]/10 text-[#F0F6FC]'
                                : 'border-[#30363D] bg-[#0D1117] text-[#8B949E]'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() =>
                                  setSelectedCartServiceIds((prev) =>
                                    prev.includes(svc.id)
                                      ? prev.filter((id) => id !== svc.id)
                                      : [...prev, svc.id]
                                  )
                                }
                                className="size-4 rounded text-[#06B6D4]"
                              />
                              <span className={endUserLang === 'ur' || endUserLang === 'ar' ? 'font-sans' : ''}>
                                {localizedTitle}
                              </span>
                            </span>
                            <span className="font-mono font-bold text-[#D29922]">
                              {isVipDealActiveNow && (
                                <span className="line-through text-[#6E7681] mr-1.5 text-[10px]">
                                  {regionConfig.symbol}{svc.price.toLocaleString()}
                                </span>
                              )}
                              {regionConfig.symbol}{effectivePrice.toLocaleString()}
                            </span>
                          </label>
                        );
                      })}
                  </div>
                </div>

                {/* Summary + Confirm Lock */}
                <div className="rounded-2xl border border-[#30363D] bg-[#0D1117] p-3.5 flex flex-col justify-between space-y-3">
                  <div className="space-y-2">
                    <span className="text-[10px] font-mono font-bold text-[#06B6D4] uppercase block">
                      {endUserLang === 'ur'
                        ? 'کسٹمر کنفرمیشن اور بل ٹوٹل:'
                        : endUserLang === 'ar'
                        ? 'تأكيد الحجز وتفاصيل الفاتورة:'
                        : 'Client Confirmation & Rate Total:'}
                    </span>

                    {/* Preferred Barber Selector in Cart */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-[#8B949E] block">
                        {endUserLang === 'ur'
                          ? 'پسندیدہ باربر منتخب کریں:'
                          : endUserLang === 'ar'
                          ? 'اختر الحلاق المفضل:'
                          : 'Select Preferred Barber / Stylist:'}
                      </label>
                      <select
                        value={selectedCartBarber}
                        onChange={(e) => setSelectedCartBarber(e.target.value)}
                        className="w-full min-h-[42px] rounded-lg border border-[#30363D] bg-[#161B22] px-2.5 py-1 text-xs text-[#F0F6FC] focus:outline-none focus:border-[#06B6D4]"
                      >
                        {barbersList.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Query 3: Multi-Barber Conflict Detection in Cart */}
                    {selectedCartBarber.toLowerCase().includes('tariq') &&
                      (selectedCartSlot === '04:15 PM' || selectedCartSlot === '4:15 PM') && (
                        <div className="rounded-xl bg-[#4C1C1D] border border-[#da3633] p-2.5 text-xs space-y-1.5 animate-in fade-in">
                          <div className="flex items-start gap-1.5 text-[#F85149]">
                            <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                            <span className="text-[11px] leading-tight">
                              {endUserLang === 'ur'
                                ? 'باربر طارق 04:15 PM پر مصروف ہیں۔ باربر علی اس سلاٹ پر فارغ ہیں!'
                                : endUserLang === 'ar'
                                ? 'الحلاق طارق مشغول 04:15 PM. الحلاق علي متاح في هذا الوقت!'
                                : 'Barber Tariq is occupied at 04:15 PM. Barber Ali is free on that slot!'}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const ali =
                                barbersList.find((b) => b.toLowerCase().includes('ali')) || 'Ali Raza';
                              setSelectedCartBarber(ali);
                              setMaintToast(`✓ Switched booking to ${ali} at 04:15 PM.`);
                              setTimeout(() => setMaintToast(null), 4000);
                            }}
                            className="w-full py-1.5 rounded-lg bg-[#3FB950] text-[#0D1117] font-mono font-bold text-xs hover:bg-[#2ea043] transition active:scale-95"
                          >
                            {endUserLang === 'ur'
                              ? 'جی ہاں، باربر علی کے ساتھ 04:15 PM بک کریں ✓'
                              : endUserLang === 'ar'
                              ? 'نعم، احجز مع الحلاق علي في 04:15 PM ✓'
                              : 'Book with Barber Ali at 04:15 PM ✓'}
                          </button>
                        </div>
                      )}

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <input
                        type="text"
                        value={cartClientName}
                        onChange={(e) => setCartClientName(e.target.value)}
                        placeholder={endUserLang === 'ur' ? 'کسٹمر کا نام' : endUserLang === 'ar' ? 'اسم العميل' : 'Client Name'}
                        className="min-h-[44px] rounded-lg border border-[#30363D] bg-[#161B22] px-2.5 py-1.5 text-[#F0F6FC] placeholder:text-[#484F58] text-xs"
                      />
                      <input
                        type="text"
                        value={selectedCartSlot}
                        onChange={(e) => setSelectedCartSlot(e.target.value)}
                        placeholder="Slot e.g. 04:30 PM"
                        className="min-h-[44px] rounded-lg border border-[#30363D] bg-[#161B22] px-2.5 py-1.5 text-[#F0F6FC] placeholder:text-[#484F58] text-xs font-mono"
                      />
                    </div>

                    {/* Query 5: Ambiguous Time Disambiguation in Cart */}
                    {(selectedCartSlot.trim() === '9' || selectedCartSlot.trim().toLowerCase() === 'at 9') && (
                      <div className="rounded-xl bg-[#3B2E0B] border border-[#9E6A03] p-2.5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 animate-in fade-in">
                        <span className="text-[11px] text-[#D29922] font-mono">
                          {endUserLang === 'ur'
                            ? 'کیا آپ کا مطلب 9:00 AM ہے یا 9:00 PM؟'
                            : endUserLang === 'ar'
                            ? 'هل تقصد 9:00 AM أم 9:00 PM؟'
                            : 'Did you mean 9:00 AM or 9:00 PM?'}
                        </span>
                        <div className="flex gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => setSelectedCartSlot('09:00 AM')}
                            className="px-2.5 py-1 rounded-md bg-[#06B6D4] text-[#0D1117] text-[10px] font-mono font-bold hover:bg-[#22D3EE]"
                          >
                            9:00 AM {endUserLang === 'ur' ? '(صبح)' : endUserLang === 'ar' ? '(صباحاً)' : ''}
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedCartSlot('09:00 PM')}
                            className="px-2.5 py-1 rounded-md bg-[#D29922] text-[#0D1117] text-[10px] font-mono font-bold hover:bg-[#e0b252]"
                          >
                            9:00 PM {endUserLang === 'ur' ? '(رات)' : endUserLang === 'ar' ? '(مساءً)' : ''}
                          </button>
                        </div>
                      </div>
                    )}

                    <input
                      type="text"
                      value={cartClientPhone}
                      onChange={(e) => setCartClientPhone(e.target.value)}
                      placeholder={endUserLang === 'ur' ? 'کسٹمر کا واٹس ایپ نمبر' : endUserLang === 'ar' ? 'رقم واتساب العميل' : 'Client WhatsApp Number'}
                      className="w-full min-h-[44px] rounded-lg border border-[#30363D] bg-[#161B22] px-2.5 py-1.5 text-[#F0F6FC] placeholder:text-[#484F58] text-xs font-mono"
                    />

                    <div className="rounded-xl bg-[#161B22] border border-[#30363D] p-2.5 text-xs font-mono space-y-1">
                      <div className="flex justify-between text-[#8B949E]">
                        <span>
                          {endUserLang === 'ur'
                            ? `منتخب سروسز (${selectedCartServices.length}):`
                            : endUserLang === 'ar'
                            ? `الخدمات المختارة (${selectedCartServices.length}):`
                            : `Selected Services (${selectedCartServices.length}):`}
                        </span>
                        <span>{regionConfig.symbol}{cartRawSubtotal.toLocaleString()}</span>
                      </div>
                      {cartDiscountAmount > 0 && (
                        <div className="flex justify-between text-[#3FB950]">
                          <span>
                            {endUserLang === 'ur' ? 'VIP ڈیل ڈسکاؤنٹ (25%):' : endUserLang === 'ar' ? 'خصم عرض VIP (25%):' : 'VIP Deal Discount (25%):'}
                          </span>
                          <span>-{regionConfig.symbol}{cartDiscountAmount.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm font-black text-[#D29922] pt-1 border-t border-[#21262D]">
                        <span>{endUserLang === 'ur' ? 'کل حتمی بل:' : endUserLang === 'ar' ? 'الإجمالي النهائي:' : 'Confirmed Total:'}</span>
                        <span>{regionConfig.symbol}{cartFinalTotal.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={selectedCartServices.length === 0}
                    onClick={handleConfirmEndUserCartBooking}
                    className="w-full min-h-[48px] rounded-xl bg-[#06B6D4] hover:bg-[#22D3EE] text-[#0D1117] py-2.5 text-xs font-mono font-black uppercase transition active:scale-95 disabled:opacity-40"
                  >
                    {endUserLang === 'ur'
                      ? 'اپائنٹمنٹ تصدیق + دائمی ریکارڈ لاک ✓'
                      : endUserLang === 'ar'
                      ? 'تأكيد الحجز + حفظ الفاتورة الدائمة ✓'
                      : 'Confirm Booking + Lock Permanent Proof + Voice Alert ✓'}
                  </button>
                </div>
              </div>

            {/* Chat Thread Preview */}
            <div className="rounded-2xl border border-[#30363D] bg-[#0D1117] p-4 space-y-2.5 max-h-[300px] overflow-y-auto overflow-x-hidden">
              {simChatMessages.map((msg, idx) => {
                const msgIsRtl = /[\u0600-\u06FF]/.test(msg.text);
                const hasLocationLink = msg.text.includes('maps.google.com') || msg.text.includes('📍');
                const hasHoursLink = msg.text.includes('11:00 AM') || msg.text.includes('🕒');
                return (
                  <div
                    key={idx}
                    className={`flex ${msg.sender === 'CLIENT' ? 'justify-start' : 'justify-end'}`}
                  >
                    <div
                      className={`max-w-[85%] min-w-0 rounded-2xl p-3 text-xs leading-relaxed overflow-hidden break-words [overflow-wrap:break-word] space-y-2 ${
                        msg.sender === 'CLIENT'
                          ? 'bg-[#21262D] border border-[#30363D] text-[#F0F6FC]'
                          : 'bg-[#0D3822] border border-[#116329] text-[#3FB950]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3 text-[9px] font-mono opacity-75 mb-1">
                        <span>{msg.sender === 'CLIENT' ? 'Customer' : 'WORKCRAFT Concierge Bot'}</span>
                        <span>{msg.time}</span>
                      </div>
                      <p
                        dir={msgIsRtl ? 'rtl' : 'ltr'}
                        className={`break-words [overflow-wrap:break-word] ${msgIsRtl ? 'text-right' : 'text-left'}`}
                      >
                        {msg.text}
                      </p>

                      {/* Interactive In-Message Quick Action Buttons for Location & Timing */}
                      {hasLocationLink && msg.sender === 'BOT' && (
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => setIsLocationModalOpen(true)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#3FB950] text-[#0D1117] text-[10px] font-mono font-bold hover:bg-[#2ea043] transition shadow-sm"
                          >
                            <MapPin className="size-3" />
                            <span>📍 Open Interactive Map &amp; Navigation</span>
                          </button>
                        </div>
                      )}
                      {hasHoursLink && msg.sender === 'BOT' && (
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => setIsTimingModalOpen(true)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#06B6D4] text-[#0D1117] text-[10px] font-mono font-bold hover:bg-[#22D3EE] transition shadow-sm"
                          >
                            <Clock className="size-3" />
                            <span>🕒 View Weekly Schedule &amp; Prayer Break</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* In-Chat Interactive Prompt: Ambiguous Time Disambiguation */}
              {timeDisambiguationPrompt && (
                <div className="rounded-xl border border-[#9E6A03] bg-[#3B2E0B]/80 p-3 space-y-2 animate-in fade-in">
                  <div className="flex items-center gap-2 text-xs font-mono text-[#D29922]">
                    <Clock className="size-4" />
                    <span>
                      {endUserLang === 'ur'
                        ? 'برائے مہربانی صبح یا شام کا وقت منتخب کریں:'
                        : endUserLang === 'ar'
                        ? 'يرجى تحديد الفترة الصباحية أم المسائية:'
                        : 'Please choose Morning or Evening slot:'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCartSlot('09:00 AM');
                        setTimeDisambiguationPrompt(null);
                        triggerCrossLanguageClientReply(
                          'WhatsApp Client',
                          endUserLang,
                          '09:00 AM',
                          'CONFIRMED',
                          '09:00 AM (Morning / صبح)'
                        );
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#06B6D4] text-[#0D1117] text-xs font-mono font-bold hover:bg-[#22D3EE] transition"
                    >
                      9:00 AM {endUserLang === 'ur' ? '(صبح)' : endUserLang === 'ar' ? '(صباحاً)' : '(Morning)'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCartSlot('09:00 PM');
                        setTimeDisambiguationPrompt(null);
                        triggerCrossLanguageClientReply(
                          'WhatsApp Client',
                          endUserLang,
                          '09:00 PM',
                          'CONFIRMED',
                          '09:00 PM (Night / رات)'
                        );
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#D29922] text-[#0D1117] text-xs font-mono font-bold hover:bg-[#e0b252] transition"
                    >
                      9:00 PM {endUserLang === 'ur' ? '(رات)' : endUserLang === 'ar' ? '(مساءً)' : '(Night)'}
                    </button>
                  </div>
                </div>
              )}

              {/* In-Chat Interactive Prompt: Multi-Barber Conflict Tariq -> Ali */}
              {barberConflictPrompt && (
                <div className="rounded-xl border border-[#116329] bg-[#0D3822]/90 p-3 space-y-2 animate-in fade-in">
                  <div className="flex items-center gap-2 text-xs font-sans text-[#3FB950]">
                    <UserCheck className="size-4" />
                    <span className="font-bold">
                      {endUserLang === 'ur'
                        ? `باربر علی رضا ${barberConflictPrompt.slot} پر دستیاب ہیں:`
                        : endUserLang === 'ar'
                        ? `الحلاق علي رضا متاح في ${barberConflictPrompt.slot}:`
                        : `Barber Ali Raza is ready and available at ${barberConflictPrompt.slot}:`}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCartBarber('Ali Raza');
                        setBarberConflictPrompt(null);
                        triggerCrossLanguageClientReply(
                          'WhatsApp Client',
                          endUserLang,
                          barberConflictPrompt.slot,
                          'CONFIRMED',
                          `Yes, please confirm my booking with Barber Ali Raza at ${barberConflictPrompt.slot}!`
                        );
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#3FB950] text-[#0D1117] text-xs font-mono font-bold hover:bg-[#2ea043] transition active:scale-95 flex items-center gap-1.5"
                    >
                      <Check className="size-3.5" />
                      <span>
                        {endUserLang === 'ur'
                          ? 'جی ہاں، باربر علی کے ساتھ بک کریں ✓'
                          : endUserLang === 'ar'
                          ? 'نعم، احجز مع الحلاق علي ✓'
                          : 'Book with Barber Ali (04:15 PM) ✓'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setBarberConflictPrompt(null)}
                      className="px-2.5 py-1.5 rounded-lg border border-[#30363D] text-[#8B949E] text-xs font-mono hover:text-[#F0F6FC]"
                    >
                      {endUserLang === 'ur' ? 'دوسرا وقت چنیں' : endUserLang === 'ar' ? 'اختيار وقت آخر' : 'Pick Another Slot'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendSimQuery();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={customQuery}
                onChange={(e) => setCustomQuery(e.target.value)}
                placeholder="Type custom client message to test voice translation & permanent log..."
                className="flex-1 min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-4 py-2.5 text-xs text-[#F0F6FC] placeholder:text-[#484F58] focus:outline-none focus:border-[#06B6D4]"
              />
              <button
                type="submit"
                className="min-h-[48px] rounded-xl bg-[#06B6D4] hover:bg-[#22D3EE] text-[#0D1117] px-4 py-2.5 text-xs font-mono font-bold uppercase transition flex items-center gap-1.5"
              >
                <span>Send</span>
                <Send className="size-3.5" />
              </button>
            </form>
          </div>
        </PortalCard>

          {/* C. Immutable Un-Deletable Client Proof Ledger (Query 6) */}
          <PortalCard title="Immutable Client Confirmation Ledger (Cannot Be Deleted by End User)" kicker="PERMANENT SALON AUDIT TRAIL">
            <div className="space-y-2.5">
              <p className="text-xs text-[#8B949E] font-sans">
                Even if a customer deletes WhatsApp messages from their phone, WORKCRAFT permanently locks their confirmed services, applied deal/normal rate, and approval message hash here.
              </p>
              {immutableProofs.map((proof) => (
                <div
                  key={proof.id}
                  className="rounded-2xl border border-[#116329] bg-[#0D3822]/40 p-3.5 space-y-1.5 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 font-mono">
                    <span className="font-bold text-[#3FB950] flex items-center gap-1.5">
                      <FileCheck className="size-4" />
                      <span>
                        {proof.id} · {proof.clientName} ({proof.clientPhone})
                      </span>
                    </span>
                    <span
                      dir="ltr"
                      className="rounded bg-[#0D1117] border border-[#30363D] px-2 py-0.5 text-[10px] text-[#06B6D4] max-w-full overflow-hidden break-all [overflow-wrap:break-word]"
                    >
                      🔒 LOCKED · {proof.hash}
                    </span>
                  </div>
                  <p
                    dir={proof.clientLang === 'ar' || proof.clientLang === 'ur' ? 'rtl' : 'ltr'}
                    className={`text-[#F0F6FC] font-sans overflow-hidden break-words [overflow-wrap:break-word] ${
                      proof.clientLang === 'ar' || proof.clientLang === 'ur' ? 'text-right' : 'text-left'
                    }`}
                  >
                    Confirmed Message ({proof.clientLang.toUpperCase()}): <em>&ldquo;{proof.confirmedMessage}&rdquo;</em>
                  </p>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-[#8B949E] pt-1 border-t border-[#21262D]">
                    <span>
                      Services: {proof.services.join(', ')} · {proof.pricingModeLabel}
                    </span>
                    <span className="text-[#D29922] font-bold">
                      Total: {regionConfig.symbol}{proof.totalAmount.toLocaleString()} · {proof.timestamp}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </PortalCard>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. TAB 3: VIDEO DEALS + FULL-RATE BIRTHDAY & FESTIVAL WISHES (CONSOLIDATED) */}
      {/* ========================================================================= */}
      {activeTab === 'MARKETING' && (
        <div className="space-y-5">
          <PortalCard title="Pay-Per-Deal Video Campaign (4s–9s Ban-Safe)" kicker="ROI · DAY-1 IMPORT · AUTO QA · MENA VOICE">
            <BroadcastTab
              salon={activeSalonProfile}
              contacts={salonContacts}
              ownerLang={ownerLang}
              onShowToast={(msg) => {
                setMaintToast(msg);
                setTimeout(() => setMaintToast(null), 6000);
              }}
            />
          </PortalCard>

          <PortalCard title="Automated Birthday & Festival VIP Wishes (100% Complete Full Rate)" kicker="PRIVATE 1-TO-1 CLIENT RELATIONSHIP · ZERO DISCOUNTS">
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-xs text-[#8B949E] font-sans">
                  Detects saved client birthdays and festival dates, then sends warm personalized greetings from <strong className="text-[#F0F6FC]">{currentSalon.owner} ({currentSalon.name})</strong> in each client's preferred booking language—inviting priority booking at <strong className="text-[#3FB950]">100% complete full standard rates</strong>.
                </p>
                <span className="rounded-xl border border-[#116329] bg-[#0D3822] px-3 py-1.5 text-[11px] font-mono font-bold text-[#3FB950] shrink-0">
                  100% Full Standard Rate Only
                </span>
              </div>

              <div className="space-y-3">
                {celebrations.map((cel) => (
                  <div
                    key={cel.id}
                    className="rounded-2xl border border-[#30363D] bg-[#0D1117] p-4 space-y-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="rounded-lg bg-[#3B2E0B] border border-[#9E6A03] px-2.5 py-1 text-[10px] font-mono font-bold text-[#D29922]">
                          {cel.eventType === 'BIRTHDAY' ? '🎂 BIRTHDAY' : '🌙 FESTIVAL VIP'}
                        </span>
                        <span className="text-sm font-bold text-[#F0F6FC]">{cel.clientName}</span>
                        <span className="text-[11px] font-mono text-[#8B949E]">
                          {cel.phone} · Lang: {cel.preferredLang.toUpperCase()} · {cel.eventDate}
                        </span>
                      </div>

                      {cel.sent ? (
                        <span className="rounded-lg border border-[#116329] bg-[#0D3822] px-3 py-1 text-[11px] font-mono font-bold text-[#3FB950]">
                          ✓ Dispatched via WhatsApp (Full Rate)
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setCelebrations((prev) =>
                              prev.map((item) => (item.id === cel.id ? { ...item, sent: true } : item))
                            );
                            setMaintToast(
                              `Sent full-rate ${cel.eventType} wish to ${cel.clientName} in ${cel.preferredLang.toUpperCase()}.`
                            );
                            setTimeout(() => setMaintToast(null), 5000);
                          }}
                          className="min-h-[44px] rounded-xl bg-[#06B6D4] hover:bg-[#22D3EE] text-[#0D1117] px-3.5 py-1.5 text-xs font-mono font-bold uppercase transition active:scale-95"
                        >
                          Send Wish Now →
                        </button>
                      )}
                    </div>

                    <p
                      dir={cel.preferredLang === 'ar' || cel.preferredLang === 'ur' ? 'rtl' : 'ltr'}
                      className={`rounded-xl border border-[#30363D] bg-[#161B22] p-3 text-xs text-[#F0F6FC] font-sans leading-relaxed overflow-hidden break-words [overflow-wrap:break-word] ${
                        cel.preferredLang === 'ar' || cel.preferredLang === 'ur' ? 'text-right' : 'text-left'
                      }`}
                    >
                      &ldquo;{getCelebrationPreview(cel)}&rdquo;
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </PortalCard>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. TAB 4: GROWTH KIT, WINDOW PDF, GOOGLE REVIEWS & 21D/30D FULL-RATE REBOOK */}
      {/* ========================================================================= */}
      {activeTab === 'GROWTH_KIT' && (
        <div className="space-y-5">
          {/* Private 1-to-1 Rebook Whisper & Weekday Full-Rate Open-Chair Alert (Query 4 & 5) */}
          <PortalCard title="Private 1-to-1 Client Rebook & Weekday Open-Chair Alert" kicker="100% FULL STANDARD RATE · PROTECTS YOUR PRIVATE WHATSAPP MOAT">
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#06B6D4]/40 bg-[#06B6D4]/10 p-3.5 text-xs text-[#F0F6FC] font-sans leading-relaxed">
                WorkCraft privately messages regular clients 1-to-1 on WhatsApp after their natural return window (<strong>21 days</strong> for haircuts / <strong>30 days</strong> for beauty services) at <strong className="text-[#3FB950]">100% complete full standard rates</strong>—bringing them directly back to your booking cart without public social posting.
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  {
                    id: 'rb-1',
                    name: 'Zayd Al-Mansoor',
                    cycle: '21 Days Since Last Skin Fade',
                    lang: 'AR' as const,
                    preview: 'مرحباً زيد! مر ٢١ يوماً على زيارتك الأخيرة — هل ترغب بحجز موعد جديد هذا الأسبوع بالسعر الرسمي؟',
                  },
                  {
                    id: 'rb-2',
                    name: 'Usman Farooq',
                    cycle: '28 Days Since Signature Haircut & Facial',
                    lang: 'UR' as const,
                    preview: 'السلام علیکم عثمان! آپ کی آخری وزٹ کو 4 ہفتے ہو گئے ہیں، مکمل معیاری ریٹ پر اپنی اگلی اپائنٹمنٹ بک کریں۔',
                  },
                ].map((cli) => {
                  const isSent = rebookWhisperSentIds.includes(cli.id);
                  return (
                    <div key={cli.id} className="rounded-2xl border border-[#30363D] bg-[#0D1117] p-3.5 space-y-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="font-bold text-[#F0F6FC]">{cli.name}</p>
                          <p className="text-[10px] font-mono text-[#D29922]">{cli.cycle}</p>
                        </div>
                        <span className="rounded bg-[#21262D] border border-[#30363D] px-2 py-0.5 text-[10px] font-mono text-[#06B6D4]">
                          {cli.lang}
                        </span>
                      </div>
                      <p
                        dir={cli.lang === 'AR' || cli.lang === 'UR' ? 'rtl' : 'ltr'}
                        className={`rounded-xl border border-[#30363D] bg-[#161B22] p-2.5 text-[11px] text-[#F0F6FC] font-sans overflow-hidden break-words [overflow-wrap:break-word] ${
                          cli.lang === 'AR' || cli.lang === 'UR' ? 'text-right' : 'text-left'
                        }`}
                      >
                        &ldquo;{cli.preview}&rdquo;
                      </p>
                      <button
                        type="button"
                        disabled={isSent}
                        onClick={() => {
                          setRebookWhisperSentIds((prev) => [...prev, cli.id]);
                          setMaintToast(`✓ Private 1-to-1 Rebook reminder sent to ${cli.name} at 100% full standard rate.`);
                          setTimeout(() => setMaintToast(null), 5000);
                        }}
                        className={`w-full min-h-[48px] rounded-xl py-2 text-[11px] font-mono font-bold uppercase transition ${
                          isSent
                            ? 'bg-[#0D3822] border border-[#116329] text-[#3FB950] cursor-default'
                            : 'bg-[#06B6D4] hover:bg-[#22D3EE] text-[#0D1117]'
                        }`}
                      >
                        {isSent ? 'Sent 1-to-1 Rebook Whisper ✓' : 'Send Private Rebook Whisper (Full Rate)'}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Slow Weekday Open-Chair Priority Fill (Mon–Thu Full Rate Only) */}
              <div className="rounded-2xl border border-[#9E6A03] bg-[#3B2E0B]/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-mono font-bold uppercase text-[#D29922] block">
                    MON–THU NORMAL WEEKDAY OPEN-CHAIR PRIORITY ALERT (100% FULL RATE)
                  </span>
                  <p className="text-xs text-[#F0F6FC] font-sans mt-0.5">
                    Notify nearby regulars when afternoon chairs are free today at your <strong>100% complete full standard menu price</strong> (zero discounts applied).
                  </p>
                </div>
                <button
                  type="button"
                  disabled={openChairAlertSent}
                  onClick={() => {
                    setOpenChairAlertSent(true);
                    setMaintToast('✓ Open-Chair Priority Alert sent privately to 18 nearby clients at 100% full standard rate.');
                    setTimeout(() => setMaintToast(null), 5000);
                  }}
                  className={`min-h-[48px] rounded-xl px-4 py-2 text-xs font-mono font-bold uppercase shrink-0 transition ${
                    openChairAlertSent
                      ? 'border border-[#116329] bg-[#0D3822] text-[#3FB950]'
                      : 'bg-[#D29922] hover:bg-[#e0b252] text-[#0D1117]'
                  }`}
                >
                  {openChairAlertSent ? '18 Regulars Notified ✓' : 'Alert Regulars (Full Rate)'}
                </button>
              </div>
            </div>
          </PortalCard>

          <PortalCard
            title="Customer Window Poster & Cabin Pamphlet (PDF)"
            kicker="WORKCRAFT LOCAL BRANDED · SALONS & LADIES PARLORS"
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

          <PortalCard title="Google Maps 5-Star Review Booster" kicker="AUTONOMOUS REPUTATION">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-4 rounded-2xl border border-[#30363D] bg-[#0D1117] space-y-2">
                <span className="text-[10px] font-mono text-[#8B949E] uppercase block">Review Trigger Status</span>
                <span className="text-xs font-mono font-bold text-[#3FB950]">
                  {currentSalon.planId === 'STARTER' ? 'Upgrade to Growth or VIP to Unlock' : 'Booster Active (15 Min Delay)'}
                </span>
                <p className="text-[11px] text-[#8B949E] font-sans">
                  Target: Google Maps · {currentSalon.name}, {currentSalon.location}
                </p>
              </div>
              <div className="p-4 rounded-2xl border border-[#30363D] bg-[#0D1117] space-y-2">
                <span className="text-[10px] font-mono text-[#8B949E] uppercase block">Total Reviews Generated</span>
                <p className="text-xl font-bold font-mono text-[#D29922]">31 Verified Reviews</p>
                <p className="text-[11px] text-[#8B949E] font-sans">Average rating: 4.9 / 5.0</p>
              </div>
            </div>
          </PortalCard>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 8. TAB 5: PLAN & 5TH-OF-MONTH 10% MAINTENANCE SLA (CONSOLIDATED)          */}
      {/* ========================================================================= */}
      {activeTab === 'BILLING_SLA' && (
        <PortalCard title="Plan Upgrades & 5th-of-Month 10% Service Fee" kicker="AUTOMATED REMINDERS · 24/7 AUTO-PROTECTION">
          <div className="space-y-5">
            {higherPackages.length > 0 && (
              <div className="rounded-2xl border border-[#9E6A03] bg-[#3B2E0B]/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-mono font-bold text-[#D29922] uppercase block">
                    ACTIVE PLAN: {currentSalon.plan.toUpperCase()}
                  </span>
                  <p className="text-xs text-[#F0F6FC] font-sans mt-0.5">
                    Upgrade any time by paying only the difference from your setup fee—100% credit preserved.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedUpgradeTargetId(higherPackages[0].id);
                    setIsUpgradeModalOpen(true);
                  }}
                  className="min-h-[48px] rounded-xl bg-[#D29922] hover:bg-[#e0b252] text-[#0D1117] px-4 py-2 text-xs font-mono font-black uppercase transition shrink-0"
                >
                  Upgrade Plan (Pay Difference) →
                </button>
              </div>
            )}

            <div className="rounded-2xl border border-[#30363D] bg-[#0D1117] p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs font-mono font-bold text-[#06B6D4] uppercase flex items-center gap-1.5">
                  <Clock className="size-4" />
                  <span>5th-of-Month Reminder Stage Simulator</span>
                </span>
                <span className="text-[10px] font-mono text-[#8B949E]">
                  Owner Onboarding Language: {ownerLang.toUpperCase()}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px] font-mono">
                {[
                  { id: 'PAID_ACTIVE' as const, label: 'Paid (Priority Active)' },
                  { id: 'STAGE_1_PREV_MONTH' as const, label: '1. Prev Month (-2d)' },
                  { id: 'STAGE_2_DAY_3' as const, label: '2. 3rd Reminder' },
                  { id: 'STAGE_3_DAY_5_FINAL' as const, label: '3. 5th Final Warning' },
                  { id: 'OVERDUE_TIER_2' as const, label: '4. Post-5th Overdue' },
                ].map((stage) => (
                  <button
                    key={stage.id}
                    type="button"
                    onClick={() => setMaintCycleStage(stage.id)}
                    className={`min-h-[44px] rounded-xl border px-2.5 py-2 font-bold transition text-center ${
                      maintCycleStage === stage.id
                        ? stage.id === 'OVERDUE_TIER_2'
                          ? 'border-[#da3633] bg-[#4C1C1D] text-[#F85149]'
                          : stage.id === 'STAGE_3_DAY_5_FINAL'
                          ? 'border-[#9E6A03] bg-[#3B2E0B] text-[#D29922]'
                          : 'border-[#06B6D4] bg-[#06B6D4]/15 text-[#06B6D4]'
                        : 'border-[#30363D] bg-[#161B22] text-[#8B949E] hover:text-[#F0F6FC] hover:border-[#484F58]'
                    }`}
                  >
                    {stage.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { stage: 'STAGE_1_PREV_MONTH' as const, title: 'Stage 1 · Last 2 Days of Prev Month' },
                { stage: 'STAGE_2_DAY_3' as const, title: 'Stage 2 · 3rd of Current Month' },
                { stage: 'STAGE_3_DAY_5_FINAL' as const, title: 'Stage 3 · 5th Final Due Warning' },
              ].map((item) => (
                <div
                  key={item.stage}
                  className={`rounded-2xl border p-3.5 space-y-2 ${
                    maintCycleStage === item.stage ? 'border-[#9E6A03] bg-[#3B2E0B]/40' : 'border-[#30363D] bg-[#161B22]'
                  }`}
                >
                  <p className="text-xs font-mono font-bold text-[#D29922]">{item.title}</p>
                  <p
                    dir={ownerLang === 'ar' || ownerLang === 'ur' ? 'rtl' : 'ltr'}
                    className={`text-[11px] text-[#F0F6FC] font-sans rounded-xl bg-[#0D1117] border border-[#30363D] p-2.5 leading-relaxed overflow-hidden break-words [overflow-wrap:break-word] ${
                      ownerLang === 'ar' || ownerLang === 'ur' ? 'text-right' : 'text-left'
                    }`}
                  >
                    {getMaintenanceReminderMessage(item.stage, ownerLang)}
                  </p>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-[#30363D] bg-[#0D1117] p-4 space-y-3 overflow-hidden">
              {isMaintPaid ? (
                <div className="p-4 rounded-xl border border-[#116329] bg-[#0D3822] space-y-1.5 overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                    <span className="text-[#3FB950] font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="size-4 text-[#3FB950] shrink-0" />
                      <span>5th-of-Month Maintenance Paid · Priority Active</span>
                    </span>
                    <span dir="ltr" className="text-[#06B6D4] font-bold break-all [overflow-wrap:break-word]">
                      TID: {maintTid}
                    </span>
                  </div>
                  <p className="text-xs text-[#F0F6FC] font-sans">
                    Verified from {currentSalon.phone} on {maintPaidDate}.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs font-mono">
                  {regionConfig.paymentChannels.map((ch) => (
                    <button
                      key={ch.id}
                      type="button"
                      disabled={isPayingMaint}
                      onClick={() => {
                        setMaintPaymentChannel(ch.id);
                        setIsMaintPaymentModalOpen(true);
                      }}
                      className="min-h-[48px] p-3 rounded-xl border border-[#116329] bg-[#161B22] hover:bg-[#0D3822] text-left transition active:scale-95"
                    >
                      <p className="font-bold text-[#3FB950]">{ch.label}</p>
                      <p className="text-[10px] text-[#8B949E] mt-0.5">{ch.detail}</p>
                      <span className="text-[10px] text-[#D29922] font-bold block mt-1.5">
                        Pay {regionConfig.symbol}{currentSalon.maint.toLocaleString()} →
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </PortalCard>
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

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-mono text-[#8B949E] mb-1">
                  Client Name / Label:
                </label>
                <input
                  type="text"
                  value={walkInName}
                  onChange={(e) => setWalkInName(e.target.value)}
                  placeholder="e.g. Walk-in Guest, Usman, Bilal"
                  className="w-full min-h-[44px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3 text-[#F0F6FC] focus:outline-none focus:border-[#06B6D4]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono text-[#8B949E] mb-1">
                    Assign Barber / Stylist:
                  </label>
                  <select
                    value={walkInBarber}
                    onChange={(e) => setWalkInBarber(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3 text-[#F0F6FC] focus:outline-none focus:border-[#06B6D4]"
                  >
                    {barbersList.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-[#8B949E] mb-1">
                    Phone (Optional for WhatsApp Ticket):
                  </label>
                  <input
                    type="tel"
                    value={walkInPhone}
                    onChange={(e) => setWalkInPhone(e.target.value)}
                    placeholder="+92 300 0000000"
                    className="w-full min-h-[44px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3 text-[#F0F6FC] font-mono focus:outline-none focus:border-[#06B6D4]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-[#8B949E] mb-1">
                  Select Primary Service:
                </label>
                <select
                  value={walkInService}
                  onChange={(e) => {
                    setWalkInService(e.target.value);
                    const matchedSvc = services.find((s) => s.name === e.target.value);
                    if (matchedSvc) setWalkInPrice(matchedSvc.price);
                  }}
                  className="w-full min-h-[44px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3 text-[#F0F6FC] focus:outline-none focus:border-[#06B6D4]"
                >
                  {services
                    .filter((s) => s.active)
                    .map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name} — {regionConfig.symbol}{s.price.toLocaleString()}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-[#8B949E] mb-1">
                  Custom Final Price ({regionConfig.currency}):
                </label>
                <input
                  type="number"
                  value={walkInPrice}
                  onChange={(e) => setWalkInPrice(Number(e.target.value) || 0)}
                  className="w-full min-h-[44px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3 text-[#D29922] font-mono font-bold focus:outline-none focus:border-[#06B6D4]"
                />
              </div>

              <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Scissors className="size-4 text-[#D29922]" />
                  <div>
                    <p className="text-xs font-bold text-[#F0F6FC]">Seat Immediately in Chair?</p>
                    <p className="text-[10px] text-[#8B949E]">Skip waiting queue and begin cutting now</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={walkInImmediateChair}
                  onChange={(e) => setWalkInImmediateChair(e.target.checked)}
                  className="size-4 accent-[#D29922] cursor-pointer"
                />
              </div>

              <div className="rounded-xl border border-[#116329] bg-[#0D3822] p-2.5 text-[11px] font-mono text-[#3FB950] flex items-center gap-2">
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
                className="min-h-[44px] rounded-xl border border-[#30363D] bg-[#0D1117] px-4 py-2 text-xs font-mono text-[#8B949E] hover:text-[#F0F6FC]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveWalkIn}
                className="min-h-[44px] rounded-xl bg-[#D29922] hover:bg-[#e0b252] text-[#0D1117] px-5 py-2 text-xs font-mono font-bold uppercase transition active:scale-95 flex items-center gap-2 shadow-lg"
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
                <span className="text-[#06B6D4]">11:00 AM – 11:00 PM</span>
              </div>
              <div className="flex flex-col p-2.5 rounded-xl bg-[#3B2E0B]/30 border border-[#9E6A03] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[#D29922] font-bold">Friday (Jummah Schedule):</span>
                  <span className="text-[#D29922]">11:00 AM – 11:30 PM</span>
                </div>
                <span className="text-[10px] text-[#F85149] font-sans">
                  ⚠️ Friday Prayer Break: Closed 1:00 PM – 2:30 PM
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#161B22] border border-[#30363D]">
                <span className="text-[#F0F6FC] font-bold">Saturday &amp; Sunday:</span>
                <span className="text-[#3FB950]">10:30 AM – 11:30 PM</span>
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
