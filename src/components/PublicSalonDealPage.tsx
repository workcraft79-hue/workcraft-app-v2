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
import type { AdAttributionChannel, ClientPreferredLang, PublicDealPageResponse } from '../types/concierge';
import { CustomerBookingFlow } from './CustomerBookingFlow';

interface PublicSalonDealPageProps {
  salonId: string;
  salonCode?: string;
  dealId: string;
  adSource?: AdAttributionChannel;
  initialLang?: ClientPreferredLang;
  isDemo?: boolean;
  onNavigate?: (path: string) => void;
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
  it: {
    activeDealBadge: 'OFFERTA ATTIVA',
    expiredDealBadge: 'OFFERTA SCADUTA',
    expiresLabel: 'Valida fino al',
    includedServices: 'Servizi Inclusi',
    bookDealBtn: 'Prenota Questa Offerta',
    bookRegularBtn: 'Prenota Servizi Standard',
    expiredNotice: 'Questa offerta promozionale è scaduta e non è più prenotabile.',
    purgedVideoNotice: 'Il video promozionale è stato rimosso automaticamente.',
    openMapsBtn: 'Indicazioni Google Maps',
    copyBtn: 'Copia',
    copiedBtn: 'Copiato',
    minUnit: 'min',
  },
  ru: {
    activeDealBadge: 'АКТИВНАЯ АКЦИЯ',
    expiredDealBadge: 'АКЦИЯ ЗАВЕРШЕНА',
    expiresLabel: 'Действует до',
    includedServices: 'Включённые услуги',
    bookDealBtn: 'Забронировать акцию',
    bookRegularBtn: 'Выбрать обычные услуги',
    expiredNotice: 'Срок действия этой акции истёк.',
    purgedVideoNotice: 'Промо-видео было автоматически удалено.',
    openMapsBtn: 'Маршрут на Google Картах',
    copyBtn: 'Копировать',
    copiedBtn: 'Скопировано',
    minUnit: 'мин',
  },
  fr: {
    activeDealBadge: 'OFFRE EN COURS',
    expiredDealBadge: 'OFFRE EXPIRÉE',
    expiresLabel: "Valable jusqu'au",
    includedServices: 'Services Inclus',
    bookDealBtn: 'Réserver Cette Offre',
    bookRegularBtn: 'Réserver les Services Standards',
    expiredNotice: 'Cette offre promotionnelle a expiré.',
    purgedVideoNotice: 'La vidéo promotionnelle a été supprimée automatiquement.',
    openMapsBtn: 'Itinéraire Google Maps',
    copyBtn: 'Copier',
    copiedBtn: 'Copié',
    minUnit: 'min',
  },
  de: {
    activeDealBadge: 'AKTUELLES ANGEBOT',
    expiredDealBadge: 'ANGEBOT ABGELAUFEN',
    expiresLabel: 'Gültig bis',
    includedServices: 'Enthaltene Leistungen',
    bookDealBtn: 'Dieses Angebot buchen',
    bookRegularBtn: 'Reguläre Leistungen buchen',
    expiredNotice: 'Dieses Angebot ist abgelaufen und nicht mehr buchbar.',
    purgedVideoNotice: 'Das Werbevideo wurde automatisch entfernt.',
    openMapsBtn: 'Google Maps Route',
    copyBtn: 'Kopieren',
    copiedBtn: 'Kopiert',
    minUnit: 'Min',
  },
  es: {
    activeDealBadge: 'OFERTA ACTIVA',
    expiredDealBadge: 'OFERTA EXPIRADA',
    expiresLabel: 'Válida hasta',
    includedServices: 'Servicios Incluidos',
    bookDealBtn: 'Reservar Esta Oferta',
    bookRegularBtn: 'Reservar Servicios Regulares',
    expiredNotice: 'Esta oferta promocional ha expirado.',
    purgedVideoNotice: 'El video promocional fue eliminado automáticamente.',
    openMapsBtn: 'Cómo llegar en Google Maps',
    copyBtn: 'Copiar',
    copiedBtn: 'Copiado',
    minUnit: 'min',
  },
};

