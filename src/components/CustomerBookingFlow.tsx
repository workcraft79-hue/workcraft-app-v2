import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  MapPin,
  Scissors,
  Sparkles,
  Tag,
  User,
  X,
} from 'lucide-react';
import type {
  ClientPreferredLang,
  CustomerAvailabilityResponse,
  CustomerExperienceConfig,
  CustomerFlowBookingResponse,
  SalonDeal,
} from '../types/concierge';

interface CustomerBookingFlowProps {
  salonId: string;
  initialDealId?: string | null;
  initialLang?: ClientPreferredLang;
  initialClientPhone?: string;
  isDemo?: boolean;
  demoForceNewCustomer?: boolean;
  demoSavedCustomerName?: string;
  demoBusyBarber?: string;
  demoBusyTimeSlot?: string;
  standalone?: boolean;
  onBookingConfirmed?: (res: CustomerFlowBookingResponse) => void;
  onClose?: () => void;
}

interface FlowCopy {
  flowTitle: string;
  demoBadge: string;
  selectServices: string;
  selectDate: string;
  selectTime: string;
  selectBarber: string;
  yourDetails: string;
  yourNamePlaceholder: string;
  yourPhoneLabel: string;
  bookedForLabel: string;
  summaryTitle: string;
  totalLabel: string;
  durationLabel: string;
  payAtSalonNote: string;
  confirmBtn: string;
  confirmingBtn: string;
  noSlotsForDate: string;
  closedOnDate: string;
  unavailableLabel: string;
  availableLabel: string;
  confirmedTitle: string;
  confirmedSubtitle: string;
  bookingIdLabel: string;
  openMapsBtn: string;
  doneBtn: string;
  bookAnotherBtn: string;
  dealAppliedLabel: string;
  dealSavingsLabel: string;
  minShort: string;
}

