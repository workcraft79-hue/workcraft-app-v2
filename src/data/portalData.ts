import { Salon, NotificationItem } from '../types/workcraft';

export const LOGO_URL =
  'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Logo_1080x1080_Transparent-removebg-preview-5mbJ3iqnoAxyGjzoh9Mi5crnBWv566.png';

export const WATERMARK_URL =
  'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Watermark_300x56_Transparent-TiukzFXFvfRuQDpDSWkTnIAkEIxmLx.png';

export type SupportedVoiceLocale = 'ur-PK' | 'ar-AE' | 'en-US';
export type VoiceDialect =
  | 'Roman Urdu (Lahori)'
  | 'Standard Urdu'
  | 'Lahori Punjabi'
  | 'Gulf Arabic'
  | 'English';

export interface VoiceThreadMessageItem {
  id: string;
  senderRole: 'SALON_OWNER' | 'FOUNDER';
  senderLabel: string;
  originalText: string;
  translatedText: string;
  detectedInputLanguage: string;
  targetLocale: SupportedVoiceLocale;
  voiceName?: string;
  audioDataUrl?: string;
  sizeBytes: number;
  createdAtMs: number;
  expiresAtMs: number;
}

export interface VoiceThreadItem {
  id: string;
  serialNumber: string;
  salonId: string;
  ownerName: string;
  salonName: string;
  city: string;
  duration: string;
  receivedAgo: string;
  dialect: VoiceDialect;
  targetLocale: SupportedVoiceLocale;
  unread: boolean;
  transcript: string;
  speechPlayText: string;
  defaultReplySuggestion: string;
  messages: VoiceThreadMessageItem[];
}

export interface LiveUsageMeter {
  monthlyExpenseUsd: number;
  monthlyExpenseLabel: string;
  retentionDays: number;
  targetClipKb: number;
  activeClipCount: number;
  purgedClipCount: number;
  storageUsedBytes: number;
  storageUsedKb: number;
  storageQuotaKb: number;
  storagePercent: number;
  geminiRequestsToday: number;
  geminiDailyLimit: number;
  geminiPercent: number;
  edgeTtsRequestsToday: number;
  usagePercent: number;
  alertThresholdPercent: number;
  alertTriggered: boolean;
  autoAlertWhatsAppSent: boolean;
  autoAlertMessage: string | null;
  lastCleanupAt: string;
}

export const DEFAULT_USAGE_METER: LiveUsageMeter = {
  monthlyExpenseUsd: 0,
  monthlyExpenseLabel: '$0.00 / mo',
  retentionDays: 7,
  targetClipKb: 150,
  activeClipCount: 4,
  purgedClipCount: 0,
  storageUsedBytes: 534 * 1024,
  storageUsedKb: 534,
  storageQuotaKb: 25600,
  storagePercent: 2.0,
  geminiRequestsToday: 2,
  geminiDailyLimit: 1500,
  geminiPercent: 0.1,
  edgeTtsRequestsToday: 2,
  usagePercent: 2.0,
  alertThresholdPercent: 80,
  alertTriggered: false,
  autoAlertWhatsAppSent: false,
  autoAlertMessage: null,
  lastCleanupAt: new Date().toISOString(),
};

export const MONTHLY_REVENUE_SUMMARY = {
  totalCollected: 108000,
  totalCollectedShort: 'PKR 108k verified',
  paidSalonsCount: 24,
  totalSalonsCount: 27,
  pendingDueAmount: 6000,
  pendingSalonsCount: 3,
  setupCollected: 65000,
  setupSalonsCount: 4,
  maintenanceCollected: 43000,
  maintenanceSalonsCount: 20,
  setupPct: 60,
  maintenancePct: 40,
  channels: [
    {
      id: 'bank',
      name: '1. Official Bank Account (IBFT / Raast / Overseas)',
      shortName: 'Official Bank Account (IBFT / Raast / Overseas)',
      amount: 52000,
      pct: '48.1%',
      tag: '48.1% · PRIMARY',
      desc: '11 salons · Local Bank IBFT (PKR 24,000) + Overseas Package & 10% Maint Auto-Deposits (PKR 28,000)',
    },
    {
      id: 'easypaisa',
      name: '2. EasyPaisa (Local Pakistan)',
      shortName: 'EasyPaisa SMS Webhooks (6 Local Salons)',
      amount: 26000,
      pct: '24.1%',
      tag: '24.1%',
      desc: '6 local salons · Instant SMS webhook auto-match',
    },
    {
      id: 'jazzcash',
      name: '3. JazzCash (Local Pakistan)',
      shortName: 'JazzCash SMS Webhook (4 Local Salons)',
      amount: 14000,
      pct: '13.0%',
      tag: '13.0%',
      desc: '4 local salons · Local wallet SMS regex verification',
    },
    {
      id: 'stripe',
      name: '4. Stripe Connect (Overseas 20/80 Split)',
      shortName: 'Stripe Connect Overseas Split (3 Salons → Bank)',
      amount: 16000,
      pct: '14.8%',
      tag: '14.8%',
      desc: '3 overseas salons · 80% net settled into local WorkCraft bank account',
    },
  ],
};

