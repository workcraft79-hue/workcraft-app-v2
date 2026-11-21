import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  Check,
  Copy,
  ExternalLink,
  Film,
  MapPin,
  Scissors,
  Tag,
  X,
} from 'lucide-react';
import { LOGO_URL } from '../data/portalData';
import type { ClientPreferredLang, PublicDealPageResponse } from '../types/concierge';
import { CustomerBookingFlow } from './CustomerBookingFlow';

interface PublicSalonDealPageProps {
  salonId: string;
  dealId: string;
  initialLang?: ClientPreferredLang;
  isDemo?: boolean;
  onBookDealInDemo?: (dealId: string) => void;
  onClose?: () => void;
}

const DEAL_COPY: Record<
  ClientPreferredLang,
  {
    activeDealBadge: string;
    expiredDealBadge: string;
    expiresLabel: string;
    includedServices: string;
    bookDealBtn: string;
    bookRegularBtn: string;
    expiredNotice: string;
    purgedVideoNotice: string;
    openMapsBtn: string;
    copyBtn: string;
    copiedBtn: string;
    minUnit: string;
  }
> = {
  en: {
    activeDealBadge: 'ACTIVE SALON OFFER',
    expiredDealBadge: 'OFFER EXPIRED',
    expiresLabel: 'Valid Until',
    includedServices: 'Included Services',
    bookDealBtn: 'Book This Deal',
    bookRegularBtn: 'Book Regular Services Instead',
    expiredNotice: 'This promotional deal has expired and is no longer available for booking.',
    purgedVideoNotice: 'Promotional video was automatically deleted after the configured retention period.',
    openMapsBtn: 'Google Maps Directions',
    copyBtn: 'Copy',
    copiedBtn: 'Copied',
    minUnit: 'min',
  },
  roman_ur: {
    activeDealBadge: 'ACTIVE SALON OFFER',
    expiredDealBadge: 'OFFER KHATAM HO GAYI',
    expiresLabel: 'Aakhri Tareekh',
    includedServices: 'Shamil Services',
    bookDealBtn: 'Yeh Deal Book Karein',
    bookRegularBtn: 'Regular Services Book Karein',
    expiredNotice: 'Yeh deal khatam ho chuki hai aur ab book nahi ki ja sakti.',
    purgedVideoNotice: 'Promo video retention muddat mukammal hone par khud-ba-khud delete kar di gayi hai.',
    openMapsBtn: 'Google Maps Directions',
    copyBtn: 'Copy',
    copiedBtn: 'Copied',
    minUnit: 'min',
  },
  ur: {
    activeDealBadge: 'فعال سیلون آفر',
    expiredDealBadge: 'آفر ختم ہو چکی ہے',
    expiresLabel: 'آخری تاریخ',
    includedServices: 'شامل سروسز',
    bookDealBtn: 'یہ ڈیل بک کریں',
    bookRegularBtn: 'معمول کی سروسز بک کریں',
    expiredNotice: 'یہ پروموشنل ڈیل ختم ہو چکی ہے اور اب بکنگ کے لیے دستیاب نہیں ہے۔',
    purgedVideoNotice: 'مقررہ مدت پوری ہونے پر پروموشنل ویڈیو خودکار طریقے سے حذف کر دی گئی ہے۔',
    openMapsBtn: 'گوگل میپس ڈائریکشنز',
    copyBtn: 'کاپی',
    copiedBtn: 'کاپی ہو گیا',
    minUnit: 'منٹ',
  },
  ar: {
    activeDealBadge: 'عرض ساري حالياً',
    expiredDealBadge: 'انتهى العرض',
    expiresLabel: 'صالح حتى',
    includedServices: 'الخدمات المشمولة',
    bookDealBtn: 'احجز هذا العرض',
    bookRegularBtn: 'احجز الخدمات الاعتيادية',
    expiredNotice: 'انتهت صلاحية هذا العرض ولم يعد متاحاً للحجز.',
    purgedVideoNotice: 'تم حذف الفيديو الترويجي تلقائياً بعد انتهاء مدة الاحتفاظ المحددة.',
    openMapsBtn: 'اتجاهات خرائط جوجل',
    copyBtn: 'نسخ',
    copiedBtn: 'تم النسخ',
    minUnit: 'دقيقة',
  },
};

