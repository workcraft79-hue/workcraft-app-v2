export type SalonRegionCode = 'PK' | 'MENA' | 'INTL';

export type SalonPackageTier = 'STARTER' | 'PRO' | 'PRO++' | 'CUSTOM';

export type SalonBillingStatus = 'PENDING_ACTIVATION' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED';

export type ClientPreferredLang =
  | 'en'
  | 'roman_ur'
  | 'ur'
  | 'ar'
  | 'it'
  | 'ru'
  | 'fr'
  | 'de'
  | 'es';

export type SalonCategory = 'MENS' | 'LADIES';

export type DealDiscountType = 'PCT' | 'FIXED' | 'BUNDLE_PRICE';

export type AdAttributionChannel = 'FB' | 'IG' | 'TIKTOK' | 'QR' | 'WEB_LINK' | 'DIRECT';

export interface SalonServiceRate {
  id?: string;
  name: string;
  price: number;
  durationMins?: number;
  bufferAfterMins?: number;
  eligibleStylists?: string[];
  active?: boolean;
  translations?: Partial<Record<ClientPreferredLang, string>>;
}

export interface SalonOperatingHours {
  monThuOpen: string;
  monThuClose: string;
  monThuClosed?: boolean;
  fridayOpen: string;
  fridayClose: string;
  fridayBreakStart?: string;
  fridayBreakEnd?: string;
  fridayClosed?: boolean;
  satSunOpen: string;
  satSunClose: string;
  satSunClosed?: boolean;
}

export interface SalonDeal {
  id: string;
  salonId: string;
  title: string;
  description: string;
  adChannel?: AdAttributionChannel;
  titleTranslations?: Partial<Record<ClientPreferredLang, string>>;
  descriptionTranslations?: Partial<Record<ClientPreferredLang, string>>;
  discountType: DealDiscountType;
  discountValue: number;
  serviceIds: string[];
  serviceNames: string[];
  startsAt: string;
  expiresAt: string;
  videoUrl?: string;
  videoFileName?: string;
  videoMimeType?: string;
  videoRetentionDaysAfterExpiry: number;
  videoDeletedAt?: string | null;
  active: boolean;
  createdAt: string;
}

export interface StylistLeaveRecord {
  id: string;
  salonId: string;
  stylistName: string;
  date: string;
  startTime?: string;
  endTime?: string;
  fullDay?: boolean;
  reason?: string;
  createdAt: string;
}

export interface MonthlyUsageMeter {
  billingMonth: string;
  planTier: SalonPackageTier;
  monthlyLimit: number;
  graceLimit: number;
  billableBookings: number;
  overageBookings: number;
  remainingInPlan: number;
  pctUsed: number;
  status: 'OK' | 'WARN_80' | 'WARN_90' | 'GRACE' | 'BLOCKED';
  metaMessagesUsed?: number;
  metaMonthlyLimit?: number;
}

export interface RetentionSettings {
  salonId: string;
  publicCode: string;
  salonName: string;
  ownerName: string;
  ownerAuthPhone: string;
  publicContactPhone: string;
  publicWhatsappPhone?: string;
  whatsappPhone: string;
  whatsappAddonEnabled?: boolean;
  metaPhoneNumberId?: string;
  countryCode: string;
  timezoneIana?: string;
  timezoneOffsetHours: number;
  currency: string;
  currencySymbol: string;
  defaultLang?: ClientPreferredLang;
  regionConfirmedByOwner?: boolean;
  packageTier: SalonPackageTier;
  billingStatus: SalonBillingStatus;
  salonCategory?: SalonCategory;
  counterSleptAt?: string | null;
  birthdayEnabled: boolean;
  birthdayEventName?: string;
  birthdayDiscountPct: number;
  birthdayFixedDiscount: number;
  birthdayGiftService: string;
  birthdayMessageTemplate: string;
  winbackEnabled: boolean;
  winbackDays: number;
  winbackDiscountPct: number;
  winbackFixedDiscount?: number;
  winbackAddonService: string;
  winbackMessageTemplate: string;
  reviewBoosterEnabled: boolean;
  googleReviewUrl: string;
  address?: string;
  googleMapsUrl?: string;
  operatingHours?: SalonOperatingHours;
  enabledClientLanguages?: ClientPreferredLang[];
  videoRetentionDaysAfterExpiry?: number;
  enabledServices?: SalonServiceRate[];
  updatedAt?: string;
}