const FLOW_COPY: Record<ClientPreferredLang, FlowCopy> = {
  en: {
    flowTitle: 'Book Appointment',
    demoBadge: 'LIVE DEMO FLOW',
    selectServices: '1. Select Services',
    selectDate: '2. Choose Date',
    selectTime: '3. Available Time Slots',
    selectBarber: '4. Choose Available Barber',
    yourDetails: '5. Your Details',
    yourNamePlaceholder: 'Enter your full name',
    yourPhoneLabel: 'WhatsApp Number',
    bookedForLabel: 'Saved Profile',
    summaryTitle: 'Booking Summary',
    totalLabel: 'Total',
    durationLabel: 'Duration',
    payAtSalonNote: 'Pay at the salon counter after your service. No online prepayment.',
    confirmBtn: 'Confirm Appointment',
    confirmingBtn: 'Confirming...',
    noSlotsForDate: 'No open slots left for this date & duration. Try another date.',
    closedOnDate: 'Salon is closed on this date.',
    unavailableLabel: 'Unavailable',
    availableLabel: 'Available',
    confirmedTitle: 'Appointment Confirmed',
    confirmedSubtitle: 'Your chair is reserved. Confirmation stays right here inside this Flow.',
    bookingIdLabel: 'Booking Ref',
    openMapsBtn: 'Open Location in Google Maps',
    doneBtn: 'Done',
    bookAnotherBtn: 'Book Another Slot',
    dealAppliedLabel: 'Deal Applied',
    dealSavingsLabel: 'You Save',
    minShort: 'min',
  },
  roman_ur: {
    flowTitle: 'Appointment Book Karein',
    demoBadge: 'LIVE DEMO FLOW',
    selectServices: '1. Services Chunein',
    selectDate: '2. Tareekh (Date) Chunein',
    selectTime: '3. Khali Time Slots',
    selectBarber: '4. Dastyab Barber Chunein',
    yourDetails: '5. Aap Ki Maloomat',
    yourNamePlaceholder: 'Apna mukammal naam likhein',
    yourPhoneLabel: 'WhatsApp Number',
    bookedForLabel: 'Mehfooz Profile',
    summaryTitle: 'Booking Summary',
    totalLabel: 'Kul Raqam',
    durationLabel: 'Waqt',
    payAtSalonNote: 'Service ke baad salon par cash ada karein. Koi online payment nahi.',
    confirmBtn: 'Confirm Appointment',
    confirmingBtn: 'Confirm ho raha hai...',
    noSlotsForDate: 'Is tareekh par is duration ke liye koi slot khali nahi.',
    closedOnDate: 'Is din salon band hai.',
    unavailableLabel: 'Masroof',
    availableLabel: 'Khali',
    confirmedTitle: 'Appointment Confirm Ho Gayi',
    confirmedSubtitle: 'Aap ki chair reserve ho chuki hai. Mukammal tafseel yahin mojood hai.',
    bookingIdLabel: 'Booking Ref',
    openMapsBtn: 'Google Maps Par Location Kholein',
    doneBtn: 'Mukammal (Done)',
    bookAnotherBtn: 'Naya Slot Book Karein',
    dealAppliedLabel: 'Deal Laagu',
    dealSavingsLabel: 'Bachat',
    minShort: 'min',
  },
  ur: {
    flowTitle: 'اپائنٹمنٹ بک کریں',
    demoBadge: 'لائیو ڈیمو فلو',
    selectServices: '1. سروسز منتخب کریں',
    selectDate: '2. تاریخ منتخب کریں',
    selectTime: '3. دستیاب اوقات',
    selectBarber: '4. دستیاب باربر منتخب کریں',
    yourDetails: '5. آپ کی تفصیلات',
    yourNamePlaceholder: 'اپنا مکمل نام لکھیں',
    yourPhoneLabel: 'واٹس ایپ نمبر',
    bookedForLabel: 'محفوظ پروفائل',
    summaryTitle: 'بکنگ کا خلاصہ',
    totalLabel: 'کل رقم',
    durationLabel: 'دورانیہ',
    payAtSalonNote: 'سروس کے بعد کاؤنٹر پر ادائیگی کریں۔ کوئی آن لائن ادائیگی درکار نہیں۔',
    confirmBtn: 'اپائنٹمنٹ کنفرم کریں',
    confirmingBtn: 'تصدیق ہو رہی ہے...',
    noSlotsForDate: 'اس تاریخ پر اس دورانیے کے لیے کوئی وقت دستیاب نہیں۔',
    closedOnDate: 'اس دن سیلون بند ہے۔',
    unavailableLabel: 'مصروف',
    availableLabel: 'دستیاب',
    confirmedTitle: 'اپائنٹمنٹ کنفرم ہو گئی',
    confirmedSubtitle: 'آپ کی کرسی محفوظ کر دی گئی ہے۔ تصدیق یہیں اسی فلو میں دستیاب ہے۔',
    bookingIdLabel: 'بکنگ ریفرنس',
    openMapsBtn: 'گوگل میپس پر لوکیشن دیکھیں',
    doneBtn: 'مکمل',
    bookAnotherBtn: 'نئی بکنگ کریں',
    dealAppliedLabel: 'ڈیل لاگو',
    dealSavingsLabel: 'بچت',
    minShort: 'منٹ',
  },
  ar: {
    flowTitle: 'حجز موعد',
    demoBadge: 'عرض تجريبي مباشر',
    selectServices: '1. اختر الخدمات',
    selectDate: '2. اختر التاريخ',
    selectTime: '3. الأوقات المتاحة',
    selectBarber: '4. اختر الحلاق المتاح',
    yourDetails: '5. بياناتك',
    yourNamePlaceholder: 'أدخل اسمك الكامل',
    yourPhoneLabel: 'رقم الواتساب',
    bookedForLabel: 'ملف محفوظ',
    summaryTitle: 'ملخص الحجز',
    totalLabel: 'الإجمالي',
    durationLabel: 'المدة',
    payAtSalonNote: 'الدفع في الصالون بعد الخدمة. لا يوجد دفع إلكتروني.',
    confirmBtn: 'تأكيد الموعد',
    confirmingBtn: 'جاري التأكيد...',
    noSlotsForDate: 'لا توجد أوقات متاحة لهذا التاريخ والمدة.',
    closedOnDate: 'الصالون مغلق في هذا اليوم.',
    unavailableLabel: 'غير متاح',
    availableLabel: 'متاح',
    confirmedTitle: 'تم تأكيد الموعد',
    confirmedSubtitle: 'تم حجز موعدك بنجاح داخل هذه النافذة مباشرة.',
    bookingIdLabel: 'رقم الحجز',
    openMapsBtn: 'فتح الموقع في خرائط جوجل',
    doneBtn: 'تم',
    bookAnotherBtn: 'حجز موعد آخر',
    dealAppliedLabel: 'العرض المطبق',
    dealSavingsLabel: 'توفير',
    minShort: 'دقيقة',
  },
};

function buildUpcomingDates(baseDateStr: string, count = 10): Array<{ date: string; top: string; sub: string }> {
  const parts = baseDateStr.split('-').map((n) => parseInt(n, 10));
  const base =
    parts.length === 3 && !parts.some((n) => Number.isNaN(n))
      ? new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12, 0, 0))
      : new Date();
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const out: Array<{ date: string; top: string; sub: string }> = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(base.getTime() + i * 86400000);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    out.push({
      date: `${yyyy}-${mm}-${dd}`,
      top: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : weekdays[d.getUTCDay()],
      sub: `${dd} ${months[d.getUTCMonth()]}`,
    });
  }
  return out;
}

