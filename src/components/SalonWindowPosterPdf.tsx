import React, { useEffect, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  Download,
  FileText,
  MessageCircle,
  Printer,
  QrCode,
  Sparkles,
} from 'lucide-react';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import { LOGO_URL } from '../data/portalData';

export type PosterLang = 'en' | 'ur' | 'ar';
export type PosterFormat = 'WINDOW_A4' | 'CABIN_PAMPHLET';

interface SalonWindowPosterPdfProps {
  salonName: string;
  salonCategory?: 'MENS' | 'LADIES';
  whatsappNumber: string;
  salonPublicCode?: string;
  publicContactPhone?: string;
  originUrl?: string;
  location?: string;
  initialLanguage?: PosterLang;
  compact?: boolean;
  onDownloaded?: (fileName: string) => void;
}

const POSTER_PHRASES: Record<
  PosterLang,
  {
    langLabel: string;
    isRtl: boolean;
    scanLabel: string;
    whatsappLabel: string;
    badgeMens: string;
    badgeLadies: string;
    headline: string;
    phrase: string;
    steps: [string, string, string];
  }
> = {
  en: {
    langLabel: 'English',
    isRtl: false,
    scanLabel: 'SCAN FOR INSTANT WEB BOOKING',
    whatsappLabel: 'Salon Contact Phone',
    badgeMens: "Men's Grooming & Salon · 24/7 Instant Web QR Booking",
    badgeLadies: 'Ladies Beauty Parlor · 24/7 Instant Web QR Booking',
    headline: 'Respected Customer — Scan QR to Book in 20 Seconds!',
    phrase:
      'Respected Customer, no app download needed! Scan the QR code above to open our live booking page in English, Urdu, or Arabic—pick your favorite stylist or barber, check live service menus & prices, save your personal booking link directly to your WhatsApp chat, and manage or reschedule anytime.',
    steps: [
      '1. Scan QR — no app install needed 24/7',
      '2. Pick services, stylist & live open slot',
      '3. Save your personal link to WhatsApp for 2-tap rebooking',
    ],
  },
  ur: {
    langLabel: 'اردو (Urdu)',
    isRtl: true,
    scanLabel: 'فوری ویب بکنگ کے لیے کیو آر اسکین کریں',
    whatsappLabel: 'سیلون رابطہ نمبر',
    badgeMens: 'مینس سیلون · 24/7 فوری ویب کیو آر بکنگ',
    badgeLadies: 'لیڈیز بیوٹی پارلر · 24/7 فوری ویب کیو آر بکنگ',
    headline: 'معزز کسٹمر — کیو آر اسکین کریں اور 20 سیکنڈ میں بکنگ کریں!',
    phrase:
      'معزز کسٹمر، کسی ایپ کی ضرورت نہیں! اوپر دیا گیا کیو آر کوڈ اسکین کریں اور اردو، عربی یا انگلش میں فوری بکنگ پیج کھولیں—اپنا پسندیدہ اسٹائلسٹ اور وقت منتخب کریں، تمام سروسز کے ریٹس دیکھیں، اپنا ذاتی بکنگ لنک اپنے واٹس ایپ میں محفوظ کریں اور آئندہ 2 کلکس میں دوبارہ بک کریں۔',
    steps: [
      '1۔ کیو آر اسکین کریں — بغیر ایپ انسٹال 24/7',
      '2۔ سروسز، اسٹائلسٹ اور لائیو ٹائم منتخب کریں',
      '3۔ اپنا ذاتی لنک واٹس ایپ میں محفوظ کر کے 2-ٹیپ ری بکنگ کریں',
    ],
  },
  ar: {
    langLabel: 'العربية (Arabic)',
    isRtl: true,
    scanLabel: 'امسح الرمز للحجز الفوري عبر الويب',
    whatsappLabel: 'رقم التواصل للصالون',
    badgeMens: 'صالون رجالي · الحجز الفوري عبر الويب QR',
    badgeLadies: 'صالون تجميل نسائي · الحجز الفوري عبر الويب QR',
    headline: 'عميلنا العزيز — امسح الرمز واحجز موعدك خلال ٢٠ ثانية!',
    phrase:
      'عميلنا العزيز، لا حاجة لتحميل أي تطبيق! امسح رمز QR أعلاه لفتح صفحة الحجز الفورية بالعربية أو الإنجليزية أو الأردية—اختر مصففك المفضل، استعرض قائمة الأسعار والخدمات، احفظ رابطك الشخصي في محادثة واتساب الخاصة بك وأعد الحجز بضغطتين لاحقاً.',
    steps: [
      '١. امسح رمز QR فوراً بدون تحميل أي تطبيق',
      '٢. اختر الخدمات والمصفف والوقت المتاح مباشرة',
      '٣. احفظ رابطك الشخصي في واتساب لإعادة الحجز بضغطتين',
    ],
  },
};

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export const SalonWindowPosterPdf: React.FC<SalonWindowPosterPdfProps> = ({
  salonName,
  salonCategory = 'MENS',
  whatsappNumber,
  salonPublicCode,
  publicContactPhone,
  originUrl,
  location = '',
  initialLanguage = 'en',
  compact = false,
  onDownloaded,
}) => {
  const [posterLang, setPosterLang] = useState<PosterLang>(initialLanguage);
  const [posterFormat, setPosterFormat] = useState<PosterFormat>('WINDOW_A4');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);
  const [pdfDownloadUrl, setPdfDownloadUrl] = useState<string | null>(null);
  const [pdfDownloadName, setPdfDownloadName] = useState<string>('');
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    setPosterLang(initialLanguage);
  }, [initialLanguage]);

  const resolvedContactPhone = publicContactPhone || whatsappNumber;
  const resolvedOrigin =
    originUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://workcraft.app');
  const resolvedCode = salonPublicCode || 'wc_7k9m2p4x8q2a';
  const bookingUrl = `${resolvedOrigin}/s/${encodeURIComponent(resolvedCode)}?src=qr`;
  const shareToClientWaHref = `https://wa.me/?text=${encodeURIComponent(
    `${salonName} — Book anytime in 20 seconds (no app needed): ${bookingUrl}`
  )}`;

  useEffect(() => {
    let mounted = true;
    QRCode.toDataURL(bookingUrl, {
      width: 360,
      margin: 1,
      color: {
        dark: '#0E1E17',
        light: '#FFFFFF',
      },
    })
      .then((url) => {
        if (mounted) setQrDataUrl(url);
      })
      .catch(() => {
        // fallback empty
      });
    return () => {
      mounted = false;
    };
  }, [bookingUrl]);

  const copy = POSTER_PHRASES[posterLang];
  const isLadies =
    salonCategory === 'LADIES' ||
    salonName.toLowerCase().includes('beauty') ||
    salonName.toLowerCase().includes('ladies') ||
    salonName.toLowerCase().includes('parlor') ||
    salonName.toLowerCase().includes('glam');

  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    setPdfError(null);
    let tempObjectUrl: string | null = null;
    try {
      const isA4 = posterFormat === 'WINDOW_A4';
      const canvas = document.createElement('canvas');
      canvas.width = 1240;
      canvas.height = isA4 ? 1754 : 1120;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // 1. Background Theme (Deep Emerald Dark + Gold Accent Frame)
      const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      grad.addColorStop(0, '#102019');
      grad.addColorStop(0.55, '#12241C');
      grad.addColorStop(1, '#0B1712');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Outer Gold Luxury Border
      ctx.strokeStyle = '#D9A441';
      ctx.lineWidth = 8;
      drawRoundedRect(ctx, 36, 36, canvas.width - 72, canvas.height - 72, 32);
      ctx.stroke();

      // Inner Subtle Cyan Accent Border
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.25)';
      ctx.lineWidth = 2;
      drawRoundedRect(ctx, 54, 54, canvas.width - 108, canvas.height - 108, 24);
      ctx.stroke();

      // 2. TOP ROW: TOP-LEFT WORKCRAFT LOGO + TOP-RIGHT QR CODE & WHATSAPP NUMBER UNDERNEATH
      const loadDataUrlImage = (src: string): Promise<HTMLImageElement | null> =>
        new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
          img.src = src;
        });

      const loadExternalSafe = async (url: string): Promise<HTMLImageElement | null> => {
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const res = await fetch(url, { mode: 'cors', cache: 'no-cache' });
            if (res.ok) {
              const blob = await res.blob();
              tempObjectUrl = URL.createObjectURL(blob);
              const img = await loadDataUrlImage(tempObjectUrl);
              if (img) return img;
            }
          } catch {
            // Try direct crossOrigin Image load on second attempt
          }
          const direct = await new Promise<HTMLImageElement | null>((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = url;
          });
          if (direct) return direct;
        }
        return null;
      };

      const resolvedQrUrl =
        qrDataUrl ||
        (await QRCode.toDataURL(bookingUrl, {
          width: 360,
          margin: 1,
          color: { dark: '#0E1E17', light: '#FFFFFF' },
        }));

      const [logoImg, qrImg] = await Promise.all([
        loadExternalSafe(LOGO_URL),
        loadDataUrlImage(resolvedQrUrl),
      ]);

      // Top-Left Original Pure-Transparent WorkCraft Logo Only (Zero redesign or replacement)
      ctx.direction = 'ltr';
      ctx.textAlign = 'left';
      if (logoImg) {
        ctx.drawImage(logoImg, 84, 72, 176, 176);
      }

      // Top-Right QR Code Card + Salon Owner WhatsApp Number (Always Top-Right & LTR)
      const qrBoxX = canvas.width - 390;
      const qrBoxY = 80;
      const qrBoxW = 306;
      const qrBoxH = 365;
      drawRoundedRect(ctx, qrBoxX, qrBoxY, qrBoxW, qrBoxH, 24);
      ctx.fillStyle = '#0B1712';
      ctx.fill();
      ctx.strokeStyle = '#00FFFF';
      ctx.lineWidth = 3;
      ctx.stroke();

      // White QR container inside Top-Right box
      drawRoundedRect(ctx, qrBoxX + 33, qrBoxY + 24, 240, 240, 16);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();

      if (qrImg) {
        ctx.drawImage(qrImg, qrBoxX + 43, qrBoxY + 34, 220, 220);
      }

      // Scan prompt & WhatsApp number directly under QR code (LTR phone number)
      ctx.textAlign = 'center';
      ctx.direction = copy.isRtl ? 'rtl' : 'ltr';
      ctx.fillStyle = '#00FFFF';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText(copy.scanLabel, qrBoxX + qrBoxW / 2, qrBoxY + 296);

      ctx.direction = 'ltr';
      ctx.fillStyle = '#D9A441';
      ctx.font = 'bold 26px monospace';
      ctx.fillText(resolvedContactPhone, qrBoxX + qrBoxW / 2, qrBoxY + 334);

      // 3. LEFT COLUMN BELOW LOGO: CATEGORY BADGE, SALON NAME & ADDRESS (ALWAYS LEFT-ALIGNED)
      const salonLeftX = 84;
      const salonMaxW = qrBoxX - salonLeftX - 40;

      ctx.direction = 'ltr';
      ctx.textAlign = 'left';
      ctx.fillStyle = isLadies ? '#F9A8D4' : '#6EE7B7';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText(isLadies ? copy.badgeLadies : copy.badgeMens, salonLeftX, 274);

      // Big Salon Name
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 56px sans-serif';
      const nameLines = wrapCanvasText(ctx, salonName, salonMaxW);
      let nameY = 342;
      for (const line of nameLines.slice(0, 3)) {
        ctx.fillText(line, salonLeftX, nameY);
        nameY += 66;
      }

      if (location) {
        ctx.fillStyle = 'rgba(245, 242, 233, 0.78)';
        ctx.font = '500 24px sans-serif';
        const locLines = wrapCanvasText(ctx, location, salonMaxW);
        let locY = nameY + 4;
        for (const locLine of locLines.slice(0, 2)) {
          ctx.fillText(locLine, salonLeftX, locY);
          locY += 32;
        }
      }

      // 4. CENTER VISUAL HIGHLIGHT (BALANCED GLASS-DOOR DENSITY FOR A4 & A5)
      const stepsY = isA4 ? 510 : 472;
      ctx.strokeStyle = 'rgba(217, 164, 65, 0.45)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(84, stepsY);
      ctx.lineTo(canvas.width - 84, stepsY);
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.direction = copy.isRtl ? 'rtl' : 'ltr';
      ctx.fillStyle = '#D9A441';
      ctx.font = isA4 ? 'bold 34px sans-serif' : 'bold 28px sans-serif';
      ctx.fillText(copy.headline, canvas.width / 2, stepsY + 60);

      const stepColW = (canvas.width - 180) / 3;
      copy.steps.forEach((stepText, idx) => {
        const sx = 90 + idx * stepColW + stepColW / 2;
        const sy = stepsY + (isA4 ? 124 : 106);
        ctx.fillStyle = '#F5F2E9';
        ctx.font = isA4 ? 'bold 23px sans-serif' : 'bold 20px sans-serif';
        const sLines = wrapCanvasText(ctx, stepText, stepColW - 24);
        sLines.slice(0, 2).forEach((sl, li) => {
          ctx.fillText(sl, sx, sy + li * 32);
        });
      });

      // 5. BOTTOM CUSTOMER ANNOUNCEMENT PHRASE (FULL, CRISP READABILITY FOR A4 DOOR GLASS & A5 PAMPHLET)
      const bottomSectionY = isA4 ? 760 : 665;
      ctx.strokeStyle = 'rgba(217, 164, 65, 0.45)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(84, bottomSectionY);
      ctx.lineTo(canvas.width - 84, bottomSectionY);
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.direction = copy.isRtl ? 'rtl' : 'ltr';
      ctx.fillStyle = '#FFFFFF';
      ctx.font = isA4 ? '600 37px sans-serif' : '600 26px sans-serif';
      const phraseLines = wrapCanvasText(ctx, copy.phrase, canvas.width - 180);
      const lineSpacing = isA4 ? 58 : 39;
      const availableBottomH = canvas.height - 155 - bottomSectionY;
      let phraseStartY =
        bottomSectionY +
        Math.max(76, (availableBottomH - phraseLines.length * lineSpacing) / 2);

      for (const line of phraseLines) {
        ctx.fillText(line, canvas.width / 2, phraseStartY);
        phraseStartY += lineSpacing;
      }

      // Bottom Footer: Matching Golden Salon Contact Phone
      ctx.direction = 'ltr';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#D9A441';
      ctx.font = isA4 ? 'bold 28px monospace' : 'bold 23px monospace';
      ctx.fillText(
        `Call / Contact: ${resolvedContactPhone}`,
        canvas.width / 2,
        canvas.height - 86
      );

      // Export Canvas to Real Downloadable PDF
      const imgData = canvas.toDataURL('image/png', 1.0);
      const pdf = new jsPDF({
        orientation: isA4 ? 'portrait' : 'landscape',
        unit: 'mm',
        format: isA4 ? 'a4' : [210, 148], // A4 Window Poster or A5 Mirror Pamphlet
      });

      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      pdf.addImage(imgData, 'PNG', 0, 0, pageW, pageH);

      const safeSlug = salonName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const fileName = `${safeSlug}-${isA4 ? 'window-poster' : 'cabin-pamphlet'}-${posterLang}.pdf`;

      // Reliable Blob Download across normal tabs & iframes
      const pdfBlob = pdf.output('blob');
      if (pdfDownloadUrl) URL.revokeObjectURL(pdfDownloadUrl);
      const blobUrl = URL.createObjectURL(pdfBlob);
      setPdfDownloadUrl(blobUrl);
      setPdfDownloadName(fileName);

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setDownloadSuccess(`PDF Downloaded: ${fileName}`);
      onDownloaded?.(fileName);
    } catch {
      setPdfError('Could not build PDF automatically. Please try again.');
    } finally {
      if (tempObjectUrl) URL.revokeObjectURL(tempObjectUrl);
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div dir="ltr" className="space-y-4 text-left">
      {/* Top Action & Format/Language Selector Bar */}
      <div className="rounded-2xl border border-[#30363D] bg-[#0D1117] p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Printer className="size-4 text-[#D29922]" />
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#D29922]">
              {isLadies ? 'Ladies Beauty Parlor' : 'Salon'} Printable Web QR Poster
            </span>
          </div>
          <p className="text-xs text-[#8B949E] font-sans mt-1">
            Download PDF, print it for your entrance glass, or share the direct web booking link to a client&apos;s WhatsApp.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Format Selector */}
          <div className="flex items-center rounded-xl border border-[#30363D] bg-[#161B22] p-1 text-[11px] font-mono">
            <button
              type="button"
              onClick={() => setPosterFormat('WINDOW_A4')}
              className={`min-h-[40px] px-3 py-1 rounded-lg transition ${
                posterFormat === 'WINDOW_A4'
                  ? 'bg-[#06B6D4] text-[#0D1117] font-bold'
                  : 'text-[#8B949E] hover:text-[#F0F6FC]'
              }`}
            >
              Window Poster (A4)
            </button>
            <button
              type="button"
              onClick={() => setPosterFormat('CABIN_PAMPHLET')}
              className={`min-h-[40px] px-3 py-1 rounded-lg transition ${
                posterFormat === 'CABIN_PAMPHLET'
                  ? 'bg-[#06B6D4] text-[#0D1117] font-bold'
                  : 'text-[#8B949E] hover:text-[#F0F6FC]'
              }`}
            >
              Cabin Pamphlet (A5)
            </button>
          </div>

          {/* Language Selector matching Owner Onboarding */}
          <select
            value={posterLang}
            onChange={(e) => setPosterLang(e.target.value as PosterLang)}
            className="min-h-[48px] rounded-xl border border-[#30363D] bg-[#161B22] px-3 py-2 text-xs font-mono font-bold text-[#06B6D4] focus:outline-none focus:border-[#06B6D4]"
          >
            <option value="ur" className="bg-[#161B22] text-[#F0F6FC]">
              Language: Urdu (اردو)
            </option>
            <option value="ar" className="bg-[#161B22] text-[#F0F6FC]">
              Language: Arabic (العربية)
            </option>
            <option value="en" className="bg-[#161B22] text-[#F0F6FC]">
              Language: English
            </option>
          </select>

          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(bookingUrl).then(() => {
                setCopiedLink(true);
                setTimeout(() => setCopiedLink(false), 2000);
              }).catch(() => {});
            }}
            className="min-h-[48px] inline-flex items-center gap-1.5 rounded-xl border border-[#30363D] bg-[#161B22] hover:border-[#06B6D4] text-[#F0F6FC] px-3 py-2 text-xs font-mono font-bold transition"
          >
            {copiedLink ? <Check className="size-3.5 text-[#3FB950]" /> : <Copy className="size-3.5" />}
            <span>{copiedLink ? 'Copied' : 'Copy QR Link'}</span>
          </button>

          <a
            href={shareToClientWaHref}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[48px] inline-flex items-center gap-1.5 rounded-xl border border-[#25D366]/60 bg-[#0B2E1E] hover:bg-[#14532D] text-[#25D366] px-3 py-2 text-xs font-mono font-bold transition"
          >
            <MessageCircle className="size-3.5" />
            <span>Share QR to WhatsApp</span>
          </a>

          {/* 1-Click PDF Download Button */}
          <button
            type="button"
            disabled={isGeneratingPdf}
            onClick={handleDownloadPdf}
            className="min-h-[48px] inline-flex items-center gap-2 rounded-xl bg-[#06B6D4] hover:bg-[#22D3EE] text-[#0D1117] px-4 py-2 text-xs font-mono font-black uppercase transition active:scale-95"
          >
            <Download className="size-4" />
            <span>
              {isGeneratingPdf
                ? 'Creating PDF...'
                : 'Download PDF Poster'}
            </span>
          </button>
        </div>
      </div>

      {pdfError && (
        <div className="rounded-xl border border-[#da3633] bg-[#4C1C1D] px-3.5 py-2.5 text-xs font-mono text-[#F85149]">
          {pdfError}
        </div>
      )}

      {downloadSuccess && (
        <div className="rounded-xl border border-[#116329] bg-[#0D3822] px-3.5 py-2.5 text-xs font-mono text-[#3FB950] flex flex-wrap items-center justify-between gap-2 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-[#3FB950] shrink-0" />
            <span>{downloadSuccess}</span>
          </div>
          {pdfDownloadUrl && (
            <a
              href={pdfDownloadUrl}
              download={pdfDownloadName}
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-[#116329] bg-[#161B22] hover:border-[#3FB950] px-3 py-1 text-[11px] font-bold text-[#F0F6FC] transition"
            >
              <Download className="size-3.5" />
              <span>Save PDF File Again</span>
            </a>
          )}
        </div>
      )}

      {/* LIVE VISUAL PDF THEME PREVIEW (FIXED LTR HEADER LOCK ACROSS ALL 3 LANGUAGES & BOTH FORMATS) */}
      {!compact && (
        <div
          dir="ltr"
          className={`min-w-0 max-w-full overflow-hidden rounded-3xl border-2 border-[#D9A441]/70 bg-gradient-to-b from-[#102019] via-[#12241C] to-[#0B1712] shadow-2xl text-left ${
            posterFormat === 'CABIN_PAMPHLET' ? 'p-4 sm:p-5 space-y-4' : 'p-5 sm:p-7 space-y-6'
          }`}
        >
          {/* TOP SECTION: ALWAYS TOP-LEFT ENLARGED WORKCRAFT LOGO + SALON INFO · ALWAYS TOP-RIGHT QR + LTR NUMBER */}
          <div dir="ltr" className="flex flex-col sm:flex-row items-start justify-between gap-5">
            {/* LEFT COLUMN: Enlarged Bold WorkCraft Logo (Watermark Removed) + Salon/Parlor Category, Name & Address */}
            <div dir="ltr" className="space-y-3 flex-1 min-w-0 text-left">
              <div className="inline-flex items-center">
                <img
                  src={LOGO_URL}
                  alt="WorkCraft Transparent Logo"
                  crossOrigin="anonymous"
                  className="size-24 sm:size-28 object-contain drop-shadow-[0_4px_14px_rgba(217,164,65,0.45)]"
                />
              </div>

              {/* Category Label, Salon Name & Address strictly aligned left under WorkCraft logo */}
              <div dir="ltr" className="space-y-1.5 pt-1 text-left">
                <span
                  className={`inline-block text-xs font-mono font-bold ${
                    isLadies ? 'text-pink-300' : 'text-emerald-300'
                  }`}
                >
                  {isLadies ? copy.badgeLadies : copy.badgeMens}
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight text-left">
                  {salonName}
                </h2>
                {location && (
                  <p className="text-xs text-white/75 font-sans text-left">{location}</p>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN: Strict Top-Right QR Code + Owner WhatsApp Number Directly Under QR (Always LTR) */}
            <div className="rounded-2xl border-2 border-[#00FFFF] bg-[#0B1712] p-3.5 text-center space-y-2 shrink-0 self-center sm:self-start shadow-[0_0_24px_rgba(0,255,255,0.18)]">
              <div className="bg-white rounded-xl p-2 size-36 mx-auto grid place-items-center">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`${salonName} WhatsApp Booking QR`}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <QrCode className="size-24 text-[#12241C]" />
                )}
              </div>
              <p
                dir={copy.isRtl ? 'rtl' : 'ltr'}
                className="text-[10px] font-mono font-bold text-[#00FFFF] max-w-[155px] mx-auto leading-tight"
              >
                {copy.scanLabel}
              </p>
              <p dir="ltr" className="text-sm font-mono font-black text-[#D9A441] tracking-tight">
                {resolvedContactPhone}
              </p>
            </div>
          </div>

          {/* MIDDLE 3-STEP CLIENT GUIDE (BALANCED A4 & A5 DOOR-GLASS DENSITY) */}
          <div className="border-t border-[#D9A441]/35 pt-4 space-y-3">
            <p dir={copy.isRtl ? 'rtl' : 'ltr'} className="text-center text-base font-bold text-[#D9A441]">
              {copy.headline}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-center">
              {copy.steps.map((stepText) => (
                <p
                  key={stepText}
                  dir={copy.isRtl ? 'rtl' : 'ltr'}
                  className="px-2 py-1.5 text-xs sm:text-sm font-semibold text-[#F5F2E9]"
                >
                  {stepText}
                </p>
              ))}
            </div>
          </div>

          {/* BOTTOM SECTION */}
          <div
            dir={copy.isRtl ? 'rtl' : 'ltr'}
            className="border-t border-[#D9A441]/35 pt-4 text-center space-y-3"
          >
            <p
              className={`font-semibold text-white leading-relaxed font-sans ${
                posterFormat === 'WINDOW_A4' ? 'text-base sm:text-lg' : 'text-sm sm:text-base'
              }`}
            >
              {copy.phrase}
            </p>
            <p
              dir="ltr"
              className="text-sm font-mono font-black text-[#D9A441] pt-1 tracking-tight"
            >
              Call / Contact: {resolvedContactPhone}
            </p>
          </div>
        </div>
      )}

      {compact && (
        <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <FileText className="size-4 text-[#06B6D4] shrink-0" />
            <div className="min-w-0">
              <p className="font-bold text-[#F0F6FC] truncate">
                {salonName} — {isLadies ? 'Ladies Parlor' : 'Salon'} Web QR Poster PDF Ready
              </p>
              <p className="text-[10px] text-[#8B949E] font-sans truncate">
                QR URL: /s/{resolvedCode}?src=qr · Contact: {resolvedContactPhone}
              </p>
            </div>
          </div>
          <Sparkles className="size-4 text-[#D29922] shrink-0" />
        </div>
      )}
    </div>
  );
};
