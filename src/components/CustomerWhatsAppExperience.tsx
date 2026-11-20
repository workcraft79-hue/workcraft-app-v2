import React, { useEffect, useMemo, useState } from 'react';
import {
  Scissors,
  Clock,
  MapPin,
  Tag,
  Calendar,
  CheckCircle2,
  X,
  Send,
  UserCheck,
  AlertTriangle,
  ExternalLink,
  Video,
  RotateCcw,
  FlaskConical,
  ChevronRight,
  Globe,
  ShieldCheck,
} from 'lucide-react';
import {
  CustomerAppointment,
  CustomerLanguage,
  SalonCustomerConfig,
  SalonDealItem,
} from '../types/customerExperience';
import { Contact } from '../types';
import { CUSTOMER_COPY } from '../data/customerExperienceI18n';
import {
  WEEK_DAYS_ORDERED,
  checkBarberAvailabilityForSlot,
  confirmCustomerAppointment,
  getAvailableTimeSlotsForDate,
  getTodayIso,
  getUpcomingDatesForSalon,
  isDealExpired,
  lookupSavedCustomerName,
} from '../services/salonCustomerStore';
import { SalonDealPage } from './SalonDealPage';

interface CustomerWhatsAppExperienceProps {
  salonConfig: SalonCustomerConfig;
  deals: SalonDealItem[];
  realAppointments: CustomerAppointment[];
  savedContacts?: Contact[];
  mode: 'LIVE' | 'DEMO';
  initialView?: 'CHAT' | 'FLOW';
  preselectedDealId?: string | null;
  onRealAppointmentConfirmed?: (appointment: CustomerAppointment) => void;
  onClose?: () => void;
  standalone?: boolean;
}

type InfoPanelType = 'NONE' | 'SERVICES' | 'HOURS_LOCATION' | 'DEALS';

interface ChatTranscriptItem {
  id: string;
  sender: 'CUSTOMER' | 'SALON';
  text?: string;
  isWelcome?: boolean;
  time: string;
}

