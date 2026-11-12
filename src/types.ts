export type Language = 'en' | 'ar' | 'ur';

export type PackageTier = 'essential' | 'growth' | 'enterprise';

export interface SalonProfile {
  id: string;
  name: string;
  branch: string;
  city: string;
  country: 'Pakistan' | 'UAE';
  currency: 'PKR' | 'AED';
  phone: string;
  ownerName: string;
  ownerPhone: string;
  packageTier: PackageTier;
  setupFeePaid: boolean;
  monthlyFee: number;
  paymentStatus: 'paid' | 'grace_period' | 'overdue_red_alert';
  dueDate: string;
  lastPaymentDate: string;
  daysOverdue: number;
  gracePeriodDaysLeft: number;
  isLockedOut: boolean;
}

export interface PairingState {
  status: 'disconnected' | 'generating' | 'qr_ready' | 'authenticating' | 'connected';
  sessionKey: string;
  qrPayload: string;
  expiresInSeconds: number;
  connectedAt?: string;
  deviceName?: string;
  phoneNumber?: string;
  socketLatencyMs: number;
  uptimeSeconds: number;
  goroutinesActive: number;
  rlsIsolation: boolean;
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  city: string;
  country: 'PK' | 'AE';
  language: Language;
  tags: string[];
  optOut: boolean;
  lastVisit: string;
  totalVisits: number;
  notes?: string;
}

export interface BroadcastLog {
  id: string;
  timestamp: string;
  recipientName: string;
  recipientPhone: string;
  status: 'sent' | 'rate_limited' | 'skipped_optout';
  delaySeconds: number;
  personalizedText?: string;
  languageRoute?: string;
  languageFlag?: string;
}

export interface BroadcastCampaign {
  id: string;
  title: string;
  videoTitle: string;
  videoDurationSeconds: number;
  videoFileSizeMb: number;
  videoUrl?: string;
  dealDescription: string;
  dealDiscount: string;
  targetFilter: 'all' | 'active_only' | 'en' | 'ar' | 'ur';
  status: 'idle' | 'running' | 'paused' | 'completed';
  totalEligible: number;
  sentCount: number;
  skippedOptOutCount: number;
  currentRecipientIndex: number;
  currentDelaySeconds: number;
  nextDispatchRemainingMs: number;
  startedAt?: string;
  completedAt?: string;
  logs: BroadcastLog[];
}

export interface FlowNode {
  id: string;
  code: string;
  title: Record<Language, string>;
  category: 'trigger' | 'router' | 'booking' | 'concurrency' | 'review' | 'handoff';
  description: Record<Language, string>;
  messageCard: Record<Language, {
    header?: string;
    body: string;
    footer?: string;
    buttons?: string[];
    sections?: Array<{
      title: string;
      rows: Array<{ title: string; description?: string }>;
    }>;
  }>;
  nextStates: string[];
}

export interface MaintenanceInvoice {
  id: string;
  month: string;
  amount: number;
  currency: 'PKR' | 'AED';
  issueDate: string;
  dueDate: string;
  status: 'paid' | 'due' | 'overdue';
  paidOn?: string;
  paymentMethod?: string;
  transactionRef?: string;
}
