import React, { useState, useMemo } from 'react';
import {
  Download,
  CheckCircle2,
  QrCode,
  CreditCard,
  Building,
  Smartphone,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  Check,
  Plus,
  Video,
  Clock,
  Upload,
  PhoneCall,
  AlertOctagon,
  Sparkle,
  Sliders,
  Lock,
  Globe,
  Languages,
  X,
  ChevronDown,
  ChevronUp,
  Scissors,
  MessageSquare,
} from 'lucide-react';
import { PortalCard } from './PortalCard';
import { SalonOwnerDashboard } from './SalonOwnerDashboard';
import { ServiceItem } from '../types/workcraft';
import { SalonWindowPosterPdf, PosterLang } from './SalonWindowPosterPdf';

export type SalonLanguage = 'URDU' | 'ARABIC' | 'ROMAN_URDU' | 'ENGLISH';
export type RegionalTier = 'PAKISTAN' | 'MENA' | 'EUROPE_GLOBAL';

export const detectRegionalTier = (regionCode: string): RegionalTier => {
  if (regionCode === '+92') return 'PAKISTAN';
  if (regionCode === '+971' || regionCode === '+966') return 'MENA';
  if (regionCode === '+44' || regionCode === '+1') return 'EUROPE_GLOBAL';
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz.includes('Karachi') || tz.includes('Pakistan')) return 'PAKISTAN';
    if (tz.includes('Dubai') || tz.includes('Riyadh') || tz.includes('Qatar') || tz.includes('Kuwait')) return 'MENA';
    if (tz.includes('London') || tz.includes('Europe') || tz.includes('America')) return 'EUROPE_GLOBAL';
  } catch (e) {
    // default
  }
  return 'PAKISTAN';
};

interface SalonPwaSimulatorProps {
  salonName?: string;
  token?: string;
  onPairingComplete: (salonName: string) => void;
  onClose?: () => void;
  socialCampaignSource?: string | null;
  onReturnToFounder?: () => void;
}

