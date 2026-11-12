import React, { useEffect, useState } from 'react';
import { Download, FileText, QrCode, Printer, CheckCircle2, Sparkles } from 'lucide-react';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import { LOGO_URL } from '../data/portalData';

export type PosterLang = 'en' | 'ur' | 'ar';
export type PosterFormat = 'WINDOW_A4' | 'CABIN_PAMPHLET';

interface SalonWindowPosterPdfProps {
  salonName: string;
  salonCategory?: 'MENS' | 'LADIES';
  whatsappNumber: string;
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
    scanLabel: 'SCAN TO BOOK ON WHATSAPP',
    whatsappLabel: 'Salon WhatsApp Booking Number',
    badgeMens: "Men's Grooming & Salon · WhatsApp Enabled",
    badgeLadies: 'Ladies Beauty Parlor · WhatsApp Enabled',
    headline: 'Valued Customers — Instant 24/7 WhatsApp Booking!',
    phrase:
      'From today, we are using the WorkCraft WhatsApp Concierge Service. Simply scan the QR code above or send "Hi" to our WhatsApp number to book your appointment, choose your barber or stylist, check service prices, and receive VIP deals anytime.',
    steps: [
      '1. Scan QR or message our WhatsApp',
      '2. Pick services, stylist & time slot',
      '3. Get instant WhatsApp confirmation',
    ],
  },
  ur: {
    langLabel: 'اردو (Urdu)',
    isRtl: true,
    scanLabel: 'واٹس ایپ بکنگ کے لیے کیو آر اسکین کریں',
    whatsappLabel: 'سیلون واٹس ایپ بکنگ نمبر',
    badgeMens: 'مینس سیلون · واٹس ایپ خودکار بکنگ',
    badgeLadies: 'لیڈیز بیوٹی پارلر · واٹس ایپ خودکار بکنگ',
    headline: 'معزز کسٹمرز — اب 24 گھنٹے واٹس ایپ پر فوری بکنگ!',
    phrase:
      'آج سے ہم جدید واٹس ایپ آٹومیٹک بکنگ سروس استعمال کر رہے ہیں۔ اوپر دیا گیا کیو آر کوڈ اسکین کریں یا ہمارے واٹس ایپ نمبر پر میسج کریں اور آسانی سے اپنی اپائنٹمنٹ بک کریں، اپنا اسٹائلسٹ منتخب کریں، تمام سروسز کے ریٹ چیک کریں اور خصوصی ڈیلز حاصل کریں۔',
    steps: [
      '1۔ کیو آر اسکین کریں یا واٹس ایپ پر میسج کریں',
      '2۔ سروسز، اسٹائلسٹ اور وقت منتخب کریں',
      '3۔ فوری واٹس ایپ کنفرمیشن حاصل کریں',
    ],
  },
  ar: {
    langLabel: 'العربية (Arabic)',
    isRtl: true,
    scanLabel: 'امسح الرمز للحجز عبر واتساب',
    whatsappLabel: 'رقم واتساب الصالون للحجز',
    badgeMens: 'صالون رجالي · الحجز الذكي عبر واتساب',
    badgeLadies: 'صالون تجميل نسائي · الحجز الذكي عبر واتساب',
    headline: 'عملاءنا الكرام — احجز موعدك فوراً عبر واتساب ٢٤/٧!',
    phrase:
      'اعتباراً من اليوم، نستخدم خدمة الحجز التلقائي عبر واتساب. امسح رمز الاستجابة السريعة (QR) أعلاه أو أرسل رسالة إلى رقم الواتساب الخاص بنا لحجز موعدك بسهولة، واختيار المصفف المفضل، ومعرفة الأسعار، والحصول على عروض VIP الحصرية.',
    steps: [
      '١. امسح رمز QR أو راسلنا على واتساب',
      '٢. اختر الخدمات والمصفف والوقت المناسب',
      '٣. احصل على تأكيد فوري لموعدك على واتساب',
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

  useEffect(() => {
    setPosterLang(initialLanguage);
  }, [initialLanguage]);

  const cleanPhoneDigits = whatsappNumber.replace(/[^\d]/g, '') || '923004567890';
  const waDeepLink = `https://wa.me/${cleanPhoneDigits}?text=${encodeURIComponent(
    `Assalamu Alaikum ${salonName}, I want to book an appointment.`
  )}`;

  useEffect(() => {
    let mounted = true;
    QRCode.toDataURL(waDeepLink, {
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
  }, [waDeepLink]);

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

      // 2. TOP ROW: TOP-LEFT WORKCRAFT LOCAL LOGO + TOP-RIGHT QR CODE & WHATSAPP NUMBER UNDERNEATH
      const loadDataUrlImage = (src: string): Promise<HTMLImageElement | null> =>
        new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
          img.src = src;
        });

      const loadExternalSafe = async (url: string): Promise<HTMLImageElement | null> => {
        try {
          const res = await fetch(url, { mode: 'cors' });
          if (!res.ok) return null;
          const blob = await res.blob();
          tempObjectUrl = URL.createObjectURL(blob);
          return await loadDataUrlImage(tempObjectUrl);
        } catch {
          return null;
        }
      };

      const resolvedQrUrl =
        qrDataUrl ||
        (await QRCode.toDataURL(waDeepLink, {
          width: 360,
          margin: 1,
          color: { dark: '#0E1E17', light: '#FFFFFF' },
        }));

      const [logoImg, qrImg] = await Promise.all([
        loadExternalSafe(LOGO_URL),
        loadDataUrlImage(resolvedQrUrl),
      ]);

      // Top-Left Logo Rendering
      drawRoundedRect(ctx, 84, 84, 340, 128, 20);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(217, 164, 65, 0.45)';
      ctx.lineWidth = 2;
      ctx.stroke();

      if (logoImg) {
        ctx.drawImage(logoImg, 98, 96, 102, 102);
      } else {
        ctx.fillStyle = '#D9A441';
        ctx.beginPath();
        ctx.arc(148, 148, 42, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#12241C';
        ctx.font = 'bold 34px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('WC', 148, 160);
      }

      ctx.textAlign = 'left';
      ctx.fillStyle = '#00FFFF';
      ctx.font = 'bold 20px monospace';
      ctx.fillText('OFFICIAL BOOKING', 214, 155);

      // Top-Right QR Code Card + Salon Owner WhatsApp Number Directly Under QR Code
      const qrBoxX = canvas.width - 390;
      const qrBoxY = 84;
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

      // Scan prompt & WhatsApp number directly under QR code
      ctx.textAlign = 'center';
      ctx.fillStyle = '#00FFFF';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText(copy.scanLabel, qrBoxX + qrBoxW / 2, qrBoxY + 296);

      ctx.fillStyle = '#D9A441';
      ctx.font = 'bold 26px monospace';
      ctx.fillText(whatsappNumber, qrBoxX + qrBoxW / 2, qrBoxY + 334);

      // 3. MIDDLE: PROMINENT SALON / LADIES BEAUTY PARLOR NAME
      const salonLeftX = 88;
      const salonMaxW = qrBoxX - salonLeftX - 40;

      // Category pill badge on left below logo
      drawRoundedRect(ctx, salonLeftX, 246, Math.min(salonMaxW, 560), 42, 12);
      ctx.fillStyle = isLadies ? 'rgba(244, 114, 182, 0.16)' : 'rgba(16, 185, 129, 0.16)';
      ctx.fill();
      ctx.strokeStyle = isLadies ? 'rgba(244, 114, 182, 0.5)' : 'rgba(16, 185, 129, 0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.textAlign = 'left';
      ctx.fillStyle = isLadies ? '#F9A8D4' : '#6EE7B7';
      ctx.font = 'bold 19px sans-serif';
      ctx.fillText(isLadies ? copy.badgeLadies : copy.badgeMens, salonLeftX + 18, 274);

      // Big Salon Name
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 58px sans-serif';
      const nameLines = wrapCanvasText(ctx, salonName, salonMaxW);
      let nameY = 358;
      for (const line of nameLines.slice(0, 3)) {
        ctx.fillText(line, salonLeftX, nameY);
        nameY += 68;
      }

      if (location) {
        ctx.fillStyle = 'rgba(245, 242, 233, 0.7)';
        ctx.font = '500 24px sans-serif';
        ctx.fillText(location, salonLeftX, nameY + 6);
      }

      // 4. CENTER VISUAL HIGHLIGHT (WHATSAPP SERVICE STEPS STRIP)
      const stepsY = isA4 ? 540 : 495;
      drawRoundedRect(ctx, 84, stepsY, canvas.width - 168, isA4 ? 260 : 190, 24);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.fillStyle = '#D9A441';
      ctx.font = 'bold 30px sans-serif';
      ctx.fillText(copy.headline, canvas.width / 2, stepsY + 56);

      const stepColW = (canvas.width - 240) / 3;
      copy.steps.forEach((stepText, idx) => {
        const sx = 120 + idx * stepColW + stepColW / 2;
        const sy = stepsY + (isA4 ? 110 : 88);
        drawRoundedRect(ctx, 110 + idx * (stepColW + 10), sy, stepColW - 10, isA4 ? 110 : 80, 16);
        ctx.fillStyle = 'rgba(0, 255, 255, 0.06)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.25)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#F5F2E9';
        ctx.font = 'bold 21px sans-serif';
        const sLines = wrapCanvasText(ctx, stepText, stepColW - 36);
        sLines.slice(0, 2).forEach((sl, li) => {
          ctx.fillText(sl, sx + idx * 10 - 10, sy + (isA4 ? 46 : 36) + li * 28);
        });
      });

      // 5. BOTTOM CUSTOMER ANNOUNCEMENT PHRASE BLOCK (ALWAYS AT BOTTOM OF PDF)
      const bottomBoxH = isA4 ? 760 : 340;
      const bottomBoxY = canvas.height - bottomBoxH - 76;

      drawRoundedRect(ctx, 84, bottomBoxY, canvas.width - 168, bottomBoxH, 28);
      ctx.fillStyle = 'rgba(217, 164, 65, 0.09)';
      ctx.fill();
      ctx.strokeStyle = '#D9A441';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.direction = copy.isRtl ? 'rtl' : 'ltr';
      ctx.fillStyle = '#FFFFFF';
      ctx.font = isA4 ? '600 34px sans-serif' : '600 26px sans-serif';
      const phraseLines = wrapCanvasText(ctx, copy.phrase, canvas.width - 260);
      const lineSpacing = isA4 ? 54 : 38;
      let phraseStartY =
        bottomBoxY +
        Math.max(85, (bottomBoxH - phraseLines.length * lineSpacing) / 2);

      for (const line of phraseLines) {
        ctx.fillText(line, canvas.width / 2, phraseStartY);
        phraseStartY += lineSpacing;
      }

      // Bottom Footer Brand & Number Strip
      ctx.direction = 'ltr';
      ctx.fillStyle = '#00FFFF';
      ctx.font = 'bold 22px monospace';
      ctx.fillText(
        `WhatsApp: ${whatsappNumber}  ·  Powered by WorkCraft Local`,
        canvas.width / 2,
        canvas.height - 105
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
    <div className="space-y-4 text-left">
      {/* Top Action & Format/Language Selector Bar */}
      <div className="rounded-2xl border border-[#30363D] bg-[#0D1117] p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Printer className="size-4 text-[#D29922]" />
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#D29922]">
              {isLadies ? 'Ladies Beauty Parlor' : 'Salon'} Printable Client PDF
            </span>
          </div>
          <p className="text-xs text-[#8B949E] font-sans mt-1">
            Download PDF, print it, and paste on shop entrance glass, mirror, or reception cabin so clients book on WhatsApp.
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

      {/* LIVE VISUAL PDF THEME PREVIEW (EXACT LAYOUT ON ALL SALONS & LADIES PARLORS) */}
      {!compact && (
        <div className="min-w-0 max-w-full overflow-hidden rounded-3xl border-2 border-[#D9A441]/70 bg-gradient-to-b from-[#102019] via-[#12241C] to-[#0B1712] p-5 sm:p-7 shadow-2xl space-y-6">
          {/* TOP SECTION: TOP-LEFT WORKCRAFT LOCAL LOGO + TOP-RIGHT QR WITH WHATSAPP NUMBER UNDERNEATH */}
          <div className="flex flex-col sm:flex-row items-start justify-between gap-5">
            {/* LEFT COLUMN: Top-Left WorkCraft Local Logo + Salon/Parlor Name */}
            <div className="space-y-4 flex-1 min-w-0">
              {/* Strict Top-Left WorkCraft Local Logo */}
              <div className="inline-flex items-center gap-3 rounded-2xl border border-[#D9A441]/40 bg-white/[0.04] px-3.5 py-2.5">
                <img
                  src={LOGO_URL}
                  alt="WorkCraft Local"
                  className="size-11 object-contain"
                />
                <div className="leading-tight">
                  <span className="block text-[11px] font-mono font-bold tracking-[0.2em] text-[#00FFFF]">
                    OFFICIAL BOOKING
                  </span>
                </div>
              </div>

              {/* Category Badge & Salon / Ladies Parlor Name */}
              <div className="space-y-1.5 pt-1">
                <span
                  className={`inline-block rounded-lg border px-2.5 py-1 text-[10px] font-mono font-bold ${
                    isLadies
                      ? 'border-pink-400/40 bg-pink-500/15 text-pink-200'
                      : 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'
                  }`}
                >
                  {isLadies ? copy.badgeLadies : copy.badgeMens}
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  {salonName}
                </h2>
                {location && (
                  <p className="text-xs text-white/65 font-sans">{location}</p>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN: Strict Top-Right QR Code + Owner WhatsApp Number Directly Under QR */}
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
              <p className="text-[10px] font-mono font-bold text-[#00FFFF] max-w-[155px] mx-auto leading-tight">
                {copy.scanLabel}
              </p>
              <p className="text-sm font-mono font-black text-[#D9A441] tracking-tight">
                {whatsappNumber}
              </p>
            </div>
          </div>

          {/* MIDDLE 3-STEP CLIENT GUIDE */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
            <p className="text-center text-sm font-bold text-[#D9A441]">
              {copy.headline}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-center">
              {copy.steps.map((stepText) => (
                <div
                  key={stepText}
                  dir={copy.isRtl ? 'rtl' : 'ltr'}
                  className="rounded-xl border border-[#00FFFF]/25 bg-[#00FFFF]/5 p-2.5 text-xs font-semibold text-[#F5F2E9]"
                >
                  {stepText}
                </div>
              ))}
            </div>
          </div>

          {/* BOTTOM SECTION: ALWAYS SHOWS CUSTOMER ANNOUNCEMENT PHRASE AT THE BOTTOM */}
          <div
            dir={copy.isRtl ? 'rtl' : 'ltr'}
            className="rounded-2xl border-2 border-[#D9A441] bg-[#D9A441]/10 p-5 text-center space-y-2.5"
          >
            <p className="text-sm sm:text-base font-semibold text-white leading-relaxed font-sans">
              {copy.phrase}
            </p>
            <p
              dir="ltr"
              className="text-[11px] font-mono font-bold text-[#00FFFF] pt-1"
            >
              WhatsApp: {whatsappNumber} · Powered by WorkCraft Local
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
                {salonName} — {isLadies ? 'Ladies Parlor' : 'Salon'} Window Poster PDF Ready
              </p>
              <p className="text-[10px] text-[#8B949E] font-sans truncate">
                Top-Left Logo · Top-Right QR ({whatsappNumber}) · Bottom {copy.langLabel} Notice
              </p>
            </div>
          </div>
          <Sparkles className="size-4 text-[#D29922] shrink-0" />
        </div>
      )}
    </div>
  );
};
