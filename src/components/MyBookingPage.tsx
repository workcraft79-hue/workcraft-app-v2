import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CalendarPlus,
  CheckCircle2,
  Clock,
  ExternalLink,
  MapPin,
  Phone,
  RefreshCw,
  Scissors,
  Star,
  User,
  XCircle,
} from 'lucide-react';
import { LOGO_URL } from '../data/portalData';
import type {
  BookingManagementPayload,
  CustomerAvailabilityResponse,
} from '../types/concierge';

interface MyBookingPageProps {
  token: string;
  onNavigate?: (path: string) => void;
}

const STATUS_LABELS: Record<
  BookingManagementPayload['status'],
  { label: string; colorClass: string }
> = {
  CONFIRMED: { label: 'Confirmed', colorClass: 'text-[#3FB950]' },
  IN_CHAIR: { label: 'In Chair', colorClass: 'text-[#06B6D4]' },
  COMPLETED: { label: 'Completed', colorClass: 'text-[#A7F3D0]' },
  CANCELED: { label: 'Canceled', colorClass: 'text-[#F87171]' },
};

export const MyBookingPage: React.FC<MyBookingPageProps> = ({ token, onNavigate }) => {
  const [booking, setBooking] = useState<BookingManagementPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionBanner, setActionBanner] = useState<string | null>(null);

  // Reschedule panel state
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [reschedDate, setReschedDate] = useState('');
  const [availability, setAvailability] = useState<CustomerAvailabilityResponse | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('');
  const [selectedBarber, setSelectedBarber] = useState('');
  const [submittingReschedule, setSubmittingReschedule] = useState(false);

  // Cancel inline confirm state
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [submittingCancel, setSubmittingCancel] = useState(false);

  const loadBooking = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/bookings/${encodeURIComponent(token)}`);
      const data = (await res.json()) as BookingManagementPayload & { error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error || 'This booking link is invalid or has expired.');
        setBooking(null);
        return;
      }
      setBooking(data);
      setReschedDate(data.appointmentDate);
      setSelectedTimeSlot(data.timeSlot);
      setSelectedBarber(data.barberName);
    } catch {
      setError('Could not load your booking details. Please try again.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    void loadBooking();
    const refresh = window.setInterval(() => void loadBooking(true), 10000);
    return () => window.clearInterval(refresh);
  }, [token]);

  useEffect(() => {
    if (!isRescheduling || !booking || !reschedDate) return;
    let cancelled = false;
    setLoadingSlots(true);
    const params = new URLSearchParams({
      date: reschedDate,
      durationMins: String(booking.durationMins || 35),
    });
    if (booking.serviceIds?.length) {
      params.set('serviceIds', booking.serviceIds.join(','));
    }
    fetch(
      `/api/public/salons/${encodeURIComponent(booking.salonPublicCode)}/availability?${params.toString()}`
    )
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed availability'))))
      .then((data: CustomerAvailabilityResponse) => {
        if (cancelled) return;
        setAvailability(data);
        const firstOpen = data.slots.find((s) => s.availableBarberCount > 0) || data.slots[0];
        if (firstOpen) {
          setSelectedTimeSlot(firstOpen.timeSlot);
          const availBarber =
            firstOpen.barbers.find((b) => b.name === booking.barberName && b.available) ||
            firstOpen.barbers.find((b) => b.available);
          setSelectedBarber(availBarber?.name || '');
        } else {
          setSelectedTimeSlot('');
          setSelectedBarber('');
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
  }, [isRescheduling, booking, reschedDate]);

  const handleDownloadIcs = () => {
    if (!booking?.icsContent) return;
    const blob = new Blob([booking.icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${booking.bookingRef || 'appointment'}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setActionBanner('Calendar invite (.ics) downloaded.');
  };

  const handleConfirmReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reschedDate || !selectedTimeSlot || !selectedBarber) return;
    setSubmittingReschedule(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/public/bookings/${encodeURIComponent(token)}/reschedule`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            appointmentDate: reschedDate,
            timeSlot: selectedTimeSlot,
            barberName: selectedBarber,
          }),
        }
      );
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        booking?: BookingManagementPayload;
      };
      if (!res.ok || !data.ok || !data.booking) {
        setError(data.error || 'Selected time slot is no longer free. Please pick another.');
        return;
      }
      setBooking(data.booking);
      setIsRescheduling(false);
      setActionBanner('Appointment rescheduled cleanly (no extra salon quota used).');
    } catch {
      setError('Connection failed while rescheduling.');
    } finally {
      setSubmittingReschedule(false);
    }
  };

  const handleConfirmCancel = async () => {
    setSubmittingCancel(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/bookings/${encodeURIComponent(token)}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancelReason.trim() || undefined }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        booking?: BookingManagementPayload;
      };
      if (!res.ok || !data.ok || !data.booking) {
        setError(data.error || 'Could not cancel this booking.');
        return;
      }
      setBooking(data.booking);
      setConfirmingCancel(false);
      setActionBanner('Your appointment has been canceled and your stylist chair is now free.');
    } catch {
      setError('Connection failed while canceling.');
    } finally {
      setSubmittingCancel(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0D1117] text-[#F0F6FC] flex items-center justify-center p-6">
        <div className="rounded-2xl border border-[#30363D] bg-[#161B22] px-6 py-5 text-xs font-mono text-[#8B949E]">
          Loading your booking details...
        </div>
      </main>
    );
  }

  if (error && !booking) {
    return (
      <main className="min-h-screen bg-[#0D1117] text-[#F0F6FC] flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-[#30363D] bg-[#161B22] p-6 text-center space-y-4">
          <AlertTriangle className="size-8 text-[#F87171] mx-auto" />
          <div className="space-y-1">
            <h1 className="text-lg font-bold text-[#F0F6FC]">Booking Link Unavailable</h1>
            <p className="text-xs text-[#8B949E] leading-relaxed">{error}</p>
          </div>
          <a
            href="/"
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[#06B6D4] px-5 text-xs font-mono font-bold text-[#0D1117]"
          >
            Return to WorkCraft
          </a>
        </div>
      </main>
    );
  }

  if (!booking) return null;

  const statusMeta = STATUS_LABELS[booking.status];
  const currentSlotObj =
    availability?.slots.find((s) => s.timeSlot === selectedTimeSlot) || null;
  const freeBarbers = currentSlotObj
    ? currentSlotObj.barbers.filter((b) => b.available)
    : [];
  const canReschedule = booking.status === 'CONFIRMED';
  const canCancel = booking.status === 'CONFIRMED' || booking.status === 'IN_CHAIR';


  return (
    <main className="min-h-screen bg-[#0D1117] text-[#F0F6FC] flex flex-col items-center py-6 px-4">
      <div className="w-full max-w-2xl space-y-5">
        {/* Clean Brand + Salon Header */}
        <header className="flex items-center justify-between gap-4 border-b border-[#21262D] pb-4">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={LOGO_URL}
              alt="WorkCraft"
              className="size-10 object-contain shrink-0"
              referrerPolicy="no-referrer"
            />
            <div className="min-w-0">
              <p className="text-xs text-[#8B949E] truncate">{booking.salonName}</p>
              <h1 className="text-lg font-bold text-[#F0F6FC] truncate">
                Booking #{booking.bookingRef}
              </h1>
            </div>
          </div>
          <a
            href={`/s/${encodeURIComponent(booking.salonPublicCode)}`}
            onClick={(e) => {
              if (onNavigate) {
                e.preventDefault();
                onNavigate(`/s/${encodeURIComponent(booking.salonPublicCode)}`);
              }
            }}
            className="min-h-[40px] rounded-xl border border-[#30363D] bg-[#161B22] hover:border-[#06B6D4] px-3.5 text-xs font-mono font-bold text-[#06B6D4] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <span>Book New Visit</span>
            <ExternalLink className="size-3.5" />
          </a>
        </header>

        {actionBanner && (
          <div className="rounded-xl border border-[#116329] bg-[#0D3822] px-4 py-3 text-xs text-[#A7F3D0] flex items-center gap-2">
            <CheckCircle2 className="size-4 text-[#3FB950] shrink-0" />
            <span>{actionBanner}</span>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-[#da3633] bg-[#4C1C1D] px-4 py-3 text-xs text-[#FCA5A5] flex items-center gap-2">
            <AlertTriangle className="size-4 text-[#F87171] shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Booking Details Card */}
        <section className="rounded-2xl border border-[#30363D] bg-[#161B22] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#21262D] pb-3">
            <div className="text-xs text-[#8B949E] flex items-center gap-2">
              <span className="font-mono font-bold text-[#F0F6FC] tabular-nums">
                {booking.bookingRef}
              </span>
              <span aria-hidden="true">·</span>
              <span className={`font-semibold ${statusMeta.colorClass}`}>{statusMeta.label}</span>
            </div>
            <span dir="ltr" className="text-base font-mono font-bold text-[#3FB950] tabular-nums">
              {booking.currencySymbol}
              {booking.totalPrice.toLocaleString()}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <span className="text-xs text-[#8B949E] flex items-center gap-1.5">
                <User className="size-3.5 text-[#06B6D4]" />
                <span>Client</span>
              </span>
              <p className="font-semibold text-[#F0F6FC]">{booking.clientName}</p>
              <p dir="ltr" className="text-xs font-mono text-[#8B949E] tabular-nums">
                {booking.maskedPhone}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-[#8B949E] flex items-center gap-1.5">
                <Calendar className="size-3.5 text-[#06B6D4]" />
                <span>Date &amp; Arrival Time</span>
              </span>
              <p dir="ltr" className="font-mono font-bold text-[#F0F6FC] tabular-nums">
                {booking.appointmentDate} · {booking.timeSlot}
              </p>
              <p className="text-xs font-mono text-[#8B949E] tabular-nums">
                Duration: {booking.durationMins} min
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-[#8B949E] flex items-center gap-1.5">
                <Scissors className="size-3.5 text-[#06B6D4]" />
                <span>Services</span>
              </span>
              <p className="font-medium text-[#F0F6FC]">{booking.service}</p>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-[#8B949E] flex items-center gap-1.5">
                <Clock className="size-3.5 text-[#06B6D4]" />
                <span>Assigned Stylist</span>
              </span>
              <p className="font-semibold text-[#F0F6FC]">{booking.barberName}</p>
            </div>
          </div>

          <div className="border-t border-[#21262D] pt-3 space-y-2.5">
            <div className="flex items-start gap-2 text-xs text-[#8B949E]">
              <MapPin className="size-4 text-[#3FB950] shrink-0 mt-0.5" />
              <span className="text-[#F0F6FC]">{booking.address}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {booking.googleMapsUrl && (
                <a
                  href={booking.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[44px] rounded-xl border border-[#30363D] bg-[#0D1117] hover:border-[#06B6D4] px-4 text-xs font-semibold text-[#06B6D4] inline-flex items-center gap-1.5"
                >
                  <MapPin className="size-3.5" />
                  <span>Get Directions</span>
                </a>
              )}
              {booking.icsContent && booking.status !== 'CANCELED' && (
                <button
                  type="button"
                  onClick={handleDownloadIcs}
                  className="min-h-[44px] rounded-xl border border-[#30363D] bg-[#0D1117] hover:border-[#3FB950] px-4 text-xs font-semibold text-[#F0F6FC] inline-flex items-center gap-1.5"
                >
                  <CalendarPlus className="size-3.5 text-[#3FB950]" />
                  <span>Add to Calendar (.ics)</span>
                </button>
              )}
              {booking.publicContactPhone && (
                <a
                  href={`tel:${booking.publicContactPhone.replace(/\s+/g, '')}`}
                  className="min-h-[44px] rounded-xl border border-[#30363D] bg-[#0D1117] hover:border-[#D29922] px-4 text-xs font-semibold text-[#F0F6FC] inline-flex items-center gap-1.5"
                >
                  <Phone className="size-3.5 text-[#D29922]" />
                  <span>Call Salon</span>
                </a>
              )}
            </div>
          </div>
        </section>

        {/* Neutral Post-Completion Google Review CTA (strictly only when COMPLETED — never gated by rating) */}
        {booking.status === 'COMPLETED' && booking.googleReviewUrl && (
          <section className="rounded-2xl border border-[#116329] bg-[#0D2118] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-sm font-bold text-[#F0F6FC] flex items-center gap-2">
                <Star className="size-4 text-[#D29922]" />
                <span>How was your visit to {booking.salonName}?</span>
              </h2>
              <p className="text-xs text-[#A7F3D0] leading-relaxed">
                Your honest feedback helps other local clients discover great grooming care.
              </p>
            </div>
            <a
              href={booking.googleReviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[46px] rounded-xl bg-[#06B6D4] hover:bg-[#0891B2] text-[#0D1117] px-5 text-xs font-bold inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 transition"
            >
              <span>Leave a Review on Google</span>
              <ExternalLink className="size-3.5" />
            </a>
          </section>
        )}

        {/* Manage Controls: Reschedule or Cancel */}
        {(canReschedule || canCancel) && (
          <section className="rounded-2xl border border-[#30363D] bg-[#161B22] p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-bold text-[#F0F6FC]">Manage This Appointment</h2>
              <div className="flex flex-wrap gap-2">
                {canReschedule && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsRescheduling((v) => !v);
                      setConfirmingCancel(false);
                    }}
                    className="min-h-[44px] rounded-xl border border-[#06B6D4] bg-[#0D2138] hover:bg-[#06B6D4]/20 px-4 text-xs font-mono font-bold text-[#06B6D4] inline-flex items-center gap-1.5"
                  >
                    <RefreshCw className="size-3.5" />
                    <span>{isRescheduling ? 'Close Reschedule' : 'Reschedule Slot'}</span>
                  </button>
                )}
                {canCancel && (
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmingCancel((v) => !v);
                      setIsRescheduling(false);
                    }}
                    className="min-h-[44px] rounded-xl border border-[#da3633] bg-[#4C1C1D] hover:bg-[#612324] px-4 text-xs font-mono font-bold text-[#FCA5A5] inline-flex items-center gap-1.5"
                  >
                    <XCircle className="size-3.5" />
                    <span>Cancel Appointment</span>
                  </button>
                )}
              </div>
            </div>

            {isRescheduling && (
              <form
                onSubmit={handleConfirmReschedule}
                className="border-t border-[#21262D] pt-4 space-y-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block space-y-1">
                    <span className="text-xs font-mono text-[#8B949E] block">New Date</span>
                    <input
                      type="date"
                      dir="ltr"
                      required
                      min={new Date().toISOString().slice(0, 10)}
                      value={reschedDate}
                      onChange={(e) => setReschedDate(e.target.value)}
                      className="w-full min-h-[44px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3 text-xs font-mono text-[#F0F6FC]"
                    />
                  </label>
                  <div className="space-y-1">
                    <span className="text-xs font-mono text-[#8B949E] block">
                      Available Stylist
                    </span>
                    <select
                      value={selectedBarber}
                      onChange={(e) => setSelectedBarber(e.target.value)}
                      className="w-full min-h-[44px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3 text-xs text-[#F0F6FC]"
                    >
                      {freeBarbers.length === 0 ? (
                        <option value="">No free stylist at selected time</option>
                      ) : (
                        freeBarbers.map((b) => (
                          <option key={b.name} value={b.name}>
                            {b.name} (Available)
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                </div>

                {loadingSlots ? (
                  <p className="text-xs font-mono text-[#8B949E]">Checking open slots...</p>
                ) : availability && !availability.isOpen ? (
                  <p className="text-xs text-[#F87171]">
                    Salon is closed on this date. Pick another date.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {(availability?.slots || []).map((slot) => {
                      const active = slot.timeSlot === selectedTimeSlot;
                      const noBarbers = slot.availableBarberCount === 0;
                      return (
                        <button
                          key={slot.timeSlot}
                          type="button"
                          disabled={noBarbers}
                          onClick={() => {
                            setSelectedTimeSlot(slot.timeSlot);
                            const availB =
                              slot.barbers.find((b) => b.name === selectedBarber && b.available) ||
                              slot.barbers.find((b) => b.available);
                            setSelectedBarber(availB?.name || '');
                          }}
                          className={`min-h-[44px] rounded-xl border px-2 py-1.5 text-xs font-mono font-bold tabular-nums transition ${
                            active
                              ? 'border-[#3FB950] bg-[#0D3822] text-[#F0F6FC]'
                              : noBarbers
                              ? 'border-[#21262D] bg-[#0D1117] text-[#484F58] cursor-not-allowed'
                              : 'border-[#30363D] bg-[#0D1117] text-[#F0F6FC] hover:border-[#06B6D4]'
                          }`}
                        >
                          {slot.timeSlot}
                        </button>
                      );
                    })}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submittingReschedule || !selectedTimeSlot || !selectedBarber}
                  className="w-full min-h-[48px] rounded-xl bg-[#06B6D4] hover:bg-[#22D3EE] disabled:opacity-50 text-[#0D1117] text-xs font-mono font-bold uppercase"
                >
                  {submittingReschedule ? 'Updating Slot...' : 'Confirm New Time'}
                </button>
              </form>
            )}

            {confirmingCancel && (
              <div className="border-t border-[#21262D] pt-4 space-y-3">
                <p className="text-xs text-[#FCA5A5]">
                  Cancel your {booking.appointmentDate} at {booking.timeSlot} appointment? This frees the chair for other clients immediately.
                </p>
                <input
                  type="text"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Optional reason (e.g. running late / need another day)"
                  className="w-full min-h-[44px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3 text-xs text-[#F0F6FC]"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmingCancel(false)}
                    className="min-h-[44px] rounded-xl border border-[#30363D] bg-[#0D1117] px-4 text-xs font-mono text-[#8B949E]"
                  >
                    Keep Booking
                  </button>
                  <button
                    type="button"
                    disabled={submittingCancel}
                    onClick={handleConfirmCancel}
                    className="flex-1 min-h-[44px] rounded-xl bg-[#da3633] hover:bg-[#f85149] disabled:opacity-50 text-white text-xs font-mono font-bold uppercase"
                  >
                    {submittingCancel ? 'Canceling...' : 'Yes, Cancel Booking'}
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
};