export const INITIAL_VOICE_THREADS: VoiceThreadItem[] = [
  {
    id: 'wc-101',
    serialNumber: '101',
    salonId: 'salon-1',
    ownerName: 'Hamza',
    salonName: 'Seven Cuts Salon',
    city: 'Lahore DHA',
    duration: '0:24',
    receivedAgo: '18m ago',
    dialect: 'Standard Urdu',
    targetLocale: 'ur-PK',
    unread: true,
    transcript:
      '“Salam Farhan bhai, humara weekend video deal upload kiya tha 58 second ka, check kar lein approved hai ke nahi taake blast schedule ho sake.”',
    speechPlayText:
      'السلام علیکم فرحان بھائی، ہمارا ویک اینڈ ویڈیو ڈیل 58 سیکنڈ کا اپلوڈ کیا تھا، چیک کر لیں منظور ہے یا نہیں تاکہ کل صبح بلاسٹ شیڈول ہو سکے۔',
    defaultReplySuggestion:
      'Your 58-second weekend video deal is verified and approved for tomorrow morning broadcast.',
    messages: [],
  },
  {
    id: 'wc-102',
    serialNumber: '102',
    salonId: 'salon-2',
    ownerName: 'Ayesha',
    salonName: 'Noor Beauty Lounge',
    city: 'Karachi Clifton',
    duration: '0:19',
    receivedAgo: '42m ago',
    dialect: 'Standard Urdu',
    targetLocale: 'ur-PK',
    unread: true,
    transcript:
      '“فرائیڈے برائیڈل ڈسکاؤنٹ پیکیج ریٹ سسٹم میں اپڈیٹ ہو گیا ہے؟ کسٹمر پوچھ رہے ہیں۔”',
    speechPlayText:
      'فرائیڈے برائیڈل ڈسکاؤنٹ پیکیج ریٹ سسٹم میں اپڈیٹ ہو گیا ہے؟ کسٹمر پوچھ رہے ہیں۔',
    defaultReplySuggestion:
      'Yes Ayesha, your Friday bridal discount package rates are updated and live in WhatsApp.',
    messages: [],
  },
  {
    id: 'wc-103',
    serialNumber: '103',
    salonId: 'salon-3',
    ownerName: 'Bilal',
    salonName: 'The Groom Room',
    city: 'Islamabad F-7',
    duration: '0:21',
    receivedAgo: '1h ago',
    dialect: 'Standard Urdu',
    targetLocale: 'ur-PK',
    unread: false,
    transcript:
      '“Assalamu Alaikum sir, sade 2 barbers de slot timings update karanay si Friday layi, system vich save ho jange?”',
    speechPlayText:
      'السلام علیکم سر، ہمارے دو باربرز کے فرائیڈے سلاٹ ٹائمنگز اپڈیٹ کرنے تھے، کیا سسٹم میں سیو ہو جائیں گے؟',
    defaultReplySuggestion:
      'Yes Bilal, update both barber schedules inside Manage -> Staff & Barbers and slots sync automatically.',
    messages: [],
  },
  {
    id: 'wc-104',
    serialNumber: '104',
    salonId: 'salon-4',
    ownerName: 'Tareq',
    salonName: 'Elite Grooming',
    city: 'Dubai Marina, UAE',
    duration: '0:27',
    receivedAgo: '2h ago',
    dialect: 'Gulf Arabic',
    targetLocale: 'ar-AE',
    unread: false,
    transcript:
      '“مرحباً، هل تم تفعيل عرض نهاية الأسبوع لباقة VIP في الرد التلقائي على واتساب؟”',
    speechPlayText:
      'مرحباً، هل تم تفعيل عرض نهاية الأسبوع لباقة VIP في الرد التلقائي على واتساب؟',
    defaultReplySuggestion:
      'Hello Tareq, your weekend VIP deal is verified and live in WhatsApp auto-replies now.',
    messages: [],
  },
];

export const SALONS: Salon[] = [
  {
    name: 'Seven Cuts Salon',
    owner: 'Hamza',
    location: 'Lahore',
    status: 'Pending',
    plan: 'PKR 1,500 (Starter)',
    initials: 'SC',
  },
  {
    name: 'Noor Beauty Lounge',
    owner: 'Ayesha',
    location: 'Karachi',
    status: 'Paid',
    plan: 'PKR 2,000 (Growth)',
    initials: 'NB',
  },
  {
    name: 'The Groom Room',
    owner: 'Bilal',
    location: 'Islamabad',
    status: 'Paid',
    plan: 'PKR 2,500 (VIP)',
    initials: 'GR',
  },
];

export const ARCHIVED_SALONS = [
  { name: 'Elite Cuts Gulberg', owner: 'Zubair', status: 'Archived', plan: 'PKR 1,500 (Starter)' },
  { name: 'Sultan Barber DHA', owner: 'Taimoor', status: 'Archived', plan: 'PKR 2,000 (Growth)' },
  { name: 'Karachi Grooming Hub', owner: 'Farhan', status: 'Archived', plan: 'PKR 2,500 (VIP)' },
  { name: 'Islamabad Fade Studio', owner: 'Rehan', status: 'Archived', plan: 'PKR 2,000 (Growth)' },
];

export const NOTIFICATIONS: NotificationItem[] = [
  {
    title: 'Payment notification',
    description: 'EasyPaisa receipt matched for Noor Beauty Lounge',
    time: '2 min ago',
  },
  {
    title: 'Voice support',
    description: 'Seven Cuts Salon sent a private voice support note',
    time: '18 min ago',
  },
  {
    title: 'System alert',
    description: '3 salons enter the maintenance window today',
    time: '1 hr ago',
  },
];
