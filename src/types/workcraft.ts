export interface Salon {
  name: string;
  owner: string;
  location: string;
  status: 'Pending' | 'Paid';
  plan: string;
  initials: string;
}

export interface NotificationItem {
  title: string;
  description: string;
  time: string;
}

export type TabName =
  | 'Overview'
  | 'Agent Hub / Onboarding'
  | 'Salon Owner Dashboard'
  | 'Marketing'
  | 'Pairing'
  | 'Contact / Clients'
  | 'Flow Builder'
  | 'Revenue'
  | 'Voice'
  | 'Support'
  | 'Settings';

export interface CashPaymentForm {
  salon: string;
  amount: string;
  note: string;
  receivedBy: string;
  timestamp: string;
}

export type AppRole = 'FOUNDER' | 'AGENT_KAMRAN' | 'SALON_PWA';

export interface SystemErrorTelemetry {
  id: string;
  component: string;
  filePath: string;
  line: number;
  salonId: string;
  salonName: string;
  error: string;
  stack: string;
  status: 'AUTO_DEPLOYED' | 'PENDING_FOUNDER_APPROVAL' | 'SANDBOX_VERIFIED';
  diff: string;
  confidence: number;
  timestamp: string;
}

export interface CashCollectionRecord {
  id: string;
  agent: string;
  salonName: string;
  amount: number;
  hash: string;
  timestamp: string;
  hoursRemaining: number;
  receiptDispatched: boolean;
  paymentMethod: string;
}

export interface ServiceItem {
  id: string;
  name: string;
  price: number;
  enabled: boolean;
}

export interface SalonOnboardingData {
  id: string;
  salonName: string;
  ownerName: string;
  phone: string;
  countryCode: string;
  category: 'MENS' | 'LADIES';
  services: ServiceItem[];
  token: string;
  status: 'INVITE_DISPATCHED' | 'PWA_INSTALLED' | 'PAYMENT_VERIFIED' | 'PAIRING_READY';
  latLong: string;
  address: string;
  paymentMethod: string;
  verifiedAt?: string;
}

export interface RoutingFields {
  accountTitle: string;
  iban: string;
  mobile: string;
}
