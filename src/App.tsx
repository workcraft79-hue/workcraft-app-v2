import React, { useState, useEffect } from 'react';
import {
  House,
  UsersRound,
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
  SlidersHorizontal,
  LogOut,
  Award,
  Zap,
  Moon,
} from 'lucide-react';

import type { AuthUser } from './types/auth';

import { TabName } from './types/workcraft';
import {
  WATERMARK_URL,
  DEFAULT_USAGE_METER,
  INITIAL_VOICE_THREADS,
  type LiveUsageMeter,
  type VoiceThreadItem,
} from './data/portalData';
import { BrandMark } from './components/BrandMark';
import { OverviewSection } from './components/OverviewSection';
import { VoiceSection } from './components/VoiceSection';
import { TabsSection } from './components/TabsSection';
import { DetailSheet } from './components/DetailSheet';
import { FieldAgentHub, OnboardedSalonPayload } from './components/FieldAgentHub';
import { SalonOwnerDashboard } from './components/SalonOwnerDashboard';
import { SilentSelfHealingBoundary } from './components/SilentSelfHealingBoundary';
import { reportClientIncident, setActiveTelemetryRole } from './utils/errorTelemetry';
import {
  FounderBiometricEnrollPrompt,
  FounderUnlockGate,
  detectMobileFounderDevice,
  loadStoredFounderBiometric,
  supportsPlatformBiometric,
} from './components/FounderUnlockGate';
import {
  FinancialReportModal,
  PaymentRoutingModal,
  NotificationsDrawer,
} from './components/Modals';

const SOCIAL_CAMPAIGN_SOURCE_MAP: Record<string, string> = {
  fb: 'Facebook Ads Campaign',
  facebook: 'Facebook Ads Campaign',
  ig: 'Instagram Ads Campaign',
  instagram: 'Instagram Ads Campaign',
  tiktok: 'TikTok Ads Campaign',
  tt: 'TikTok Ads Campaign',
  social: 'Social Media Campaign',
};

