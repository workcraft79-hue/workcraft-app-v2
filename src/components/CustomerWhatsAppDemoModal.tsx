import React, { useEffect, useState } from 'react';
import {
  Calendar,
  Check,
  Clock,
  Copy,
  ExternalLink,
  Film,
  Globe,
  MapPin,
  MessageSquare,
  RotateCcw,
  Scissors,
  Send,
  ShieldAlert,
  Tag,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';
import { LOGO_URL, WATERMARK_URL } from '../data/portalData';
import type {
  ClientPreferredLang,
  CustomerActionMessageResponse,
  CustomerExperienceConfig,
  CustomerMenuActionId,
  SalonDeal,
} from '../types/concierge';
import { CustomerBookingFlow } from './CustomerBookingFlow';
import { PublicSalonDealPage } from './PublicSalonDealPage';

interface CustomerWhatsAppDemoModalProps {
  salonId: string;
  salonPublicCode?: string;
  isOpen: boolean;
  onClose: () => void;
}

const DEMO_SALON_PUBLIC_CODES: Record<string, string> = {
  '1': 'wc_7k9m2p4x8q2a',
  '2': 'wc_3r8v5n2w9c4j',
  '3': 'wc_9p4d6t2m8y1k',
  '4': 'wc_5w2h8z4f7b3n',
  '5': 'wc_6m9q3x7v2p5d',
};

function resolveDemoPublicCode(idOrCode: string, fallbackCode?: string): string {
  if (idOrCode.startsWith('wc_')) return idOrCode;
  if (DEMO_SALON_PUBLIC_CODES[idOrCode]) return DEMO_SALON_PUBLIC_CODES[idOrCode];
  return fallbackCode || idOrCode;
}

interface ChatBubbleItem {
  id: string;
  from: 'CUSTOMER' | 'SALON';
  action?: CustomerMenuActionId | 'WELCOME';
  text: string;
  dir: 'ltr' | 'rtl';
  lang: ClientPreferredLang;
  welcome?: CustomerActionMessageResponse['welcome'];
  services?: CustomerActionMessageResponse['services'];
  hours?: CustomerActionMessageResponse['hours'];
  address?: string;
  googleMapsUrl?: string;
  deals?: CustomerActionMessageResponse['deals'];
  showBookCta?: boolean;
  bookCtaLabel?: string;
}

const DEMO_UI_LABELS: Partial<
  Record<
    ClientPreferredLang,
    {
      mapsDirections: string;
      copyBtn: string;
      copiedBtn: string;
      bookAppointment: string;
      watchVideo: string;
      bookDeal: string;
    }
  >
> = {
  en: {
    mapsDirections: 'Google Maps Directions',
    copyBtn: 'Copy',
    copiedBtn: 'Copied',
    bookAppointment: 'Book Appointment',
    watchVideo: 'Watch Video',
    bookDeal: 'Book Deal',
  },
  roman_ur: {
    mapsDirections: 'Google Maps Directions',
    copyBtn: 'Copy',
    copiedBtn: 'Copied',
    bookAppointment: 'Appointment Book Karein',
    watchVideo: 'Video Dekhein',
    bookDeal: 'Deal Book Karein',
  },
  ur: {
    mapsDirections: 'گوگل میپس ڈائریکشنز',
    copyBtn: 'کاپی',
    copiedBtn: 'کاپی ہو گیا',
    bookAppointment: 'اپائنٹمنٹ بک کریں',
    watchVideo: 'ویڈیو دیکھیں',
    bookDeal: 'ڈیل بک کریں',
  },
  ar: {
    mapsDirections: 'اتجاهات خرائط جوجل',
    copyBtn: 'نسخ',
    copiedBtn: 'تم النسخ',
    bookAppointment: 'احجز موعداً',
    watchVideo: 'شاهد الفيديو',
    bookDeal: 'احجز العرض',
  },
};

function formatLocalizedDealBadge(
  deal: SalonDeal,
  lang: ClientPreferredLang,
  currencySymbol: string
): string {
  if (deal.discountType === 'PCT') {
    if (lang === 'ur') return `${deal.discountValue}% رعایت`;
    if (lang === 'ar') return `خصم ${deal.discountValue}%`;
    return `${deal.discountValue}% OFF`;
  }
  if (deal.discountType === 'FIXED') {
    if (lang === 'ur') return `${currencySymbol}${deal.discountValue.toLocaleString()} رعایت`;
    if (lang === 'ar') return `خصم ${currencySymbol}${deal.discountValue.toLocaleString()}`;
    return `${currencySymbol}${deal.discountValue.toLocaleString()} OFF`;
  }
  if (lang === 'ur') return `پیکیج ${currencySymbol}${deal.discountValue.toLocaleString()}`;
  if (lang === 'ar') return `باقة ${currencySymbol}${deal.discountValue.toLocaleString()}`;
  return `Bundle ${currencySymbol}${deal.discountValue.toLocaleString()}`;
}

export const CustomerWhatsAppDemoModal: React.FC<CustomerWhatsAppDemoModalProps> = ({
  salonId,
  salonPublicCode,
  isOpen,
  onClose,
}) => {
  const initialPublicCode = resolveDemoPublicCode(salonId, salonPublicCode);
  const [activeSalonId, setActiveSalonId] = useState<string>(initialPublicCode);
  const [config, setConfig] = useState<CustomerExperienceConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeLang, setActiveLang] = useState<ClientPreferredLang>('en');
  const [customerMode, setCustomerMode] = useState<'NEW' | 'SAVED'>('NEW');
  const [simulateBusyBarber, setSimulateBusyBarber] = useState<string>('');
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<ChatBubbleItem[]>([]);
  const [copiedBubbleId, setCopiedBubbleId] = useState<string | null>(null);
  const [activeSheet, setActiveSheet] = useState<
    | null
    | { kind: 'FLOW'; dealId?: string | null }
    | { kind: 'DEAL'; dealId: string }
  >(null);

  useEffect(() => {
    setActiveSalonId(resolveDemoPublicCode(salonId, salonPublicCode));
  }, [salonId, salonPublicCode]);

  const getDemoClientIdentity = (
    mode: 'NEW' | 'SAVED',
    targetSalonCode: string,
    cfg?: CustomerExperienceConfig | null
  ) => {
    const isDubai = targetSalonCode === DEMO_SALON_PUBLIC_CODES['3'] || targetSalonCode === '3';
    if (mode === 'SAVED') {
      if (isDubai) {
        return {
          fromPhone: '+971 50 8923411',
          clientName: cfg?.returningClient?.clientName || 'Zayed Al-Hashmi',
        };
      }
      return {
        fromPhone: '+92 300 1234567',
        clientName: cfg?.returningClient?.clientName || 'Bilal Ahmed',
      };
    }
    return {
      fromPhone: isDubai ? '+971 50 0009999' : '+92 300 0009999',
      clientName: '',
    };
  };

  const handleCopyText = async (bubbleId: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedBubbleId(bubbleId);
      setTimeout(() => {
        setCopiedBubbleId((prev) => (prev === bubbleId ? null : prev));
      }, 2200);
    } catch {
      // Fallback ignored inside restricted sandbox
    }
  };

  const loadConfigAndStartHi = async (
    langOverride?: ClientPreferredLang,
    modeOverride?: 'NEW' | 'SAVED',
    salonOverride?: string
  ) => {
    setLoading(true);
    setActiveSheet(null);
    const targetSalon = resolveDemoPublicCode(salonOverride || activeSalonId || initialPublicCode, salonPublicCode);
    const chosenLang = langOverride || activeLang || 'en';
    const useMode = modeOverride || customerMode;
    try {
      const cfgRes = await fetch(
        `/api/public/salons/${encodeURIComponent(targetSalon)}/customer-experience?lang=${encodeURIComponent(
          chosenLang
        )}`,
        { credentials: 'include' }
      );
      let loadedCfg = config;
      if (cfgRes.ok) {
        const cfgData = (await cfgRes.json()) as CustomerExperienceConfig;
        loadedCfg = cfgData;
        setConfig(cfgData);
        const allowedLangs = (cfgData.availableLanguages || []).map((l) => l.lang);
        if (allowedLangs.length > 0 && !allowedLangs.includes(chosenLang)) {
          setActiveLang('en');
        }
      }

      const finalIdentity = getDemoClientIdentity(useMode, targetSalon, loadedCfg);
      const hiRes = await fetch(
        `/api/public/salons/${encodeURIComponent(targetSalon)}/customer-message`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            actionId: 'WELCOME',
            messageText: 'Hi',
            preferredLang: chosenLang,
            fromPhone: finalIdentity.fromPhone,
            clientName: finalIdentity.clientName,
            isDemo: true,
          }),
        }
      );
      if (hiRes.ok) {
        const welcomeData = (await hiRes.json()) as CustomerActionMessageResponse;
        setActiveLang(welcomeData.language);
        setMessages([
          {
            id: `c-hi-${Date.now()}`,
            from: 'CUSTOMER',
            text: 'Hi',
            dir: 'ltr',
            lang: welcomeData.language,
          },
          {
            id: `s-welcome-${Date.now() + 1}`,
            from: 'SALON',
            action: welcomeData.action,
            text: welcomeData.text,
            dir: welcomeData.dir,
            lang: welcomeData.language,
            welcome: welcomeData.welcome,
          },
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setActiveLang('en');
    setSimulateBusyBarber('');
    void loadConfigAndStartHi('en', customerMode, initialPublicCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialPublicCode]);

  if (!isOpen) return null;

  const handleModeSwitch = (nextMode: 'NEW' | 'SAVED') => {
    setCustomerMode(nextMode);
    void loadConfigAndStartHi(activeLang, nextMode, activeSalonId);
  };

  const handlePreviewSalonSwitch = (nextSalonId: string, preferredDefaultLang?: ClientPreferredLang) => {
    setActiveSalonId(nextSalonId);
    setSimulateBusyBarber('');
    const nextLang = preferredDefaultLang || 'en';
    setActiveLang(nextLang);
    void loadConfigAndStartHi(nextLang, customerMode, nextSalonId);
  };

  const triggerOption = async (
    actionId: CustomerMenuActionId,
    labelText: string,
    langOverride?: ClientPreferredLang
  ) => {
    const useLang = langOverride || activeLang;
    if (actionId === 'BOOK_APPOINTMENT') {
      setMessages((prev) => [
        ...prev,
        {
          id: `c-act-${Date.now()}`,
          from: 'CUSTOMER',
          text: labelText,
          dir: useLang === 'ur' || useLang === 'ar' ? 'rtl' : 'ltr',
          lang: useLang,
        },
      ]);
      setActiveSheet({ kind: 'FLOW', dealId: null });
      return;
    }

    const identity = getDemoClientIdentity(customerMode, activeSalonId, config);
    const res = await fetch(
      `/api/public/salons/${encodeURIComponent(activeSalonId)}/customer-message`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionId,
          preferredLang: useLang,
          fromPhone: identity.fromPhone,
          clientName: identity.clientName,
          isDemo: true,
        }),
      }
    );
    if (!res.ok) return;
    const data = (await res.json()) as CustomerActionMessageResponse;
    setMessages((prev) => [
      ...prev,
      {
        id: `c-act-${Date.now()}`,
        from: 'CUSTOMER',
        text: labelText,
        dir: useLang === 'ur' || useLang === 'ar' ? 'rtl' : 'ltr',
        lang: useLang,
      },
      {
        id: `s-act-${Date.now() + 1}`,
        from: 'SALON',
        action: data.action,
        text: data.text,
        dir: data.dir,
        lang: data.language,
        services: data.services,
        hours: data.hours,
        address: data.address,
        googleMapsUrl: data.googleMapsUrl,
        deals: data.deals,
        showBookCta: data.showBookCta,
        bookCtaLabel: data.bookCtaLabel,
      },
    ]);
  };

  const handleLanguageChange = async (nextLang: ClientPreferredLang) => {
    setActiveLang(nextLang);
    const identity = getDemoClientIdentity(customerMode, activeSalonId, config);
    const res = await fetch(
      `/api/public/salons/${encodeURIComponent(activeSalonId)}/customer-message`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionId: 'WELCOME',
          preferredLang: nextLang,
          fromPhone: identity.fromPhone,
          clientName: identity.clientName,
          isDemo: true,
        }),
      }
    );
    if (!res.ok) return;
    const data = (await res.json()) as CustomerActionMessageResponse;
    setMessages((prev) =>
      prev.map((m, idx) =>
        idx === 1 && m.from === 'SALON'
          ? {
              ...m,
              text: data.text,
              dir: data.dir,
              lang: data.language,
              welcome: data.welcome,
            }
          : m
      )
    );
  };

  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text) return;
    setChatInput('');
    const identity = getDemoClientIdentity(customerMode, activeSalonId, config);
    const res = await fetch(
      `/api/public/salons/${encodeURIComponent(activeSalonId)}/customer-message`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageText: text,
          preferredLang: activeLang,
          fromPhone: identity.fromPhone,
          clientName: identity.clientName,
          isDemo: true,
        }),
      }
    );
    if (!res.ok) return;
    const data = (await res.json()) as CustomerActionMessageResponse;
    setMessages((prev) => [
      ...prev,
      { id: `c-txt-${Date.now()}`, from: 'CUSTOMER', text, dir: 'ltr', lang: activeLang },
      {
        id: `s-txt-${Date.now() + 1}`,
        from: 'SALON',
        action: data.action,
        text: data.text,
        dir: data.dir,
        lang: data.language,
        welcome: data.welcome,
        services: data.services,
        hours: data.hours,
        address: data.address,
        googleMapsUrl: data.googleMapsUrl,
        deals: data.deals,
        showBookCta: data.showBookCta,
        bookCtaLabel: data.bookCtaLabel,
      },
    ]);
    if (data.openBookingFlow) {
      setActiveSheet({ kind: 'FLOW', dealId: null });
    }
  };

  const currentIdentity = getDemoClientIdentity(customerMode, activeSalonId, config);

  return (
    <div
      className="fixed inset-0 z-[99] bg-[#0D1117]/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl rounded-3xl border border-[#30363D] bg-[#161B22] shadow-2xl overflow-hidden flex flex-col max-h-[94vh]"
      >
        {/* Top Bar with Larger Transparent Top-Left WorkCraft Logo */}
        <header className="px-4 sm:px-6 py-3 border-b border-[#30363D] bg-[#0D1117] flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <img
                src={LOGO_URL}
                alt="WorkCraft"
                className="size-10 sm:size-11 bg-transparent object-contain shrink-0"
              />
              <MessageSquare className="size-4 text-[#25D366] shrink-0" />
              <h2 className="text-sm sm:text-base font-black text-[#F0F6FC]">
                Optional Paid Meta WhatsApp Add-On Preview
              </h2>
            </div>
            <p className="text-[11px] font-mono text-[#D29922] flex items-center gap-1.5">
              <ShieldAlert className="size-3.5 shrink-0" />
              <span>
                DEMO SANDBOX · Standard salon QR booking runs on the web at $0 API cost; Meta WhatsApp Cloud API is an optional paid add-on.
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Live Demo"
            className="min-h-[40px] min-w-[40px] rounded-xl border border-[#30363D] bg-[#161B22] grid place-items-center text-[#8B949E] hover:text-[#F0F6FC]"
          >
            <X className="size-4" />
          </button>
        </header>

        {/* Body Split: Owner Test Controls + Mobile WhatsApp Frame */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 p-4 sm:p-5">
          {/* Left: Demo Scenario Controls */}
          <aside className="space-y-4">
            <div className="rounded-2xl border border-[#30363D] bg-[#0D1117] p-4 space-y-3">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#06B6D4]">
                Demo Scenario Controls
              </h3>

              {/* Quick Region / Business Category Preview Switcher (Tests Arabic + AED & Ladies Parlor live) */}
              <div className="space-y-1.5 pb-2 border-b border-[#21262D]">
                <span className="text-[11px] font-mono text-[#8B949E] flex items-center gap-1.5">
                  <Globe className="size-3.5 text-[#06B6D4]" />
                  <span>Preview Region / Business Type</span>
                </span>
                <div className="grid grid-cols-1 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handlePreviewSalonSwitch(initialPublicCode, 'en')}
                    className={`min-h-[38px] rounded-xl border px-3 py-1.5 text-xs font-semibold text-left transition ${
                      activeSalonId === initialPublicCode
                        ? 'border-[#06B6D4] bg-[#06B6D4]/15 text-[#F0F6FC]'
                        : 'border-[#30363D] bg-[#161B22] text-[#8B949E]'
                    }`}
                  >
                    Your Active Salon
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePreviewSalonSwitch(DEMO_SALON_PUBLIC_CODES['3'], 'ar')}
                    className={`min-h-[38px] rounded-xl border px-3 py-1.5 text-xs font-semibold text-left transition ${
                      activeSalonId === DEMO_SALON_PUBLIC_CODES['3']
                        ? 'border-[#25D366] bg-[#0B2E1E] text-[#F0F6FC]'
                        : 'border-[#30363D] bg-[#161B22] text-[#8B949E]'
                    }`}
                  >
                    Dubai Salon · العربية (Arabic) &amp; AED
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePreviewSalonSwitch(DEMO_SALON_PUBLIC_CODES['5'], 'en')}
                    className={`min-h-[38px] rounded-xl border px-3 py-1.5 text-xs font-semibold text-left transition ${
                      activeSalonId === DEMO_SALON_PUBLIC_CODES['5']
                        ? 'border-[#EC4899] bg-[#EC4899]/15 text-[#F0F6FC]'
                        : 'border-[#30363D] bg-[#161B22] text-[#8B949E]'
                    }`}
                  >
                    Ladies Beauty Parlor (Bridal &amp; Glow)
                  </button>
                </div>
              </div>

              {/* New vs Saved Customer Toggle */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-mono text-[#8B949E] block">
                  Customer Profile Test Mode
                </span>
                <div className="grid grid-cols-1 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleModeSwitch('NEW')}
                    className={`min-h-[42px] rounded-xl border px-3 py-2 text-xs font-semibold flex items-center gap-2 transition ${
                      customerMode === 'NEW'
                        ? 'border-[#25D366] bg-[#0B2E1E] text-[#F0F6FC]'
                        : 'border-[#30363D] bg-[#161B22] text-[#8B949E]'
                    }`}
                  >
                    <UserPlus className="size-4 text-[#25D366] shrink-0" />
                    <span>New Customer (Name Required)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleModeSwitch('SAVED')}
                    className={`min-h-[42px] rounded-xl border px-3 py-2 text-xs font-semibold flex items-center gap-2 transition ${
                      customerMode === 'SAVED'
                        ? 'border-[#25D366] bg-[#0B2E1E] text-[#F0F6FC]'
                        : 'border-[#30363D] bg-[#161B22] text-[#8B949E]'
                    }`}
                  >
                    <UserCheck className="size-4 text-[#06B6D4] shrink-0" />
                    <span>Saved Customer (Name Skipped)</span>
                  </button>
                </div>
              </div>

              {/* Busy / Unavailable Barber Simulation */}
              <div className="space-y-1.5 pt-1 border-t border-[#21262D]">
                <label className="block space-y-1">
                  <span className="text-[11px] font-mono text-[#8B949E] block">
                    Simulate Busy / Unavailable Stylist
                  </span>
                  <select
                    value={simulateBusyBarber}
                    onChange={(e) => setSimulateBusyBarber(e.target.value)}
                    className="w-full min-h-[42px] rounded-xl border border-[#30363D] bg-[#161B22] px-3 text-xs text-[#F0F6FC] focus:outline-none focus:border-[#D29922]"
                  >
                    <option value="">None (Use real salon locks only)</option>
                    {(config?.barbers || []).map((b) => (
                      <option key={b} value={b}>
                        Mark &ldquo;{b}&rdquo; Busy in Demo
                      </option>
                    ))}
                  </select>
                </label>
                <p className="text-[11px] text-[#8B949E] leading-snug">
                  When selected, that stylist is hidden at busy times inside the Flow so only free stylists appear in green.
                </p>
              </div>

              {/* Quick Reset / Direct Flow Launch */}
              <div className="pt-1 border-t border-[#21262D] space-y-2">
                <button
                  type="button"
                  onClick={() => void loadConfigAndStartHi(activeLang, customerMode, activeSalonId)}
                  className="w-full min-h-[42px] rounded-xl border border-[#30363D] bg-[#161B22] hover:border-[#06B6D4] text-xs font-mono font-bold text-[#06B6D4] flex items-center justify-center gap-2 transition"
                >
                  <RotateCcw className="size-3.5" />
                  <span>Reset &amp; Send &ldquo;Hi&rdquo;</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSheet({ kind: 'FLOW', dealId: null })}
                  className="w-full min-h-[42px] rounded-xl bg-[#25D366] hover:bg-[#20BD5A] text-[#0B141A] text-xs font-bold flex items-center justify-center gap-2 transition"
                >
                  <Calendar className="size-3.5" />
                  <span>Open Booking Flow Directly</span>
                </button>
              </div>
            </div>
          </aside>

          {/* Right: Mobile WhatsApp Thread + Embedded Flow / Deal Overlay */}
          <div className="flex justify-center">
            <div className="w-full max-w-md h-[640px] rounded-3xl border-2 border-[#2A3942] bg-[#0B141A] flex flex-col overflow-hidden relative shadow-2xl">
              {/* Phone WhatsApp Top Bar — Pure Transparent Large Top-Left WorkCraft Logo */}
              <div
                dir="ltr"
                className="bg-[#202C33] border-b border-[#2A3942] px-3.5 py-2.5 flex items-center justify-between gap-2 shrink-0"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src={LOGO_URL}
                    alt="WorkCraft"
                    className="size-11 bg-transparent object-contain shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#E9EDEF] truncate">
                      {config?.salonName || 'Salon WhatsApp'}
                    </p>
                    <p className="text-[10px] font-mono text-[#25D366]">
                      {config?.currency || 'PKR'} · {activeLang.toUpperCase()} · {customerMode === 'SAVED' ? 'Returning' : 'New'}
                    </p>
                  </div>
                </div>
                <span className="rounded-md bg-[#111B21] border border-[#2A3942] px-2 py-0.5 text-[10px] font-mono text-[#FBBF24] shrink-0">
                  DEMO
                </span>
              </div>

              {/* Chat Thread with Subtle Transparent WorkCraft Watermark Behind Conversation */}
              <div className="relative flex-1 min-h-0 flex flex-col bg-[#0B141A] overflow-hidden">
                <div
                  aria-hidden="true"
                  className="pointer-events-none select-none absolute inset-0 flex flex-col items-center justify-center opacity-[0.07] z-0"
                >
                  <img
                    src={LOGO_URL}
                    alt=""
                    className="size-28 bg-transparent object-contain"
                  />
                  <img
                    src={WATERMARK_URL}
                    alt=""
                    className="w-44 h-auto bg-transparent object-contain mt-1.5"
                  />
                </div>

                <div className="relative z-10 flex-1 overflow-y-auto p-3 space-y-3">
                  {loading && messages.length === 0 ? (
                    <div className="text-center text-xs font-mono text-[#8696A0] py-8">
                      Loading WhatsApp preview...
                    </div>
                  ) : (
                    messages.map((m) => {
                      const labels = DEMO_UI_LABELS[m.lang] || DEMO_UI_LABELS.en!;
                      const shouldShowBookCta =
                        m.showBookCta ||
                        m.action === 'SERVICES_PRICES' ||
                        m.action === 'HOURS_LOCATION';
                      return (
                        <div
                          key={m.id}
                          className={`flex ${m.from === 'CUSTOMER' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            dir={m.dir}
                            className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-xs space-y-2.5 shadow ${
                              m.from === 'CUSTOMER'
                                ? 'bg-[#005C4B] text-[#E9EDEF] rounded-br-sm'
                                : 'bg-[#202C33]/95 text-[#E9EDEF] rounded-bl-sm border border-[#2A3942]'
                            }`}
                          >
                            <p className="whitespace-pre-line leading-relaxed">{m.text}</p>

                            {/* Single Welcome Message Language Selector + 4 Interactive Options */}
                            {m.welcome && (
                              <div className="space-y-2 pt-1 border-t border-[#2A3942]">
                                <div className="flex flex-wrap gap-1.5" dir="ltr">
                                  {m.welcome.availableLanguages.map((langOpt) => (
                                    <button
                                      key={langOpt.lang}
                                      type="button"
                                      onClick={() => void handleLanguageChange(langOpt.lang)}
                                      className={`min-h-[30px] rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition ${
                                        activeLang === langOpt.lang
                                          ? 'border-[#25D366] bg-[#0B2E1E] text-[#25D366]'
                                          : 'border-[#2A3942] bg-[#111B21] text-[#D1D7DB] hover:border-[#8696A0]'
                                      }`}
                                    >
                                      {langOpt.nativeLabel}
                                    </button>
                                  ))}
                                </div>

                                <div className="grid grid-cols-1 gap-1.5">
                                  {m.welcome.options.map((opt) => (
                                    <button
                                      key={opt.id}
                                      type="button"
                                      onClick={() => void triggerOption(opt.id, opt.label)}
                                      className="min-h-[40px] w-full rounded-xl border border-[#2A3942] bg-[#111B21] hover:border-[#25D366] hover:bg-[#0B2E1E]/50 px-3 text-xs font-semibold text-[#53BDEB] flex items-center justify-between gap-2 transition"
                                    >
                                      <span>{opt.label}</span>
                                      {opt.id === 'BOOK_APPOINTMENT' ? (
                                        <Calendar className="size-3.5 text-[#25D366] shrink-0" />
                                      ) : opt.id === 'SERVICES_PRICES' ? (
                                        <Scissors className="size-3.5 text-[#8696A0] shrink-0" />
                                      ) : opt.id === 'HOURS_LOCATION' ? (
                                        <Clock className="size-3.5 text-[#8696A0] shrink-0" />
                                      ) : (
                                        <Tag className="size-3.5 text-[#FBBF24] shrink-0" />
                                      )}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Google Maps Directions + Small Copy Button (Query 8) */}
                            {m.googleMapsUrl && (
                              <div className="flex items-center gap-1.5 pt-0.5">
                                <a
                                  href={m.googleMapsUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex-1 min-h-[38px] rounded-xl border border-[#2A3942] bg-[#111B21] hover:border-[#25D366] px-3 text-[11px] font-semibold text-[#53BDEB] flex items-center justify-center gap-1.5 transition"
                                >
                                  <MapPin className="size-3.5 text-[#25D366] shrink-0" />
                                  <span>{labels.mapsDirections}</span>
                                  <ExternalLink className="size-3 shrink-0" />
                                </a>
                                <button
                                  type="button"
                                  onClick={() => void handleCopyText(m.id, m.googleMapsUrl || '')}
                                  className="min-h-[38px] rounded-xl border border-[#2A3942] bg-[#111B21] hover:border-[#53BDEB] px-2.5 text-[11px] font-semibold text-[#D1D7DB] flex items-center gap-1 shrink-0 transition"
                                >
                                  {copiedBubbleId === m.id ? (
                                    <>
                                      <Check className="size-3.5 text-[#25D366]" />
                                      <span className="text-[#25D366]">{labels.copiedBtn}</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="size-3.5 text-[#8696A0]" />
                                      <span>{labels.copyBtn}</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            )}

                            {/* Active Deals: 100% Localized Text-First Card + Conditional Watch Video (Query 10) */}
                            {m.deals && m.deals.length > 0 && (
                              <div className="space-y-1.5 pt-1 border-t border-[#2A3942]">
                                {m.deals.map((deal) => {
                                  const hasVideo = Boolean(deal.videoUrl && !deal.videoDeletedAt);
                                  const localizedTitle =
                                    deal.titleTranslations?.[m.lang] || deal.title;
                                  const localizedDesc =
                                    deal.descriptionTranslations?.[m.lang] || deal.description;
                                  const localizedBadge = formatLocalizedDealBadge(
                                    deal,
                                    m.lang,
                                    config?.currencySymbol || 'PKR '
                                  );
                                  return (
                                    <div
                                      key={deal.id}
                                      className="rounded-xl border border-[#2A3942] bg-[#111B21] p-2.5 space-y-2"
                                    >
                                      <div className="flex items-start justify-between gap-2">
                                        <span className="font-bold text-[#E9EDEF] leading-snug">
                                          {localizedTitle}
                                        </span>
                                        <span
                                          dir="ltr"
                                          className="rounded-md bg-[#0B2E1E] border border-[#14532D] px-1.5 py-0.5 text-[10px] font-mono font-bold text-[#25D366] shrink-0"
                                        >
                                          {localizedBadge}
                                        </span>
                                      </div>
                                      {localizedDesc && (
                                        <p className="text-[11px] text-[#8696A0] leading-snug">
                                          {localizedDesc}
                                        </p>
                                      )}
                                      <div className="flex gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setActiveSheet({ kind: 'FLOW', dealId: deal.id })
                                          }
                                          className="flex-1 min-h-[36px] rounded-lg bg-[#25D366] hover:bg-[#20BD5A] text-[#0B141A] px-2.5 text-[11px] font-bold flex items-center justify-center gap-1 transition"
                                        >
                                          <Calendar className="size-3.5" />
                                          <span>{labels.bookDeal}</span>
                                        </button>
                                        {hasVideo && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setActiveSheet({ kind: 'DEAL', dealId: deal.id })
                                            }
                                            className="min-h-[36px] rounded-lg border border-[#2A3942] bg-[#202C33] hover:border-[#53BDEB] px-2.5 text-[11px] font-semibold text-[#53BDEB] flex items-center justify-center gap-1.5 transition"
                                          >
                                            <Film className="size-3.5" />
                                            <span>{labels.watchVideo}</span>
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Book Appointment CTA inside Services & Hours Replies (Query 9) */}
                            {shouldShowBookCta && (
                              <button
                                type="button"
                                onClick={() => setActiveSheet({ kind: 'FLOW', dealId: null })}
                                className="w-full min-h-[38px] rounded-xl bg-[#25D366] hover:bg-[#20BD5A] text-[#0B141A] px-3 text-xs font-bold flex items-center justify-center gap-1.5 transition"
                              >
                                <Calendar className="size-3.5" />
                                <span>{m.bookCtaLabel || labels.bookAppointment}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Composer Bar (Text-only per Query 11) */}
              <form
                onSubmit={handleSendText}
                className="bg-[#202C33] border-t border-[#2A3942] p-2.5 flex items-center gap-2 shrink-0"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder='Type "Hi", "Services", "Hours", or "Deals"...'
                  className="flex-1 min-h-[42px] rounded-full border border-[#2A3942] bg-[#111B21] px-4 text-xs text-[#E9EDEF] placeholder:text-[#8696A0] focus:outline-none focus:border-[#25D366]"
                />
                <button
                  type="submit"
                  aria-label="Send message"
                  className="size-10 rounded-full bg-[#25D366] hover:bg-[#20BD5A] text-[#0B141A] grid place-items-center shrink-0"
                >
                  <Send className="size-4" />
                </button>
              </form>

              {/* Embedded Continuous Flow or Deal Video Sheet Overlay inside Phone */}
              {activeSheet?.kind === 'FLOW' && (
                <div className="absolute inset-0 z-30 bg-[#0B141A]">
                  <CustomerBookingFlow
                    salonId={activeSalonId}
                    salonCode={activeSalonId}
                    initialDealId={activeSheet.dealId}
                    initialLang={activeLang}
                    initialClientPhone={currentIdentity.fromPhone}
                    isDemo={true}
                    demoForceNewCustomer={customerMode === 'NEW'}
                    demoSavedCustomerName={currentIdentity.clientName || 'Bilal Ahmed'}
                    demoBusyBarber={simulateBusyBarber || undefined}
                    onClose={() => setActiveSheet(null)}
                  />
                </div>
              )}

              {activeSheet?.kind === 'DEAL' && (
                <div className="absolute inset-0 z-30 bg-[#0B141A] overflow-y-auto">
                  <PublicSalonDealPage
                    salonId={activeSalonId}
                    salonCode={activeSalonId}
                    dealId={activeSheet.dealId}
                    initialLang={activeLang}
                    isDemo={true}
                    onBookDealInDemo={(dealId) => setActiveSheet({ kind: 'FLOW', dealId })}
                    onClose={() => setActiveSheet(null)}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

