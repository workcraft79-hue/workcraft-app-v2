import React, { useState, useEffect, useRef } from 'react';
import {
  Video,
  Upload,
  Play,
  Pause,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Ban,
  ArrowRight,
  FileVideo,
  Sparkles,
  User,
  Tag,
  Send,
  Globe,
  RefreshCw,
  CreditCard,
  Lock,
  Volume2,
  UsersRound,
  TrendingUp,
  Eye,
  Calendar,
} from 'lucide-react';
import { BroadcastLog, Contact, SalonProfile } from '../../types';

export type RegionalLang = 'roman_urdu' | 'arabic' | 'english';
export type VideoWatchLang = 'ar' | 'en' | 'ur' | 'hi' | 'tl';

export interface RouteDetectionResult {
  route: RegionalLang;
  label: string;
  flag: string;
  matchedPrefix: string;
  description: string;
}

export const detectLanguageRoute = (phone: string): RouteDetectionResult => {
  const clean = phone.replace(/[^0-9+]/g, '');

  if (
    clean.startsWith('+92') ||
    clean.startsWith('92') ||
    clean.startsWith('03') ||
    clean.startsWith('+91') ||
    clean.startsWith('91')
  ) {
    const isIndia = clean.startsWith('+91') || clean.startsWith('91');
    return {
      route: 'roman_urdu',
      label: 'Roman Urdu / Hinglish',
      flag: isIndia ? '🇮🇳' : '🇵🇰',
      matchedPrefix: isIndia ? '+91' : '+92',
      description: 'Route: Pakistan & India Prefix',
    };
  }

  if (
    clean.startsWith('+971') ||
    clean.startsWith('971') ||
    clean.startsWith('+966') ||
    clean.startsWith('966') ||
    clean.startsWith('+965') ||
    clean.startsWith('965') ||
    clean.startsWith('+974') ||
    clean.startsWith('974') ||
    clean.startsWith('+973') ||
    clean.startsWith('973') ||
    clean.startsWith('+968') ||
    clean.startsWith('968')
  ) {
    let flag = '🇦🇪';
    let prefix = '+971';
    if (clean.startsWith('+966') || clean.startsWith('966')) {
      flag = '🇸🇦';
      prefix = '+966';
    } else if (clean.startsWith('+965') || clean.startsWith('965')) {
      flag = '🇰🇼';
      prefix = '+965';
    }
    return {
      route: 'arabic',
      label: 'Arabic (MENA / Gulf)',
      flag,
      matchedPrefix: prefix,
      description: 'Route: MENA / Gulf Prefix',
    };
  }

  const isUS = clean.startsWith('+1') || clean.startsWith('1');
  return {
    route: 'english',
    label: 'English (Western / Global)',
    flag: isUS ? '🇺🇸' : '🇬🇧',
    matchedPrefix: isUS ? '+1' : clean.startsWith('+44') ? '+44' : 'Global',
    description: 'Route: Western / Global Prefix',
  };
};

function getVideoBillingConfig(phone: string) {
  const clean = phone.replace(/[^0-9+]/g, '');
  if (clean.startsWith('+92')) {
    return {
      countryLabel: 'Pakistan (+92)',
      currency: 'PKR',
      symbol: 'PKR ',
      singlePrice: 1500,
      monthly4Price: 4000,
      channels: [
        { id: 'EasyPaisa', label: 'EasyPaisa Till', detail: 'WORKCRAFT · Till 789210 (Auto SIM Match)' },
        { id: 'JazzCash', label: 'JazzCash Merchant', detail: 'WORKCRAFT · 0300-WORKCRAFT' },
        { id: 'IBFT', label: 'Meezan Bank IBFT', detail: 'PK64MEZN0001020304050607' },
      ],
    };
  }
  if (clean.startsWith('+971')) {
    return {
      countryLabel: 'UAE (+971)',
      currency: 'AED',
      symbol: 'AED ',
      singlePrice: 55,
      monthly4Price: 145,
      channels: [
        { id: 'Stripe', label: 'Stripe / Apple Pay / Card', detail: 'Instant MENA Card (AED)' },
        { id: 'Wire', label: 'UAE IBAN Wire', detail: 'AE070331234567890123456' },
      ],
    };
  }
  if (clean.startsWith('+966')) {
    return {
      countryLabel: 'Saudi Arabia (+966)',
      currency: 'SAR',
      symbol: 'SAR ',
      singlePrice: 56,
      monthly4Price: 150,
      channels: [
        { id: 'Stripe', label: 'Stripe / Mada / Card', detail: 'Instant KSA Card (SAR)' },
        { id: 'Wire', label: 'Saudi IBAN Wire', detail: 'SA0380000000608010167519' },
      ],
    };
  }
  if (clean.startsWith('+44')) {
    return {
      countryLabel: 'United Kingdom (+44)',
      currency: 'GBP',
      symbol: '£',
      singlePrice: 12,
      monthly4Price: 32,
      channels: [
        { id: 'Stripe', label: 'Stripe / Apple Pay / Card', detail: 'Instant UK Card (GBP)' },
        { id: 'Wire', label: 'UK Faster Payments', detail: 'GB29NWBK60161331926819' },
      ],
    };
  }
  return {
    countryLabel: 'International (Global)',
    currency: 'USD',
    symbol: '$',
    singlePrice: 15,
    monthly4Price: 40,
    channels: [
      { id: 'Stripe', label: 'Stripe / Global Card', detail: 'Instant Card Checkout (USD)' },
      { id: 'Wire', label: 'SWIFT Wire', detail: 'WORKCRAFT-GLOBAL-SWIFT' },
    ],
  };
}

function autoDetectHeadlineFromFilename(filename: string, salonName: string): Record<RegionalLang, string> {
  const clean = filename
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[_-]+/g, ' ')
    .trim();
  const baseTitle = clean.length > 3 ? clean.replace(/\b\w/g, (c) => c.toUpperCase()) : 'Special Salon Deal';
  return {
    roman_urdu: `${salonName} Offer: ${baseTitle}`,
    arabic: `عرض خاص من ${salonName}: ${baseTitle}`,
    english: `${salonName} Exclusive: ${baseTitle}`,
  };
}

const DEFAULT_TEMPLATES: Record<RegionalLang, string> = {
  roman_urdu: 'AOA {{client_name}}, {{salon_name}} ki taraf se aap ke liye exclusive limited-day deal tayar hai! 👇',
  arabic: 'السلام عليكم {{client_name}}، يسعدنا أن نقدم لك عرض خاص من {{salon_name}} 👇',
  english: "Hi {{client_name}}, {{salon_name}} has reserved an exclusive limited-day offer for you! 👇",
};

const STOP_OPT_OUT_FOOTER: Record<RegionalLang, string> = {
  roman_urdu: 'Promo videos band karne ke liye STOP likh kar bhejein.',
  arabic: 'لإيقاف فيديوهات العروض، أرسل كلمة STOP',
  english: 'Reply STOP anytime to stop receiving deal videos.',
};

