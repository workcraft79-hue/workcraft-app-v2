import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  CreditCard,
  TrendingUp,
  Activity,
  Server,
  Clock,
  Radio,
  Video,
  Sparkles,
  Zap,
} from 'lucide-react';
import { NOTIFICATIONS } from '../data/portalData';

// Monthly Historical Data Models
interface MonthData {
  month: string;
  mrrCollected: string;
  collectedDues: string;
  duesAtRisk: string;
  atRiskSalonsCount: number;
  pairedSalons: number;
  cashEntries: string;
  // Payment Method Breakup
  methods: {
    easypaisa: string;
    easypaisaSalons: number;
    jazzcash: string;
    jazzcashSalons: number;
    bank: string;
    bankSalons: number;
    cash: string;
    cashSalons: number;
  };
  // Product Offering Breakup
  products: {
    maintenancePaid: string;
    maintenanceSalons: number;
    newServices: string;
    newServicesSalons: number;
    dealVideo: string;
    dealVideoSalons: number;
  };
}

const MONTHLY_REPORTS: Record<string, MonthData> = {
  'October 2026': {
    month: 'October 2026',
    mrrCollected: 'PKR 108,000',
    collectedDues: 'PKR 108,000',
    duesAtRisk: 'PKR 13,500',
    atRiskSalonsCount: 3,
    pairedSalons: 27,
    cashEntries: 'PKR 25,000',
    methods: {
      easypaisa: 'PKR 24,000',
      easypaisaSalons: 6,
      jazzcash: 'PKR 13,000',
      jazzcashSalons: 4,
      bank: 'PKR 46,000',
      bankSalons: 9,
      cash: 'PKR 25,000',
      cashSalons: 5,
    },
    products: {
      maintenancePaid: 'PKR 85,500',
      maintenanceSalons: 19,
      newServices: 'PKR 13,500',
      newServicesSalons: 3,
      dealVideo: 'PKR 9,000',
      dealVideoSalons: 2,
    },
  },
  'September 2026': {
    month: 'September 2026',
    mrrCollected: 'PKR 99,000',
    collectedDues: 'PKR 99,000',
    duesAtRisk: 'PKR 4,500',
    atRiskSalonsCount: 1,
    pairedSalons: 24,
    cashEntries: 'PKR 20,000',
    methods: {
      easypaisa: 'PKR 22,000',
      easypaisaSalons: 6,
      jazzcash: 'PKR 12,000',
      jazzcashSalons: 3,
      bank: 'PKR 45,000',
      bankSalons: 9,
      cash: 'PKR 20,000',
      cashSalons: 4,
    },
    products: {
      maintenancePaid: 'PKR 81,000',
      maintenanceSalons: 18,
      newServices: 'PKR 9,000',
      newServicesSalons: 2,
      dealVideo: 'PKR 9,000',
      dealVideoSalons: 2,
    },
  },
  'August 2026': {
    month: 'August 2026',
    mrrCollected: 'PKR 85,500',
    collectedDues: 'PKR 85,500',
    duesAtRisk: 'PKR 0',
    atRiskSalonsCount: 0,
    pairedSalons: 21,
    cashEntries: 'PKR 15,000',
    methods: {
      easypaisa: 'PKR 19,000',
      easypaisaSalons: 5,
      jazzcash: 'PKR 10,500',
      jazzcashSalons: 3,
      bank: 'PKR 41,000',
      bankSalons: 8,
      cash: 'PKR 15,000',
      cashSalons: 3,
    },
    products: {
      maintenancePaid: 'PKR 72,000',
      maintenanceSalons: 16,
      newServices: 'PKR 9,000',
      newServicesSalons: 2,
      dealVideo: 'PKR 4,500',
      dealVideoSalons: 1,
    },
  },
};

// 2. Financial & Operational Executive Report Modal
interface FinancialReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FinancialReportModal: React.FC<FinancialReportModalProps> = ({ isOpen, onClose }) => {
  const [selectedMonth, setSelectedMonth] = useState<string>('October 2026');
  const [activeTab, setActiveTab] = useState<'revenue' | 'health'>('revenue');

  if (!isOpen) return null;

  const data = MONTHLY_REPORTS[selectedMonth] || MONTHLY_REPORTS['October 2026'];

