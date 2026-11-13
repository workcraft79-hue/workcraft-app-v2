import React, { useState, useEffect } from 'react';
import {
  House,
  QrCode,
  UsersRound,
  GitFork,
  WalletCards,
  Settings2,
  Mic,
  ShieldCheck,
  Bell,
  Pause,
  Play,
  ArrowRight,
  Menu,
  X,
  Smartphone,
  Scissors,
  Lock,
  Globe,
  ChevronDown,
  Megaphone,
} from 'lucide-react';

import { TabName } from './types/workcraft';
import { WATERMARK_URL } from './data/portalData';
import { BrandMark } from './components/BrandMark';
import { OverviewSection } from './components/OverviewSection';
import { VoiceSection } from './components/VoiceSection';
import { VoiceSupportDrawer } from './components/VoiceSupportDrawer';
import { TabsSection } from './components/TabsSection';
import { DetailSheet } from './components/DetailSheet';
import { FieldAgentHub, OnboardedSalonPayload } from './components/FieldAgentHub';
import { SalonOwnerDashboard } from './components/SalonOwnerDashboard';
import { SilentSelfHealingBoundary } from './components/SilentSelfHealingBoundary';
import {
  FinancialReportModal,
  PaymentRoutingModal,
  NotificationsDrawer,
} from './components/Modals';