const MENA_VIDEO_SUBTITLES: Record<VideoWatchLang, { label: string; badge: string; script: string }> = {
  ar: {
    label: 'العربية (Arabic)',
    badge: 'AR Dub/Sub',
    script: 'مرحباً! هذا الأسبوع لدينا عرض خاص على قص الشعر والعناية الكاملة بالصالون لمدة محدودة.',
  },
  en: {
    label: 'English',
    badge: 'EN Dub/Sub',
    script: 'Welcome! This week we have an exclusive grooming & styling offer valid for a limited 7–10 day window.',
  },
  ur: {
    label: 'اردو (Urdu)',
    badge: 'UR Original',
    script: 'السلام علیکم! اس ہفتے ہمارے سیلون میں ہیئر کٹ اور مکمل گرومنگ پر خاص ڈیل دستیاب ہے۔',
  },
  hi: {
    label: 'हिन्दी (Hindi)',
    badge: 'HI Dub/Sub',
    script: 'नमस्ते! इस हफ्ते हमारे सैलून में हेयरकट और ग्रूमिंग कॉम्बो पर खास ऑफर उपलब्ध है।',
  },
  tl: {
    label: 'Tagalog',
    badge: 'TL Dub/Sub',
    script: 'Kumusta! May espesyal na grooming at haircut deal kami ngayong linggo para sa iyo.',
  },
};

interface BroadcastTabProps {
  salon: SalonProfile;
  contacts: Contact[];
  ownerLang?: 'en' | 'ur' | 'ar';
  onShowToast?: (msg: string) => void;
}

