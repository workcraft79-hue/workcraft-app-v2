import React, { useEffect, useRef, useState } from 'react';
import {
  MapPin,
  Clock,
  Tag,
  Play,
  Pause,
  Calendar,
  ExternalLink,
  AlertTriangle,
  Scissors,
  ArrowLeft,
  VideoOff,
  CheckCircle2,
} from 'lucide-react';
import { CustomerLanguage, SalonCustomerConfig, SalonDealItem } from '../types/customerExperience';
import { CUSTOMER_COPY } from '../data/customerExperienceI18n';
import { isDealExpired } from '../services/salonCustomerStore';

interface SalonDealPageProps {
  salonConfig: SalonCustomerConfig;
  deal: SalonDealItem;
  language?: CustomerLanguage;
  onChangeLanguage?: (lang: CustomerLanguage) => void;
  onBookDeal: (deal: SalonDealItem) => void;
  onBack?: () => void;
  standalone?: boolean;
}

const ProceduralPromoPlayer: React.FC<{
  salonName: string;
  deal: SalonDealItem;
  currencySymbol: string;
}> = ({ salonName, deal, currencySymbol }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let startTime = performance.now();
    const durationMs = 8000;

    const renderFrame = (now: number) => {
      const elapsed = isPlaying ? (now - startTime) % durationMs : progress * durationMs;
      const pct = elapsed / durationMs;
      if (isPlaying) {
        setProgress(pct);
      }

      const w = canvas.width;
      const h = canvas.height;

      // Dark studio gradient background
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#0D1117');
      grad.addColorStop(0.5, '#111927');
      grad.addColorStop(1, '#082F49');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Animated subtle light sweep
      const sweepX = pct * (w + 180) - 90;
      const sweepGrad = ctx.createRadialGradient(sweepX, h * 0.35, 10, sweepX, h * 0.35, 220);
      sweepGrad.addColorStop(0, 'rgba(6, 182, 212, 0.28)');
      sweepGrad.addColorStop(0.6, 'rgba(210, 153, 34, 0.12)');
      sweepGrad.addColorStop(1, 'rgba(13, 17, 23, 0)');
      ctx.fillStyle = sweepGrad;
      ctx.fillRect(0, 0, w, h);

      // Frame border
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.45)';
      ctx.lineWidth = 2;
      ctx.strokeRect(12, 12, w - 24, h - 24);

      // Top salon label
      ctx.fillStyle = '#06B6D4';
      ctx.font = 'bold 14px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillText(salonName.toUpperCase(), 28, 44);

      // Promo Reel indicator
      ctx.fillStyle = '#D29922';
      ctx.font = 'bold 12px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillText(`PROMO REEL · ${deal.discountPercent}% OFF`, 28, 66);

      // Animated central headline
      const pulseScale = 1 + Math.sin(pct * Math.PI * 4) * 0.025;
      ctx.save();
      ctx.translate(w / 2, h * 0.48);
      ctx.scale(pulseScale, pulseScale);

      ctx.fillStyle = '#F0F6FC';
      ctx.textAlign = 'center';
      ctx.font = 'bold 24px system-ui, -apple-system, sans-serif';
      const titleWords = deal.title.split(' ');
      const line1 = titleWords.slice(0, 4).join(' ');
      const line2 = titleWords.slice(4).join(' ');
      ctx.fillText(line1, 0, -10);
      if (line2) {
        ctx.fillStyle = '#22D3EE';
        ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
        ctx.fillText(line2, 0, 22);
      }
      ctx.restore();

      // Bottom footer text inside video reel
      ctx.textAlign = 'left';
      ctx.fillStyle = '#8B949E';
      ctx.font = '13px system-ui, -apple-system, sans-serif';
      ctx.fillText(`Pay at Salon (${currencySymbol.trim()}) · Limited Time Offer`, 28, h - 34);

      if (isPlaying) {
        rafId = window.requestAnimationFrame(renderFrame);
      }
    };

    rafId = window.requestAnimationFrame(renderFrame);
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [isPlaying, deal.title, deal.discountPercent, salonName, currencySymbol]);

  return (
    <div className="relative rounded-2xl overflow-hidden border border-[#30363D] bg-[#0D1117]">
      <canvas
        ref={canvasRef}
        width={640}
        height={360}
        className="w-full aspect-video block bg-[#0D1117]"
      />
      <div className="px-3.5 py-2.5 bg-[#161B22] border-t border-[#30363D] flex items-center gap-3">
        <button
          type="button"
          onClick={() => setIsPlaying((prev) => !prev)}
          className="min-h-[40px] min-w-[40px] rounded-xl bg-[#06B6D4] hover:bg-[#22D3EE] text-[#0D1117] grid place-items-center shrink-0 transition"
          aria-label={isPlaying ? 'Pause promo video' : 'Play promo video'}
        >
          {isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
        </button>
        <div className="flex-1 space-y-1">
          <div className="h-1.5 w-full rounded-full bg-[#21262D] overflow-hidden">
            <div
              className="h-full bg-[#06B6D4] transition-all duration-100"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] font-mono text-[#8B949E]">
            <span>{deal.videoName || 'promo_offer.mp4'}</span>
            <span>00:{String(Math.round(progress * 8)).padStart(2, '0')} / 00:08</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export const SalonDealPage: React.FC<SalonDealPageProps> = ({
  salonConfig,
  deal,
  language = 'en',
  onChangeLanguage,
  onBookDeal,
  onBack,
  standalone = false,
}) => {
  const copy = CUSTOMER_COPY[language] || CUSTOMER_COPY.en;
  const expired = isDealExpired(deal);
  const includedServices = salonConfig.services.filter(
    (s) => s.active && deal.serviceIds.includes(s.id)
  );
  const regularTotal = includedServices.reduce((sum, s) => sum + s.price, 0);
  const discountedTotal = Math.max(
    0,
    Math.round(regularTotal * (1 - (deal.discountPercent || 0) / 100))
  );
  const totalDuration = includedServices.reduce((sum, s) => sum + (s.durationMins || 30), 0);

  const formattedExpiry = new Date(deal.expiresAtIso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const isProceduralVideo = Boolean(deal.videoUrl && deal.videoUrl.startsWith('procedural://'));
  const hasRealVideo = Boolean(deal.videoUrl && !isProceduralVideo);

  return (
    <div
      dir={copy.dir}
      className={`${
        standalone ? 'min-h-screen bg-[#0D1117] px-3 py-5 sm:py-8' : ''
      } text-[#F0F6FC] font-sans`}
    >
      <div className="max-w-xl mx-auto rounded-3xl border border-[#30363D] bg-[#161B22] overflow-hidden shadow-2xl">
        {/* Header Bar */}
        <div className="px-4 py-3.5 border-b border-[#30363D] bg-[#0D1117] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="min-h-[40px] min-w-[40px] rounded-xl border border-[#30363D] bg-[#161B22] hover:border-[#06B6D4] grid place-items-center text-[#F0F6FC] shrink-0 transition"
                aria-label="Back"
              >
                <ArrowLeft className="size-4" />
              </button>
            )}
            <div className="min-w-0">
              <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#06B6D4] truncate">
                {salonConfig.salonName}
              </p>
              <h1 className="text-sm sm:text-base font-black text-[#F0F6FC] truncate">
                {deal.title}
              </h1>
            </div>
          </div>

          {onChangeLanguage && salonConfig.supportedLanguages.length > 1 && (
            <select
              value={language}
              onChange={(e) => onChangeLanguage(e.target.value as CustomerLanguage)}
              className="min-h-[38px] rounded-xl border border-[#30363D] bg-[#161B22] px-2.5 text-xs font-mono text-[#F0F6FC] focus:outline-none focus:border-[#06B6D4] shrink-0"
              aria-label={copy.chooseLanguageLabel}
            >
              {salonConfig.supportedLanguages.map((langCode) => (
                <option key={langCode} value={langCode}>
                  {CUSTOMER_COPY[langCode].langName}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          {/* Expiry / Deleted Video Banners */}
          {expired && (
            <div className="rounded-2xl border border-[#da3633] bg-[#4C1C1D] p-3.5 flex items-start gap-2.5 text-xs">
              <AlertTriangle className="size-4 text-[#F85149] shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-[#F85149]">{copy.dealExpiredTitle}</p>
                <p className="text-[#F0F6FC]/90 mt-0.5">
                  {copy.expiresLabel}: {formattedExpiry}
                </p>
              </div>
            </div>
          )}

          {/* Promotional Video Area */}
          {deal.videoUrl === null ? (
            <div className="rounded-2xl border border-[#30363D] bg-[#0D1117] p-6 text-center space-y-2">
              <VideoOff className="size-7 text-[#8B949E] mx-auto" />
              <p className="text-xs font-mono font-bold text-[#D29922]">
                Video Removed After Retention Window
              </p>
              <p className="text-xs text-[#8B949E] leading-relaxed">
                {copy.dealVideoDeletedNote(
                  deal.retentionDaysAfterExpiry || salonConfig.dealRetentionDaysAfterExpiry || 30
                )}
              </p>
            </div>
          ) : hasRealVideo ? (
            <div className="rounded-2xl overflow-hidden border border-[#30363D] bg-[#0D1117]">
              <video
                src={deal.videoUrl || undefined}
                controls
                playsInline
                className="w-full aspect-video bg-black"
              />
            </div>
          ) : (
            <ProceduralPromoPlayer
              salonName={salonConfig.salonName}
              deal={deal}
              currencySymbol={salonConfig.currencySymbol}
            />
          )}

          {/* Offer Details */}
          <div className="rounded-2xl border border-[#30363D] bg-[#0D1117] p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-[#D29922]">
                  <Tag className="size-3.5" />
                  <span>{deal.discountPercent}% OFF PROMOTIONAL OFFER</span>
                </div>
                <h2 className="text-base sm:text-lg font-black text-[#F0F6FC] leading-snug">
                  {deal.title}
                </h2>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-[#8B949E] leading-relaxed">
              {deal.description}
            </p>

            {/* Included Services Breakdown */}
            {includedServices.length > 0 && (
              <div className="pt-2 border-t border-[#21262D] space-y-2">
                <span className="text-[11px] font-mono font-bold uppercase text-[#06B6D4] flex items-center gap-1.5">
                  <Scissors className="size-3.5" />
                  <span>Included Services ({totalDuration} {copy.durationUnit})</span>
                </span>
                <div className="space-y-1.5">
                  {includedServices.map((svc) => (
                    <div
                      key={svc.id}
                      className="flex items-center justify-between text-xs bg-[#161B22] rounded-xl px-3 py-2 border border-[#30363D]"
                    >
                      <span className="text-[#F0F6FC] font-medium flex items-center gap-1.5">
                        <CheckCircle2 className="size-3.5 text-[#3FB950] shrink-0" />
                        <span>{svc.name}</span>
                      </span>
                      <span className="font-mono text-[#8B949E] shrink-0">
                        {svc.durationMins} {copy.durationUnit} · {salonConfig.currencySymbol}
                        {svc.price.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-2 text-sm font-mono font-bold">
                  <span className="text-[#8B949E]">Deal Price (Pay at Salon):</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#6E7681] line-through">
                      {salonConfig.currencySymbol}{regularTotal.toLocaleString()}
                    </span>
                    <span className="text-[#3FB950] text-base font-black">
                      {salonConfig.currencySymbol}{discountedTotal.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Expiry & Salon Location */}
            <div className="pt-2 border-t border-[#21262D] space-y-2 text-xs">
              <div className="flex items-center justify-between text-[#8B949E]">
                <span className="flex items-center gap-1.5">
                  <Clock className="size-3.5 text-[#D29922]" />
                  <span>{copy.expiresLabel}:</span>
                </span>
                <span className={`font-mono font-bold ${expired ? 'text-[#F85149]' : 'text-[#F0F6FC]'}`}>
                  {formattedExpiry}
                </span>
              </div>

              <div className="flex items-start justify-between gap-2 text-[#8B949E]">
                <span className="flex items-start gap-1.5">
                  <MapPin className="size-3.5 text-[#06B6D4] shrink-0 mt-0.5" />
                  <span>{salonConfig.address}</span>
                </span>
                <a
                  href={salonConfig.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[#06B6D4] hover:underline font-mono font-bold shrink-0"
                >
                  <span>Maps</span>
                  <ExternalLink className="size-3" />
                </a>
              </div>
            </div>
          </div>

          {/* Primary CTA */}
          {!expired ? (
            <button
              type="button"
              onClick={() => onBookDeal(deal)}
              className="w-full min-h-[52px] rounded-2xl bg-[#06B6D4] hover:bg-[#22D3EE] text-[#0D1117] font-mono font-black text-sm uppercase tracking-wider transition active:scale-[0.99] flex items-center justify-center gap-2 shadow-lg"
            >
              <Calendar className="size-4" />
              <span>{copy.bookThisDealCta}</span>
            </button>
          ) : (
            <button
              type="button"
              disabled
              className="w-full min-h-[48px] rounded-2xl border border-[#30363D] bg-[#21262D] text-[#6E7681] font-mono font-bold text-xs uppercase cursor-not-allowed"
            >
              {copy.dealExpiredTitle}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