export interface ConciergeClientProfile {
  id: string;
  salonId: string;
  name: string;
  phone: string;
  preferredLanguage: ClientPreferredLang | null;
  awaitingLanguageSelection: boolean;
  birthDate: string;
  lastCompletedVisitAt: string | null;
  lastBirthdaySentYear: number | null;
  lastWinbackSentAt: string | null;
  awaitingWinbackRebook: boolean;
  awaitingReviewAppointmentId: string | null;
  marketingOptIn?: boolean;
  totalVisits?: number;
  lastServiceIds?: string[];
  lastBarberName?: string | null;
  pendingReroute?: {
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
  } | null;
  pendingReschedule?: {
    requestedAt: string;
    preferredService: string;
    alternatives: Array<{
      index: string;
      barberName: string;
      timeSlot: string;
      dateLabel: string;
    }>;
  } | null;
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
  appointmentDate?: string;
  timeSlot: string;
  durationMins?: number;
  scheduledEndMs?: number;
  dealId?: string | null;
  bookedDealTitle?: string;
  adSource?: AdAttributionChannel;
  idempotencyKey?: string;
  proofHash?: string;
  flagged?: boolean;
  canceled?: boolean;
  sourceType?:
    | 'WHATSAPP_BOT'
    | 'WALK_IN_BUSY'
    | 'WEB_QR'
    | 'WEB_LINK'
    | 'FB_AD'
    | 'IG_AD'
    | 'TIKTOK_AD'
    | 'OWNER_WALKIN';
  status: 'CONFIRMED' | 'IN_CHAIR' | 'COMPLETED' | 'CANCELED';
  scheduledForIso: string;
  completedAt: string | null;
  reviewPromptSentAt: string | null;
  rating: number | null;
  ratingComment: string | null;
  reviewRoutedStatus: 'PENDING' | 'PROMPT_SENT' | 'PUBLIC_GOOGLE_SENT' | 'OWNER_INTERVENTION_NEEDED';
}

export interface BookingAuditEntry {
  id: string;
  salonId: string;
  bookingId: string;
  actorType: 'CUSTOMER' | 'OWNER' | 'SYSTEM';
  action: 'CREATED' | 'RESCHEDULED' | 'CANCELED' | 'IN_CHAIR' | 'COMPLETED';
  note: string;
  createdAt: string;
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
  busyMinutes?: number;
  lockedAtIso?: string;
  expiresAtMs?: number;
  reason?: string;
}

export interface OwnerInterventionAlert {
  id: string;
  salonId: string;
  clientId?: string;
  appointmentId: string;
  clientName: string;
  clientPhone: string;
  service?: string;
  rating: number;
  feedbackText: string;
  status: 'OWNER_INTERVENTION_NEEDED' | 'RESOLVED';
  createdAt: string;
  resolvedAt?: string | null;
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
  timestamp?: string;
  createdAt?: string;
  eventMetadata?: {
    eventType:
      | 'APPOINTMENT_CONFIRMED'
      | 'APPOINTMENT_CANCELED'
      | 'BARBER_BUSY_REROUTED'
      | 'URGENT_BRIDAL_GROOM'
      | 'REMINDER_REPLY_CONFIRMED'
      | 'REMINDER_REPLY_LATE'
      | 'REMINDER_REPLY_RESCHEDULE'
      | 'RESCHEDULE_CONFIRMED'
      | 'PRICE_MENU_SENT'
      | 'CHAIR_LOCKED_BUSY';
    barberName?: string;
    services?: string;
    timeSlot?: string;
    dateLabel?: string;
    clientId?: string;
  };
}

export interface LanguageMenuOption {
  index?: string;
  digit: '1' | '2' | '3' | '4';
  lang: ClientPreferredLang;
  label?: string;
  nativeLabel: string;
  dir?: 'ltr' | 'rtl';
}

export interface WalkInQueueItem {
  id: string;
  salonId: string;
  clientName: string;
  phone?: string;
  service?: string;
  serviceName?: string;
  assignedStaff?: string;
  assignedBarber?: string;
  etaMinutes?: number;
  estimatedWaitMins?: number;
  status: 'WAITING' | 'NOTIFIED' | 'SEATED';
  createdAt: string;
}

export interface BridalBookingRecord {
  id: string;
  salonId: string;
  brideOrEventName: string;
  phone?: string;
  clientPhone?: string;
  eventDate: string;
  trialDate?: string;
  packageName: string;
  assignedStylist: string;
  totalAmount: number;
  advancePaid: number;
  homeService?: boolean;
  status: 'ADVANCE_LOCKED' | 'BOOKED' | 'SETTLED';
  createdAt: string;
}

export interface ServicePackagePass {
  id: string;
  salonId: string;
  clientName: string;
  phone?: string;
  clientPhone?: string;
  packageTitle: string;
  totalSessions: number;
  usedSessions: number;
  remainingSessions?: number;
  pricePaid?: number;
  amountPaid?: number;
  status?: 'ACTIVE' | 'COMPLETED';
  updatedAt?: string;
  createdAt?: string;
}

export interface RetentionOpportunityItem {
  clientId: string;
  clientName: string;
  clientPhone: string;
  reason: 'BIRTHDAY' | 'DORMANT_30D';
  daysSinceLastVisit?: number;
  suggestedMessage: string;
  whatsappHandoffUrl: string;
}

export interface SalonConciergeStateResponse {
  salonId: string;
  publicCode: string;
  region: SalonRegionCode;
  regionLabel: string;
  languageOptions: LanguageMenuOption[];
  greetingPromptPreview: string;
  settings: RetentionSettings;
  clients: ConciergeClientProfile[];
  appointments: ConciergeAppointment[];
  chairLocks: ChairLock[];
  barbers: string[];
  stylistLeaves: StylistLeaveRecord[];
  alerts: OwnerInterventionAlert[];
  logs: WhatsAppMessageLog[];
  walkInQueue: WalkInQueueItem[];
  bridalBookings: BridalBookingRecord[];
  servicePackages: ServicePackagePass[];
  deals: SalonDeal[];
  usageMeter: MonthlyUsageMeter;
  opportunities: RetentionOpportunityItem[];
  bookingAuditLog: BookingAuditEntry[];
}