  return (
    <div className="fixed inset-0 z-[75] grid place-items-center bg-[#0D1117]/80 p-3 sm:p-5 backdrop-blur-md overflow-y-auto" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[620px] rounded-3xl border border-[#30363D] bg-[#161B22] p-5 sm:p-6 animate-in zoom-in-95 duration-150 my-6 max-h-[92vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#21262D] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-[.2em] text-[#D29922]">
                FOUNDER EXECUTIVE AUDIT
              </span>
              <span className="rounded-full bg-[#0D3822] border border-[#116329] px-2 py-0.5 text-[9px] font-mono font-bold text-[#3FB950]">
                AUDITED
              </span>
            </div>
            <h3 className="mt-1 text-2xl font-black text-[#F0F6FC] tracking-tight">
              Platform &amp; Revenue Telemetry
            </h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close financial report"
            className="min-h-[44px] min-w-[44px] grid place-items-center rounded-xl text-[#8B949E] hover:text-[#F0F6FC] hover:bg-[#21262D] transition"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Active Month Snapshot Header Banner */}
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl border border-[#30363D] bg-[#0D1117] p-3">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-[#3FB950] animate-pulse" />
            <span className="text-xs font-mono font-bold text-[#F0F6FC] uppercase tracking-wider">
              Active Billing Snapshot: <span className="text-[#D29922]">October 2026</span>
            </span>
          </div>
          <span className="text-[10px] font-mono text-[#3FB950] bg-[#0D3822] border border-[#116329] px-2 py-0.5 rounded-md self-start sm:self-auto">
            Historical ledgers &amp; CSV exports archived in Revenue
          </span>
        </div>

        {/* 5 Core Executive KPI Boxes */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2.5 font-mono">
          <div className="rounded-xl border border-[#30363D] bg-[#21262D] p-3">
            <span className="text-[10px] text-[#8B949E] uppercase">MRR Collected</span>
            <p className="mt-1 text-lg font-bold text-[#D29922]">{data.mrrCollected}</p>
            <span className="text-[9px] text-[#3FB950]">Total Cleared</span>
          </div>

          <div className="rounded-xl border border-[#116329] bg-[#0D3822]/60 p-3">
            <span className="text-[10px] text-[#8B949E] uppercase">Collected Dues</span>
            <p className="mt-1 text-lg font-bold text-[#3FB950]">{data.collectedDues}</p>
            <span className="text-[9px] text-[#3FB950]">0 Chargebacks</span>
          </div>

          <div className="rounded-xl border border-[#9E6A03] bg-[#3B2E0B] p-3">
            <span className="text-[10px] text-[#D29922] uppercase">Dues At Risk</span>
            <p className="mt-1 text-lg font-bold text-[#D29922]">{data.duesAtRisk}</p>
            <span className="text-[9px] text-[#D29922]">{data.atRiskSalonsCount} Salons Pending</span>
          </div>

          <div className="rounded-xl border border-[#30363D] bg-[#21262D] p-3">
            <span className="text-[10px] text-[#8B949E] uppercase">Paired Salons</span>
            <p className="mt-1 text-lg font-bold text-[#F0F6FC]">{data.pairedSalons} Active</p>
            <span className="text-[9px] text-[#3FB950]">+12 Archived</span>
          </div>

          <div className="rounded-xl border border-[#30363D] bg-[#21262D] p-3 col-span-2 sm:col-span-2">
            <span className="text-[10px] text-[#8B949E] uppercase">Physical Cash Entries</span>
            <p className="mt-1 text-lg font-bold text-[#D29922]">{data.cashEntries}</p>
            <span className="text-[9px] text-[#3FB950]">Held by Field Agent Kamran · Biometric Hash Verified</span>
          </div>
        </div>

        {/* Tab switcher: Revenue Stream vs Operational Health */}
        <div className="mt-5 flex rounded-xl border border-[#30363D] bg-[#0D1117] p-1 gap-1">
          <button
            onClick={() => setActiveTab('revenue')}
            className={`flex-1 min-h-[48px] rounded-lg py-2 text-xs font-mono font-bold transition ${
              activeTab === 'revenue'
                ? 'bg-[#06B6D4] text-[#0D1117]'
                : 'text-[#8B949E] hover:text-[#F0F6FC]'
            }`}
          >
            Revenue Stream Breakdown
          </button>
          <button
            onClick={() => setActiveTab('health')}
            className={`flex-1 min-h-[48px] rounded-lg py-2 text-xs font-mono font-bold transition ${
              activeTab === 'health'
                ? 'bg-[#06B6D4] text-[#0D1117]'
                : 'text-[#8B949E] hover:text-[#F0F6FC]'
            }`}
          >
            Operational Health &amp; Automation
          </button>
        </div>

        {/* TAB 1: REVENUE STREAM */}
        {activeTab === 'revenue' && (
          <div className="mt-4 space-y-4 font-mono">
            {/* Section A: Payment Method Breakup */}
            <div className="rounded-2xl border border-[#30363D] bg-[#21262D] p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-[#30363D] pb-2">
                <span className="text-xs font-bold text-[#F0F6FC] uppercase tracking-wider">
                  1. Payment Method Breakup ({data.month})
                </span>
                <span className="text-[10px] text-[#D29922]">Total: {data.mrrCollected}</span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between rounded-xl bg-[#0D1117] p-2.5 border border-[#06B6D4]/50">
                  <div>
                    <span className="text-[#F0F6FC] font-bold">Official Bank Account (IBFT / Raast / Overseas)</span>
                    <p className="text-[10px] text-[#8B949E] font-sans">
                      {data.methods.bankSalons} salons · Local IBFT + Overseas package &amp; 10% maint auto-deposits
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <span className="text-[#D29922] font-bold">{data.methods.bank}</span>
                    <span className="block text-[9px] text-cyan-400">42.6% PRIMARY RAIL</span>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-[#0D1117] p-2.5 border border-[#30363D]">
                  <div>
                    <span className="text-[#F0F6FC] font-bold">EasyPaisa Webhook (Local Pakistan)</span>
                    <p className="text-[10px] text-[#8B949E] font-sans">
                      {data.methods.easypaisaSalons} local salons · SMS webhook auto-match
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <span className="text-[#D29922] font-bold">{data.methods.easypaisa}</span>
                    <span className="block text-[9px] text-[#3FB950]">22.2% of total</span>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-[#0D1117] p-2.5 border border-[#30363D]">
                  <div>
                    <span className="text-[#F0F6FC] font-bold">JazzCash Webhook (Local Pakistan)</span>
                    <p className="text-[10px] text-[#8B949E] font-sans">
                      {data.methods.jazzcashSalons} local salons · SMS regex matching
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <span className="text-[#D29922] font-bold">{data.methods.jazzcash}</span>
                    <span className="block text-[9px] text-[#3FB950]">12.0% of total</span>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-[#0D1117] p-2.5 border border-[#30363D]">
                  <div>
                    <span className="text-[#F0F6FC] font-bold">Field Agent Cash (Kamran)</span>
                    <p className="text-[10px] text-[#8B949E] font-sans">
                      {data.methods.cashSalons} salons · Biometric thumbprint logged
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <span className="text-[#D29922] font-bold">{data.methods.cash}</span>
                    <span className="block text-[9px] text-[#D29922]">23.1% (Cash liability)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Section B: Product & Service Line Breakup */}
            <div className="rounded-2xl border border-[#30363D] bg-[#21262D] p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-[#30363D] pb-2">
                <span className="text-xs font-bold text-[#F0F6FC] uppercase tracking-wider">
                  2. Revenue by Service Offering ({data.month})
                </span>
                <span className="text-[10px] text-cyan-400">3 Product Lines</span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between rounded-xl bg-[#0D1117] p-2.5 border border-[#30363D]">
                  <div>
                    <span className="text-[#F0F6FC] font-bold">Maintenance Paid (10% SLA Recurring)</span>
                    <p className="text-[10px] text-[#8B949E] font-sans">
                      Starter (PKR 1.5k), Growth (PKR 2k), VIP (PKR 2.5k) · 100% digital self-pay
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <span className="text-[#3FB950] font-bold">{data.products.maintenancePaid}</span>
                    <span className="block text-[9px] text-[#3FB950]">79.2% Recurring</span>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-[#0D1117] p-2.5 border border-[#30363D]">
                  <div>
                    <span className="text-[#F0F6FC] font-bold">New Salon Setups (One-Time Setup Fee)</span>
                    <p className="text-[10px] text-[#8B949E] font-sans">
                      {data.products.newServicesSalons} new salons onboarded (Starter PKR 15k, Growth PKR 20k, VIP PKR 25k)
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <span className="text-cyan-400 font-bold">{data.products.newServices}</span>
                    <span className="block text-[9px] text-[#3FB950]">12.5% Expansion</span>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-[#0D1117] p-2.5 border border-[#30363D]">
                  <div>
                    <span className="text-[#F0F6FC] font-bold">Deal Video Add-on Revenue</span>
                    <p className="text-[10px] text-[#8B949E] font-sans">
                      {data.products.dealVideoSalons} salon campaigns (1 video @ PKR 1.5k or 4 videos @ PKR 4k / 7-10 day validity)
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <span className="text-[#D29922] font-bold">{data.products.dealVideo}</span>
                    <span className="block text-[9px] text-[#3FB950]">8.3% Deal Blasts</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: OPERATIONAL HEALTH & AUTOMATION */}
        {activeTab === 'health' && (
          <div className="mt-4 space-y-4 font-mono">
            {/* Real Operational Health Stats */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl border border-[#116329] bg-[#0D3822] p-3.5 space-y-1">
                <span className="text-[10px] text-[#3FB950] uppercase">Platform Uptime</span>
                <p className="text-xl font-bold text-[#F0F6FC]">99.98%</p>
                <p className="text-[10px] text-[#8B949E] font-sans">
                  0 fatal socket crashes across 30 days
                </p>
              </div>

              <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3.5 space-y-1">
                <span className="text-[10px] text-[#06B6D4] uppercase">Automation of Time</span>
                <p className="text-xl font-bold text-[#06B6D4]">4.2 sec</p>
                <p className="text-[10px] text-[#8B949E] font-sans">
                  Avg queue cadence · 4–9s anti-ban jitter
                </p>
              </div>
            </div>

            {/* Messages Health */}
            <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="size-2 rounded-full bg-[#3FB950] animate-pulse shrink-0" />
                  <span className="text-xs font-bold text-[#F0F6FC] truncate">Messages Health &amp; Dispatch Deliverability</span>
                </div>
                <span className="text-xs font-bold text-[#3FB950] shrink-0">100% HEALTH</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs pt-1">
                <div className="bg-[#161B22] p-2.5 rounded-lg border border-[#30363D]">
                  <span className="text-[10px] text-[#8B949E] block">Messages Queued</span>
                  <span className="text-[#F0F6FC] font-bold text-sm">1,284 Today</span>
                </div>
                <div className="bg-[#161B22] p-2.5 rounded-lg border border-[#30363D]">
                  <span className="text-[10px] text-[#8B949E] block">Delivery Success</span>
                  <span className="text-[#3FB950] font-bold text-sm">100.0%</span>
                </div>
                <div className="bg-[#161B22] p-2.5 rounded-lg border border-[#30363D]">
                  <span className="text-[10px] text-[#8B949E] block">Packet Dropouts</span>
                  <span className="text-[#3FB950] font-bold text-sm">0 Drops</span>
                </div>
              </div>
            </div>

            {/* Voice Queue Health */}
            <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Radio className="size-3.5 text-[#06B6D4] shrink-0" />
                  <span className="text-xs font-bold text-[#F0F6FC] truncate">Voice Queue Health &amp; Resolution SLA</span>
                </div>
                <span className="text-xs font-bold text-[#06B6D4] shrink-0">15-MIN TARGET</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs pt-1">
                <div className="bg-[#161B22] p-2.5 rounded-lg border border-[#30363D]">
                  <span className="text-[10px] text-[#8B949E] block">Active Voice Notes</span>
                  <span className="text-[#F0F6FC] font-bold text-sm">2 In Queue</span>
                </div>
                <div className="bg-[#161B22] p-2.5 rounded-lg border border-[#30363D]">
                  <span className="text-[10px] text-[#8B949E] block">Avg Response Time</span>
                  <span className="text-[#3FB950] font-bold text-sm">14m 15s</span>
                </div>
                <div className="bg-[#161B22] p-2.5 rounded-lg border border-[#30363D]">
                  <span className="text-[10px] text-[#8B949E] block">Cloud Media Rent</span>
                  <span className="text-[#3FB950] font-bold text-sm">$0.00 / mo</span>
                </div>
              </div>
            </div>

            {/* SIM Gateway Telephony Health */}
            <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3.5 space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#F0F6FC] font-bold">Android Hardware SIM Gateway</span>
                <span className="text-[#3FB950] text-[10px] font-bold">CONNECTED</span>
              </div>
              <p className="text-[11px] text-[#8B949E] font-sans leading-relaxed">
                SIM 1 ping latency: 182ms. Dual-SIM hardware failover configured. Cloud telephony tolls avoided: 100% saved ($0 monthly bill).
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// 3. Payment Routing Modal
interface PaymentRoutingModalProps {
  method: string | null;
  onClose: () => void;
  onSave: () => void;
}

export const PaymentRoutingModal: React.FC<PaymentRoutingModalProps> = ({ method, onClose, onSave }) => {
  if (!method) return null;

  return (
    <div className="fixed inset-0 z-[75] grid place-items-center bg-[#0D1117]/80 p-4 backdrop-blur-md" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[420px] rounded-2xl border border-[#30363D] bg-[#161B22] p-5 shadow-2xl animate-in zoom-in-95 duration-150"
      >
        <div className="flex items-start justify-between border-b border-[#21262D] pb-3">
          <div>
            <p className="text-[10px] font-mono font-bold uppercase tracking-[.18em] text-[#06B6D4]">
              CHANNEL CONFIG
            </p>
            <h3 className="mt-1 text-lg font-bold text-[#F0F6FC]">{method}</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="min-h-[44px] min-w-[44px] grid place-items-center rounded-lg text-[#8B949E] hover:text-[#F0F6FC] hover:bg-[#21262D] transition"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-4 space-y-3 font-mono text-xs min-w-0">
          <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3 overflow-hidden">
            <p className="text-[#8B949E]">WEBHOOK ENDPOINT</p>
            <p className="text-[#58A6FF] mt-1 break-all [overflow-wrap:break-word]">https://api.workcraft.local/v1/payments/webhook</p>
          </div>

          <label className="block text-[#8B949E]">
            SIMULATION SECRET
            <input
              defaultValue="sec_live_9942a0b4e872c"
              readOnly
              className="mt-1 w-full min-h-[48px] rounded-lg border border-[#30363D] bg-[#0D1117] px-3 py-2 text-[#F0F6FC] text-sm focus:outline-none focus:border-[#06B6D4]"
            />
          </label>

          <button
            onClick={onSave}
            className="w-full min-h-[48px] mt-2 rounded-xl bg-[#06B6D4] px-4 py-2.5 text-xs font-mono font-bold text-[#0D1117] uppercase hover:bg-[#22D3EE] transition active:scale-95"
          >
            Save Gateway Settings
          </button>
        </div>
      </div>
    </div>
  );
};

// 4. Notifications Drawer
interface NotificationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenVoiceTicker?: () => void;
}

export const NotificationsDrawer: React.FC<NotificationsDrawerProps> = ({
  isOpen,
  onClose,
  onOpenVoiceTicker,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[75] flex justify-end bg-[#0D1117]/80 backdrop-blur-md" onClick={onClose}>
      <aside
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[420px] h-full bg-[#161B22] border-l border-[#30363D] p-5 pb-12 overflow-y-auto shadow-2xl flex flex-col space-y-4 animate-in slide-in-from-right duration-200"
      >
        <div className="flex items-center justify-between border-b border-[#21262D] pb-3">
          <div>
            <p className="text-[10px] font-mono font-bold uppercase tracking-[.18em] text-[#06B6D4]">
              SYSTEM FEED
            </p>
            <h3 className="text-lg font-bold text-[#F0F6FC]">Event Notifications</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close notifications"
            className="min-h-[44px] min-w-[44px] grid place-items-center rounded-lg text-[#8B949E] hover:text-[#F0F6FC] hover:bg-[#21262D] transition"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="space-y-2.5">
          {NOTIFICATIONS.map((notif, idx) => (
            <div
              key={`${notif.title}-${idx}`}
              onClick={() => {
                if (notif.title === 'Voice support' || notif.title === 'Voice ticker') {
                  onClose();
                  if (onOpenVoiceTicker) onOpenVoiceTicker();
                }
              }}
              className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3.5 space-y-1 hover:border-[#06B6D4]/50 transition cursor-pointer"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-bold text-[#F0F6FC]">{notif.title}</span>
                <span className="font-mono text-[10px] text-[#6E7681] shrink-0">{notif.time}</span>
              </div>
              <p className="text-xs text-[#8B949E] font-sans leading-relaxed">{notif.description}</p>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
};