export const CustomerBookingFlow: React.FC<CustomerBookingFlowProps> = ({
  salonId,
  initialDealId = null,
  initialLang = 'en',
  initialClientPhone = '+92 300 0000000',
  isDemo = false,
  demoForceNewCustomer,
  demoSavedCustomerName,
  demoBusyBarber,
  demoBusyTimeSlot,
  standalone = false,
  onBookingConfirmed,
  onClose,
}) => {
  const [config, setConfig] = useState<CustomerExperienceConfig | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [activeLang, setActiveLang] = useState<ClientPreferredLang>(initialLang || 'en');
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [availability, setAvailability] = useState<CustomerAvailabilityResponse | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('');
  const [selectedBarber, setSelectedBarber] = useState<string>('');
  const [clientPhone, setClientPhone] = useState<string>(initialClientPhone);
  const [clientNameInput, setClientNameInput] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmedResult, setConfirmedResult] = useState<CustomerFlowBookingResponse | null>(null);
  const [availabilityReloadTick, setAvailabilityReloadTick] = useState(0);

  useEffect(() => {
    setActiveLang(initialLang || 'en');
  }, [initialLang]);

  useEffect(() => {
    setClientPhone(initialClientPhone);
  }, [initialClientPhone]);

  useEffect(() => {
    let cancelled = false;
    setLoadingConfig(true);
    setErrorMsg(null);
    const params = new URLSearchParams();
    if (clientPhone.trim()) params.set('phone', clientPhone.trim());
    params.set('lang', activeLang);
    fetch(`/api/public/salons/${encodeURIComponent(salonId)}/customer-experience?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load salon'))))
      .then((data: CustomerExperienceConfig) => {
        if (cancelled) return;
        setConfig(data);
        setSelectedDate((prev) => prev || data.todayDate);

        // Pre-select services from deal if provided, otherwise first service
        setSelectedServiceIds((prev) => {
          if (prev.length > 0) return prev;
          if (initialDealId) {
            const matchedDeal = data.activeDeals.find((d) => d.id === initialDealId);
            if (matchedDeal && matchedDeal.serviceIds.length > 0) {
              return matchedDeal.serviceIds;
            }
          }
          const first = data.services[0];
          return first ? [first.id || first.name] : [];
        });
      })
      .catch(() => {
        if (!cancelled) setErrorMsg('Unable to load salon booking details.');
      })
      .finally(() => {
        if (!cancelled) setLoadingConfig(false);
      });
    return () => {
      cancelled = true;
    };
  }, [salonId, initialDealId, clientPhone]);

  const activeDeal: SalonDeal | null = useMemo(() => {
    if (!config || !initialDealId) return null;
    return config.activeDeals.find((d) => d.id === initialDealId) || null;
  }, [config, initialDealId]);

  const selectedServices = useMemo(() => {
    if (!config) return [];
    return config.services.filter((s) =>
      selectedServiceIds.includes(s.id || s.name)
    );
  }, [config, selectedServiceIds]);

  const { originalTotal, finalTotal, savings, totalDurationMins } = useMemo(() => {
    const orig = selectedServices.reduce((sum, s) => sum + (Number(s.price) || 0), 0);
    const dur = Math.max(
      15,
      selectedServices.reduce((sum, s) => sum + (Number(s.durationMins) || 35), 0)
    );
    let finalAmt = orig;
    if (activeDeal && orig > 0) {
      if (activeDeal.discountType === 'PCT') {
        finalAmt = Math.max(0, Math.round(orig * (1 - activeDeal.discountValue / 100)));
      } else if (activeDeal.discountType === 'FIXED') {
        finalAmt = Math.max(0, orig - activeDeal.discountValue);
      } else if (activeDeal.discountType === 'BUNDLE_PRICE') {
        finalAmt = Math.max(0, Math.min(orig, activeDeal.discountValue));
      }
    }
    return {
      originalTotal: orig,
      finalTotal: finalAmt,
      savings: Math.max(0, orig - finalAmt),
      totalDurationMins: dur,
    };
  }, [selectedServices, activeDeal]);

  useEffect(() => {
    if (!selectedDate) return;
    let cancelled = false;
    setLoadingSlots(true);
    const params = new URLSearchParams({
      date: selectedDate,
      durationMins: String(totalDurationMins),
    });
    if (isDemo) {
      params.set('isDemo', 'true');
      if (demoBusyBarber) params.set('demoBusyBarber', demoBusyBarber);
      if (demoBusyTimeSlot) params.set('demoBusyTimeSlot', demoBusyTimeSlot);
    }
    fetch(`/api/public/salons/${encodeURIComponent(salonId)}/availability?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed availability'))))
      .then((data: CustomerAvailabilityResponse) => {
        if (cancelled) return;
        setAvailability(data);
        if (!data.isOpen || data.slots.length === 0) {
          setSelectedTimeSlot('');
          setSelectedBarber('');
          return;
        }
        const stillValidSlot = data.slots.find((s) => s.timeSlot === selectedTimeSlot);
        const chosenSlot = stillValidSlot || data.slots[0];
        if (chosenSlot) {
          setSelectedTimeSlot(chosenSlot.timeSlot);
          const stillValidBarber = chosenSlot.barbers.find(
            (b) => b.name === selectedBarber && b.available
          );
          const firstAvailBarber = chosenSlot.barbers.find((b) => b.available);
          setSelectedBarber(stillValidBarber?.name || firstAvailBarber?.name || '');
        }
      })
      .catch(() => {
        if (!cancelled) setAvailability(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    salonId,
    selectedDate,
    totalDurationMins,
    isDemo,
    demoBusyBarber,
    demoBusyTimeSlot,
    availabilityReloadTick,
  ]);

  const currentSlotObj = useMemo(() => {
    if (!availability || !selectedTimeSlot) return null;
    return availability.slots.find((s) => s.timeSlot === selectedTimeSlot) || null;
  }, [availability, selectedTimeSlot]);

  const effectiveSavedName = useMemo(() => {
    if (isDemo && typeof demoForceNewCustomer === 'boolean') {
      if (demoForceNewCustomer) return null;
      return demoSavedCustomerName || config?.customerProfile.savedName || 'Bilal Ahmed';
    }
    return config?.customerProfile.hasSavedName ? config.customerProfile.savedName : null;
  }, [isDemo, demoForceNewCustomer, demoSavedCustomerName, config]);

  const copy = FLOW_COPY[activeLang] || FLOW_COPY.en;
  const dir: 'ltr' | 'rtl' = activeLang === 'ur' || activeLang === 'ar' ? 'rtl' : 'ltr';
  const upcomingDates = useMemo(
    () => buildUpcomingDates(config?.todayDate || new Date().toISOString().slice(0, 10), 10),
    [config?.todayDate]
  );

  const toggleService = (svcId: string) => {
    setErrorMsg(null);
    setSelectedServiceIds((prev) => {
      if (prev.includes(svcId)) {
        return prev.length > 1 ? prev.filter((id) => id !== svcId) : prev;
      }
      return [...prev, svcId];
    });
  };

  const handleSelectSlot = (slotTime: string) => {
    setErrorMsg(null);
    setSelectedTimeSlot(slotTime);
    const slot = availability?.slots.find((s) => s.timeSlot === slotTime);
    if (slot) {
      const keepCurrent = slot.barbers.find((b) => b.name === selectedBarber && b.available);
      if (!keepCurrent) {
        const nextAvail = slot.barbers.find((b) => b.available);
        setSelectedBarber(nextAvail?.name || '');
      }
    }
  };

  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    setErrorMsg(null);

    if (selectedServiceIds.length === 0) {
      setErrorMsg('Please select at least one service.');
      return;
    }
    if (!selectedDate || !selectedTimeSlot || !selectedBarber) {
      setErrorMsg('Please select an available date, time slot, and barber.');
      return;
    }
    if (!effectiveSavedName && !clientNameInput.trim()) {
      setErrorMsg('Please enter your name before confirming.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/public/salons/${encodeURIComponent(salonId)}/flow/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientPhone: clientPhone.trim() || '+92 300 0000000',
          clientName: effectiveSavedName || clientNameInput.trim(),
          preferredLanguage: activeLang,
          serviceIds: selectedServiceIds,
          appointmentDate: selectedDate,
          timeSlot: selectedTimeSlot,
          barberName: selectedBarber,
          dealId: activeDeal?.id,
          isDemo,
          demoBusyBarber: isDemo ? demoBusyBarber : undefined,
          demoBusyTimeSlot: isDemo ? demoBusyTimeSlot : undefined,
        }),
      });
      const data = (await res.json()) as CustomerFlowBookingResponse;
      if (!res.ok || !data.ok) {
        setErrorMsg(data.error || 'Could not confirm this slot. Please select another slot.');
        setAvailabilityReloadTick((t) => t + 1);
        return;
      }
      setConfirmedResult(data);
      onBookingConfirmed?.(data);
    } catch {
      setErrorMsg('Connection issue while confirming booking. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const containerClass = standalone
    ? 'min-h-screen bg-[#0B141A] text-[#E9EDEF] flex flex-col items-center justify-start sm:py-6 sm:px-4'
    : 'w-full h-full flex flex-col bg-[#0B141A] text-[#E9EDEF] rounded-2xl overflow-hidden border border-[#222E35]';

  if (loadingConfig && !config) {
    return (
      <div className={containerClass}>
        <div className="w-full max-w-md mx-auto p-6 text-center text-xs font-mono text-[#8696A0]">
          Loading booking Flow...
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className={containerClass}>
        <div className="w-full max-w-md mx-auto p-6 text-center text-sm text-[#F85149]">
          {errorMsg || 'Salon booking Flow unavailable.'}
        </div>
      </div>
    );
  }

  return (
    <div className={containerClass} dir={dir}>
      <div
        className={`w-full max-w-md flex flex-col bg-[#111B21] ${
          standalone
            ? 'min-h-screen sm:min-h-0 sm:rounded-3xl sm:border sm:border-[#222E35] sm:shadow-2xl overflow-hidden'
            : 'h-full'
        }`}
      >
        {/* Top WhatsApp Flow Bar */}
        <header className="sticky top-0 z-20 bg-[#202C33] border-b border-[#2A3942] px-4 py-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#25D366]">
                {isDemo ? copy.demoBadge : 'WHATSAPP FLOW'}
              </span>
            </div>
            <h1 className="text-sm font-bold text-[#E9EDEF] truncate">
              {config.salonName} · {copy.flowTitle}
            </h1>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <select
              aria-label="Language"
              value={activeLang}
              onChange={(e) => setActiveLang(e.target.value as ClientPreferredLang)}
              className="min-h-[36px] rounded-lg border border-[#2A3942] bg-[#111B21] px-2 text-xs text-[#E9EDEF] focus:outline-none focus:border-[#25D366]"
            >
              {config.availableLanguages.map((l) => (
                <option key={l.lang} value={l.lang}>
                  {l.nativeLabel}
                </option>
              ))}
            </select>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close booking Flow"
                className="min-h-[36px] min-w-[36px] rounded-lg border border-[#2A3942] bg-[#111B21] grid place-items-center text-[#8696A0] hover:text-[#E9EDEF]"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </header>

        {/* Inside-Flow Success State */}
        {confirmedResult?.appointment ? (
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            <div className="rounded-2xl border border-[#14532D] bg-[#0B2E1E] p-5 text-center space-y-2">
              <div className="mx-auto size-12 rounded-full bg-[#25D366]/20 border border-[#25D366] grid place-items-center text-[#25D366]">
                <CheckCircle2 className="size-6" />
              </div>
              <h2 className="text-lg font-bold text-[#E9EDEF]">{copy.confirmedTitle}</h2>
              <p className="text-xs text-[#A7F3D0] leading-relaxed">{copy.confirmedSubtitle}</p>
              {confirmedResult.isDemo && (
                <p className="text-[11px] font-mono text-[#FBBF24] pt-1">
                  DEMO MODE · Real salon appointments were NOT changed.
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-[#2A3942] bg-[#202C33] p-4 space-y-3 text-sm">
              <div className="flex items-center justify-between border-b border-[#2A3942] pb-2">
                <span className="text-xs font-mono text-[#8696A0]">{copy.bookingIdLabel}</span>
                <span className="font-mono font-bold text-[#25D366] tabular-nums">
                  {confirmedResult.appointment.id}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#8696A0]">{copy.bookedForLabel}</span>
                <span className="font-semibold text-[#E9EDEF]">
                  {confirmedResult.appointment.clientName}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#8696A0]">Date &amp; Time</span>
                <span className="font-mono font-semibold text-[#E9EDEF] tabular-nums">
                  {confirmedResult.appointment.appointmentDate} · {confirmedResult.appointment.timeSlot}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#8696A0]">Barber</span>
                <span className="font-semibold text-[#E9EDEF]">
                  {confirmedResult.appointment.barberName}
                </span>
              </div>
              <div className="border-t border-[#2A3942] pt-2 space-y-1">
                <span className="text-xs text-[#8696A0] block">Services</span>
                <p className="text-xs font-medium text-[#E9EDEF]">
                  {confirmedResult.appointment.service}
                </p>
              </div>
              {confirmedResult.appliedDeal && (
                <div className="rounded-xl bg-[#111B21] border border-[#2A3942] px-3 py-2 text-xs flex items-center justify-between">
                  <span className="text-[#25D366] font-semibold">
                    {confirmedResult.appliedDeal.title}
                  </span>
                  <span className="font-mono text-[#25D366] tabular-nums">
                    -{config.currencySymbol}
                    {confirmedResult.appliedDeal.savings.toLocaleString()}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-[#2A3942] pt-2.5">
                <span className="text-xs font-semibold text-[#8696A0]">
                  {copy.totalLabel} ({confirmedResult.appointment.durationMins || totalDurationMins}{' '}
                  {copy.minShort})
                </span>
                <span className="text-base font-mono font-bold text-[#25D366] tabular-nums">
                  {config.currencySymbol}
                  {confirmedResult.appointment.price.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-[#2A3942] bg-[#182229] p-3.5 space-y-2">
              <div className="flex items-start gap-2 text-xs text-[#D1D7DB]">
                <MapPin className="size-4 text-[#25D366] shrink-0 mt-0.5" />
                <span>{confirmedResult.address || config.address}</span>
              </div>
              <a
                href={confirmedResult.googleMapsUrl || config.googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[44px] w-full rounded-xl border border-[#2A3942] bg-[#202C33] hover:bg-[#2A3942] px-3 text-xs font-semibold text-[#53BDEB] flex items-center justify-center gap-2 transition"
              >
                <ExternalLink className="size-3.5" />
                <span>{copy.openMapsBtn}</span>
              </a>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setConfirmedResult(null);
                  setAvailabilityReloadTick((t) => t + 1);
                }}
                className="flex-1 min-h-[48px] rounded-xl border border-[#2A3942] bg-[#202C33] text-xs font-semibold text-[#E9EDEF] hover:bg-[#2A3942] transition"
              >
                {copy.bookAnotherBtn}
              </button>
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 min-h-[48px] rounded-xl bg-[#25D366] hover:bg-[#20BD5A] text-[#0B141A] text-xs font-bold uppercase tracking-wide transition"
                >
                  {copy.doneBtn}
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Single Continuous Multi-Field Booking Form */
          <form onSubmit={handleConfirmBooking} className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {/* Applied Deal Banner */}
              {activeDeal && (
                <div className="rounded-xl border border-[#14532D] bg-[#0B2E1E] p-3 flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-mono font-bold uppercase text-[#25D366] flex items-center gap-1">
                      <Tag className="size-3" />
                      <span>{copy.dealAppliedLabel}</span>
                    </span>
                    <p className="text-xs font-bold text-[#E9EDEF]">{activeDeal.title}</p>
                  </div>
                  {savings > 0 && (
                    <span className="font-mono text-xs font-bold text-[#25D366] shrink-0 tabular-nums">
                      -{config.currencySymbol}
                      {savings.toLocaleString()}
                    </span>
                  )}
                </div>
              )}

              {/* Inline Conflict / Validation Alert */}
              {errorMsg && (
                <div
                  role="alert"
                  className="rounded-xl border border-[#B91C1C] bg-[#3B1219] p-3 flex items-start gap-2.5 text-xs text-[#FCA5A5]"
                >
                  <AlertCircle className="size-4 shrink-0 mt-0.5 text-[#F87171]" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* 1. Multi-Service Selection */}
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-mono font-bold uppercase tracking-wide text-[#8696A0] flex items-center gap-1.5">
                    <Scissors className="size-3.5 text-[#25D366]" />
                    <span>{copy.selectServices}</span>
                  </h2>
                  <span className="text-xs font-mono text-[#25D366] tabular-nums">
                    {selectedServices.length} · {totalDurationMins} {copy.minShort}
                  </span>
                </div>
                <div className="space-y-2">
                  {config.services.map((svc) => {
                    const svcKey = svc.id || svc.name;
                    const checked = selectedServiceIds.includes(svcKey);
                    return (
                      <button
                        key={svcKey}
                        type="button"
                        onClick={() => toggleService(svcKey)}
                        className={`w-full min-h-[52px] rounded-xl border px-3.5 py-2.5 flex items-center justify-between gap-3 transition ${
                          checked
                            ? 'border-[#25D366] bg-[#0B2E1E]/60'
                            : 'border-[#2A3942] bg-[#202C33] hover:border-[#3B4A54]'
                        } ${dir === 'rtl' ? 'text-right' : 'text-left'}`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className={`size-5 rounded-md border grid place-items-center shrink-0 ${
                              checked
                                ? 'border-[#25D366] bg-[#25D366] text-[#0B141A]'
                                : 'border-[#8696A0]/50 bg-[#111B21]'
                            }`}
                          >
                            {checked && <Check className="size-3.5 stroke-[3]" />}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-[#E9EDEF] truncate">{svc.name}</p>
                            <p className="text-[11px] font-mono text-[#8696A0] tabular-nums">
                              {svc.durationMins || 35} {copy.minShort}
                            </p>
                          </div>
                        </div>
                        <span className="font-mono text-sm font-bold text-[#25D366] shrink-0 tabular-nums">
                          {config.currencySymbol}
                          {svc.price.toLocaleString()}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* 2. Date Selection */}
              <section className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-xs font-mono font-bold uppercase tracking-wide text-[#8696A0] flex items-center gap-1.5">
                    <Calendar className="size-3.5 text-[#25D366]" />
                    <span>{copy.selectDate}</span>
                  </h2>
                  <input
                    type="date"
                    dir="ltr"
                    min={config.todayDate}
                    value={selectedDate}
                    onChange={(e) => {
                      setErrorMsg(null);
                      setSelectedDate(e.target.value);
                    }}
                    className="min-h-[36px] rounded-lg border border-[#2A3942] bg-[#202C33] px-2.5 text-xs font-mono text-[#E9EDEF] focus:outline-none focus:border-[#25D366]"
                  />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {upcomingDates.map((d) => {
                    const active = d.date === selectedDate;
                    return (
                      <button
                        key={d.date}
                        type="button"
                        onClick={() => {
                          setErrorMsg(null);
                          setSelectedDate(d.date);
                        }}
                        className={`shrink-0 min-w-[74px] min-h-[54px] rounded-xl border px-2.5 py-1.5 flex flex-col items-center justify-center transition ${
                          active
                            ? 'border-[#25D366] bg-[#0B2E1E] text-[#E9EDEF]'
                            : 'border-[#2A3942] bg-[#202C33] text-[#8696A0] hover:text-[#E9EDEF]'
                        }`}
                      >
                        <span className="text-[11px] font-semibold">{d.top}</span>
                        <span className="text-xs font-mono font-bold tabular-nums">{d.sub}</span>
                      </button>
                    );
                  })}
                </div>
                {availability?.fridayBreakText && (
                  <p className="text-[11px] font-mono text-[#FBBF24]">
                    {availability.fridayBreakText}
                  </p>
                )}
              </section>

              {/* 3. Available Time Slots */}
              <section className="space-y-2">
                <h2 className="text-xs font-mono font-bold uppercase tracking-wide text-[#8696A0] flex items-center gap-1.5">
                  <Clock className="size-3.5 text-[#25D366]" />
                  <span>{copy.selectTime}</span>
                </h2>
                {loadingSlots ? (
                  <div className="rounded-xl border border-[#2A3942] bg-[#202C33] p-4 text-center text-xs font-mono text-[#8696A0]">
                    Checking live salon slots...
                  </div>
                ) : availability && !availability.isOpen ? (
                  <div className="rounded-xl border border-[#7F1D1D] bg-[#3B1219] p-3.5 text-xs text-[#FCA5A5]">
                    {availability.closedReason || copy.closedOnDate}
                  </div>
                ) : !availability || availability.slots.length === 0 ? (
                  <div className="rounded-xl border border-[#2A3942] bg-[#202C33] p-3.5 text-xs text-[#8696A0]">
                    {copy.noSlotsForDate}
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {availability.slots.map((slot) => {
                      const active = slot.timeSlot === selectedTimeSlot;
                      const noBarbers = slot.availableBarberCount === 0;
                      return (
                        <button
                          key={slot.timeSlot}
                          type="button"
                          onClick={() => handleSelectSlot(slot.timeSlot)}
                          className={`min-h-[48px] rounded-xl border px-2 py-1.5 flex flex-col items-center justify-center transition tabular-nums ${
                            active
                              ? 'border-[#25D366] bg-[#0B2E1E] text-[#E9EDEF]'
                              : noBarbers
                              ? 'border-[#2A3942] bg-[#182229] text-[#8696A0] opacity-70'
                              : 'border-[#2A3942] bg-[#202C33] text-[#E9EDEF] hover:border-[#3B4A54]'
                          }`}
                        >
                          <span className="text-xs font-mono font-bold">{slot.timeSlot}</span>
                          <span
                            className={`text-[10px] font-mono ${
                              slot.availableBarberCount > 0 ? 'text-[#25D366]' : 'text-[#F87171]'
                            }`}
                          >
                            {slot.availableBarberCount} free
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* 4. Available Barber Selection */}
              {currentSlotObj && (
                <section className="space-y-2">
                  <h2 className="text-xs font-mono font-bold uppercase tracking-wide text-[#8696A0] flex items-center gap-1.5">
                    <Sparkles className="size-3.5 text-[#25D366]" />
                    <span>{copy.selectBarber}</span>
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {currentSlotObj.barbers.map((barber) => {
                      const active = barber.name === selectedBarber;
                      return (
                        <button
                          key={barber.name}
                          type="button"
                          disabled={!barber.available}
                          onClick={() => {
                            setErrorMsg(null);
                            setSelectedBarber(barber.name);
                          }}
                          className={`min-h-[50px] rounded-xl border px-3 py-2 flex items-center justify-between gap-2 transition ${
                            !barber.available
                              ? 'border-[#7F1D1D]/70 bg-[#231417] text-[#8696A0] cursor-not-allowed'
                              : active
                              ? 'border-[#25D366] bg-[#0B2E1E] text-[#E9EDEF]'
                              : 'border-[#2A3942] bg-[#202C33] text-[#E9EDEF] hover:border-[#3B4A54]'
                          }`}
                        >
                          <span className="text-xs font-semibold truncate">{barber.name}</span>
                          <span
                            className={`text-[10px] font-mono font-bold shrink-0 ${
                              barber.available ? 'text-[#25D366]' : 'text-[#F87171]'
                            }`}
                          >
                            {barber.available
                              ? copy.availableLabel
                              : barber.reason || copy.unavailableLabel}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* 5. Customer Name (ONLY if not already saved) */}
              <section className="space-y-2">
                <h2 className="text-xs font-mono font-bold uppercase tracking-wide text-[#8696A0] flex items-center gap-1.5">
                  <User className="size-3.5 text-[#25D366]" />
                  <span>{copy.yourDetails}</span>
                </h2>
                <div className="rounded-xl border border-[#2A3942] bg-[#202C33] p-3.5 space-y-3">
                  {effectiveSavedName ? (
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-[#8696A0]">{copy.bookedForLabel}</span>
                      <span className="font-bold text-[#25D366]">{effectiveSavedName}</span>
                    </div>
                  ) : (
                    <label className="block space-y-1">
                      <span className="text-[11px] font-mono text-[#8696A0]">
                        {copy.yourNamePlaceholder} *
                      </span>
                      <input
                        type="text"
                        required
                        value={clientNameInput}
                        onChange={(e) => setClientNameInput(e.target.value)}
                        placeholder={copy.yourNamePlaceholder}
                        className="w-full min-h-[44px] rounded-xl border border-[#2A3942] bg-[#111B21] px-3 text-sm text-[#E9EDEF] placeholder:text-[#8696A0]/60 focus:outline-none focus:border-[#25D366]"
                      />
                    </label>
                  )}

                  {standalone && (
                    <label className="block space-y-1">
                      <span className="text-[11px] font-mono text-[#8696A0]">
                        {copy.yourPhoneLabel}
                      </span>
                      <input
                        type="tel"
                        dir="ltr"
                        required
                        value={clientPhone}
                        onChange={(e) => setClientPhone(e.target.value)}
                        placeholder="+92 300 1234567"
                        className="w-full min-h-[44px] rounded-xl border border-[#2A3942] bg-[#111B21] px-3 text-sm font-mono text-[#E9EDEF] focus:outline-none focus:border-[#25D366]"
                      />
                    </label>
                  )}
                </div>
              </section>

              {/* Final Summary Card */}
              <section className="rounded-2xl border border-[#2A3942] bg-[#182229] p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between font-bold text-[#E9EDEF]">
                  <span>{copy.summaryTitle}</span>
                  <span className="font-mono text-[#8696A0] tabular-nums">
                    {totalDurationMins} {copy.minShort}
                  </span>
                </div>
                <p className="text-[#D1D7DB] leading-snug">
                  {selectedServices.map((s) => s.name).join(' + ')}
                </p>
                <div className="flex items-center justify-between text-[#8696A0] font-mono pt-1 border-t border-[#2A3942]">
                  <span>
                    {selectedDate || '—'} · {selectedTimeSlot || '—'}
                  </span>
                  <span>{selectedBarber || '—'}</span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[#8696A0]">{copy.totalLabel}</span>
                  <div className="flex items-baseline gap-2 font-mono tabular-nums">
                    {savings > 0 && (
                      <span className="text-[11px] text-[#8696A0] line-through">
                        {config.currencySymbol}
                        {originalTotal.toLocaleString()}
                      </span>
                    )}
                    <span className="text-base font-bold text-[#25D366]">
                      {config.currencySymbol}
                      {finalTotal.toLocaleString()}
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-[#8696A0]">{copy.payAtSalonNote}</p>
              </section>
            </div>

            {/* Compact Sticky Bottom CTA */}
            <footer className="sticky bottom-0 z-10 border-t border-[#2A3942] bg-[#202C33] px-4 py-3">
              <button
                type="submit"
                disabled={submitting || !selectedTimeSlot || !selectedBarber}
                className="w-full min-h-[48px] rounded-xl bg-[#25D366] hover:bg-[#20BD5A] disabled:opacity-45 text-[#0B141A] text-sm font-bold flex items-center justify-center gap-2 transition active:scale-[0.99]"
              >
                <CheckCircle2 className="size-4" />
                <span>
                  {submitting
                    ? copy.confirmingBtn
                    : `${copy.confirmBtn} · ${config.currencySymbol}${finalTotal.toLocaleString()}`}
                </span>
              </button>
            </footer>
          </form>
        )}
      </div>
    </div>
  );
};