export interface CustomerLanguageChoice {
  lang: ClientPreferredLang;
  label?: string;
  nativeLabel: string;
  dir: 'ltr' | 'rtl';
}

export type CustomerMenuActionId =
  | 'BOOK_APPOINTMENT'
  | 'SERVICES_PRICES'
  | 'HOURS_LOCATION'
  | 'CURRENT_DEALS';

export interface CustomerWelcomeMenuResponse {
  language: ClientPreferredLang;
  dir: 'ltr' | 'rtl';
  welcomeText: string;
  options: Array<{ id: CustomerMenuActionId; label: string }>;
  availableLanguages: CustomerLanguageChoice[];
}

export interface CustomerActionMessageResponse {
  language: ClientPreferredLang;
  dir: 'ltr' | 'rtl';
  action: CustomerMenuActionId | 'WELCOME';
  text: string;
  showBookCta?: boolean;
  bookCtaLabel?: string;
  openBookingFlow?: boolean;
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
  publicCode: string;
  date: string;
  dayName: string;
  isOpen: boolean;
  closedReason?: string;
  fridayBreakText?: string;
  totalDurationMins: number;
  slots: CustomerSlotAvailability[];
  barbers: string[];
}

export interface ReturningClientSnapshot {
  clientId?: string;
  clientName: string;
  maskedPhone: string;
  preferredLanguage: ClientPreferredLang;
  totalVisits: number;
  lastServiceIds: string[];
  lastBarberName?: string | null;
  marketingOptIn: boolean;
}

export interface CustomerExperienceConfig {
  salonId: string;
  publicCode: string;
  salonName: string;
  salonCategory: SalonCategory;
  region: SalonRegionCode;
  currency: string;
  currencySymbol: string;
  timezoneIana: string;
  publicContactPhone: string;
  publicWhatsappPhone?: string;
  whatsappAddonEnabled: boolean;
  address: string;
  googleMapsUrl: string;
  googleReviewUrl: string;
  operatingHours: SalonOperatingHours;
  availableLanguages: CustomerLanguageChoice[];
  defaultLanguage: ClientPreferredLang;
  services: SalonServiceRate[];
  barbers: string[];
  activeDeals: Array<SalonDeal & { dealPagePath: string }>;
  returningClient: ReturningClientSnapshot | null;
  todayDate: string;
  usageStatus: MonthlyUsageMeter['status'];
}

export interface CustomerFlowBookingRequest {
  serviceIds: string[];
  appointmentDate: string;
  timeSlot: string;
  barberName: string;
  clientPhone?: string;
  clientName?: string;
  verifiedClientId?: string;
  preferredLanguage?: ClientPreferredLang;
  dealId?: string | null;
  adSource?: AdAttributionChannel;
  idempotencyKey?: string;
  marketingOptIn?: boolean;
  isDemo?: boolean;
  demoBusyBarber?: string;
  demoBusyTimeSlot?: string;
}

export interface CustomerFlowBookingResponse {
  ok: boolean;
  isDemo?: boolean;
  code?:
    | 'SLOT_UNAVAILABLE'
    | 'NAME_REQUIRED'
    | 'INVALID_DEAL'
    | 'SALON_CLOSED'
    | 'QUOTA_EXCEEDED'
    | 'VALIDATION_ERROR';
  error?: string;
  publicContactPhone?: string;
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
  bookingManagementToken?: string;
  bookingManagementPath?: string;
  personalReturningShareUrl?: string;
  maskedPhone?: string;
}

export interface BookingManagementPayload {
  ok: boolean;
  bookingId: string;
  bookingRef: string;
  salonPublicCode: string;
  salonName: string;
  publicContactPhone: string;
  publicWhatsappPhone?: string;
  clientName: string;
  maskedPhone: string;
  service: string;
  serviceIds: string[];
  barberName: string;
  appointmentDate: string;
  timeSlot: string;
  durationMins: number;
  totalPrice: number;
  currencySymbol: string;
  status: 'CONFIRMED' | 'IN_CHAIR' | 'COMPLETED' | 'CANCELED';
  address: string;
  googleMapsUrl: string;
  googleReviewUrl: string | null;
  preferredLanguage: ClientPreferredLang;
  icsContent: string;
}

export interface PublicDealPageResponse {
  salonId: string;
  publicCode: string;
  salonName: string;
  salonCategory: SalonCategory;
  currencySymbol: string;
  address: string;
  googleMapsUrl: string;
  availableLanguages: CustomerLanguageChoice[];
  defaultLanguage: ClientPreferredLang;
  deal: SalonDeal;
  services: SalonServiceRate[];
  matchedServices: SalonServiceRate[];
  retentionDaysAfterExpiry?: number;
  isExpired: boolean;
  videoPurged: boolean;
}