function getInitialRouteIntent() {
  if (typeof window === 'undefined') {
    return {
      isAgentInviteRoute: false,
      inviteTokenParam: '',
      socialSource: null as string | null,
      sessionOnboardingLocked: false,
    };
  }
  const params = new URLSearchParams(window.location.search);
  const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
  const inviteTokenParam = (params.get('token') || '').trim();
  const refParam = (params.get('ref') || '').trim().toLowerCase();
  const utmSource = (params.get('utm_source') || '').trim().toLowerCase();
  const onboardParam = (params.get('onboard') || '').trim().toLowerCase();
  const sourceKey = refParam || utmSource || (onboardParam === 'true' ? 'social' : '');
  const socialSource = sourceKey ? SOCIAL_CAMPAIGN_SOURCE_MAP[sourceKey] || null : null;
  let sessionOnboardingLocked = false;
  try {
    sessionOnboardingLocked = Boolean(sessionStorage.getItem('wcl_salon_onboarding_locked_v1'));
  } catch {
    sessionOnboardingLocked = false;
  }
  return {
    isAgentInviteRoute: pathname === '/enroll/agent',
    inviteTokenParam,
    socialSource,
    sessionOnboardingLocked,
  };
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs = 3500
): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

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
  const [enrolledAgentDisplayName, setEnrolledAgentDisplayName] = useState<string | null>(() => {
    try {
      return localStorage.getItem('wcl_enrolled_agent_name_v1') || null;
    } catch {
      return null;
    }
  });

  // Founder Command Center Workspace Navigation
  const [activeTab, setActiveTab] = useState<TabName>('Overview');
  const [salonOwnerSection, setSalonOwnerSection] = useState<
    'LIVE' | 'PASSES' | 'VOICE' | 'MANAGE'
  >('LIVE');
  const [ownerHardwareAction, setOwnerHardwareAction] = useState<{
    type: 'WAKE' | 'AUX' | 'SLEEP';
    seq: number;
  } | null>(null);
  const [ownerHardwareStatus, setOwnerHardwareStatus] = useState({
    isWakeLockActive: false,
    isLoudspeakerBoostActive: false,
    isCounterSleeping: false,
    overnightCount: 0,
    hasFounderVoiceReply: false,
  });

  const initialRoute = React.useMemo(() => getInitialRouteIntent(), []);
  const shouldStartPublicOnboarding = Boolean(
    !initialRoute.isAgentInviteRoute &&
      initialRoute.socialSource &&
      !initialRoute.sessionOnboardingLocked
  );

  // Verified Session State: Always starts unauthenticated and verifies server session (zero auto-bypass for Founder)
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState<boolean>(true);
  const [showMobileBiometricPrompt, setShowMobileBiometricPrompt] = useState(false);
  const [initialEnrollAgentData, setInitialEnrollAgentData] = useState<{
    id?: string;
    name?: string;
    phone?: string;
    city?: string;
  } | null>(null);
  const [agentInviteToken, setAgentInviteToken] = useState<string | null>(null);
  const [agentInviteError, setAgentInviteError] = useState<string | null>(null);

  // Pure Role Isolation Architecture driven strictly by active session `userRole`
  const [activeRole, setActiveRole] = useState<'FOUNDER' | 'FIELD_AGENT' | 'SALON_OWNER'>(() =>
    shouldStartPublicOnboarding
      ? 'SALON_OWNER'
      : initialRoute.isAgentInviteRoute
      ? 'FIELD_AGENT'
      : 'FOUNDER'
  );
  const [socialCampaignSource, setSocialCampaignSource] = useState<string | null>(
    () => (shouldStartPublicOnboarding ? initialRoute.socialSource : null)
  );
  const [isPublicOnboardingOpen, setIsPublicOnboardingOpen] = useState<boolean>(
    () => shouldStartPublicOnboarding
  );
  const [isSubmittingPublicOnboarding, setIsSubmittingPublicOnboarding] = useState(false);
  const [publicOnboardingError, setPublicOnboardingError] = useState<string | null>(null);

  const applyVerifiedSession = (user: AuthUser) => {
    setAuthUser(user);
    setFounderPreviewMode('NONE');
    setIsPublicOnboardingOpen(false);
    setAgentInviteToken(null);
    setAgentInviteError(null);
    if (user.userRole === 'FOUNDER') {
      setActiveRole('FOUNDER');
      setActiveTab('Overview');
      setHasCompletedSalonOnboarding(true);
      setOnboardedSalonName(undefined);
      setInitialEnrollAgentData(null);
    } else if (user.userRole === 'AGENT') {
      setActiveRole('FIELD_AGENT');
      setActiveTab('Agent Hub / Onboarding');
      setInitialEnrollAgentData({
        id: user.agentId || undefined,
        name: user.displayName,
        phone: user.phone,
      });
    } else {
      setActiveRole('SALON_OWNER');
      setActiveTab('Salon Owner Dashboard');
      setHasCompletedSalonOnboarding(true);
      setOnboardedSalonName(user.salonName);
      setInspectSalonName(user.salonName);
      setInitialEnrollAgentData(null);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      // Workflow 3: Single-Use Field Agent Invite Link (/enroll/agent?token=...)
      if (initialRoute.isAgentInviteRoute) {
        if (!initialRoute.inviteTokenParam) {
          if (!cancelled) {
            setAgentInviteError('Invalid or missing single-use agent invite token.');
            setIsCheckingSession(false);
          }
          return;
        }
        try {
          const res = await fetchWithTimeout(
            `/api/agent/enroll?token=${encodeURIComponent(initialRoute.inviteTokenParam)}`,
            undefined,
            3500
          );
          const data = (await res.json()) as {
            valid?: boolean;
            error?: string;
            invite?: { agentId?: string; name?: string; phone?: string; city?: string };
          };
          if (cancelled) return;
          if (!res.ok || !data?.valid || !data.invite) {
            setAgentInviteError(
              data?.error ||
                'This single-use agent invite link has already been completed and permanently locked.'
            );
            setIsCheckingSession(false);
            return;
          }
          setAgentInviteToken(initialRoute.inviteTokenParam);
          setInitialEnrollAgentData({
            id: data.invite.agentId,
            name: data.invite.name,
            phone: data.invite.phone,
            city: data.invite.city,
          });
          setActiveRole('FIELD_AGENT');
          setActiveTab('Agent Hub / Onboarding');
          setIsCheckingSession(false);
          return;
        } catch {
          if (!cancelled) {
            setAgentInviteError('Unable to verify agent invite link right now.');
            setIsCheckingSession(false);
          }
          return;
        }
      }

      // Check existing verified session cookie (Founder, Agent, or Salon Owner)
      let existingUser: AuthUser | null = null;
      try {
        const sessionRes = await fetchWithTimeout('/api/auth/session', undefined, 3000);
        const contentType = sessionRes.headers.get('content-type') || '';
        if (sessionRes.ok && contentType.includes('application/json')) {
          const sessionData = (await sessionRes.json()) as {
            authenticated?: boolean;
            user?: AuthUser | null;
          };
          if (sessionData?.authenticated && sessionData.user) {
            existingUser = sessionData.user;
          }
        }
      } catch {
        // Offline or unreachable server: leaves unauthenticated gate cleanly
      }
      if (cancelled) return;

      if (initialRoute.socialSource) {
        if (existingUser?.userRole === 'SALON_OWNER' && initialRoute.sessionOnboardingLocked) {
          applyVerifiedSession(existingUser);
        }
        setIsCheckingSession(false);
        return;
      }

      if (existingUser) {
        applyVerifiedSession(existingUser);
      }
      setIsCheckingSession(false);
    };

    void boot();
    return () => {
      cancelled = true;
    };
  }, [initialRoute]);

  const handleAgentEnrollmentComplete = async (agentPayload: {
    name: string;
    phone: string;
    city: string;
    websiteUrl?: string;
  }) => {
    if (!agentInviteToken) return;
    const res = await fetch('/api/agent/enroll/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: agentInviteToken,
        name: agentPayload.name,
        phone: agentPayload.phone,
        city: agentPayload.city,
        websiteUrl: agentPayload.websiteUrl || '',
      }),
    });
    const data = (await res.json()) as {
      authenticated?: boolean;
      user?: AuthUser;
      error?: string;
    };
    if (!res.ok || !data?.authenticated || !data.user) {
      setAgentInviteError(data?.error || 'Could not complete agent enrollment.');
      return;
    }
    if (typeof window !== 'undefined' && window.location.pathname === '/enroll/agent') {
      window.history.replaceState({}, '', '/');
    }
    const syncedName = (agentPayload.name || data.user.displayName || '').trim();
    if (syncedName) {
      setEnrolledAgentDisplayName(syncedName);
      try {
        localStorage.setItem('wcl_enrolled_agent_name_v1', syncedName);
      } catch {}
    }
    applyVerifiedSession(data.user);
    showToast('Invite locked permanently — welcome to your editable Field Agent Hub.');
  };

  const handleCompletePublicOnboarding = async (payload: OnboardedSalonPayload) => {
    if (isSubmittingPublicOnboarding) return;
    setPublicOnboardingError(null);
    setIsSubmittingPublicOnboarding(true);
    try {
      const res = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salonName: payload.salonName,
          ownerName: payload.ownerName,
          phone: payload.phone,
          location: payload.location,
          planId: payload.planId,
          language: payload.language,
          salonCategory: payload.salonCategory,
          enabledServices: Array.isArray(payload.services)
            ? payload.services.map((s) => ({
                id: s.id,
                name: s.name,
                price: s.price,
                durationMins: 35,
                active: s.enabled,
              }))
            : undefined,
          barbers: payload.barbers,
          websiteUrl: payload.websiteUrl || '',
        }),
      });
      const data = await res.json();
      if (res.status === 409) {
        setPublicOnboardingError(
          data?.error ||
            'Each salon branch requires its own unique WhatsApp number. Please enter a different WhatsApp number for this branch.'
        );
        return;
      }
      if (!res.ok || !data?.authenticated || !data?.user) {
        setPublicOnboardingError(
          data?.error || 'Could not finalize salon installation. Please check your details.'
        );
        return;
      }

      if (typeof window !== 'undefined') {
        sessionStorage.setItem('wcl_salon_onboarding_locked_v1', String(data.salonId));
        if (window.location.search) {
          window.history.replaceState({}, '', '/');
        }
      }
      setCompletedOnboardingData(payload);
      setOnboardedSalonName(data.salonName || payload.salonName);
      applyVerifiedSession(data.user as AuthUser);
      setHasCompletedSalonOnboarding(true);
      setIsPublicOnboardingOpen(false);
      showToast(
        `${data.salonName || payload.salonName} Live Floor Dashboard is active! Automated mass blasts activate once billing is confirmed.`
      );
    } catch {
      setPublicOnboardingError('Network error while saving installation details. Try again.');
    } finally {
      setIsSubmittingPublicOnboarding(false);
    }
  };

  const handleLogout = async () => {
    const previousRole = authUser?.userRole;
    try {
      await fetchWithTimeout('/api/auth/logout', { method: 'POST' }, 2000);
    } catch {}
    setFounderPreviewMode('NONE');
    setIsSidebarOpen(false);
    setShowMobileBiometricPrompt(false);
    setInspectSalonName(undefined);
    setOnboardedSalonName(undefined);
    setCompletedOnboardingData(null);

    if (previousRole === 'SALON_OWNER') {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('wcl_salon_onboarding_locked_v1');
      }
      setAuthUser(null);
      setHasCompletedSalonOnboarding(false);
      setIsPublicOnboardingOpen(true);
      return;
    }

    setAuthUser(null);
    setActiveRole('FOUNDER');
    setActiveTab('Overview');
  };

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [voiceThreads, setVoiceThreads] = useState<VoiceThreadItem[]>(INITIAL_VOICE_THREADS);
  const [usageMeter, setUsageMeter] = useState<LiveUsageMeter>(DEFAULT_USAGE_METER);
  const unreadVoiceCount = voiceThreads.filter((t) => t.unread).length;
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
  const [pairingModalQr, setPairingModalQr] = useState<{
    pairingKey: string;
    qrDataUrl: string | null;
  }>({ pairingKey: 'WC-7892-SYS', qrDataUrl: null });
  const [isPaymentPaid, setIsPaymentPaid] = useState(false);
  const [detailSheet, setDetailSheet] = useState<string | null>(null);

  const [founderPreviewMode, setFounderPreviewMode] = useState<'NONE' | 'AGENT' | 'SALON_ONBOARD' | 'SALON_LIVE'>('NONE');
  const [salonOwnerUiLang, setSalonOwnerUiLang] = useState<'en' | 'ur' | 'ar'>('en');

  const refreshVoiceAndUsage = React.useCallback(async () => {
    try {
      const [healthRes, threadsRes, usageRes] = await Promise.allSettled([
        fetch('/api/health/whatsapp'),
        fetch('/api/voice/threads'),
        fetch('/api/voice/usage'),
      ]);

      if (healthRes.status === 'fulfilled' && healthRes.value.ok) {
        const healthData = (await healthRes.value.json()) as {
          status?: 'HEALTHY' | 'ISSUE';
        };
        if (healthData?.status === 'ISSUE' || healthData?.status === 'HEALTHY') {
          setWhatsAppHealth(healthData.status);
        }
      }

      if (threadsRes.status === 'fulfilled' && threadsRes.value.ok) {
        const threadsData = (await threadsRes.value.json()) as {
          threads?: VoiceThreadItem[];
        };
        if (Array.isArray(threadsData?.threads) && threadsData.threads.length > 0) {
          setVoiceThreads(threadsData.threads);
        }
      }

      if (usageRes.status === 'fulfilled' && usageRes.value.ok) {
        const usageData = (await usageRes.value.json()) as
          | ({ usage?: LiveUsageMeter } & Partial<LiveUsageMeter>);
        const parsedUsage = usageData?.usage
          ? usageData.usage
          : typeof usageData?.usagePercent === 'number'
          ? (usageData as LiveUsageMeter)
          : null;
        if (parsedUsage) {
          setUsageMeter(parsedUsage);
        }
      }
    } catch {
      // Non-blocking fallback for static/offline hosts
    }
  }, []);

  useEffect(() => {
    if (isCheckingSession || !authUser) return;
    void refreshVoiceAndUsage();
    if (authUser.userRole === 'FOUNDER' || authUser.userRole === 'AGENT') {
      fetch('/api/finance/summary')
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { cashHeld?: number } | null) => {
          if (typeof data?.cashHeld === 'number') {
            setKamranCashHeld(data.cashHeld);
          }
        })
        .catch(() => {});
    }
    if (activeRole !== 'FOUNDER') return;
    const interval = window.setInterval(() => {
      void refreshVoiceAndUsage();
    }, 8000);
    return () => window.clearInterval(interval);
  }, [isCheckingSession, authUser, activeRole, refreshVoiceAndUsage]);

  useEffect(() => {
    if (!isCheckingSession && authUser && activeTab === 'Voice') {
      void refreshVoiceAndUsage();
    }
  }, [isCheckingSession, authUser, activeTab, refreshVoiceAndUsage]);

  useEffect(() => {
    if (!isPairingModalOpen) return;
    fetch('/api/founder/pairing-qr')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { pairingKey?: string; qrDataUrl?: string } | null) => {
        if (data?.pairingKey) {
          setPairingModalQr({
            pairingKey: data.pairingKey,
            qrDataUrl: data.qrDataUrl || null,
          });
        }
      })
      .catch(() => {});
  }, [isPairingModalOpen]);

  const handleLaunchFounderPreview = (mode: 'AGENT' | 'SALON_ONBOARD' | 'SALON_LIVE') => {
    if (authUser?.userRole !== 'FOUNDER') return;
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
    if (authUser?.userRole !== 'FOUNDER') return;
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
          id: '/',
          name: 'WorkCraft',
          short_name: 'WorkCraft',
          start_url: '/',
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

  useEffect(() => {
    setActiveTelemetryRole(authUser?.userRole || activeRole);
  }, [authUser?.userRole, activeRole]);

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

  const handleCashRemitted = (amount: number) => {
    setKamranCashHeld((prev) => Math.max(0, prev - amount));
    showToast(`✅ PKR ${amount.toLocaleString()} verified into WORKCRAFT Main Account · Pakistani Agent Hub restored automatically!`);
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

  const handleTestSocialLaunch = (source: 'Facebook' | 'Instagram' | 'TikTok' | 'WhatsApp') => {
    setSocialCampaignSource(`${source} Ads Campaign`);
    setCompletedOnboardingData(null);
    setOnboardedSalonName(undefined);
    setHasCompletedSalonOnboarding(false);
    setActiveRole('SALON_OWNER');
    setActiveTab('Salon Owner Dashboard');
    showToast(`📱 Previewing mobile Step 1 signup arrival from ${source} Ad Campaign!`);
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

  if (isCheckingSession) {
    return (
      <main className="min-h-screen bg-[#0D1117] text-[#F0F6FC] flex items-center justify-center p-6">
        <div className="rounded-2xl border border-[#30363D] bg-[#161B22] px-6 py-5 text-xs font-mono text-[#8B949E]">
          Opening WorkCraft Portal...
        </div>
      </main>
    );
  }

  if (!authUser) {
    if (agentInviteToken && initialEnrollAgentData) {
      return (
        <main className="min-h-screen overflow-x-hidden bg-[#0D1117] text-[#F0F6FC] font-sans pb-28">
          <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-[#30363D] bg-[#0D1117]/95 backdrop-blur-md px-4 sm:px-7 gap-3">
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-[#9E6A03] bg-[#3B2E0B] px-2.5 py-1.5 text-[10px] font-mono font-bold text-[#D29922]">
              <Lock className="size-3 shrink-0" />
              <span>SINGLE-USE INVITE</span>
            </div>
            <div className="flex flex-col items-center justify-center leading-none">
              <img
                src={WATERMARK_URL}
                alt="WORKCRAFT"
                className="h-auto w-[132px] object-contain opacity-95"
              />
              <span className="mt-1 text-[9px] font-mono font-black tracking-[0.25em] text-[#06B6D4] uppercase">
                FIELD AGENT ENROLLMENT
              </span>
            </div>
            <div className="inline-flex items-center gap-1 rounded-lg border border-[#116329] bg-[#0D3822] px-2.5 py-1.5 text-[10px] font-mono font-bold text-[#3FB950]">
              <ShieldCheck className="size-3 shrink-0" />
              <span className="hidden sm:inline">Locks After Setup</span>
            </div>
          </header>

          <div className="mx-auto max-w-4xl w-full p-4 sm:p-6 space-y-4">
            {agentInviteError && (
              <div className="rounded-xl border border-[#da3633] bg-[#4C1C1D] px-4 py-3 text-xs font-mono font-bold text-[#F85149] break-words [overflow-wrap:break-word]">
                {agentInviteError}
              </div>
            )}
            <SilentSelfHealingBoundary
              areaName="Agent Invite Enrollment"
              onSilentRecovered={(d) =>
                reportClientIncident({
                  role: 'AGENT',
                  area: d.areaName,
                  message: d.message,
                  severity: 'MEDIUM',
                  resolutionStatus: 'AUTO_RESOLVED',
                  recoveryMs: 800,
                })
              }
            >
              <FieldAgentHub
                userRole="FIELD_AGENT"
                initialAutoOpenEnrollment={true}
                initialEnrollAgentData={initialEnrollAgentData}
                onAgentEnrollmentComplete={handleAgentEnrollmentComplete}
                onAgentProfileNameSync={(name) => {
                  const trimmed = name.trim();
                  if (!trimmed) return;
                  setEnrolledAgentDisplayName(trimmed);
                  try {
                    localStorage.setItem('wcl_enrolled_agent_name_v1', trimmed);
                  } catch {}
                }}
                onSalonCreated={() => {}}
              />
            </SilentSelfHealingBoundary>
          </div>
        </main>
      );
    }

    if (agentInviteError) {
      return (
        <main className="min-h-screen bg-[#0D1117] text-[#F0F6FC] flex items-center justify-center p-5">
          <div className="w-full max-w-md rounded-3xl border border-[#da3633] bg-[#161B22] p-6 space-y-4 text-center">
            <div className="mx-auto grid size-14 place-items-center rounded-2xl border border-[#da3633] bg-[#4C1C1D] text-[#F85149]">
              <Lock className="size-7" />
            </div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[#F85149] block">
              INVITE PERMANENTLY LOCKED
            </span>
            <h1 className="text-xl font-black text-[#F0F6FC]">
              Single-Use Enrollment Link Unavailable
            </h1>
            <p className="text-xs font-sans text-[#8B949E] leading-relaxed">
              {agentInviteError}
            </p>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.location.href = '/';
                }
              }}
              className="w-full min-h-[48px] rounded-xl bg-[#06B6D4] hover:bg-[#22D3EE] text-[#0D1117] text-xs font-mono font-bold uppercase transition"
            >
              Return to WorkCraft Home
            </button>
          </div>
        </main>
      );
    }

    if (isPublicOnboardingOpen) {
      return (
        <main className="min-h-screen overflow-x-hidden bg-[#0D1117] text-[#F0F6FC] font-sans pb-28">
          <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-[#30363D] bg-[#0D1117]/95 backdrop-blur-md px-4 sm:px-7 gap-3">
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-[#30363D] bg-[#161B22] px-2.5 py-1.5 text-[10px] font-mono font-bold text-[#06B6D4]">
              <Scissors className="size-3 shrink-0" />
              <span>1 WHATSAPP / BRANCH</span>
            </div>

            <div className="flex flex-col items-center justify-center leading-none">
              <img
                src={WATERMARK_URL}
                alt="WORKCRAFT"
                className="h-auto w-[132px] object-contain opacity-95"
              />
              <span className="mt-1 text-[9px] font-mono font-black tracking-[0.25em] text-[#06B6D4] uppercase">
                SALON SETUP &amp; INSTALL
              </span>
            </div>

            <div className="inline-flex items-center gap-1 rounded-lg border border-[#116329] bg-[#0D3822] px-2.5 py-1.5 text-[10px] font-mono font-bold text-[#3FB950]">
              <ShieldCheck className="size-3 shrink-0" />
              <span className="hidden sm:inline">Live Floor Ready</span>
            </div>
          </header>

          <div className="mx-auto max-w-4xl w-full p-4 sm:p-6 space-y-4">
            {publicOnboardingError && (
              <div className="rounded-xl border border-[#da3633] bg-[#4C1C1D] px-4 py-3 text-xs font-mono font-bold text-[#F85149] break-words [overflow-wrap:break-word]">
                {publicOnboardingError}
              </div>
            )}
            <SilentSelfHealingBoundary
              areaName="Salon Self-Onboarding"
              onSilentRecovered={(d) =>
                reportClientIncident({
                  role: 'END_USER',
                  area: d.areaName,
                  message: d.message,
                  severity: 'MEDIUM',
                  resolutionStatus: 'AUTO_RESOLVED',
                  recoveryMs: 800,
                })
              }
            >
              <FieldAgentHub
                userRole="SALON_OWNER"
                socialCampaignSource={socialCampaignSource}
                onSalonCreated={() => {}}
                onSalonOnboardingComplete={handleCompletePublicOnboarding}
              />
            </SilentSelfHealingBoundary>
          </div>
        </main>
      );
    }

    return (
      <FounderUnlockGate
        onUnlocked={(user, unlockedVia) => {
          applyVerifiedSession(user);
          if (
            unlockedVia === 'PIN' &&
            detectMobileFounderDevice() &&
            supportsPlatformBiometric() &&
            !loadStoredFounderBiometric()
          ) {
            setShowMobileBiometricPrompt(true);
          } else {
            setShowMobileBiometricPrompt(false);
          }
        }}
      />
    );
  }

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
            {activeRole === 'SALON_OWNER' && hasCompletedSalonOnboarding ? (
              <>
                {[
                  {
                    id: 'LIVE' as const,
                    label:
                      salonOwnerUiLang === 'ur'
                        ? 'لائیو فلور'
                        : salonOwnerUiLang === 'ar'
                        ? 'الصالة المباشرة'
                        : 'Live Floor',
                    Icon: Scissors,
                    badge: false,
                  },
                  {
                    id: 'PASSES' as const,
                    label:
                      salonOwnerUiLang === 'ur'
                        ? 'پاسز اور ایونٹس'
                        : salonOwnerUiLang === 'ar'
                        ? 'الباقات والمناسبات'
                        : 'Passes & Events',
                    Icon: Award,
                    badge: false,
                  },
                  {
                    id: 'VOICE' as const,
                    label:
                      salonOwnerUiLang === 'ur'
                        ? 'وائس ہیلپ'
                        : salonOwnerUiLang === 'ar'
                        ? 'المساعدة الصوتية'
                        : 'Voice Help',
                    Icon: Mic,
                    badge: ownerHardwareStatus.hasFounderVoiceReply,
                  },
                  {
                    id: 'MANAGE' as const,
                    label:
                      salonOwnerUiLang === 'ur'
                        ? 'مینج کریں'
                        : salonOwnerUiLang === 'ar'
                        ? 'الإدارة'
                        : 'Manage',
                    Icon: SlidersHorizontal,
                    badge: false,
                  },
                ].map(({ id, label, Icon, badge }) => {
                  const isActive = salonOwnerSection === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        setActiveTab('Salon Owner Dashboard');
                        setSalonOwnerSection(id);
                        setIsSidebarOpen(false);
                      }}
                      className={`flex min-h-[48px] items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-[12px] font-mono transition ${
                        isActive
                          ? 'bg-[#21262D] text-[#F0F6FC] border border-[#06B6D4]/50 font-bold'
                          : 'text-[#8B949E] hover:bg-[#21262D]/60 hover:text-[#F0F6FC] border border-transparent'
                      }`}
                    >
                      <Icon className={`size-[17px] shrink-0 ${isActive ? 'text-[#06B6D4]' : 'text-[#D29922]'}`} />
                      <span>{label}</span>
                      {badge && (
                        <span className="ml-auto size-2.5 rounded-full bg-[#3FB950] shadow-[0_0_8px_#3FB950]" />
                      )}
                    </button>
                  );
                })}

                {/* Counter Hardware Controls Drawer Section (Moved off Live Floor main header) */}
                <div className="mt-4 pt-3 border-t border-[#21262D] space-y-1.5">
                  <div className="px-1 text-[10px] font-mono font-bold uppercase tracking-[.2em] text-[#6E7681]">
                    {salonOwnerUiLang === 'ur'
                      ? 'کاؤنٹر کنٹرولز'
                      : salonOwnerUiLang === 'ar'
                      ? 'أدوات الكاونتر'
                      : 'COUNTER CONTROLS'}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setOwnerHardwareAction((prev) => ({
                        type: 'WAKE',
                        seq: (prev?.seq || 0) + 1,
                      }));
                    }}
                    className={`flex w-full min-h-[42px] items-center justify-between gap-2 rounded-xl border px-3 py-2 text-[11px] font-mono font-bold transition ${
                      ownerHardwareStatus.isWakeLockActive
                        ? 'border-[#3FB950]/50 bg-[#1B4332]/40 text-[#3FB950]'
                        : 'border-[#30363D] bg-[#0D1117] text-[#8B949E] hover:text-[#F0F6FC]'
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <Smartphone className="size-3.5 shrink-0" />
                      <span className="truncate">
                        {salonOwnerUiLang === 'ur'
                          ? 'اسکرین آن رکھیں'
                          : salonOwnerUiLang === 'ar'
                          ? 'إبقاء الشاشة مضاءة'
                          : 'Keep Screen Awake'}
                      </span>
                    </span>
                    <span className="text-[9px] uppercase">
                      {ownerHardwareStatus.isWakeLockActive ? 'ON' : 'OFF'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOwnerHardwareAction((prev) => ({
                        type: 'AUX',
                        seq: (prev?.seq || 0) + 1,
                      }));
                    }}
                    className={`flex w-full min-h-[42px] items-center justify-between gap-2 rounded-xl border px-3 py-2 text-[11px] font-mono font-bold transition ${
                      ownerHardwareStatus.isLoudspeakerBoostActive
                        ? 'border-[#D29922]/60 bg-[#4A320A]/40 text-[#D29922]'
                        : 'border-[#30363D] bg-[#0D1117] text-[#8B949E] hover:text-[#F0F6FC]'
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <Zap className="size-3.5 shrink-0" />
                      <span className="truncate">
                        {salonOwnerUiLang === 'ur'
                          ? 'لاؤڈ اسپیکر بوسٹ'
                          : salonOwnerUiLang === 'ar'
                          ? 'مضخم السماعة AUX'
                          : 'AUX Boost'}
                      </span>
                    </span>
                    <span className="text-[9px] uppercase">
                      {ownerHardwareStatus.isLoudspeakerBoostActive ? 'ON' : 'OFF'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOwnerHardwareAction((prev) => ({
                        type: 'SLEEP',
                        seq: (prev?.seq || 0) + 1,
                      }));
                      setIsSidebarOpen(false);
                    }}
                    className={`flex w-full min-h-[42px] items-center justify-between gap-2 rounded-xl border px-3 py-2 text-[11px] font-mono font-bold transition ${
                      ownerHardwareStatus.isCounterSleeping
                        ? 'border-[#06B6D4]/60 bg-[#06B6D4]/15 text-[#06B6D4]'
                        : 'border-[#30363D] bg-[#0D1117] text-[#8B949E] hover:text-[#F0F6FC]'
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <Moon className="size-3.5 shrink-0" />
                      <span className="truncate">
                        {salonOwnerUiLang === 'ur'
                          ? 'کاؤنٹر سلیپ موڈ'
                          : salonOwnerUiLang === 'ar'
                          ? 'وضع إغلاق الكاونتر'
                          : 'Counter Sleep'}
                      </span>
                    </span>
                    {ownerHardwareStatus.overnightCount > 0 && (
                      <span className="rounded-full bg-[#06B6D4]/20 px-1.5 py-0.5 text-[9px] text-[#06B6D4]">
                        {ownerHardwareStatus.overnightCount}
                      </span>
                    )}
                  </button>
                </div>
              </>
            ) : (
              navItems.map(([name, Icon]) => {
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
                        {unreadVoiceCount} unread
                      </span>
                    )}
                    {name === 'Revenue' && (
                      <span className="ml-auto size-2 rounded-full bg-[#D29922]" />
                    )}
                  </button>
                );
              })
            )}
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
            <div className="text-center space-y-3">
              <div>
                <p className="text-xs font-mono font-black tracking-[0.3em] text-[#06B6D4] uppercase">
                  {activeRole === 'FOUNDER'
                    ? 'FOUNDER'
                    : activeRole === 'FIELD_AGENT'
                    ? 'FIELD AGENT'
                    : 'SALON PARTNER'}
                </p>
                <p className="mt-1 text-sm font-bold text-[#F0F6FC] tracking-wide">
                  {activeRole === 'FIELD_AGENT'
                    ? enrolledAgentDisplayName ||
                      (authUser.userRole === 'AGENT' ? authUser.displayName : 'Kamran Tariq')
                    : activeRole === 'SALON_OWNER'
                    ? completedOnboardingData?.ownerName ||
                      (authUser.userRole === 'SALON_OWNER' ? authUser.displayName : 'Hamza Tariq')
                    : authUser.displayName}
                </p>
                {activeRole === 'SALON_OWNER' &&
                  (completedOnboardingData?.salonName || authUser.salonName) && (
                    <p className="text-[11px] font-mono text-[#8B949E] truncate">
                      {completedOnboardingData?.salonName || authUser.salonName}
                    </p>
                  )}
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full min-h-[44px] rounded-xl border border-[#30363D] bg-[#0D1117] hover:border-[#F85149] hover:text-[#F85149] text-[#8B949E] text-xs font-mono font-bold transition flex items-center justify-center gap-2"
              >
                <LogOut className="size-3.5" />
                <span>Sign Out</span>
              </button>
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
          <header className="sticky top-0 z-30 grid min-h-[72px] pt-safe grid-cols-[auto_1fr_auto] items-center border-b border-[#30363D] bg-[#0D1117]/95 backdrop-blur-md px-4 sm:px-7 gap-3">
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
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-lg border border-[#116329] bg-[#0D3822] px-2.5 py-1.5 text-[10px] font-mono font-bold text-[#3FB950]">
                    <ShieldCheck className="size-3.5" />
                    <span className="hidden sm:inline">Verified Session</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleLogout}
                    aria-label="Sign out"
                    title="Sign out"
                    className="min-h-[44px] min-w-[44px] grid place-items-center rounded-xl border border-[#30363D] bg-[#161B22] text-[#8B949E] hover:border-[#F85149] hover:text-[#F85149] transition"
                  >
                    <LogOut className="size-4" />
                  </button>
                </div>
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
            {showMobileBiometricPrompt && authUser.userRole === 'FOUNDER' && (
              <FounderBiometricEnrollPrompt
                onEnrolled={() => {
                  setShowMobileBiometricPrompt(false);
                  showToast('✓ Mobile Biometric saved! Future mobile logins offer both PIN & Biometric.');
                }}
                onDismiss={() => setShowMobileBiometricPrompt(false)}
              />
            )}
            {/* View Mode Header & Status Bar (Kept compact for onboarded Salon Owners so Top Status Strip leads immediately) */}
            {!(activeRole === 'SALON_OWNER' && hasCompletedSalonOnboarding) && (
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
                        : 'Complete setup steps to activate your live WhatsApp salon portal.'
                      : activeTab === 'Marketing'
                      ? 'Broadcast new features to all registered salons and share social signup ad links.'
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
            )}

            {/* Dynamic Unified Content Wrapped in Silent Auto-Recovery Error Boundaries */}
            {activeTab === 'Agent Hub / Onboarding' ? (
              <SilentSelfHealingBoundary
                areaName="Field Agent Hub"
                onSilentRecovered={(d) => {
                  reportClientIncident({
                    role: activeRole === 'FIELD_AGENT' ? 'AGENT' : 'FOUNDER',
                    area: d.areaName,
                    message: d.message,
                    severity: 'MEDIUM',
                    resolutionStatus: 'AUTO_RESOLVED',
                    recoveryMs: 800,
                  });
                  showToast(`🛡️ Auto-recovered ${d.areaName} seamlessly`);
                }}
              >
                <FieldAgentHub
                  onSalonCreated={handleSalonCreated}
                  onCashCollected={handleCashCollected}
                  onCashRemitted={handleCashRemitted}
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
                  onAgentProfileNameSync={(name) => {
                    const trimmed = name.trim();
                    if (!trimmed) return;
                    setEnrolledAgentDisplayName(trimmed);
                    try {
                      localStorage.setItem('wcl_enrolled_agent_name_v1', trimmed);
                    } catch {}
                  }}
                />
              </SilentSelfHealingBoundary>
            ) : activeTab === 'Salon Owner Dashboard' ? (
              <SilentSelfHealingBoundary
                areaName="Salon Portal"
                onSilentRecovered={(d) => {
                  reportClientIncident({
                    role: activeRole === 'SALON_OWNER' ? 'SALON_OWNER' : 'FOUNDER',
                    area: d.areaName,
                    message: d.message,
                    severity: 'MEDIUM',
                    resolutionStatus: 'AUTO_RESOLVED',
                    recoveryMs: 800,
                  });
                  showToast(`🛡️ Auto-recovered ${d.areaName} seamlessly`);
                }}
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
                    lockedSalonId={
                      authUser.userRole === 'SALON_OWNER' ? authUser.salonId : null
                    }
                    authUser={authUser}
                    onLogout={handleLogout}
                    salonCategory={completedOnboardingData?.salonCategory}
                    onboardedData={completedOnboardingData}
                    isFounderInspector={activeRole === 'FOUNDER'}
                    sectionMode={salonOwnerSection}
                    onSectionModeChange={setSalonOwnerSection}
                    externalHardwareAction={ownerHardwareAction}
                    onHardwareStatusSync={setOwnerHardwareStatus}
                    voiceThreads={voiceThreads}
                    onVoiceThreadsUpdated={setVoiceThreads}
                    onOwnerLangChange={setSalonOwnerUiLang}
                    onClose={activeRole === 'FOUNDER' ? () => handleTabChange('Overview') : undefined}
                  />
                )}
              </SilentSelfHealingBoundary>
            ) : (
              <SilentSelfHealingBoundary
                areaName="Founder Workspace"
                onSilentRecovered={(d) => {
                  reportClientIncident({
                    role: 'FOUNDER',
                    area: d.areaName,
                    message: d.message,
                    severity: 'MEDIUM',
                    resolutionStatus: 'AUTO_RESOLVED',
                    recoveryMs: 800,
                  });
                  showToast(`🛡️ Auto-recovered ${d.areaName} cleanly`);
                }}
              >
                {activeTab === 'Voice' ? (
                  <VoiceSection
                    threads={voiceThreads}
                    onThreadsUpdated={setVoiceThreads}
                    onUsageUpdated={setUsageMeter}
                    onRefreshInbox={refreshVoiceAndUsage}
                    onClose={() => handleTabChange('Overview')}
                  />
                ) : activeTab === 'Overview' ? (
                  <OverviewSection
                    payment={isPaymentPaid}
                    setPayment={setIsPaymentPaid}
                    go={handleTabChange}
                    setDetailSheet={setDetailSheet}
                    onOpenVoiceTicker={() => handleTabChange('Voice')}
                    voiceThreads={voiceThreads}
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
                    usageMeter={usageMeter}
                    kamranCashHeld={kamranCashHeld}
                    onRefreshUsage={refreshVoiceAndUsage}
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
        className="fixed inset-x-3 bottom-3 z-40 safe-bottom-nav flex items-center justify-around rounded-2xl border border-[#30363D] bg-[#161B22]/95 p-1.5 backdrop-blur-md lg:hidden"
        aria-label="Quick navigation"
      >
        {activeRole === 'SALON_OWNER' && hasCompletedSalonOnboarding ? (
          <>
            {[
              {
                id: 'LIVE' as const,
                Icon: Scissors,
                label:
                  salonOwnerUiLang === 'ur'
                    ? 'لائیو فلور'
                    : salonOwnerUiLang === 'ar'
                    ? 'الصالة'
                    : 'Live Floor',
                dot: false,
              },
              {
                id: 'PASSES' as const,
                Icon: Award,
                label:
                  salonOwnerUiLang === 'ur'
                    ? 'پاسز'
                    : salonOwnerUiLang === 'ar'
                    ? 'الباقات'
                    : 'Passes',
                dot: false,
              },
              {
                id: 'VOICE' as const,
                Icon: Mic,
                label:
                  salonOwnerUiLang === 'ur'
                    ? 'وائس ہیلپ'
                    : salonOwnerUiLang === 'ar'
                    ? 'الصوت'
                    : 'Voice Help',
                dot: ownerHardwareStatus.hasFounderVoiceReply,
              },
              {
                id: 'MANAGE' as const,
                Icon: SlidersHorizontal,
                label:
                  salonOwnerUiLang === 'ur'
                    ? 'مینج'
                    : salonOwnerUiLang === 'ar'
                    ? 'الإدارة'
                    : 'Manage',
                dot: false,
              },
            ].map(({ id, Icon, label, dot }) => {
              const isActive = salonOwnerSection === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setActiveTab('Salon Owner Dashboard');
                    setSalonOwnerSection(id);
                  }}
                  className={`relative flex min-h-[48px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1.5 py-2 text-[10px] font-mono font-bold transition ${
                    isActive
                      ? 'text-[#06B6D4] bg-[#21262D]'
                      : 'text-[#8B949E] hover:text-[#F0F6FC]'
                  }`}
                >
                  <div className="relative">
                    <Icon className="size-4" />
                    {dot && (
                      <span className="absolute -right-1.5 -top-1 size-2 rounded-full bg-[#3FB950]" />
                    )}
                  </div>
                  <span className="truncate max-w-full">{label}</span>
                </button>
              );
            })}
          </>
        ) : (
          mobileNavItems.map(([name, Icon, label]) => {
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
          })
        )}
      </nav>

      {/* Global / Country Broadcast Pause Alert */}
      {(isGlobalPaused || activePausedCountryList.length > 0) && (
        <div className="fixed inset-x-4 bottom-20 z-50 rounded-xl border border-[#9E6A03] bg-[#3B2E0B] p-3 text-xs font-mono font-bold text-[#D29922] backdrop-blur-md lg:bottom-4 lg:left-auto lg:right-4 lg:w-80">
          {isGlobalPaused
            ? '⚠️ Global pause is active. New broadcasts across all countries are safely held.'
            : `⚠️ Paused for ${activePausedCountryList.map((c) => `${c.flag} ${c.label}`).join(', ')}. Remaining countries continue running normally.`}
        </div>
      )}

      {/* Detail Bottom Sheet */}
      <DetailSheet
        detail={detailSheet}
        onClose={() => setDetailSheet(null)}
        go={handleTabChange}
        usageMeter={usageMeter}
        onOpenVoiceTicker={() => handleTabChange('Voice')}
        onOpenReportModal={() => setIsReportModalOpen(true)}
      />

      {/* Modals */}
      <FinancialReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        usageMeter={usageMeter}
        unreadVoiceCount={unreadVoiceCount}
        kamranCashHeld={kamranCashHeld}
      />

      <PaymentRoutingModal
        method={paymentRoutingMethod}
        onClose={() => setPaymentRoutingMethod(null)}
        onSave={() => setPaymentRoutingMethod(null)}
      />

      <NotificationsDrawer
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        onOpenVoiceTicker={() => handleTabChange('Voice')}
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

            <div className="mx-auto grid size-52 place-items-center rounded-2xl bg-white p-3 text-[#0D1117] border border-[#30363D]">
              {pairingModalQr.qrDataUrl ? (
                <img
                  src={pairingModalQr.qrDataUrl}
                  alt="WorkCraft WhatsApp Pairing QR"
                  className="w-full h-full object-contain rounded-lg"
                />
              ) : (
                <div className="text-center font-mono text-xs text-slate-700 p-4">
                  Generating Live QR...
                </div>
              )}
            </div>

            <div className="space-y-1 font-mono">
              <p className="text-xs font-bold text-[#F0F6FC]">
                Scan via WhatsApp ➔ Linked Devices ➔ Link a Device
              </p>
              <p className="text-[11px] text-cyan-400 break-all [overflow-wrap:break-word]">
                Alternative Alphanumeric Key: <strong className="break-all">{pairingModalQr.pairingKey}</strong>
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