export default function App() {
  const [activeSalonCount, setActiveSalonCount] = useState(24);
  const [kamranCashHeld, setKamranCashHeld] = useState(25000);
  const [isSalonPwaModalOpen, setIsSalonPwaModalOpen] = useState(false);
  const [activeOnboarding, setActiveOnboarding] = useState<{ token: string; salonName: string } | null>({
    token: 'wc_sec_rfade_9821',
    salonName: 'Royal Fade Lounge',
  });
  const [toastNotification, setToastNotification] = useState<string | null>(null);
  const [inspectSalonName, setInspectSalonName] = useState<string | undefined>(undefined);
  const [hasCompletedSalonOnboarding, setHasCompletedSalonOnboarding] = useState(true);
  const [onboardedSalonName, setOnboardedSalonName] = useState<string | undefined>(undefined);
  const [completedOnboardingData, setCompletedOnboardingData] = useState<OnboardedSalonPayload | null>(null);

  // Founder Command Center Workspace Navigation
  const [activeTab, setActiveTab] = useState<TabName>('Overview');

  // Query 1: Detect WhatsApp direct remote agent enrollment link (/enroll or ?id=...&pin=...)
  const [initialEnrollAgentData, setInitialEnrollAgentData] = useState<{
    id?: string;
    pin?: string;
    name?: string;
    phone?: string;
    city?: string;
  } | null>(null);

  // Pure 3-Role Isolation Architecture:
  // - FOUNDER: Central Command, Fleet Dossier, Salons Health, 3-Way Ledger, Founder Marketing
  // - FIELD_AGENT: Strictly Field Agent Hub / Enrollment / Commission Ledger / Node Repair
  // - SALON_OWNER: Social Ad Links land in Onboarding First -> Then Private Salon Owner Dashboard Only
  const [activeRole, setActiveRole] = useState<'FOUNDER' | 'FIELD_AGENT' | 'SALON_OWNER'>('FOUNDER');
  const [socialCampaignSource, setSocialCampaignSource] = useState<string | null>(null);

  useEffect(() => {
    try {
      const search = window.location.search;
      const path = window.location.pathname;
      const hash = window.location.hash;
      const params = new URLSearchParams(search);

      // Social Media Campaign / Direct Signup Link Detection (Queries 1 & 2):
      // Detect Facebook, Instagram, TikTok, or custom campaign sources
      const ref = params.get('ref');
      const utmSource = params.get('utm_source');
      const isSocialCampaign =
        ref === 'fb' || ref === 'facebook' ||
        ref === 'ig' || ref === 'instagram' ||
        ref === 'tiktok' || ref === 'tt' ||
        ref === 'social' ||
        utmSource === 'facebook' || utmSource === 'instagram' || utmSource === 'tiktok';

      const isSalonDirectRoute =
        path.includes('/onboard') ||
        path.includes('/salon') ||
        hash.includes('onboard') ||
        params.has('onboard') ||
        params.has('salon_signup') ||
        params.get('role') === 'salon_owner' ||
        isSocialCampaign;

      if (isSalonDirectRoute) {
        const isAlreadyPaired = params.get('paired') === 'true';
        const customName = params.get('salon') || params.get('salon_name') || undefined;
        if (customName) setOnboardedSalonName(customName);

        if (isSocialCampaign) {
          const sourceLabel =
            ref === 'fb' || utmSource === 'facebook' ? 'Facebook Ads Campaign'
            : ref === 'ig' || utmSource === 'instagram' ? 'Instagram Reels Campaign'
            : ref === 'tiktok' || utmSource === 'tiktok' ? 'TikTok Viral Campaign'
            : ref ? `${ref.toUpperCase()} Social Campaign`
            : 'Social Ad Campaign';
          setSocialCampaignSource(sourceLabel);
        }

        setHasCompletedSalonOnboarding(isAlreadyPaired);
        setActiveRole('SALON_OWNER');
        setActiveTab('Salon Owner Dashboard');
        return;
      }

      // Agent Remote Enrollment Link Detection (/enroll, ?id=...&pin=...)
      const isEnrollRoute =
        path.includes('/enroll') ||
        hash.includes('enroll') ||
        params.has('enroll') ||
        params.get('role') === 'agent' ||
        (params.has('id') && (params.has('pin') || params.has('auth')));

      if (isEnrollRoute) {
        const id = params.get('id') || undefined;
        const pin = params.get('pin') || params.get('auth') || undefined;
        const phone = params.get('phone') || undefined;
        const name = params.get('name') || undefined;
        const city = params.get('city') || undefined;

        setInitialEnrollAgentData({ id, pin, phone, name, city });
        setActiveRole('FIELD_AGENT');
        setActiveTab('Agent Hub / Onboarding');
      }
    } catch {
      // Ignore URL parsing errors
    }
  }, []);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isVoiceDrawerOpen, setIsVoiceDrawerOpen] = useState(false);
  const [paymentRoutingMethod, setPaymentRoutingMethod] = useState<string | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isGlobalPaused, setIsGlobalPaused] = useState(false);
  const [pausedCountries, setPausedCountries] = useState<Record<string, boolean>>({
    PK: false,
    AE: false,
    SA: false,
    GB: false,
  });
  const [dynamicAgentCountries, setDynamicAgentCountries] = useState<
    Array<{ code: string; label: string; flag: string }>
  >([]);
  const [isCountryPauseOpen, setIsCountryPauseOpen] = useState(false);
  const [whatsAppHealth, setWhatsAppHealth] = useState<'HEALTHY' | 'ISSUE'>('HEALTHY');
  const [isPairingModalOpen, setIsPairingModalOpen] = useState(false);
  const [isPaymentPaid, setIsPaymentPaid] = useState(false);
  const [detailSheet, setDetailSheet] = useState<string | null>(null);

  const [founderPreviewMode, setFounderPreviewMode] = useState<'NONE' | 'AGENT' | 'SALON_ONBOARD' | 'SALON_LIVE'>('NONE');

  const handleLaunchFounderPreview = (mode: 'AGENT' | 'SALON_ONBOARD' | 'SALON_LIVE') => {
    setFounderPreviewMode(mode);
    setIsSidebarOpen(false);
    if (mode === 'AGENT') {
      setActiveRole('FIELD_AGENT');
      setActiveTab('Agent Hub / Onboarding');
      showToast('🔍 Previewing exact isolated Field Agent screen. Tap Return to Founder anytime.');
    } else if (mode === 'SALON_ONBOARD') {
      setCompletedOnboardingData(null);
      setOnboardedSalonName(undefined);
      setHasCompletedSalonOnboarding(false);
      setActiveRole('SALON_OWNER');
      setActiveTab('Salon Owner Dashboard');
      showToast('🔍 Previewing exact 4-step Salon Self-Onboarding terminal. Tap Return to Founder anytime.');
    } else {
      setHasCompletedSalonOnboarding(true);
      setActiveRole('SALON_OWNER');
      setActiveTab('Salon Owner Dashboard');
      showToast('🔍 Previewing exact Live Salon Owner Dashboard.');
    }
  };

  const handleExitFounderPreview = () => {
    setFounderPreviewMode('NONE');
    setActiveRole('FOUNDER');
    setActiveTab('Settings');
    setHasCompletedSalonOnboarding(true);
    setIsSidebarOpen(false);
    showToast('✅ Returned to Founder Command Center.');
  };

  // Query 1: Unified simple "WorkCraft" mobile home-screen shortcut name across all roles
  useEffect(() => {
    const shortcutLabel = 'WorkCraft';
    document.title = 'WorkCraft - Mobile Portal';

    const appleTitleMeta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (appleTitleMeta) {
      appleTitleMeta.setAttribute('content', shortcutLabel);
    }

    let createdObjectUrl: string | null = null;
    const manifestLink = document.querySelector('link[rel="manifest"]');
    if (manifestLink) {
      if (activeRole === 'FOUNDER') {
        manifestLink.setAttribute('href', '/manifest.json');
      } else {
        const origin = window.location.origin;
        const dynamicManifest = {
          id: activeRole === 'FIELD_AGENT' ? '/?role=agent' : '/?role=salon_owner&paired=true',
          name: 'WorkCraft',
          short_name: 'WorkCraft',
          start_url: activeRole === 'FIELD_AGENT' ? '/?role=agent' : '/?role=salon_owner&paired=true',
          scope: '/',
          display: 'standalone',
          background_color: '#0D1117',
          theme_color: '#0D1117',
          icons: [
            { src: `${origin}/pwa-192x192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: `${origin}/pwa-512x512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: `${origin}/icon.svg`, sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          ],
        };
        createdObjectUrl = URL.createObjectURL(
          new Blob([JSON.stringify(dynamicManifest)], { type: 'application/manifest+json' })
        );
        manifestLink.setAttribute('href', createdObjectUrl);
      }
    }

    return () => {
      if (createdObjectUrl) URL.revokeObjectURL(createdObjectUrl);
    };
  }, [activeRole]);

  const BASE_COUNTRY_PAUSE_LIST: { code: string; label: string; flag: string }[] = [
    { code: 'PK', label: 'Pakistan', flag: '🇵🇰' },
    { code: 'AE', label: 'UAE', flag: '🇦🇪' },
    { code: 'SA', label: 'Saudi Arabia', flag: '🇸🇦' },
    { code: 'GB', label: 'United Kingdom', flag: '🇬🇧' },
  ];

  const COUNTRY_PAUSE_LIST = React.useMemo(() => {
    const map = new Map<string, { code: string; label: string; flag: string }>();
    BASE_COUNTRY_PAUSE_LIST.forEach((c) => map.set(c.code, c));
    dynamicAgentCountries.forEach((c) => {
      if (!map.has(c.code)) {
        map.set(c.code, c);
      }
    });
    return Array.from(map.values());
  }, [dynamicAgentCountries]);

  const activePausedCountryList = COUNTRY_PAUSE_LIST.filter((c) => !!pausedCountries[c.code]);

  const toggleCountryPause = (code: string) => {
    setPausedCountries((prev) => {
      const nextVal = !prev[code];
      const countryName = COUNTRY_PAUSE_LIST.find((c) => c.code === code)?.label || code;
      showToast(
        nextVal
          ? `⏸️ ${countryName} broadcasts paused. All other countries continue running normally.`
          : `▶️ ${countryName} broadcasts resumed cleanly.`
      );
      return { ...prev, [code]: nextVal };
    });
  };

  const showToast = (msg: string) => {
    setToastNotification(msg);
    setTimeout(() => setToastNotification(null), 5000);
  };

  const handleSalonCreated = (salon: { name: string; owner: string; phone: string; location: string; coords: string }) => {
    const token = `wc_sec_${salon.name.toLowerCase().replace(/\s+/g, '')}_${Math.floor(1000 + Math.random() * 9000)}`;
    setActiveOnboarding({ token, salonName: salon.name });
    showToast(`📩 Automated WhatsApp invite dispatched to ${salon.owner} (${salon.name})`);
  };

  const handleCashCollected = (amount: number, salonName: string) => {
    setKamranCashHeld((prev) => prev + amount);
    showToast(`💵 PKR ${amount.toLocaleString()} Cash Held Logged with Biometric Seal · Receipts sent to agent & ${salonName}`);
  };

  const handlePairingComplete = (salonName: string, payload?: OnboardedSalonPayload) => {
    setActiveSalonCount((prev) => prev + 1);
    setIsSalonPwaModalOpen(false);
    setOnboardedSalonName(salonName);
    if (payload) {
      setCompletedOnboardingData(payload);
    }
    setHasCompletedSalonOnboarding(true);
    setActiveRole('SALON_OWNER');
    setActiveTab('Salon Owner Dashboard');
    showToast(`🎉 ${salonName} Paired Successfully! Welcome to your Live Salon Owner Dashboard.`);
  };

  const handleInspectSalon = (salonName: string) => {
    setInspectSalonName(salonName);
    setActiveTab('Salon Owner Dashboard');
    setIsSidebarOpen(false);
  };

  const handleTabChange = (tab: TabName) => {
    setActiveTab(tab);
    setIsSidebarOpen(false);
  };

  const handleTestSocialLaunch = (source: 'Facebook' | 'Instagram' | 'TikTok') => {
    setSocialCampaignSource(`${source} Ads Campaign`);
    setCompletedOnboardingData(null);
    setOnboardedSalonName(undefined);
    setHasCompletedSalonOnboarding(false);
    setActiveRole('SALON_OWNER');
    setActiveTab('Salon Owner Dashboard');
    showToast(`📱 Simulated direct mobile arrival from ${source} Ad Campaign. Direct 4-step onboarding active!`);
  };

  // Strict 3-Role Sidebar & Bottom Navigation Isolation (Query 1)
  const navItems: [TabName, React.FC<{ className?: string }>][] =
    activeRole === 'SALON_OWNER'
      ? [['Salon Owner Dashboard', Scissors]]
      : activeRole === 'FIELD_AGENT'
      ? [['Agent Hub / Onboarding', Smartphone]]
      : [
          ['Overview', House],
          ['Agent Hub / Onboarding', Smartphone],
          ['Salon Owner Dashboard', Scissors],
          ['Marketing', Megaphone],
          ['Contact / Clients', UsersRound],
          ['Revenue', WalletCards],
          ['Voice', Mic],
          ['Settings', Settings2],
        ];

  const mobileNavItems: [TabName, React.FC<{ className?: string }>, string][] =
    activeRole === 'SALON_OWNER'
      ? [['Salon Owner Dashboard', Scissors, 'My Salon']]
      : activeRole === 'FIELD_AGENT'
      ? [['Agent Hub / Onboarding', Smartphone, 'Agent Hub']]
      : [
          ['Overview', House, 'Overview'],
          ['Agent Hub / Onboarding', Smartphone, 'Agent Hub'],
          ['Salon Owner Dashboard', Scissors, 'Salon Node'],
          ['Marketing', Megaphone, 'Marketing'],
          ['Revenue', WalletCards, 'Revenue'],
        ];

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#0D1117] text-[#F0F6FC] font-sans selection:bg-[#06B6D4] selection:text-[#0D1117]">
      {/* Real-Time Interconnection Toast Banner */}
      {toastNotification && (
        <div className="fixed top-4 right-3 sm:right-6 z-[90] max-w-md rounded-2xl border border-[#30363D] bg-[#21262D]/95 p-3.5 backdrop-blur-md animate-in slide-in-from-top-3 text-xs font-mono text-cyan-400 flex items-center justify-between gap-3">
          <span className="break-words [overflow-wrap:break-word]">{toastNotification}</span>
          <button
            onClick={() => setToastNotification(null)}
            className="min-h-[44px] min-w-[44px] grid place-items-center text-[#8B949E] hover:text-[#F0F6FC] shrink-0"
            aria-label="Dismiss notification"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      <div className="flex min-h-screen">
        {/* Sidebar (Desktop Persistent & Mobile Slide-Over Drawer) */}
        <aside
          className={`${
            isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r border-[#30363D] bg-[#161B22] px-5 py-5 transition-transform duration-200 lg:static lg:translate-x-0`}
        >
          {/* Top Logo */}
          <div className="relative flex min-h-[76px] items-center justify-center">
            <BrandMark />
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="absolute right-0 top-1 min-h-[44px] min-w-[44px] grid place-items-center rounded-xl text-[#8B949E] hover:text-[#F0F6FC] hover:bg-[#21262D] lg:hidden transition"
              aria-label="Close menu"
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="mt-6 text-[10px] font-mono font-bold uppercase tracking-[.25em] text-[#6E7681]">
            WORKSPACE
          </div>

          {/* Main Nav Items */}
          <nav className="mt-3 flex flex-col gap-1.5" aria-label="Main navigation">
            {navItems.map(([name, Icon]) => {
              const isActive = activeTab === name;
              return (
                <button
                  key={name}
                  onClick={() => handleTabChange(name)}
                  className={`flex min-h-[48px] items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-[12px] font-mono transition ${
                    isActive
                      ? 'bg-[#21262D] text-[#F0F6FC] border border-[#06B6D4]/50 font-bold'
                      : 'text-[#8B949E] hover:bg-[#21262D]/60 hover:text-[#F0F6FC] border border-transparent'
                  }`}
                >
                  <Icon className={`size-[17px] shrink-0 ${isActive ? 'text-[#06B6D4]' : 'text-[#D29922]'}`} />
                  <span>{name}</span>
                  {name === 'Voice' && (
                    <span className="ml-auto rounded-full bg-[#06B6D4]/15 border border-[#06B6D4]/40 px-2 py-0.5 text-[9px] font-bold text-cyan-400">
                      2 unread
                    </span>
                  )}
                  {name === 'Revenue' && (
                    <span className="ml-auto size-2 rounded-full bg-[#D29922]" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Plain-English System Line Status (Query 5: Green Healthy vs Red Issue) */}
          <div
            className={`mt-4 rounded-xl border p-3 text-[10px] font-mono space-y-1 transition ${
              whatsAppHealth === 'ISSUE'
                ? 'border-[#da3633] bg-[#4C1C1D]'
                : 'border-[#116329] bg-[#0D3822]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[#F0F6FC]/80">WHATSAPP LINE</span>
              <span
                className={`inline-flex items-center gap-1.5 font-bold ${
                  whatsAppHealth === 'ISSUE' ? 'text-[#F85149]' : 'text-[#3FB950]'
                }`}
              >
                <span
                  className={`size-2 rounded-full ${
                    whatsAppHealth === 'ISSUE'
                      ? 'bg-[#F85149] animate-ping'
                      : 'bg-[#3FB950]'
                  }`}
                />
                {whatsAppHealth === 'ISSUE' ? 'ISSUE' : 'HEALTHY'}
              </span>
            </div>
            <p className="text-[#F0F6FC] font-bold truncate">
              {whatsAppHealth === 'ISSUE' ? 'Disconnected / Blocked' : 'Connected & Healthy'}
            </p>
            <p className="text-[#8B949E] flex items-center gap-1">
              <Lock className="size-3 text-[#D29922]" />
              Founder Number Hidden
            </p>
          </div>

          {/* SIDEBAR FOOTER TYPOGRAPHY LOCK */}
          <div className="mt-auto border-t border-[#21262D] p-4 pt-5 pb-2 bg-[#161B22]">
            {/* 1. Top: WORKCRAFT Watermark graphic */}
            <div className="mb-3 flex justify-center">
              <img
                src={WATERMARK_URL}
                alt="WORKCRAFT"
                className="h-auto w-[150px] object-contain opacity-90"
              />
            </div>
            {/* 2. Middle: Role in Cyber Cyan (#06B6D4) */}
            {/* 3. Bottom: Name in #F0F6FC */}
            <div className="text-center">
              <p className="text-xs font-mono font-black tracking-[0.3em] text-[#06B6D4] uppercase">
                {activeRole === 'FOUNDER'
                  ? 'FOUNDER'
                  : activeRole === 'FIELD_AGENT'
                  ? 'FIELD AGENT'
                  : 'SALON PARTNER'}
              </p>
              <p className="mt-1 text-sm font-bold text-[#F0F6FC] tracking-wide">
                {activeRole === 'FOUNDER'
                  ? 'Farhan Abid'
                  : activeRole === 'FIELD_AGENT'
                  ? initialEnrollAgentData?.name || 'Authorized Agent'
                  : onboardedSalonName || 'Private Salon Portal'}
              </p>
            </div>
          </div>
        </aside>

        {/* Mobile Backdrop Overlay */}
        {isSidebarOpen && (
          <button
            className="fixed inset-0 z-40 bg-[#0D1117]/80 backdrop-blur-xs lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
            aria-label="Close menu overlay"
          />
        )}

        {/* Main Application Body */}
        <section className="min-w-0 flex-1 flex flex-col pb-32 lg:pb-10">
          {/* Top Bar Header with WORKCRAFT Watermark + DASHBOARD */}
          <header className="sticky top-0 z-30 grid h-[72px] grid-cols-[auto_1fr_auto] items-center border-b border-[#30363D] bg-[#0D1117]/95 backdrop-blur-md px-4 sm:px-7 gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="min-h-[48px] min-w-[48px] grid place-items-center rounded-xl text-[#8B949E] hover:text-[#F0F6FC] hover:bg-[#161B22] lg:hidden transition"
                aria-label="Open menu"
              >
                <Menu className="size-5" />
              </button>
            </div>

            {/* Central Top Bar: Watermark + DASHBOARD */}
            <div className="flex flex-col items-center justify-center leading-none">
              <img
                src={WATERMARK_URL}
                alt="WORKCRAFT"
                className="h-auto w-[142px] object-contain opacity-95"
              />
              <span className="mt-1 text-[10px] font-mono font-black tracking-[0.3em] text-[#06B6D4] uppercase">
                {activeRole === 'FIELD_AGENT'
                  ? 'AGENT PORTAL'
                  : activeRole === 'SALON_OWNER'
                  ? hasCompletedSalonOnboarding
                    ? 'SALON PORTAL'
                    : 'SALON SIGNUP'
                  : 'DASHBOARD'}
              </span>
            </div>

            {/* Right Controls (Founder-only Bell, Global Pause & Country-by-Country Breakup; hidden from Agents & Salons) */}
            <div className="flex items-center justify-end gap-2 min-w-[36px] relative">
              {activeRole === 'FOUNDER' ? (
                <>
                  <button
                    onClick={() => setIsNotificationsOpen(true)}
                    className="relative min-h-[44px] min-w-[44px] grid place-items-center rounded-xl border border-[#30363D] bg-[#161B22] text-[#8B949E] hover:border-[#484F58] hover:text-[#F0F6FC] transition"
                    aria-label="Open notifications"
                  >
                    <Bell className="size-[17px]" />
                    <span className="absolute right-2.5 top-2.5 size-1.5 rounded-full bg-[#06B6D4] animate-ping" />
                  </button>

                  {/* Query 2: Global Pause + Country-by-Country Breakup Dropdown directly underneath */}
                  <div className="relative">
                    <div className="flex items-center">
                      <button
                        type="button"
                        onClick={() => setIsGlobalPaused(!isGlobalPaused)}
                        className={`flex min-h-[44px] items-center gap-1.5 rounded-l-xl border px-2.5 sm:px-3 py-2 text-[10px] font-mono font-bold transition ${
                          isGlobalPaused
                            ? 'border-[#9E6A03] bg-[#3B2E0B] text-[#D29922] animate-pulse'
                            : 'border-[#30363D] bg-[#161B22] text-[#F0F6FC] hover:border-[#484F58]'
                        }`}
                        aria-pressed={isGlobalPaused}
                      >
                        {isGlobalPaused ? (
                          <Play className="size-3 text-[#D29922]" />
                        ) : (
                          <Pause className="size-3 text-[#D29922]" />
                        )}
                        <span className="hidden sm:inline">
                          {isGlobalPaused ? 'Resume queue' : 'Global pause'}
                        </span>
                        <span className="sm:hidden">{isGlobalPaused ? 'Resume' : 'Pause'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsCountryPauseOpen(!isCountryPauseOpen)}
                        className={`flex min-h-[44px] items-center gap-1 rounded-r-xl border border-l-0 px-2.5 py-2 text-[10px] font-mono font-bold transition ${
                          activePausedCountryList.length > 0
                            ? 'border-[#9E6A03] bg-[#3B2E0B] text-[#D29922]'
                            : 'border-[#30363D] bg-[#161B22] text-[#8B949E] hover:border-[#484F58] hover:text-[#F0F6FC]'
                        }`}
                        aria-expanded={isCountryPauseOpen}
                        title="Pause by Country Breakup"
                      >
                        <Globe className="size-3 text-[#06B6D4]" />
                        {activePausedCountryList.length > 0 && (
                          <span className="rounded bg-[#D29922] text-[#0D1117] px-1 text-[9px] font-black">
                            {activePausedCountryList.length}
                          </span>
                        )}
                        <ChevronDown className="size-3" />
                      </button>
                    </div>

                    {isCountryPauseOpen && (
                      <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-[#30363D] bg-[#21262D] p-3 shadow-xl z-50 space-y-2 backdrop-blur-md">
                        <div className="flex items-center justify-between border-b border-[#30363D] pb-2">
                          <span className="text-[10px] font-mono font-bold uppercase text-cyan-400">
                            Country-by-Country Pause
                          </span>
                          <button
                            type="button"
                            onClick={() => setIsCountryPauseOpen(false)}
                            className="p-1 text-[#8B949E] hover:text-[#F0F6FC]"
                          >
                            <X className="size-3.5" />
                          </button>
                        </div>
                        <p className="text-[10px] text-[#8B949E] font-sans leading-snug">
                          Pause a single market (e.g., UAE only) while all other countries keep running normally.
                        </p>
                        <div className="space-y-1.5 font-mono text-xs">
                          {COUNTRY_PAUSE_LIST.map((country) => {
                            const isCountryPaused = pausedCountries[country.code];
                            return (
                              <button
                                key={country.code}
                                type="button"
                                onClick={() => toggleCountryPause(country.code)}
                                className={`w-full min-h-[44px] flex items-center justify-between rounded-xl border px-3 py-2 text-left transition ${
                                  isCountryPaused
                                    ? 'border-[#9E6A03] bg-[#3B2E0B] text-[#D29922]'
                                    : 'border-[#30363D] bg-[#0D1117] text-[#F0F6FC] hover:border-[#484F58]'
                                }`}
                              >
                                <span className="flex items-center gap-2 font-bold text-[11px]">
                                  <span>{country.flag}</span>
                                  <span>{country.label}</span>
                                </span>
                                <span
                                  className={`rounded px-2 py-0.5 text-[9px] font-black uppercase ${
                                    isCountryPaused
                                      ? 'bg-[#D29922] text-[#0D1117]'
                                      : 'bg-[#0D3822] text-[#3FB950] border border-[#116329]'
                                  }`}
                                >
                                  {isCountryPaused ? 'PAUSED' : 'LIVE'}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-lg border border-[#116329] bg-[#0D3822] px-2.5 py-1.5 text-[10px] font-mono font-bold text-[#3FB950]">
                  <ShieldCheck className="size-3.5" />
                  <span className="hidden sm:inline">Private Session</span>
                </span>
              )}
            </div>
          </header>

          {/* Founder-Only Role Inspection Bar (Only visible when Founder launches an isolated test view) */}
          {founderPreviewMode !== 'NONE' && (
            <div className="bg-[#3B2E0B] border-b border-[#9E6A03] text-[#F0F6FC] px-4 py-2.5 text-xs font-mono font-bold flex flex-wrap items-center justify-between gap-2">
              <span className="text-[#D29922]">
                🔍 FOUNDER PREVIEW MODE: Inspecting exact isolated{' '}
                {founderPreviewMode === 'AGENT'
                  ? 'Field Agent Screen'
                  : founderPreviewMode === 'SALON_ONBOARD'
                  ? 'New Salon Onboarding'
                  : 'Paired Salon Owner Dashboard'}
              </span>
              <button
                type="button"
                onClick={handleExitFounderPreview}
                className="min-h-[44px] rounded-xl bg-[#06B6D4] hover:bg-[#22D3EE] text-[#0D1117] px-3.5 py-1.5 text-[11px] font-bold transition"
              >
                ← Return to Founder View
              </button>
            </div>
          )}

          {/* Body Content Container */}
          <div className="mx-auto max-w-[1440px] w-full p-4 sm:p-7 pb-28 lg:pb-10 flex-1 overflow-x-hidden">
            {/* View Mode Header & Status Bar */}
            <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                {/* QUERY 5: GREEN HEALTHY vs RED ISSUE WHATSAPP HEALTH BOX + QUERY 2 COUNTRY PAUSE PILLS */}
                <div className="flex flex-wrap items-center gap-2 mb-2 font-mono">
                  <div
                    className={`inline-flex items-center gap-2.5 rounded-xl border px-3.5 py-2 text-xs font-mono font-bold transition ${
                      whatsAppHealth === 'ISSUE'
                        ? 'border-[#da3633] bg-[#4C1C1D] text-[#F85149]'
                        : 'border-[#116329] bg-[#0D3822] text-[#3FB950]'
                    }`}
                  >
                    <span className="relative flex size-2.5 shrink-0">
                      <span
                        className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${
                          whatsAppHealth === 'ISSUE' ? 'bg-[#F85149]' : 'bg-[#3FB950]'
                        }`}
                      />
                      <span
                        className={`relative inline-flex rounded-full size-2.5 ${
                          whatsAppHealth === 'ISSUE'
                            ? 'bg-[#F85149]'
                            : 'bg-[#3FB950]'
                        }`}
                      />
                    </span>
                    <span>
                      {whatsAppHealth === 'ISSUE'
                        ? 'WhatsApp Line Issue: Disconnected / Blocked'
                        : 'WhatsApp Line: Connected & Healthy'}
                    </span>
                  </div>

                  {activeRole === 'FOUNDER' && (
                    <button
                      type="button"
                      onClick={() =>
                        setWhatsAppHealth((prev) => (prev === 'HEALTHY' ? 'ISSUE' : 'HEALTHY'))
                      }
                      className="min-h-[40px] rounded-xl border border-[#30363D] bg-[#161B22] hover:bg-[#21262D] px-3 py-1.5 text-[10px] text-[#8B949E] hover:text-[#F0F6FC] transition"
                      title="Preview Green Healthy vs Red Issue alert state"
                    >
                      {whatsAppHealth === 'HEALTHY' ? 'Test Red Issue' : 'Restore Green Healthy'}
                    </button>
                  )}

                  {isGlobalPaused && (
                    <div className="inline-flex items-center gap-1.5 rounded-xl border border-[#9E6A03] bg-[#3B2E0B] px-3 py-1.5 text-[11px] font-bold text-[#D29922]">
                      <Pause className="size-3" />
                      <span>All Countries Paused</span>
                    </div>
                  )}

                  {!isGlobalPaused && activePausedCountryList.length > 0 && (
                    <div className="inline-flex items-center gap-1.5 rounded-xl border border-[#9E6A03] bg-[#3B2E0B] px-3 py-1.5 text-[11px] font-bold text-[#D29922] max-w-full overflow-hidden">
                      <span className="break-words [overflow-wrap:break-word]">
                        Paused: {activePausedCountryList.map((c) => `${c.flag} ${c.label}`).join(', ')} (Others Active)
                      </span>
                    </div>
                  )}
                </div>

                <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl text-[#F0F6FC]">
                  {activeTab === 'Agent Hub / Onboarding'
                    ? 'Field Agent Command Hub'
                    : activeTab === 'Salon Owner Dashboard'
                    ? activeRole === 'FOUNDER'
                      ? 'Salon Health & Package View'
                      : 'Salon Owner Dashboard'
                    : activeTab === 'Marketing'
                    ? 'Founder Marketing & Social Campaigns'
                    : activeTab === 'Overview'
                    ? 'Founder Daily Overview'
                    : activeTab}
                </h2>
                <p className="mt-1 text-sm text-[#8B949E] font-sans">
                  {activeTab === 'Agent Hub / Onboarding'
                    ? 'Manage field agents by country, track agent commissions, and repair salon connections.'
                    : activeTab === 'Salon Owner Dashboard'
                    ? activeRole === 'FOUNDER'
                      ? 'Read-only view of each salon package, 5th-of-month payment status, and onboarding language.'
                      : 'Live queue, hands-free voice alerts, rate editor, upgrades, video deals, and window poster PDF.'
                    : activeTab === 'Marketing'
                    ? '1-Tap auto-tagged social campaign links for Facebook, Instagram, and TikTok that bypass founder screens on mobile.'
                    : activeTab === 'Voice'
                    ? 'Listen to salon owner voice messages and reply automatically in their language.'
                    : activeTab === 'Settings'
                    ? 'All system protections run automatically and report directly to your Founder WhatsApp number.'
                    : 'Your daily business snapshot: online salons, pending dues, agent cash, and unread voice messages.'}
                </p>
              </div>

              {activeTab === 'Overview' && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsReportModalOpen(true)}
                    className="min-h-[48px] items-center gap-2 rounded-xl bg-[#06B6D4] px-5 py-2.5 text-xs font-mono font-bold text-[#0D1117] uppercase flex hover:bg-[#22D3EE] transition active:scale-95"
                  >
                    <span>View reports</span>
                    <ArrowRight className="size-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Dynamic Unified Content Wrapped in Silent Auto-Recovery Error Boundaries */}
            {activeTab === 'Agent Hub / Onboarding' ? (
              <SilentSelfHealingBoundary
                areaName="Field Agent Hub"
                onSilentRecovered={(d) => showToast(`🛡️ Auto-recovered ${d.areaName} seamlessly`)}
              >
                <FieldAgentHub
                  onSalonCreated={handleSalonCreated}
                  onCashCollected={handleCashCollected}
                  onOpenSalonPwa={(token, salon) => {
                    setActiveOnboarding({ token, salonName: salon });
                    setIsSalonPwaModalOpen(true);
                  }}
                  kamranCashHeld={kamranCashHeld}
                  onClose={activeRole === 'FOUNDER' ? () => handleTabChange('Overview') : undefined}
                  initialAutoOpenEnrollment={!!initialEnrollAgentData}
                  initialEnrollAgentData={initialEnrollAgentData || undefined}
                  userRole={activeRole === 'FIELD_AGENT' ? 'FIELD_AGENT' : 'FOUNDER'}
                  onActiveCountriesChange={setDynamicAgentCountries}
                />
              </SilentSelfHealingBoundary>
            ) : activeTab === 'Salon Owner Dashboard' ? (
              <SilentSelfHealingBoundary
                areaName="Salon Portal"
                onSilentRecovered={(d) => showToast(`🛡️ Auto-recovered ${d.areaName} seamlessly`)}
              >
                {activeRole === 'SALON_OWNER' && !hasCompletedSalonOnboarding ? (
                  <FieldAgentHub
                    userRole="SALON_OWNER"
                    socialCampaignSource={socialCampaignSource}
                    initialSalonName={onboardedSalonName || activeOnboarding?.salonName}
                    onReturnToFounder={founderPreviewMode !== 'NONE' ? handleExitFounderPreview : undefined}
                    onSalonCreated={handleSalonCreated}
                    onSalonOnboardingComplete={(payload) => handlePairingComplete(payload.salonName, payload)}
                  />
                ) : (
                  <SalonOwnerDashboard
                    selectedSalonName={onboardedSalonName || inspectSalonName}
                    salonCategory={completedOnboardingData?.salonCategory}
                    onboardedData={completedOnboardingData}
                    isFounderInspector={activeRole === 'FOUNDER'}
                    onClose={activeRole === 'FOUNDER' ? () => handleTabChange('Overview') : undefined}
                  />
                )}
              </SilentSelfHealingBoundary>
            ) : (
              <SilentSelfHealingBoundary
                areaName="Founder Workspace"
                onSilentRecovered={(d) => showToast(`🛡️ Auto-recovered ${d.areaName} cleanly`)}
              >
                {activeTab === 'Voice' ? (
                  <VoiceSection onClose={() => handleTabChange('Overview')} />
                ) : activeTab === 'Overview' ? (
                  <OverviewSection
                    payment={isPaymentPaid}
                    setPayment={setIsPaymentPaid}
                    go={handleTabChange}
                    setDetailSheet={setDetailSheet}
                    onOpenVoiceTicker={() => setIsVoiceDrawerOpen(true)}
                    onInspectSalon={handleInspectSalon}
                    activeSalonCount={activeSalonCount}
                    kamranCashHeld={kamranCashHeld}
                    onOpenSalonPwa={() => setIsSalonPwaModalOpen(true)}
                    onSwitchToAgent={() => handleTabChange('Agent Hub / Onboarding')}
                    onOpenPairing={() => setIsPairingModalOpen(true)}
                  />
                ) : (
                  <TabsSection
                    active={activeTab}
                    go={handleTabChange}
                    setPaymentRouting={setPaymentRoutingMethod}
                    onInspectSalon={handleInspectSalon}
                    onLaunchFounderPreview={handleLaunchFounderPreview}
                    onTestSocialLaunch={handleTestSocialLaunch}
                  />
                )}
              </SilentSelfHealingBoundary>
            )}
          </div>
        </section>
      </div>

      {/* Floating Bottom Navigation Bar for Mobile */}
      <nav
        className="fixed inset-x-3 bottom-3 z-40 flex items-center justify-around rounded-2xl border border-[#30363D] bg-[#161B22]/95 p-1.5 backdrop-blur-md lg:hidden"
        aria-label="Quick navigation"
      >
        {mobileNavItems.map(([name, Icon, label]) => {
          const isActive = activeTab === name;
          return (
            <button
              key={name}
              onClick={() => handleTabChange(name)}
              className={`flex min-h-[48px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[9px] font-mono font-bold transition ${
                isActive
                  ? 'text-[#06B6D4] bg-[#21262D]'
                  : 'text-[#8B949E] hover:text-[#F0F6FC]'
              }`}
            >
              <Icon className="size-4" />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>

      {/* Global / Country Broadcast Pause Alert */}
      {(isGlobalPaused || activePausedCountryList.length > 0) && (
        <div className="fixed inset-x-4 bottom-20 z-50 rounded-xl border border-[#9E6A03] bg-[#3B2E0B] p-3 text-xs font-mono font-bold text-[#D29922] backdrop-blur-md lg:bottom-4 lg:left-auto lg:right-4 lg:w-80">
          {isGlobalPaused
            ? '⚠️ Global pause is active. New broadcasts across all countries are safely held.'
            : `⚠️ Paused for ${activePausedCountryList.map((c) => `${c.flag} ${c.label}`).join(', ')}. Remaining countries continue running normally.`}
        </div>
      )}

      {/* Dedicated Voice Ticker Support Drawer */}
      <VoiceSupportDrawer
        isOpen={isVoiceDrawerOpen}
        onClose={() => setIsVoiceDrawerOpen(false)}
      />

      {/* Detail Bottom Sheet */}
      <DetailSheet
        detail={detailSheet}
        onClose={() => setDetailSheet(null)}
        go={handleTabChange}
        onOpenVoiceTicker={() => setIsVoiceDrawerOpen(true)}
        onOpenReportModal={() => setIsReportModalOpen(true)}
      />

      {/* Modals */}
      <FinancialReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
      />

      <PaymentRoutingModal
        method={paymentRoutingMethod}
        onClose={() => setPaymentRoutingMethod(null)}
        onSave={() => setPaymentRoutingMethod(null)}
      />

      <NotificationsDrawer
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        onOpenVoiceTicker={() => setIsVoiceDrawerOpen(true)}
      />

      {/* Unified 4-Step Salon Onboarding Modal */}
      {isSalonPwaModalOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-[#0D1117]/80 p-4 backdrop-blur-md"
          onClick={() => setIsSalonPwaModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-4xl rounded-3xl border border-[#30363D] bg-[#161B22] p-5 sm:p-6 animate-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto"
          >
            <FieldAgentHub
              userRole="SALON_OWNER"
              initialSalonName={activeOnboarding?.salonName || 'Royal Fade Lounge'}
              onSalonCreated={handleSalonCreated}
              onSalonOnboardingComplete={(payload) => handlePairingComplete(payload.salonName, payload)}
              onClose={() => setIsSalonPwaModalOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Dedicated Pairing QR Code Modal */}
      {isPairingModalOpen && (
        <div
          className="fixed inset-0 z-[85] flex items-center justify-center bg-[#0D1117]/80 p-4 backdrop-blur-md"
          onClick={() => setIsPairingModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl border border-[#30363D] bg-[#161B22] p-6 animate-in zoom-in-95 duration-150 space-y-4 text-center"
          >
            <div className="flex items-center justify-between border-b border-[#21262D] pb-3">
              <div>
                <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-400">
                  FOUNDER DASHBOARD PAIRING
                </p>
                <h3 className="text-lg font-bold text-[#F0F6FC]">Terminal Multi-Device QR</h3>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsPairingModalOpen(false);
                }}
                className="min-h-[44px] min-w-[44px] grid place-items-center rounded-xl bg-[#21262D] border border-[#30363D] text-[#8B949E] hover:text-[#F0F6FC] transition active:scale-95 shrink-0"
                title="Close Pairing Modal"
                aria-label="Close Pairing Modal"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mx-auto grid size-52 place-items-center rounded-2xl bg-white p-5 text-[#0D1117] border border-[#30363D]">
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
                <circle cx="36" cy="83" r="3" fill="currentColor" />
                <circle cx="50" cy="83" r="3" fill="currentColor" />
                <circle cx="64" cy="83" r="3" fill="currentColor" />
                <rect x="42" y="42" width="16" height="16" fill="#D29922" rx="2" />
              </svg>
            </div>

            <div className="space-y-1 font-mono">
              <p className="text-xs font-bold text-[#F0F6FC]">
                Scan via WhatsApp ➔ Linked Devices ➔ Link a Device
              </p>
              <p className="text-[11px] text-cyan-400 break-all [overflow-wrap:break-word]">
                Alternative Alphanumeric Key: <strong className="break-all">WC-7892-SYS</strong>
              </p>
              <p className="text-[10px] text-[#6E7681]">
                Central SIM Protection Active · Instant Connection
              </p>
            </div>

            <button
              onClick={() => {
                setIsPairingModalOpen(false);
                showToast('🎉 WhatsApp device linked cleanly! Messages and reminders are protected.');
              }}
              className="w-full min-h-[48px] rounded-xl bg-[#06B6D4] hover:bg-[#22D3EE] py-2.5 text-xs font-mono font-bold uppercase text-[#0D1117] transition active:scale-95"
            >
              Confirm Device Link ✓
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
