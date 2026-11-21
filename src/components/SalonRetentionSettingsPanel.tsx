import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BellRing,
  Cake,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Film,
  Globe,
  Link2,
  MapPin,
  MessageSquare,
  Play,
  RefreshCw,
  Save,
  Send,
  Star,
  Tag,
  Trash2,
  Upload,
  UserPlus,
} from 'lucide-react';
import type {
  ClientPreferredLang,
  DealDiscountType,
  RetentionSettings,
  SalonConciergeStateResponse,
  SalonPackageTier,
} from '../types/concierge';
import { CustomerWhatsAppDemoModal } from './CustomerWhatsAppDemoModal';

interface SalonRetentionSettingsPanelProps {
  salonId: string;
  salonName: string;
  ownerName: string;
  salonPhone: string;
  ownerLang?: 'en' | 'ur' | 'ar';
  packageTier?: SalonPackageTier;
  conciergeState: SalonConciergeStateResponse | null;
  onStateUpdated: (nextState: SalonConciergeStateResponse) => void;
  onShowToast: (msg: string) => void;
}

const RETENTION_UI_I18N: Record<
  'en' | 'ur' | 'ar',
  {
    mod1Title: string;
    mod1Desc: string;
    detectedRegion: string;
    activeOptions: string;
    simulatorTitle: string;
    sendHiBtn: string;
    mod2Title: string;
    mod2Desc: string;
    bdayOn: string;
    bdayOff: string;
    eventTitleLabel: string;
    discPctLabel: string;
    fixedCashLabel: string;
    freeSvcLabel: string;
    bdayMsgLabel: string;
    test9amBtn: string;
    saveBtn: string;
    mod3Title: string;
    mod3Desc: string;
    winbackOn: string;
    winbackOff: string;
    inactivityDaysLabel: string;
    winbackPctLabel: string;
    cashOffLabel: string;
    freeAddonLabel: string;
    winbackTplLabel: string;
    runScanBtn: string;
    testRebookBtn: string;
    mod4Title: string;
    mod4Desc: string;
    boosterOn: string;
    boosterOff: string;
    googleUrlLabel: string;
    testStarsLabel: string;
    dispatchT2hBtn: string;
    profilesTitle: string;
    trackedCount: string;
    saveProfileBtn: string;
    recentLogsLabel: string;
  }
> = {
  en: {
    mod1Title: '1. Region-Aware Language Selector Menu',
    mod1Desc: 'Auto-detects region from WhatsApp number and locks client preferred language on greeting.',
    detectedRegion: 'Detected Region',
    activeOptions: 'Active Regional Greeting Options',
    simulatorTitle: 'Live Greeting Menu & Lock Simulator',
    sendHiBtn: '1. Send "Hi" Greeting',
    mod2Title: '2. Retention & Rewards · 9:00 AM Birthday & Event Offers',
    mod2Desc: "Dispatches automatically at 9:00 AM in each client's locked language when birth date (DD/MM) matches.",
    bdayOn: 'Birthday / Event Offer: ON',
    bdayOff: 'Birthday / Event Offer: OFF',
    eventTitleLabel: 'Event / Campaign Title (All Clients Receive This)',
    discPctLabel: 'Discount Percentage (%) · 0 = Off',
    fixedCashLabel: 'Fixed Cash OFF',
    freeSvcLabel: 'Complimentary Free Service',
    bdayMsgLabel: 'Customizable Offer Message Text',
    test9amBtn: 'Test 9:00 AM Birthday Dispatch Now',
    saveBtn: 'Save Settings',
    mod3Title: '3. Win-Back Rules · 30-Day Dormant Client Engine',
    mod3Desc: 'Monitors inactive clients with no upcoming booking and sends a 1-tap rebooking offer.',
    winbackOn: '30-Day Win-Back: ON',
    winbackOff: '30-Day Win-Back: OFF',
    inactivityDaysLabel: 'Inactivity Trigger (Days)',
    winbackPctLabel: 'Win-Back % (0 = Off)',
    cashOffLabel: 'Cash OFF',
    freeAddonLabel: 'Free Add-On Service',
    winbackTplLabel: 'Win-Back Message Template',
    runScanBtn: 'Run 30-Day Win-Back Scan',
    testRebookBtn: 'Test 1-Tap "REBOOK" Reply',
    mod4Title: '4. Post-Service Google Review & Rating Booster (T+2 Hours)',
    mod4Desc: 'Routes 4–5★ to Google Maps and intercepts 1–3★ privately with an Owner Alert.',
    boosterOn: 'T+2h Booster: ON',
    boosterOff: 'T+2h Booster: OFF',
    googleUrlLabel: 'Direct Google Review URL (google_review_url)',
    testStarsLabel: 'Test Smart Reputation Routing (Simulate Client Reply)',
    dispatchT2hBtn: 'Dispatch T+2h Prompts Now',
    profilesTitle: 'Client Retention Profiles (Birth Date & Last Completed Visit)',
    trackedCount: 'Tracked Profiles',
    saveProfileBtn: 'Save Client Profile',
    recentLogsLabel: 'Recent Automated WhatsApp Webhook & Cron Dispatches',
  },
  ur: {
    mod1Title: '1. علاقائی زبان منتخب کرنے کا مینو',
    mod1Desc: 'سیلون کے واٹس ایپ نمبر سے علاقہ خودکار پہچان کر گاہک کی پسندیدہ زبان محفوظ کرتا ہے۔',
    detectedRegion: 'شناخت شدہ علاقہ',
    activeOptions: 'فعال علاقائی خوش آمدید آپشنز',
    simulatorTitle: 'لائیو گریٹنگ مینو اور لینگویج لاک ٹیسٹر',
    sendHiBtn: '1. "Hi" سلام بھیجیں',
    mod2Title: '2. برتھ ڈے اور ایونٹ آفرز (صبح 9:00 بجے خودکار)',
    mod2Desc: 'جب گاہک کی تاریخِ پیدائش (DD/MM) میچ ہو تو صبح 9:00 بجے اس کی زبان میں خودکار آفر بھیجتا ہے۔',
    bdayOn: 'برتھ ڈے / ایونٹ آفر: آن',
    bdayOff: 'برتھ ڈے / ایونٹ آفر: آف',
    eventTitleLabel: 'ایونٹ یا آفر کا عنوان (تمام گاہکوں کے لیے)',
    discPctLabel: 'ڈسکاؤنٹ فیصد (%) · 0 = بند',
    fixedCashLabel: 'نقد رعایت',
    freeSvcLabel: 'مفت اضافی سروس',
    bdayMsgLabel: 'آفر پیغام کا متن',
    test9amBtn: 'صبح 9:00 بجے والا ٹیسٹ میسج چلائیں',
    saveBtn: 'سیٹنگز محفوظ کریں',
    mod3Title: '3. 30 دن پرانے غیر فعال گاہکوں کی واپسی (Win-Back)',
    mod3Desc: 'جن گاہکوں کی کوئی نئی بکنگ نہیں انہیں مقررہ دن کے بعد 1-ٹیپ واپسی آفر خودکار بھیجتا ہے۔',
    winbackOn: '30 دن ون بیک: آن',
    winbackOff: '30 دن ون بیک: آف',
    inactivityDaysLabel: 'کتنے دن بعد پیغام جائے',
    winbackPctLabel: 'ون بیک رعایت % (0 = بند)',
    cashOffLabel: 'نقد رعایت',
    freeAddonLabel: 'مفت سروس آفر',
    winbackTplLabel: 'ون بیک پیغام کا سانچہ',
    runScanBtn: '30 دن کا ون بیک اسکین چلائیں',
    testRebookBtn: '1-ٹیپ "REBOOK" جواب ٹیسٹ کریں',
    mod4Title: '4. سروس کے 2 گھنٹے بعد گوگل ریویو بوسٹر',
    mod4Desc: '4–5 اسٹار گاہک کو گوگل میپس پر بھیجتا ہے اور 1–3 اسٹار کو نجی الرٹ کے ساتھ روک لیتا ہے۔',
    boosterOn: 'ریویو بوسٹر: آن',
    boosterOff: 'ریویو بوسٹر: آف',
    googleUrlLabel: 'براہِ راست گوگل ریویو لنک (URL)',
    testStarsLabel: 'اسمارٹ ریٹنگ راؤٹنگ ٹیسٹ کریں (جواب سیمولیشن)',
    dispatchT2hBtn: '2 گھنٹے والے ریویو پیغامات ابھی چلائیں',
    profilesTitle: 'گاہکوں کے پروفائلز (تاریخِ پیدائش اور آخری وزٹ)',
    trackedCount: 'محفوظ پروفائلز',
    saveProfileBtn: 'گاہک پروفائل محفوظ کریں',
    recentLogsLabel: 'حالیہ خودکار واٹس ایپ پیغامات کا لاگ',
  },
  ar: {
    mod1Title: '1. قائمة اختيار اللغة حسب المنطقة',
    mod1Desc: 'يتعرف تلقائياً على المنطقة من رقم واتساب الصالون ويثبت لغة العميل المفضلة عند الترحيب.',
    detectedRegion: 'المنطقة المكتشفة',
    activeOptions: 'خيارات الترحيب الإقليمية النشطة',
    simulatorTitle: 'محاكي قائمة الترحيب وتثبيت اللغة',
    sendHiBtn: '1. إرسال رسالة ترحيب "Hi"',
    mod2Title: '2. عروض أعياد الميلاد والمناسبات (9:00 صباحاً تلقائياً)',
    mod2Desc: 'يرسل تلقائياً الساعة 9:00 صباحاً بلغة العميل المسجلة عند تطابق يوم وشهر الميلاد (DD/MM).',
    bdayOn: 'عرض الميلاد / المناسبة: مفعل',
    bdayOff: 'عرض الميلاد / المناسبة: متوقف',
    eventTitleLabel: 'عنوان المناسبة أو الحملة',
    discPctLabel: 'نسبة الخصم (%) · 0 = إيقاف',
    fixedCashLabel: 'خصم نقدي ثابت',
    freeSvcLabel: 'خدمة مجانية إضافية',
    bdayMsgLabel: 'نص رسالة العرض الترويجي',
    test9amBtn: 'تجربة إرسال عرض 9:00 صباحاً الآن',
    saveBtn: 'حفظ الإعدادات',
    mod3Title: '3. قواعد استرجاع العملاء المتغيبين لمدة 30 يوماً',
    mod3Desc: 'يراقب العملاء غير النشطين ويرسل عرض عودة بضغطة واحدة بعد المدة المحددة.',
    winbackOn: 'استرجاع 30 يوماً: مفعل',
    winbackOff: 'استرجاع 30 يوماً: متوقف',
    inactivityDaysLabel: 'عدد أيام الانقطاع',
    winbackPctLabel: 'نسبة خصم العودة % (0 = إيقاف)',
    cashOffLabel: 'خصم نقدي',
    freeAddonLabel: 'خدمة مجانية مضافة',
    winbackTplLabel: 'قالب رسالة الاسترجاع',
    runScanBtn: 'تشغيل فحص استرجاع 30 يوماً',
    testRebookBtn: 'تجربة رد "REBOOK" المباشر',
    mod4Title: '4. معزز تقييم جوجل بعد الخدمة بساعتين (T+2h)',
    mod4Desc: 'يوجه تقييمات 4–5 نجوم إلى خرائط جوجل ويحول 1–3 نجوم لتنبيه خاص للمالك.',
    boosterOn: 'معزز التقييم: مفعل',
    boosterOff: 'معزز التقييم: متوقف',
    googleUrlLabel: 'رابط تقييم جوجل المباشر (URL)',
    testStarsLabel: 'اختبار توجيه التقييم الذكي',
    dispatchT2hBtn: 'إرسال طلبات التقييم الآن',
    profilesTitle: 'ملفات احتفاظ العملاء (تاريخ الميلاد وآخر زيارة)',
    trackedCount: 'ملفات مسجلة',
    saveProfileBtn: 'حفظ ملف العميل',
    recentLogsLabel: 'سجل رسائل واتساب التلقائية الأخيرة',
  },
};

