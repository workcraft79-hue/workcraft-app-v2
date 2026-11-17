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
import {
  MONTHLY_REVENUE_SUMMARY,
  SALONS,
  type VoiceThreadItem,
} from '../data/portalData';
import { PortalCard } from './PortalCard';

interface OverviewSectionProps {
  payment: boolean;
  setPayment: (val: boolean) => void;
  onOpenCashModal?: () => void;
  go: (tab: TabName) => void;
  setDetailSheet: (detail: string | null) => void;
  onOpenVoiceTicker: () => void;
  voiceThreads?: VoiceThreadItem[];
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
  onOpenVoiceTicker,
  voiceThreads = [],
  onInspectSalon,
  activeSalonCount = 24,
  kamranCashHeld = 25000,
  go,
}) => {
  const [dismissedVoiceCard, setDismissedVoiceCard] = useState(false);

  const unreadThreads = voiceThreads.filter((t) => t.unread);
  const unreadVoiceCount = unreadThreads.length;
  const unreadPreviewSalons =
    unreadThreads.length > 0
      ? unreadThreads.map((t) => `#${t.serialNumber} ${t.salonName}`).join(' & ')
      : 'All salon voice notes listened';

  const attentionSalons = [
    ...SALONS.filter(
      (s) => (s.name === 'Seven Cuts Salon' && !payment) || s.status === 'Pending'
    ).map((s) => ({
      name: s.name,
      owner: s.owner,
      location: s.location,
      initials: s.initials,
      reason: '5th-of-Month Maintenance Fee Pending',
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
      {/* 1. TOP 4 PLAIN-ENGLISH DAILY CHECK CARDS (ZERO DUPLICATION) */}
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {[
          {
            label: 'Online Salons',
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
            value: `PKR ${MONTHLY_REVENUE_SUMMARY.totalCollected.toLocaleString()}`,
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
            onClick: () => go('Revenue'),
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

      {/* 2. UNIFIED VOICE INBOX ATTENTION BANNER (SYNCED TO LIVE UNREAD COUNT) */}
      {dismissedVoiceCard && (
        <div className="lg:hidden flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#30363D] bg-[#161B22] px-3.5 py-2 text-xs font-mono">
          <span className="text-[#8B949E]">Unread Voice alert minimized on mobile view.</span>
          <button
            type="button"
            onClick={() => setDismissedVoiceCard(false)}
            className="min-h-[36px] rounded-lg border border-[#30363D] bg-[#21262D] hover:border-[#06B6D4] px-3 py-1 text-[#06B6D4] font-bold transition"
          >
            Show Voice Alert
          </button>
        </div>
      )}

      <div
        className={`${
          dismissedVoiceCard ? 'hidden lg:flex' : 'flex'
        } rounded-2xl border border-[#30363D] bg-[#161B22] p-4 sm:p-5 flex-col sm:flex-row sm:items-center justify-between gap-3.5 min-w-0 overflow-hidden`}
      >
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <span className="grid size-10 sm:size-11 shrink-0 place-items-center rounded-xl border border-[#06B6D4]/40 bg-[#06B6D4]/15 text-cyan-400">
            <Mic className="size-5" />
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-[#F0F6FC] break-words [overflow-wrap:break-word]">
                {unreadVoiceCount} Unread Voice Message{unreadVoiceCount === 1 ? '' : 's'}
              </span>
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-mono font-bold shrink-0 ${
                  unreadVoiceCount > 0
                    ? 'border-[#06B6D4]/40 bg-[#06B6D4]/15 text-cyan-400'
                    : 'border-[#116329] bg-[#0D3822] text-[#3FB950]'
                }`}
              >
                {unreadVoiceCount > 0 ? 'VOICE INBOX' : 'ALL CLEAR'}
              </span>
            </div>
            <p className="text-xs text-[#8B949E] font-sans leading-relaxed break-words [overflow-wrap:break-word]">
              {unreadPreviewSalons} · Unified Voice Inbox with 7-day auto-purge
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenVoiceTicker}
            className="flex-1 sm:flex-initial min-h-[48px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#06B6D4] hover:bg-[#22D3EE] px-4 py-2.5 text-xs font-mono font-bold text-[#0D1117] transition active:scale-[0.99]"
          >
            <span>Open Voice Inbox</span>
            <ArrowRight className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setDismissedVoiceCard(true)}
            aria-label="Close Unread Voice Messages card"
            title="Minimize card"
            className="lg:hidden min-h-[48px] min-w-[48px] grid place-items-center rounded-xl border border-[#30363D] bg-[#21262D] text-[#8B949E] hover:text-[#F0F6FC] hover:border-[#484F58] transition shrink-0"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* 3. CORE EXECUTIVE GRID: SALONS NEEDING ATTENTION + WHATSAPP MESSAGE QUEUE */}
      <div className="grid gap-6 lg:grid-cols-2">
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

        <PortalCard title="WhatsApp Message Queue" kicker="AUTOMATIC SENDING STATUS">
          <div className="space-y-4">
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

            <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3.5 flex items-center justify-between gap-2 text-xs">
              <span className="text-[#8B949E] font-sans">
                Agent handover details &amp; monthly ledger stay unified in{' '}
                <strong className="text-[#F0F6FC]">Agent Hub / Revenue</strong>.
              </span>
              <button
                type="button"
                onClick={() => go('Revenue')}
                className="min-h-[40px] inline-flex items-center gap-1 font-mono font-bold text-[#06B6D4] hover:underline shrink-0"
              >
                <span>Open Ledger</span>
                <ArrowRight className="size-3.5" />
              </button>
            </div>
          </div>
        </PortalCard>
      </div>
    </div>
  );
};
