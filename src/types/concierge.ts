export type ClientPreferredLang = 'en' | 'roman_ur' | 'ur' | 'ar';

export type SalonRegionCode = 'PK' | 'MENA' | 'INTL';

export interface LanguageMenuOption {
  index: '1' | '2' | '3';
  lang: ClientPreferredLang;
  label: string;
  dir: 'ltr' | 'rtl';
}

export interface RetentionSettings {
  salonId: string;
  salonName: string;
  ownerName: string;
  whatsappPhone: string;
  countryCode: string;
  timezoneOffsetHours: number;
  currency: string;
  currencySymbol: string;

  // Module 2: Automated 9:00 AM Birthday & Special Event Offers
  birthdayEnabled: boolean;
  birthdayDiscountPct: number;
  birthdayFixedDiscount: number;
  birthdayGiftService: string;
  birthdayMessageTemplate: string;

  // Module 3: Automated 30-Day Dormant Client Win-Back Engine
  winbackEnabled: boolean;
  winbackDays: number;
  winbackDiscountPct: number;
  winbackAddonService: string;
  winbackMessageTemplate: string;

  // Module 4: Post-Service Google Review & Rating Booster (T+2 Hours)
  reviewBoosterEnabled: boolean;
  googleReviewUrl: string;
  updatedAt: string;
}

export interface ConciergeClientProfile {
  id: string;
  salonId: string;
  name: string;
  phone: string;
  preferredLanguage: ClientPreferredLang | null;
  awaitingLanguageSelection: boolean;
  birthDate: string; // Optional DD/MM e.g. "14/11" or ""
  lastCompletedVisitAt: string | null; // ISO timestamp
  lastBirthdaySentYear: number | null;
  lastWinbackSentAt: string | null;
  awaitingWinbackRebook: boolean;
  awaitingReviewAppointmentId: string | null;
}

export interface ConciergeAppointment {
  id: string;
  salonId: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  barberName: string;
  service: string;
  price: number;
  timeSlot: string;
  status: 'CONFIRMED' | 'IN_CHAIR' | 'COMPLETED';
  scheduledForIso: string;
  completedAt: string | null;
  reviewPromptSentAt: string | null;
  rating: number | null;
  ratingComment: string | null;
  reviewRoutedStatus: 'PENDING' | 'PROMPT_SENT' | 'PUBLIC_GOOGLE_SENT' | 'OWNER_INTERVENTION_NEEDED';
}

export interface OwnerInterventionAlert {
  id: string;
  salonId: string;
  appointmentId: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  service: string;
  rating: number;
  feedbackText: string;
  status: 'OWNER_INTERVENTION_NEEDED' | 'RESOLVED';
  createdAt: string;
  resolvedAt: string | null;
}

export interface WhatsAppMessageLog {
  id: string;
  salonId: string;
  direction: 'INBOUND' | 'OUTBOUND';
  module: 'LANGUAGE_MENU' | 'BIRTHDAY_9AM' | 'WINBACK_30D' | 'REVIEW_T2H' | 'BOOKING';
  clientName: string;
  clientPhone: string;
  language: ClientPreferredLang;
  dir: 'ltr' | 'rtl';
  body: string;
  timestamp: string;
  eventMetadata?: {
    eventType:
      | 'APPOINTMENT_CONFIRMED'
      | 'REMINDER_REPLY_CONFIRMED'
      | 'REMINDER_REPLY_LATE'
      | 'REMINDER_REPLY_RESCHEDULE';
    barberName?: string;
    services?: string;
    timeSlot?: string;
  };
}

export interface SalonConciergeStateResponse {
  region: SalonRegionCode;
  regionLabel: string;
  languageOptions: LanguageMenuOption[];
  greetingPromptPreview: string;
  settings: RetentionSettings;
  clients: ConciergeClientProfile[];
  appointments: ConciergeAppointment[];
  alerts: OwnerInterventionAlert[];
  logs: WhatsAppMessageLog[];
}
