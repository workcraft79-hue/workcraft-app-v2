import React, { useState } from 'react';
import {
  Archive,
  CreditCard,
  Search,
  Eye,
  CheckCircle2,
  ShieldCheck,
  X,
  Smartphone,
  Copy,
  Check,
  ExternalLink,
  Share2,
  Megaphone,
  Globe,
  Sparkles,
  ArrowRight,
  Scissors,
  Send,
  UsersRound,
} from 'lucide-react';
import { TabName } from '../types/workcraft';
import { SALONS, ARCHIVED_SALONS } from '../data/portalData';
import { PortalCard } from './PortalCard';

interface TabsSectionProps {
  active: TabName;
  go: (tab: TabName) => void;
  setPaymentRouting: (method: string) => void;
  onInspectSalon?: (salonName: string) => void;
  onLaunchFounderPreview?: (mode: 'AGENT' | 'SALON_ONBOARD' | 'SALON_LIVE') => void;
  onTestSocialLaunch?: (source: 'Facebook' | 'Instagram' | 'TikTok' | 'WhatsApp') => void;
}

export const TabsSection: React.FC<TabsSectionProps> = ({
  active,
  go,
  setPaymentRouting,
  onInspectSalon,
  onLaunchFounderPreview,
  onTestSocialLaunch,
}) => {
  // Contact search state (Query 3)
  const [clientSearch, setClientSearch] = useState('');

  // Founder alert report phone state (Query 4)
  const [founderAlertPhone, setFounderAlertPhone] = useState('+92 321 0000000');
  const [savedPhoneToast, setSavedPhoneToast] = useState(false);

  // Founder Social Campaign Link Copy & Custom Generator State
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [customCampaignName, setCustomCampaignName] = useState('dha_salons_promo');
  const [customCampaignCategory, setCustomCampaignCategory] = useState<'ALL' | 'MENS' | 'LADIES'>('ALL');
  const [customCampaignLanguage, setCustomCampaignLanguage] = useState<'URDU' | 'ARABIC' | 'ROMAN_URDU' | 'ENGLISH'>('URDU');
  const [marketingToast, setMarketingToast] = useState<string | null>(null);

  // Query 5: Founder Broadcast to All Already-Registered Salons (Feature / Service Announcements)
  const [broadcastRegionFilter, setBroadcastRegionFilter] = useState<'ALL' | 'PK' | 'MENA' | 'EU'>('ALL');
  const [broadcastTierFilter, setBroadcastTierFilter] = useState<'ALL' | 'STARTER' | 'GROWTH' | 'VIP' | 'CUSTOM'>('ALL');
  const [broadcastTitle, setBroadcastTitle] = useState('New Feature Live: Instant Self Re-Login & Updated Voice Concierge');
  const [broadcastMessageEn, setBroadcastMessageEn] = useState(
    'New WorkCraft update is live! Your salon can now manage multiple barbers, send VIP deal alerts, and sign back in anytime using your WhatsApp number with 1-tap OTP.'
  );
  const [broadcastDispatchedReceipt, setBroadcastDispatchedReceipt] = useState<{
    count: number;
    regionLabel: string;
    tierLabel: string;
    time: string;
  } | null>(null);

  const handleCopyLink = (id: string, url: string, label: string) => {
    try {
      navigator.clipboard.writeText(url);
    } catch {
      // fallback
    }
    setCopiedLinkId(id);
    setMarketingToast(`✓ Copied ${label} Campaign Link to clipboard!`);
    setTimeout(() => setCopiedLinkId(null), 3000);
    setTimeout(() => setMarketingToast(null), 5000);
  };

  // Selected Salon for Deep Dive Dossier
  const [selectedSalonDetail, setSelectedSalonDetail] = useState<{
    name: string;
    owner: string;
    phone: string;
    location: string;
    gps: string;
    startDate: string;
    monthsActive: number;
    monthsPaid: number;
    totalRevenue: number;
    setupFee: number;
    monthlyFee: number;
    history: { month: string; amount: number; method: string; txn: string; status: string }[];
  } | null>(null);

  const [reactivationSuccessMsg, setReactivationSuccessMsg] = useState<string | null>(null);

  const handleOpenSalonDossier = (salonName: string) => {
    if (salonName === 'Seven Cuts Salon') {
      setSelectedSalonDetail({
        name: 'Seven Cuts Salon',
        owner: 'Hamza Tariq',
        phone: '+92 300 4567890',
        location: 'Sector C, CCA Phase 5 DHA, Lahore',
        gps: '31.4705° N, 74.4109° E',
        startDate: '12 May 2026',
        monthsActive: 6,
        monthsPaid: 6,
        totalRevenue: 24000,
        setupFee: 15000,
        monthlyFee: 1500, // 10% Starter maintenance
        history: [
          { month: 'October 2026', amount: 1500, method: 'EasyPaisa Auto-Webhook', txn: 'EP-95412', status: 'Settled & Verified' },
          { month: 'September 2026', amount: 1500, method: 'EasyPaisa Auto-Webhook', txn: 'EP-92338', status: 'Settled & Verified' },
          { month: 'August 2026', amount: 1500, method: 'EasyPaisa Auto-Webhook', txn: 'EP-90114', status: 'Settled & Verified' },
          { month: 'July 2026', amount: 1500, method: 'Direct IBFT Meezan Bank', txn: 'MB-41002', status: 'Settled & Verified' },
          { month: 'June 2026', amount: 1500, method: 'JazzCash Direct Wallet', txn: 'JC-99201', status: 'Settled & Verified' },
          { month: 'May 2026', amount: 16500, method: 'EasyPaisa (Setup + May Maint)', txn: 'EP-88219', status: 'Settled & Verified' },
        ],
      });
    } else {
      setSelectedSalonDetail({
        name: salonName,
        owner: 'Registered Owner',
        phone: '+92 300 1234567',
        location: 'Lahore / Karachi Metro',
        gps: '31.5204° N, 74.3587° E',
        startDate: '18 June 2026',
        monthsActive: 5,
        monthsPaid: 5,
        totalRevenue: 22500,
        setupFee: 15000,
        monthlyFee: 1500, // 10% maintenance
        history: [
          { month: 'October 2026', amount: 1500, method: 'EasyPaisa', txn: 'EP-77412', status: 'Settled' },
          { month: 'September 2026', amount: 1500, method: 'JazzCash', txn: 'JC-66338', status: 'Settled' },
          { month: 'August 2026', amount: 1500, method: 'Bank IBFT', txn: 'BK-55114', status: 'Settled' },
          { month: 'July 2026', amount: 1500, method: 'EasyPaisa', txn: 'EP-44002', status: 'Settled' },
          { month: 'June 2026', amount: 16500, method: 'EasyPaisa (Setup + June)', txn: 'EP-33219', status: 'Settled' },
        ],
      });
    }
  };

  const handleSimulateAutoReactivation = () => {
    setReactivationSuccessMsg(
      'Payment of PKR 1,500 detected via EasyPaisa webhook! Metric box reactivated instantly · Continuous Care SLA active (<60 min recovery) · WhatsApp dispatch: "Assalamu Alaikum! We have received your 10% maintenance payment. Your Workcraft metric box and automated booking services are fully active."'
    );
    setTimeout(() => setReactivationSuccessMsg(null), 6000);
  };

  const getTitle = () => {
    switch (active) {
      case 'Marketing':
        return 'Social campaign routing & 1-tap onboarding links';
      case 'Contact / Clients':
        return 'Client directory & archive';
      case 'Revenue':
        return 'Automated maintenance payments & financial ledger';
      case 'Pairing':
        return 'Live salon pairing handshake';
      case 'Flow Builder':
        return 'Tri-lingual routing state machine';
      case 'Settings':
        return 'System settings & runtime config';
      default:
        return active;
    }
  };

  return (
    <PortalCard title={getTitle()} kicker="WORKCRAFT LOCAL" onClose={() => go('Overview')}>
      <div className="flex flex-col gap-5 pb-28 lg:pb-8 min-w-0 text-sm text-[#F0F6FC]">
        {/* 1. Contact / Clients Tab */}
        {active === 'Contact / Clients' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-[#30363D] bg-[#0D1117] p-4">
              <div className="flex items-center gap-3 min-w-0">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#21262D] border border-[#30363D] text-[#D29922]">
                  <Archive className="size-5" />
                </span>
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-[#F0F6FC]">Active Salon Partners</h4>
                  <p className="text-[11px] font-mono text-[#8B949E]">
                    Click any salon (e.g. Seven Cuts Salon) to view start date, months paid, lifetime revenue, and auto-reactivation.
                  </p>
                </div>
              </div>
              <span className="rounded-md bg-[#0D3822] border border-[#116329] px-2.5 py-1 text-xs font-mono font-bold text-[#3FB950] shrink-0">
                {SALONS.length} LIVE
              </span>
            </div>

            {/* Search Bar across all active salons (Query 3) */}
            <div className="relative">
              <Search className="size-4 text-[#8B949E] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                placeholder="Search salon name, owner, or city..."
                className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] pl-10 pr-4 py-2.5 text-sm font-mono text-[#F0F6FC] placeholder:text-[#484F58] focus:border-[#06B6D4] focus:outline-none"
              />
            </div>

            {/* Client Rows / Salon Cards */}
            <div className="space-y-2.5">
              {SALONS.filter(
                (s) =>
                  !clientSearch.trim() ||
                  s.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
                  s.owner.toLowerCase().includes(clientSearch.toLowerCase()) ||
                  s.location.toLowerCase().includes(clientSearch.toLowerCase())
              ).map((salon, idx) => (
                <div
                  key={salon.name}
                  className="w-full text-left rounded-xl border border-[#30363D] bg-[#0D1117] p-4 transition-colors hover:border-[#484F58] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#21262D] border border-[#30363D] text-xs font-mono font-bold text-[#D29922]">
                      {salon.initials}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-[#D29922] shrink-0">
                          #{String(idx + 1).padStart(2, '0')}
                        </span>
                        <span className="font-mono text-xs font-bold text-[#06B6D4] shrink-0">
                          [WC-{101 + idx}]
                        </span>
                        <h5 className="text-base font-semibold text-[#F0F6FC] tracking-tight break-words [overflow-wrap:break-word]">
                          {salon.name}
                        </h5>
                      </div>
                      <p className="mt-0.5 text-xs font-mono text-[#8B949E]">
                        Owner: {salon.owner} · {salon.location} · {salon.plan}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 self-end sm:self-center">
                    <span
                      className={`font-mono text-xs px-2.5 py-1 rounded-md border ${
                        salon.status === 'Paid'
                          ? 'bg-[#0D3822] text-[#3FB950] border-[#116329]'
                          : 'bg-[#3B2E0B] text-[#D29922] border-[#9E6A03]'
                      }`}
                    >
                      {salon.status === 'Paid' ? 'Paid ✓' : 'Due After 5th'}
                    </span>
                    <button
                      type="button"
                      onClick={() => (onInspectSalon ? onInspectSalon(salon.name) : go('Salon Owner Dashboard'))}
                      className="min-h-[44px] inline-flex items-center gap-1.5 rounded-lg border border-[#30363D] bg-[#21262D] hover:border-[#06B6D4] px-3 py-1.5 text-xs font-mono font-bold text-[#D29922] transition"
                    >
                      <Eye className="size-3.5" />
                      <span>Inspect Salon</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenSalonDossier(salon.name)}
                      className="min-h-[44px] rounded-lg border border-[#30363D] bg-[#21262D] hover:border-[#06B6D4] px-3 py-1.5 text-xs font-mono font-bold text-[#06B6D4] transition"
                    >
                      Billing &amp; Receipts →
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* DEEP-DIVE SALON OWNER DOSSIER MODAL */}
            {selectedSalonDetail && (
              <div
                className="fixed inset-0 z-[80] grid place-items-center bg-[#0D1117]/80 p-4 backdrop-blur-md"
                onClick={() => setSelectedSalonDetail(null)}
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="w-full max-w-2xl rounded-3xl border border-[#30363D] bg-[#161B22] p-5 sm:p-6 shadow-2xl animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto space-y-5"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between border-b border-[#21262D] pb-4 gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-[#06B6D4]">[WC-101]</span>
                        <h3 className="text-xl font-bold text-[#F0F6FC]">{selectedSalonDetail.name}</h3>
                        <span className="rounded-md bg-[#0D3822] border border-[#116329] px-2 py-0.5 text-[9px] font-mono font-bold text-[#3FB950]">
                          VERIFIED PARTNER
                        </span>
                      </div>
                      <p className="text-xs font-mono text-[#8B949E] mt-1">
                        Owner: {selectedSalonDetail.owner} · WhatsApp: {selectedSalonDetail.phone}
                      </p>
                      <p className="text-[11px] font-mono text-[#6E7681] mt-0.5">
                        Location: {selectedSalonDetail.location} ({selectedSalonDetail.gps})
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSalonDetail(null);
                      }}
                      className="min-h-[44px] min-w-[44px] grid place-items-center rounded-xl bg-[#21262D] border border-[#30363D] text-[#8B949E] hover:text-[#F0F6FC] hover:border-[#484F58] transition active:scale-95 shrink-0"
                      title="Close Dossier Modal"
                      aria-label="Close Dossier Modal"
                    >
                      <X className="size-4" />
                    </button>
                  </div>

                  {/* Feedback Banner */}
                  {reactivationSuccessMsg && (
                    <div className="rounded-xl border border-[#116329] bg-[#0D3822] p-3 text-xs font-mono text-[#3FB950] space-y-1 animate-in fade-in overflow-hidden">
                      <p className="font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="size-4 text-[#3FB950] shrink-0" />
                        <span>System Auto-Reactivation Triggered</span>
                      </p>
                      <p className="text-[11px] text-[#F0F6FC] font-sans leading-relaxed break-words [overflow-wrap:break-word]">
                        {reactivationSuccessMsg}
                      </p>
                    </div>
                  )}

                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs">
                    <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3">
                      <span className="text-[10px] text-[#8B949E] uppercase block">Services Started</span>
                      <span className="text-xs font-bold text-[#F0F6FC] mt-0.5 block truncate">
                        {selectedSalonDetail.startDate}
                      </span>
                      <span className="text-[9px] text-[#06B6D4]">{selectedSalonDetail.monthsActive} Months Active</span>
                    </div>

                    <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3">
                      <span className="text-[10px] text-[#8B949E] uppercase block">Months Paid</span>
                      <span className="text-base font-bold text-[#3FB950] mt-0.5 block">
                        {selectedSalonDetail.monthsPaid} / {selectedSalonDetail.monthsActive} Paid
                      </span>
                      <span className="text-[9px] text-[#3FB950]">100% On-Time Record</span>
                    </div>

                    <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3">
                      <span className="text-[10px] text-[#8B949E] uppercase block">Lifetime Revenue</span>
                      <span className="text-base font-bold text-[#D29922] mt-0.5 block">
                        PKR {selectedSalonDetail.totalRevenue.toLocaleString()}
                      </span>
                      <span className="text-[9px] text-[#6E7681]">Setup + Recurring</span>
                    </div>

                    <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3">
                      <span className="text-[10px] text-[#8B949E] uppercase block">Monthly Tier</span>
                      <span className="text-xs font-bold text-[#F0F6FC] mt-0.5 block">
                        PKR {selectedSalonDetail.monthlyFee.toLocaleString()} / mo
                      </span>
                      <span className="text-[9px] text-[#06B6D4]">Self-Paid Direct</span>
                    </div>
                  </div>

                  {/* 6-Month Operational & Revenue Review Status (Promo on hold as decided) */}
                  <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-mono font-bold text-[#8B949E] flex items-center gap-1.5 uppercase tracking-wider">
                        6-Month Operational &amp; Revenue Audit Status
                      </span>
                      <span className="text-[10px] font-mono text-[#3FB950] font-bold bg-[#0D3822] px-2 py-0.5 rounded border border-[#116329] shrink-0">
                        100% COMPLIANT
                      </span>
                    </div>
                    <p className="text-xs text-[#F0F6FC] font-sans leading-relaxed">
                      <strong>{selectedSalonDetail.name}</strong> has maintained continuous on-time payments across {selectedSalonDetail.monthsPaid} active billing cycles. Total revenue generated to date: <strong className="text-[#D29922] font-mono">PKR {selectedSalonDetail.totalRevenue.toLocaleString()}</strong>.
                    </p>
                    <p className="text-[11px] text-[#6E7681] font-mono">
                      * Operational Policy: Promotional deals and marketing bonus programs are on hold. The founder will review aggregate 6-month revenue performance before deciding on promo launches.
                    </p>
                  </div>

                  {/* Disconnected Salon & Instant Auto-Reactivation Flow with Native Dialect Support */}
                  <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-4 space-y-3 font-mono">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[#06B6D4] uppercase">
                        Autonomous Payment Detection &amp; Native Welcome Dispatch
                      </span>
                      <span className="text-[9px] text-[#3FB950] shrink-0">TOUCHLESS ENGINE</span>
                    </div>
                    <p className="text-xs text-[#8B949E] font-sans leading-relaxed">
                      If the salon owner is remote (or in MENA / abroad) and maintenance charges were disconnected post-5th:
                      <br />
                      <strong className="text-[#F0F6FC]">No agent physical visit is required.</strong> As soon as the owner pays via EasyPaisa, JazzCash, IBFT, or Stripe/Tap, the system automatically detects the payment, clears the analytics lock, activates the metric box, and pushes the welcome-back message in the owner&apos;s preferred dialect starting with <em>“Assalam o alaikum”</em>:
                    </p>

                    <div className="rounded-lg bg-[#161B22] border border-[#30363D] p-3 text-[11px] font-mono text-[#3FB950] space-y-1 overflow-hidden">
                      <p className="text-[#6E7681] text-[10px] uppercase font-bold">Auto-Generated Native WhatsApp Template (Strict Greeting Rule):</p>
                      <p className="italic font-sans break-words [overflow-wrap:break-word]">
                        “Assalamu Alaikum {selectedSalonDetail.owner}! Aap ki 10% maintenance payment PKR {selectedSalonDetail.monthlyFee.toLocaleString()} receive ho gayi hai. Continuous Care SLA (&lt;60 min recovery) active hai aur booking lines dubara open ho chuki hain. Aap ka metric box ab live hai.”
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleSimulateAutoReactivation}
                      className="w-full min-h-[48px] flex items-center justify-center gap-2 rounded-xl bg-[#06B6D4] hover:bg-[#22D3EE] text-[#0D1117] px-4 py-2.5 text-xs font-mono font-bold uppercase transition active:scale-95"
                    >
                      <span>Simulate Auto-Detection &amp; Metric Box Reactivation</span>
                    </button>
                  </div>

                  {/* Complete Month-by-Month Financial Ledger */}
                  <div className="space-y-2 font-mono">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#8B949E] font-bold uppercase tracking-wider">
                        Payment History Ledger ({selectedSalonDetail.history.length} Months)
                      </span>
                      <span className="text-[#D29922] font-bold">
                        Total Settled: PKR {selectedSalonDetail.totalRevenue.toLocaleString()}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      {selectedSalonDetail.history.map((h, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between rounded-lg border border-[#30363D] bg-[#0D1117] p-2.5"
                        >
                          <div className="min-w-0">
                            <span className="text-[#F0F6FC] font-bold">{h.month}</span>
                            <span className="text-[#8B949E] text-[11px] block break-all [overflow-wrap:break-word]">
                              {h.method} · Ref: {h.txn}
                            </span>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-[#D29922] font-bold block">
                              PKR {h.amount.toLocaleString()}
                            </span>
                            <span className="text-[#3FB950] text-[10px]">{h.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Archived Salon Profiles Container */}
            <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-4 mt-6">
              <div className="flex items-center justify-between border-b border-[#21262D] pb-3">
                <p className="text-xs font-mono font-bold text-[#F0F6FC] uppercase tracking-wider">
                  Archived / Restorable Profiles (12 Profiles)
                </p>
                <span className="text-[10px] font-mono text-[#6E7681]">
                  Historical templates preserved
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 mt-3">
                {ARCHIVED_SALONS.slice(0, 4).map((arch) => (
                  <div
                    key={arch.name}
                    className="flex items-center justify-between rounded-lg border border-[#30363D] bg-[#161B22] p-3"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#F0F6FC] truncate">{arch.name}</p>
                      <p className="text-[10px] font-mono text-[#8B949E] truncate">
                        {arch.owner} · {arch.plan}
                      </p>
                    </div>
                    <button
                      onClick={() => go('Pairing')}
                      className="min-h-[36px] px-2 text-[10px] font-mono font-bold text-[#06B6D4] hover:underline shrink-0"
                    >
                      Reactivate
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 2. Revenue Tab */}
        {active === 'Revenue' && (
          <div className="space-y-6">
            {/* Top Financial Stat Highlights */}
            <div className="grid gap-3.5 sm:grid-cols-3">
              <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-4">
                <p className="text-xs font-mono uppercase tracking-wider text-[#8B949E]">
                  Total Verified MRR
                </p>
                <p className="mt-2 text-2xl font-bold font-mono text-[#D29922]">
                  PKR 108,000
                </p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[10px] font-mono text-[#8B949E]">24 of 27 Paid</span>
                  <span className="rounded bg-[#0D3822] px-2 py-0.5 text-[10px] font-mono text-[#3FB950] border border-[#116329]">
                    Verified
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-4">
                <p className="text-xs font-mono uppercase tracking-wider text-[#8B949E]">
                  In-Hand Cash Held (Kamran)
                </p>
                <p className="mt-2 text-2xl font-bold font-mono text-[#D29922]">
                  PKR 25,000
                </p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[10px] font-mono text-[#8B949E]">Target: 48h Handover</span>
                  <span className="rounded bg-[#3B2E0B] px-2 py-0.5 text-[10px] font-mono text-[#D29922] border border-[#9E6A03]">
                    Liability
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-4">
                <p className="text-xs font-mono uppercase tracking-wider text-[#8B949E]">
                  Server &amp; WhatsApp Rent
                </p>
                <p className="mt-2 text-2xl font-bold font-mono text-[#3FB950]">
                  $0.00 / mo
                </p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[10px] font-mono text-[#8B949E]">Self-Hosted Android SIM</span>
                  <span className="rounded bg-[#0D3822] px-2 py-0.5 text-[10px] font-mono text-[#3FB950] border border-[#116329]">
                    Active
                  </span>
                </div>
              </div>
            </div>

            {/* Channel Collection Breakdown (Bank Account Primary + Local Wallets + Overseas) */}
            <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#21262D] pb-2.5">
                <div>
                  <h4 className="text-xs font-mono font-bold text-[#D29922] uppercase tracking-wider">
                    Revenue Collection Breakdown by Channel
                  </h4>
                  <p className="text-[11px] text-[#8B949E] font-sans mt-0.5">
                    Overseas package purchases &amp; 10% monthly maintenance settle automatically into the local Pakistan bank account alongside local IBFT/Raast transfers.
                  </p>
                </div>
                <span className="rounded bg-[#0D3822] border border-[#116329] px-2.5 py-1 text-[10px] font-mono font-bold text-[#3FB950] shrink-0">
                  PKR 108,000 VERIFIED
                </span>
              </div>

              <div className="grid gap-2.5 sm:grid-cols-2 font-mono text-xs">
                <div className="rounded-xl border border-[#06B6D4]/50 bg-[#161B22] p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#F0F6FC] font-bold">1. Official Bank Account (IBFT / Raast / Overseas)</span>
                    <span className="rounded bg-[#06B6D4]/15 border border-[#06B6D4]/40 px-2 py-0.5 text-[10px] font-bold text-cyan-400 shrink-0">
                      48.1% · PRIMARY
                    </span>
                  </div>
                  <p className="text-lg font-black text-[#D29922]">PKR 52,000</p>
                  <p className="text-[11px] text-[#8B949E] font-sans">
                    11 salons · Local Bank IBFT (PKR 24,000) + Overseas Package &amp; 10% Maint Auto-Deposits (PKR 28,000)
                  </p>
                </div>

                <div className="rounded-xl border border-[#30363D] bg-[#161B22] p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#F0F6FC] font-bold">2. EasyPaisa (Local Pakistan)</span>
                    <span className="rounded bg-[#21262D] border border-[#30363D] px-2 py-0.5 text-[10px] font-bold text-[#3FB950] shrink-0">
                      24.1%
                    </span>
                  </div>
                  <p className="text-lg font-black text-[#D29922]">PKR 26,000</p>
                  <p className="text-[11px] text-[#8B949E] font-sans">
                    6 local salons · Instant SMS webhook auto-match
                  </p>
                </div>

                <div className="rounded-xl border border-[#30363D] bg-[#161B22] p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#F0F6FC] font-bold">3. JazzCash (Local Pakistan)</span>
                    <span className="rounded bg-[#21262D] border border-[#30363D] px-2 py-0.5 text-[10px] font-bold text-[#3FB950] shrink-0">
                      13.0%
                    </span>
                  </div>
                  <p className="text-lg font-black text-[#D29922]">PKR 14,000</p>
                  <p className="text-[11px] text-[#8B949E] font-sans">
                    4 local salons · Local wallet SMS regex verification
                  </p>
                </div>

                <div className="rounded-xl border border-[#30363D] bg-[#161B22] p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#F0F6FC] font-bold">4. Stripe Connect (Overseas 20/80 Split)</span>
                    <span className="rounded bg-[#3B2E0B] border border-[#9E6A03] px-2 py-0.5 text-[10px] font-bold text-[#D29922] shrink-0">
                      14.8%
                    </span>
                  </div>
                  <p className="text-lg font-black text-[#D29922]">PKR 16,000</p>
                  <p className="text-[11px] text-[#8B949E] font-sans">
                    3 overseas salons · 80% net settled into local WorkCraft bank account
                  </p>
                </div>
              </div>
            </div>

            {/* Payment Verification Gateways */}
            <div className="space-y-3">
              <h4 className="text-xs font-mono font-bold text-[#D29922] uppercase tracking-wider">
                Automated Webhook Channels &amp; Reconciliation
              </h4>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  {
                    name: 'Bank Account (IBFT / Raast / Overseas Wire)',
                    desc: 'Primary settlement hub: receives local Pakistan IBFT/Raast transfers plus automatic deposits from overseas package & 10% maintenance payments.',
                    status: 'Primary Rail',
                  },
                  {
                    name: 'EasyPaisa Webhook',
                    desc: 'Local Pakistan wallet: auto-unlocks salon analytics instantly upon incoming SMS payload matching tenant ID.',
                    status: 'Webhook Ready',
                  },
                  {
                    name: 'JazzCash Webhook',
                    desc: 'Local Pakistan wallet: transaction regex string parser with fallback to instant founder verification.',
                    status: 'Webhook Ready',
                  },
                  {
                    name: 'Stripe Connect (Overseas 20/80 Split)',
                    desc: 'Same-currency direct split outside Pakistan: 20% paid straight to Agent in deal currency, 80% routed directly into WorkCraft local bank account.',
                    status: 'Direct Split',
                  },
                ].map((item) => (
                  <button
                    key={item.name}
                    onClick={() => setPaymentRouting(item.name)}
                    className="min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] p-4 text-left transition hover:border-[#06B6D4] group"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <CreditCard className="size-5 text-[#D29922] group-hover:scale-105 transition-transform shrink-0" />
                      <span className="rounded bg-[#21262D] px-2 py-0.5 text-[10px] font-mono text-[#F0F6FC] border border-[#30363D] shrink-0">
                        {item.status}
                      </span>
                    </div>
                    <p className="mt-3 text-sm font-bold text-[#F0F6FC] break-words [overflow-wrap:break-word]">{item.name}</p>
                    <p className="mt-1 text-[11px] text-[#8B949E] font-sans leading-relaxed break-words [overflow-wrap:break-word]">
                      {item.desc}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 3. Pairing Tab */}
        {active === 'Pairing' && (
          <div className="space-y-4">
            <div className="mx-auto grid size-52 place-items-center rounded-2xl bg-white p-5 text-[#0D1117] border-2 border-[#06B6D4]">
              <svg viewBox="0 0 100 100" className="w-full h-full text-slate-900">
                <rect x="5" y="5" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="3" rx="2" />
                <rect x="10" y="10" width="12" height="12" fill="currentColor" rx="1" />
                <rect x="73" y="5" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="3" rx="2" />
                <rect x="78" y="10" width="12" height="12" fill="currentColor" rx="1" />
                <rect x="5" y="73" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="3" rx="2" />
                <rect x="10" y="78" width="12" height="12" fill="currentColor" rx="1" />
                <circle cx="34" cy="12" r="2.5" fill="currentColor" />
                <circle cx="50" cy="12" r="2.5" fill="currentColor" />
                <circle cx="66" cy="12" r="2.5" fill="currentColor" />
                <circle cx="12" cy="34" r="2.5" fill="currentColor" />
                <circle cx="12" cy="50" r="2.5" fill="currentColor" />
                <circle cx="12" cy="66" r="2.5" fill="currentColor" />
                <rect x="42" y="42" width="16" height="16" fill="#D29922" rx="2" />
              </svg>
            </div>

            <div className="text-center space-y-1">
              <p className="text-xs font-mono font-bold text-[#F0F6FC]">
                Scan with WhatsApp on Salon Terminal
              </p>
              <p className="text-[11px] font-mono text-[#3FB950]">
                Active Alphanumeric Pairing Key: <span className="text-[#06B6D4] font-bold">WC-7892-SYS</span>
              </p>
            </div>

            <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3 text-xs text-[#8B949E] text-center space-y-1 font-mono">
              <p className="text-[#F0F6FC] font-bold">WhatsApp Device Link Ready</p>
              <p className="text-[10px] text-[#06B6D4]">Central SIM Protection Active · Instant Connection</p>
            </div>
          </div>
        )}

        {/* 3B. Founder Marketing: Broadcast to Registered Salons + New Salon Ad Links */}
        {active === 'Marketing' && (
          <div className="space-y-6">
            {/* Real-time Toast Feedback */}
            {marketingToast && (
              <div className="rounded-xl border border-[#116329] bg-[#0D3822] p-3 text-xs font-mono text-[#3FB950] animate-in fade-in flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-4 shrink-0" />
                  <span>{marketingToast}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setMarketingToast(null)}
                  className="text-[#8B949E] hover:text-[#F0F6FC]"
                >
                  ✕
                </button>
              </div>
            )}

            {/* ========================================================================= */}
            {/* PART 1 (QUERY 5): FOUNDER BROADCAST TO ALL REGISTERED SALONS               */}
            {/* ========================================================================= */}
            <div className="rounded-2xl border border-[#D29922]/50 bg-[#161B22] p-4 sm:p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#21262D] pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-[#9E6A03] bg-[#3B2E0B] text-[#D29922]">
                    <UsersRound className="size-4" />
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-mono font-black uppercase tracking-wider text-[#F0F6FC]">
                        Founder Broadcast to Registered Salons
                      </h3>
                      <span className="rounded-md bg-[#0D3822] border border-[#116329] px-2 py-0.5 text-[10px] font-mono font-bold text-[#3FB950]">
                        EXISTING CLIENTS ONLY
                      </span>
                    </div>
                    <p className="text-xs text-[#8B949E] font-sans mt-0.5">
                      Announce new WorkCraft features, services, or important notices directly to all active registered salons via WhatsApp in each salon&apos;s saved language.
                    </p>
                  </div>
                </div>
              </div>

              {/* Audience Filters */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="text-xs font-mono text-[#8B949E] block space-y-1">
                  <span>TARGET REGION / COUNTRY</span>
                  <select
                    value={broadcastRegionFilter}
                    onChange={(e) => {
                      setBroadcastRegionFilter(e.target.value as any);
                      setBroadcastDispatchedReceipt(null);
                    }}
                    className="w-full min-h-[44px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3 py-2 text-xs font-mono text-[#F0F6FC] focus:outline-none focus:border-[#D29922]"
                  >
                    <option value="ALL">All Registered Countries (24 Active Salons)</option>
                    <option value="PK">🇵🇰 Pakistan Salons Only (15 Salons · Urdu / English)</option>
                    <option value="MENA">🇦🇪 UAE &amp; Gulf (MENA) Salons (6 Salons · Arabic / Urdu)</option>
                    <option value="EU">🇬🇧 UK &amp; International Salons (3 Salons · English)</option>
                  </select>
                </label>

                <label className="text-xs font-mono text-[#8B949E] block space-y-1">
                  <span>PACKAGE TIER TARGET</span>
                  <select
                    value={broadcastTierFilter}
                    onChange={(e) => {
                      setBroadcastTierFilter(e.target.value as any);
                      setBroadcastDispatchedReceipt(null);
                    }}
                    className="w-full min-h-[44px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3 py-2 text-xs font-mono text-[#F0F6FC] focus:outline-none focus:border-[#D29922]"
                  >
                    <option value="ALL">All Package Tiers</option>
                    <option value="STARTER">Starter Setup Salons</option>
                    <option value="GROWTH">Growth Automation Salons</option>
                    <option value="VIP">VIP Executive Salons</option>
                    <option value="CUSTOM">Custom Enterprise Salons</option>
                  </select>
                </label>
              </div>

              {/* Quick Feature / Service Update Templates */}
              <div className="flex flex-wrap gap-2">
                {[
                  {
                    label: 'New Feature Launch',
                    title: 'New Feature Live: Instant Self Re-Login & Updated Voice Concierge',
                    msg: 'New WorkCraft update is live! Your salon can now manage multiple barbers, send VIP deal alerts, and sign back in anytime using your WhatsApp number with 1-tap OTP.',
                  },
                  {
                    label: 'New Service Category',
                    title: 'New Service Menu Templates Added',
                    msg: 'We just added new service presets to your Live Salon Dashboard. Open Settings ➔ Rates to enable new grooming & styling packages in 1 tap.',
                  },
                  {
                    label: 'Upgrade Promo Notice',
                    title: 'Zero-Loss Tier Upgrade Reminder',
                    msg: 'Upgrade your WorkCraft plan anytime directly from your Live Dashboard by paying only the remaining package difference—zero double charge.',
                  },
                ].map((tpl) => (
                  <button
                    key={tpl.label}
                    type="button"
                    onClick={() => {
                      setBroadcastTitle(tpl.title);
                      setBroadcastMessageEn(tpl.msg);
                      setBroadcastDispatchedReceipt(null);
                    }}
                    className="min-h-[34px] rounded-lg border border-[#30363D] bg-[#0D1117] hover:border-[#D29922] px-3 py-1 text-[11px] font-mono font-bold text-[#D29922] transition"
                  >
                    Use: {tpl.label}
                  </button>
                ))}
              </div>

              <div className="space-y-2.5">
                <input
                  type="text"
                  value={broadcastTitle}
                  onChange={(e) => setBroadcastTitle(e.target.value)}
                  placeholder="Announcement Title..."
                  className="w-full min-h-[44px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3.5 py-2 text-xs font-mono font-bold text-[#F0F6FC] focus:outline-none focus:border-[#06B6D4]"
                />
                <textarea
                  value={broadcastMessageEn}
                  onChange={(e) => setBroadcastMessageEn(e.target.value)}
                  rows={3}
                  placeholder="Write your announcement once—WorkCraft delivers it to each salon in their saved onboarding language (Urdu, Arabic, or English)..."
                  className="w-full rounded-xl border border-[#30363D] bg-[#0D1117] px-3.5 py-2.5 text-xs font-sans text-[#F0F6FC] focus:outline-none focus:border-[#06B6D4]"
                />
              </div>

              {/* Automatic Per-Language Dispatch Preview */}
              <div className="grid gap-2.5 md:grid-cols-3 text-[11px]">
                <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3 space-y-1">
                  <span className="text-[10px] font-mono font-bold text-[#3FB950]">🇵🇰 Urdu Salons Preview</span>
                  <p dir="rtl" className="text-right text-[#F0F6FC] font-sans leading-relaxed">
                    WorkCraft نیا فیچر اپڈیٹ: {broadcastTitle} — تفصیلات آپ کے لائیو ڈیش بورڈ میں دستیاب ہیں۔
                  </p>
                </div>
                <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3 space-y-1">
                  <span className="text-[10px] font-mono font-bold text-[#06B6D4]">🇦🇪 Arabic Salons Preview</span>
                  <p dir="rtl" className="text-right text-[#F0F6FC] font-sans leading-relaxed">
                    تحديث جديد من WorkCraft: {broadcastTitle} — متاح الآن في لوحة تحكم صالونك.
                  </p>
                </div>
                <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3 space-y-1">
                  <span className="text-[10px] font-mono font-bold text-[#D29922]">🇬🇧 English Salons Preview</span>
                  <p className="text-[#F0F6FC] font-sans leading-relaxed">
                    {broadcastTitle}: {broadcastMessageEn}
                  </p>
                </div>
              </div>

              {broadcastDispatchedReceipt && (
                <div className="rounded-xl border border-[#116329] bg-[#0D3822] p-3 text-xs font-mono text-[#3FB950] flex items-center justify-between gap-2 flex-wrap">
                  <span>
                    ✓ Broadcast sent safely to <strong>{broadcastDispatchedReceipt.count} Registered Salons</strong> ({broadcastDispatchedReceipt.regionLabel} · {broadcastDispatchedReceipt.tierLabel}) at {broadcastDispatchedReceipt.time}
                  </span>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <span className="text-[11px] font-mono text-[#8B949E]">
                  Sent via Central WorkCraft Line · Zero personal Founder number exposure
                </span>
                <button
                  type="button"
                  disabled={!broadcastMessageEn.trim()}
                  onClick={() => {
                    const baseByRegion =
                      broadcastRegionFilter === 'PK'
                        ? 15
                        : broadcastRegionFilter === 'MENA'
                        ? 6
                        : broadcastRegionFilter === 'EU'
                        ? 3
                        : 24;
                    const count =
                      broadcastTierFilter === 'ALL'
                        ? baseByRegion
                        : Math.max(1, Math.round(baseByRegion / 3));
                    setBroadcastDispatchedReceipt({
                      count,
                      regionLabel:
                        broadcastRegionFilter === 'ALL'
                          ? 'All Countries'
                          : broadcastRegionFilter,
                      tierLabel:
                        broadcastTierFilter === 'ALL' ? 'All Tiers' : broadcastTierFilter,
                      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    });
                    setMarketingToast(`✓ Broadcast queued for ${count} registered salons in their saved languages!`);
                    setTimeout(() => setMarketingToast(null), 5000);
                  }}
                  className="min-h-[48px] inline-flex items-center gap-2 rounded-xl bg-[#D29922] hover:bg-[#e0b252] text-[#0D1117] px-5 py-2.5 text-xs font-mono font-black uppercase transition active:scale-95 disabled:opacity-45"
                >
                  <Send className="size-4" />
                  <span>Send Broadcast to Registered Salons →</span>
                </button>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* PART 2 (QUERIES 4 & 6): NEW SALON ACQUISITION SOCIAL CAMPAIGN LINKS        */}
            {/* ========================================================================= */}
            <div className="rounded-2xl border border-[#06B6D4]/40 bg-[#06B6D4]/10 p-4 sm:p-5 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[#06B6D4]">
                  <Megaphone className="size-5 shrink-0" />
                  <h3 className="text-sm font-mono font-black uppercase tracking-wider">
                    New Salon Acquisition · Social Ad Link Generator
                  </h3>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-[#0D1117] border border-[#06B6D4]/40 px-2.5 py-1 text-[10px] font-mono font-bold text-[#06B6D4]">
                    FOR PROSPECTIVE NEW SALONS
                  </span>
                  {onLaunchFounderPreview && (
                    <button
                      type="button"
                      onClick={() => onLaunchFounderPreview('SALON_LIVE')}
                      className="rounded-md bg-[#21262D] hover:border-[#06B6D4] border border-[#30363D] px-2.5 py-1 text-[10px] font-mono font-bold text-[#F0F6FC] transition"
                    >
                      Preview Live Salon Portal →
                    </button>
                  )}
                </div>
              </div>
              <p className="text-xs text-[#F0F6FC] font-sans leading-relaxed">
                These links are for recruiting <strong className="text-[#06B6D4]">new, unregistered salons</strong> on Facebook, Instagram, TikTok, or WhatsApp groups. When a prospective owner clicks an ad link on their phone, the app automatically opens <strong className="text-[#3FB950]">Step 1 of Salon Self-Onboarding</strong> with Founder admin screens completely hidden.
              </p>
            </div>

            {/* Pre-Built Social Campaign Cards (Facebook, Instagram, TikTok, WhatsApp Referral) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h4 className="text-xs font-mono font-bold text-[#D29922] uppercase tracking-wider">
                  Pre-Built New Salon Ad Links (Auto-Tagged)
                </h4>
                <span className="text-[10px] font-mono text-[#8B949E]">
                  Use &ldquo;Preview Signup Ad Flow&rdquo; to inspect what a new prospect sees after clicking your ad
                </span>
              </div>

              <div className="grid gap-3.5 md:grid-cols-2">
                {[
                  {
                    id: 'fb',
                    source: 'Facebook' as const,
                    name: 'Facebook Ads & Meta Stories',
                    badge: 'FACEBOOK ADS · NEW SIGNUPS',
                    badgeColor: 'border-[#1877F2]/40 bg-[#1877F2]/15 text-[#58A6FF]',
                    url: 'https://portal.workcraft.local/?onboard=true&ref=fb&utm_source=facebook&utm_medium=cpc&utm_campaign=salon_signup_q4',
                    stats: '14.8% CTR · 38 Salons Onboarded · High Conversion',
                    desc: 'Drop prospective salon owners straight into Step 1 self-onboarding from Facebook Feed or Story ads.',
                  },
                  {
                    id: 'ig',
                    source: 'Instagram' as const,
                    name: 'Instagram Reels & Bio Link',
                    badge: 'INSTAGRAM REELS · NEW SIGNUPS',
                    badgeColor: 'border-[#E1306C]/40 bg-[#E1306C]/15 text-[#FF7B72]',
                    url: 'https://portal.workcraft.local/?onboard=true&ref=ig&utm_source=instagram&utm_medium=cpc&utm_campaign=salon_signup_q4',
                    stats: '18.2% CTR · 46 Salons Onboarded · Visual Barbers',
                    desc: 'Designed for Instagram salon transformation reels and bio links. Lands prospective owners in Step 1.',
                  },
                  {
                    id: 'tiktok',
                    source: 'TikTok' as const,
                    name: 'TikTok Viral Video Campaigns',
                    badge: 'TIKTOK VIRAL · NEW SIGNUPS',
                    badgeColor: 'border-[#00F2FE]/40 bg-[#00F2FE]/15 text-cyan-300',
                    url: 'https://portal.workcraft.local/?onboard=true&ref=tiktok&utm_source=tiktok&utm_medium=cpc&utm_campaign=salon_signup_q4',
                    stats: '21.5% CTR · 52 Salons Onboarded · Gen-Z Stylists',
                    desc: 'High-speed mobile funnel for short video promos. Lands prospects straight into Step 1 on mobile.',
                  },
                  {
                    id: 'whatsapp',
                    source: 'WhatsApp' as const,
                    name: 'WhatsApp Groups & New Salon Referral',
                    badge: 'NEW SALON SIGNUP LINK',
                    badgeColor: 'border-[#25D366]/40 bg-[#25D366]/15 text-[#3FB950]',
                    url: 'https://portal.workcraft.local/?onboard=true&ref=whatsapp&utm_source=whatsapp',
                    stats: '34.0% Conversion · 1-to-1 Trusted Referral',
                    desc: 'Share in salon owner WhatsApp groups so unregistered owners can click and onboard themselves (not for broadcasting to existing clients—use Broadcast panel above).',
                  },
                ].map((item) => {
                  const isCopied = copiedLinkId === item.id;
                  return (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-[#30363D] bg-[#0D1117] p-4 flex flex-col justify-between gap-3 hover:border-[#484F58] transition group"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className={`rounded-md border px-2 py-0.5 text-[9px] font-mono font-bold ${item.badgeColor}`}>
                            {item.badge}
                          </span>
                          <span className="text-[10px] font-mono text-[#3FB950] font-bold">
                            {item.stats.split('·')[0]}
                          </span>
                        </div>

                        <h5 className="text-sm font-bold text-[#F0F6FC]">{item.name}</h5>
                        <p className="text-[11px] text-[#8B949E] font-sans leading-relaxed">
                          {item.desc}
                        </p>

                        <div className="rounded-xl border border-[#21262D] bg-[#161B22] p-2.5 font-mono text-[10px] text-[#06B6D4] break-all select-all">
                          {item.url}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#21262D]">
                        <button
                          type="button"
                          onClick={() => handleCopyLink(item.id, item.url, item.name)}
                          className={`min-h-[44px] flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-mono font-bold transition ${
                            isCopied
                              ? 'border-[#116329] bg-[#0D3822] text-[#3FB950]'
                              : 'border-[#06B6D4] bg-[#06B6D4]/15 hover:bg-[#06B6D4]/25 text-[#06B6D4]'
                          }`}
                        >
                          {isCopied ? <Check className="size-3.5 text-[#3FB950]" /> : <Copy className="size-3.5" />}
                          <span>{isCopied ? 'Copied Link! ✓' : '1-Tap Copy Link'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (onTestSocialLaunch) {
                              onTestSocialLaunch(item.source);
                            } else if (onLaunchFounderPreview) {
                              onLaunchFounderPreview('SALON_ONBOARD');
                            }
                          }}
                          className="min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#30363D] bg-[#21262D] hover:border-[#D29922] px-3 py-2 text-xs font-mono font-bold text-[#D29922] transition"
                          title="Simulates what a new salon owner sees when they click this social ad link on mobile (opens Step 1 Onboarding)"
                        >
                          <Smartphone className="size-3.5" />
                          <span>Preview Signup Ad Flow →</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Custom Campaign Generator */}
            <div className="rounded-2xl border border-[#30363D] bg-[#0D1117] p-5 space-y-4">
              <div className="flex items-center gap-2 text-[#D29922]">
                <Sparkles className="size-4 shrink-0" />
                <h4 className="text-xs font-mono font-bold uppercase tracking-wider">
                  Generate Custom Auto-Tagged Acquisition Link
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="text-xs font-mono text-[#8B949E] block space-y-1">
                  <span>CAMPAIGN TAG</span>
                  <input
                    type="text"
                    value={customCampaignName}
                    onChange={(e) => setCustomCampaignName(e.target.value)}
                    placeholder="e.g. karachi_beauty_fest"
                    className="w-full min-h-[44px] rounded-xl border border-[#30363D] bg-[#161B22] px-3 py-2 text-xs font-mono text-[#F0F6FC] focus:outline-none focus:border-[#06B6D4]"
                  />
                </label>

                <label className="text-xs font-mono text-[#8B949E] block space-y-1">
                  <span>TARGET SALON CATEGORY</span>
                  <select
                    value={customCampaignCategory}
                    onChange={(e) => setCustomCampaignCategory(e.target.value as 'ALL' | 'MENS' | 'LADIES')}
                    className="w-full min-h-[44px] rounded-xl border border-[#30363D] bg-[#161B22] px-3 py-2 text-xs font-mono text-[#F0F6FC] focus:outline-none focus:border-[#06B6D4]"
                  >
                    <option value="ALL">All Salons &amp; Parlors</option>
                    <option value="MENS">Men&apos;s Barbers &amp; Salons</option>
                    <option value="LADIES">Ladies&apos; Parlors &amp; Spas</option>
                  </select>
                </label>

                <label className="text-xs font-mono text-[#8B949E] block space-y-1">
                  <span>DEFAULT ONBOARDING LANGUAGE</span>
                  <select
                    value={customCampaignLanguage}
                    onChange={(e) => setCustomCampaignLanguage(e.target.value as 'URDU' | 'ARABIC' | 'ROMAN_URDU' | 'ENGLISH')}
                    className="w-full min-h-[44px] rounded-xl border border-[#30363D] bg-[#161B22] px-3 py-2 text-xs font-mono text-[#F0F6FC] focus:outline-none focus:border-[#06B6D4]"
                  >
                    <option value="URDU">🇵🇰 اردو (Urdu)</option>
                    <option value="ROMAN_URDU">💬 Roman Urdu</option>
                    <option value="ARABIC">🇦🇪 العربية (Arabic)</option>
                    <option value="ENGLISH">🇬🇧 English</option>
                  </select>
                </label>
              </div>

              {/* Generated Result Card */}
              {(() => {
                const generatedUrl = `https://portal.workcraft.local/?onboard=true&ref=social&utm_source=custom&utm_campaign=${encodeURIComponent(
                  customCampaignName.trim() || 'promo'
                )}&category=${customCampaignCategory.toLowerCase()}&lang=${customCampaignLanguage.toLowerCase()}`;
                const isCustomCopied = copiedLinkId === 'custom';

                return (
                  <div className="rounded-xl border border-[#06B6D4]/40 bg-[#161B22] p-3.5 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-[#06B6D4] font-bold">Generated Direct Signup Ad Link:</span>
                      <span className="text-[#3FB950]">Bypasses Founder Command ✓</span>
                    </div>
                    <div className="text-xs font-mono text-[#F0F6FC] break-all select-all p-2 rounded-lg bg-[#0D1117] border border-[#30363D]">
                      {generatedUrl}
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleCopyLink('custom', generatedUrl, 'Custom Campaign')}
                        className={`min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border px-4 py-2 text-xs font-mono font-bold transition ${
                          isCustomCopied
                            ? 'border-[#116329] bg-[#0D3822] text-[#3FB950]'
                            : 'border-[#06B6D4] bg-[#06B6D4] text-[#0D1117] hover:bg-[#22D3EE]'
                        }`}
                      >
                        {isCustomCopied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                        <span>{isCustomCopied ? 'Copied Link! ✓' : 'Copy Custom Link'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (onTestSocialLaunch) {
                            onTestSocialLaunch('Facebook');
                          } else if (onLaunchFounderPreview) {
                            onLaunchFounderPreview('SALON_ONBOARD');
                          }
                        }}
                        className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border border-[#30363D] bg-[#21262D] hover:border-[#D29922] px-3.5 py-2 text-xs font-mono font-bold text-[#D29922] transition"
                        title="Simulates clicking this link to preview the Step 1 Onboarding experience"
                      >
                        <Smartphone className="size-3.5" />
                        <span>Preview Signup Ad Flow →</span>
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Architecture Explainer Diagram */}
            <div className="rounded-2xl border border-[#30363D] bg-[#0D1117] p-5 space-y-3">
              <h4 className="text-xs font-mono font-bold text-[#8B949E] uppercase tracking-wider">
                How Prospect Ad Links Route to Self-Onboarding (Zero Founder Leakage)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-center font-mono text-[11px]">
                <div className="p-3 rounded-xl border border-[#30363D] bg-[#161B22] space-y-1">
                  <span className="text-[#06B6D4] font-bold block">1. Click Ad</span>
                  <p className="text-[10px] text-[#8B949E] font-sans">New salon owner taps FB/IG/TikTok/WA ad link on phone</p>
                </div>
                <div className="p-3 rounded-xl border border-[#116329] bg-[#0D3822] space-y-1">
                  <span className="text-[#3FB950] font-bold block">2. Auto-Bypass</span>
                  <p className="text-[10px] text-[#8B949E] font-sans">Role isolates to SALON_OWNER · Founder screens hidden</p>
                </div>
                <div className="p-3 rounded-xl border border-[#9E6A03] bg-[#3B2E0B] space-y-1">
                  <span className="text-[#D29922] font-bold block">3. 4-Step Setup</span>
                  <p className="text-[10px] text-[#8B949E] font-sans">Info ➔ Menu ➔ Package &amp; 10% SLA ➔ Link WhatsApp</p>
                </div>
                <div className="p-3 rounded-xl border border-[#06B6D4] bg-[#06B6D4]/15 space-y-1">
                  <span className="text-[#06B6D4] font-bold block">4. Live PWA</span>
                  <p className="text-[10px] text-[#8B949E] font-sans">1-click home screen icon + WhatsApp live auto-reply</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4. Settings Tab (Query 4: 100% Autonomous Self-Reporting — Zero Manual Switches) */}
        {(active === 'Settings' || active === 'Flow Builder') && (
          <div className="space-y-6">
            <div className="rounded-xl border border-[#116329] bg-[#0D3822] p-4 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 text-[#3FB950]">
                  <ShieldCheck className="size-4 shrink-0" />
                  <h4 className="text-xs font-mono font-bold uppercase tracking-wider">
                    Auto-Managed System Protection (Zero Manual Work Needed)
                  </h4>
                </div>
                <span className="rounded-md bg-[#161B22] border border-[#116329] px-2.5 py-0.5 text-[10px] font-mono font-bold text-[#3FB950]">
                  100% AUTOMATIC
                </span>
              </div>
              <p className="text-xs text-[#F0F6FC] font-sans leading-relaxed">
                You do not need to turn switches on or off manually. The system detects issues, sends reminders, switches backup lines, and protects client bookings automatically—and simply sends a clean summary report to your Founder number.
              </p>
            </div>

            <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-4 space-y-3">
              <h4 className="text-xs font-mono font-bold text-[#D29922] uppercase tracking-wider">
                What the System Handles Automatically For You
              </h4>

              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  {
                    title: '5th-of-Month Reminders & Overdue Lock',
                    desc: 'Automatically reminds salons 2 days before month end, on the 3rd, and on the 5th—and reports overdue salons to you.',
                  },
                  {
                    title: 'Backup SIM & Connection Guard',
                    desc: 'If any WhatsApp phone line slows down or disconnects, the system shifts messages to the backup line automatically.',
                  },
                  {
                    title: 'Automatic Deal Video Check & Broadcast',
                    desc: 'Checks every uploaded salon video against quality rules and approves or guides the owner automatically in their language.',
                  },
                  {
                    title: 'Customer Chat & Founder Privacy Shield',
                    desc: 'Locks exact salon prices so customers never get wrong rates, and keeps your personal phone number 100% hidden.',
                  },
                ].map((rule) => (
                  <div
                    key={rule.title}
                    className="rounded-xl border border-[#30363D] bg-[#161B22] p-3.5 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[#F0F6FC]">{rule.title}</span>
                      <span className="rounded bg-[#0D3822] border border-[#116329] px-2 py-0.5 text-[9px] font-mono font-bold text-[#3FB950] shrink-0">
                        AUTO-RUNS ✓
                      </span>
                    </div>
                    <p className="text-[11px] text-[#8B949E] font-sans leading-relaxed">
                      {rule.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Single Founder Alert Phone Field */}
            <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-4 space-y-3">
              <h4 className="text-xs font-mono font-bold text-[#06B6D4] uppercase tracking-wider">
                Where the System Sends Your Founder Reports
              </h4>
              <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                <label className="text-xs font-bold text-[#8B949E] font-mono flex-1">
                  FOUNDER WHATSAPP NUMBER (SYSTEM REPORTS ONLY)
                  <input
                    value={founderAlertPhone}
                    onChange={(e) => setFounderAlertPhone(e.target.value)}
                    className="mt-1.5 w-full min-h-[48px] rounded-lg border border-[#30363D] bg-[#161B22] px-3 py-2.5 text-sm text-[#F0F6FC] font-mono focus:border-[#06B6D4] focus:outline-none"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setSavedPhoneToast(true);
                    setTimeout(() => setSavedPhoneToast(false), 3000);
                  }}
                  className="min-h-[48px] rounded-xl bg-[#06B6D4] hover:bg-[#22D3EE] px-5 py-2.5 text-xs font-mono font-bold text-[#0D1117] uppercase transition active:scale-95 shrink-0"
                >
                  {savedPhoneToast ? 'Saved ✓' : 'Update Report Number'}
                </button>
              </div>
              {savedPhoneToast && (
                <p className="text-xs font-mono text-[#3FB950] flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5" />
                  System will send automatic daily summaries &amp; overdue alerts to {founderAlertPhone}.
                </p>
              )}
            </div>

            {/* Query 1 Visual Review Panel: Single Unified WorkCraft Mobile Home-Screen Shortcut Icon */}
            <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[#06B6D4]">
                  <Smartphone className="size-4" />
                  <h4 className="text-xs font-mono font-bold uppercase tracking-wider">
                    Mobile Home-Screen Shortcut Icon Review
                  </h4>
                </div>
                <span className="rounded-md bg-[#21262D] border border-[#30363D] px-2.5 py-0.5 text-[10px] font-mono font-bold text-[#06B6D4]">
                  GOLD W + CYAN-BLUE WORKCRAFT
                </span>
              </div>
              <p className="text-xs text-[#8B949E] font-sans leading-relaxed">
                This Gold Bullion &quot;W&quot; + Cyan-Blue WORKCRAFT icon appears when anyone installs the mobile shortcut. Every user sees the simple name <strong className="text-[#F0F6FC]">WorkCraft</strong>—the system detects Founder, Agent, or Salon Owner automatically from their link.
              </p>
              <div className="flex items-center gap-4 pt-1">
                <div className="rounded-2xl border border-[#30363D] bg-[#161B22] p-4 flex flex-col items-center text-center gap-2 min-w-[110px]">
                  <img
                    src="/icon.svg"
                    alt="WorkCraft Mobile Shortcut Icon"
                    className="size-[60px] rounded-2xl border border-[#30363D]"
                  />
                  <p className="text-xs font-sans font-bold text-[#F0F6FC] leading-tight">
                    WorkCraft
                  </p>
                </div>
                <div className="text-xs text-[#8B949E] font-sans space-y-1">
                  <p>• Same Gold &quot;W&quot; emblem + Dark Obsidian badge</p>
                  <p>• <strong className="text-[#06B6D4]">WORKCRAFT</strong> wordmark in matching Cyan-Blue</p>
                  <p>• Single clean title: <strong className="text-[#F0F6FC]">WorkCraft</strong></p>
                </div>
              </div>
            </div>

            {/* Founder-Only Independent Role Inspector */}
            {onLaunchFounderPreview && (
              <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-[#D29922]">
                    <Eye className="size-4" />
                    <h4 className="text-xs font-mono font-bold uppercase tracking-wider">
                      Inspect Agent Hub &amp; Salon Portal Separately
                    </h4>
                  </div>
                  <span className="rounded-md bg-[#3B2E0B] border border-[#9E6A03] px-2.5 py-0.5 text-[10px] font-mono font-bold text-[#D29922]">
                    FOUNDER TEST TOOL
                  </span>
                </div>
                <p className="text-xs text-[#8B949E] font-sans leading-relaxed">
                  Test the exact isolated screens that a real Field Agent or Salon Owner sees (with Founder tools completely hidden). Tap <strong className="text-[#F0F6FC]">Return to Founder View</strong> at the top anytime to come back.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => onLaunchFounderPreview('AGENT')}
                    className="min-h-[48px] rounded-xl border border-[#30363D] bg-[#161B22] hover:border-[#06B6D4] p-3.5 text-left transition"
                  >
                    <p className="text-xs font-mono font-bold text-[#06B6D4]">1. Real Field Agent Hub →</p>
                    <p className="text-[11px] text-[#8B949E] font-sans mt-0.5">
                      See personal Commission Ledger, Urdu/Arabic Profile &amp; Bank, and Onboarding.
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => onLaunchFounderPreview('SALON_ONBOARD')}
                    className="min-h-[48px] rounded-xl border border-[#30363D] bg-[#161B22] hover:border-[#06B6D4] p-3.5 text-left transition"
                  >
                    <p className="text-xs font-mono font-bold text-[#D29922]">2. New Salon Onboarding →</p>
                    <p className="text-[11px] text-[#8B949E] font-sans mt-0.5">
                      Test the 4-step signup flow &amp; mobile package drawer a new salon sees.
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => onLaunchFounderPreview('SALON_LIVE')}
                    className="min-h-[48px] rounded-xl border border-[#30363D] bg-[#161B22] hover:border-[#06B6D4] p-3.5 text-left transition"
                  >
                    <p className="text-xs font-mono font-bold text-[#3FB950]">3. Live Salon Dashboard →</p>
                    <p className="text-[11px] text-[#8B949E] font-sans mt-0.5">
                      Inspect live queue, voice alerts, rates, video deals &amp; PDF poster.
                    </p>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </PortalCard>
  );
};