export const PublicSalonDealPage: React.FC<PublicSalonDealPageProps> = ({
  salonId,
  salonCode,
  dealId,
  adSource = 'DIRECT',
  initialLang = 'en',
  isDemo = false,
  onNavigate,
  onBookDealInDemo,
  onClose,
}) => {
  const effectiveCode = salonCode || salonId;
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
      `/api/public/salons/${encodeURIComponent(effectiveCode)}/deals/${encodeURIComponent(dealId)}`
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
  }, [effectiveCode, dealId]);

  if (showFlow && payload) {
    return (
      <CustomerBookingFlow
        salonId={payload.salonId || effectiveCode}
        salonCode={payload.publicCode || effectiveCode}
        adSource={adSource}
        initialDealId={payload.isExpired ? null : payload.deal.id}
        initialLang={lang}
        isDemo={isDemo}
        standalone={!onClose}
        onNavigate={onNavigate}
        onClose={() => setShowFlow(false)}
      />
    );
  }

  const copy = DEAL_COPY[lang] || DEAL_COPY.en;
  const dir: 'ltr' | 'rtl' = lang === 'ur' || lang === 'ar' ? 'rtl' : 'ltr';

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0D1117] text-[#F0F6FC] flex items-center justify-center p-6">
        <div className="text-xs font-mono text-[#8B949E]">Loading salon offer...</div>
      </div>
    );
  }

  if (error || !payload) {
    return (
      <div className="min-h-screen bg-[#0D1117] text-[#F0F6FC] flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-[#30363D] bg-[#161B22] p-6 text-center space-y-3">
          <AlertTriangle className="size-8 text-[#F87171] mx-auto" />
          <p className="text-sm font-semibold text-[#F0F6FC]">{error || 'Deal not found.'}</p>
        </div>
      </div>
    );
  }

  const { deal, isExpired, videoPurged } = payload;
  const hasActiveVideo = Boolean(deal.videoUrl && !videoPurged);
  const localizedDealTitle = deal.titleTranslations?.[lang] || deal.title;
  const localizedDealDesc = deal.descriptionTranslations?.[lang] || deal.description;
  const discountSummary =
    deal.discountType === 'PCT'
      ? lang === 'ur'
        ? `${deal.discountValue}% رعایت`
        : lang === 'ar'
        ? `خصم ${deal.discountValue}%`
        : `${deal.discountValue}% OFF`
      : deal.discountType === 'FIXED'
      ? lang === 'ur'
        ? `${payload.currencySymbol}${deal.discountValue.toLocaleString()} رعایت`
        : lang === 'ar'
        ? `خصم ${payload.currencySymbol}${deal.discountValue.toLocaleString()}`
        : `${payload.currencySymbol}${deal.discountValue.toLocaleString()} OFF`
      : lang === 'ur'
      ? `پیکیج ${payload.currencySymbol}${deal.discountValue.toLocaleString()}`
      : lang === 'ar'
      ? `باقة ${payload.currencySymbol}${deal.discountValue.toLocaleString()}`
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
      className="min-h-screen bg-[#0D1117] text-[#F0F6FC] flex flex-col items-center sm:py-6 sm:px-4"
    >
      <div className="w-full max-w-md bg-[#161B22] min-h-screen sm:min-h-0 sm:rounded-3xl sm:border sm:border-[#30363D] sm:shadow-2xl overflow-hidden flex flex-col">
        {/* Top-Left Crisp White-Label Salon Header */}
        <header
          dir="ltr"
          className="bg-[#161B22] border-b border-[#30363D] px-3.5 py-2.5 flex items-center justify-between gap-2.5"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src={LOGO_URL}
              alt={payload.salonName}
              className="size-10 sm:size-11 bg-transparent object-contain shrink-0"
            />
            <div className="min-w-0">
              <span
                className={`text-[10px] font-mono font-bold uppercase tracking-wider block ${
                  isExpired ? 'text-[#F87171]' : 'text-[#06B6D4]'
                }`}
              >
                {isExpired ? copy.expiredDealBadge : copy.activeDealBadge}
              </span>
              <h1 className="text-sm font-bold text-[#F0F6FC] truncate">{payload.salonName}</h1>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <select
              aria-label="Language"
              value={lang}
              onChange={(e) => setLang(e.target.value as ClientPreferredLang)}
              className="min-h-[36px] rounded-lg border border-[#30363D] bg-[#0D1117] px-2 text-xs text-[#F0F6FC] focus:outline-none focus:border-[#06B6D4]"
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
                className="min-h-[36px] min-w-[36px] rounded-lg border border-[#30363D] bg-[#0D1117] grid place-items-center text-[#8B949E] hover:text-[#F0F6FC]"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </header>

        {/* Body */}
        <main className="flex-1 p-4 space-y-4">
          {/* Promotional Video Player */}
          {(hasActiveVideo || videoPurged) && (
            <div className="rounded-2xl overflow-hidden border border-[#30363D] bg-[#0D1117]">
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
                  <Film className="size-6 text-[#8B949E] mx-auto" />
                  <p className="text-xs text-[#8B949E] leading-relaxed">
                    {copy.purgedVideoNotice}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Deal Details */}
          <div className="rounded-2xl border border-[#30363D] bg-[#1F242D] p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-lg font-bold text-[#F0F6FC] leading-snug">{localizedDealTitle}</h2>
              <span
                dir="ltr"
                className="rounded-lg bg-[#0D3822] border border-[#116329] px-2.5 py-1 text-xs font-mono font-bold text-[#3FB950] shrink-0"
              >
                {discountSummary}
              </span>
            </div>

            {localizedDealDesc && (
              <p className="text-xs text-[#C9D1D9] leading-relaxed">{localizedDealDesc}</p>
            )}

            <div className="flex items-center gap-2 text-xs font-mono text-[#D29922] pt-1">
              <CalendarClock className="size-4 shrink-0" />
              <span>
                {copy.expiresLabel}:{' '}
                {new Date(deal.expiresAt).toLocaleDateString(
                  lang === 'ur' ? 'ur-PK' : lang === 'ar' ? 'ar-AE' : lang === 'it' ? 'it-IT' : lang === 'ru' ? 'ru-RU' : lang === 'fr' ? 'fr-FR' : lang === 'de' ? 'de-DE' : lang === 'es' ? 'es-ES' : 'en-GB'
                )}
              </span>
            </div>
          </div>

          {isExpired && (
            <div className="rounded-xl border border-[#da3633] bg-[#4C1C1D] p-3.5 text-xs text-[#FCA5A5] flex items-start gap-2">
              <AlertTriangle className="size-4 shrink-0 mt-0.5 text-[#F87171]" />
              <span>{copy.expiredNotice}</span>
            </div>
          )}

          {/* Included Services */}
          <div className="rounded-2xl border border-[#30363D] bg-[#1F242D] p-4 space-y-2.5">
            <h3 className="text-xs font-mono font-bold uppercase text-[#8B949E] flex items-center gap-1.5">
              <Scissors className="size-3.5 text-[#06B6D4]" />
              <span>{copy.includedServices}</span>
            </h3>
            <div className="space-y-1.5">
              {payload.matchedServices.map((svc) => (
                <div
                  key={svc.id || svc.name}
                  className="flex items-center justify-between text-xs py-1 border-b border-[#30363D] last:border-none"
                >
                  <span className="text-[#F0F6FC] font-medium">
                    {svc.translations?.[lang] || svc.name} · {svc.durationMins || 35} {copy.minUnit}
                  </span>
                  <span dir="ltr" className="font-mono text-[#8B949E] tabular-nums">
                    {payload.currencySymbol}
                    {svc.price.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Salon Address + Google Maps Directions & Small Copy Button */}
          <div className="rounded-2xl border border-[#30363D] bg-[#0D1117] p-3.5 space-y-2.5">
            <div className="flex items-start gap-2 text-xs text-[#C9D1D9]">
              <MapPin className="size-4 text-[#06B6D4] shrink-0 mt-0.5" />
              <span className="leading-relaxed">{payload.address}</span>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={payload.googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-h-[38px] rounded-lg border border-[#30363D] bg-[#161B22] hover:border-[#06B6D4] px-3 text-xs font-semibold text-[#06B6D4] flex items-center justify-center gap-1.5 transition"
              >
                <MapPin className="size-3.5 text-[#06B6D4] shrink-0" />
                <span>{copy.openMapsBtn}</span>
                <ExternalLink className="size-3 shrink-0" />
              </a>
              <button
                type="button"
                onClick={() => void handleCopyMaps()}
                className="min-h-[38px] rounded-lg border border-[#30363D] bg-[#161B22] hover:border-[#06B6D4] px-3 text-xs font-semibold text-[#C9D1D9] flex items-center gap-1.5 shrink-0 transition"
              >
                {copiedMaps ? (
                  <>
                    <Check className="size-3.5 text-[#3FB950]" />
                    <span className="text-[#3FB950]">{copy.copiedBtn}</span>
                  </>
                ) : (
                  <>
                    <Copy className="size-3.5 text-[#8B949E]" />
                    <span>{copy.copyBtn}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </main>

        {/* Bottom CTA */}
        <footer className="sticky bottom-0 border-t border-[#30363D] bg-[#161B22] p-4">
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
              className="w-full min-h-[48px] rounded-xl bg-[#06B6D4] hover:bg-[#0891B2] text-[#0D1117] text-sm font-bold flex items-center justify-center gap-2 transition"
            >
              <Tag className="size-4" />
              <span>{copy.bookDealBtn}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowFlow(true)}
              className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] hover:bg-[#1F242D] text-[#F0F6FC] text-xs font-bold flex items-center justify-center gap-2 transition"
            >
              <span>{copy.bookRegularBtn}</span>
            </button>
          )}
        </footer>
      </div>
    </div>
  );
};