const PREVIEW_LANG_TABS: Array<{
  id: ClientPreferredLang;
  label: string;
  dir: 'ltr' | 'rtl';
}> = [
  { id: 'en', label: 'English', dir: 'ltr' },
  { id: 'roman_ur', label: 'Roman Urdu', dir: 'ltr' },
  { id: 'ur', label: 'اردو', dir: 'rtl' },
  { id: 'ar', label: 'العربية', dir: 'rtl' },
];

export const SalonRetentionSettingsPanel: React.FC<SalonRetentionSettingsPanelProps> = ({
  salonId,
  salonName,
  ownerLang = 'en',
  packageTier = 'PRO++',
  conciergeState,
  onStateUpdated,
  onShowToast,
}) => {
  const isOwnerRtl = ownerLang === 'ur' || ownerLang === 'ar';
  const rUi = RETENTION_UI_I18N[ownerLang];
  const [draft, setDraft] = useState<RetentionSettings | null>(conciergeState?.settings ?? null);
  const [previewLang, setPreviewLang] = useState<ClientPreferredLang>('en');
  const [savingSection, setSavingSection] = useState<'BIRTHDAY' | 'WINBACK' | 'REVIEW' | 'ALL' | null>(null);
  const [savedBanner, setSavedBanner] = useState<string | null>(null);
  const isDirtyRef = React.useRef<boolean>(false);
  const hydratedSalonIdRef = React.useRef<string | null>(null);

  const updateDraft = (updater: RetentionSettings | ((prev: RetentionSettings) => RetentionSettings)) => {
    isDirtyRef.current = true;
    setDraft((prev) => {
      if (!prev) return null;
      return typeof updater === 'function' ? updater(prev) : updater;
    });
  };

  // Module 1 Interactive Greeting Simulator
  const [simClientPhone, setSimClientPhone] = useState('+92 301 5559012');
  const [simClientName, setSimClientName] = useState('Zain Raza');
  const [simWebhookReply, setSimWebhookReply] = useState<{
    replyText: string;
    replyDir: 'ltr' | 'rtl';
    lockedLanguage: ClientPreferredLang | null;
    routedAction: string;
  } | null>(null);
  const [isWebhookBusy, setIsWebhookBusy] = useState(false);

  // Module 2 Optional Client Birth Date (Day/Month) Quick Editor
  const [newBirthClientName, setNewBirthClientName] = useState('');
  const [newBirthClientPhone, setNewBirthClientPhone] = useState('');
  const [newBirthDayMonth, setNewBirthDayMonth] = useState('');
  const [newBirthLang, setNewBirthLang] = useState<ClientPreferredLang>('roman_ur');

  // Module 4 Live 1-5 Star Routing Tester
  const [ratingSimOutcome, setRatingSimOutcome] = useState<{
    rating: number;
    routedAction: string;
    replyText: string;
    replyDir: 'ltr' | 'rtl';
  } | null>(null);

  // Phase 1: Customer WhatsApp Experience Live Demo & Deals Manager State
  const [isLiveDemoOpen, setIsLiveDemoOpen] = useState(false);
  const [dealTitle, setDealTitle] = useState('');
  const [dealDesc, setDealDesc] = useState('');
  const [dealDiscountType, setDealDiscountType] = useState<DealDiscountType>('PCT');
  const [dealDiscountValue, setDealDiscountValue] = useState(20);
  const [dealExpiresAt, setDealExpiresAt] = useState(() => {
    const d = new Date(Date.now() + 7 * 86400000);
    return d.toISOString().slice(0, 10);
  });
  const [dealServiceIds, setDealServiceIds] = useState<string[]>([]);
  const [dealVideoFile, setDealVideoFile] = useState<{
    name: string;
    mimeType: string;
    base64: string;
  } | null>(null);
  const [isCreatingDeal, setIsCreatingDeal] = useState(false);

  useEffect(() => {
    if (!conciergeState?.settings) return;
    if (hydratedSalonIdRef.current !== salonId) {
      hydratedSalonIdRef.current = salonId;
      isDirtyRef.current = false;
      setDraft(conciergeState.settings);
      return;
    }
    if (!isDirtyRef.current) {
      setDraft(conciergeState.settings);
    }
  }, [conciergeState?.settings, salonId]);

  if (!draft || !conciergeState) {
    return (
      <div className="rounded-2xl border border-[#30363D] bg-[#161B22] p-6 text-sm text-[#8B949E] font-mono">
        Loading Salon Settings &amp; Concierge State...
      </div>
    );
  }

  const handleSaveSettings = async (section: 'BIRTHDAY' | 'WINBACK' | 'REVIEW' | 'ALL') => {
    setSavingSection(section);
    try {
      const res = await fetch(`/api/salons/${encodeURIComponent(salonId)}/retention-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      if (!res.ok) throw new Error('Failed to save settings');
      const updated = (await res.json()) as SalonConciergeStateResponse;
      isDirtyRef.current = false;
      if (updated.settings) {
        setDraft(updated.settings);
      }
      onStateUpdated(updated);
      const labelMap = {
        BIRTHDAY: 'Retention & Event Offer settings saved.',
        WINBACK: '30-Day Dormant Win-Back settings saved.',
        REVIEW: 'Post-Service Google Review URL & Booster settings saved.',
        ALL: 'All Salon Concierge & Retention settings saved.',
      };
      setSavedBanner(labelMap[section]);
      onShowToast(`✓ ${labelMap[section]}`);
      setTimeout(() => setSavedBanner(null), 4500);
    } catch {
      onShowToast('Could not save settings. Please try again.');
    } finally {
      setSavingSection(null);
    }
  };

  const handleTriggerCron = async (job: 'birthday_9am' | 'winback_30d' | 'review_t2h') => {
    try {
      const res = await fetch(`/api/salons/${encodeURIComponent(salonId)}/concierge/trigger-cron`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job, force: true }),
      });
      if (!res.ok) throw new Error('Cron trigger failed');
      const data = await res.json();
      onStateUpdated(data.state);
      const count =
        job === 'birthday_9am'
          ? data.birthdayDispatched
          : job === 'winback_30d'
          ? data.winbackDispatched
          : data.reviewDispatched;
      onShowToast(`✓ Dispatched ${count} WhatsApp message(s) via ${job.toUpperCase()} runner.`);
    } catch {
      onShowToast('Failed to run automated dispatch.');
    }
  };

  const handleSendGreetingWebhook = async (messageText: string, forceLanguagePrompt = false) => {
    setIsWebhookBusy(true);
    try {
      const res = await fetch(`/api/salons/${encodeURIComponent(salonId)}/concierge/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromPhone: simClientPhone,
          clientName: simClientName,
          messageText,
          forceLanguagePrompt,
        }),
      });
      if (!res.ok) throw new Error('Webhook call failed');
      const data = await res.json();
      setSimWebhookReply({
        replyText: data.replyText,
        replyDir: data.replyDir,
        lockedLanguage: data.lockedLanguage,
        routedAction: data.routedAction,
      });
      onStateUpdated(data.state);
    } catch {
      onShowToast('Webhook simulation failed.');
    } finally {
      setIsWebhookBusy(false);
    }
  };

  const handleSimulateStarFeedback = async (stars: number) => {
    setIsWebhookBusy(true);
    try {
      const sampleClient = conciergeState.clients[0];
      const targetPhone = sampleClient?.phone || '+92 300 1234567';
      const targetName = sampleClient?.name || 'Bilal Ahmed';
      const latestCompleted = conciergeState.appointments.find((a) => a.status === 'COMPLETED');

      const res = await fetch(`/api/salons/${encodeURIComponent(salonId)}/concierge/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromPhone: targetPhone,
          clientName: targetName,
          messageText: `${stars} stars`,
          appointmentIdForReview: latestCompleted?.id,
        }),
      });
      if (!res.ok) throw new Error('Failed to simulate rating');
      const data = await res.json();
      setRatingSimOutcome({
        rating: stars,
        routedAction: data.routedAction,
        replyText: data.replyText,
        replyDir: data.replyDir,
      });
      onStateUpdated(data.state);
      if (stars <= 3) {
        onShowToast('🚨 Low rating (1–3★) intercepted! Google Review URL suppressed & Owner Alert triggered.');
      } else {
        onShowToast(`✓ ${stars}★ Positive review routed directly to your Google Review link!`);
      }
    } catch {
      onShowToast('Could not simulate star rating.');
    } finally {
      setIsWebhookBusy(false);
    }
  };

  const handleSaveClientBirthDate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBirthClientPhone.trim()) return;
    try {
      const res = await fetch(`/api/salons/${encodeURIComponent(salonId)}/clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newBirthClientName.trim() || 'Client',
          phone: newBirthClientPhone.trim(),
          birthDate: newBirthDayMonth.trim(),
          preferredLanguage: newBirthLang,
        }),
      });
      if (!res.ok) throw new Error('Failed to save client');
      const data = await res.json();
      onStateUpdated(data.state);
      setNewBirthClientName('');
      setNewBirthClientPhone('');
      setNewBirthDayMonth('');
      onShowToast('✓ Client profile & optional birth_date (DD/MM) saved.');
    } catch {
      onShowToast('Could not save client birth_date.');
    }
  };

  const formatBirthdayPreview = (lang: ClientPreferredLang): string => {
    const offerParts = [
      draft.birthdayDiscountPct > 0 ? `${draft.birthdayDiscountPct}% OFF` : '',
      draft.birthdayFixedDiscount > 0 ? `${draft.currencySymbol}${draft.birthdayFixedDiscount.toLocaleString()} OFF` : '',
      draft.birthdayGiftService.trim(),
    ]
      .filter(Boolean)
      .join(' + ');
    const eventTitle = draft.birthdayEventName?.trim() || 'Special Event';
    const summary = `${eventTitle}: ${offerParts || 'VIP Chair Priority'}`;

    if (lang === 'roman_ur') {
      return `Salam Bilal! ${salonName} ki taraf se ${eventTitle} par aap ke liye khas offer: ${offerParts || 'VIP Chair Priority'}. Appointment book karne ke liye reply karein!`;
    }
    if (lang === 'ur') {
      return `سلام بلال! ${salonName} کی طرف سے ${eventTitle} پر آپ کے لیے خصوصی آفر: ${offerParts || 'VIP ترجیح'}۔ بکنگ کے لیے جواب دیں!`;
    }
    if (lang === 'ar') {
      return `مرحباً بلال! عرض خاص من ${salonName} بمناسبة ${eventTitle}: ${offerParts || 'أولوية VIP'}. أرسل لتأكيد موعدك!`;
    }
    return draft.birthdayMessageTemplate
      .replace(/\{client_name\}/g, 'Bilal')
      .replace(/\{salon_name\}/g, salonName)
      .replace(/\{offer_summary\}/g, summary);
  };

  const formatWinBackPreview = (lang: ClientPreferredLang): string => {
    const offer =
      [
        draft.winbackDiscountPct > 0 ? `${draft.winbackDiscountPct}% OFF` : '',
        (draft.winbackFixedDiscount ?? 0) > 0
          ? `${draft.currencySymbol}${Number(draft.winbackFixedDiscount).toLocaleString()} OFF`
          : '',
        draft.winbackAddonService.trim(),
      ]
        .filter(Boolean)
        .join(' + ') || 'VIP Offer';

    if (lang === 'roman_ur') {
      return `Assalamu Alaikum Fahad! Hum ne aap ko ${salonName} par miss kiya (${draft.winbackDays} din ho gaye). Wapis aayein aur paayein: ${offer}. 1-tap booking ke liye "REBOOK" reply karein!`;
    }
    if (lang === 'ur') {
      return `السلام علیکم فہد! ${salonName} پر آپ کی آخری وزٹ کو ${draft.winbackDays} دن ہو چکے ہیں۔ آپ کے لیے خصوصی آفر: ${offer}۔ فوری بکنگ کے لیے "REBOOK" لکھیں!`;
    }
    if (lang === 'ar') {
      return `مرحباً فهد! اشتقنا لزيارتك في ${salonName} منذ ${draft.winbackDays} يوماً. احصل على: ${offer}. أرسل "REBOOK" للحجز الفوري بضغطة واحدة!`;
    }
    const base = draft.winbackMessageTemplate
      .replace(/\{client_name\}/g, 'Fahad')
      .replace(/\{salon_name\}/g, salonName)
      .replace(/\{days\}/g, String(draft.winbackDays))
      .replace(/\{offer_summary\}/g, offer);
    return `${base} Reply "REBOOK" for 1-tap instant rebooking!`;
  };

  const formatReviewPromptPreview = (lang: ClientPreferredLang): string => {
    if (lang === 'roman_ur') {
      return `Aaj ${salonName} par aap ka visit kaisa raha? Meharbani farma kar 1–5 Stars reply karein.`;
    }
    if (lang === 'ur') {
      return `آج ${salonName} پر آپ کا وزٹ کیسا رہا؟ برائے مہربانی 1 سے 5 اسٹارز (1–5 Stars) میں جواب دیں۔`;
    }
    if (lang === 'ar') {
      return `كيف كانت زيارتك إلى ${salonName} اليوم؟ يرجى الرد بتقييم من 1 إلى 5 نجوم.`;
    }
    return `How was your visit to ${salonName} today? Reply 1–5 Stars.`;
  };

  const dormantClients = conciergeState.clients.filter((c) => {
    if (!c.lastCompletedVisitAt) return false;
    const daysSince = Math.floor((Date.now() - new Date(c.lastCompletedVisitAt).getTime()) / 86400000);
    return daysSince >= draft.winbackDays;
  });

  const activeDir = PREVIEW_LANG_TABS.find((t) => t.id === previewLang)?.dir ?? 'ltr';

  const handleDealVideoPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setDealVideoFile(null);
      return;
    }
    if (file.size > 18 * 1024 * 1024) {
      onShowToast('Please choose a promotional video under 18 MB.');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const b64 = result.includes(',') ? result.split(',')[1] : result;
      setDealVideoFile({
        name: file.name,
        mimeType: file.type || 'video/mp4',
        base64: b64,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleCreateDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dealTitle.trim()) {
      onShowToast('Please enter a deal title.');
      return;
    }
    setIsCreatingDeal(true);
    try {
      const expiresIso = new Date(`${dealExpiresAt}T23:59:59`).toISOString();
      const res = await fetch(`/api/salons/${encodeURIComponent(salonId)}/deals`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: dealTitle.trim(),
          description: dealDesc.trim(),
          discountType: dealDiscountType,
          discountValue: Number(dealDiscountValue || 0),
          serviceIds: dealServiceIds,
          expiresAt: expiresIso,
          videoRetentionDaysAfterExpiry: draft.videoRetentionDaysAfterExpiry ?? 30,
          videoBase64: dealVideoFile?.base64,
          videoMimeType: dealVideoFile?.mimeType,
          videoOriginalName: dealVideoFile?.name,
        }),
      });
      const data = (await res.json()) as { state?: SalonConciergeStateResponse; error?: string };
      if (!res.ok) {
        onShowToast(data.error || 'Could not create deal.');
        return;
      }
      if (data.state) onStateUpdated(data.state);
      setDealTitle('');
      setDealDesc('');
      setDealServiceIds([]);
      setDealVideoFile(null);
      onShowToast('✓ Promotional deal & video saved!');
    } catch {
      onShowToast('Failed to save promotional deal.');
    } finally {
      setIsCreatingDeal(false);
    }
  };

  const handleDeleteDeal = async (dealId: string) => {
    try {
      const res = await fetch(
        `/api/salons/${encodeURIComponent(salonId)}/deals/${encodeURIComponent(dealId)}`,
        { method: 'DELETE', credentials: 'include' }
      );
      const data = (await res.json()) as { state?: SalonConciergeStateResponse };
      if (res.ok && data.state) {
        onStateUpdated(data.state);
        onShowToast('✓ Deal & video removed.');
      }
    } catch {
      onShowToast('Failed to remove deal.');
    }
  };

  const handleToggleClientLanguage = (lang: ClientPreferredLang) => {
    if (lang === 'en') return; // English is always default
    const current = draft.enabledClientLanguages || ['en'];
    const next = current.includes(lang)
      ? current.filter((l) => l !== lang)
      : [...current, lang];
    updateDraft({ ...draft, enabledClientLanguages: next });
  };

  const allServices = (draft.enabledServices || []).filter((s) => s.active !== false);
  const salonDeals = conciergeState.deals || [];

  return (
    <div dir={isOwnerRtl ? 'rtl' : 'ltr'} className="space-y-6 pb-28 min-w-0">
      {savedBanner && (
        <div className="rounded-xl border border-[#116329] bg-[#0D3822] px-4 py-3 text-xs font-mono text-[#3FB950] flex items-center gap-2">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{savedBanner}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PHASE 1: CUSTOMER WHATSAPP EXPERIENCE — LIVE DEMO & PUBLIC FLOW LINKS     */}
      {/* ========================================================================= */}
      <section className="rounded-2xl border border-[#116329] bg-[#0D2118] p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#3FB950]">
              WHATSAPP CUSTOMER EXPERIENCE · INTERACTIVE SANDBOX
            </span>
            <h3 className="text-base font-black text-[#F0F6FC]">
              Customer WhatsApp Experience — Live Demo
            </h3>
            <p className="text-xs text-[#8B949E] font-sans leading-relaxed">
              Test the complete customer journey (&ldquo;Hi&rdquo; welcome, English/Urdu/Roman Urdu/Arabic switching, real Services, Hours, Location/Maps, Deals &amp; embedded Booking Flow) without altering real appointments.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <a
              href={`/flow/${encodeURIComponent(salonId)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[46px] rounded-xl border border-[#30363D] bg-[#0D1117] hover:border-[#06B6D4] px-4 py-2 text-xs font-mono font-bold text-[#06B6D4] inline-flex items-center gap-2 transition"
            >
              <ExternalLink className="size-3.5" />
              <span>Open Public Flow</span>
            </a>
            <button
              type="button"
              onClick={() => setIsLiveDemoOpen(true)}
              className="min-h-[48px] rounded-xl bg-[#25D366] hover:bg-[#20BD5A] text-[#0B141A] px-5 py-2.5 text-xs font-mono font-black uppercase tracking-wide inline-flex items-center gap-2 shadow-lg transition active:scale-95"
            >
              <MessageSquare className="size-4" />
              <span>Launch Live Demo</span>
            </button>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* CUSTOMER STOREFRONT INFO, CLIENT LANGUAGES & DEALS / VIDEO MANAGER        */}
      {/* ========================================================================= */}
      <section className="rounded-2xl border border-[#30363D] bg-[#161B22] p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#30363D] pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <MapPin className="size-4 text-[#06B6D4] shrink-0" />
              <h3 className="text-base font-bold text-[#F0F6FC]">
                Customer WhatsApp Location, Languages &amp; Promo Deals
              </h3>
            </div>
            <p className="text-xs text-[#8B949E] font-sans">
              Configure the address, Google Maps pin, client language options, active video deals, and post-expiry video auto-delete period.
            </p>
          </div>
          <button
            type="button"
            disabled={savingSection === 'ALL'}
            onClick={() => handleSaveSettings('ALL')}
            className="min-h-[46px] rounded-xl bg-[#06B6D4] hover:bg-[#22D3EE] text-[#0D1117] px-4 py-2 text-xs font-mono font-bold uppercase inline-flex items-center gap-2 shrink-0"
          >
            {savingSection === 'ALL' ? (
              <RefreshCw className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            <span>Save Location &amp; Languages</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="space-y-1.5 block">
            <span className="text-xs font-mono text-[#8B949E] block">
              Salon Street Address (Shown in WhatsApp &amp; Flow)
            </span>
            <input
              type="text"
              value={draft.address || ''}
              onChange={(e) => updateDraft({ ...draft, address: e.target.value })}
              placeholder="Plot 42-C, DHA Phase 5, Lahore"
              className="w-full min-h-[46px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3.5 py-2 text-sm text-[#F0F6FC] focus:border-[#06B6D4] focus:outline-none"
            />
          </label>
          <label className="space-y-1.5 block">
            <span className="text-xs font-mono text-[#8B949E] block">
              Google Maps URL
            </span>
            <input
              type="url"
              dir="ltr"
              value={draft.googleMapsUrl || ''}
              onChange={(e) => updateDraft({ ...draft, googleMapsUrl: e.target.value })}
              placeholder="https://maps.google.com/?q=..."
              className="w-full min-h-[46px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3.5 py-2 text-sm font-mono text-[#06B6D4] focus:border-[#06B6D4] focus:outline-none"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_240px] gap-3 items-start">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-mono text-[#8B949E] block">
                Customer Welcome Languages (English is always default)
              </span>
              <span className="text-[11px] font-mono text-[#06B6D4]">
                {conciergeState.region === 'PK'
                  ? 'Asia (Pakistan / India): English · Roman Urdu · اردو'
                  : 'MENA & Europe: English · اردو · العربية'}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {PREVIEW_LANG_TABS.filter((t) =>
                conciergeState.region === 'PK'
                  ? t.id === 'en' || t.id === 'roman_ur' || t.id === 'ur'
                  : t.id === 'en' || t.id === 'ur' || t.id === 'ar'
              ).map((t) => {
                const enabled =
                  t.id === 'en' ||
                  (draft.enabledClientLanguages || ['en']).includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    disabled={t.id === 'en'}
                    onClick={() => handleToggleClientLanguage(t.id)}
                    className={`min-h-[40px] rounded-xl border px-3 text-xs font-semibold flex items-center gap-2 transition ${
                      enabled
                        ? 'border-[#06B6D4] bg-[#06B6D4]/15 text-[#F0F6FC]'
                        : 'border-[#30363D] bg-[#0D1117] text-[#8B949E]'
                    }`}
                  >
                    <Check className={`size-3.5 ${enabled ? 'text-[#06B6D4]' : 'opacity-25'}`} />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <label className="space-y-1.5 block">
            <span className="text-xs font-mono text-[#8B949E] block">
              Auto-Delete Deal Video (Days After Expiry)
            </span>
            <input
              type="number"
              dir="ltr"
              min={1}
              max={365}
              value={draft.videoRetentionDaysAfterExpiry ?? 30}
              onChange={(e) =>
                updateDraft({
                  ...draft,
                  videoRetentionDaysAfterExpiry: Math.max(1, Number(e.target.value) || 30),
                })
              }
              className="w-full min-h-[46px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3.5 py-2 text-sm font-mono font-bold text-[#D29922] focus:border-[#06B6D4] focus:outline-none"
            />
          </label>
        </div>

        {/* Create New Promotional Deal + Video Upload */}
        <form
          onSubmit={handleCreateDeal}
          className="rounded-xl border border-[#30363D] bg-[#0D1117] p-4 space-y-3"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-mono font-bold uppercase text-[#D29922] flex items-center gap-1.5">
              <Tag className="size-3.5" />
              <span>Add Active Deal &amp; Promotional Video</span>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            <input
              type="text"
              required
              value={dealTitle}
              onChange={(e) => setDealTitle(e.target.value)}
              placeholder="Deal Title (e.g. Weekend Grooming Combo)"
              className="min-h-[44px] rounded-xl border border-[#30363D] bg-[#161B22] px-3 text-sm text-[#F0F6FC] focus:border-[#06B6D4] focus:outline-none"
            />
            <select
              value={dealDiscountType}
              onChange={(e) => setDealDiscountType(e.target.value as DealDiscountType)}
              className="min-h-[44px] rounded-xl border border-[#30363D] bg-[#161B22] px-3 text-xs font-mono text-[#F0F6FC] focus:border-[#06B6D4] focus:outline-none"
            >
              <option value="PCT">Percentage OFF (%)</option>
              <option value="FIXED">Fixed Cash OFF ({draft.currency})</option>
              <option value="BUNDLE_PRICE">Bundle Price ({draft.currency})</option>
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                dir="ltr"
                min={1}
                value={dealDiscountValue}
                onChange={(e) => setDealDiscountValue(Number(e.target.value) || 0)}
                placeholder="Value"
                className="min-h-[44px] rounded-xl border border-[#30363D] bg-[#161B22] px-3 text-sm font-mono font-bold text-[#3FB950] focus:border-[#06B6D4] focus:outline-none"
              />
              <input
                type="date"
                dir="ltr"
                required
                value={dealExpiresAt}
                onChange={(e) => setDealExpiresAt(e.target.value)}
                className="min-h-[44px] rounded-xl border border-[#30363D] bg-[#161B22] px-2.5 text-xs font-mono text-[#F0F6FC] focus:border-[#06B6D4] focus:outline-none"
              />
            </div>
          </div>

          <input
            type="text"
            value={dealDesc}
            onChange={(e) => setDealDesc(e.target.value)}
            placeholder="Offer description shown on the mobile deal video page"
            className="w-full min-h-[42px] rounded-xl border border-[#30363D] bg-[#161B22] px-3 text-xs text-[#F0F6FC] focus:border-[#06B6D4] focus:outline-none"
          />

          {/* Included Services */}
          <div className="flex flex-wrap gap-1.5">
            {allServices.map((svc) => {
              const id = svc.id || svc.name;
              const picked = dealServiceIds.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() =>
                    setDealServiceIds((prev) =>
                      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
                    )
                  }
                  className={`min-h-[34px] rounded-lg border px-2.5 text-[11px] font-medium transition ${
                    picked
                      ? 'border-[#3FB950] bg-[#0D3822] text-[#F0F6FC]'
                      : 'border-[#30363D] bg-[#161B22] text-[#8B949E]'
                  }`}
                >
                  {svc.name}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <label className="min-h-[44px] rounded-xl border border-dashed border-[#30363D] hover:border-[#06B6D4] bg-[#161B22] px-3.5 py-2 text-xs font-mono text-[#8B949E] cursor-pointer inline-flex items-center gap-2">
              <Upload className="size-3.5 text-[#06B6D4]" />
              <span>
                {dealVideoFile ? `Attached: ${dealVideoFile.name}` : 'Upload Promo Video (MP4/WebM ≤18MB)'}
              </span>
              <input
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                onChange={handleDealVideoPicked}
                className="sr-only"
              />
            </label>

            <button
              type="submit"
              disabled={isCreatingDeal}
              className="min-h-[44px] rounded-xl bg-[#D29922] hover:bg-[#e0b252] text-[#0D1117] px-5 text-xs font-mono font-black uppercase transition"
            >
              {isCreatingDeal ? 'Saving Deal...' : 'Publish Active Deal'}
            </button>
          </div>
        </form>

        {/* Configured Deals List */}
        {salonDeals.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {salonDeals.map((deal) => {
              const expired = !deal.active || new Date(deal.expiresAt).getTime() <= Date.now();
              const dealPath = `/deal/${encodeURIComponent(salonId)}/${encodeURIComponent(deal.id)}`;
              return (
                <div
                  key={deal.id}
                  className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3.5 space-y-2 text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span
                        className={`text-[10px] font-mono font-bold uppercase ${
                          expired ? 'text-[#F85149]' : 'text-[#3FB950]'
                        }`}
                      >
                        {expired ? 'EXPIRED' : 'ACTIVE'} · Expires{' '}
                        {new Date(deal.expiresAt).toLocaleDateString()}
                      </span>
                      <p className="font-bold text-[#F0F6FC] truncate">{deal.title}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleDeleteDeal(deal.id)}
                      aria-label="Delete deal"
                      className="size-8 rounded-lg border border-[#30363D] text-[#8B949E] hover:text-[#F85149] grid place-items-center shrink-0"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>

                  <p className="text-[11px] text-[#8B949E] line-clamp-2">{deal.description}</p>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#21262D]">
                    <span className="text-[10px] font-mono text-[#8B949E] flex items-center gap-1">
                      <Film className="size-3 text-[#06B6D4]" />
                      {deal.videoDeletedAt
                        ? 'Video purged after retention'
                        : deal.videoUrl
                        ? 'Promo video attached'
                        : 'No video attached'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const fullUrl = `${window.location.origin}${dealPath}`;
                          void navigator.clipboard?.writeText(fullUrl);
                          onShowToast('✓ Deal page link copied.');
                        }}
                        className="min-h-[30px] rounded-lg border border-[#30363D] bg-[#161B22] px-2 text-[10px] font-mono text-[#8B949E] hover:text-[#F0F6FC] inline-flex items-center gap-1"
                      >
                        <Copy className="size-3" />
                        <span>Copy Link</span>
                      </button>
                      <a
                        href={dealPath}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[30px] rounded-lg border border-[#30363D] bg-[#161B22] px-2 text-[10px] font-mono text-[#06B6D4] inline-flex items-center gap-1"
                      >
                        <ExternalLink className="size-3" />
                        <span>Open</span>
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ========================================================================= */}
      {/* MODULE 1: REGION-AWARE LANGUAGE SELECTOR MENU                             */}
      {/* ========================================================================= */}
      <section className="rounded-2xl border border-[#30363D] bg-[#161B22] p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#30363D] pb-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Globe className="size-4 text-[#06B6D4] shrink-0" />
              <h3 className="text-base font-bold text-[#F0F6FC]">
                {rUi.mod1Title}
              </h3>
            </div>
            <p className="text-xs text-[#8B949E] font-sans">
              {rUi.mod1Desc}{' '}
              <span dir="ltr" className="font-mono text-[#F0F6FC] inline-block">{draft.whatsappPhone}</span>
            </p>
          </div>
          <div className="rounded-xl border border-[#30363D] bg-[#0D1117] px-3.5 py-2 shrink-0">
            <span className="text-[10px] font-mono text-[#8B949E] uppercase block">{rUi.detectedRegion}</span>
            <span dir="ltr" className="text-xs font-mono font-bold text-[#06B6D4] inline-block">
              {conciergeState.regionLabel}
            </span>
          </div>
        </div>

        {/* Regional Option Matrix */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-4 space-y-3">
            <span className="text-[11px] font-mono font-bold uppercase text-[#8B949E] block">
              {rUi.activeOptions} ({conciergeState.region})
            </span>
            <div className="flex flex-wrap gap-2">
              {conciergeState.languageOptions.map((opt) => (
                <button
                  key={opt.index}
                  type="button"
                  disabled={isWebhookBusy}
                  onClick={() => handleSendGreetingWebhook(opt.index)}
                  dir={opt.dir}
                  className="min-h-[48px] rounded-xl border border-[#30363D] bg-[#161B22] hover:border-[#06B6D4] px-3.5 py-2 text-sm font-mono font-bold text-[#F0F6FC] transition"
                >
                  [{opt.label}]
                </button>
              ))}
            </div>
            <div className="rounded-xl border border-[#30363D] bg-[#161B22] p-3 text-xs font-mono text-[#F0F6FC] whitespace-pre-line leading-relaxed">
              {conciergeState.greetingPromptPreview}
            </div>
          </div>

          {/* Interactive Greeting & Lock Tester */}
          <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-4 space-y-3">
            <span className="text-[11px] font-mono font-bold uppercase text-[#D29922] block">
              {rUi.simulatorTitle}
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input
                type="text"
                dir="ltr"
                value={simClientName}
                onChange={(e) => setSimClientName(e.target.value)}
                placeholder="Client Name"
                className="min-h-[48px] rounded-xl border border-[#30363D] bg-[#161B22] px-3 text-sm text-left [unicode-bidi:isolate] text-[#F0F6FC] focus:border-[#06B6D4] focus:outline-none"
              />
              <input
                type="text"
                dir="ltr"
                value={simClientPhone}
                onChange={(e) => setSimClientPhone(e.target.value)}
                placeholder="+92 301 5559012"
                className="min-h-[48px] rounded-xl border border-[#30363D] bg-[#161B22] px-3 text-sm text-left [unicode-bidi:isolate] font-mono text-[#F0F6FC] focus:border-[#06B6D4] focus:outline-none"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isWebhookBusy}
                onClick={() => handleSendGreetingWebhook('Hi', true)}
                className="min-h-[48px] flex-1 rounded-xl bg-[#06B6D4] hover:bg-[#22D3EE] text-[#0D1117] px-4 py-2 text-xs font-mono font-bold uppercase transition flex items-center justify-center gap-1.5"
              >
                <Send className="size-3.5" />
                <span>{rUi.sendHiBtn}</span>
              </button>
              {conciergeState.languageOptions.map((opt) => (
                <button
                  key={opt.index}
                  type="button"
                  disabled={isWebhookBusy}
                  onClick={() => handleSendGreetingWebhook(opt.index)}
                  className="min-h-[48px] rounded-xl border border-[#30363D] bg-[#161B22] hover:border-[#3FB950] px-3 py-2 text-xs font-mono font-bold text-[#3FB950] transition"
                >
                  Reply {opt.index}
                </button>
              ))}
            </div>
            {simWebhookReply && (
              <div
                dir={simWebhookReply.replyDir}
                className={`rounded-xl border border-[#116329] bg-[#0D3822] p-3 text-xs text-[#F0F6FC] space-y-1.5 ${
                  simWebhookReply.replyDir === 'rtl' ? 'text-right' : 'text-left'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-[#3FB950]" dir="ltr">
                  <span>ACTION: {simWebhookReply.routedAction}</span>
                  <span>
                    preferred_language: {simWebhookReply.lockedLanguage || 'PENDING'} (dir={simWebhookReply.replyDir})
                  </span>
                </div>
                <p className="whitespace-pre-line leading-relaxed">{simWebhookReply.replyText}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* MODULE 2: RETENTION & REWARDS (9:00 AM BIRTHDAY & SPECIAL EVENT OFFERS)   */}
      {/* ========================================================================= */}
      <section className="rounded-2xl border border-[#30363D] bg-[#161B22] p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#30363D] pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Cake className="size-4 text-[#D29922] shrink-0" />
              <h3 className="text-base font-bold text-[#F0F6FC]">
                {rUi.mod2Title}
              </h3>
            </div>
            <p className="text-xs text-[#8B949E] font-sans">
              {rUi.mod2Desc}
            </p>
          </div>

          <button
            type="button"
            onClick={() => updateDraft({ ...draft, birthdayEnabled: !draft.birthdayEnabled })}
            className={`min-h-[48px] rounded-xl border px-4 py-2 text-xs font-mono font-bold uppercase transition shrink-0 ${
              draft.birthdayEnabled
                ? 'border-[#116329] bg-[#0D3822] text-[#3FB950]'
                : 'border-[#30363D] bg-[#0D1117] text-[#8B949E]'
            }`}
          >
            {draft.birthdayEnabled ? rUi.bdayOn : rUi.bdayOff}
          </button>
        </div>

        {(() => {
          const hasPct = draft.birthdayDiscountPct > 0;
          const hasFixed = draft.birthdayFixedDiscount > 0;
          const hasGift = draft.birthdayGiftService.trim().length > 0;
          const activeCount = [hasPct, hasFixed, hasGift].filter(Boolean).length;
          const offerMode: 'PCT' | 'FIXED' | 'GIFT' | 'COMBO' =
            activeCount > 1
              ? 'COMBO'
              : hasPct
              ? 'PCT'
              : hasFixed
              ? 'FIXED'
              : 'GIFT';

          const setOfferMode = (mode: 'PCT' | 'FIXED' | 'GIFT' | 'COMBO') => {
            if (mode === 'PCT') {
              updateDraft({
                ...draft,
                birthdayDiscountPct: draft.birthdayDiscountPct > 0 ? draft.birthdayDiscountPct : 20,
                birthdayFixedDiscount: 0,
                birthdayGiftService: '',
              });
            } else if (mode === 'FIXED') {
              updateDraft({
                ...draft,
                birthdayDiscountPct: 0,
                birthdayFixedDiscount:
                  draft.birthdayFixedDiscount > 0
                    ? draft.birthdayFixedDiscount
                    : draft.currency === 'PKR'
                    ? 500
                    : 15,
                birthdayGiftService: '',
              });
            } else if (mode === 'GIFT') {
              updateDraft({
                ...draft,
                birthdayDiscountPct: 0,
                birthdayFixedDiscount: 0,
                birthdayGiftService: draft.birthdayGiftService.trim() || 'Free Hair Oiling & Wash',
              });
            } else {
              updateDraft({
                ...draft,
                birthdayDiscountPct: draft.birthdayDiscountPct > 0 ? draft.birthdayDiscountPct : 20,
                birthdayFixedDiscount:
                  draft.birthdayFixedDiscount > 0
                    ? draft.birthdayFixedDiscount
                    : draft.currency === 'PKR'
                    ? 300
                    : 10,
                birthdayGiftService: draft.birthdayGiftService.trim() || 'Free Complimentary Styling',
              });
            }
          };

          return (
            <div className="space-y-3">
              {/* Event Name + Single vs Combo Mode Selector */}
              <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <label className="flex-1 space-y-1">
                    <span className="text-[10px] font-mono font-bold uppercase text-[#8B949E] block">
                      Event / Campaign Title (All Clients Receive This)
                    </span>
                    <input
                      type="text"
                      dir="ltr"
                      value={draft.birthdayEventName || ''}
                      onChange={(e) => updateDraft({ ...draft, birthdayEventName: e.target.value })}
                      placeholder="e.g. Birthday Special, Eid Deal, Party Makeup, Bridal Package"
                      className="w-full min-h-[40px] rounded-lg border border-[#30363D] bg-[#161B22] px-3 text-xs text-left [unicode-bidi:isolate] font-mono font-bold text-[#F0F6FC] focus:border-[#06B6D4] focus:outline-none"
                    />
                  </label>
                  <div className="flex flex-wrap gap-1.5 shrink-0">
                    {(
                      [
                        { id: 'PCT', label: '% Only' },
                        { id: 'FIXED', label: `${draft.currency} Cash Only` },
                        { id: 'GIFT', label: 'Service Only' },
                        { id: 'COMBO', label: 'Combo Mix' },
                      ] as const
                    ).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setOfferMode(m.id)}
                        className={`min-h-[40px] rounded-lg border px-2.5 py-1 text-[11px] font-mono font-bold transition ${
                          offerMode === m.id
                            ? 'border-[#06B6D4] bg-[#06B6D4]/15 text-[#06B6D4]'
                            : 'border-[#30363D] bg-[#161B22] text-[#8B949E] hover:text-[#F0F6FC]'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quick Event Offer Presets */}
                <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[#21262D]">
                  <span className="text-[10px] font-mono text-[#8B949E] mr-1">1-Tap Rules:</span>
                  {[
                    {
                      label: '🎂 Birthday · 20% OFF Only',
                      eventName: 'Birthday Special',
                      pct: 20,
                      fixed: 0,
                      gift: '',
                      tpl: 'Happy Birthday {client_name}! {salon_name} gifts you {offer_summary} on your special day.',
                    },
                    {
                      label: '🌙 Eid Deal · Free Hair Oiling',
                      eventName: 'Eid Mubarak Deal',
                      pct: 0,
                      fixed: 0,
                      gift: 'Free Hair Oiling Treatment',
                      tpl: 'Eid Mubarak {client_name}! Celebrate with {salon_name}: enjoy {offer_summary} this festive week.',
                    },
                    {
                      label: `💄 Party Makeup · ${draft.currencySymbol}500 OFF`,
                      eventName: 'Party Makeup Offer',
                      pct: 0,
                      fixed: 500,
                      gift: '',
                      tpl: 'Special invitation for {client_name} from {salon_name}: enjoy {offer_summary} on your booking!',
                    },
                    {
                      label: `👰 Groom & Bridal Combo · 20% + ${draft.currencySymbol}300 + Free Service`,
                      eventName: 'Bridal & Groom Package',
                      pct: 20,
                      fixed: 300,
                      gift: '1 Free Signature Service',
                      tpl: 'Congratulations {client_name}! Claim your {offer_summary} at {salon_name}.',
                    },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() =>
                        updateDraft({
                          ...draft,
                          birthdayEventName: preset.eventName,
                          birthdayDiscountPct: preset.pct,
                          birthdayFixedDiscount: preset.fixed,
                          birthdayGiftService: preset.gift,
                          birthdayMessageTemplate: preset.tpl,
                        })
                      }
                      className="min-h-[34px] rounded-lg border border-[#30363D] bg-[#161B22] hover:border-[#D29922] px-2.5 py-1 text-[11px] font-mono text-[#F0F6FC] transition"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className={`space-y-1.5 block ${!hasPct && offerMode !== 'COMBO' ? 'opacity-60' : ''}`}>
                  <span className="text-xs font-mono text-[#8B949E] block">Discount Percentage (%) · 0 = Off</span>
                  <input
                    type="number"
                    dir="ltr"
                    min={0}
                    max={100}
                    value={draft.birthdayDiscountPct}
                    onChange={(e) =>
                      updateDraft({
                        ...draft,
                        birthdayDiscountPct: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                    className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3.5 py-2 text-sm text-left [unicode-bidi:isolate] font-mono font-bold text-[#D29922] focus:border-[#06B6D4] focus:outline-none"
                  />
                </label>

                <label className={`space-y-1.5 block ${!hasFixed && offerMode !== 'COMBO' ? 'opacity-60' : ''}`}>
                  <span className="text-xs font-mono text-[#8B949E] block">
                    Fixed Cash OFF ({draft.currency}) · 0 = Off
                  </span>
                  <input
                    type="number"
                    dir="ltr"
                    min={0}
                    value={draft.birthdayFixedDiscount}
                    onChange={(e) =>
                      updateDraft({
                        ...draft,
                        birthdayFixedDiscount: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                    className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3.5 py-2 text-sm text-left [unicode-bidi:isolate] font-mono font-bold text-[#D29922] focus:border-[#06B6D4] focus:outline-none"
                  />
                </label>

                <label className={`space-y-1.5 block ${!hasGift && offerMode !== 'COMBO' ? 'opacity-60' : ''}`}>
                  <span className="text-xs font-mono text-[#8B949E] block">Complimentary Free Service</span>
                  <input
                    type="text"
                    dir="ltr"
                    value={draft.birthdayGiftService}
                    onChange={(e) => updateDraft({ ...draft, birthdayGiftService: e.target.value })}
                    placeholder="Leave blank if no free service"
                    className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3.5 py-2 text-sm text-left [unicode-bidi:isolate] text-[#F0F6FC] focus:border-[#06B6D4] focus:outline-none"
                  />
                </label>
              </div>
            </div>
          );
        })()}

        <label className="space-y-1.5 block">
          <span className="text-xs font-mono text-[#8B949E] block">
            Customizable Offer Message Text (Tokens: {'{client_name}'}, {'{salon_name}'}, {'{offer_summary}'})
          </span>
          <textarea
            rows={2}
            value={draft.birthdayMessageTemplate}
            onChange={(e) => updateDraft({ ...draft, birthdayMessageTemplate: e.target.value })}
            className="w-full rounded-xl border border-[#30363D] bg-[#0D1117] px-3.5 py-2.5 text-sm text-[#F0F6FC] focus:border-[#06B6D4] focus:outline-none"
          />
        </label>

        {/* Live Language Preview */}
        <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3.5 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-mono font-bold text-[#8B949E] uppercase">
              9:00 AM Dispatch Live Preview
            </span>
            <div className="flex flex-wrap gap-1.5">
              {PREVIEW_LANG_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setPreviewLang(t.id)}
                  className={`min-h-[36px] rounded-lg border px-2.5 py-1 text-xs font-mono font-bold transition ${
                    previewLang === t.id
                      ? 'border-[#06B6D4] bg-[#06B6D4]/15 text-[#06B6D4]'
                      : 'border-[#30363D] bg-[#161B22] text-[#8B949E]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <p
            dir={activeDir}
            className={`rounded-xl border border-[#30363D] bg-[#161B22] p-3 text-sm text-[#F0F6FC] leading-relaxed ${
              activeDir === 'rtl' ? 'text-right' : 'text-left'
            }`}
          >
            {formatBirthdayPreview(previewLang)}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => handleTriggerCron('birthday_9am')}
            className="min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] hover:border-[#D29922] px-4 py-2 text-xs font-mono font-bold text-[#D29922] transition flex items-center gap-2"
          >
            <Play className="size-3.5" />
            <span>{rUi.test9amBtn}</span>
          </button>

          <button
            type="button"
            disabled={savingSection === 'BIRTHDAY'}
            onClick={() => handleSaveSettings('BIRTHDAY')}
            className="min-h-[48px] rounded-xl bg-[#06B6D4] hover:bg-[#22D3EE] text-[#0D1117] px-5 py-2 text-xs font-mono font-bold uppercase transition flex items-center gap-2"
          >
            {savingSection === 'BIRTHDAY' ? <RefreshCw className="size-4 animate-spin" /> : <Save className="size-4" />}
            <span>{rUi.saveBtn}</span>
          </button>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* MODULE 3: WIN-BACK RULES (30-DAY DORMANT CLIENT ENGINE)                   */}
      {/* ========================================================================= */}
      <section className="rounded-2xl border border-[#30363D] bg-[#161B22] p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#30363D] pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-[#06B6D4] shrink-0" />
              <h3 className="text-base font-bold text-[#F0F6FC]">
                {rUi.mod3Title}
              </h3>
            </div>
            <p className="text-xs text-[#8B949E] font-sans">
              {rUi.mod3Desc} ({draft.winbackDays}d)
            </p>
          </div>

          <button
            type="button"
            onClick={() => updateDraft({ ...draft, winbackEnabled: !draft.winbackEnabled })}
            className={`min-h-[48px] rounded-xl border px-4 py-2 text-xs font-mono font-bold uppercase transition shrink-0 ${
              draft.winbackEnabled
                ? 'border-[#116329] bg-[#0D3822] text-[#3FB950]'
                : 'border-[#30363D] bg-[#0D1117] text-[#8B949E]'
            }`}
          >
            {draft.winbackEnabled ? rUi.winbackOn : rUi.winbackOff}
          </button>
        </div>

        {(() => {
          const wPct = draft.winbackDiscountPct > 0;
          const wFixed = (draft.winbackFixedDiscount ?? 0) > 0;
          const wSvc = draft.winbackAddonService.trim().length > 0;
          const wCount = [wPct, wFixed, wSvc].filter(Boolean).length;
          const wMode: 'PCT' | 'FIXED' | 'GIFT' | 'COMBO' =
            wCount > 1 ? 'COMBO' : wPct ? 'PCT' : wFixed ? 'FIXED' : 'GIFT';

          const setWinbackMode = (mode: 'PCT' | 'FIXED' | 'GIFT' | 'COMBO') => {
            if (mode === 'PCT') {
              updateDraft({
                ...draft,
                winbackDiscountPct: draft.winbackDiscountPct > 0 ? draft.winbackDiscountPct : 15,
                winbackFixedDiscount: 0,
                winbackAddonService: '',
              });
            } else if (mode === 'FIXED') {
              updateDraft({
                ...draft,
                winbackDiscountPct: 0,
                winbackFixedDiscount:
                  (draft.winbackFixedDiscount ?? 0) > 0
                    ? draft.winbackFixedDiscount
                    : draft.currency === 'PKR'
                    ? 500
                    : 10,
                winbackAddonService: '',
              });
            } else if (mode === 'GIFT') {
              updateDraft({
                ...draft,
                winbackDiscountPct: 0,
                winbackFixedDiscount: 0,
                winbackAddonService: draft.winbackAddonService.trim() || 'Free Express Hair Wash & Styling',
              });
            } else {
              updateDraft({
                ...draft,
                winbackDiscountPct: draft.winbackDiscountPct > 0 ? draft.winbackDiscountPct : 15,
                winbackFixedDiscount: draft.winbackFixedDiscount ?? 0,
                winbackAddonService: draft.winbackAddonService.trim() || 'Free Express Hair Wash & Styling',
              });
            }
          };

          return (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#30363D] bg-[#0D1117] px-3 py-2.5">
                <span className="text-[11px] font-mono font-bold uppercase text-[#06B6D4]">
                  Win-Back Offer Scope (Single Option or Both)
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      { id: 'PCT', label: '% Only' },
                      { id: 'FIXED', label: `${draft.currency} Cash Only` },
                      { id: 'GIFT', label: 'Service Only' },
                      { id: 'COMBO', label: 'Combo Both' },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setWinbackMode(m.id)}
                      className={`min-h-[38px] rounded-lg border px-2.5 py-1 text-[11px] font-mono font-bold transition ${
                        wMode === m.id
                          ? 'border-[#06B6D4] bg-[#06B6D4]/15 text-[#06B6D4]'
                          : 'border-[#30363D] bg-[#161B22] text-[#8B949E] hover:text-[#F0F6FC]'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <label className="space-y-1.5 block">
                  <span className="text-xs font-mono text-[#8B949E] block">Inactivity Trigger (Days)</span>
                  <input
                    type="number"
                    dir="ltr"
                    min={1}
                    max={365}
                    value={draft.winbackDays}
                    onChange={(e) =>
                      updateDraft({
                        ...draft,
                        winbackDays: Math.max(1, Number(e.target.value) || 30),
                      })
                    }
                    className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3.5 py-2 text-sm text-left [unicode-bidi:isolate] font-mono font-bold text-[#06B6D4] focus:border-[#06B6D4] focus:outline-none"
                  />
                </label>

                <label className={`space-y-1.5 block ${!wPct && wMode !== 'COMBO' ? 'opacity-60' : ''}`}>
                  <span className="text-xs font-mono text-[#8B949E] block">Win-Back % (0 = Off)</span>
                  <input
                    type="number"
                    dir="ltr"
                    min={0}
                    max={100}
                    value={draft.winbackDiscountPct}
                    onChange={(e) =>
                      updateDraft({
                        ...draft,
                        winbackDiscountPct: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                    className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3.5 py-2 text-sm text-left [unicode-bidi:isolate] font-mono font-bold text-[#D29922] focus:border-[#06B6D4] focus:outline-none"
                  />
                </label>

                <label className={`space-y-1.5 block ${!wFixed && wMode !== 'COMBO' ? 'opacity-60' : ''}`}>
                  <span className="text-xs font-mono text-[#8B949E] block">
                    Cash OFF ({draft.currency})
                  </span>
                  <input
                    type="number"
                    dir="ltr"
                    min={0}
                    value={draft.winbackFixedDiscount ?? 0}
                    onChange={(e) =>
                      updateDraft({
                        ...draft,
                        winbackFixedDiscount: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                    className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3.5 py-2 text-sm text-left [unicode-bidi:isolate] font-mono font-bold text-[#D29922] focus:border-[#06B6D4] focus:outline-none"
                  />
                </label>

                <label className={`space-y-1.5 block ${!wSvc && wMode !== 'COMBO' ? 'opacity-60' : ''}`}>
                  <span className="text-xs font-mono text-[#8B949E] block">Free Add-On Service</span>
                  <input
                    type="text"
                    dir="ltr"
                    value={draft.winbackAddonService}
                    onChange={(e) => updateDraft({ ...draft, winbackAddonService: e.target.value })}
                    placeholder="Blank if none"
                    className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3.5 py-2 text-sm text-left [unicode-bidi:isolate] text-[#F0F6FC] focus:border-[#06B6D4] focus:outline-none"
                  />
                </label>
              </div>
            </div>
          );
        })()}

        <label className="space-y-1.5 block">
          <span className="text-xs font-mono text-[#8B949E] block">
            Win-Back Message Template (Tokens: {'{client_name}'}, {'{salon_name}'}, {'{days}'}, {'{offer_summary}'})
          </span>
          <textarea
            rows={2}
            value={draft.winbackMessageTemplate}
            onChange={(e) => updateDraft({ ...draft, winbackMessageTemplate: e.target.value })}
            className="w-full rounded-xl border border-[#30363D] bg-[#0D1117] px-3.5 py-2.5 text-sm text-[#F0F6FC] focus:border-[#06B6D4] focus:outline-none"
          />
        </label>

        <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3.5 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-mono font-bold text-[#8B949E] uppercase">
              Win-Back Live Preview ({previewLang.toUpperCase()} · {dormantClients.length} Dormant Client(s) Eligible)
            </span>
          </div>
          <p
            dir={activeDir}
            className={`rounded-xl border border-[#30363D] bg-[#161B22] p-3 text-sm text-[#F0F6FC] leading-relaxed ${
              activeDir === 'rtl' ? 'text-right' : 'text-left'
            }`}
          >
            {formatWinBackPreview(previewLang)}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleTriggerCron('winback_30d')}
              className="min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] hover:border-[#06B6D4] px-4 py-2 text-xs font-mono font-bold text-[#06B6D4] transition flex items-center gap-2"
            >
              <Play className="size-3.5" />
              <span>Run 30-Day Win-Back Scan</span>
            </button>
            <button
              type="button"
              disabled={dormantClients.length === 0 || isWebhookBusy}
              onClick={async () => {
                const target = dormantClients[0];
                if (!target) return;
                await fetch(`/api/salons/${encodeURIComponent(salonId)}/concierge/simulate`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    fromPhone: target.phone,
                    clientName: target.name,
                    messageText: 'REBOOK',
                  }),
                }).then((r) => r.json()).then((d) => {
                  onStateUpdated(d.state);
                  onShowToast(`✓ 1-Tap REBOOK confirmed for ${target.name}!`);
                });
              }}
              className="min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] hover:border-[#3FB950] px-4 py-2 text-xs font-mono font-bold text-[#3FB950] transition disabled:opacity-40"
            >
              Test 1-Tap &ldquo;REBOOK&rdquo; Reply
            </button>
          </div>

          <button
            type="button"
            disabled={savingSection === 'WINBACK'}
            onClick={() => handleSaveSettings('WINBACK')}
            className="min-h-[48px] rounded-xl bg-[#06B6D4] hover:bg-[#22D3EE] text-[#0D1117] px-5 py-2 text-xs font-mono font-bold uppercase transition flex items-center gap-2"
          >
            {savingSection === 'WINBACK' ? <RefreshCw className="size-4 animate-spin" /> : <Save className="size-4" />}
            <span>Save Settings</span>
          </button>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* MODULE 4: POST-SERVICE GOOGLE REVIEW & SMART REPUTATION ROUTER (T+2H)     */}
      {/* Strictly gated: Hidden for STARTER tier (PRO / PRO++ only)                */}
      {/* ========================================================================= */}
      {packageTier !== 'STARTER' && (
      <section className="rounded-2xl border border-[#30363D] bg-[#161B22] p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#30363D] pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Star className="size-4 text-[#D29922] shrink-0" />
              <h3 className="text-base font-bold text-[#F0F6FC]">
                {rUi.mod4Title}
              </h3>
            </div>
            <p className="text-xs text-[#8B949E] font-sans">
              {rUi.mod4Desc}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setDraft({ ...draft, reviewBoosterEnabled: !draft.reviewBoosterEnabled })}
            className={`min-h-[48px] rounded-xl border px-4 py-2 text-xs font-mono font-bold uppercase transition shrink-0 ${
              draft.reviewBoosterEnabled
                ? 'border-[#116329] bg-[#0D3822] text-[#3FB950]'
                : 'border-[#30363D] bg-[#0D1117] text-[#8B949E]'
            }`}
          >
            {draft.reviewBoosterEnabled ? rUi.boosterOn : rUi.boosterOff}
          </button>
        </div>

        <label className="space-y-1.5 block">
          <span className="text-xs font-mono text-[#8B949E] flex items-center gap-1.5">
            <Link2 className="size-3.5 text-[#06B6D4]" />
            <span>{rUi.googleUrlLabel}</span>
          </span>
          <input
            type="url"
            dir="ltr"
            value={draft.googleReviewUrl}
            onChange={(e) => setDraft({ ...draft, googleReviewUrl: e.target.value })}
            placeholder="https://g.page/r/your-salon/review"
            className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3.5 py-2 text-sm text-left [unicode-bidi:isolate] font-mono text-[#06B6D4] break-all focus:border-[#06B6D4] focus:outline-none"
          />
          <span className="text-[11px] font-mono text-[#8B949E] break-all block">
            Active Public Link (4–5★ only): {draft.googleReviewUrl}
          </span>
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3.5 space-y-2">
            <span className="text-[11px] font-mono font-bold text-[#8B949E] uppercase block">
              T+2 Hours Feedback Prompt ({previewLang.toUpperCase()})
            </span>
            <p
              dir={activeDir}
              className={`rounded-xl border border-[#30363D] bg-[#161B22] p-3 text-sm text-[#F0F6FC] ${
                activeDir === 'rtl' ? 'text-right' : 'text-left'
              }`}
            >
              {formatReviewPromptPreview(previewLang)}
            </p>
          </div>

          <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3.5 space-y-2.5">
            <span className="text-[11px] font-mono font-bold text-[#D29922] uppercase block">
              Test Smart Reputation Routing (Simulate Client Reply)
            </span>
            <div className="grid grid-cols-5 gap-1.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  disabled={isWebhookBusy}
                  onClick={() => handleSimulateStarFeedback(star)}
                  className={`min-h-[48px] rounded-xl border font-mono text-xs font-bold transition ${
                    star <= 3
                      ? 'border-[#da3633] bg-[#4C1C1D] text-[#F85149] hover:bg-[#5e2223]'
                      : 'border-[#116329] bg-[#0D3822] text-[#3FB950] hover:bg-[#114a2d]'
                  }`}
                >
                  {star}★
                </button>
              ))}
            </div>
            {ratingSimOutcome && (
              <div
                dir={ratingSimOutcome.replyDir}
                className={`rounded-xl border p-3 text-xs space-y-1 ${
                  ratingSimOutcome.rating <= 3
                    ? 'border-[#da3633] bg-[#4C1C1D] text-[#F0F6FC]'
                    : 'border-[#116329] bg-[#0D3822] text-[#F0F6FC]'
                } ${ratingSimOutcome.replyDir === 'rtl' ? 'text-right' : 'text-left'}`}
              >
                <span className="text-[10px] font-mono font-bold uppercase block" dir="ltr">
                  {ratingSimOutcome.rating <= 3
                    ? 'GOOGLE LINK SUPPRESSED · OWNER_INTERVENTION_NEEDED ALERT SENT'
                    : '4–5★ POSITIVE · PUBLIC GOOGLE LINK SENT'}
                </span>
                <p className="break-all leading-relaxed">{ratingSimOutcome.replyText}</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => handleTriggerCron('review_t2h')}
            className="min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] hover:border-[#D29922] px-4 py-2 text-xs font-mono font-bold text-[#D29922] transition flex items-center gap-2"
          >
            <Play className="size-3.5" />
            <span>Dispatch T+2h Prompts Now</span>
          </button>

          <button
            type="button"
            disabled={savingSection === 'REVIEW'}
            onClick={() => handleSaveSettings('REVIEW')}
            className="min-h-[48px] rounded-xl bg-[#06B6D4] hover:bg-[#22D3EE] text-[#0D1117] px-5 py-2 text-xs font-mono font-bold uppercase transition flex items-center gap-2"
          >
            {savingSection === 'REVIEW' ? <RefreshCw className="size-4 animate-spin" /> : <Save className="size-4" />}
            <span>Save Settings</span>
          </button>
        </div>
      </section>
      )}

      {/* ========================================================================= */}
      {/* CLIENT PROFILES: OPTIONAL BIRTH_DATE (DD/MM) & LAST VISIT TRACKER         */}
      {/* ========================================================================= */}
      <section className="rounded-2xl border border-[#30363D] bg-[#161B22] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#30363D] pb-3">
          <div className="flex items-center gap-2">
            <UserPlus className="size-4 text-[#06B6D4]" />
            <h3 className="text-base font-bold text-[#F0F6FC]">
              {rUi.profilesTitle}
            </h3>
          </div>
          <span className="text-xs font-mono text-[#8B949E]">
            {conciergeState.clients.length} {rUi.trackedCount}
          </span>
        </div>

        <form onSubmit={handleSaveClientBirthDate} className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
          <input
            type="text"
            dir="ltr"
            value={newBirthClientName}
            onChange={(e) => setNewBirthClientName(e.target.value)}
            placeholder="Client Name"
            className="min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3 text-sm text-left [unicode-bidi:isolate] text-[#F0F6FC] focus:border-[#06B6D4] focus:outline-none"
          />
          <input
            type="text"
            dir="ltr"
            required
            value={newBirthClientPhone}
            onChange={(e) => setNewBirthClientPhone(e.target.value)}
            placeholder="WhatsApp (+92...)"
            className="min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3 text-sm text-left [unicode-bidi:isolate] font-mono text-[#F0F6FC] focus:border-[#06B6D4] focus:outline-none"
          />
          <input
            type="text"
            dir="ltr"
            value={newBirthDayMonth}
            onChange={(e) => setNewBirthDayMonth(e.target.value)}
            placeholder="Birth Date (DD/MM)"
            className="min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3 text-sm text-left [unicode-bidi:isolate] font-mono text-[#D29922] focus:border-[#06B6D4] focus:outline-none"
          />
          <select
            value={newBirthLang}
            onChange={(e) => setNewBirthLang(e.target.value as ClientPreferredLang)}
            className="min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3 text-sm font-mono text-[#F0F6FC] focus:border-[#06B6D4] focus:outline-none"
          >
            <option value="en">English</option>
            <option value="roman_ur">Roman Urdu</option>
            <option value="ur">اردو (Urdu)</option>
            <option value="ar">العربية (Arabic)</option>
          </select>
          <button
            type="submit"
            className="min-h-[48px] rounded-xl bg-[#06B6D4] hover:bg-[#22D3EE] text-[#0D1117] px-4 text-xs font-mono font-bold uppercase transition"
          >
            {rUi.saveProfileBtn}
          </button>
        </form>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {conciergeState.clients.map((cli) => {
            const lastVisitLabel = cli.lastCompletedVisitAt
              ? `${Math.floor((Date.now() - new Date(cli.lastCompletedVisitAt).getTime()) / 86400000)}d ago (${new Date(cli.lastCompletedVisitAt).toLocaleDateString()})`
              : 'No completed visit yet';
            return (
              <div
                key={cli.id}
                className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3.5 space-y-1 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-[#F0F6FC]">{cli.name}</span>
                  <span className="rounded-md border border-[#30363D] bg-[#161B22] px-2 py-0.5 font-mono text-[10px] text-[#06B6D4]">
                    {cli.preferredLanguage ? `LANG: ${cli.preferredLanguage.toUpperCase()}` : 'AWAITING LANG'}
                  </span>
                </div>
                <p className="font-mono text-[11px] text-[#8B949E]">{cli.phone}</p>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] font-mono">
                  <span className="text-[#D29922]">
                    Birth Date (DD/MM): {cli.birthDate || 'Not set'}
                  </span>
                  <span className="text-[#3FB950]">Last Visit: {lastVisitLabel}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Recent Concierge Dispatch Log */}
        {conciergeState.logs.length > 0 && (
          <div className="pt-2 space-y-2">
            <span className="text-[11px] font-mono font-bold uppercase text-[#8B949E] flex items-center gap-1.5">
              <MessageSquare className="size-3.5 text-[#06B6D4]" />
              <span>Recent Automated WhatsApp Webhook &amp; Cron Dispatches</span>
            </span>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {conciergeState.logs.slice(0, 8).map((log) => (
                <div
                  key={log.id}
                  className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3 space-y-1 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-[#8B949E]">
                    <span>
                      [{log.module}] {log.direction} · {log.clientName} ({log.clientPhone})
                    </span>
                    <span>
                      {log.language.toUpperCase()} · {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p
                    dir={log.dir}
                    className={`text-[#F0F6FC] leading-relaxed break-words [overflow-wrap:break-word] ${
                      log.dir === 'rtl' ? 'text-right' : 'text-left'
                    }`}
                  >
                    {log.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <CustomerWhatsAppDemoModal
        salonId={salonId}
        isOpen={isLiveDemoOpen}
        onClose={() => setIsLiveDemoOpen(false)}
      />
    </div>
  );
};