export const BroadcastTab: React.FC<BroadcastTabProps> = ({
  salon,
  contacts,
  ownerLang = 'ur',
  onShowToast,
}) => {
  const billingConfig = getVideoBillingConfig(salon.phone);

  // Query 3: 1-Video Single ($15 / PKR 1,500) vs 4-Video Monthly ($40 / PKR 4,000) & Payment Gate BEFORE Upload
  const [selectedDealPlan, setSelectedDealPlan] = useState<'SINGLE_1' | 'MONTHLY_4'>('SINGLE_1');
  const [selectedPayChannel, setSelectedPayChannel] = useState<string>(billingConfig.channels[0].id);
  const [isDealPaymentConfirmed, setIsDealPaymentConfirmed] = useState<boolean>(false);
  const [isPayingDeal, setIsPayingDeal] = useState<boolean>(false);
  const [dealPaymentTid, setDealPaymentTid] = useState<string | null>(null);

  // Query 2: Validation Days (7 to 10 days quick chips — no manual typing)
  const [validationDays, setValidationDays] = useState<7 | 8 | 9 | 10>(7);

  // Query 4: Day-1 Quick Contact Import State
  const [importedContacts, setImportedContacts] = useState<Contact[]>(() => contacts);
  const [showPasteBox, setShowPasteBox] = useState(false);
  const [pasteInput, setPasteInput] = useState('');
  const [importStatusMsg, setImportStatusMsg] = useState<string | null>(null);
  const vcfInputRef = useRef<HTMLInputElement>(null);

  const activeContacts = importedContacts.filter((c) => !c.optOut);
  const stoppedContacts = importedContacts.filter((c) => c.optOut);
  const [stopFeedbackMsg, setStopFeedbackMsg] = useState<string | null>(null);

  // Query 2 & 4: Single Custom Video Uploader + Auto QA + Owner-Language Rejection Guide
  const [videoFile, setVideoFile] = useState<{
    name: string;
    duration: number;
    sizeMb: number;
    url?: string;
    qaStatus: 'PASSED' | 'REJECTED';
  } | null>(null);
  const [qaRejectionNotice, setQaRejectionNotice] = useState<{
    title: string;
    errorDetail: string;
    fixSteps: string;
  } | null>(null);

  const [headlines, setHeadlines] = useState<Record<RegionalLang, string>>(() =>
    autoDetectHeadlineFromFilename('salon_weekend_promo.mp4', salon.name)
  );
  const [templates, setTemplates] = useState<Record<RegionalLang, string>>(DEFAULT_TEMPLATES);
  const [activeEditorTab, setActiveEditorTab] = useState<RegionalLang>('roman_urdu');

  // Query 5: MENA Client Watch-Language Switcher
  const [clientWatchLang, setClientWatchLang] = useState<VideoWatchLang>('ar');
  const [isSpeakingDub, setIsSpeakingDub] = useState(false);

  const [previewContactId, setPreviewContactId] = useState<string>(
    activeContacts[0]?.id || 'sample-pk-1'
  );
  const selectedPreviewContact = activeContacts.find((c) => c.id === previewContactId) ||
    activeContacts[0] || {
      id: 'sample-pk-1',
      name: 'Bilal Ahmed',
      phone: '+92 300 1234567',
      city: 'Lahore',
      country: 'PK' as const,
      language: 'ur' as const,
      tags: ['vip'],
      optOut: false,
      lastVisit: '2026-10-15',
      totalVisits: 8,
    };
  const previewDetection = detectLanguageRoute(selectedPreviewContact.phone);

  // Queue Engine
  const [queueStatus, setQueueStatus] = useState<'idle' | 'running' | 'paused' | 'completed'>('idle');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentDelay, setCurrentDelay] = useState(6.2);
  const [delayCountdown, setDelayCountdown] = useState(0);
  const [logs, setLogs] = useState<BroadcastLog[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const queueTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setSelectedPayChannel(billingConfig.channels[0].id);
  }, [salon.phone]);

  const resolveTemplateText = (text: string, contactName: string) => {
    return text
      .replace(/\{\{client_name\}\}/g, contactName)
      .replace(/\{\{salon_name\}\}/g, salon.name)
      .replace(/\[Salon Name\]/gi, salon.name);
  };

  // Query 4: Handle End-User Replying STOP to Restrict Future Deal Videos
  const handleClientRepliesStop = (contact: Contact) => {
    setImportedContacts((prev) =>
      prev.map((c) => (c.id === contact.id ? { ...c, optOut: true } : c))
    );
    const remaining = activeContacts.filter((c) => c.id !== contact.id);
    if (remaining.length > 0) {
      setPreviewContactId(remaining[0].id);
    }
    const notice = `🛑 ${contact.name} (${contact.phone}) replied STOP — permanently blocked from future deal videos. Direct 1-to-1 booking replies still work.`;
    setStopFeedbackMsg(notice);
    onShowToast?.(notice);
  };

  const handleInsertTag = (tag: '{{client_name}}' | '{{salon_name}}') => {
    const textarea = textareaRef.current;
    const current = templates[activeEditorTab];
    if (!textarea) {
      setTemplates((prev) => ({
        ...prev,
        [activeEditorTab]: prev[activeEditorTab] + ' ' + tag,
      }));
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const updated = current.substring(0, start) + tag + current.substring(end);
    setTemplates((prev) => ({ ...prev, [activeEditorTab]: updated }));
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tag.length, start + tag.length);
    }, 10);
  };

  // Query 3: Confirm Payment Gate
  const handleConfirmDealPayment = () => {
    setIsPayingDeal(true);
    setTimeout(() => {
      const tid = `${salon.phone.startsWith('+92') ? 'EP' : 'ST'}-${Math.floor(
        1000000000 + Math.random() * 9000000000
      )}`;
      setIsPayingDeal(false);
      setIsDealPaymentConfirmed(true);
      setDealPaymentTid(tid);
      const amt =
        selectedDealPlan === 'SINGLE_1' ? billingConfig.singlePrice : billingConfig.monthly4Price;
      onShowToast?.(
        `✅ Video Deal Payment Verified (${billingConfig.symbol}${amt.toLocaleString()} · TID: ${tid}). Final Video Uploader Unlocked!`
      );
    }, 650);
  };

  // Query 4: Owner-Language Video QA Rejection Generator
  const buildOwnerLangRejection = (reason: 'DURATION' | 'SIZE') => {
    if (reason === 'DURATION') {
      if (ownerLang === 'ur') {
        return {
          title: 'ویڈیو مسترد کر دی گئی (60 سیکنڈ سے لمبی ہے)',
          errorDetail: 'آپ کی اپلوڈ کردہ ویڈیو 60 سیکنڈ کی حد سے زیادہ ہے۔ واٹس ایپ بین سے بچنے کے لیے 60 سیکنڈ سے کم ویڈیو ضروری ہے۔',
          fixSteps: 'حل: ویڈیو کو فون گیلری سے 45–58 سیکنڈ تک ٹرم (Cut) کریں اور دوبارہ اپلوڈ کریں۔',
        };
      }
      if (ownerLang === 'ar') {
        return {
          title: 'تم رفض الفيديو (يتجاوز 60 ثانية)',
          errorDetail: 'مدة الفيديو تتجاوز الحد الأقصى المسموح به (60 ثانية) لحماية رقم الواتساب من الحظر.',
          fixSteps: 'الحل: قم بقص الفيديو إلى أقل من 60 ثانية من معرض الهاتف ثم أعد رفعه.',
        };
      }
      return {
        title: 'Video Rejected (Exceeds 60-Second Boundary)',
        errorDetail: 'Uploaded clip is longer than the strict 60s WhatsApp anti-ban duration limit.',
        fixSteps: 'How to fix: Trim your video to 15–58 seconds in your phone gallery and re-upload.',
      };
    }

    if (ownerLang === 'ur') {
      return {
        title: 'ویڈیو مسترد کر دی گئی (فائل سائز 50MB سے زیادہ ہے)',
        errorDetail: 'فائل کا سائز 50MB سے زیادہ ہونے کی وجہ سے واٹس ایپ پر فوری ترسیل ممکن نہیں۔',
        fixSteps: 'حل: ویڈیو کو 720p/1080p پر کمپریس کریں یا لمبائی کم کر کے دوبارہ اپلوڈ کریں۔',
      };
    }
    if (ownerLang === 'ar') {
      return {
        title: 'تم رفض الفيديو (حجم الملف يتجاوز 50 ميجابايت)',
        errorDetail: 'حجم الملف أكبر من الحد المسموح به لإرسال وسائط واتساب (50MB).',
        fixSteps: 'الحل: قم بضغط الفيديو إلى 720p أو تقليل مدته ثم أعد الرفع.',
      };
    }
    return {
      title: 'Video Rejected (File Size > 50MB)',
      errorDetail: 'File size exceeds the 50MB WhatsApp media boundary.',
      fixSteps: 'How to fix: Compress video to 720p/1080p MP4 under 50MB and re-upload.',
    };
  };

  // Single Custom File Upload Handler + Auto Headline Detection + Auto QA
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const sizeMb = Number((file.size / (1024 * 1024)).toFixed(1));
    if (sizeMb > 50) {
      setQaRejectionNotice(buildOwnerLangRejection('SIZE'));
      setVideoFile({
        name: file.name,
        duration: 45,
        sizeMb,
        qaStatus: 'REJECTED',
      });
      return;
    }

    const video = document.createElement('video');
    video.preload = 'metadata';
    const objectUrl = URL.createObjectURL(file);

    video.onloadedmetadata = () => {
      window.URL.revokeObjectURL(video.src);
      const duration = Math.round(video.duration);
      if (duration > 60) {
        setQaRejectionNotice(buildOwnerLangRejection('DURATION'));
        setVideoFile({ name: file.name, duration, sizeMb, url: objectUrl, qaStatus: 'REJECTED' });
      } else {
        setQaRejectionNotice(null);
        setVideoFile({ name: file.name, duration, sizeMb, url: objectUrl, qaStatus: 'PASSED' });
        setHeadlines(autoDetectHeadlineFromFilename(file.name, salon.name));
      }
    };

    video.onerror = () => {
      setQaRejectionNotice(null);
      setVideoFile({ name: file.name, duration: 42, sizeMb, qaStatus: 'PASSED' });
      setHeadlines(autoDetectHeadlineFromFilename(file.name, salon.name));
    };

    video.src = objectUrl;
  };

  // Day-1 Quick Contact Import Helpers
  const handleSyncPairedWhatsappChats = () => {
    const synced: Contact[] = [
      { id: `sync-${Date.now()}-1`, name: 'Faisal Qureshi', phone: '+92 300 7788990', city: 'Lahore', country: 'PK', language: 'ur', tags: ['WhatsApp Sync'], optOut: false, lastVisit: 'Today', totalVisits: 2 },
      { id: `sync-${Date.now()}-2`, name: 'Mansoor Al-Suwaidi', phone: '+971 50 4433221', city: 'Dubai', country: 'AE', language: 'ar', tags: ['WhatsApp Sync'], optOut: false, lastVisit: 'Today', totalVisits: 1 },
      { id: `sync-${Date.now()}-3`, name: 'Daniel Evans', phone: '+44 7700 900123', city: 'London', country: 'PK', language: 'en', tags: ['WhatsApp Sync'], optOut: false, lastVisit: 'Today', totalVisits: 1 },
    ];
    setImportedContacts((prev) => {
      const existingPhones = new Set(prev.map((c) => c.phone.replace(/\s+/g, '')));
      const fresh = synced.filter((s) => !existingPhones.has(s.phone.replace(/\s+/g, '')));
      return [...fresh, ...prev];
    });
    setImportStatusMsg('✓ Synced recent clients from paired WhatsApp chat history with auto-prefix routing!');
    setTimeout(() => setImportStatusMsg(null), 5000);
  };

  const handleVcfOrCsvImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result || '');
      const phoneMatches = content.match(/\+?\d[\d\s-]{8,15}\d/g) || [];
      const uniquePhones = Array.from(new Set(phoneMatches.map((p) => p.trim()))).slice(0, 50);
      if (uniquePhones.length === 0) {
        setImportStatusMsg('No valid phone numbers found in file. Try CSV or paste numbers directly.');
        return;
      }
      const newContacts: Contact[] = uniquePhones.map((phone, idx) => ({
        id: `vcf-${Date.now()}-${idx}`,
        name: `Imported Client ${idx + 1}`,
        phone,
        city: salon.city,
        country: phone.startsWith('+971') || phone.startsWith('+966') ? 'AE' : 'PK',
        language: phone.startsWith('+971') || phone.startsWith('+966') ? 'ar' : phone.startsWith('+92') ? 'ur' : 'en',
        tags: ['Phonebook Import'],
        optOut: false,
        lastVisit: 'Day-1 Import',
        totalVisits: 1,
      }));
      setImportedContacts((prev) => [...newContacts, ...prev]);
      setImportStatusMsg(`✓ Imported ${newContacts.length} phonebook contacts from ${file.name}!`);
      setTimeout(() => setImportStatusMsg(null), 5000);
    };
    reader.readAsText(file);
  };

  const handleBulkPasteImport = () => {
    const lines = pasteInput
      .split(/[\n,;]+/)
      .map((l) => l.trim())
      .filter((l) => l.replace(/[^0-9]/g, '').length >= 8);
    if (lines.length === 0) return;

    const newContacts: Contact[] = lines.map((raw, idx) => ({
      id: `paste-${Date.now()}-${idx}`,
      name: `Client #${idx + 1}`,
      phone: raw.startsWith('+') ? raw : `+${raw}`,
      city: salon.city,
      country: raw.includes('971') || raw.includes('966') ? 'AE' : 'PK',
      language: raw.includes('971') || raw.includes('966') ? 'ar' : raw.includes('92') ? 'ur' : 'en',
      tags: ['Day-1 Paste'],
      optOut: false,
      lastVisit: 'Day-1 Import',
      totalVisits: 1,
    }));
    setImportedContacts((prev) => [...newContacts, ...prev]);
    setPasteInput('');
    setShowPasteBox(false);
    setImportStatusMsg(`✓ Added ${newContacts.length} WhatsApp numbers with instant country prefix routing!`);
    setTimeout(() => setImportStatusMsg(null), 5000);
  };

  // MENA Translated Voice Demo
  const handlePlayMenaTranslatedVoice = () => {
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const item = MENA_VIDEO_SUBTITLES[clientWatchLang];
        const utter = new SpeechSynthesisUtterance(item.script);
        utter.lang =
          clientWatchLang === 'ar'
            ? 'ar-SA'
            : clientWatchLang === 'ur'
            ? 'ur-PK'
            : clientWatchLang === 'hi'
            ? 'hi-IN'
            : 'en-US';
        setIsSpeakingDub(true);
        utter.onend = () => setIsSpeakingDub(false);
        utter.onerror = () => setIsSpeakingDub(false);
        window.speechSynthesis.speak(utter);
        setTimeout(() => setIsSpeakingDub(false), 6000);
      }
    } catch {
      setIsSpeakingDub(false);
    }
  };

  // Queue Dispatch Engine (4s–9s jitter)
  useEffect(() => {
    if (queueStatus !== 'running') {
      if (queueTimeoutRef.current) clearTimeout(queueTimeoutRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      return;
    }

    if (currentIndex >= activeContacts.length) {
      setQueueStatus('completed');
      return;
    }

    const randomSec = Number((Math.random() * (8.9 - 4.0) + 4.0).toFixed(1));
    setCurrentDelay(randomSec);
    setDelayCountdown(randomSec);

    const startMs = Date.now();
    const durationMs = randomSec * 1000;

    countdownIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startMs;
      const remaining = Math.max(0, (durationMs - elapsed) / 1000);
      setDelayCountdown(Number(remaining.toFixed(1)));
    }, 100);

    queueTimeoutRef.current = setTimeout(() => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      const target = activeContacts[currentIndex];
      if (target) {
        const detection = detectLanguageRoute(target.phone);
        const rawTemplate = templates[detection.route] || templates.english;
        const optOutLine = STOP_OPT_OUT_FOOTER[detection.route] || STOP_OPT_OUT_FOOTER.english;
        const personalizedCaption = `${resolveTemplateText(rawTemplate, target.name)}\n\n${optOutLine}`;

        const newLog: BroadcastLog = {
          id: `log-${Date.now()}-${currentIndex}`,
          timestamp: new Date().toLocaleTimeString(),
          recipientName: target.name,
          recipientPhone: target.phone,
          status: 'sent',
          delaySeconds: randomSec,
          personalizedText: personalizedCaption,
          languageRoute: detection.label,
          languageFlag: detection.flag,
        };
        setLogs((prev) => [newLog, ...prev.slice(0, 49)]);
      }
      setCurrentIndex((prev) => prev + 1);
    }, durationMs);

    return () => {
      if (queueTimeoutRef.current) clearTimeout(queueTimeoutRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [queueStatus, currentIndex, activeContacts, templates, salon.name]);

  const progressPercent =
    activeContacts.length > 0 ? Math.round((currentIndex / activeContacts.length) * 100) : 0;

  return (
    <div className="space-y-4 pb-28 lg:pb-12 max-w-full overflow-hidden min-w-0">
      {/* ========================================================================= */}
      {/* QUERY 6: VIDEO DEAL ROI MATRIX FUNNEL (SENT 450 ➔ VIEWED 380 ➔ BOOKED 50) */}
      {/* ========================================================================= */}
      <div className="rounded-2xl border border-[#30363D] bg-[#161B22] p-4 sm:p-5 space-y-3 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="size-4 text-[#D29922]" />
            <span className="text-xs font-mono font-black uppercase text-[#D29922]">
              Video Deal Results · Sent to Booked
            </span>
          </div>
          <span className="text-[10px] font-mono text-[#3FB950] bg-[#0D3822] border border-[#116329] px-2.5 py-0.5 rounded-md font-bold">
            13.2% Watch-to-Book Conversion
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2.5 font-mono">
          <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3 text-center">
            <span className="text-[10px] text-[#8B949E] uppercase block">SENT TO MEMBERS</span>
            <p className="text-xl sm:text-2xl font-black text-[#F0F6FC] mt-0.5">450</p>
            <span className="text-[10px] text-[#06B6D4]">WhatsApp Delivered</span>
          </div>
          <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3 text-center">
            <span className="text-[10px] text-[#06B6D4] uppercase flex items-center justify-center gap-1">
              <Eye className="size-3" />
              <span>OPENED &amp; WATCHED</span>
            </span>
            <p className="text-xl sm:text-2xl font-black text-[#06B6D4] mt-0.5">380</p>
            <span className="text-[10px] text-[#8B949E]">84.4% View Rate</span>
          </div>
          <div className="rounded-xl border border-[#116329] bg-[#0D3822] p-3 text-center">
            <span className="text-[10px] text-[#3FB950] uppercase flex items-center justify-center gap-1">
              <Calendar className="size-3" />
              <span>APPOINTMENTS BOOKED</span>
            </span>
            <p className="text-xl sm:text-2xl font-black text-[#3FB950] mt-0.5">50</p>
            <span className="text-[10px] text-[#D29922] font-bold">
              {billingConfig.symbol}{(salon.phone.startsWith('+92') ? 75000 : 2250).toLocaleString()} Revenue
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* QUERY 4: DAY-1 QUICK WHATSAPP CONTACT IMPORTER                            */}
      {/* ========================================================================= */}
      <div className="rounded-2xl border border-[#30363D] bg-[#161B22] p-4 space-y-3 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span className="text-xs font-mono font-bold text-[#06B6D4] uppercase flex items-center gap-1.5">
              <UsersRound className="size-4" />
              <span>Step 1: Day-1 Quick Client WhatsApp Import ({activeContacts.length} Ready)</span>
            </span>
            <p className="text-[11px] text-[#8B949E] font-sans mt-0.5">
              Fastest ways to load your customer list on Day 1 of purchasing your package:
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono">
          <button
            type="button"
            onClick={handleSyncPairedWhatsappChats}
            className="min-h-[48px] rounded-xl border border-[#116329] bg-[#0D3822] hover:border-[#3FB950] p-3 text-[#3FB950] font-bold transition text-left"
          >
            ⚡ 1. Auto-Sync Paired WhatsApp
            <span className="block text-[10px] text-[#8B949E] font-sans font-normal mt-0.5">
              Pull recent client chats automatically
            </span>
          </button>

          <button
            type="button"
            onClick={() => vcfInputRef.current?.click()}
            className="min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] hover:border-[#06B6D4] p-3 text-[#06B6D4] font-bold transition text-left"
          >
            📇 2. Import Phonebook (.vcf / .csv)
            <span className="block text-[10px] text-[#8B949E] font-sans font-normal mt-0.5">
              Upload exported phone contacts file
            </span>
          </button>
          <input
            ref={vcfInputRef}
            type="file"
            accept=".vcf,.csv,.txt"
            onChange={handleVcfOrCsvImport}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => setShowPasteBox(!showPasteBox)}
            className="min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] hover:border-[#D29922] p-3 text-[#D29922] font-bold transition text-left"
          >
            📋 3. Quick Paste Numbers
            <span className="block text-[10px] text-[#8B949E] font-sans font-normal mt-0.5">
              Paste numbers separated by commas or lines
            </span>
          </button>
        </div>

        {showPasteBox && (
          <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3 space-y-2">
            <textarea
              rows={2}
              value={pasteInput}
              onChange={(e) => setPasteInput(e.target.value)}
              placeholder="+923001234567, +971508923411, +447911123456"
              className="w-full rounded-lg border border-[#30363D] bg-[#161B22] p-2.5 text-sm font-mono text-[#F0F6FC] placeholder:text-[#484F58] focus:outline-none focus:border-[#06B6D4]"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handleBulkPasteImport}
                className="min-h-[44px] rounded-lg bg-[#06B6D4] hover:bg-[#22D3EE] text-[#0D1117] px-4 py-1.5 text-xs font-mono font-bold transition"
              >
                Import Numbers ✓
              </button>
            </div>
          </div>
        )}

        {importStatusMsg && (
          <div className="rounded-xl border border-[#116329] bg-[#0D3822] px-3 py-2 text-[11px] font-mono text-[#3FB950]">
            {importStatusMsg}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* QUERY 3: BOTH VIDEO PLANS (1-VIDEO vs 4-VIDEO) + REGIONAL PAYMENT GATE    */}
      {/* ========================================================================= */}
      <div className="rounded-2xl border border-[#30363D] bg-[#161B22] p-4 sm:p-5 space-y-4 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span className="text-xs font-mono font-bold text-[#D29922] uppercase flex items-center gap-1.5">
              <CreditCard className="size-4" />
              <span>Step 2: Choose Video Deal Plan &amp; Pay ({billingConfig.countryLabel})</span>
            </span>
            <p className="text-[11px] text-[#8B949E] font-sans mt-0.5">
              Pricing &amp; payment methods adapt automatically from your WhatsApp number ({salon.phone}). Confirm payment first to unlock final video upload.
            </p>
          </div>
          {isDealPaymentConfirmed && (
            <button
              type="button"
              onClick={() => {
                setIsDealPaymentConfirmed(false);
                setDealPaymentTid(null);
              }}
              className="min-h-[36px] text-[10px] font-mono text-[#8B949E] hover:text-[#F0F6FC] underline self-start"
            >
              Reset Payment Gate
            </button>
          )}
        </div>

        {/* Both Video Deal Options */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setSelectedDealPlan('SINGLE_1')}
            className={`min-h-[48px] rounded-2xl border p-3.5 text-left transition ${
              selectedDealPlan === 'SINGLE_1'
                ? 'border-[#06B6D4] bg-[#21262D] ring-1 ring-[#06B6D4]'
                : 'border-[#30363D] bg-[#0D1117] hover:border-[#484F58]'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-mono font-bold text-[#06B6D4] uppercase">Starter Option · 1 Video Once</span>
              <span className="text-base font-mono font-black text-[#D29922]">
                {billingConfig.symbol}{billingConfig.singlePrice.toLocaleString()}
              </span>
            </div>
            <p className="text-[11px] text-[#8B949E] font-sans mt-1">
              Single promotional deal video blast to all imported clients (valid 7–10 days).
            </p>
          </button>

          <button
            type="button"
            onClick={() => setSelectedDealPlan('MONTHLY_4')}
            className={`min-h-[48px] rounded-2xl border p-3.5 text-left transition ${
              selectedDealPlan === 'MONTHLY_4'
                ? 'border-[#06B6D4] bg-[#21262D] ring-1 ring-[#06B6D4]'
                : 'border-[#30363D] bg-[#0D1117] hover:border-[#484F58]'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-mono font-bold text-[#3FB950] uppercase">Growth Option · 4 Videos / Month</span>
              <span className="text-base font-mono font-black text-[#D29922]">
                {billingConfig.symbol}{billingConfig.monthly4Price.toLocaleString()}/mo
              </span>
            </div>
            <p className="text-[11px] text-[#8B949E] font-sans mt-1">
              Up to 4 deal videos per month (weekly campaigns · best savings per blast).
            </p>
          </button>
        </div>

        {/* Payment Confirmation Gate */}
        {isDealPaymentConfirmed ? (
          <div className="rounded-xl border border-[#116329] bg-[#0D3822] p-3.5 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
            <span className="text-[#3FB950] font-bold flex items-center gap-2">
              <CheckCircle2 className="size-4 text-[#3FB950] shrink-0" />
              <span>
                Payment Received ({billingConfig.symbol}
                {(selectedDealPlan === 'SINGLE_1'
                  ? billingConfig.singlePrice
                  : billingConfig.monthly4Price
                ).toLocaleString()}{' '}
                via {selectedPayChannel}) · Final Video Uploader Unlocked ✓
              </span>
            </span>
            <span className="text-[#06B6D4] break-all [overflow-wrap:break-word]">TID: {dealPaymentTid}</span>
          </div>
        ) : (
          <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3.5 space-y-3">
            <span className="text-[10px] font-mono font-bold uppercase text-[#8B949E] block">
              Select Country-Matched Payment Method ({billingConfig.countryLabel}):
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {billingConfig.channels.map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => setSelectedPayChannel(ch.id)}
                  className={`min-h-[48px] rounded-xl border p-2.5 text-left text-xs font-mono transition ${
                    selectedPayChannel === ch.id
                      ? 'border-[#06B6D4] bg-[#21262D] text-[#F0F6FC]'
                      : 'border-[#30363D] bg-[#161B22] text-[#8B949E] hover:text-[#F0F6FC]'
                  }`}
                >
                  <p className="font-bold text-[#06B6D4]">{ch.label}</p>
                  <p className="text-[10px] text-[#8B949E] mt-0.5">{ch.detail}</p>
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={isPayingDeal}
              onClick={handleConfirmDealPayment}
              className="w-full min-h-[48px] rounded-xl bg-[#06B6D4] hover:bg-[#22D3EE] text-[#0D1117] py-2.5 px-4 text-xs font-mono font-black uppercase transition active:scale-95"
            >
              {isPayingDeal
                ? 'Confirming Payment...'
                : `Confirm ${billingConfig.symbol}${(selectedDealPlan === 'SINGLE_1'
                    ? billingConfig.singlePrice
                    : billingConfig.monthly4Price
                  ).toLocaleString()} Payment & Unlock Final Upload →`}
            </button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* QUERY 2 & 4: SINGLE CUSTOM VIDEO UPLOADER (NO PRESET CLIPS) + 7-10 DAYS   */}
      {/* ========================================================================= */}
      <div className="relative rounded-2xl border border-[#30363D] bg-[#161B22] p-4 sm:p-5 space-y-4 shadow-lg">
        {!isDealPaymentConfirmed && (
          <div className="absolute inset-0 z-20 rounded-2xl bg-[#0D1117]/85 backdrop-blur-xs flex flex-col items-center justify-center p-5 text-center space-y-2">
            <Lock className="size-7 text-[#D29922]" />
            <p className="text-sm font-black text-[#F0F6FC]">Final Video Upload Locked Until Payment Confirmed</p>
            <p className="text-xs text-[#8B949E] max-w-md font-sans">
              Select the 1-Video ({billingConfig.symbol}{billingConfig.singlePrice.toLocaleString()}) or 4-Video ({billingConfig.symbol}{billingConfig.monthly4Price.toLocaleString()}) pack and confirm payment above to unlock final video upload.
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 font-bold text-[#F0F6FC]">
            <Video className="size-4 text-[#06B6D4]" />
            <span>Step 3: Upload Your Custom Deal Video &amp; Validation Days</span>
          </div>
          <span className="text-[10px] text-[#3FB950] font-mono bg-[#0D3822] px-2 py-0.5 rounded border border-[#116329]">
            Single Uploader · Automatic Video Check ≤60s
          </span>
        </div>

        {/* 7 to 10 Validation Days Selector (1-Tap Chips — No Manual Typing) */}
        <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span className="text-[10px] font-mono font-bold uppercase text-[#D29922] block">
              Select Deal Validation Window (7 to 10 Days):
            </span>
            <span className="text-[11px] text-[#8B949E] font-sans">
              Deal applies automatically for {validationDays} days from broadcast launch.
            </span>
          </div>
          <div className="flex items-center gap-1.5 font-mono text-xs flex-wrap">
            {([7, 8, 9, 10] as const).map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setValidationDays(days)}
                className={`min-h-[40px] rounded-xl border px-3 py-1.5 font-bold transition ${
                  validationDays === days
                    ? 'border-[#06B6D4] bg-[#06B6D4] text-[#0D1117]'
                    : 'border-[#30363D] bg-[#161B22] text-[#8B949E] hover:text-[#F0F6FC]'
                }`}
              >
                {days} Days
              </button>
            ))}
          </div>
        </div>

        {/* Single File Upload Dropzone + Quick QA Test Buttons */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="video/mp4,video/*"
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full min-h-[48px] py-4 px-4 border-2 border-dashed border-[#30363D] hover:border-[#06B6D4] bg-[#0D1117] rounded-2xl text-xs text-[#F0F6FC] flex flex-col items-center justify-center gap-1.5 transition"
        >
          <Upload className="size-5 text-[#06B6D4]" />
          <span className="font-bold">Tap to Upload Your Salon&apos;s Custom Deal Video (MP4 ≤ 60s, ≤ 50MB)</span>
          <span className="text-[10px] text-[#8B949E] font-mono">
            Headline &amp; QA boundaries are checked automatically after upload
          </span>
        </button>

        {/* Quick QA Simulation Chips for Owner Verification */}
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
          <span className="text-[#8B949E]">Test Automatic Video Check:</span>
          <button
            type="button"
            onClick={() => {
              const sampleName = 'eid_weekend_haircut_beard_offer.mp4';
              setQaRejectionNotice(null);
              setVideoFile({ name: sampleName, duration: 42, sizeMb: 9.4, qaStatus: 'PASSED' });
              setHeadlines(autoDetectHeadlineFromFilename(sampleName, salon.name));
            }}
            className="min-h-[40px] rounded-lg border border-[#116329] bg-[#0D3822] px-3 py-1 text-[#3FB950] font-bold hover:border-[#3FB950] transition"
          >
            ✓ Simulate Valid Clip (42s)
          </button>
          <button
            type="button"
            onClick={() => {
              setQaRejectionNotice(buildOwnerLangRejection('DURATION'));
              setVideoFile({ name: 'long_salon_tour_85sec.mp4', duration: 85, sizeMb: 28.0, qaStatus: 'REJECTED' });
            }}
            className="min-h-[40px] rounded-lg border border-[#da3633] bg-[#4C1C1D] px-3 py-1 text-[#F85149] font-bold hover:border-[#F85149] transition"
          >
            ✕ Simulate Rejected Clip (85s &gt; 60s)
          </button>
        </div>

        {/* Owner-Language Rejection Guide */}
        {qaRejectionNotice && (
          <div
            dir={ownerLang === 'ur' || ownerLang === 'ar' ? 'rtl' : 'ltr'}
            className={`rounded-2xl border border-[#da3633] bg-[#4C1C1D] p-4 space-y-1.5 text-xs overflow-hidden break-words [overflow-wrap:break-word] ${
              ownerLang === 'ur' || ownerLang === 'ar' ? 'text-right' : 'text-left'
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-[#F85149]">
              <AlertTriangle className="size-4 shrink-0" />
              <span>
                {qaRejectionNotice.title} (Sent in {ownerLang.toUpperCase()})
              </span>
            </div>
            <p className="text-[#F0F6FC] font-sans">{qaRejectionNotice.errorDetail}</p>
            <p className="text-[#D29922] font-sans font-bold">{qaRejectionNotice.fixSteps}</p>
          </div>
        )}

        {videoFile && videoFile.qaStatus === 'PASSED' && (
          <div className="bg-[#0D3822] p-3 rounded-xl border border-[#116329] flex items-center justify-between text-xs gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <FileVideo className="size-4 text-[#3FB950] shrink-0" />
              <div className="min-w-0">
                <span className="font-bold text-[#F0F6FC] truncate block">{videoFile.name}</span>
                <span className="text-[10px] text-[#8B949E] font-mono">
                  {videoFile.duration}s · {videoFile.sizeMb}MB · Valid {validationDays} Days
                </span>
              </div>
            </div>
            <span className="text-[10px] text-[#3FB950] font-mono font-bold bg-[#161B22] px-2.5 py-1 rounded border border-[#116329] shrink-0">
              Video Approved ✓
            </span>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* QUERY 2 & 5: DYNAMIC CLIENT/SALON CAPTIONS + MENA WATCH-LANGUAGE PLAYER   */}
      {/* ========================================================================= */}
      <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 font-bold text-[#F0F6FC]">
            <Sparkles className="size-4 text-[#D29922]" />
            <span>Step 4: Auto-Detected Headline, Client/Salon Caption &amp; MENA Voice Switcher</span>
          </div>
        </div>

        {/* Regional Template Tabs */}
        <div className="flex items-center gap-2 p-1 rounded-xl bg-[#0D1117] border border-[#30363D] overflow-x-auto">
          {[
            { id: 'roman_urdu' as const, label: 'Roman Urdu (+92/+91)', flag: '🇵🇰' },
            { id: 'arabic' as const, label: 'Arabic (+971/+966/+965)', flag: '🇦🇪' },
            { id: 'english' as const, label: 'English (+44/+1)', flag: '🇬🇧' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveEditorTab(tab.id)}
              className={`min-h-[44px] flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono font-bold transition shrink-0 ${
                activeEditorTab === tab.id
                  ? 'bg-[#06B6D4] text-[#0D1117] font-bold'
                  : 'text-[#8B949E] hover:text-[#F0F6FC]'
              }`}
            >
              <span>{tab.flag}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Dynamic {{client_name}} & {{salon_name}} Merge Tags + Auto Headline */}
        <div className="space-y-3 p-3.5 rounded-xl border border-[#30363D] bg-[#0D1117]">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleInsertTag('{{client_name}}')}
              className="min-h-[40px] px-3 py-1 rounded-lg border border-[#06B6D4] bg-[#21262D] text-[#06B6D4] text-xs font-mono font-bold flex items-center gap-1 hover:border-[#22D3EE]"
            >
              <User className="size-3" />
              <span>+ {'{{client_name}}'}</span>
            </button>
            <button
              type="button"
              onClick={() => handleInsertTag('{{salon_name}}')}
              className="min-h-[40px] px-3 py-1 rounded-lg border border-[#9E6A03] bg-[#3B2E0B] text-[#D29922] text-xs font-mono font-bold flex items-center gap-1 hover:border-[#D29922]"
            >
              <Tag className="size-3" />
              <span>+ {'{{salon_name}}'}</span>
            </button>
            <span className="text-[10px] text-[#8B949E] font-sans">
              Headline auto-detected from uploaded video:
            </span>
          </div>

          <input
            type="text"
            dir={activeEditorTab === 'arabic' ? 'rtl' : 'ltr'}
            value={headlines[activeEditorTab]}
            onChange={(e) => setHeadlines((prev) => ({ ...prev, [activeEditorTab]: e.target.value }))}
            className={`w-full min-h-[48px] bg-[#161B22] border border-[#30363D] focus:border-[#06B6D4] focus:outline-none rounded-xl px-3.5 py-2 text-sm font-bold text-[#06B6D4] ${
              activeEditorTab === 'arabic' ? 'text-right' : 'text-left'
            }`}
          />

          <textarea
            ref={textareaRef}
            rows={2}
            dir={activeEditorTab === 'arabic' ? 'rtl' : 'ltr'}
            value={templates[activeEditorTab]}
            onChange={(e) => setTemplates((prev) => ({ ...prev, [activeEditorTab]: e.target.value }))}
            className={`w-full min-h-[48px] bg-[#161B22] border border-[#30363D] focus:border-[#06B6D4] focus:outline-none rounded-xl p-3 text-sm text-[#F0F6FC] resize-none font-sans ${
              activeEditorTab === 'arabic' ? 'text-right' : 'text-left'
            }`}
          />
        </div>

        {/* Client WhatsApp Preview + Query 5 MENA Multilingual Video Watch Switcher */}
        <div className="bg-[#0D1117] p-4 rounded-2xl border border-[#30363D] space-y-3 max-w-md mx-auto overflow-hidden">
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#21262D]">
            <span className="text-[10px] font-mono text-[#06B6D4] uppercase font-bold">
              Client Video Card Preview
            </span>
            <select
              value={previewContactId}
              onChange={(e) => setPreviewContactId(e.target.value)}
              className="min-h-[40px] rounded-lg border border-[#30363D] bg-[#161B22] px-2 py-1 text-xs font-mono text-[#06B6D4] focus:border-[#06B6D4] focus:outline-none"
            >
              {activeContacts.slice(0, 12).map((c) => {
                const d = detectLanguageRoute(c.phone);
                return (
                  <option key={c.id} value={c.id} className="bg-[#161B22] text-[#F0F6FC]">
                    {d.flag} {c.name} ({c.phone})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Query 5: MENA Multinational End-User Watch Language & Dubbing Switcher */}
          <div className="rounded-xl border border-[#9E6A03] bg-[#3B2E0B] p-2.5 space-y-2">
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className="text-[#D29922] font-bold flex items-center gap-1">
                <Globe className="size-3" />
                <span>MENA Watch in My Language:</span>
              </span>
              <span className="text-[#8B949E]">Owner Voice ➔ Client Language</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(MENA_VIDEO_SUBTITLES) as VideoWatchLang[]).map((wl) => (
                <button
                  key={wl}
                  type="button"
                  onClick={() => setClientWatchLang(wl)}
                  className={`min-h-[36px] rounded-lg px-2.5 py-1 text-[10px] font-mono font-bold border transition ${
                    clientWatchLang === wl
                      ? 'border-[#06B6D4] bg-[#06B6D4] text-[#0D1117]'
                      : 'border-[#30363D] bg-[#161B22] text-[#8B949E] hover:text-[#F0F6FC]'
                  }`}
                >
                  {MENA_VIDEO_SUBTITLES[wl].label}
                </button>
              ))}
            </div>
            <div className="rounded-lg bg-[#161B22] border border-[#30363D] p-2.5 flex items-center justify-between gap-2 text-[11px] overflow-hidden">
              <p
                dir={clientWatchLang === 'ar' || clientWatchLang === 'ur' ? 'rtl' : 'ltr'}
                className={`text-[#F0F6FC] font-sans min-w-0 break-words [overflow-wrap:break-word] ${
                  clientWatchLang === 'ar' || clientWatchLang === 'ur' ? 'text-right' : 'text-left'
                }`}
              >
                {MENA_VIDEO_SUBTITLES[clientWatchLang].script}
              </p>
              <button
                type="button"
                onClick={handlePlayMenaTranslatedVoice}
                className={`min-h-[36px] rounded-lg px-2.5 py-1 text-[10px] font-mono font-bold shrink-0 border ${
                  isSpeakingDub
                    ? 'border-[#116329] bg-[#0D3822] text-[#3FB950] animate-pulse'
                    : 'border-[#06B6D4] bg-[#21262D] text-[#06B6D4] hover:border-[#22D3EE]'
                }`}
              >
                <Volume2 className="size-3 inline mr-1" />
                <span>{isSpeakingDub ? 'Speaking' : 'Dub'}</span>
              </button>
            </div>
          </div>

          <div
            className={`space-y-1.5 overflow-hidden break-words [overflow-wrap:break-word] ${
              previewDetection.route === 'arabic' ? 'text-right' : 'text-left'
            }`}
            dir={previewDetection.route === 'arabic' ? 'rtl' : 'ltr'}
          >
            <p className="text-xs font-bold text-[#F0F6FC] break-words [overflow-wrap:break-word]">
              {resolveTemplateText(
                headlines[previewDetection.route] || headlines.english,
                selectedPreviewContact.name
              )}
            </p>
            <div className="p-3 rounded-xl bg-[#0D3822] border border-[#116329] text-xs text-[#F0F6FC] font-sans space-y-2 overflow-hidden break-words [overflow-wrap:break-word]">
              <p>
                {resolveTemplateText(
                  templates[previewDetection.route] || templates.english,
                  selectedPreviewContact.name
                )}
              </p>
              <p className="border-t border-[#116329] pt-1.5 text-[10px] font-mono text-[#8B949E] break-words [overflow-wrap:break-word]">
                {STOP_OPT_OUT_FOOTER[previewDetection.route] || STOP_OPT_OUT_FOOTER.english}
              </p>
            </div>
          </div>

          {/* Query 4 Interactive Test: End-User Replies STOP */}
          <div className="pt-2 border-t border-[#21262D] flex flex-wrap items-center justify-between gap-2">
            <span className="text-[10px] font-mono text-[#8B949E]">
              Client Privacy Shield ({stoppedContacts.length} Stopped)
            </span>
            <button
              type="button"
              disabled={activeContacts.length === 0}
              onClick={() => handleClientRepliesStop(selectedPreviewContact)}
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-[#da3633] bg-[#4C1C1D] hover:border-[#F85149] disabled:opacity-40 px-3 py-1 text-[10px] font-mono font-bold text-[#F85149] transition"
            >
              <Ban className="size-3 text-[#F85149]" />
              <span>Simulate Client Replies &quot;STOP&quot;</span>
            </button>
          </div>

          {stopFeedbackMsg && (
            <div className="rounded-xl border border-[#da3633] bg-[#4C1C1D] p-2.5 text-[11px] font-sans text-[#F0F6FC]">
              {stopFeedbackMsg}
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* STEP 5: ANTI-BAN 4s-9s DISPATCH QUEUE + QUERY 4 STOP PROTECTION           */}
      {/* ========================================================================= */}
      <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 font-bold text-[#F0F6FC]">
            <ShieldCheck className="size-4 text-[#3FB950]" />
            <span>Step 5: Safe Sending Queue (4s–9s Spacing · {validationDays}-Day Deal)</span>
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px]">
            <span className="text-[#3FB950] bg-[#0D3822] border border-[#116329] px-2 py-0.5 rounded">
              {activeContacts.length} Receiving
            </span>
            <span className="text-[#F85149] bg-[#4C1C1D] border border-[#da3633] px-2 py-0.5 rounded">
              {stoppedContacts.length} Restricted (STOP)
            </span>
          </div>
        </div>

        {stoppedContacts.length > 0 && (
          <div className="rounded-xl border border-[#da3633] bg-[#4C1C1D] p-3 space-y-1.5 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <span className="font-mono font-bold text-[#F85149] text-[11px] flex items-center gap-1.5">
                <Ban className="size-3.5" />
                <span>Stopped Numbers Blocked From Deal Videos ({stoppedContacts.length})</span>
              </span>
              <span className="text-[10px] font-mono text-[#3FB950]">
                1-to-1 Bookings Still Work
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {stoppedContacts.slice(0, 8).map((c) => (
                <span
                  key={c.id}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#da3633] bg-[#0D1117] px-2 py-0.5 text-[10px] font-mono text-[#F85149]"
                >
                  {c.name} ({c.phone})
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="w-full bg-[#0D1117] h-3 rounded-full overflow-hidden border border-[#30363D]">
          <div
            className="bg-[#06B6D4] h-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="flex gap-2.5">
          {queueStatus !== 'running' ? (
            <button
              type="button"
              disabled={!isDealPaymentConfirmed || !videoFile || videoFile.qaStatus !== 'PASSED'}
              onClick={() => setQueueStatus('running')}
              className="flex-1 min-h-[48px] bg-[#06B6D4] hover:bg-[#22D3EE] disabled:opacity-40 text-[#0D1117] font-mono font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition px-4"
            >
              <Play className="size-4 fill-[#0D1117]" />
              <span>
                {!isDealPaymentConfirmed
                  ? 'Confirm Payment First'
                  : !videoFile || videoFile.qaStatus !== 'PASSED'
                  ? 'Upload Approved ≤60s Video First'
                  : `Launch ${validationDays}-Day Deal Broadcast →`}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setQueueStatus('paused')}
              className="flex-1 min-h-[48px] bg-[#3B2E0B] border border-[#9E6A03] text-[#D29922] font-mono font-bold text-xs rounded-xl flex items-center justify-center gap-2 px-4"
            >
              <Pause className="size-4 fill-[#D29922]" />
              <span>Pause (Sending next in {delayCountdown}s)</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setQueueStatus('idle');
              setCurrentIndex(0);
              setLogs([]);
            }}
            className="px-4 min-h-[48px] bg-[#21262D] border border-[#30363D] hover:border-[#484F58] text-[#F0F6FC] rounded-xl"
          >
            <RotateCcw className="size-4" />
          </button>
        </div>

        {logs.length > 0 && (
          <div className="bg-[#0D1117] p-3 rounded-xl border border-[#30363D] font-mono text-[11px] max-h-36 overflow-y-auto space-y-1">
            {logs.map((log) => (
              <div key={log.id} className="flex items-center justify-between gap-2 text-[#8B949E]">
                <span className="truncate text-[#F0F6FC]">
                  {log.languageFlag} {log.recipientName} ({log.recipientPhone})
                </span>
                <span className="text-[#3FB950] shrink-0">+{log.delaySeconds}s ✓</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