export const PublicSalonDealPage: React.FC<PublicSalonDealPageProps> = ({
  salonId,
  dealId,
  initialLang = 'en',
  isDemo = false,
  onBookDealInDemo,
  onClose,
}) => {
  const [payload, setPayload] = useState<PublicDealPageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lang, setLang] = useState<ClientPreferredLang>(initialLang);
  const [showFlow, setShowFlow] = useState(false);
  const [copiedMaps, setCopiedMaps] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(
      `/api/public/salons/${encodeURIComponent(salonId)}/deals/${encodeURIComponent(dealId)}`
    )
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Deal not found'))))
      .then((data: PublicDealPageResponse) => {
        if (!cancelled) {
          setPayload(data);
          const allowed = data.availableLanguages.map((l) => l.lang);
          if (!allowed.includes(lang)) {
            setLang('en');
          }
        }
      })
      .catch(() => {
        if (!cancelled) setError('This deal could not be found.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [salonId, dealId]);

  if (showFlow && payload) {
    return (
      <CustomerBookingFlow
        salonId={salonId}
        initialDealId={payload.isExpired ? null : payload.deal.id}
        initialLang={lang}
        isDemo={isDemo}
        standalone={!onClose}
        onClose={() => setShowFlow(false)}
      />
    );
  }

  const copy = DEAL_COPY[lang] || DEAL_COPY.en;
  const dir: 'ltr' | 'rtl' = lang === 'ur' || lang === 'ar' ? 'rtl' : 'ltr';

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B141A] text-[#E9EDEF] flex items-center justify-center p-6">
        <div className="text-xs font-mono text-[#8696A0]">Loading salon offer...</div>
      </div>
    );
  }

  if (error || !payload) {
    return (
      <div className="min-h-screen bg-[#0B141A] text-[#E9EDEF] flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-[#2A3942] bg-[#111B21] p-6 text-center space-y-3">
          <AlertTriangle className="size-8 text-[#F87171] mx-auto" />
          <p className="text-sm font-semibold text-[#E9EDEF]">{error || 'Deal not found.'}</p>
        </div>
      </div>
    );
  }

  const { deal, isExpired, videoPurged } = payload;
  const hasActiveVideo = Boolean(deal.videoUrl && !videoPurged);
  const discountSummary =
    deal.discountType === 'PCT'
      ? `${deal.discountValue}% OFF`
      : deal.discountType === 'FIXED'
      ? `${payload.currencySymbol}${deal.discountValue.toLocaleString()} OFF`
      : `Bundle ${payload.currencySymbol}${deal.discountValue.toLocaleString()}`;

  const handleCopyMaps = async () => {
    try {
      await navigator.clipboard.writeText(payload.googleMapsUrl);
      setCopiedMaps(true);
      setTimeout(() => setCopiedMaps(false), 2200);
    } catch {
      // Clipboard blocked in restricted sandbox
    }
  };

  return (
    <div
      dir={dir}
      className="min-h-screen bg-[#0B141A] text-[#E9EDEF] flex flex-col items-center sm:py-6 sm:px-4"
    >
      <div className="w-full max-w-md bg-[#111B21] min-h-screen sm:min-h-0 sm:rounded-3xl sm:border sm:border-[#222E35] sm:shadow-2xl overflow-hidden flex flex-col">
        {/* Top-Left Crisp WorkCraft Brand Header (Query 6) */}
        <header
          dir="ltr"
          className="bg-[#202C33] border-b border-[#2A3942] px-4 py-3 flex items-center justify-between gap-2.5"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-8 px-2 rounded-lg bg-[#0B141A] border border-[#2A3942] flex items-center justify-center shrink-0">
              <img
                src={LOGO_URL}
                alt="WorkCraft"
                className="h-4 w-auto object-contain"
              />
            </div>
            <div className="min-w-0">
              <span
                className={`text-[10px] font-mono font-bold uppercase tracking-wider block ${
                  isExpired ? 'text-[#F87171]' : 'text-[#25D366]'
                }`}
              >
                {isExpired ? copy.expiredDealBadge : copy.activeDealBadge}
              </span>
              <h1 className="text-sm font-bold text-[#E9EDEF] truncate">{payload.salonName}</h1>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <select
              aria-label="Language"
              value={lang}
              onChange={(e) => setLang(e.target.value as ClientPreferredLang)}
              className="min-h-[36px] rounded-lg border border-[#2A3942] bg-[#111B21] px-2 text-xs text-[#E9EDEF] focus:outline-none focus:border-[#25D366]"
            >
              {payload.availableLanguages.map((l) => (
                <option key={l.lang} value={l.lang}>
                  {l.nativeLabel}
                </option>
              ))}
            </select>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="min-h-[36px] min-w-[36px] rounded-lg border border-[#2A3942] bg-[#111B21] grid place-items-center text-[#8696A0] hover:text-[#E9EDEF]"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </header>

        {/* Body */}
        <main className="flex-1 p-4 space-y-4">
          {/* Promotional Video Player (Text-first per Query 10: shown only if video uploaded or expired/purged) */}
          {(hasActiveVideo || videoPurged) && (
            <div className="rounded-2xl overflow-hidden border border-[#2A3942] bg-[#0B141A]">
              {hasActiveVideo ? (
                <video
                  src={deal.videoUrl}
                  controls
                  playsInline
                  preload="metadata"
                  className="w-full max-h-72 bg-black object-contain"
                />
              ) : (
                <div className="p-5 text-center space-y-2">
                  <Film className="size-6 text-[#8696A0] mx-auto" />
                  <p className="text-xs text-[#8696A0] leading-relaxed">
                    {copy.purgedVideoNotice}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Deal Details */}
          <div className="rounded-2xl border border-[#2A3942] bg-[#202C33] p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-lg font-bold text-[#E9EDEF] leading-snug">{deal.title}</h2>
              <span
                dir="ltr"
                className="rounded-lg bg-[#0B2E1E] border border-[#14532D] px-2.5 py-1 text-xs font-mono font-bold text-[#25D366] shrink-0"
              >
                {discountSummary}
              </span>
            </div>

            {deal.description && (
              <p className="text-xs text-[#D1D7DB] leading-relaxed">{deal.description}</p>
            )}

            <div className="flex items-center gap-2 text-xs font-mono text-[#FBBF24] pt-1">
              <CalendarClock className="size-4 shrink-0" />
              <span>
                {copy.expiresLabel}:{' '}
                {new Date(deal.expiresAt).toLocaleDateString(
                  lang === 'ur' ? 'ur-PK' : lang === 'ar' ? 'ar-AE' : 'en-GB'
                )}
              </span>
            </div>
          </div>

          {isExpired && (
            <div className="rounded-xl border border-[#7F1D1D] bg-[#3B1219] p-3.5 text-xs text-[#FCA5A5] flex items-start gap-2">
              <AlertTriangle className="size-4 shrink-0 mt-0.5 text-[#F87171]" />
              <span>{copy.expiredNotice}</span>
            </div>
          )}

          {/* Included Services (Localized per Query 1) */}
          <div className="rounded-2xl border border-[#2A3942] bg-[#202C33] p-4 space-y-2.5">
            <h3 className="text-xs font-mono font-bold uppercase text-[#8696A0] flex items-center gap-1.5">
              <Scissors className="size-3.5 text-[#25D366]" />
              <span>{copy.includedServices}</span>
            </h3>
            <div className="space-y-1.5">
              {payload.matchedServices.map((svc) => (
                <div
                  key={svc.id || svc.name}
                  className="flex items-center justify-between text-xs py-1 border-b border-[#2A3942] last:border-none"
                >
                  <span className="text-[#E9EDEF] font-medium">
                    {svc.translations?.[lang] || svc.name} · {svc.durationMins || 35} {copy.minUnit}
                  </span>
                  <span dir="ltr" className="font-mono text-[#8696A0] tabular-nums">
                    {payload.currencySymbol}
                    {svc.price.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Salon Address + Google Maps Directions & Small Copy Button (Query 8) */}
          <div className="rounded-2xl border border-[#2A3942] bg-[#182229] p-3.5 space-y-2.5">
            <div className="flex items-start gap-2 text-xs text-[#D1D7DB]">
              <MapPin className="size-4 text-[#25D366] shrink-0 mt-0.5" />
              <span className="leading-relaxed">{payload.address}</span>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={payload.googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-h-[38px] rounded-lg border border-[#2A3942] bg-[#202C33] hover:border-[#25D366] px-3 text-xs font-semibold text-[#53BDEB] flex items-center justify-center gap-1.5 transition"
              >
                <MapPin className="size-3.5 text-[#25D366] shrink-0" />
                <span>{copy.openMapsBtn}</span>
                <ExternalLink className="size-3 shrink-0" />
              </a>
              <button
                type="button"
                onClick={() => void handleCopyMaps()}
                className="min-h-[38px] rounded-lg border border-[#2A3942] bg-[#202C33] hover:border-[#53BDEB] px-3 text-xs font-semibold text-[#D1D7DB] flex items-center gap-1.5 shrink-0 transition"
              >
                {copiedMaps ? (
                  <>
                    <Check className="size-3.5 text-[#25D366]" />
                    <span className="text-[#25D366]">{copy.copiedBtn}</span>
                  </>
                ) : (
                  <>
                    <Copy className="size-3.5 text-[#8696A0]" />
                    <span>{copy.copyBtn}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </main>

        {/* Bottom CTA */}
        <footer className="sticky bottom-0 border-t border-[#2A3942] bg-[#202C33] p-4">
          {!isExpired ? (
            <button
              type="button"
              onClick={() => {
                if (onBookDealInDemo) {
                  onBookDealInDemo(deal.id);
                } else {
                  setShowFlow(true);
                }
              }}
              className="w-full min-h-[48px] rounded-xl bg-[#25D366] hover:bg-[#20BD5A] text-[#0B141A] text-sm font-bold flex items-center justify-center gap-2 transition"
            >
              <Tag className="size-4" />
              <span>{copy.bookDealBtn}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowFlow(true)}
              className="w-full min-h-[48px] rounded-xl border border-[#2A3942] bg-[#111B21] hover:bg-[#2A3942] text-[#E9EDEF] text-xs font-bold flex items-center justify-center gap-2 transition"
            >
              <span>{copy.bookRegularBtn}</span>
            </button>
          )}
        </footer>
      </div>
    </div>
  );
};