export const SalonPwaSimulator: React.FC<SalonPwaSimulatorProps> = ({
  salonName = 'Royal Fade Lounge',
  token = 'wc_sec_rfade_9821',
  onPairingComplete,
  onClose,
  socialCampaignSource,
  onReturnToFounder,
}) => {
  // Step 1: Salon Details & Location State (Unified with 4-Step Engine)
  const [inputSalonName, setInputSalonName] = useState(salonName || 'Royal Fade Lounge');
  const [inputOwnerName, setInputOwnerName] = useState('Hamza Tariq');
  const [inputPhone, setInputPhone] = useState('300 4567890');
  const [inputAddress, setInputAddress] = useState('Sector C, CCA Phase 5 DHA, Lahore');
  const [step1Error, setStep1Error] = useState<string | null>(null);

  // 3-Tier Regional Language Engine (Pakistan vs MENA vs Europe/Global)
  const [selectedRegion, setSelectedRegion] = useState<'+92' | '+971' | '+44' | '+91'>('+92');
  const [regionalTier, setRegionalTier] = useState<RegionalTier>(() => detectRegionalTier('+92'));
  const [selectedLanguage, setSelectedLanguage] = useState<SalonLanguage>('URDU');
  const [isLanguageGateOpen, setIsLanguageGateOpen] = useState(false);

  const handleSwitchRegion = (newRegion: '+92' | '+971' | '+44') => {
    setSelectedRegion(newRegion);
    const newTier = detectRegionalTier(newRegion);
    setRegionalTier(newTier);
    if (newTier === 'PAKISTAN') {
      setSelectedLanguage('URDU');
    } else if (newTier === 'MENA') {
      setSelectedLanguage('ARABIC');
    } else {
      setSelectedLanguage('ENGLISH');
    }
  };

  // PWA Step State (4-Step Onboarding Engine)
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1); // 1: Salon Info & Location, 2: Menu & Staff, 3: Package & 10% SLA, 4: Link WhatsApp
  const [isPwaInstalled, setIsPwaInstalled] = useState(false);
  const [isDashboardLaunched, setIsDashboardLaunched] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<'MENS' | 'LADIES'>('MENS');

  // Pre-populated Service Menus
  const [mensServices, setMensServices] = useState<ServiceItem[]>([
    { id: 'm1', name: 'Classic Hair Cut & Wash', price: 800, enabled: true },
    { id: 'm2', name: 'Beard Trim & Contouring', price: 400, enabled: true },
    { id: 'm3', name: 'Charcoal Deep Cleansing Facial', price: 2000, enabled: true },
    { id: 'm4', name: 'Hair Color / Camo', price: 1500, enabled: true },
    { id: 'm5', name: 'Head Massage (Mint Oil)', price: 500, enabled: false },
    { id: 'm6', name: 'Groom Signature Package', price: 12000, enabled: true },
  ]);

  const [ladiesServices, setLadiesServices] = useState<ServiceItem[]>([
    { id: 'l1', name: 'Signature Party Makeup & Styling', price: 4500, enabled: true },
    { id: 'l2', name: 'Barat / Walima Bridal Package', price: 35000, enabled: true },
    { id: 'l3', name: 'Hydra-Facial & Skin Polish', price: 3500, enabled: true },
    { id: 'l4', name: 'Keratin Hair Rebonding / Smoothing', price: 12000, enabled: true },
    { id: 'l5', name: 'Mani-Pedi Classic Spa', price: 2000, enabled: false },
    { id: 'l6', name: 'Full Face Threading & Waxing', price: 1200, enabled: true },
  ]);

  // Regional Payment State
  const [paymentMethod, setPaymentMethod] = useState('EasyPaisa');
  const [isPaymentProcessing, setIsPaymentProcessing] = useState(false);
  const [isPaymentConfirmed, setIsPaymentConfirmed] = useState(false);

  // Custom Service Add State
  const [isAddingService, setIsAddingService] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('1500');

  // Barbers & Stylists Roster State (Query 8)
  const [barbersRoster, setBarbersRoster] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('wcl_salon_barbers');
      if (saved) return JSON.parse(saved);
    } catch {}
    return ['Master Aslam', 'Zahid Hussain', 'Ali Raza'];
  });
  const [newBarberInput, setNewBarberInput] = useState('');

  const handleAddBarber = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBarberInput.trim()) return;
    const updated = [...barbersRoster, newBarberInput.trim()];
    setBarbersRoster(updated);
    setNewBarberInput('');
    try {
      localStorage.setItem('wcl_salon_barbers', JSON.stringify(updated));
    } catch {}
  };

  const handleRemoveBarber = (name: string) => {
    const updated = barbersRoster.filter((b) => b !== name);
    setBarbersRoster(updated);
    try {
      localStorage.setItem('wcl_salon_barbers', JSON.stringify(updated));
    } catch {}
  };

  // Remote 8-Digit WhatsApp Pairing vs In-Person QR State
  const [pairingMode, setPairingMode] = useState<'REMOTE_CODE' | 'VISUAL_QR'>('REMOTE_CODE');
  const [pairingCode] = useState('WKC-7921');
  const [enteredCode, setEnteredCode] = useState('WKC-7921');
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [isCodeVerified, setIsCodeVerified] = useState(false);
  const [isCopiedCode, setIsCopiedCode] = useState(false);
  const [isHomeShortcutInstalled, setIsHomeShortcutInstalled] = useState(false);

  // 7-Day Free Trial & First-Time Initial Purchase Package State
  const [trialMode, setTrialMode] = useState<'EXPIRED_DAY8' | 'ACTIVE_TRIAL'>('EXPIRED_DAY8');
  const [selectedPackageTier, setSelectedPackageTier] = useState<'STARTER' | 'GROWTH' | 'VIP' | 'CUSTOM'>('GROWTH');
  const [expandedPackageId, setExpandedPackageId] = useState<'STARTER' | 'GROWTH' | 'VIP' | 'CUSTOM' | null>('GROWTH');
  const [isTestingSandboxUnlocked, setIsTestingSandboxUnlocked] = useState(true);

  const PACKAGES = [
    {
      id: 'STARTER',
      name: 'Starter Setup',
      setupPrice: 15000,
      monthlyMaint: 1500, // 10%
      setupPriceUsd: 75,
      monthlyMaintUsd: 7.5, // 10%
      maintFormula: '10% Monthly Fee (PKR 1,500/mo or $7.50/mo)',
      bookingsLimit: '500 bookings/mo',
      description: '24/7 WhatsApp Auto-Reply Booking · Rate List & Appointment Confirmations · Up to 500 bookings/mo',
      badge: 'ENTRY LEVEL',
    },
    {
      id: 'GROWTH',
      name: 'Growth Automation',
      setupPrice: 20000,
      monthlyMaint: 2000, // 10%
      setupPriceUsd: 110,
      monthlyMaintUsd: 11.0, // 10%
      maintFormula: '10% Monthly Fee (PKR 2,000/mo or $11.00/mo)',
      bookingsLimit: '1,500 bookings/mo',
      description: 'Auto Backup Phone Line · WhatsApp Auto-Reply + Google 5-Star Review Requests · Up to 1,500 bookings/mo',
      badge: 'RECOMMENDED',
    },
    {
      id: 'VIP',
      name: 'VIP Executive',
      setupPrice: 25000,
      monthlyMaint: 2500, // 10%
      setupPriceUsd: 160,
      monthlyMaintUsd: 16.0, // 10%
      maintFormula: '10% Monthly Fee (PKR 2,500/mo or $16.00/mo)',
      bookingsLimit: '3,000 bookings/mo',
      description: 'Unlocks Deal Video Broadcasts · WhatsApp Auto-Reply + Google Reviews · Up to 3,000 bookings/mo',
      badge: 'ALL INCLUSIVE',
    },
    {
      id: 'CUSTOM',
      name: 'Custom Enterprise',
      setupPrice: 35000,
      monthlyMaint: 3500, // 10%
      setupPriceUsd: 250,
      monthlyMaintUsd: 25.0, // 10%
      maintFormula: '10% Monthly Fee ($25.00/mo)',
      bookingsLimit: '> 3,000 bookings / Multi-Branch',
      description: 'Multi-Branch Salons · Multi-Line Support · Deal Video Broadcasts Unlocked (1 to 4 videos/mo)',
      badge: 'MULTI-BRANCH',
    },
  ];

  const getSalonPackageFeatures = (pkgId: string, lang: SalonLanguage): { title: string; included: boolean }[] => {
    const ur = lang === 'URDU';
    const ar = lang === 'ARABIC';
    if (pkgId === 'STARTER') {
      return [
        { title: ur ? '24/7 واٹس ایپ خودکار بکنگ اور ریٹ لسٹ' : ar ? 'حجز واتساب آلي 24/7 وقائمة الأسعار' : '24/7 WhatsApp Auto-Reply & Rate List', included: true },
        { title: ur ? 'ماہانہ 500 تک بکنگز اور ریمائنڈرز' : ar ? 'حتى 500 حجز شهرياً وتنبيهات المواعيد' : 'Up to 500 Monthly Bookings & Reminders', included: true },
        { title: ur ? 'پرنٹ ایبل ونڈو پوسٹر PDF' : ar ? 'ملصق نافذة جاهز للطباعة PDF' : 'Printable Salon Window Poster PDF', included: true },
        { title: ur ? 'گوگل 5 اسٹار ریویو سسٹم' : ar ? 'تقييمات جوجل 5 نجوم' : 'Google 5-Star Review Booster', included: false },
        { title: ur ? 'ویڈیو ڈیل براڈکاسٹ فیچر' : ar ? 'إرسال عروض الفيديو للعملاء' : 'Video Deal Broadcasts', included: false },
      ];
    }
    if (pkgId === 'GROWTH') {
      return [
        { title: ur ? '24/7 واٹس ایپ خودکار بکنگ (1,500/ماہ)' : ar ? 'حجز واتساب آلي (حتى 1,500/شهر)' : '24/7 WhatsApp Auto-Reply (Up to 1,500/mo)', included: true },
        { title: ur ? 'گوگل 5 اسٹار ریویو بوسٹر شامل ہے' : ar ? 'تعزيز تقييمات جوجل 5 نجوم تلقائياً' : 'Google 5-Star Review Booster Included', included: true },
        { title: ur ? 'خودکار بیک اپ واٹس ایپ لائن تحفظ' : ar ? 'حماية تلقائية بخط احتياطي للواتساب' : 'Automatic Backup WhatsApp Line Guard', included: true },
        { title: ur ? 'آواز سے الرٹس اور مینو تبدیلی' : ar ? 'تنبيهات صوتية وتعديل فوري للأسعار' : 'Counter Voice Alerts & Live Price Edits', included: true },
        { title: ur ? 'ویڈیو ڈیل براڈکاسٹ فیچر' : ar ? 'إرسال عروض الفيديو للعملاء' : 'Video Deal Broadcasts', included: false },
      ];
    }
    if (pkgId === 'VIP') {
      return [
        { title: ur ? 'ماہانہ 3,000 تک بکنگز اور تمام فیچرز' : ar ? 'حتى 3,000 حجز شهرياً بكامل المميزات' : 'Up to 3,000 Monthly Bookings (All-Inclusive)', included: true },
        { title: ur ? 'ویڈیو ڈیل فیچر ان لاک (اپلوڈ اور ارسال)' : ar ? 'تفعيل إرسال فيديوهات العروض للعملاء' : 'Deal Video Broadcast Feature Unlocked', included: true },
        { title: ur ? 'گوگل 5 اسٹار ریویو + ونڈو پوسٹر PDF' : ar ? 'تقييمات جوجل + ملصق النافذة PDF' : 'Google 5-Star Reviews + Window Poster PDF', included: true },
        { title: ur ? '60 منٹ میں خودکار فنی بحالی سپورٹ' : ar ? 'دعم وإصلاح تلقائي خلال أقل من 60 دقيقة' : '24/7 Auto-Fix & Priority <60 Min Care', included: true },
      ];
    }
    return [
      { title: ur ? 'لامحدود / 3,000+ ملٹی برانچ بکنگز' : ar ? 'حجوزات غير محدودة / متعددة الفروع' : 'Unlimited / 3,000+ Multi-Branch Bookings', included: true },
      { title: ur ? 'ویڈیو ڈیل براڈکاسٹ (ماہانہ 1 سے 4 ویڈیوز)' : ar ? 'عروض الفيديو (1 إلى 4 فيديوهات شهرياً)' : 'Video Deal Broadcasts (1 to 4 Videos/mo)', included: true },
      { title: ur ? 'ملٹی برانچ الگ الگ ریٹ اور عملے کی بکنگ' : ar ? 'قوائم أسعار منفصلة لكل فرع' : 'Dedicated Multi-Branch Menus & Routing', included: true },
      { title: ur ? '24/7 ترجیحی سینئر سپورٹ' : ar ? 'دعم فني متقدم على مدار الساعة' : '24/7 Dedicated Senior Support', included: true },
    ];
  };

  const currentPackagePrice = PACKAGES.find((p) => p.id === selectedPackageTier)?.setupPrice || 20000;
  const currentPackage = PACKAGES.find((p) => p.id === selectedPackageTier) || PACKAGES[1];

  // Multilingual Copy Dictionary
  const T = {
    URDU: {
      langName: 'اردو',
      flag: '🇵🇰',
      headerTitle: `${inputSalonName || salonName} · سیلون آن بورڈنگ پورٹل`,
      tagline: 'واٹس ایپ خودکار بکنگ اور ڈیجیٹل سیلون مینجمنٹ',
      step1: '1. سیلون معلومات اور مقام',
      step1Title: 'سیلون کا نام، پتہ اور رابطہ نمبر',
      step1Desc: 'اپنے سیلون کی بنیادی تفصیلات اور واٹس ایپ نمبر درج کریں۔ یہ معلومات واٹس ایپ بوٹ اور ریٹ کارڈ پر ظاہر ہوں گی۔',
      step1Btn: 'معلومات محفوظ کریں اور سروس مینو پر جائیں (مرحلہ 2) ←',
      step2: '2. سروسز اور ریٹ لسٹ',
      step3: '3. پیکج اور 10% مینٹیننس',
      step4: '4. واٹس ایپ جوڑیں',
      installTitle: 'موبائل اسکرین پر ورک کرافٹ ایپ محفوظ کریں',
      installDesc: 'ایپ اسٹور یا پلے اسٹور کے بغیر فوری انسٹال۔ سیلون کے ٹیبلٹ یا موبائل پر 1-ٹیپ میں تیز رفتار پروگریسو ایپ چلتی ہے۔',
      installBtn: isPwaInstalled ? 'انسٹالیشن مکمل ہوگئی ✓' : '1-ٹیپ میں موبائل اسکرین پر شامل کریں',
      menuTitle: 'کاروباری کیٹیگری اور سروسز کی ریٹ لسٹ',
      menuDesc: 'مینس یا لیڈیز کیٹیگری منتخب کریں۔ اپنی سروسز کے ریٹ درج کریں، واٹس ایپ بوٹ خود بخود اردو اور انگلش میں یہی قیمتیں گاہک کو بتائے گا۔',
      mensTab: "مینس باربر / سیلون",
      ladiesTab: "لیڈیز پارلر / بیوٹی لاؤنج",
      addService: "+ نئی کسٹم سروس شامل کریں",
      saveMenuBtn: "ریٹ لسٹ محفوظ کریں اور ادائیگی پر جائیں ←",
      payTitle: 'پیکج کا انتخاب اور 10 فیصد ماہانہ مینٹیننس فیس',
      payDesc: 'اپنے سیلون کے حجم کے مطابق پیکج منتخب کریں۔ ماہانہ مینٹیننس فیس ٹھیک 10 فیصد ہوگی جو خودکار طریقے سے ادا ہوگی۔',
      maintHighlight: '10% ماہانہ مینٹیننس کیوں ضروری ہے؟',
      maintExplain: '10% ماہانہ فیس آپ کے واٹس ایپ آٹو ریپلائی کو 24 گھنٹے فعال رکھتی ہے اور کسی بھی خرابی پر 60 منٹ کے اندر فنی مدد فراہم کرتی ہے۔ فیلڈ ایجنٹ مینٹیننس کیش نہیں لیتا، ادائیگی صرف ڈیجیٹل ہوگی۔',
      payBtn: 'ادائیگی تصدیق کریں اور واٹس ایپ جوڑیں ←',
      pairTitle: 'سیلون کا واٹس ایپ منسلک کریں (کوڈ یا کیو آر)',
      pairDesc: 'اپنے سیلون کے موبائل میں واٹس ایپ کھولیں ➔ تھری ڈاٹس پر ٹیپ کریں ➔ Linked Devices ➔ Link a Device دبائیں اور اس 8 ہندسوں کا کوڈ یا کیو آر اسکین کریں۔',
      scanSimulate: 'سیلون واٹس ایپ اسکین کی تصدیق کریں ←',
      pairSuccess: 'ماشاءاللہ! واٹس ایپ کنکشن کامیابی سے جڑ گیا!',
      pairSuccessDesc: 'اب آپ کا سیلون ورک کرافٹ کلاؤڈ گیٹ وے پر آن لائن ہے۔ گاہکوں کے پیغامات کا خودکار جواب فوری طور پر شروع ہو چکا ہے۔',
      finishBtn: 'سیلون پورٹل مکمل کریں اور ڈیش بورڈ کھولیں',
    },
    ARABIC: {
      langName: 'العربية',
      flag: '🇦🇪',
      headerTitle: `${inputSalonName || salonName} · بوابة صالون وورك كرافت`,
      tagline: 'نظام حجز واتساب التلقائي وإدارة الصالون',
      step1: '1. بيانات الصالون والموقع',
      step1Title: 'اسم الصالون والعنوان والواتساب',
      step1Desc: 'أدخل بيانات الصالون ورقم الواتساب لبدء تهيئة الرد الآلي وقائمة الأسعار.',
      step1Btn: 'حفظ البيانات والمتابعة لقائمة الخدمات (الخطوة 2) →',
      step2: '2. قائمة الخدمات والأسعار',
      step3: '3. الباقة والصيانة 10%',
      step4: '4. ربط واتساب واختصار الشاشة',
      installTitle: 'إضافة تطبيق وورك كرافت للشاشة الرئيسية بنقرة واحدة',
      installDesc: 'تطبيق ويب تقدمي سريع يعمل مباشرة دون الحاجة لمتجر التطبيقات أو تنزيلات بطيئة.',
      installBtn: isPwaInstalled ? 'تم التثبيت بنجاح ✓' : 'تثبيت بنقرة واحدة على الشاشة',
      menuTitle: 'اختيار فئة الصالون وقائمة الخدمات والأسعار',
      menuDesc: 'حدد فئة الصالون وأدخل أسعار الخدمات. يتعلم روبوت واتساب الأسعار المحددة تلقائيًا.',
      mensTab: "صالون حلاقة رجالي",
      ladiesTab: "صالون وسبا نسائي",
      addService: "+ إضافة خدمة مخصصة",
      saveMenuBtn: "حفظ القائمة والمتابعة للدفع →",
      payTitle: 'اختيار الباقة ورسوم الصيانة الشهرية (10%)',
      payDesc: 'اختر الباقة المناسبة لصالونك. تبلغ رسوم الصيانة الشهرية 10% فقط من سعر الباقة.',
      maintHighlight: 'لماذا رسوم الصيانة الشهرية 10%؟',
      maintExplain: 'تضمن رسوم الصيانة 10% استمرار الرد الآلي على واتساب على مدار الساعة وحل أي مشكلة تقنية خلال أقل من 60 دقيقة.',
      payBtn: 'تأكيد الدفع والانتقال لربط واتساب →',
      pairTitle: 'ربط واتساب الصالون واختصار الشاشة',
      pairDesc: 'افتح واتساب على هاتف الصالون ➔ الأجهزة المرتبطة ➔ ربط جهاز ➔ أدخل الرمز المكون من 8 أرقام أو امسح رمز QR.',
      scanSimulate: 'محاكاة مسح رمز QR على واتساب →',
      pairSuccess: 'تم ربط واتساب الصالون بنجاح!',
      pairSuccessDesc: 'صالونك متصل الآن بالشبكة السحابية، وبدأ الرد الآلي على استفسارات وحجوزات العملاء فوراً.',
      finishBtn: 'إتمام الإعداد والدخول للوحة التحكم',
    },
    ROMAN_URDU: {
      langName: 'Roman Urdu',
      flag: '💬',
      headerTitle: `${inputSalonName || salonName} · Salon Onboarding Portal`,
      tagline: 'WhatsApp auto-reply booking aur digital management',
      step1: '1. Salon Info & Location',
      step1Title: 'Salon Name, Address & Owner WhatsApp',
      step1Desc: 'Apne salon ki basic details aur WhatsApp number enter karein. Yehi information bot aur booking cart par show hogi.',
      step1Btn: 'Save Info & Go to Step 2: Service Menu →',
      step2: '2. Services & Menu',
      step3: '3. Package & 10% Maint',
      step4: '4. WhatsApp Pairing',
      installTitle: 'Mobile Home Screen par WORKCRAFT app add karein',
      installDesc: 'Play Store ya APK download ke baghair foran install. Salon ke phone ya tablet par 1-tap mein high speed app chalti hai.',
      installBtn: isPwaInstalled ? 'Installation Mukammal ✓' : '1-Tap Install to Home Screen',
      menuTitle: 'Salon Category aur Services ki Rate List',
      menuDesc: "Men's ya Ladies category select karein aur services ke rates set karein. WhatsApp bot khud ba khud Roman Urdu aur English mein customer ko yehi prices bataye ga.",
      mensTab: "Men's Barber / Grooming",
      ladiesTab: "Ladies' Parlor / Lounge",
      addService: '+ Add Custom Service to Menu',
      saveMenuBtn: 'Save Menu & Proceed to Payment →',
      payTitle: 'Package Selection & 10% Monthly Maintenance',
      payDesc: 'Apne salon ke mutabiq package select karein. Monthly maintenance theek 10% hogi jo digital self-pay hogi.',
      maintHighlight: '10% Monthly Maintenance kyun zaroori hai?',
      maintExplain: '10% monthly maintenance fee aap ke WhatsApp auto-reply ko 24 ghantay active rakhti hai aur kisi bhi maslay par 60 min mein technical recovery deti hai. Field agent cash nahi leta.',
      payBtn: 'Confirm Payment & Connect WhatsApp →',
      pairTitle: 'Salon ka WhatsApp Jorain (Code ya QR)',
      pairDesc: 'Salon ke mobile mein WhatsApp kholein ➔ Linked Devices ➔ Link a Device dabayein aur 8-digit code enter karein ya QR scan karein.',
      scanSimulate: 'Simulate WhatsApp QR Scan →',
      pairSuccess: 'MashaAllah! WhatsApp Connection Kamyab!',
      pairSuccessDesc: 'Aap ka salon ab WORKCRAFT cloud par live hai. Customer bookings ka auto-reply shuru ho chuka hai.',
      finishBtn: 'Complete Onboarding & Enter Portal',
    },
    ENGLISH: {
      langName: 'English',
      flag: '🇬🇧',
      headerTitle: `${inputSalonName || salonName} · Direct Owner Portal`,
      tagline: 'Autonomous WhatsApp booking concierge & salon management',
      step1: '1. Salon Info & Location',
      step1Title: 'Salon Details, City & WhatsApp Line',
      step1Desc: 'Enter your salon details and contact number. Your WhatsApp AI concierge uses this info for greetings and bookings.',
      step1Btn: 'Save Details & Next: Service Menu (Step 2) →',
      step2: '2. Service Menu & Rates',
      step3: '3. Package & 10% Monthly Fee',
      step4: '4. Connect WhatsApp & Shortcut',
      installTitle: 'Save WorkCraft to Your Phone Home Screen',
      installDesc: 'No App Store or Play Store needed. Fast 1-tap salon app that works smoothly even when internet is slow.',
      installBtn: isPwaInstalled ? 'App Saved to Phone ✓' : '1-Tap Save to Home Screen',
      menuTitle: 'Business Category & Service Rates',
      menuDesc: 'Select your salon category and confirm your service rates. Your WhatsApp booking assistant uses these exact prices automatically.',
      mensTab: "Men's Barber / Grooming",
      ladiesTab: "Ladies' Parlor / Lounge",
      addService: '+ Add Custom Service to Menu',
      saveMenuBtn: 'Save Menu & Choose Package →',
      payTitle: 'Choose Package & 10% Monthly Service Fee',
      payDesc: 'Tap any package below to inspect all included features right underneath it. Monthly upkeep is strictly 10% of the package fee.',
      maintHighlight: 'Why the 10% Monthly Service Fee Matters',
      maintExplain: 'The 10% monthly fee keeps your 24/7 WhatsApp booking active, includes free rate-card edits, and guarantees auto-repair in under 60 minutes. Field agents never take monthly cash.',
      payBtn: 'Confirm Payment & Connect WhatsApp →',
      pairTitle: 'Connect Your Salon WhatsApp',
      pairDesc: 'Open WhatsApp on your salon phone ➔ Linked Devices ➔ Link a Device and scan the code below in 5 seconds.',
      scanSimulate: 'Confirm Salon WhatsApp Connection →',
      pairSuccess: 'Connection 100% Successful!',
      pairSuccessDesc: 'Your salon WhatsApp is now live! Customer auto-replies and appointment bookings are running.',
      finishBtn: 'Complete Setup & Open Dashboard',
    },
  }[selectedLanguage];

  const handleAddCustomService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;
    const item: ServiceItem = {
      id: `custom_${Date.now()}`,
      name: customName.trim(),
      price: parseInt(customPrice, 10) || 1000,
      enabled: true,
    };
    if (selectedCategory === 'MENS') {
      setMensServices((prev) => [...prev, item]);
    } else {
      setLadiesServices((prev) => [...prev, item]);
    }
    setCustomName('');
    setCustomPrice('1500');
    setIsAddingService(false);
  };

  const handleToggleService = (id: string, isMens: boolean) => {
    if (isMens) {
      setMensServices((prev) =>
        prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
      );
    } else {
      setLadiesServices((prev) =>
        prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
      );
    }
  };

  const handleChangePrice = (id: string, price: number, isMens: boolean) => {
    if (isMens) {
      setMensServices((prev) =>
        prev.map((s) => (s.id === id ? { ...s, price } : s))
      );
    } else {
      setLadiesServices((prev) =>
        prev.map((s) => (s.id === id ? { ...s, price } : s))
      );
    }
  };

  const handleInstallPwa = () => {
    setIsPwaInstalled(true);
    setTimeout(() => setStep(2), 600);
  };

  const handleConfirmPayment = () => {
    setIsPaymentProcessing(true);
    setTimeout(() => {
      setIsPaymentProcessing(false);
      setIsPaymentConfirmed(true);
      setStep(4);
    }, 1200);
  };

  const activeServices = selectedCategory === 'MENS' ? mensServices : ladiesServices;

  // 3-Tier Dynamic Regional Language Sets
  const regionalLanguages = useMemo(() => {
    if (regionalTier === 'PAKISTAN') {
      return [
        {
          id: 'URDU' as const,
          label: 'اردو (Urdu)',
          flag: '🇵🇰',
          badge: 'سیلون مالکان کے لیے آسان اردو',
          desc: 'واٹس ایپ خودکار بکنگ، ریٹ لسٹ اور 10% مینٹیننس سیٹ اپ',
        },
        {
          id: 'ROMAN_URDU' as const,
          label: 'Roman Urdu',
          flag: '💬',
          badge: 'Aasan Roman Urdu',
          desc: 'Mobile par aasan WhatsApp booking aur service setup',
        },
        {
          id: 'ENGLISH' as const,
          label: 'English',
          flag: '🇬🇧',
          badge: 'Official English',
          desc: 'Complete salon concierge setup in standard English',
        },
      ];
    }
    if (regionalTier === 'MENA') {
      return [
        {
          id: 'ARABIC' as const,
          label: 'العربية (Arabic)',
          flag: '🇦🇪',
          badge: 'الواجهة العربية الميسرة للخليج',
          desc: 'إعداد حجز واتساب التلقائي وقائمة الخدمات للصالونات في دول الخليج',
        },
        {
          id: 'ENGLISH' as const,
          label: 'English',
          flag: '🇬🇧',
          badge: 'International Standard',
          desc: 'Direct multi-currency salon setup in standard English',
        },
      ];
    }
    // EUROPE_GLOBAL
    return [
      {
        id: 'ENGLISH' as const,
        label: 'English',
        flag: '🇬🇧',
        badge: 'Global Standard',
        desc: 'Autonomous WhatsApp booking concierge & terminal multi-device sync',
      },
    ];
  }, [regionalTier]);

  const regionGateMeta = {
    PAKISTAN: {
      badge: '🇵🇰 PAKISTAN MARKET · AUTO-DETECTED (+92)',
      greeting: 'Assalamu Alaikum · Welcome',
      urduSub: 'سیلون آن بورڈنگ کے لیے اپنی زبان منتخب کریں',
      subDesc: 'آسان اردو، رومن اردو یا انگلش میں خودکار واٹس ایپ سیٹ اپ مکمل کریں',
    },
    MENA: {
      badge: '🇦🇪 MENA / GULF REGION · AUTO-DETECTED (+971 / +966)',
      greeting: 'مرحبًا بكم · Welcome',
      urduSub: 'اختر لغتك المفضلة لبدء إعداد صالونك',
      subDesc: 'الواجهة العربية المخصصة لدول مجلس التعاون أو الإنجليزية الدولية',
    },
    EUROPE_GLOBAL: {
      badge: '🇬🇧 EUROPE & GLOBAL · AUTO-DETECTED (+44 / +1)',
      greeting: 'Welcome to WORKCRAFT',
      urduSub: 'Autonomous Salon Concierge Onboarding',
      subDesc: 'Direct WhatsApp multi-device gateway setup in international English',
    },
  }[regionalTier];

  const isPwaRtl = selectedLanguage === 'URDU' || selectedLanguage === 'ARABIC';

  if (isDashboardLaunched) {
    return (
      <div className="space-y-4 pb-28 lg:pb-10 min-w-0">
        <div className="flex items-center justify-between pb-3 border-b border-[#21262D] text-xs font-mono">
          <span className="text-[#06B6D4] font-bold">💈 SALON OWNER MOBILE APP · ACTIVE TERMINAL</span>
          <button
            type="button"
            onClick={() => setIsDashboardLaunched(false)}
            className="min-h-[40px] px-2 text-[#8B949E] hover:text-[#F0F6FC] underline text-[11px]"
          >
            ← Back to Onboarding Steps
          </button>
        </div>
        <SalonOwnerDashboard salonName={salonName} onClose={onClose} />
      </div>
    );
  }

  return (
    <div
      dir={isPwaRtl ? 'rtl' : 'ltr'}
      className={`space-y-6 max-w-3xl mx-auto relative pb-28 lg:pb-10 min-w-0 ${
        isPwaRtl ? 'text-right' : 'text-left'
      }`}
    >
      {/* ========================================================================= */}
      {/* 1. SOCIAL MEDIA & PUBLIC ONBOARDING GREETING & 3-TIER REGIONAL GATE       */}
      {/*    Pakistan: Urdu / Roman Urdu / English                                  */}
      {/*    MENA: Arabic / English                                                 */}
      {/*    Europe / Global: English                                               */}
      {/* ========================================================================= */}
      {isLanguageGateOpen && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-[#0D1117]/80 p-3 sm:p-5 backdrop-blur-md overflow-y-auto">
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[520px] rounded-3xl border border-[#30363D] bg-[#161B22] p-5 sm:p-6 shadow-2xl animate-in zoom-in-95 duration-150 my-6 relative"
          >
            {/* Modal Top Close Button */}
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#21262D]">
              <span className="text-[10px] font-mono text-[#8B949E] uppercase font-bold">Language Selection / زبان کا انتخاب</span>
              <button
                type="button"
                onClick={() => setIsLanguageGateOpen(false)}
                className="min-h-[44px] min-w-[44px] grid place-items-center rounded-xl bg-[#21262D] border border-[#30363D] text-[#8B949E] hover:text-[#F0F6FC] hover:border-[#484F58] transition active:scale-95"
                title="Close Language Selection"
                aria-label="Close Language Selection"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Quick Regional Market Switcher Bar */}
            <div className="flex items-center justify-between gap-1.5 p-1 rounded-xl bg-[#0D1117] border border-[#30363D] mb-4">
              <button
                type="button"
                onClick={() => handleSwitchRegion('+92')}
                className={`flex-1 min-h-[44px] py-1.5 px-2 rounded-lg text-[10px] font-mono font-bold transition flex items-center justify-center gap-1 ${
                  regionalTier === 'PAKISTAN'
                    ? 'bg-[#06B6D4] text-[#0D1117]'
                    : 'text-[#8B949E] hover:text-[#F0F6FC] hover:bg-[#21262D]'
                }`}
              >
                <span>🇵🇰 Pakistan (+92)</span>
              </button>
              <button
                type="button"
                onClick={() => handleSwitchRegion('+971')}
                className={`flex-1 min-h-[44px] py-1.5 px-2 rounded-lg text-[10px] font-mono font-bold transition flex items-center justify-center gap-1 ${
                  regionalTier === 'MENA'
                    ? 'bg-[#3B2E0B] border border-[#9E6A03] text-[#D29922]'
                    : 'text-[#8B949E] hover:text-[#F0F6FC] hover:bg-[#21262D]'
                }`}
              >
                <span>🇦🇪 UAE / MENA (+971)</span>
              </button>
              <button
                type="button"
                onClick={() => handleSwitchRegion('+44')}
                className={`flex-1 min-h-[44px] py-1.5 px-2 rounded-lg text-[10px] font-mono font-bold transition flex items-center justify-center gap-1 ${
                  regionalTier === 'EUROPE_GLOBAL'
                    ? 'bg-[#0D3822] border border-[#116329] text-[#3FB950]'
                    : 'text-[#8B949E] hover:text-[#F0F6FC] hover:bg-[#21262D]'
                }`}
              >
                <span>🇬🇧 Europe / Global (+44)</span>
              </button>
            </div>

            <div className="text-center space-y-1.5 pb-4 border-b border-[#21262D]">
              <div className="inline-flex items-center gap-1.5 rounded-md bg-[#0D1117] border border-[#30363D] px-2.5 py-0.5 mb-1">
                <span className="size-1.5 rounded-full bg-[#3FB950] animate-pulse" />
                <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-[#D29922]">
                  {regionGateMeta.badge}
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-[#F0F6FC] tracking-tight">
                {regionGateMeta.greeting}
              </h2>
              <p
                dir={regionalTier === 'EUROPE_GLOBAL' ? 'ltr' : 'rtl'}
                className="text-xs text-[#06B6D4] font-sans font-medium break-words [overflow-wrap:break-word]"
              >
                {regionGateMeta.urduSub}
              </p>
              <p
                dir={regionalTier === 'EUROPE_GLOBAL' ? 'ltr' : 'rtl'}
                className="text-[11px] text-[#8B949E] font-sans pt-0.5 break-words [overflow-wrap:break-word]"
              >
                {regionGateMeta.subDesc}
              </p>
            </div>

            {/* Filtered 3-Tier Language Cards */}
            <div className="mt-4 space-y-2.5">
              {regionalLanguages.map((lang) => {
                const langIsRtl = lang.id === 'URDU' || lang.id === 'ARABIC';
                return (
                  <button
                    key={lang.id}
                    type="button"
                    dir={langIsRtl ? 'rtl' : 'ltr'}
                    onClick={() => {
                      setSelectedLanguage(lang.id);
                      setIsLanguageGateOpen(false);
                    }}
                    className={`w-full min-h-[56px] p-3.5 rounded-2xl border transition flex items-center justify-between gap-3 group ${
                      langIsRtl ? 'text-right' : 'text-left'
                    } ${
                      selectedLanguage === lang.id
                        ? 'border-[#06B6D4] bg-[#21262D]'
                        : 'border-[#30363D] bg-[#0D1117] hover:border-[#484F58] hover:bg-[#21262D]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="text-2xl shrink-0">{lang.flag}</span>
                      <div className={`min-w-0 flex-1 ${langIsRtl ? 'text-right' : 'text-left'}`}>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-[#F0F6FC] group-hover:text-[#06B6D4] transition">
                            {lang.label}
                          </span>
                          <span className="rounded bg-[#161B22] border border-[#30363D] px-1.5 py-0.5 text-[9px] font-mono text-[#8B949E]">
                            {lang.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#8B949E] font-sans mt-0.5 break-words [overflow-wrap:break-word]">
                          {lang.desc}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="size-4 text-[#8B949E] group-hover:text-[#06B6D4] transition shrink-0" />
                  </button>
                );
              })}
            </div>

            <div className="mt-4 pt-3 border-t border-[#21262D] flex items-center justify-between gap-3">
              <span className="text-[10px] font-mono text-[#6E7681]">
                Region: <strong className="text-[#8B949E]">{selectedRegion}</strong> · Language: <strong className="text-[#06B6D4]">{selectedLanguage}</strong>
              </span>
              <button
                type="button"
                onClick={() => setIsLanguageGateOpen(false)}
                className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl bg-[#06B6D4] hover:bg-[#22D3EE] text-[#0D1117] px-4 py-2 text-xs font-mono font-bold uppercase transition"
              >
                <span>Continue →</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. SIMULATION BANNER HEADER WITH ALWAYS-ACCESSIBLE LANGUAGE SWITCHER */}
      <div className="rounded-2xl border border-[#30363D] bg-[#161B22] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg min-w-0 overflow-hidden">
        <div className="min-w-0 w-full sm:w-auto">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#D29922]">
              {T.headerTitle}
            </span>
            <span className="rounded-md bg-[#0D1117] px-2 py-0.5 text-[9px] font-mono font-bold text-[#8B949E] border border-[#30363D] max-w-full overflow-hidden break-all [overflow-wrap:break-word]">
              Token: <span dir="ltr">{token}</span>
            </span>
          </div>
          <p className="text-xs text-[#8B949E] font-sans mt-0.5 break-words [overflow-wrap:break-word]">{T.tagline}</p>
        </div>

        {/* Language Switcher Pill + Step Progress */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          {/* Quick Language Toggle */}
          <button
            type="button"
            onClick={() => setIsLanguageGateOpen(true)}
            className="min-h-[44px] flex items-center gap-1.5 rounded-lg border border-[#30363D] bg-[#21262D] px-3 py-1.5 text-xs font-mono font-bold text-[#06B6D4] hover:border-[#06B6D4] transition"
            title="Change Onboarding Language"
          >
            <Globe className="size-3.5" />
            <span>{T.flag} {T.langName}</span>
          </button>

          {/* 4-Step Progress Indicator */}
          <div className="flex items-center gap-1 font-mono text-[10px]">
            {[
              { num: 1, label: T.step1 },
              { num: 2, label: T.step2 },
              { num: 3, label: T.step3 },
              { num: 4, label: T.step4 },
            ].map((s) => (
              <div
                key={s.num}
                className={`flex items-center gap-1 px-2 py-1.5 rounded-md border ${
                  step === s.num
                    ? 'border-[#06B6D4] bg-[#21262D] text-[#06B6D4] font-bold'
                    : step > s.num
                    ? 'border-[#116329] bg-[#0D3822] text-[#3FB950]'
                    : 'border-[#30363D] text-[#6E7681]'
                }`}
              >
                <span>{s.num}.</span>
                <span className="hidden md:inline">{s.label.split('.')[1] || s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* STEP 1: SALON DETAILS & LOCATION (UNIFIED WITH AGENT ENGINE) */}
      {step === 1 && (
        <PortalCard title={T.step1Title} kicker="STEP 1 OF 4 · SALON SETUP">
          <div className="space-y-4">
            {/* Social Ad Campaign Source Banner */}
            {socialCampaignSource && (
              <div className="rounded-xl border border-[#06B6D4]/40 bg-[#06B6D4]/10 p-3 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                <span className="flex items-center gap-1.5 text-[#06B6D4] font-bold">
                  <Sparkles className="size-3.5" />
                  <span>Auto-Tagged Lead: {socialCampaignSource}</span>
                </span>
                <span className="rounded bg-[#0D1117] px-2 py-0.5 text-[10px] text-[#3FB950] border border-[#116329]">
                  Bypassing Admin Screens ✓
                </span>
              </div>
            )}

            <p className="text-xs text-[#8B949E] font-sans leading-relaxed">
              {T.step1Desc}
            </p>

            {step1Error && (
              <div className="rounded-xl border border-[#da3633] bg-[#4C1C1D] p-3 text-xs font-mono text-[#F85149] animate-in fade-in">
                ⚠️ {step1Error}
              </div>
            )}

            {/* Category Selector (Men's Barber vs Ladies' Parlor) */}
            <div className="space-y-1.5">
              <label className="text-xs font-mono font-bold text-[#8B949E] uppercase block">
                Business Category / سیلون کی کیٹیگری
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('MENS')}
                  className={`min-h-[48px] flex items-center justify-center gap-2 rounded-xl py-3 px-2 text-xs font-mono font-bold transition border ${
                    selectedCategory === 'MENS'
                      ? 'border-[#06B6D4] bg-[#21262D] text-[#06B6D4]'
                      : 'border-[#30363D] bg-[#0D1117] text-[#8B949E] hover:text-[#F0F6FC]'
                  }`}
                >
                  <Scissors className="size-4" />
                  <span>{T.mensTab}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCategory('LADIES')}
                  className={`min-h-[48px] flex items-center justify-center gap-2 rounded-xl py-3 px-2 text-xs font-mono font-bold transition border ${
                    selectedCategory === 'LADIES'
                      ? 'border-[#D29922] bg-[#3B2E0B] text-[#D29922]'
                      : 'border-[#30363D] bg-[#0D1117] text-[#8B949E] hover:text-[#F0F6FC]'
                  }`}
                >
                  <Sparkles className="size-4" />
                  <span>{T.ladiesTab}</span>
                </button>
              </div>
            </div>

            {/* Core Form Fields Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <label className="text-xs font-mono text-[#8B949E] block space-y-1.5">
                <span className="font-bold text-[#F0F6FC]">SALON / PARLOR NAME *</span>
                <input
                  type="text"
                  value={inputSalonName}
                  onChange={(e) => setInputSalonName(e.target.value)}
                  placeholder="e.g. Royal Fade Lounge"
                  className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3.5 py-2.5 text-xs text-[#F0F6FC] font-sans focus:outline-none focus:border-[#06B6D4]"
                />
              </label>

              <label className="text-xs font-mono text-[#8B949E] block space-y-1.5">
                <span className="font-bold text-[#F0F6FC]">OWNER / MANAGER NAME *</span>
                <input
                  type="text"
                  value={inputOwnerName}
                  onChange={(e) => setInputOwnerName(e.target.value)}
                  placeholder="e.g. Hamza Tariq"
                  className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3.5 py-2.5 text-xs text-[#F0F6FC] font-sans focus:outline-none focus:border-[#06B6D4]"
                />
              </label>

              <label className="text-xs font-mono text-[#8B949E] block space-y-1.5">
                <span className="font-bold text-[#F0F6FC]">WHATSAPP PHONE NUMBER *</span>
                <div className="flex gap-2">
                  <select
                    value={selectedRegion}
                    onChange={(e) => handleSwitchRegion(e.target.value as '+92' | '+971' | '+44')}
                    className="min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-2 text-xs font-mono text-[#D29922] focus:outline-none focus:border-[#06B6D4]"
                  >
                    <option value="+92">🇵🇰 +92</option>
                    <option value="+971">🇦🇪 +971</option>
                    <option value="+44">🇬🇧 +44</option>
                  </select>
                  <input
                    type="tel"
                    value={inputPhone}
                    onChange={(e) => setInputPhone(e.target.value)}
                    placeholder="300 1234567"
                    className="flex-1 min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3.5 py-2.5 text-xs text-[#F0F6FC] font-mono focus:outline-none focus:border-[#06B6D4]"
                  />
                </div>
              </label>

              <label className="text-xs font-mono text-[#8B949E] block space-y-1.5">
                <span className="font-bold text-[#F0F6FC]">SHOP ADDRESS &amp; CITY *</span>
                <input
                  type="text"
                  value={inputAddress}
                  onChange={(e) => setInputAddress(e.target.value)}
                  placeholder="e.g. Sector C, CCA Phase 5 DHA, Lahore"
                  className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3.5 py-2.5 text-xs text-[#F0F6FC] font-sans focus:outline-none focus:border-[#06B6D4]"
                />
              </label>
            </div>

            {/* Language Quick-Picker Bar */}
            <div className="rounded-xl border border-[#21262D] bg-[#0D1117] p-3 space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#8B949E] block">
                PREFERRED ONBOARDING LANGUAGE / ترجیحی زبان
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'URDU' as const, label: '🇵🇰 اردو', desc: 'Urdu' },
                  { id: 'ROMAN_URDU' as const, label: '💬 Roman Urdu', desc: 'Roman' },
                  { id: 'ARABIC' as const, label: '🇦🇪 العربية', desc: 'Arabic' },
                  { id: 'ENGLISH' as const, label: '🇬🇧 English', desc: 'English' },
                ].map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setSelectedLanguage(l.id)}
                    className={`min-h-[42px] px-2.5 py-1.5 rounded-lg border text-xs font-mono font-bold transition flex items-center justify-between ${
                      selectedLanguage === l.id
                        ? 'border-[#06B6D4] bg-[#21262D] text-[#06B6D4]'
                        : 'border-[#30363D] bg-[#161B22] text-[#8B949E] hover:text-[#F0F6FC]'
                    }`}
                  >
                    <span>{l.label}</span>
                    {selectedLanguage === l.id && <Check className="size-3 text-[#3FB950]" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Next Step Action */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[#21262D]">
              <span className="text-[10px] font-mono text-[#8B949E]">
                Step 1 of 4 · Auto-Saved Locally
              </span>
              <button
                type="button"
                onClick={() => {
                  if (!inputSalonName.trim() || !inputOwnerName.trim()) {
                    setStep1Error('Please enter both Salon Name and Owner Name.');
                    return;
                  }
                  if (!inputPhone.trim()) {
                    setStep1Error('Please enter the owner WhatsApp number.');
                    return;
                  }
                  setStep1Error(null);
                  setStep(2);
                }}
                className="w-full sm:w-auto min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#06B6D4] hover:bg-[#22D3EE] text-[#0D1117] px-6 py-3 text-xs font-mono font-bold uppercase transition active:scale-95"
              >
                <span>{T.step1Btn || 'Save Details & Next: Service Menu (Step 2) →'}</span>
                <ArrowRight className="size-4" />
              </button>
            </div>
          </div>
        </PortalCard>
      )}

      {/* STEP 2: CATEGORY & SERVICE MENU SELECTION */}
      {step === 2 && (
        <PortalCard title={T.step2} kicker="STEP 2 OF 4 · SERVICE MENU & RATES">
          <div className="space-y-5">
            <p className="text-xs text-[#8B949E] font-sans leading-relaxed">{T.menuDesc}</p>

            {/* Category Switcher Tabs */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setSelectedCategory('MENS')}
                className={`min-h-[48px] flex items-center justify-center gap-2 rounded-xl py-3 px-2 text-xs font-mono font-bold transition border ${
                  selectedCategory === 'MENS'
                    ? 'border-[#06B6D4] bg-[#21262D] text-[#06B6D4]'
                    : 'border-[#30363D] bg-[#0D1117] text-[#8B949E] hover:text-[#F0F6FC]'
                }`}
              >
                <span>{T.mensTab}</span>
              </button>
              <button
                onClick={() => setSelectedCategory('LADIES')}
                className={`min-h-[48px] flex items-center justify-center gap-2 rounded-xl py-3 px-2 text-xs font-mono font-bold transition border ${
                  selectedCategory === 'LADIES'
                    ? 'border-[#D29922] bg-[#3B2E0B] text-[#D29922]'
                    : 'border-[#30363D] bg-[#0D1117] text-[#8B949E] hover:text-[#F0F6FC]'
                }`}
              >
                <span>{T.ladiesTab}</span>
              </button>
            </div>

            {/* Pre-Populated Checklist Rows */}
            <div className="space-y-2.5">
              {activeServices.map((service) => (
                <div
                  key={service.id}
                  className={`flex items-center justify-between gap-3 rounded-xl border p-3 transition ${
                    service.enabled
                      ? 'border-[#30363D] bg-[#0D1117]'
                      : 'border-[#21262D] bg-[#0D1117] opacity-60'
                  }`}
                >
                  <label className="flex items-center gap-3 cursor-pointer select-none flex-1 min-h-[40px]">
                    <input
                      type="checkbox"
                      checked={service.enabled}
                      onChange={() => handleToggleService(service.id, selectedCategory === 'MENS')}
                      className="size-4 rounded border-[#30363D] bg-[#161B22] text-[#06B6D4] focus:ring-0"
                    />
                    <span className="text-xs font-bold text-[#F0F6FC]">{service.name}</span>
                  </label>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-mono text-[#8B949E]">PKR</span>
                    <input
                      type="number"
                      value={service.price}
                      onChange={(e) =>
                        handleChangePrice(
                          service.id,
                          parseInt(e.target.value, 10) || 0,
                          selectedCategory === 'MENS'
                        )
                      }
                      className="w-24 min-h-[44px] rounded-lg border border-[#30363D] bg-[#161B22] px-2.5 py-1.5 text-sm font-mono font-bold text-[#D29922] focus:outline-none focus:border-[#06B6D4]"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Add Custom Service Form */}
            {!isAddingService ? (
              <button
                type="button"
                onClick={() => setIsAddingService(true)}
                className="w-full min-h-[48px] flex items-center justify-center gap-2 rounded-xl border border-dashed border-[#30363D] bg-[#0D1117] py-2.5 text-xs font-mono font-bold text-[#D29922] hover:border-[#D29922] hover:bg-[#21262D] transition"
              >
                <Plus className="size-4" />
                <span>{T.addService}</span>
              </button>
            ) : (
              <form onSubmit={handleAddCustomService} className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-[#D29922] uppercase">
                    {selectedLanguage === 'URDU'
                      ? `نئی سروس (${selectedCategory === 'MENS' ? 'مینس' : 'لیڈیز'})`
                      : selectedLanguage === 'ARABIC'
                      ? `خدمة جديدة (${selectedCategory === 'MENS' ? 'رجالي' : 'نسائي'})`
                      : `New Service (${selectedCategory === 'MENS' ? T.mensTab : T.ladiesTab})`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsAddingService(false)}
                    className="min-h-[36px] px-2 text-xs font-mono text-[#8B949E] hover:text-[#F0F6FC]"
                  >
                    {selectedLanguage === 'URDU' ? 'منسوخ کریں' : selectedLanguage === 'ARABIC' ? 'إلغاء' : 'Cancel'}
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-mono text-[#8B949E] block mb-1">
                      {selectedLanguage === 'URDU' ? 'سروس کا نام' : selectedLanguage === 'ARABIC' ? 'اسم الخدمة' : 'Service Name'}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={
                        selectedLanguage === 'URDU'
                          ? 'مثلاً: کیراٹین بیئرڈ گلو یا ہائیڈرا فیشل'
                          : selectedLanguage === 'ARABIC'
                          ? 'مثال: هيدرا فيشل أو علاج كيراتين اللحية'
                          : 'e.g. Keratin Beard Glow or Express Bleach'
                      }
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      className="w-full min-h-[48px] rounded-lg border border-[#30363D] bg-[#161B22] px-3 py-1.5 text-sm text-[#F0F6FC] placeholder:text-[#484F58] focus:outline-none focus:border-[#06B6D4]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-[#8B949E] block mb-1">
                      {selectedLanguage === 'URDU' ? 'قیمت (PKR)' : selectedLanguage === 'ARABIC' ? 'السعر' : 'Price'}
                    </label>
                    <input
                      type="number"
                      required
                      dir="ltr"
                      value={customPrice}
                      onChange={(e) => setCustomPrice(e.target.value)}
                      className="w-full min-h-[48px] rounded-lg border border-[#30363D] bg-[#161B22] px-3 py-1.5 text-sm font-mono font-bold text-[#D29922] focus:outline-none focus:border-[#06B6D4] text-left"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="min-h-[48px] rounded-lg bg-[#06B6D4] hover:bg-[#22D3EE] text-[#0D1117] px-4 py-2 text-xs font-mono font-bold uppercase transition"
                >
                  {selectedLanguage === 'URDU' ? 'سروس شامل کریں' : selectedLanguage === 'ARABIC' ? 'إضافة الخدمة' : 'Append Service'}
                </button>
              </form>
            )}

            {/* Query 8: Barbers & Stylists Roster Card (Pre-Onboarding Setup) */}
            <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3.5 space-y-3">
              <div className="flex items-center justify-between border-b border-[#21262D] pb-2">
                <span className="text-xs font-mono font-bold text-[#D29922] flex items-center gap-1.5">
                  <Scissors className="size-3.5 text-[#D29922]" />
                  <span>
                    {selectedLanguage === 'URDU'
                      ? 'سیلون باربرز / عملے کی فہرست'
                      : selectedLanguage === 'ARABIC'
                      ? 'قائمة الحلاقين / فريق العمل'
                      : 'Barbers & Stylists Staff Roster'}
                  </span>
                </span>
                <span className="text-[10px] font-mono text-[#06B6D4] bg-[#21262D] px-2 py-0.5 rounded border border-[#30363D]">
                  {barbersRoster.length} {selectedLanguage === 'URDU' ? 'باربرز' : selectedLanguage === 'ARABIC' ? 'حلاقين' : 'Barbers'}
                </span>
              </div>
              <p className="text-xs text-[#8B949E] font-sans leading-relaxed">
                {selectedLanguage === 'URDU'
                  ? 'اپنے سیلون کے باربرز یا ہیئر ڈریسرز کے نام شامل کریں۔ واٹس ایپ بوٹ گاہکوں کو بکنگ کے وقت انھی کے نام دکھائے گا اور آواز سے اناؤنس کرے گا۔'
                  : selectedLanguage === 'ARABIC'
                  ? 'أضف أسماء الحلاقين أو مصففي الشعر في صالونك. سيتم اقتراحهم للعملاء عند الحجز عبر واتساب والإعلان الصوتي عند وصولهم.'
                  : 'Add your salon barbers or stylists. WhatsApp bot will suggest them to clients during booking and announce their chair bookings aloud.'}
              </p>

              {/* Roster Badges List */}
              <div className="flex flex-wrap gap-2">
                {barbersRoster.map((barber, bIdx) => (
                  <div
                    key={bIdx}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#30363D] bg-[#161B22] px-2.5 py-1 text-xs font-mono font-bold text-[#F0F6FC]"
                  >
                    <span>Chair #{bIdx + 1}: {barber}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveBarber(barber)}
                      className="size-4 grid place-items-center rounded text-[#8B949E] hover:text-[#F85149] hover:bg-[#21262D] transition ml-1"
                      title="Remove"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add Barber Inline Form */}
              <form onSubmit={handleAddBarber} className="flex gap-2 pt-1">
                <input
                  type="text"
                  value={newBarberInput}
                  onChange={(e) => setNewBarberInput(e.target.value)}
                  placeholder={
                    selectedLanguage === 'URDU'
                      ? 'نیا باربر شامل کریں (مثلاً: اویس رضا)'
                      : selectedLanguage === 'ARABIC'
                      ? 'اسم الحلاق الجديد (مثال: طارق علي)'
                      : 'Add new barber (e.g. Tariq Ali)'
                  }
                  className="flex-1 min-h-[44px] rounded-lg border border-[#30363D] bg-[#161B22] px-3 py-1.5 text-xs text-[#F0F6FC] placeholder:text-[#484F58] focus:outline-none focus:border-[#06B6D4]"
                />
                <button
                  type="submit"
                  className="min-h-[44px] rounded-lg bg-[#21262D] border border-[#30363D] hover:border-[#06B6D4] text-[#06B6D4] px-3 py-1.5 text-xs font-mono font-bold uppercase transition flex items-center gap-1 shrink-0"
                >
                  <Plus className="size-3.5" />
                  <span>
                    {selectedLanguage === 'URDU' ? 'شامل کریں' : selectedLanguage === 'ARABIC' ? 'إضافة' : 'Add'}
                  </span>
                </button>
              </form>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[#21262D]">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="min-h-[44px] text-xs font-mono text-[#8B949E] hover:text-[#F0F6FC] transition"
              >
                ← {selectedLanguage === 'URDU' ? 'واپس سیلون معلومات' : selectedLanguage === 'ARABIC' ? 'الرجوع لبيانات الصالون' : 'Back to Salon Info'}
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="w-full sm:w-auto min-h-[48px] flex items-center justify-center gap-2 rounded-xl bg-[#06B6D4] hover:bg-[#22D3EE] text-[#0D1117] py-3 px-6 text-xs font-mono font-bold uppercase transition active:scale-95"
              >
                <span>{T.saveMenuBtn}</span>
                <ArrowRight className="size-4" />
              </button>
            </div>
          </div>
        </PortalCard>
      )}

      {/* STEP 3: PACKAGE SELECTION & 10% MONTHLY MAINTENANCE */}
      {step === 3 && (
        <PortalCard title={T.payTitle} kicker="10% MAINTENANCE FORMULA">
          <div className="space-y-5">
            <p className="text-xs text-[#8B949E] font-sans leading-relaxed">{T.payDesc}</p>

            {/* 4 Packages Selector — On mobile, package details slide open directly underneath the tapped package */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-2.5">
              {PACKAGES.map((pkg) => {
                const isSelected = selectedPackageTier === pkg.id;
                const isExpanded = expandedPackageId === pkg.id;
                const pkgFeatures = getSalonPackageFeatures(pkg.id, selectedLanguage);
                return (
                  <div key={pkg.id} className="space-y-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPackageTier(pkg.id as any);
                        setExpandedPackageId(isExpanded ? null : (pkg.id as any));
                      }}
                      className={`w-full min-h-[48px] rounded-xl border p-3.5 text-left transition flex flex-col justify-between ${
                        isSelected
                          ? 'border-[#06B6D4] bg-[#21262D] ring-1 ring-[#06B6D4]'
                          : 'border-[#30363D] bg-[#0D1117] hover:border-[#484F58]'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-bold text-[#F0F6FC]">{pkg.name}</p>
                          <div className="flex items-center gap-1.5">
                            {isSelected && <Check className="size-3.5 text-[#06B6D4]" />}
                            {isExpanded ? (
                              <ChevronUp className="size-3.5 text-[#06B6D4]" />
                            ) : (
                              <ChevronDown className="size-3.5 text-[#8B949E]" />
                            )}
                          </div>
                        </div>
                        <p className="text-[10px] font-mono font-bold text-[#06B6D4] mt-1">
                          ⚡ {pkg.bookingsLimit}
                        </p>
                        <p className="text-[10px] text-[#8B949E] font-sans mt-1 leading-relaxed">
                          {pkg.description}
                        </p>
                      </div>
                      <div className="mt-3 pt-2.5 border-t border-[#21262D]">
                        <span className="text-xs font-mono font-bold text-[#D29922] block">
                          {regionalTier === 'PAKISTAN' ? (
                            `PKR ${pkg.setupPrice.toLocaleString()}`
                          ) : regionalTier === 'MENA' ? (
                            <span className="inline-flex items-center gap-1.5 flex-wrap">
                              <span className="text-[#F0F6FC] font-black">{Math.round(pkg.setupPriceUsd * 3.67)} AED</span>
                              <span className="text-[10px] text-[#06B6D4] bg-[#21262D] px-1.5 py-0.5 rounded border border-[#30363D] font-bold">د.إ</span>
                              <span className="text-[10px] text-[#8B949E]">(${pkg.setupPriceUsd} USD)</span>
                            </span>
                          ) : (
                            `$${pkg.setupPriceUsd} USD (~£${Math.round(pkg.setupPriceUsd * 0.79)})`
                          )}
                        </span>
                        <span className="text-[10px] font-mono text-[#3FB950] block mt-0.5">
                          {regionalTier === 'PAKISTAN'
                            ? `Monthly Fee: PKR ${pkg.monthlyMaint.toLocaleString()} / mo (10%)`
                            : regionalTier === 'MENA'
                            ? `Monthly Fee: ${Math.round(pkg.monthlyMaintUsd * 3.67)} AED / mo (10%)`
                            : `Monthly Fee: $${pkg.monthlyMaintUsd.toFixed(2)} / mo (10%)`}
                        </span>
                      </div>
                    </button>

                    {/* Mobile Inline Slide: Opens IMMEDIATELY underneath the tapped package card */}
                    {isExpanded && (
                      <div className="lg:hidden rounded-xl border border-[#06B6D4] bg-[#0D1117] p-3.5 space-y-2 animate-in fade-in slide-in-from-top-1 duration-150">
                        <div className="flex items-center justify-between border-b border-[#21262D] pb-1.5">
                          <span className="text-[10px] font-mono font-bold uppercase text-[#06B6D4]">
                            {pkg.name} · Included Details
                          </span>
                          <button
                            type="button"
                            onClick={() => setExpandedPackageId(null)}
                            className="min-h-[36px] px-2 text-[10px] font-mono text-[#8B949E] hover:text-[#F0F6FC]"
                          >
                            Hide ▲
                          </button>
                        </div>
                        <div className="space-y-1.5">
                          {pkgFeatures.map((feat, fIdx) => (
                            <div
                              key={fIdx}
                              className={`flex items-center gap-2 text-xs ${
                                feat.included ? 'text-[#F0F6FC]' : 'text-[#6E7681] line-through'
                              }`}
                            >
                              {feat.included ? (
                                <CheckCircle2 className="size-3.5 text-[#3FB950] shrink-0" />
                              ) : (
                                <X className="size-3.5 text-[#F85149] shrink-0" />
                              )}
                              <span className="font-sans">{feat.title}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Desktop Expanded Panel for Selected Package */}
            {expandedPackageId && (
              <div className="hidden lg:block rounded-2xl border border-[#06B6D4] bg-[#0D1117] p-4 space-y-2.5 animate-in fade-in">
                <div className="flex items-center justify-between border-b border-[#21262D] pb-2">
                  <span className="text-xs font-mono font-bold text-[#06B6D4]">
                    {PACKAGES.find((p) => p.id === expandedPackageId)?.name} — What&apos;s Included
                  </span>
                  <button
                    type="button"
                    onClick={() => setExpandedPackageId(null)}
                    className="text-[11px] font-mono text-[#8B949E] hover:text-[#F0F6FC]"
                  >
                    Hide Details ▲
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {getSalonPackageFeatures(expandedPackageId, selectedLanguage).map((feat, fIdx) => (
                    <div
                      key={fIdx}
                      className={`rounded-xl border p-2.5 flex items-center gap-2 ${
                        feat.included
                          ? 'border-[#30363D] bg-[#161B22] text-[#F0F6FC]'
                          : 'border-[#21262D] bg-[#0D1117] text-[#6E7681] line-through'
                      }`}
                    >
                      {feat.included ? (
                        <CheckCircle2 className="size-4 text-[#3FB950] shrink-0" />
                      ) : (
                        <X className="size-4 text-[#F85149] shrink-0" />
                      )}
                      <span className="font-sans">{feat.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Clear 10% Maintenance Explanation Card */}
            <div className="rounded-xl border border-[#116329] bg-[#0D3822] p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-mono font-bold text-[#3FB950] flex items-center gap-1.5">
                  <ShieldCheck className="size-4 text-[#3FB950]" />
                  <span>{T.maintHighlight}</span>
                </span>
                <span className="text-xs font-mono text-[#D29922] font-bold">
                  {regionalTier === 'PAKISTAN'
                    ? `PKR ${currentPackage.monthlyMaint.toLocaleString()} / mo (10%)`
                    : regionalTier === 'MENA'
                    ? `${Math.round(currentPackage.monthlyMaintUsd * 3.67)} AED / mo (10%)`
                    : `£${(currentPackage.monthlyMaintUsd * 0.79).toFixed(2)} / mo (10%)`}
                </span>
              </div>
              <p className="text-xs text-[#F0F6FC] font-sans leading-relaxed">{T.maintExplain}</p>
            </div>

            {/* Queries 6 & 7: Multi-Branch Dedicated WhatsApp Line Policy */}
            <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3 text-xs font-mono space-y-1.5">
              <span className="text-[#06B6D4] font-bold flex items-center gap-1.5">
                <Smartphone className="size-3.5 text-[#06B6D4]" />
                <span>
                  {selectedLanguage === 'URDU'
                    ? 'ملٹی برانچ سیلون پالیسی: ہر برانچ کا الگ واٹس ایپ نمبر'
                    : selectedLanguage === 'ARABIC'
                    ? 'سياسة الفروع المتعددة: رقم واتساب مخصص لكل فرع'
                    : 'Multi-Branch Policy: 1 Dedicated WhatsApp Number Per Branch'}
                </span>
              </span>
              <p className="text-[11px] text-[#8B949E] font-sans leading-relaxed">
                {selectedLanguage === 'URDU'
                  ? 'اگر آپ کے سیلون کی ایک سے زیادہ برانچز ہیں، تو ہر برانچ کا اپنا الگ واٹس ایپ نمبر ہونا لازمی ہے۔ اس سے ہر دکان کے باربرز کو ڈائریکٹ بکنگ الرٹس ملتے ہیں اور 10 فیصد ماہانہ مینٹیننس کا حساب کتاب شفاف رہتا ہے۔'
                  : selectedLanguage === 'ARABIC'
                  ? 'إذا كان لصالونك فروع متعددة، فيجب تزويد كل فرع برقم واتساب مستقل. هذا يضمن توجيه تنبيهات الحلاقة مباشرة لكل فرع وفواتير صيانة شهرية منفصلة بنسبة 10%.'
                  : 'Each salon branch requires its own dedicated WhatsApp number. This ensures direct booking alerts to each location’s staff, separate customer queues, and transparent 10% monthly maintenance billing.'}
              </p>
            </div>

            {/* Payment Method Selector */}
            <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase text-[#8B949E] block">
                  Digital Payment Channel:
                </span>
                <span className="text-[9px] font-mono text-[#3FB950] font-bold">
                  {regionalTier === 'PAKISTAN' ? '🇵🇰 State Bank / Raast Compliant' : '🌐 Stripe Global Gateway'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 font-mono text-xs">
                {(regionalTier === 'PAKISTAN'
                  ? ['EasyPaisa', 'JazzCash', 'Meezan Bank (IBFT)']
                  : regionalTier === 'MENA'
                  ? ['Stripe / Card', 'Bank Wire (IBAN)', 'Apple Pay / Digital']
                  : ['Stripe / Card', 'SEPA / UK Wire', 'Digital Multi-Currency']
                ).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    className={`min-h-[48px] p-2.5 rounded-lg border text-center transition text-[11px] ${
                      paymentMethod === method
                        ? 'border-[#06B6D4] bg-[#21262D] text-[#06B6D4] font-bold'
                        : 'border-[#30363D] bg-[#161B22] text-[#8B949E] hover:text-[#F0F6FC]'
                    }`}
                  >
                    {method}
                  </button>
                ))}
              </div>

              {/* Query 1: Auto-Detected Self-Serve Recipient Routing */}
              <div className="pt-2 border-t border-[#21262D] flex items-center justify-between text-[11px] font-mono">
                <span className="text-[#06B6D4] font-bold flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-[#06B6D4]" />
                  <span>Routing: SELF_SERVE (Auto-Detected)</span>
                </span>
                <span className="text-[#8B949E] text-[10px]">Direct Owner WhatsApp Alert Only</span>
              </div>
            </div>

            {/* Pay Action & Back Navigation */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[#21262D]">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="min-h-[44px] text-xs font-mono text-[#8B949E] hover:text-[#F0F6FC] transition"
              >
                ← {selectedLanguage === 'URDU' ? 'واپس سروس مینو' : selectedLanguage === 'ARABIC' ? 'الرجوع لقائمة الخدمات' : 'Back to Service Menu'}
              </button>
              <button
                onClick={handleConfirmPayment}
                disabled={isPaymentProcessing}
                className="w-full sm:w-auto min-h-[48px] flex items-center justify-center gap-2 rounded-xl bg-[#06B6D4] hover:bg-[#22D3EE] text-[#0D1117] py-3.5 px-6 text-xs font-mono font-bold uppercase transition active:scale-95"
              >
                {isPaymentProcessing ? (
                  <span>Confirming Payment...</span>
                ) : (
                  <>
                    <span>{T.payBtn}</span>
                    <ArrowRight className="size-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </PortalCard>
      )}

      {/* STEP 4: CONNECT SALON WHATSAPP (8-DIGIT CODE OR QR SCAN) */}
      {step === 4 && (
        <PortalCard title={T.pairTitle} kicker="CONNECT YOUR SALON WHATSAPP">
          <div className="space-y-5 text-center">
            {/* Pairing Mode Switcher */}
            <div className="flex items-center justify-center gap-1.5 p-1 rounded-xl bg-[#0D1117] border border-[#30363D] max-w-md mx-auto">
              <button
                type="button"
                onClick={() => setPairingMode('REMOTE_CODE')}
                className={`flex-1 min-h-[44px] py-2 px-3 rounded-lg text-xs font-mono font-bold transition flex items-center justify-center gap-1.5 ${
                  pairingMode === 'REMOTE_CODE'
                    ? 'bg-[#06B6D4] text-[#0D1117]'
                    : 'text-[#8B949E] hover:text-[#F0F6FC]'
                }`}
              >
                <Smartphone className="size-3.5" />
                <span>8-Digit Code (Single Phone)</span>
              </button>
              <button
                type="button"
                onClick={() => setPairingMode('VISUAL_QR')}
                className={`flex-1 min-h-[44px] py-2 px-3 rounded-lg text-xs font-mono font-bold transition flex items-center justify-center gap-1.5 ${
                  pairingMode === 'VISUAL_QR'
                    ? 'bg-[#3B2E0B] border border-[#9E6A03] text-[#D29922]'
                    : 'text-[#8B949E] hover:text-[#F0F6FC]'
                }`}
              >
                <QrCode className="size-3.5" />
                <span>Visual QR (Agent / Tablet)</span>
              </button>
            </div>

            {/* 1. REMOTE SOLO ONBOARDING: 8-DIGIT WHATSAPP PAIRING CODE */}
            {pairingMode === 'REMOTE_CODE' && (
              <div className={`space-y-4 max-w-lg mx-auto animate-in fade-in duration-200 ${isPwaRtl ? 'text-right' : 'text-left'}`}>
                <div className="rounded-2xl border border-[#30363D] bg-[#0D1117] p-4 space-y-2 overflow-hidden">
                  <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#06B6D4]">
                    <Sparkles className="size-4 shrink-0" />
                    <span>WhatsApp 8-Digit Pairing Code Generated</span>
                  </div>
                  <p className="text-xs text-[#8B949E] font-sans leading-relaxed break-words [overflow-wrap:break-word]">
                    Because you are onboarding directly from your mobile phone, you don&apos;t need a second screen. Enter this 8-digit code in your WhatsApp Linked Devices to authorize the WORKCRAFT cloud concierge.
                  </p>
                </div>

                {/* 8-Digit Display Card */}
                <div className="rounded-2xl border border-[#30363D] bg-[#0D1117] p-5 text-center space-y-3 overflow-hidden">
                  <span className="text-[10px] font-mono uppercase tracking-[.2em] text-[#6E7681] block">
                    YOUR SINGLE-USE PAIRING CODE
                  </span>
                  <div
                    dir="ltr"
                    className="text-3xl sm:text-4xl font-black font-mono tracking-widest text-[#06B6D4] break-all [overflow-wrap:break-word]"
                  >
                    {pairingCode}
                  </div>

                  <div className="flex items-center justify-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCopiedCode(true);
                        setTimeout(() => setIsCopiedCode(false), 2500);
                      }}
                      className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border border-[#30363D] bg-[#21262D] hover:border-[#06B6D4] px-4 py-2 text-xs font-mono font-bold text-[#F0F6FC] transition"
                    >
                      {isCopiedCode ? <Check className="size-3.5 text-[#3FB950]" /> : <Smartphone className="size-3.5 text-[#06B6D4]" />}
                      <span>{isCopiedCode ? 'Copied to Clipboard! ✓' : 'Copy 8-Digit Code'}</span>
                    </button>
                  </div>

                  {/* Plain-language single-salon protection badge */}
                  <div className={`pt-2 border-t border-[#21262D] flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono ${isPwaRtl ? 'text-right' : 'text-left'}`}>
                    <span className="text-[#06B6D4] flex items-center gap-1 font-bold">
                      <ShieldCheck className="size-3 text-[#06B6D4] shrink-0" />
                      <span>Locked to This Salon Only (1-Time Code)</span>
                    </span>
                    <span className="text-[#3FB950] font-bold">
                      {isCodeVerified ? '✓ CONNECTED & SECURED' : 'READY'}
                    </span>
                  </div>
                </div>

                {/* Step-by-Step Instructions */}
                <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-4 text-xs font-mono space-y-2 overflow-hidden">
                  <span className="text-[10px] font-bold text-[#D29922] uppercase block">
                    3 Easy Steps to Connect:
                  </span>
                  <ol className="list-decimal list-inside space-y-1.5 text-[#8B949E] font-sans">
                    <li>Open WhatsApp on this mobile phone.</li>
                    <li>Tap <strong className="text-[#F0F6FC]">Settings ➔ Linked Devices ➔ Link a Device</strong>.</li>
                    <li>
                      Tap <strong className="text-[#F0F6FC]">&quot;Link with phone number instead&quot;</strong> and enter{' '}
                      <strong dir="ltr" className="text-[#06B6D4] break-all [overflow-wrap:break-word]">
                        {pairingCode}
                      </strong>
                      .
                    </li>
                  </ol>
                </div>

                {/* Connection Verification */}
                <div className="space-y-2 pt-1">
                  {!isCodeVerified ? (
                    <button
                      type="button"
                      onClick={() => {
                        setIsVerifyingCode(true);
                        setTimeout(() => {
                          setIsVerifyingCode(false);
                          setIsCodeVerified(true);
                        }, 1200);
                      }}
                      disabled={isVerifyingCode}
                      className="w-full min-h-[48px] flex items-center justify-center gap-2 rounded-xl bg-[#06B6D4] hover:bg-[#22D3EE] text-[#0D1117] py-3.5 px-4 text-xs font-mono font-bold uppercase transition active:scale-95"
                    >
                      {isVerifyingCode ? (
                        <span>Connecting WhatsApp...</span>
                      ) : (
                        <>
                          <CheckCircle2 className="size-4" />
                          <span>Verify 8-Digit Code &amp; Connect WhatsApp ➔</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="rounded-2xl border border-[#116329] bg-[#0D3822] p-4 space-y-4 animate-in zoom-in-95">
                      <div className="flex items-center gap-2 text-[#3FB950] font-mono font-bold text-xs">
                        <CheckCircle2 className="size-5 text-[#3FB950]" />
                        <span>MashaAllah! Salon WhatsApp Connected!</span>
                      </div>
                      <p className="text-xs text-[#F0F6FC] font-sans leading-relaxed">
                        Your {selectedCategory === 'LADIES' ? 'ladies beauty parlor' : 'salon'} WhatsApp is now connected. Two automated messages have been sent to your WhatsApp number:
                      </p>

                      {/* Query 13: WhatsApp Dispatch 1 - Welcome Note & Paid Package Confirmation */}
                      <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3.5 space-y-2 text-left font-mono text-xs overflow-hidden">
                        <div className="flex items-center justify-between text-[10px] text-[#3FB950] border-b border-[#21262D] pb-1.5">
                          <span className="font-bold flex items-center gap-1.5">
                            <MessageSquare className="size-3.5" />
                            <span>WhatsApp Message 1 · Welcome &amp; Package Paid</span>
                          </span>
                          <span className="text-[#8B949E]">Delivered ✓✓</span>
                        </div>
                        <div className="rounded-lg bg-[#161B22] p-2.5 border-l-2 border-[#3FB950] space-y-1">
                          <p className="text-[#F0F6FC] text-xs font-sans">
                            {selectedLanguage === 'URDU' ? (
                              <>
                                السلام علیکم! <strong>{salonName}</strong> کو ورک کرافٹ میں خوش آمدید۔ آپ کا <strong>{currentPackage.name}</strong> پیکج اور سیٹ اپ فیس (<strong>{regionalTier === 'PAKISTAN' ? `PKR ${currentPackage.setupPrice.toLocaleString()}` : `$${currentPackage.setupPriceUsd} USD`}</strong>) کی تصدیق ہو گئی ہے۔ واٹس ایپ خودکار بکنگ اب 24 گھنٹے لائیو ہے۔
                              </>
                            ) : selectedLanguage === 'ARABIC' ? (
                              <>
                                مرحباً بك في وورك كرافت! تم تأكيد دفع باقة <strong>{currentPackage.name}</strong> ورسوم التأسيس بنجاح لصالون <strong>{salonName}</strong>. الرد الآلي والحجز الذكي عبر واتساب مفعل الآن 24/7.
                              </>
                            ) : (
                              <>
                                Assalamu Alaikum! Welcome to WorkCraft. Your <strong>{currentPackage.name}</strong> package setup payment of <strong>{regionalTier === 'PAKISTAN' ? `PKR ${currentPackage.setupPrice.toLocaleString()}` : `$${currentPackage.setupPriceUsd} USD`}</strong> is confirmed. 24/7 WhatsApp AI concierge is now live for <strong>{salonName}</strong>.
                              </>
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Query 13: WhatsApp Dispatch 2 - Generated Private Dashboard Installation Link */}
                      <div className="rounded-xl border border-[#06B6D4]/40 bg-[#0D1117] p-3.5 space-y-2 text-left font-mono text-xs overflow-hidden">
                        <div className="flex items-center justify-between text-[10px] text-[#06B6D4] border-b border-[#21262D] pb-1.5">
                          <span className="font-bold flex items-center gap-1.5">
                            <Smartphone className="size-3.5" />
                            <span>WhatsApp Message 2 · Dashboard Installation Link</span>
                          </span>
                          <span className="text-[#8B949E]">Delivered ✓✓</span>
                        </div>
                        <div className="rounded-lg bg-[#161B22] p-2.5 border-l-2 border-[#06B6D4] space-y-1.5">
                          <p className="text-xs text-[#F0F6FC] font-sans">
                            {selectedLanguage === 'URDU'
                              ? 'اپنا ذاتی سیلون اونر ڈیش بورڈ انسٹال کرنے کے لیے نیچے دیے گئے لنک پر کلک کریں اور ہوم اسکرین پر شارٹ کٹ آئیکن شامل کریں:'
                              : selectedLanguage === 'ARABIC'
                              ? 'لتثبيت لوحة تحكم مالك الصالون وإضافة اختصار إلى الشاشة الرئيسية، اضغط على الرابط التالي:'
                              : 'Tap your secure link to install the Salon Owner Dashboard and add the shortcut icon to your phone home screen:'}
                          </p>
                          <div className="p-2 rounded bg-[#0D1117] border border-[#30363D] text-[11px] text-[#06B6D4] break-all font-mono">
                            https://portal.workcraft.local/?role=salon_owner&amp;paired=true
                          </div>
                        </div>
                      </div>

                      {/* 1-Click Branded Window Poster & Cabin Pamphlet PDF (Query 6) */}
                      <SalonWindowPosterPdf
                        salonName={salonName}
                        salonCategory={selectedCategory}
                        whatsappNumber={
                          selectedRegion === '+971'
                            ? '+971 50 778 9012'
                            : selectedRegion === '+44'
                            ? '+44 7911 445566'
                            : '+92 300 4567890'
                        }
                        initialLanguage={
                          (selectedLanguage === 'ARABIC'
                            ? 'ar'
                            : selectedLanguage === 'URDU' || selectedLanguage === 'ROMAN_URDU'
                            ? 'ur'
                            : 'en') as PosterLang
                        }
                      />

                      {/* 1-Tap Mobile Home Screen Shortcut */}
                      <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3.5 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <img
                            src="/icon.svg"
                            alt="WorkCraft Mobile App Icon"
                            className="size-10 rounded-xl border border-[#9E6A03] shrink-0"
                          />
                          <div>
                            <p className="text-xs font-bold text-[#F0F6FC]">WorkCraft</p>
                            <p className="text-[10px] text-[#8B949E] font-sans">
                              {isHomeShortcutInstalled
                                ? (selectedLanguage === 'URDU' ? 'ہوم اسکرین پر محفوظ ہو گیا ✓' : selectedLanguage === 'ARABIC' ? 'تم الحفظ على الشاشة الرئيسية ✓' : 'Saved to phone home screen ✓')
                                : (selectedLanguage === 'URDU' ? 'فون کی ہوم اسکرین پر شارٹ کٹ بنائیں' : selectedLanguage === 'ARABIC' ? 'إنشاء اختصار على الشاشة' : '1-Tap shortcut icon on your phone')}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setIsHomeShortcutInstalled(true)}
                          className={`min-h-[44px] px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold transition shrink-0 border ${
                            isHomeShortcutInstalled
                              ? 'bg-[#0D3822] text-[#3FB950] border-[#116329]'
                              : 'bg-[#06B6D4] hover:bg-[#22D3EE] text-[#0D1117] border-[#06B6D4]'
                          }`}
                        >
                          {isHomeShortcutInstalled ? 'Saved ✓' : 'Install Shortcut'}
                        </button>
                      </div>

                      {/* Launch Salon Owner Dashboard Button */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsDashboardLaunched(true);
                          onPairingComplete(inputSalonName || salonName);
                        }}
                        className="w-full min-h-[48px] flex items-center justify-center gap-2 rounded-xl bg-[#06B6D4] hover:bg-[#22D3EE] text-[#0D1117] py-3.5 px-4 text-xs font-mono font-bold uppercase transition active:scale-95"
                      >
                        <span>Launch {inputSalonName || salonName} Dashboard →</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 2. IN-PERSON QR SCAN (AGENT TABLET / LAPTOP) */}
            {pairingMode === 'VISUAL_QR' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <p className="text-xs text-[#8B949E] font-sans leading-relaxed max-w-lg mx-auto">
                  {T.pairDesc}
                </p>

                <div className="mx-auto grid size-52 place-items-center rounded-2xl bg-white p-5 text-slate-900 border-2 border-[#06B6D4]">
                  <svg viewBox="0 0 100 100" className="w-full h-full text-slate-950">
                    <rect x="5" y="5" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="4" rx="2" />
                    <rect x="11" y="11" width="12" height="12" fill="currentColor" rx="1" />
                    <rect x="71" y="5" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="4" rx="2" />
                    <rect x="77" y="11" width="12" height="12" fill="currentColor" rx="1" />
                    <rect x="5" y="71" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="4" rx="2" />
                    <rect x="11" y="77" width="12" height="12" fill="currentColor" rx="1" />
                    <circle cx="36" cy="17" r="3" fill="currentColor" />
                    <circle cx="50" cy="17" r="3" fill="currentColor" />
                    <circle cx="64" cy="17" r="3" fill="currentColor" />
                    <circle cx="20" cy="50" r="3" fill="currentColor" />
                    <circle cx="50" cy="50" r="3" fill="currentColor" />
                    <circle cx="80" cy="50" r="3" fill="currentColor" />
                    <rect x="42" y="42" width="16" height="16" fill="#D29922" rx="3" />
                  </svg>
                </div>

                {/* 1-Tap Mobile Home Screen Shortcut Prompt (Query 6 & 7) */}
                <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3.5 max-w-lg mx-auto flex items-center justify-between gap-3 text-left">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src="/icon.svg"
                      alt="WorkCraft Mobile App Icon"
                      className="size-10 rounded-xl border border-[#9E6A03] shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#F0F6FC]">WorkCraft</p>
                      <p className="text-[10px] text-[#8B949E] font-sans truncate">
                        {isHomeShortcutInstalled
                          ? (selectedLanguage === 'URDU' ? 'ہوم اسکرین پر محفوظ ہو گیا ✓' : selectedLanguage === 'ARABIC' ? 'تم الحفظ على الشاشة الرئيسية ✓' : 'Saved to phone home screen ✓')
                          : (selectedLanguage === 'URDU' ? 'فون کی ہوم اسکرین پر شارٹ کٹ بنائیں' : selectedLanguage === 'ARABIC' ? 'إنشاء اختصار على الشاشة' : '1-Tap shortcut icon on your phone')}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsHomeShortcutInstalled(true)}
                    className={`min-h-[44px] px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold transition shrink-0 border ${
                      isHomeShortcutInstalled
                        ? 'bg-[#0D3822] text-[#3FB950] border-[#116329]'
                        : 'bg-[#06B6D4] hover:bg-[#22D3EE] text-[#0D1117] border-[#06B6D4]'
                    }`}
                  >
                    {isHomeShortcutInstalled ? 'Saved ✓' : 'Install Shortcut'}
                  </button>
                </div>

                {/* Printable PDF Poster Ready Upon Agent QR Scan too */}
                <div className="max-w-2xl mx-auto pt-2">
                  <SalonWindowPosterPdf
                    salonName={inputSalonName || salonName}
                    salonCategory={selectedCategory}
                    whatsappNumber={
                      selectedRegion === '+971'
                        ? '+971 50 778 9012'
                        : selectedRegion === '+44'
                        ? '+44 7911 445566'
                        : '+92 300 4567890'
                    }
                    initialLanguage={
                      (selectedLanguage === 'ARABIC'
                        ? 'ar'
                        : selectedLanguage === 'URDU' || selectedLanguage === 'ROMAN_URDU'
                        ? 'ur'
                        : 'en') as PosterLang
                    }
                  />
                </div>

                <div className="pt-2 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsDashboardLaunched(true);
                      onPairingComplete(inputSalonName || salonName);
                    }}
                    className="min-h-[48px] rounded-xl bg-[#06B6D4] hover:bg-[#22D3EE] text-[#0D1117] px-6 py-3 text-xs font-mono font-bold uppercase transition active:scale-95"
                  >
                    {T.finishBtn}
                  </button>
                </div>
              </div>
            )}
          </div>
        </PortalCard>
      )}
    </div>
  );
};