export const CustomerWhatsAppExperience: React.FC<CustomerWhatsAppExperienceProps> = ({
  salonConfig,
  deals,
  realAppointments,
  savedContacts = [],
  mode,
  initialView = 'CHAT',
  preselectedDealId = null,
  onRealAppointmentConfirmed,
  onClose,
  standalone = false,
}) => {
  const isDemo = mode === 'DEMO';

  // Supported languages strictly guarantee English ('en') as default
  const availableLanguages = useMemo<CustomerLanguage[]>(() => {
    const base = salonConfig.supportedLanguages.includes('en')
      ? salonConfig.supportedLanguages
      : (['en', ...salonConfig.supportedLanguages] as CustomerLanguage[]);
    return Array.from(new Set(base));
  }, [salonConfig.supportedLanguages]);

  const [language, setLanguage] = useState<CustomerLanguage>('en');
  useEffect(() => {
    if (!availableLanguages.includes(language)) {
      setLanguage('en');
    }
  }, [availableLanguages, language]);

  const copy = CUSTOMER_COPY[language] || CUSTOMER_COPY.en;

  // Demo-only isolated state (never touches real appointments or backend)
  const initialDemoSeed = useMemo<CustomerAppointment[]>(() => {
    const firstActiveBarber =
      salonConfig.barbers.find((b) => b.available && b.name.includes('Tariq'))?.name ||
      salonConfig.barbers.find((b) => b.available)?.name ||
      'Tariq Mehmood';
    return [
      {
        id: 'DEMO-SEED-1',
        salonId: salonConfig.salonId,
        customerName: 'Demo Occupied Chair',
        customerPhone: '+92 300 0000001',
        serviceIds: [salonConfig.services[0]?.id || 's1'],
        serviceNames: [salonConfig.services[0]?.name || 'Master Haircut & Skin Fade'],
        totalDurationMins: 35,
        totalAmount: salonConfig.services[0]?.price || 800,
        dateIso: getTodayIso(),
        timeSlot: '05:00 PM',
        startMinutes: 17 * 60,
        barberName: firstActiveBarber,
        language: 'en',
        status: 'CONFIRMED',
        createdAtIso: new Date().toISOString(),
        isDemo: true,
      },
    ];
  }, [salonConfig.salonId, salonConfig.barbers, salonConfig.services]);

  const [demoAppointments, setDemoAppointments] = useState<CustomerAppointment[]>(initialDemoSeed);
  const [demoCustomerPreset, setDemoCustomerPreset] = useState<'NEW' | 'SAVED'>('NEW');
  const [demoSimulateDoubleBook, setDemoSimulateDoubleBook] = useState(false);

  // Active appointments pool strictly isolated by mode
  const effectiveAppointments = isDemo ? demoAppointments : realAppointments;

  // Chat state
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<ChatTranscriptItem[]>(() => [
    {
      id: 'welcome-init',
      sender: 'SALON',
      isWelcome: true,
      time: 'Now',
    },
  ]);
  const [activeInfoPanel, setActiveInfoPanel] = useState<InfoPanelType>('NONE');
  const [viewingDeal, setViewingDeal] = useState<SalonDealItem | null>(null);

  // Embedded Single-Screen Booking Flow state
  const [isFlowOpen, setIsFlowOpen] = useState(initialView === 'FLOW');
  const [flowStep, setFlowStep] = useState<'FORM' | 'CONFIRMED'>('FORM');
  const [activeDealId, setActiveDealId] = useState<string | null>(preselectedDealId);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>(() => {
    if (preselectedDealId) {
      const matchedDeal = deals.find((d) => d.id === preselectedDealId && !isDealExpired(d));
      if (matchedDeal && matchedDeal.serviceIds.length > 0) {
        return matchedDeal.serviceIds;
      }
    }
    return [];
  });

  const upcomingDates = useMemo(
    () => getUpcomingDatesForSalon(salonConfig.weeklySchedule, 7),
    [salonConfig.weeklySchedule]
  );

  const [selectedDateIso, setSelectedDateIso] = useState<string>(() => {
    const firstOpen = upcomingDates.find((d) => d.isOpen);
    return firstOpen?.dateIso || getTodayIso();
  });

  const activeServices = useMemo(
    () => salonConfig.services.filter((s) => s.active),
    [salonConfig.services]
  );

  const selectedServices = useMemo(
    () => activeServices.filter((s) => selectedServiceIds.includes(s.id)),
    [activeServices, selectedServiceIds]
  );

  const totalDurationMins = useMemo(
    () => Math.max(0, selectedServices.reduce((sum, s) => sum + (s.durationMins || 30), 0)),
    [selectedServices]
  );

  const regularSubtotal = useMemo(
    () => selectedServices.reduce((sum, s) => sum + s.price, 0),
    [selectedServices]
  );

  const appliedDeal = useMemo(() => {
    if (!activeDealId) return null;
    const found = deals.find((d) => d.id === activeDealId);
    if (!found || isDealExpired(found)) return null;
    return found;
  }, [activeDealId, deals]);

  const discountAmount = useMemo(() => {
    if (!appliedDeal) return 0;
    const applicableSubtotal = selectedServices
      .filter((s) => appliedDeal.serviceIds.includes(s.id))
      .reduce((sum, s) => sum + s.price, 0);
    const basis = applicableSubtotal > 0 ? applicableSubtotal : regularSubtotal;
    return Math.round((basis * (appliedDeal.discountPercent || 0)) / 100);
  }, [appliedDeal, selectedServices, regularSubtotal]);

  const finalTotalAmount = Math.max(0, regularSubtotal - discountAmount);

  const availableSlots = useMemo(
    () =>
      getAvailableTimeSlotsForDate({
        salonConfig,
        dateIso: selectedDateIso,
        totalDurationMins: totalDurationMins || 30,
        existingAppointments: effectiveAppointments,
      }),
    [salonConfig, selectedDateIso, totalDurationMins, effectiveAppointments]
  );

  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('');
  useEffect(() => {
    if (availableSlots.length === 0) {
      setSelectedTimeSlot('');
      return;
    }
    const stillValid = availableSlots.some((s) => s.timeSlot === selectedTimeSlot);
    if (!stillValid) {
      setSelectedTimeSlot(availableSlots[0].timeSlot);
    }
  }, [availableSlots, selectedTimeSlot]);

  const selectedSlotObj = useMemo(
    () => availableSlots.find((s) => s.timeSlot === selectedTimeSlot) || null,
    [availableSlots, selectedTimeSlot]
  );

  // Per-barber availability for the chosen date + timeSlot
  const barberStatuses = useMemo(() => {
    const slotStartMins = selectedSlotObj?.startMinutes ?? 12 * 60;
    const dur = totalDurationMins || 30;
    return salonConfig.barbers.map((barber) => ({
      barber,
      ...checkBarberAvailabilityForSlot({
        barber,
        dateIso: selectedDateIso,
        slotStartMins,
        durationMins: dur,
        existingAppointments: effectiveAppointments,
      }),
    }));
  }, [salonConfig.barbers, selectedSlotObj, totalDurationMins, selectedDateIso, effectiveAppointments]);

  const [selectedBarberChoice, setSelectedBarberChoice] = useState<string>('ANY');

  // Customer identity & conditional name prompt
  const [customerPhone, setCustomerPhone] = useState<string>(
    isDemo ? '+92 311 0009988' : '+92 311 0009988'
  );
  const savedNameMatch = useMemo(
    () => lookupSavedCustomerName(customerPhone, savedContacts),
    [customerPhone, savedContacts]
  );
  const [customerNameInput, setCustomerNameInput] = useState<string>('');
  const [flowError, setFlowError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedAppointment, setConfirmedAppointment] = useState<CustomerAppointment | null>(null);

  const handleDemoPresetChange = (preset: 'NEW' | 'SAVED') => {
    setDemoCustomerPreset(preset);
    if (preset === 'SAVED') {
      setCustomerPhone('+92 300 1234567');
      setCustomerNameInput('');
    } else {
      setCustomerPhone('+92 311 0009988');
      setCustomerNameInput('');
    }
    setFlowError(null);
  };

  // Trigger ONE single welcome screen on "Hi"
  const handleSendHiMessage = (customText?: string) => {
    const raw = (customText ?? chatInput).trim() || 'Hi';
    setChatInput('');
    setActiveInfoPanel('NONE');
    setViewingDeal(null);

    const nowLabel = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    // Single outgoing welcome message on "Hi" (no spam!)
    setMessages((prev) => [
      ...prev,
      { id: `c-${Date.now()}`, sender: 'CUSTOMER', text: raw, time: nowLabel },
      { id: `s-${Date.now() + 1}`, sender: 'SALON', isWelcome: true, time: nowLabel },
    ]);
  };

  const openBookingFlow = (deal?: SalonDealItem) => {
    setViewingDeal(null);
    setFlowError(null);
    setConfirmedAppointment(null);
    setFlowStep('FORM');

    if (deal && !isDealExpired(deal)) {
      setActiveDealId(deal.id);
      const validIds = deal.serviceIds.filter((id) => activeServices.some((s) => s.id === id));
      setSelectedServiceIds(validIds.length > 0 ? validIds : activeServices.slice(0, 1).map((s) => s.id));
    } else {
      setActiveDealId(null);
    }

    setIsFlowOpen(true);
  };

  const toggleServiceId = (id: string) => {
    setFlowError(null);
    setSelectedServiceIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleConfirmBooking = async () => {
    setFlowError(null);

    if (selectedServices.length === 0) {
      setFlowError(copy.flow.selectServiceError);
      return;
    }
    if (!selectedTimeSlot || !selectedSlotObj) {
      setFlowError(copy.flow.selectTimeError);
      return;
    }

    // Resolve chosen barber (or pick first genuinely available barber)
    const firstAvailableBarber = barberStatuses.find((b) => b.available)?.barber.name || '';
    const targetBarber =
      selectedBarberChoice === 'ANY' ? firstAvailableBarber : selectedBarberChoice;

    if (!targetBarber) {
      setFlowError(copy.flow.selectBarberError);
      return;
    }

    const effectiveName = (savedNameMatch || customerNameInput).trim();
    if (!effectiveName) {
      setFlowError(copy.flow.enterNameError);
      return;
    }

    setIsSubmitting(true);

    try {
      // Demo conflict simulator: lets owner verify double-booking guard inside Flow
      if (isDemo && demoSimulateDoubleBook) {
        setFlowError(copy.flow.doubleBookError);
        setIsSubmitting(false);
        return;
      }

      const result = await confirmCustomerAppointment({
        salonConfig,
        selectedServices,
        dateIso: selectedDateIso,
        timeSlot: selectedTimeSlot,
        barberName: targetBarber,
        customerName: effectiveName,
        customerPhone,
        language,
        totalAmount: finalTotalAmount,
        dealId: appliedDeal?.id,
        existingAppointments: effectiveAppointments,
        isDemo,
      });

      if (!result.ok) {
        setFlowError(
          result.errorCode === 'BARBER_UNAVAILABLE' || result.errorCode === 'SLOT_TAKEN'
            ? `${copy.flow.doubleBookError} (${result.message})`
            : result.message
        );
        setIsSubmitting(false);
        return;
      }

      if (isDemo) {
        setDemoAppointments((prev) => [result.appointment, ...prev]);
      } else if (onRealAppointmentConfirmed) {
        onRealAppointmentConfirmed(result.appointment);
      }

      setConfirmedAppointment(result.appointment);
      setFlowStep('CONFIRMED');
      // NOTE: Per Phase 1 rules, confirmation stays INSIDE the Flow;
      // do NOT send a separate WhatsApp confirmation message by default.
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetDemo = () => {
    setLanguage('en');
    setDemoAppointments(initialDemoSeed);
    setDemoCustomerPreset('NEW');
    setCustomerPhone('+92 311 0009988');
    setCustomerNameInput('');
    setDemoSimulateDoubleBook(false);
    setActiveInfoPanel('NONE');
    setViewingDeal(null);
    setIsFlowOpen(false);
    setFlowStep('FORM');
    setConfirmedAppointment(null);
    setSelectedServiceIds([]);
    setSelectedBarberChoice('ANY');
    setFlowError(null);
    setMessages([{ id: `welcome-reset-${Date.now()}`, sender: 'SALON', isWelcome: true, time: 'Now' }]);
  };

  const activeDeals = useMemo(
    () =>
      deals.filter(
        (d) => d.salonId === salonConfig.salonId && !isDealExpired(d)
      ),
    [deals, salonConfig.salonId]
  );

  // If currently inspecting a deal video page
  if (viewingDeal) {
    return (
      <div className={standalone ? 'min-h-screen bg-[#0D1117]' : ''}>
        <SalonDealPage
          salonConfig={salonConfig}
          deal={viewingDeal}
          language={language}
          onChangeLanguage={setLanguage}
          onBookDeal={(d) => openBookingFlow(d)}
          onBack={() => setViewingDeal(null)}
          standalone={standalone}
        />
      </div>
    );
  }

  return (
    <div
      dir={copy.dir}
      className={`${
        standalone ? 'min-h-screen bg-[#0D1117] px-2.5 py-4 sm:py-6' : ''
      } text-[#F0F6FC] font-sans`}
    >
      <div className="max-w-lg mx-auto rounded-3xl border border-[#30363D] bg-[#161B22] overflow-hidden shadow-2xl flex flex-col">
        {/* Top Demo Banner (Strictly Visible in Demo Mode) */}
        {isDemo && (
          <div className="bg-[#3B2E0B] border-b border-[#9E6A03] px-3.5 py-2.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#D29922]">
                <FlaskConical className="size-4 shrink-0" />
                <span>DEMO SANDBOX · NO REAL BOOKINGS OR MESSAGES SENT</span>
              </div>
              <button
                type="button"
                onClick={handleResetDemo}
                className="min-h-[32px] rounded-lg border border-[#9E6A03] bg-[#0D1117] px-2.5 py-1 text-[10px] font-mono font-bold text-[#F0F6FC] hover:border-[#D29922] inline-flex items-center gap-1 shrink-0"
              >
                <RotateCcw className="size-3" />
                <span>Reset</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] font-mono">
              <button
                type="button"
                onClick={() => handleDemoPresetChange(demoCustomerPreset === 'NEW' ? 'SAVED' : 'NEW')}
                className="min-h-[36px] rounded-xl border border-[#30363D] bg-[#0D1117] px-2.5 py-1 text-left flex items-center justify-between gap-1 text-[#F0F6FC] hover:border-[#06B6D4]"
              >
                <span>Profile:</span>
                <span className="text-[#06B6D4] font-bold">
                  {demoCustomerPreset === 'SAVED' ? 'Saved (Skips Name)' : 'New (Asks Name)'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setDemoSimulateDoubleBook((prev) => !prev)}
                className={`min-h-[36px] rounded-xl border px-2.5 py-1 text-left flex items-center justify-between gap-1 ${
                  demoSimulateDoubleBook
                    ? 'border-[#da3633] bg-[#4C1C1D] text-[#F85149]'
                    : 'border-[#30363D] bg-[#0D1117] text-[#8B949E]'
                }`}
              >
                <span>Conflict Test:</span>
                <span className="font-bold">{demoSimulateDoubleBook ? 'ON' : 'OFF'}</span>
              </button>
            </div>
            <p className="text-[10px] font-mono text-[#D29922]/90">
              Demo Queue: {demoAppointments.length} simulated slot(s) occupied · Try Tariq Mehmood at 05:00 PM or Bilal (Off duty) to test unavailable barbers.
            </p>
          </div>
        )}

        {/* WhatsApp Business Header */}
        <div className="px-4 py-3 bg-[#0D1117] border-b border-[#30363D] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="size-10 rounded-full bg-[#0D3822] border border-[#116329] grid place-items-center text-[#3FB950] shrink-0 font-black text-sm">
              {salonConfig.salonName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-black text-[#F0F6FC] truncate">
                  {salonConfig.salonName}
                </h2>
                <CheckCircle2 className="size-3.5 text-[#3FB950] shrink-0" />
              </div>
              <p className="text-[11px] text-[#3FB950] font-mono truncate">
                WhatsApp Business · Instant Replies
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as CustomerLanguage)}
              className="min-h-[38px] rounded-xl border border-[#30363D] bg-[#161B22] px-2 text-xs font-mono text-[#F0F6FC] focus:outline-none focus:border-[#06B6D4]"
              aria-label={copy.chooseLanguageLabel}
            >
              {availableLanguages.map((langCode) => (
                <option key={langCode} value={langCode}>
                  {CUSTOMER_COPY[langCode].langName}
                </option>
              ))}
            </select>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="min-h-[38px] min-w-[38px] rounded-xl border border-[#30363D] bg-[#161B22] hover:border-[#06B6D4] grid place-items-center text-[#8B949E] hover:text-[#F0F6FC]"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </div>

        {/* ================================================================= */}
        {/* EMBEDDED SINGLE-SCREEN WHATSAPP BOOKING FLOW                      */}
        {/* ================================================================= */}
        {isFlowOpen ? (
          <div className="p-4 sm:p-5 space-y-4 bg-[#0D1117] max-h-[78vh] overflow-y-auto">
            {/* Flow Top Header */}
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#21262D]">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase text-[#06B6D4] tracking-wider block">
                  WHATSAPP BOOKING FLOW · {salonConfig.salonName}
                </span>
                <h3 className="text-base font-black text-[#F0F6FC]">
                  {flowStep === 'CONFIRMED' ? copy.flow.successTitle : copy.flow.title}
                </h3>
                {flowStep === 'FORM' && (
                  <p className="text-[11px] text-[#8B949E] mt-0.5">{copy.flow.subtitle}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsFlowOpen(false)}
                className="min-h-[40px] min-w-[40px] rounded-xl border border-[#30363D] bg-[#161B22] grid place-items-center text-[#8B949E] hover:text-[#F0F6FC]"
                aria-label="Close booking flow"
              >
                <X className="size-4" />
              </button>
            </div>

            {flowStep === 'CONFIRMED' && confirmedAppointment ? (
              /* INSIDE-FLOW SUCCESS CONFIRMATION (No Separate Message Sent) */
              <div className="space-y-4 py-2">
                <div className="rounded-2xl border border-[#116329] bg-[#0D3822] p-4 space-y-2 text-center">
                  <CheckCircle2 className="size-10 text-[#3FB950] mx-auto" />
                  <h4 className="text-lg font-black text-[#F0F6FC]">{copy.flow.successTitle}</h4>
                  <p className="text-xs text-[#F0F6FC]/90">{copy.flow.successSubtitle}</p>
                  <p className="text-[11px] font-mono font-bold text-[#3FB950] pt-1">
                    {copy.flow.noSeparateMessageNote}
                  </p>
                </div>

                <div className="rounded-2xl border border-[#30363D] bg-[#161B22] p-4 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[#8B949E] font-mono">{copy.flow.bookingRefLabel}</span>
                    <span className="font-mono font-black text-[#06B6D4]">#{confirmedAppointment.id}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#8B949E]">Customer</span>
                    <span className="font-bold text-[#F0F6FC]">{confirmedAppointment.customerName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#8B949E]">Date &amp; Time</span>
                    <span className="font-mono font-bold text-[#F0F6FC]">
                      {confirmedAppointment.dateIso} · {confirmedAppointment.timeSlot}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#8B949E]">Barber</span>
                    <span className="font-bold text-[#D29922]">{confirmedAppointment.barberName}</span>
                  </div>
                  <div className="pt-2 border-t border-[#21262D]">
                    <span className="text-[#8B949E] block mb-1">Services ({confirmedAppointment.totalDurationMins} {copy.durationUnit}):</span>
                    <p className="text-[#F0F6FC] font-medium">
                      {confirmedAppointment.serviceNames.join(', ')}
                    </p>
                  </div>
                  <div className="pt-2 border-t border-[#21262D] flex items-center justify-between text-sm font-mono font-black">
                    <span className="text-[#8B949E]">{copy.flow.totalPayAtSalonLabel}</span>
                    <span className="text-[#3FB950]">
                      {salonConfig.currencySymbol}{confirmedAppointment.totalAmount.toLocaleString()}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#8B949E] pt-1">{copy.flow.noOnlinePaymentNote}</p>
                </div>

                <div className="rounded-2xl border border-[#30363D] bg-[#161B22] p-3 flex items-center justify-between gap-2 text-xs">
                  <span className="text-[#8B949E] flex items-center gap-1.5 min-w-0">
                    <MapPin className="size-3.5 text-[#06B6D4] shrink-0" />
                    <span className="truncate">{salonConfig.address}</span>
                  </span>
                  <a
                    href={salonConfig.googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#06B6D4] font-mono font-bold inline-flex items-center gap-1 shrink-0 hover:underline"
                  >
                    <span>Maps</span>
                    <ExternalLink className="size-3" />
                  </a>
                </div>

                <button
                  type="button"
                  onClick={() => setIsFlowOpen(false)}
                  className="w-full min-h-[48px] rounded-2xl bg-[#06B6D4] hover:bg-[#22D3EE] text-[#0D1117] font-mono font-black text-xs uppercase tracking-wider transition"
                >
                  {copy.flow.doneCta}
                </button>
              </div>
            ) : (
              /* ONE CONTINUOUS BOOKING FORM */
              <div className="space-y-4">
                {appliedDeal && (
                  <div className="rounded-2xl border border-[#9E6A03] bg-[#3B2E0B] p-3 flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <Tag className="size-4 text-[#D29922] shrink-0" />
                      <span className="font-bold text-[#F0F6FC] truncate">
                        {appliedDeal.title}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveDealId(null)}
                      className="text-[10px] font-mono text-[#D29922] hover:underline shrink-0"
                    >
                      Remove
                    </button>
                  </div>
                )}

                {/* 1. Multi-Service Selector */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-mono font-bold uppercase text-[#06B6D4]">
                      {copy.flow.selectServices}
                    </label>
                    <span className="text-[11px] font-mono text-[#8B949E]">
                      {selectedServices.length} · {totalDurationMins} {copy.durationUnit}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-1.5">
                    {activeServices.map((svc) => {
                      const checked = selectedServiceIds.includes(svc.id);
                      return (
                        <button
                          key={svc.id}
                          type="button"
                          onClick={() => toggleServiceId(svc.id)}
                          className={`min-h-[46px] rounded-xl border px-3 py-2 text-left flex items-center justify-between gap-2 transition ${
                            checked
                              ? 'border-[#06B6D4] bg-[#06B6D4]/15 text-[#F0F6FC]'
                              : 'border-[#30363D] bg-[#161B22] text-[#8B949E] hover:border-[#484F58]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className={`size-4 rounded border grid place-items-center shrink-0 ${
                                checked
                                  ? 'border-[#06B6D4] bg-[#06B6D4] text-[#0D1117]'
                                  : 'border-[#484F58]'
                              }`}
                            >
                              {checked && <CheckCircle2 className="size-3" />}
                            </span>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-[#F0F6FC] truncate">{svc.name}</p>
                              <p className="text-[10px] font-mono text-[#8B949E]">
                                {svc.durationMins || 30} {copy.durationUnit}
                              </p>
                            </div>
                          </div>
                          <span className="text-xs font-mono font-bold text-[#D29922] shrink-0">
                            {salonConfig.currencySymbol}{svc.price.toLocaleString()}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Date Picker */}
                <div className="space-y-2">
                  <label className="text-xs font-mono font-bold uppercase text-[#06B6D4] block">
                    {copy.flow.selectDate}
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {upcomingDates.map((d) => (
                      <button
                        key={d.dateIso}
                        type="button"
                        disabled={!d.isOpen}
                        onClick={() => {
                          setFlowError(null);
                          setSelectedDateIso(d.dateIso);
                        }}
                        className={`min-h-[44px] rounded-xl border px-2.5 py-1.5 text-xs font-mono text-left transition ${
                          !d.isOpen
                            ? 'border-[#21262D] bg-[#0D1117] text-[#484F58] cursor-not-allowed'
                            : selectedDateIso === d.dateIso
                            ? 'border-[#06B6D4] bg-[#06B6D4] text-[#0D1117] font-bold'
                            : 'border-[#30363D] bg-[#161B22] text-[#F0F6FC] hover:border-[#484F58]'
                        }`}
                      >
                        <div className="truncate">{d.label}</div>
                        {!d.isOpen && (
                          <div className="text-[9px] uppercase text-[#F85149]">{copy.closedLabel}</div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Genuinely Available Time Slots */}
                <div className="space-y-2">
                  <label className="text-xs font-mono font-bold uppercase text-[#06B6D4] block">
                    {copy.flow.selectTime}
                  </label>
                  {availableSlots.length === 0 ? (
                    <div className="rounded-xl border border-[#9E6A03] bg-[#3B2E0B] p-3 text-xs text-[#D29922]">
                      {copy.flow.noSlotsForDate}
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-1.5">
                      {availableSlots.map((slot) => (
                        <button
                          key={slot.timeSlot}
                          type="button"
                          onClick={() => {
                            setFlowError(null);
                            setSelectedTimeSlot(slot.timeSlot);
                          }}
                          className={`min-h-[42px] rounded-xl border px-2 py-1.5 text-xs font-mono font-bold transition ${
                            selectedTimeSlot === slot.timeSlot
                              ? 'border-[#06B6D4] bg-[#06B6D4] text-[#0D1117]'
                              : 'border-[#30363D] bg-[#161B22] text-[#F0F6FC] hover:border-[#484F58]'
                          }`}
                        >
                          {slot.timeSlot}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 4. Available Barber Selector */}
                <div className="space-y-2">
                  <label className="text-xs font-mono font-bold uppercase text-[#06B6D4] block">
                    {copy.flow.selectBarber}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setFlowError(null);
                        setSelectedBarberChoice('ANY');
                      }}
                      className={`min-h-[44px] rounded-xl border px-3 py-2 text-left text-xs font-bold transition ${
                        selectedBarberChoice === 'ANY'
                          ? 'border-[#06B6D4] bg-[#06B6D4]/15 text-[#06B6D4]'
                          : 'border-[#30363D] bg-[#161B22] text-[#F0F6FC] hover:border-[#484F58]'
                      }`}
                    >
                      {copy.flow.anyBarber}
                    </button>
                    {barberStatuses.map(({ barber, available, reason }) => (
                      <button
                        key={barber.id}
                        type="button"
                        disabled={!available && !(isDemo && demoSimulateDoubleBook)}
                        onClick={() => {
                          setFlowError(null);
                          setSelectedBarberChoice(barber.name);
                        }}
                        className={`min-h-[44px] rounded-xl border px-3 py-2 text-left text-xs transition ${
                          !available
                            ? 'border-[#21262D] bg-[#0D1117] text-[#6E7681] cursor-not-allowed'
                            : selectedBarberChoice === barber.name
                            ? 'border-[#06B6D4] bg-[#06B6D4]/15 text-[#F0F6FC] font-bold'
                            : 'border-[#30363D] bg-[#161B22] text-[#F0F6FC] hover:border-[#484F58]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="truncate font-bold">{barber.name}</span>
                          {!available && (
                            <span className="text-[10px] font-mono text-[#F85149] shrink-0">
                              {copy.flow.unavailableLabel}
                            </span>
                          )}
                        </div>
                        {!available && reason && (
                          <div className="text-[10px] text-[#8B949E] truncate">{reason}</div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 5. Conditional Customer Identity (Only ask Name if not already saved) */}
                <div className="rounded-2xl border border-[#30363D] bg-[#161B22] p-3.5 space-y-2.5">
                  <span className="text-xs font-mono font-bold uppercase text-[#06B6D4] block">
                    {copy.flow.customerDetails}
                  </span>
                  <div>
                    <label className="text-[11px] font-mono text-[#8B949E] block mb-1">
                      {copy.flow.phoneLabel}
                    </label>
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full min-h-[44px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3 text-xs font-mono text-[#F0F6FC] focus:outline-none focus:border-[#06B6D4]"
                    />
                  </div>

                  {savedNameMatch ? (
                    <div className="rounded-xl border border-[#116329] bg-[#0D3822] px-3 py-2 text-xs text-[#3FB950] flex items-center gap-2">
                      <UserCheck className="size-4 shrink-0" />
                      <span className="font-bold">{copy.flow.savedCustomerNote(savedNameMatch)}</span>
                    </div>
                  ) : (
                    <div>
                      <label className="text-[11px] font-mono text-[#8B949E] block mb-1">
                        {copy.flow.nameLabel}
                      </label>
                      <input
                        type="text"
                        value={customerNameInput}
                        onChange={(e) => {
                          setFlowError(null);
                          setCustomerNameInput(e.target.value);
                        }}
                        placeholder={copy.flow.namePlaceholder}
                        className="w-full min-h-[44px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3 text-xs text-[#F0F6FC] placeholder:text-[#484F58] focus:outline-none focus:border-[#06B6D4]"
                      />
                    </div>
                  )}
                </div>

                {/* 6. Final Booking Summary */}
                <div className="rounded-2xl border border-[#30363D] bg-[#161B22] p-3.5 space-y-2 text-xs">
                  <span className="text-xs font-mono font-bold uppercase text-[#D29922] block">
                    {copy.flow.summaryTitle}
                  </span>
                  <div className="flex items-center justify-between text-[#8B949E]">
                    <span>{copy.flow.totalDurationLabel}</span>
                    <span className="font-mono text-[#F0F6FC]">
                      {totalDurationMins} {copy.durationUnit}
                    </span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex items-center justify-between text-[#3FB950]">
                      <span>{copy.flow.discountLabel}</span>
                      <span className="font-mono font-bold">
                        -{salonConfig.currencySymbol}{discountAmount.toLocaleString()}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-1.5 border-t border-[#21262D] text-sm font-mono font-black">
                    <span className="text-[#F0F6FC]">{copy.flow.totalPayAtSalonLabel}</span>
                    <span className="text-[#06B6D4]">
                      {salonConfig.currencySymbol}{finalTotalAmount.toLocaleString()}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#8B949E]">{copy.flow.noOnlinePaymentNote}</p>
                </div>

                {flowError && (
                  <div className="rounded-xl border border-[#da3633] bg-[#4C1C1D] p-3 text-xs text-[#F85149] flex items-start gap-2">
                    <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                    <span>{flowError}</span>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleConfirmBooking}
                    className="flex-1 min-h-[50px] rounded-2xl bg-[#06B6D4] hover:bg-[#22D3EE] text-[#0D1117] font-mono font-black text-xs uppercase tracking-wider transition active:scale-[0.99] disabled:opacity-60"
                  >
                    {isSubmitting ? copy.flow.validatingCta : copy.flow.confirmCta}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsFlowOpen(false)}
                    className="min-h-[46px] px-4 rounded-2xl border border-[#30363D] bg-[#161B22] text-xs font-mono text-[#8B949E] hover:text-[#F0F6FC]"
                  >
                    {copy.flow.backToChat}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ================================================================= */
          /* WHATSAPP WELCOME & INFO CONVERSATION SCREEN                       */
          /* ================================================================= */
          <>
            <div className="p-3.5 sm:p-4 space-y-3 bg-[#0D1117] max-h-[520px] overflow-y-auto">
              {messages.map((msg) =>
                msg.sender === 'CUSTOMER' ? (
                  <div key={msg.id} className="flex justify-end">
                    <div className="max-w-[82%] rounded-2xl rounded-tr-sm bg-[#06B6D4]/20 border border-[#06B6D4]/40 px-3.5 py-2 text-xs text-[#F0F6FC]">
                      <p>{msg.text}</p>
                      <span className="block text-[9px] font-mono text-[#8B949E] text-right mt-0.5">
                        {msg.time}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div key={msg.id} className="flex justify-start">
                    <div className="w-full max-w-[94%] rounded-2xl rounded-tl-sm bg-[#161B22] border border-[#30363D] p-3.5 space-y-3">
                      <p className="text-xs sm:text-sm text-[#F0F6FC] leading-relaxed">
                        {copy.welcomeMessage(salonConfig.salonName)}
                      </p>

                      {/* Language Selector Pills (Only if multiple configured) */}
                      {availableLanguages.length > 1 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="text-[10px] font-mono text-[#8B949E] flex items-center gap-1 mr-1">
                            <Globe className="size-3 text-[#06B6D4]" />
                            <span>{copy.chooseLanguageLabel}:</span>
                          </span>
                          {availableLanguages.map((langCode) => (
                            <button
                              key={langCode}
                              type="button"
                              onClick={() => setLanguage(langCode)}
                              className={`min-h-[34px] px-2.5 py-1 rounded-xl text-[11px] font-mono font-bold border transition ${
                                language === langCode
                                  ? 'border-[#06B6D4] bg-[#06B6D4] text-[#0D1117]'
                                  : 'border-[#30363D] bg-[#0D1117] text-[#F0F6FC] hover:border-[#06B6D4]'
                              }`}
                            >
                              {CUSTOMER_COPY[langCode].langName}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* 4 Welcome Interactive Options */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => openBookingFlow()}
                          className="min-h-[46px] rounded-xl bg-[#06B6D4] hover:bg-[#22D3EE] text-[#0D1117] px-3 py-2 text-xs font-mono font-black flex items-center justify-between gap-2 transition active:scale-[0.99]"
                        >
                          <span className="flex items-center gap-2">
                            <Calendar className="size-4 shrink-0" />
                            <span>{copy.options.book}</span>
                          </span>
                          <ChevronRight className="size-4 shrink-0" />
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setActiveInfoPanel((prev) => (prev === 'SERVICES' ? 'NONE' : 'SERVICES'))
                          }
                          className={`min-h-[46px] rounded-xl border px-3 py-2 text-xs font-mono font-bold flex items-center justify-between gap-2 transition ${
                            activeInfoPanel === 'SERVICES'
                              ? 'border-[#06B6D4] bg-[#06B6D4]/15 text-[#06B6D4]'
                              : 'border-[#30363D] bg-[#0D1117] text-[#F0F6FC] hover:border-[#06B6D4]'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <Scissors className="size-4 text-[#D29922] shrink-0" />
                            <span>{copy.options.services}</span>
                          </span>
                          <ChevronRight className="size-4 shrink-0" />
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setActiveInfoPanel((prev) =>
                              prev === 'HOURS_LOCATION' ? 'NONE' : 'HOURS_LOCATION'
                            )
                          }
                          className={`min-h-[46px] rounded-xl border px-3 py-2 text-xs font-mono font-bold flex items-center justify-between gap-2 transition ${
                            activeInfoPanel === 'HOURS_LOCATION'
                              ? 'border-[#06B6D4] bg-[#06B6D4]/15 text-[#06B6D4]'
                              : 'border-[#30363D] bg-[#0D1117] text-[#F0F6FC] hover:border-[#06B6D4]'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <MapPin className="size-4 text-[#06B6D4] shrink-0" />
                            <span>{copy.options.hoursLocation}</span>
                          </span>
                          <ChevronRight className="size-4 shrink-0" />
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setActiveInfoPanel((prev) => (prev === 'DEALS' ? 'NONE' : 'DEALS'))
                          }
                          className={`min-h-[46px] rounded-xl border px-3 py-2 text-xs font-mono font-bold flex items-center justify-between gap-2 transition ${
                            activeInfoPanel === 'DEALS'
                              ? 'border-[#D29922] bg-[#3B2E0B] text-[#D29922]'
                              : 'border-[#30363D] bg-[#0D1117] text-[#F0F6FC] hover:border-[#D29922]'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <Tag className="size-4 text-[#3FB950] shrink-0" />
                            <span>{copy.options.deals}</span>
                          </span>
                          <ChevronRight className="size-4 shrink-0" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              )}

              {/* Contextual Information Panel (Services / Hours & Location / Current Active Deals) */}
              {activeInfoPanel === 'SERVICES' && (
                <div className="rounded-2xl border border-[#30363D] bg-[#161B22] p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-mono font-bold uppercase text-[#06B6D4]">
                      {copy.servicesHeading}
                    </h4>
                    <button
                      type="button"
                      onClick={() => openBookingFlow()}
                      className="min-h-[36px] rounded-xl bg-[#06B6D4] text-[#0D1117] px-3 py-1 text-[11px] font-mono font-black uppercase"
                    >
                      {copy.bookNowCta}
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {activeServices.map((svc) => (
                      <div
                        key={svc.id}
                        className="rounded-xl border border-[#30363D] bg-[#0D1117] px-3 py-2 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-[#F0F6FC] truncate">{svc.name}</p>
                          <p className="text-[10px] font-mono text-[#8B949E] flex items-center gap-1">
                            <Clock className="size-3" />
                            <span>{svc.durationMins || 30} {copy.durationUnit}</span>
                          </p>
                        </div>
                        <span className="font-mono font-bold text-[#D29922] shrink-0">
                          {salonConfig.currencySymbol}{svc.price.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeInfoPanel === 'HOURS_LOCATION' && (
                <div className="rounded-2xl border border-[#30363D] bg-[#161B22] p-3.5 space-y-3 text-xs">
                  <h4 className="text-xs font-mono font-bold uppercase text-[#06B6D4]">
                    {copy.hoursLocationHeading}
                  </h4>
                  <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3 space-y-1.5">
                    <div className="flex items-start gap-2">
                      <MapPin className="size-4 text-[#06B6D4] shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[10px] font-mono text-[#8B949E] uppercase block">
                          {copy.addressLabel}
                        </span>
                        <p className="text-[#F0F6FC] font-medium">{salonConfig.address}</p>
                      </div>
                    </div>
                    <a
                      href={salonConfig.googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-[#06B6D4] hover:underline font-mono font-bold pt-1"
                    >
                      <span>{copy.openMapsLabel}</span>
                      <ExternalLink className="size-3.5" />
                    </a>
                  </div>

                  <div className="space-y-1">
                    {WEEK_DAYS_ORDERED.map((dayKey) => {
                      const day = salonConfig.weeklySchedule[dayKey];
                      return (
                        <div
                          key={dayKey}
                          className="flex items-center justify-between rounded-lg bg-[#0D1117] px-3 py-1.5 border border-[#21262D]"
                        >
                          <span className="font-bold text-[#F0F6FC]">{copy.dayNames[dayKey]}</span>
                          {!day || !day.open ? (
                            <span className="font-mono text-[#F85149]">{copy.closedLabel}</span>
                          ) : (
                            <span className="font-mono text-[#8B949E]">
                              {day.openTime} – {day.closeTime}
                              {day.breakStart && day.breakEnd
                                ? ` (${copy.breakLabel}: ${day.breakStart}–${day.breakEnd})`
                                : ''}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {activeInfoPanel === 'DEALS' && (
                <div className="rounded-2xl border border-[#30363D] bg-[#161B22] p-3.5 space-y-2.5 text-xs">
                  <h4 className="text-xs font-mono font-bold uppercase text-[#3FB950]">
                    {copy.dealsHeading}
                  </h4>
                  {activeDeals.length === 0 ? (
                    <p className="text-[#8B949E]">{copy.noActiveDeals}</p>
                  ) : (
                    <div className="space-y-2.5">
                      {activeDeals.map((deal) => (
                        <div
                          key={deal.id}
                          className="rounded-xl border border-[#9E6A03] bg-[#0D1117] p-3 space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-bold text-[#F0F6FC]">{deal.title}</p>
                            <span className="font-mono font-black text-[#D29922] shrink-0">
                              {deal.discountPercent}% OFF
                            </span>
                          </div>
                          <p className="text-[#8B949E] leading-relaxed">{deal.description}</p>
                          <p className="text-[11px] font-mono text-[#8B949E]">
                            {copy.expiresLabel}:{' '}
                            {new Date(deal.expiresAtIso).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </p>
                          <div className="flex flex-wrap gap-2 pt-1">
                            {deal.videoUrl && (
                              <button
                                type="button"
                                onClick={() => setViewingDeal(deal)}
                                className="min-h-[42px] px-3 py-1.5 rounded-xl border border-[#30363D] bg-[#161B22] hover:border-[#06B6D4] text-[#06B6D4] font-mono font-bold inline-flex items-center gap-1.5"
                              >
                                <Video className="size-3.5" />
                                <span>{copy.watchVideoCta}</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openBookingFlow(deal)}
                              className="min-h-[42px] px-3.5 py-1.5 rounded-xl bg-[#06B6D4] hover:bg-[#22D3EE] text-[#0D1117] font-mono font-black inline-flex items-center gap-1.5"
                            >
                              <Calendar className="size-3.5" />
                              <span>{copy.bookThisDealCta}</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bottom WhatsApp Input Row */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendHiMessage();
              }}
              className="p-3 border-t border-[#30363D] bg-[#161B22] flex items-center gap-2"
            >
              <button
                type="button"
                onClick={() => handleSendHiMessage('Hi')}
                className="min-h-[44px] px-3 rounded-xl border border-[#30363D] bg-[#0D1117] hover:border-[#06B6D4] text-xs font-mono font-bold text-[#06B6D4] shrink-0"
              >
                {copy.sendHiQuick}
              </button>
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={copy.inputPlaceholder}
                className="flex-1 min-w-0 min-h-[44px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3 text-xs text-[#F0F6FC] placeholder:text-[#484F58] focus:outline-none focus:border-[#06B6D4]"
              />
              <button
                type="submit"
                className="min-h-[44px] min-w-[44px] rounded-xl bg-[#06B6D4] hover:bg-[#22D3EE] text-[#0D1117] grid place-items-center shrink-0"
                aria-label="Send message"
              >
                <Send className="size-4" />
              </button>
            </form>
          </>
        )}

        {/* Footer note */}
        <div className="px-4 py-2 bg-[#0D1117] border-t border-[#21262D] flex items-center justify-between text-[10px] font-mono text-[#6E7681]">
          <span className="flex items-center gap-1">
            <ShieldCheck className="size-3 text-[#3FB950]" />
            <span>Pay at Salon · Unsolicited promo videos disabled</span>
          </span>
          <span>{isDemo ? 'DEMO' : 'LIVE FLOW'}</span>
        </div>
      </div>
    </div>
  );
};
