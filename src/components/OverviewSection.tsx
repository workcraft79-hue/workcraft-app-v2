import React, { useState } from 'react';
import {
  UsersRound,
  AlertTriangle,
  Receipt,
  WalletCards,
  MapPin,
  Mic,
  CheckCircle2,
  ShieldCheck,
  ArrowRight,
  MessageSquare,
  X,
} from 'lucide-react';
import { TabName } from '../types/workcraft';
import { SALONS } from '../data/portalData';
import { PortalCard } from './PortalCard';

interface OverviewSectionProps {
  payment: boolean;
  setPayment: (val: boolean) => void;
  onOpenCashModal?: () => void;
  go: (tab: TabName) => void;
  setDetailSheet: (detail: string | null) => void;
  onOpenVoiceTicker: () => void;
  onInspectSalon?: (salonName: string) => void;
  activeSalonCount?: number;
  kamranCashHeld?: number;
  onOpenSelfHealingModal?: () => void;
  onOpenVideoQAModal?: () => void;
  onOpenSalonPwa?: () => void;
  onSwitchToAgent?: () => void;
  onOpenPairing?: () => void;
}

export const OverviewSection: React.FC<OverviewSectionProps> = ({
  payment,
  setDetailSheet,
  onInspectSalon,
  activeSalonCount = 24,
  kamranCashHeld = 25000,
  go,
}) => {
  const [dismissedVoiceCard, setDismissedVoiceCard] = useState(false);
  const [dismissedCashCard, setDismissedCashCard] = useState(false);

  // Query 3: Show ONLY salons needing founder attention today (Pending 10% SLA / Dues After 5th / Connection Check)
  const attentionSalons = [
    ...SALONS.filter(
      (s) => (s.name === 'Seven Cuts Salon' && !payment) || s.status === 'Pending'
    ).map((s) => ({
      name: s.name,
      owner: s.owner,
      location: s.location,
      initials: s.initials,
      reason: '5th-of-Month 10% Fee Pending',
      badge: 'DUE AFTER 5TH',
      urgent: true,
    })),
    {
      name: 'Royal Fade DHA',
      owner: 'Usman',
      location: 'Lahore DHA',
      initials: 'RF',
      reason: 'Bank transfer receipt waiting match',
      badge: 'PAYMENT CHECK',
      urgent: true,
    },
    {
      name: 'Glam Studio F-7',
      owner: 'Fatima',
      location: 'Islamabad F-7',
      initials: 'GS',
      reason: 'WhatsApp reconnection check',
      badge: 'LINE CHECK',
      urgent: false,
    },
  ];

  return (
    <div className="space-y-6 pb-28 lg:pb-8 min-w-0">
      {/* 1. TOP 4 PLAIN-ENGLISH DAILY CHECK CARDS */}
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {[
          {
            label: 'Online Salons',
            detailKey: 'Salon connections',
            value: `${activeSalonCount} active`,
            badge: 'LIVE',
            badgeClass: 'text-[#3FB950] bg-[#0D3822] border-[#116329]',
            borderClass: 'border-[#30363D] hover:border-[#484F58]',
            bgClass: 'bg-[#161B22] hover:bg-[#21262D]',
            icon: UsersRound,
            iconClass: 'text-[#3FB950] bg-[#0D3822] border-[#116329]',
            valueClass: 'text-[#3FB950]',
            labelClass: 'text-[#8B949E]',
            hasPulse: true,
            pulseColor: 'bg-[#3FB950]',
            onClick: () => setDetailSheet('Salon connections'),
          },
          {
            label: 'Dues Pending',
            detailKey: 'Maintenance queue',
            value: payment ? '2 due after 5th' : '3 due after 5th',
            badge: 'ACTION',
            badgeClass: 'text-[#F85149] bg-[#4C1C1D] border-[#da3633]',
            borderClass: 'border-[#30363D] hover:border-[#da3633]/70',
            bgClass: 'bg-[#161B22] hover:bg-[#21262D]',
            icon: AlertTriangle,
            iconClass: 'text-[#F85149] bg-[#4C1C1D] border-[#da3633]',
            valueClass: 'text-[#F85149]',
            labelClass: 'text-[#8B949E]',
            hasPulse: true,
            pulseColor: 'bg-[#F85149]',
            onClick: () => setDetailSheet('Maintenance queue'),
          },
          {
            label: 'Cash Held by Agents',
            detailKey: 'Agent cash',
            value: `PKR ${kamranCashHeld.toLocaleString()}`,
            badge: 'AUTO-LIMIT',
            badgeClass: 'text-cyan-400 bg-[#06B6D4]/15 border-[#06B6D4]/40',
            borderClass: 'border-[#30363D] hover:border-[#06B6D4]/60',
            bgClass: 'bg-[#161B22] hover:bg-[#21262D]',
            icon: WalletCards,
            iconClass: 'text-cyan-400 bg-[#06B6D4]/15 border-[#06B6D4]/40',
            valueClass: 'text-[#F0F6FC]',
            labelClass: 'text-[#8B949E]',
            hasPulse: true,
            pulseColor: 'bg-[#06B6D4]',
            onClick: () => go('Revenue'),
          },
          {
            label: 'Monthly Income',
            detailKey: 'Revenue status',
            value: 'PKR 108k verified',
            badge: 'SETTLED',
            badgeClass: 'text-[#D29922] bg-[#3B2E0B] border-[#9E6A03]',
            borderClass: 'border-[#30363D] hover:border-[#9E6A03]',
            bgClass: 'bg-[#161B22] hover:bg-[#21262D]',
            icon: Receipt,
            iconClass: 'text-[#D29922] bg-[#3B2E0B] border-[#9E6A03]',
            valueClass: 'text-[#D29922]',
            labelClass: 'text-[#8B949E]',
            hasPulse: false,
            pulseColor: 'bg-[#D29922]',
            onClick: () => setDetailSheet('Revenue status'),
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              onClick={item.onClick}
              className={`min-h-[48px] rounded-xl border ${item.borderClass} ${item.bgClass} p-4 text-left transition active:scale-[0.99] group`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`grid size-8 shrink-0 place-items-center rounded-lg border ${item.iconClass}`}>
                  <Icon className="size-4" />
                </span>
                <span
                  className={`font-mono text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full border ${item.badgeClass} flex items-center gap-1.5`}
                >
                  {item.hasPulse && <span className={`size-1.5 rounded-full ${item.pulseColor} animate-pulse`} />}
                  {item.badge}
                </span>
              </div>
              <p className={`mt-3 text-xl font-bold font-mono tracking-tight truncate ${item.valueClass} transition`}>
                {item.value}
              </p>
              <p className={`mt-0.5 text-[10px] font-mono font-bold uppercase tracking-wider truncate ${item.labelClass}`}>
                {item.label}
              </p>
            </button>
          );
        })}
      </div>

      {/* 2. NEEDS YOUR ATTENTION TODAY (UNREAD VOICE MESSAGES + AGENT CASH HANDOVER ONLY) */}
      {(dismissedVoiceCard || dismissedCashCard) && (
        <div className="lg:hidden flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#30363D] bg-[#161B22] px-3.5 py-2 text-xs font-mono">
          <span className="text-[#8B949E]">
            {dismissedVoiceCard && dismissedCashCard
              ? 'Attention alerts minimized on mobile view.'
              : dismissedVoiceCard
              ? 'Unread Voice alert closed on mobile view.'
              : 'Agent Cash Held alert closed on mobile view.'}
          </span>
          <button
            type="button"
            onClick={() => {
              setDismissedVoiceCard(false);
              setDismissedCashCard(false);
            }}
            className="min-h-[36px] rounded-lg border border-[#30363D] bg-[#21262D] hover:border-[#06B6D4] px-3 py-1 text-[#06B6D4] font-bold transition"
          >
            Show Alerts Again
          </button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2 min-w-0">
        {/* Card A: Unread Salon Owner Voice Messages */}
        <div
          className={`${
            dismissedVoiceCard ? 'hidden lg:flex' : 'flex'
          } rounded-2xl border border-[#30363D] bg-[#161B22] p-4 sm:p-5 flex-col justify-between gap-3.5 min-w-0 overflow-hidden`}
        >
          <div className="flex items-start justify-between gap-2.5 min-w-0">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <span className="grid size-10 sm:size-11 shrink-0 place-items-center rounded-xl border border-[#06B6D4]/40 bg-[#06B6D4]/15 text-cyan-400">
                <Mic className="size-5" />
              </span>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-[#F0F6FC] break-words [overflow-wrap:break-word]">
                    2 Unread Voice Messages
                  </span>
                  <span className="rounded-full border border-[#06B6D4]/40 bg-[#06B6D4]/15 px-2 py-0.5 text-[10px] font-mono font-bold text-cyan-400 shrink-0">
                    NEW VOICE
                  </span>
                </div>
                <p className="text-xs text-[#8B949E] font-sans leading-relaxed break-words [overflow-wrap:break-word]">
                  From Seven Cuts Salon &amp; Noor Beauty Lounge · Tap Listen below to play &amp; reply
                </p>
                <p className="text-[11px] font-mono text-[#3FB950] break-words [overflow-wrap:break-word]">
                  ✓ Deal videos are verified automatically by system
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDismissedVoiceCard(true)}
              aria-label="Close Unread Voice Messages card"
              title="Close card"
              className="lg:hidden min-h-[40px] min-w-[40px] grid place-items-center rounded-xl border border-[#30363D] bg-[#21262D] text-[#8B949E] hover:text-[#F0F6FC] hover:border-[#484F58] transition shrink-0"
            >
              <X className="size-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => go('Voice')}
            className="w-full sm:w-auto sm:self-end min-h-[48px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#06B6D4] hover:bg-[#22D3EE] px-4 py-2.5 text-xs font-mono font-bold text-[#0D1117] transition active:scale-[0.99]"
          >
            <span>Listen &amp; Reply</span>
            <ArrowRight className="size-3.5" />
          </button>
        </div>

        {/* Card B: Field Agent Cash Limit & Automatic Commission Settlement */}
        <div
          className={`${
            dismissedCashCard ? 'hidden lg:flex' : 'flex'
          } rounded-2xl border border-[#30363D] bg-[#161B22] p-4 sm:p-5 flex-col justify-between gap-3.5 min-w-0 overflow-hidden`}
        >
          <div className="flex items-start justify-between gap-2.5 min-w-0">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <span className="grid size-10 sm:size-11 shrink-0 place-items-center rounded-xl border border-[#9E6A03] bg-[#3B2E0B] text-[#D29922]">
                <WalletCards className="size-5" />
              </span>
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-[#F0F6FC] break-words [overflow-wrap:break-word]">
                    Agent Cash Held: <span className="text-[#D29922]">PKR {kamranCashHeld.toLocaleString()}</span> / 50,000
                  </span>
                  <span className="rounded-full border border-[#9E6A03] bg-[#3B2E0B] px-2 py-0.5 text-[10px] font-mono font-bold text-[#D29922] shrink-0">
                    48H · 2-DEAL CAP
                  </span>
                </div>
                <p className="text-xs text-[#8B949E] font-sans leading-relaxed break-words [overflow-wrap:break-word]">
                  System automatically blocks a 3rd deal past 48h or PKR 50,000, auto-deducts from agent commission if overdue, and notifies the agent.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDismissedCashCard(true)}
              aria-label="Close Agent Cash Held card"
              title="Close card"
              className="lg:hidden min-h-[40px] min-w-[40px] grid place-items-center rounded-xl border border-[#30363D] bg-[#21262D] text-[#8B949E] hover:text-[#F0F6FC] hover:border-[#484F58] transition shrink-0"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-[#116329] bg-[#0D3822] px-3 py-1.5 text-[10px] font-mono font-bold text-[#3FB950]">
              <CheckCircle2 className="size-3.5 shrink-0" />
              <span>AUTO-ENFORCED</span>
            </span>
            <button
              type="button"
              onClick={() => go('Revenue')}
              className="min-h-[40px] inline-flex items-center gap-1 rounded-xl border border-[#30363D] bg-[#21262D] hover:border-[#06B6D4] px-3 py-1.5 text-[11px] font-mono font-bold text-[#06B6D4] transition"
            >
              <span>View Cash &amp; Bank Ledger</span>
              <ArrowRight className="size-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 3. CORE EXECUTIVE GRID: SALONS NEEDING ATTENTION TODAY + 1-GLANCE MONEY SUMMARY */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column: Salons Needing Attention Today */}
        <PortalCard title="Salons Needing Attention Today" kicker="PRIORITY FOLLOW-UP LIST">
          <div className="space-y-3">
            {attentionSalons.map((salon) => (
              <div
                key={salon.name}
                onClick={() => (onInspectSalon ? onInspectSalon(salon.name) : go('Salon Owner Dashboard'))}
                className="group min-h-[48px] flex items-center gap-3 rounded-xl border border-[#30363D] bg-[#0D1117] p-3 hover:border-[#06B6D4]/50 hover:bg-[#21262D] transition cursor-pointer"
                title={`Open ${salon.name} Read-Only Health View`}
              >
                <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#161B22] border border-[#30363D] text-[10px] font-mono font-bold text-[#D29922] group-hover:border-[#06B6D4]/50 group-hover:text-cyan-400 transition">
                  {salon.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-[#F0F6FC] group-hover:text-cyan-400 transition">
                    {salon.name}
                  </p>
                  <p className="text-[10px] font-mono text-[#6E7681]">
                    {salon.owner} · {salon.location}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-[10px] text-[#D29922] font-sans">{salon.reason}</span>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                        `${salon.name}, ${salon.location}`
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-[9px] font-mono font-bold text-[#58A6FF] hover:underline"
                    >
                      <MapPin className="size-3 text-[#D29922]" />
                      Map
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`rounded px-2.5 py-1 text-[9px] font-mono font-bold border ${
                      salon.urgent
                        ? 'border-[#9E6A03] bg-[#3B2E0B] text-[#D29922]'
                        : 'border-[#06B6D4]/40 bg-[#06B6D4]/15 text-cyan-400'
                    }`}
                  >
                    {salon.badge}
                  </span>
                  <ArrowRight className="size-3.5 text-[#6E7681] group-hover:text-cyan-400 group-hover:translate-x-0.5 transition" />
                </div>
              </div>
            ))}

            {/* Link to Full Directory */}
            <div className="mt-4 flex items-center justify-between border-t border-[#21262D] pt-3.5 text-[11px] font-mono gap-2">
              <span className="flex items-center gap-1.5 text-[#3FB950]">
                <CheckCircle2 className="size-3.5 shrink-0" />
                Remaining {Math.max(1, activeSalonCount - attentionSalons.length)} salons are 100% healthy
              </span>
              <button
                type="button"
                onClick={() => go('Contact / Clients')}
                className="inline-flex items-center gap-1 font-bold text-[#58A6FF] hover:underline shrink-0"
              >
                <span>View All {activeSalonCount} Salons</span>
                <ArrowRight className="size-3.5" />
              </button>
            </div>
          </div>
        </PortalCard>

        {/* Right Column: 1-Glance Monthly Money Summary + WhatsApp Message Queue */}
        <div className="space-y-6">
          <PortalCard title="This Month's Money Summary" kicker="REVENUE & COLLECTIONS AT A GLANCE">
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2.5 font-mono">
                <div className="rounded-xl border border-[#116329] bg-[#0D3822]/60 p-3">
                  <span className="text-[10px] text-[#8B949E] uppercase block">Collected</span>
                  <p className="text-base sm:text-lg font-black text-[#3FB950] mt-1">
                    PKR 108,000
                  </p>
                  <span className="text-[9px] text-[#3FB950]/85 block mt-0.5">24 of 27 Paid</span>
                </div>

                <div className="rounded-xl border border-[#9E6A03] bg-[#3B2E0B]/60 p-3">
                  <span className="text-[10px] text-[#8B949E] uppercase block">Due After 5th</span>
                  <p className="text-base sm:text-lg font-black text-[#D29922] mt-1">
                    PKR 6,000
                  </p>
                  <span className="text-[9px] text-[#D29922]/85 block mt-0.5">3 Salons Pending</span>
                </div>

                <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3">
                  <span className="text-[10px] text-[#8B949E] uppercase block">Agent Cash</span>
                  <p className="text-base sm:text-lg font-black text-[#D29922] mt-1">
                    PKR {kamranCashHeld.toLocaleString()}
                  </p>
                  <span className="text-[9px] text-[#6E7681] block mt-0.5">Kamran Handover</span>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-[#30363D] bg-[#0D1117] px-3.5 py-2.5 text-xs gap-2">
                <span className="text-[#8B949E] font-sans">
                  Monthly Software &amp; WhatsApp Cost: <strong className="text-[#3FB950] font-mono">$0.00 / mo</strong>
                </span>
                <button
                  type="button"
                  onClick={() => go('Revenue')}
                  className="inline-flex items-center gap-1 font-mono font-bold text-[#58A6FF] hover:underline shrink-0"
                >
                  <span>Open Full Ledger</span>
                  <ArrowRight className="size-3.5" />
                </button>
              </div>
            </div>
          </PortalCard>

          {/* Plain-English WhatsApp Delivery Health */}
          <PortalCard title="WhatsApp Message Queue" kicker="AUTOMATIC SENDING STATUS">
            <div className="space-y-3">
              <div className="flex items-baseline justify-between">
                <div>
                  <p className="text-2xl font-bold text-[#F0F6FC] font-mono">1,284</p>
                  <p className="text-[10px] font-mono text-[#6E7681] mt-0.5">
                    booking reminders &amp; VIP deal messages sending safely
                  </p>
                </div>
                <span className="text-sm font-bold text-[#D29922] font-mono">68% Sent</span>
              </div>

              <div className="h-2.5 w-full rounded-full bg-[#0D1117] overflow-hidden border border-[#30363D]">
                <div
                  className="h-full bg-[#06B6D4] rounded-full transition-all duration-500"
                  style={{ width: '68%' }}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#8B949E] font-sans pt-0.5">
                <span className="flex items-center gap-1.5 text-[#3FB950] font-mono text-[10px]">
                  <ShieldCheck className="size-3.5" />
                  <span>Auto-spaced safely so salon WhatsApp lines stay protected</span>
                </span>
                <span className="text-cyan-400 font-mono text-[10px] font-bold">
                  <MessageSquare className="size-3 inline mr-1" />
                  100% Delivered
                </span>
              </div>
            </div>
          </PortalCard>
        </div>
      </div>
    </div>
  );
};
