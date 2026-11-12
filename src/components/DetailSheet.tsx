import React from 'react';
import {
  X,
  Radio,
  Clock,
  AlertTriangle,
  CheckCircle2,
  UsersRound,
  WalletCards,
  Mic,
  ArrowRight,
  ShieldCheck,
  CreditCard,
  MapPin,
  Smartphone,
  Lock,
} from 'lucide-react';
import { TabName } from '../types/workcraft';

interface DetailSheetProps {
  detail: string | null;
  onClose: () => void;
  go: (tab: TabName) => void;
  onOpenVoiceTicker?: () => void;
  onOpenCashModal?: () => void;
  onOpenReportModal?: () => void;
}

export const DetailSheet: React.FC<DetailSheetProps> = ({
  detail,
  onClose,
  go,
  onOpenVoiceTicker,
  onOpenCashModal,
  onOpenReportModal,
}) => {
  const [reminderDispatched, setReminderDispatched] = React.useState(false);
  if (!detail) return null;

  return (
    <div
      className="fixed inset-0 z-[65] flex items-end bg-[#0D1117]/80 backdrop-blur-md transition-opacity"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full rounded-t-3xl border border-[#30363D] bg-[#161B22] p-5 pb-12 max-w-2xl mx-auto animate-in slide-in-from-bottom duration-200 max-h-[85vh] overflow-y-auto overflow-x-hidden"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#30363D]" />
        <div className="flex items-center justify-between border-b border-[#21262D] pb-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[10px] font-mono font-bold uppercase tracking-[.18em] text-[#D29922]">
                OPERATIONAL TELEMETRY &amp; DRILL-DOWN
              </p>
              {detail === 'Salon connections' && (
                <span className="font-mono text-[9px] font-bold px-2 py-0.5 rounded-full border border-[#116329] text-[#3FB950] bg-[#0D3822]">
                  LIVE
                </span>
              )}
              {detail === 'Maintenance queue' && (
                <span className="font-mono text-[9px] font-bold px-2 py-0.5 rounded-full border border-[#da3633] text-[#F85149] bg-[#4C1C1D]">
                  ACTION
                </span>
              )}
              {detail === 'SIM Gateway Socket' && (
                <span className="font-mono text-[9px] font-bold px-2 py-0.5 rounded-full border border-[#06B6D4]/40 text-cyan-400 bg-[#06B6D4]/15">
                  ONLINE
                </span>
              )}
              {detail === 'Revenue status' && (
                <span className="font-mono text-[9px] font-bold px-2 py-0.5 rounded-full border border-[#9E6A03] text-[#D29922] bg-[#3B2E0B]">
                  SETTLED
                </span>
              )}
            </div>
            <h3 className="mt-1 text-xl font-bold text-[#F0F6FC] tracking-tight">{detail}</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close detail sheet"
            className="min-h-[44px] min-w-[44px] grid place-items-center rounded-xl text-[#8B949E] hover:text-[#F0F6FC] hover:bg-[#21262D] transition"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* 1. Salon Connections (24 online - LIVE) */}
        {detail === 'Salon connections' && (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-3 gap-2 font-mono">
              <div className="rounded-xl border border-[#30363D] bg-[#21262D] p-3">
                <p className="text-[10px] text-[#8B949E] uppercase">Connected Salons</p>
                <p className="mt-1 text-lg font-bold text-[#F0F6FC]">24 / 27 Online</p>
                <span className="text-[9px] text-[#3FB950] font-bold">88.9% Live</span>
              </div>
              <div className="rounded-xl border border-[#30363D] bg-[#21262D] p-3">
                <p className="text-[10px] text-[#8B949E] uppercase">Reply Speed</p>
                <p className="mt-1 text-lg font-bold text-cyan-400">Instant</p>
                <span className="text-[9px] text-[#3FB950] font-bold">Under 1 Second</span>
              </div>
              <div className="rounded-xl border border-[#30363D] bg-[#21262D] p-3">
                <p className="text-[10px] text-[#8B949E] uppercase">Line Health</p>
                <p className="mt-1 text-lg font-bold text-[#3FB950]">99.98%</p>
                <span className="text-[9px] text-[#3FB950] font-bold">Zero Drops</span>
              </div>
            </div>

            {/* City Distribution */}
            <div className="rounded-xl border border-[#30363D] bg-[#21262D] p-3.5 space-y-2 font-mono">
              <p className="text-xs font-bold text-[#F0F6FC] uppercase tracking-wider">
                City Breakdown
              </p>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-lg bg-[#0D1117] p-2 border border-[#30363D]">
                  <span className="text-[#8B949E] block text-[10px]">Lahore (DHA/Gulberg)</span>
                  <span className="text-[#F0F6FC] font-bold">10 Salons</span>
                </div>
                <div className="rounded-lg bg-[#0D1117] p-2 border border-[#30363D]">
                  <span className="text-[#8B949E] block text-[10px]">Karachi (Clifton)</span>
                  <span className="text-[#F0F6FC] font-bold">9 Salons</span>
                </div>
                <div className="rounded-lg bg-[#0D1117] p-2 border border-[#30363D]">
                  <span className="text-[#8B949E] block text-[10px]">Islamabad (F-6/7)</span>
                  <span className="text-[#F0F6FC] font-bold">5 Salons</span>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="space-y-2 font-mono">
              <p className="text-xs font-bold text-[#8B949E] uppercase tracking-wider">
                Recent WhatsApp Checks
              </p>
              {[
                { name: 'Seven Cuts Salon', loc: 'Lahore DHA', ping: 'Connected', time: '12s ago' },
                { name: 'Noor Beauty Lounge', loc: 'Karachi Clifton', ping: 'Connected', time: '45s ago' },
                { name: 'The Groom Room', loc: 'Islamabad F-6', ping: 'Connected', time: '1m ago' },
              ].map((node) => (
                <div key={node.name} className="flex items-center justify-between rounded-lg border border-[#30363D] bg-[#0D1117] p-2.5 text-xs gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="size-2 rounded-full bg-[#3FB950] shrink-0" />
                    <span className="text-[#F0F6FC] font-bold truncate">{node.name}</span>
                    <span className="text-[#6E7681] text-[10px] shrink-0">({node.loc})</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-cyan-400 text-[11px] font-bold">{node.ping}</span>
                    <span className="text-[#6E7681] text-[10px]">{node.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 2. Maintenance Queue (3 due today - ACTION) */}
        {detail === 'Maintenance queue' && (
          <div className="mt-4 space-y-4 font-mono">
            <div className="rounded-xl border border-[#9E6A03] bg-[#3B2E0B] p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-[#D29922] uppercase">3 Salons Due Today (5th of Month)</span>
                <span className="rounded bg-[#0D1117] px-2 py-0.5 text-[10px] font-bold text-[#D29922] border border-[#9E6A03]">
                  PKR 6,000 (10% SLA)
                </span>
              </div>
              <p className="text-xs text-[#F0F6FC]/90 font-sans leading-relaxed">
                Grace period active until 11:59 PM. Core WhatsApp responder remains operational; analytics graphs automatically lock if payment remains unconfirmed after the 5th.
              </p>
            </div>

            {/* Autonomous Cron Engine Status */}
            <div className="rounded-xl border border-[#116329] bg-[#0D3822] p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-[#3FB950] animate-pulse" />
                <span className="text-[#3FB950] font-bold">Autonomous Cron Engine: ACTIVE</span>
              </div>
              <span className="text-[10px] text-[#8B949E]">Fires Daily @ 09:00 AM via Central SIM</span>
            </div>

            {/* Salons with Pending Dues */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-[#8B949E] uppercase tracking-wider">
                Pending Salons in Maintenance Window
              </p>
              {[
                { name: 'Seven Cuts Salon', owner: 'Hamza', city: 'Lahore', amount: 'PKR 1,500', tier: 'Starter (10%)', method: 'EasyPaisa SMS Webhook expected' },
                { name: 'Royal Fade DHA', owner: 'Usman', city: 'Lahore', amount: 'PKR 2,000', tier: 'Growth (10%)', method: 'Direct Bank IBFT receipt pending' },
                { name: 'Glam Studio F-7', owner: 'Fatima', city: 'Islamabad', amount: 'PKR 2,500', tier: 'VIP (10%)', method: 'Self-serve payment link dispatched' },
              ].map((s) => (
                <div key={s.name} className="rounded-xl border border-[#30363D] bg-[#21262D] p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-[#F0F6FC]">{s.name}</span>
                      <span className="text-[10px] text-[#8B949E] font-sans">· {s.owner} ({s.city})</span>
                    </div>
                    <p className="text-[10px] text-[#8B949E] font-sans mt-0.5">{s.method} · <span className="text-cyan-400">{s.tier}</span></p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-sm font-bold text-[#D29922]">{s.amount}</span>
                    <span className="block text-[9px] text-[#D29922]">Due Today</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Manual Test Override Button */}
            <div className="pt-2 space-y-1.5">
              <button
                type="button"
                onClick={() => setReminderDispatched(true)}
                className={`w-full min-h-[48px] rounded-xl py-3 text-xs font-mono font-bold uppercase transition text-center ${
                  reminderDispatched
                    ? 'bg-[#3FB950] text-[#0D1117]'
                    : 'bg-[#06B6D4] hover:bg-[#22D3EE] text-[#0D1117]'
                }`}
              >
                {reminderDispatched
                  ? '✓ Manual Test Reminders Dispatched via Central SIM!'
                  : '🧪 Test Manual WhatsApp Payment Reminder Dispatch →'}
              </button>
              <p className="text-[10px] text-[#6E7681] text-center font-sans">
                Automatic background cron runs daily at 09:00 AM; click above only to force an immediate test reminder.
              </p>
            </div>
          </div>
        )}

        {/* 3. SIM Gateway Socket Status */}
        {(detail === 'SIM Gateway Socket' || detail === 'Voice notes' || detail === 'Voice support' || detail === 'Voice messages' || detail === 'Voice queue' || detail === 'Voice') && (
          <div className="mt-4 space-y-4 font-mono">
            <div className="rounded-xl border border-[#30363D] bg-[#21262D] p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-cyan-400 uppercase break-all [overflow-wrap:break-word]">
                  Central SIM Socket Gateway (+92-300-WORKCRAFT-LOCAL)
                </span>
                <span className="rounded bg-[#0D3822] px-2 py-0.5 text-[10px] font-bold text-[#3FB950] border border-[#116329]">
                  100% ONLINE · ZERO SPAM BLOCKS
                </span>
              </div>
              <p className="text-xs text-[#8B949E] font-sans leading-relaxed">
                Dedicated hardware business SIM router. All customer booking dialogues, slot confirmations, and reminder broadcasts route exclusively through this verified business socket.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3">
                <span className="text-[10px] text-[#6E7681] uppercase block">Founder Privacy</span>
                <span className="text-xs font-bold text-[#3FB950] mt-1 block">100% Hidden</span>
                <span className="text-[9px] text-[#6E7681]">Personal number protected</span>
              </div>

              <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3">
                <span className="text-[10px] text-[#6E7681] uppercase block">Sending Pace</span>
                <span className="text-xs font-bold text-cyan-400 mt-1 block">4–9s Safe Gap</span>
                <span className="text-[9px] text-[#6E7681]">Ban-safe delivery</span>
              </div>

              <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3">
                <span className="text-[10px] text-[#6E7681] uppercase block">System Cost</span>
                <span className="text-xs font-bold text-[#D29922] mt-1 block">$0.00 / mo</span>
                <span className="text-[9px] text-[#6E7681]">Self-hosted line</span>
              </div>
            </div>

            {/* Live Activity Feed */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-[#8B949E] uppercase tracking-wider">
                Recent Automatic Actions
              </p>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between rounded-lg bg-[#0D1117] p-2.5 border border-[#30363D]">
                  <span className="text-[#3FB950] font-bold">✓ WhatsApp booking slot confirmed</span>
                  <span className="text-[#6E7681] text-[10px]">Seven Cuts · 14s ago</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-[#0D1117] p-2.5 border border-[#30363D]">
                  <span className="text-cyan-400 font-bold">⚡ Client Urdu question answered</span>
                  <span className="text-[#6E7681] text-[10px]">Noor Beauty · 38s ago</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-[#0D1117] p-2.5 border border-[#30363D]">
                  <span className="text-[#F0F6FC] font-bold">✓ Connection check healthy</span>
                  <span className="text-[#6E7681] text-[10px]">All lines · 1m ago</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4. Revenue Status */}
        {detail === 'Revenue status' && (
          <div className="mt-4 space-y-4 font-mono">
            <div className="rounded-xl border border-[#30363D] bg-[#21262D] p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-[#D29922] uppercase">Current Month Collection Summary</span>
                <span className="rounded bg-[#0D3822] px-2 py-0.5 text-[10px] font-bold text-[#3FB950] border border-[#116329]">
                  PKR 156,000 VERIFIED
                </span>
              </div>
              <p className="text-xs text-[#8B949E] font-sans leading-relaxed">
                Total inflows cleared via 100% automated direct digital payment rails. Zero cloud SaaS platform tolls or third-party telephony taxes incurred.
              </p>
            </div>

            {/* Current Month Dual Breakup */}
            <div className="rounded-xl border border-[#30363D] bg-[#21262D] p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-[#F0F6FC] uppercase tracking-wider">
                  Current Month Revenue Breakup
                </p>
                <span className="text-[10px] text-cyan-400 font-bold">26 Active Partners</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3 space-y-1">
                  <span className="text-[10px] text-[#8B949E] uppercase block">New Salons Onboarded</span>
                  <p className="text-lg font-bold text-cyan-400">PKR 120,000</p>
                  <p className="text-[10px] text-[#8B949E] font-sans">
                    8 Salons onboarded this month (@ PKR 15k–25k Setup fee)
                  </p>
                </div>

                <div className="rounded-xl border border-[#116329] bg-[#0D3822]/60 p-3 space-y-1">
                  <span className="text-[10px] text-[#8B949E] uppercase block">Paid 10% Maintenance</span>
                  <p className="text-lg font-bold text-[#3FB950]">PKR 36,000</p>
                  <p className="text-[10px] text-[#8B949E] font-sans">
                    18 Salons settled current month 10% SLA fee
                  </p>
                </div>
              </div>

              <div className="space-y-1 pt-1">
                <div className="flex items-center justify-between text-[10px] text-[#8B949E]">
                  <span>Revenue Composition:</span>
                  <span>77% Setup · 23% Recurring</span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-[#0D1117] overflow-hidden flex border border-[#30363D] p-0.5">
                  <div className="h-full bg-[#06B6D4] rounded-l-full" style={{ width: '77%' }} title="New Setup Fee: 77%" />
                  <div className="h-full bg-[#3FB950] rounded-r-full" style={{ width: '23%' }} title="Monthly 10% Maintenance: 23%" />
                </div>
              </div>
            </div>

            {/* Channel Breakdown */}
            <div className="rounded-xl border border-[#30363D] bg-[#21262D] p-3.5 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-bold text-[#F0F6FC] uppercase tracking-wider">
                  Settled Digital Channels
                </p>
                <span className="rounded-full bg-[#0D3822] border border-[#116329] px-2 py-0.5 text-[9px] font-bold text-[#3FB950]">
                  100% ZERO AGENT CASH VERIFIED
                </span>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between gap-2 bg-[#0D1117] p-2.5 rounded-lg border border-[#06B6D4]/50">
                  <div className="min-w-0">
                    <span className="text-[#F0F6FC] font-bold block">Official Bank Account (IBFT / Raast / Overseas)</span>
                    <span className="text-[10px] text-[#8B949E] font-sans block">12 salons · Local IBFT + Overseas setup &amp; 10% maint auto-deposits</span>
                  </div>
                  <span className="text-[#D29922] font-bold shrink-0">PKR 78,000</span>
                </div>
                <div className="flex items-center justify-between gap-2 bg-[#0D1117] p-2.5 rounded-lg border border-[#30363D]">
                  <span className="text-[#F0F6FC]">EasyPaisa SMS Webhooks (7 Local Salons)</span>
                  <span className="text-[#D29922] font-bold shrink-0">PKR 36,000</span>
                </div>
                <div className="flex items-center justify-between gap-2 bg-[#0D1117] p-2.5 rounded-lg border border-[#30363D]">
                  <span className="text-[#F0F6FC]">JazzCash SMS Webhook (4 Local Salons)</span>
                  <span className="text-[#D29922] font-bold shrink-0">PKR 22,000</span>
                </div>
                <div className="flex items-center justify-between gap-2 bg-[#0D1117] p-2.5 rounded-lg border border-[#30363D]">
                  <span className="text-[#F0F6FC]">Stripe Connect Overseas Split (3 Salons → Bank)</span>
                  <span className="text-[#D29922] font-bold shrink-0">PKR 20,000</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
