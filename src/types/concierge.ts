export type ClientPreferredLang = 'en' | 'roman_ur' | 'ur' | 'ar';

export type SalonRegionCode = 'PK' | 'MENA' | 'INTL';

export interface LanguageMenuOption {
  index: '1' | '2' | '3';
  lang: ClientPreferredLang;
  label: string;
  dir: 'ltr' | 'rtl';
}

export type SalonPackageTier = 'STARTER' | 'PRO' | 'PRO++';

export type SalonBillingStatus = 'PENDING_ACTIVATION' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED';

export type SalonCategory = 'MENS' | 'LADIES';

export interface SalonServiceRate {
  id?: string;
  name: string;
  price: number;
  durationMins?: number;
  active?: boolean;
  translations?: Partial<Record<ClientPreferredLang, string>>;
}

export interface SalonOperatingHours {
  monThuOpen: string;
  monThuClose: string;
  monThuClosed: boolean;
  fridayOpen: string;
  fridayClose: string;
  fridayBreakStart: string;
  fridayBreakEnd: string;
  fridayClosed: boolean;
  satSunOpen: string;
  satSunClose: string;
  satSunClosed: boolean;
}

export type DealDiscountType = 'PCT' | 'FIXED' | 'BUNDLE_PRICE';

export interface SalonDeal {
  id: string;
  salonId: string;
  title: string;
  description: string;
  discountType: DealDiscountType;
  discountValue: number;
  serviceIds: string[];
  serviceNames: string[];
  startsAt: string;
  expiresAt: string;
  videoRetentionDaysAfterExpiry: number;
  videoFileName?: string;
  videoMimeType?: string;
  videoUrl?: string;
  videoDeletedAt?: string | null;
  active: boolean;
  createdAt: string;
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
  salonCategory?: SalonCategory;
  enabledServices?: SalonServiceRate[];
  address?: string;
  googleMapsUrl?: string;
  operatingHours?: SalonOperatingHours;
  enabledClientLanguages?: ClientPreferredLang[];
  videoRetentionDaysAfterExpiry?: number;
  packageTier?: SalonPackageTier;
  billingStatus?: SalonBillingStatus;
  counterSleptAt?: string | null;

  // Module 2: Automated 9:00 AM Birthday & Special Event Offers
  birthdayEnabled: boolean;
  birthdayEventName?: string;
  birthdayDiscountPct: number;
  birthdayFixedDiscount: number;
  birthdayGiftService: string;
  birthdayMessageTemplate: string;

  // Module 3: Automated 30-Day Dormant Client Win-Back Engine
  winbackEnabled: boolean;
  winbackDays: number;
  winbackDiscountPct: number;
  winbackFixedDiscount?: number;
  winbackAddonService: string;
  winbackMessageTemplate: string;

  // Module 4: Post-Service Google Review & Rating Booster (T+2 Hours)
  reviewBoosterEnabled: boolean;
  googleReviewUrl: string;
  updatedAt: string;
}

export interface PendingBarberReroute {
  requestedBarber: string;
  requestedTimeSlot: string;
  requestedMinutes: number;
  services: string;
  alternatives: Array<{
    index: string;
    type: 'ALT_BARBER' | 'NEXT_SLOT';
    barberName: string;
    timeSlot: string;
  }>;
}

export interface PendingRescheduleSelection {
  requestedAt: string;
  preferredService: string;
  alternatives: Array<{
    index: string;
    barberName: string;
    timeSlot: string;
    dateLabel: string;
  }>;
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
  pendingReroute?: PendingBarberReroute | null;
  pendingReschedule?: PendingRescheduleSelection | null;
}

export interface ConciergeAppointment {
  id: string;
  salonId: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  barberName: string;
  service: string;
  serviceIds?: string[];
  price: number;
  appointmentDate?: string; // YYYY-MM-DD in salon local time
  timeSlot: string;
  durationMins?: number;
  scheduledEndMs?: number;
  dealId?: string;
  bookedDealTitle?: string;
  flagged?: boolean;
  canceled?: boolean;
  sourceType?: 'WHATSAPP_BOT' | 'WALK_IN_BUSY';
  status: 'CONFIRMED' | 'IN_CHAIR' | 'COMPLETED';
  scheduledForIso: string;
  completedAt: string | null;
  reviewPromptSentAt: string | null;
  rating: number | null;
  ratingComment: string | null;
  reviewRoutedStatus: 'PENDING' | 'PROMPT_SENT' | 'PUBLIC_GOOGLE_SENT' | 'OWNER_INTERVENTION_NEEDED';
}

export interface ChairLock {
  id: string;
  salonId: string;
  barberName: string;
  chairLabel?: string;
  startTimeSlot: string;
  endTimeSlot: string;
  startMinutes: number;
  endMinutes: number;
  durationMins: number;
  source: 'VOICE' | 'QUICK_PILL';
  transcript?: string;
  createdAt: string;
}

export interface WalkInQueueItem {
  id: string;
  salonId: string;
  clientName: string;
  phone: string;
  service: string;
  assignedStaff: string;
  etaMinutes: number;
  status: 'WAITING' | 'NOTIFIED' | 'SEATED';
  createdAt: string;
}

