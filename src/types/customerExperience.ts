export type CustomerLanguage = 'en' | 'ur' | 'roman_ur' | 'ar';

export type DayOfWeekKey = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';

export interface DayHours {
  open: boolean;
  openTime: string; // 24h HH:MM e.g. "11:00"
  closeTime: string; // 24h HH:MM e.g. "23:00"
  breakStart?: string; // optional HH:MM e.g. "13:00"
  breakEnd?: string; // optional HH:MM e.g. "14:30"
}

export interface CustomerServiceOption {
  id: string;
  name: string;
  price: number;
  durationMins: number;
  active: boolean;
}

export interface BarberStaffConfig {
  id: string;
  name: string;
  available: boolean;
  unavailableReason?: string;
}

export interface SalonCustomerConfig {
  salonId: string;
  salonName: string;
  phone: string;
  currency: string;
  currencySymbol: string;
  address: string;
  googleMapsUrl: string;
  supportedLanguages: CustomerLanguage[]; // 'en' is always supported & default
  weeklySchedule: Record<DayOfWeekKey, DayHours>;
  services: CustomerServiceOption[];
  barbers: BarberStaffConfig[];
  dealRetentionDaysAfterExpiry: number; // default 30
}

export interface SalonDealItem {
  id: string;
  salonId: string;
  title: string;
  description: string;
  discountPercent: number;
  serviceIds: string[];
  videoUrl: string | null; // null after retention purge
  videoName?: string;
  expiresAtIso: string;
  retentionDaysAfterExpiry: number;
  createdAtIso: string;
  videoDeletedAtIso?: string;
}

export interface CustomerAppointment {
  id: string;
  salonId: string;
  customerName: string;
  customerPhone: string;
  serviceIds: string[];
  serviceNames: string[];
  totalDurationMins: number;
  totalAmount: number;
  dealId?: string;
  dateIso: string; // YYYY-MM-DD
  timeSlot: string; // Display e.g. "04:30 PM"
  startMinutes: number; // Minutes from midnight e.g. 990
  barberName: string;
  language: CustomerLanguage;
  status: 'CONFIRMED' | 'IN_CHAIR' | 'COMPLETED';
  createdAtIso: string;
  isDemo?: boolean;
}

export interface TimeSlotAvailability {
  timeSlot: string;
  startMinutes: number;
  availableBarbersCount: number;
  availableBarberNames: string[];
}