export interface BridalBookingRecord {
  id: string;
  salonId: string;
  brideOrEventName: string;
  phone: string;
  packageName: string;
  eventDate: string;
  trialDate?: string;
  totalAmount: number;
  advancePaid: number;
  assignedStylist: string;
  homeService: boolean;
  status: 'ADVANCE_LOCKED' | 'SETTLED';
  createdAt: string;
}

export interface ServicePackagePass {
  id: string;
  salonId: string;
  clientName: string;
  phone: string;
  packageTitle: string;
  totalSessions: number;
  usedSessions: number;
  pricePaid: number;
  updatedAt: string;
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
      | 'REMINDER_REPLY_RESCHEDULE'
      | 'RESCHEDULE_CONFIRMED'
      | 'BARBER_BUSY_REROUTED'
      | 'URGENT_BRIDAL_GROOM'
      | 'PRICE_MENU_SENT';
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
  chairLocks: ChairLock[];
  barbers: string[];
  alerts: OwnerInterventionAlert[];
  logs: WhatsAppMessageLog[];
  walkInQueue?: WalkInQueueItem[];
  bridalBookings?: BridalBookingRecord[];
  servicePackages?: ServicePackagePass[];
  deals?: SalonDeal[];
}

export type CustomerMenuActionId =
  | 'BOOK_APPOINTMENT'
  | 'SERVICES_PRICES'
  | 'HOURS_LOCATION'
  | 'CURRENT_DEALS';

export interface CustomerLanguageChoice {
  lang: ClientPreferredLang;
  label: string;
  nativeLabel: string;
  dir: 'ltr' | 'rtl';
}

export interface CustomerExperienceConfig {
  salonId: string;
  salonName: string;
  whatsappPhone: string;
  currency: string;
  currencySymbol: string;
  region: SalonRegionCode;
  address: string;
  googleMapsUrl: string;
  operatingHours: SalonOperatingHours;
  services: SalonServiceRate[];
  barbers: string[];
  activeDeals: SalonDeal[];
  availableLanguages: CustomerLanguageChoice[];
  defaultLanguage: ClientPreferredLang;
  customerProfile: {
    phone: string;
    hasSavedName: boolean;
    savedName: string | null;
    preferredLanguage: ClientPreferredLang;
  };
  todayDate: string; // YYYY-MM-DD in salon local time
}

export interface CustomerWelcomeMenuResponse {
  language: ClientPreferredLang;
  dir: 'ltr' | 'rtl';
  welcomeText: string;
  options: Array<{
    id: CustomerMenuActionId;
    label: string;
  }>;
  availableLanguages: CustomerLanguageChoice[];
}

export interface CustomerActionMessageResponse {
  language: ClientPreferredLang;
  dir: 'ltr' | 'rtl';
  action: CustomerMenuActionId | 'WELCOME';
  text: string;
  openBookingFlow?: boolean;
  showBookCta?: boolean;
  bookCtaLabel?: string;
  welcome?: CustomerWelcomeMenuResponse;
  services?: SalonServiceRate[];
  hours?: SalonOperatingHours;
  address?: string;
  googleMapsUrl?: string;
  deals?: Array<SalonDeal & { dealPagePath: string }>;
}

export interface CustomerBarberAvailability {
  name: string;
  available: boolean;
  reason?: string;
}

export interface CustomerSlotAvailability {
  timeSlot: string;
  startMinutes: number;
  availableBarberCount: number;
  barbers: CustomerBarberAvailability[];
}

export interface CustomerAvailabilityResponse {
  salonId: string;
  date: string;
  dayName: string;
  isOpen: boolean;
  closedReason?: string;
  fridayBreakText?: string;
  totalDurationMins: number;
  slots: CustomerSlotAvailability[];
  barbers: string[];
}

export interface CustomerFlowBookingRequest {
  clientPhone: string;
  clientName?: string;
  preferredLanguage?: ClientPreferredLang;
  serviceIds: string[];
  appointmentDate: string;
  timeSlot: string;
  barberName: string;
  dealId?: string;
  isDemo?: boolean;
  demoBusyBarber?: string;
  demoBusyTimeSlot?: string;
}

export interface CustomerFlowBookingResponse {
  ok: boolean;
  isDemo?: boolean;
  code?: 'SLOT_UNAVAILABLE' | 'SALON_CLOSED' | 'INVALID_DEAL' | 'NAME_REQUIRED' | 'VALIDATION_ERROR';
  error?: string;
  appointment?: ConciergeAppointment;
  appliedDeal?: {
    id: string;
    title: string;
    originalTotal: number;
    finalTotal: number;
    savings: number;
  } | null;
  currencySymbol?: string;
  address?: string;
  googleMapsUrl?: string;
}

export interface PublicDealPageResponse {
  salonId: string;
  salonName: string;
  address: string;
  googleMapsUrl: string;
  currencySymbol: string;
  deal: SalonDeal;
  isExpired: boolean;
  videoPurged: boolean;
  retentionDaysAfterExpiry: number;
  matchedServices: SalonServiceRate[];
  availableLanguages: CustomerLanguageChoice[];
}

