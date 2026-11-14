import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BellRing,
  Cake,
  Check,
  CheckCircle2,
  Clock,
  Globe,
  Link2,
  MessageSquare,
  Play,
  RefreshCw,
  Save,
  Send,
  Star,
  UserPlus,
} from 'lucide-react';
import type {
  ClientPreferredLang,
  RetentionSettings,
  SalonConciergeStateResponse,
} from '../types/concierge';

interface SalonRetentionSettingsPanelProps {
  salonId: string;
  salonName: string;
  ownerName: string;
  salonPhone: string;
  conciergeState: SalonConciergeStateResponse | null;
  onStateUpdated: (nextState: SalonConciergeStateResponse) => void;
  onShowToast: (msg: string) => void;
}

const PREVIEW_LANG_TABS: Array<{
  id: ClientPreferredLang;
  label: string;
  dir: 'ltr' | 'rtl';
}> = [
  { id: 'en', label: 'English', dir: 'ltr' },
  { id: 'roman_ur', label: 'Roman Urdu', dir: 'ltr' },
  { id: 'ur', label: 'اردو', dir: 'rtl' },
  { id: 'ar', label: 'العربية', dir: 'rtl' },
];

export const SalonRetentionSettingsPanel: React.FC<SalonRetentionSettingsPanelProps> = ({
  salonId,
  salonName,
  conciergeState,
  onStateUpdated,
  onShowToast,
}) => {
  const [draft, setDraft] = useState<RetentionSettings | null>(conciergeState?.settings ?? null);
  const [previewLang, setPreviewLang] = useState<ClientPreferredLang>('en');
  const [savingSection, setSavingSection] = useState<'BIRTHDAY' | 'WINBACK' | 'REVIEW' | 'ALL' | null>(null);
  const [savedBanner, setSavedBanner] = useState<string | null>(null);

  // Module 1 Interactive Greeting Simulator
  const [simClientPhone, setSimClientPhone] = useState('+92 301 5559012');
  const [simClientName, setSimClientName] = useState('Zain Raza');
  const [simWebhookReply, setSimWebhookReply] = useState<{
    replyText: string;
    replyDir: 'ltr' | 'rtl';
    lockedLanguage: ClientPreferredLang | null;
    routedAction: string;
  } | null>(null);
  const [isWebhookBusy, setIsWebhookBusy] = useState(false);

  // Module 2 Optional Client Birth Date (Day/Month) Quick Editor
  const [newBirthClientName, setNewBirthClientName] = useState('');
  const [newBirthClientPhone, setNewBirthClientPhone] = useState('');
  const [newBirthDayMonth, setNewBirthDayMonth] = useState('');
  const [newBirthLang, setNewBirthLang] = useState<ClientPreferredLang>('roman_ur');

  // Module 4 Live 1-5 Star Routing Tester
  const [ratingSimOutcome, setRatingSimOutcome] = useState<{
    rating: number;
    routedAction: string;
    replyText: string;
    replyDir: 'ltr' | 'rtl';
  } | null>(null);

  useEffect(() => {
    if (conciergeState?.settings) {
      setDraft(conciergeState.settings);
    }
  }, [conciergeState?.settings]);

  if (!draft || !conciergeState) {
    return (
      <div className="rounded-2xl border border-[#30363D] bg-[#161B22] p-6 text-sm text-[#8B949E] font-mono">
        Loading Salon Settings &amp; Concierge State...
      </div>
    );
  }

  const handleSaveSettings = async (section: 'BIRTHDAY' | 'WINBACK' | 'REVIEW' | 'ALL') => {
    setSavingSection(section);
    try {
      const res = await fetch(`/api/salons/${encodeURIComponent(salonId)}/retention-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      if (!res.ok) throw new Error('Failed to save settings');
      const updated = (await res.json()) as SalonConciergeStateResponse;
      onStateUpdated(updated);
      const labelMap = {
        BIRTHDAY: 'Retention & 9:00 AM Birthday Offer settings saved.',
        WINBACK: '30-Day Dormant Win-Back settings saved.',
        REVIEW: 'Post-Service Google Review URL & Booster settings saved.',
        ALL: 'All Salon Concierge & Retention settings saved.',
      };
      setSavedBanner(labelMap[section]);
      onShowToast(`✓ ${labelMap[section]}`);
      setTimeout(() => setSavedBanner(null), 4500);
    } catch {
      onShowToast('Could not save settings. Please try again.');
    } finally {
      setSavingSection(null);
    }
  };

  const handleTriggerCron = async (job: 'birthday_9am' | 'winback_30d' | 'review_t2h') => {
    try {
      const res = await fetch(`/api/salons/${encodeURIComponent(salonId)}/cron/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job, force: true }),
      });
      if (!res.ok) throw new Error('Cron trigger failed');
      const data = await res.json();
      onStateUpdated(data.state);
      const count =
        job === 'birthday_9am'
          ? data.birthdayDispatched
          : job === 'winback_30d'
          ? data.winbackDispatched
          : data.reviewDispatched;
      onShowToast(`✓ Dispatched ${count} WhatsApp message(s) via ${job.toUpperCase()} runner.`);
    } catch {
      onShowToast('Failed to run automated dispatch.');
    }
  };

  const handleSendGreetingWebhook = async (messageText: string, forceLanguagePrompt = false) => {
    setIsWebhookBusy(true);
    try {
      const res = await fetch('/api/whatsapp/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salonId,
          fromPhone: simClientPhone,
          clientName: simClientName,
          messageText,
          forceLanguagePrompt,
        }),
      });
      if (!res.ok) throw new Error('Webhook call failed');
      const data = await res.json();
      setSimWebhookReply({
        replyText: data.replyText,
        replyDir: data.replyDir,
        lockedLanguage: data.lockedLanguage,
        routedAction: data.routedAction,
      });
      onStateUpdated(data.state);
    } catch {
      onShowToast('Webhook simulation failed.');
    } finally {
      setIsWebhookBusy(false);
    }
  };

  const handleSimulateStarFeedback = async (stars: number) => {
    setIsWebhookBusy(true);
    try {
      const sampleClient = conciergeState.clients[0];
      const targetPhone = sampleClient?.phone || '+92 300 1234567';
      const targetName = sampleClient?.name || 'Bilal Ahmed';
      const latestCompleted = conciergeState.appointments.find((a) => a.status === 'COMPLETED');

      const res = await fetch('/api/whatsapp/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salonId,
          fromPhone: targetPhone,
          clientName: targetName,
          messageText: `${stars} stars`,
          appointmentIdForReview: latestCompleted?.id,
        }),
      });
      if (!res.ok) throw new Error('Failed to simulate rating');
      const data = await res.json();
      setRatingSimOutcome({
        rating: stars,
        routedAction: data.routedAction,
        replyText: data.replyText,
        replyDir: data.replyDir,
      });
      onStateUpdated(data.state);
      if (stars <= 3) {
        onShowToast('🚨 Low rating (1–3★) intercepted! Google Review URL suppressed & Owner Alert triggered.');
      } else {
        onShowToast(`✓ ${stars}★ Positive review routed directly to your Google Review link!`);
      }
    } catch {
      onShowToast('Could not simulate star rating.');
    } finally {
      setIsWebhookBusy(false);
    }
  };

  const handleSaveClientBirthDate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBirthClientPhone.trim()) return;
    try {
      const res = await fetch(`/api/salons/${encodeURIComponent(salonId)}/clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newBirthClientName.trim() || 'Client',
          phone: newBirthClientPhone.trim(),
          birthDate: newBirthDayMonth.trim(),
          preferredLanguage: newBirthLang,
        }),
      });
      if (!res.ok) throw new Error('Failed to save client');
      const data = await res.json();
      onStateUpdated(data.state);
      setNewBirthClientName('');
      setNewBirthClientPhone('');
      setNewBirthDayMonth('');
      onShowToast('✓ Client profile & optional birth_date (DD/MM) saved.');
    } catch {
      onShowToast('Could not save client birth_date.');
    }
  };

  const formatBirthdayPreview = (lang: ClientPreferredLang): string => {
    const offerParts = [
      draft.birthdayDiscountPct > 0 ? `${draft.birthdayDiscountPct}% OFF` : '',
      draft.birthdayFixedDiscount > 0 ? `${draft.currencySymbol}${draft.birthdayFixedDiscount.toLocaleString()} OFF` : '',
      draft.birthdayGiftService.trim(),
    ]
      .filter(Boolean)
      .join(' + ');
    const summary = offerParts || 'VIP Chair Priority';

    if (lang === 'roman_ur') {
      return `Happy Birthday Bilal! ${salonName} ki taraf se aap ko bohat mubarakbad. Aaj subah 9:00 AM offer: ${summary}. Appointment book karne ke liye reply karein!`;
    }
    if (lang === 'ur') {
      return `سالگرہ مبارک بلال! ${salonName} کی طرف سے دلی مبارکباد۔ آج صبح 9:00 بجے کی خصوصی آفر: ${summary}۔ بکنگ کے لیے جواب دیں!`;
    }
    if (lang === 'ar') {
      return `عيد ميلاد سعيد يا بلال! تهنئة من ${salonName}. عرض الساعة 9:00 صباحاً الخاص بك: ${summary}. أرسل لتأكيد موعدك!`;
    }
    return draft.birthdayMessageTemplate
      .replace(/\{client_name\}/g, 'Bilal')
      .replace(/\{salon_name\}/g, salonName)
      .replace(/\{offer_summary\}/g, summary);
  };

  const formatWinBackPreview = (lang: ClientPreferredLang): string => {
    const offer = [
      draft.winbackDiscountPct > 0 ? `${draft.winbackDiscountPct}% OFF` : '',
      draft.winbackAddonService.trim(),
    ]
      .filter(Boolean)
      .join(' + ');

    if (lang === 'roman_ur') {
      return `Assalamu Alaikum Fahad! Hum ne aap ko ${salonName} par miss kiya (${draft.winbackDays} din ho gaye). Wapis aayein aur paayein: ${offer}. 1-tap booking ke liye "REBOOK" reply karein!`;
    }
    if (lang === 'ur') {
      return `السلام علیکم فہد! ${salonName} پر آپ کی آخری وزٹ کو ${draft.winbackDays} دن ہو چکے ہیں۔ آپ کے لیے خصوصی آفر: ${offer}۔ فوری بکنگ کے لیے "REBOOK" لکھیں!`;
    }
    if (lang === 'ar') {
      return `مرحباً فهد! اشتقنا لزيارتك في ${salonName} منذ ${draft.winbackDays} يوماً. احصل على: ${offer}. أرسل "REBOOK" للحجز الفوري بضغطة واحدة!`;
    }
    const base = draft.winbackMessageTemplate
      .replace(/\{client_name\}/g, 'Fahad')
      .replace(/\{salon_name\}/g, salonName)
      .replace(/\{days\}/g, String(draft.winbackDays))
      .replace(/\{offer_summary\}/g, offer || 'VIP Offer');
    return `${base} Reply "REBOOK" for 1-tap instant rebooking!`;
  };

  const formatReviewPromptPreview = (lang: ClientPreferredLang): string => {
    if (lang === 'roman_ur') {
      return `Aaj ${salonName} par aap ka visit kaisa raha? Meharbani farma kar 1–5 Stars reply karein.`;
    }
    if (lang === 'ur') {
      return `آج ${salonName} پر آپ کا وزٹ کیسا رہا؟ برائے مہربانی 1 سے 5 اسٹارز (1–5 Stars) میں جواب دیں۔`;
    }
    if (lang === 'ar') {
      return `كيف كانت زيارتك إلى ${salonName} اليوم؟ يرجى الرد بتقييم من 1 إلى 5 نجوم.`;
    }
    return `How was your visit to ${salonName} today? Reply 1–5 Stars.`;
  };

  const dormantClients = conciergeState.clients.filter((c) => {
    if (!c.lastCompletedVisitAt) return false;
    const daysSince = Math.floor((Date.now() - new Date(c.lastCompletedVisitAt).getTime()) / 86400000);
    return daysSince >= draft.winbackDays;
  });

  const activeDir = PREVIEW_LANG_TABS.find((t) => t.id === previewLang)?.dir ?? 'ltr';

  return (
    <div className="space-y-6 pb-28 min-w-0">
      {savedBanner && (
        <div className="rounded-xl border border-[#116329] bg-[#0D3822] px-4 py-3 text-xs font-mono text-[#3FB950] flex items-center gap-2">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{savedBanner}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODULE 1: REGION-AWARE LANGUAGE SELECTOR MENU                             */}
      {/* ========================================================================= */}
      <section className="rounded-2xl border border-[#30363D] bg-[#161B22] p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#30363D] pb-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Globe className="size-4 text-[#06B6D4] shrink-0" />
              <h3 className="text-base font-bold text-[#F0F6FC]">
                1. Region-Aware Language Selector Menu
              </h3>
            </div>
            <p className="text-xs text-[#8B949E] font-sans">
              Auto-detects your salon&apos;s region from registered WhatsApp number{' '}
              <span className="font-mono text-[#F0F6FC]">{draft.whatsappPhone}</span> and presents the regional language selector on initial &ldquo;Hi&rdquo; / greeting, locking <code className="font-mono text-[#06B6D4]">preferred_language</code>.
            </p>
          </div>
          <div className="rounded-xl border border-[#30363D] bg-[#0D1117] px-3.5 py-2 shrink-0">
            <span className="text-[10px] font-mono text-[#8B949E] uppercase block">Detected Region</span>
            <span className="text-xs font-mono font-bold text-[#06B6D4]">
              {conciergeState.regionLabel}
            </span>
          </div>
        </div>

        {/* Regional Option Matrix */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-4 space-y-3">
            <span className="text-[11px] font-mono font-bold uppercase text-[#8B949E] block">
              Active Regional Greeting Options ({conciergeState.region})
            </span>
            <div className="flex flex-wrap gap-2">
              {conciergeState.languageOptions.map((opt) => (
                <button
                  key={opt.index}
                  type="button"
                  disabled={isWebhookBusy}
                  onClick={() => handleSendGreetingWebhook(opt.index)}
                  dir={opt.dir}
                  className="min-h-[48px] rounded-xl border border-[#30363D] bg-[#161B22] hover:border-[#06B6D4] px-3.5 py-2 text-sm font-mono font-bold text-[#F0F6FC] transition"
                >
                  [{opt.label}]
                </button>
              ))}
            </div>
            <div className="rounded-xl border border-[#30363D] bg-[#161B22] p-3 text-xs font-mono text-[#F0F6FC] whitespace-pre-line leading-relaxed">
              {conciergeState.greetingPromptPreview}
            </div>
          </div>

          {/* Interactive Greeting & Lock Tester */}
          <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-4 space-y-3">
            <span className="text-[11px] font-mono font-bold uppercase text-[#D29922] block">
              Live Greeting Menu &amp; Lock Simulator
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input
                type="text"
                value={simClientName}
                onChange={(e) => setSimClientName(e.target.value)}
                placeholder="Client Name"
                className="min-h-[48px] rounded-xl border border-[#30363D] bg-[#161B22] px-3 text-sm text-[#F0F6FC] focus:border-[#06B6D4] focus:outline-none"
              />
              <input
                type="text"
                value={simClientPhone}
                onChange={(e) => setSimClientPhone(e.target.value)}
                placeholder="+92 301 5559012"
                className="min-h-[48px] rounded-xl border border-[#30363D] bg-[#161B22] px-3 text-sm font-mono text-[#F0F6FC] focus:border-[#06B6D4] focus:outline-none"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isWebhookBusy}
                onClick={() => handleSendGreetingWebhook('Hi', true)}
                className="min-h-[48px] flex-1 rounded-xl bg-[#06B6D4] hover:bg-[#22D3EE] text-[#0D1117] px-4 py-2 text-xs font-mono font-bold uppercase transition flex items-center justify-center gap-1.5"
              >
                <Send className="size-3.5" />
                <span>1. Send &ldquo;Hi&rdquo; Greeting</span>
              </button>
              {conciergeState.languageOptions.map((opt) => (
                <button
                  key={opt.index}
                  type="button"
                  disabled={isWebhookBusy}
                  onClick={() => handleSendGreetingWebhook(opt.index)}
                  className="min-h-[48px] rounded-xl border border-[#30363D] bg-[#161B22] hover:border-[#3FB950] px-3 py-2 text-xs font-mono font-bold text-[#3FB950] transition"
                >
                  Reply {opt.index}
                </button>
              ))}
            </div>
            {simWebhookReply && (
              <div
                dir={simWebhookReply.replyDir}
                className={`rounded-xl border border-[#116329] bg-[#0D3822] p-3 text-xs text-[#F0F6FC] space-y-1.5 ${
                  simWebhookReply.replyDir === 'rtl' ? 'text-right' : 'text-left'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-[#3FB950]" dir="ltr">
                  <span>ACTION: {simWebhookReply.routedAction}</span>
                  <span>
                    preferred_language: {simWebhookReply.lockedLanguage || 'PENDING'} (dir={simWebhookReply.replyDir})
                  </span>
                </div>
                <p className="whitespace-pre-line leading-relaxed">{simWebhookReply.replyText}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* MODULE 2: RETENTION & REWARDS (9:00 AM BIRTHDAY & SPECIAL EVENT OFFERS)   */}
      {/* ========================================================================= */}
      <section className="rounded-2xl border border-[#30363D] bg-[#161B22] p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#30363D] pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Cake className="size-4 text-[#D29922] shrink-0" />
              <h3 className="text-base font-bold text-[#F0F6FC]">
                2. Retention &amp; Rewards · 9:00 AM Birthday &amp; Event Offers
              </h3>
            </div>
            <p className="text-xs text-[#8B949E] font-sans">
              Dispatches automatically at 9:00 AM (salon local time) in each client&apos;s locked <code className="font-mono text-[#06B6D4]">preferred_language</code> when <code className="font-mono text-[#06B6D4]">birth_date</code> (Day/Month) matches.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setDraft({ ...draft, birthdayEnabled: !draft.birthdayEnabled })}
            className={`min-h-[48px] rounded-xl border px-4 py-2 text-xs font-mono font-bold uppercase transition shrink-0 ${
              draft.birthdayEnabled
                ? 'border-[#116329] bg-[#0D3822] text-[#3FB950]'
                : 'border-[#30363D] bg-[#0D1117] text-[#8B949E]'
            }`}
          >
            {draft.birthdayEnabled ? 'Birthday Auto-Offer: ON' : 'Birthday Auto-Offer: OFF'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="space-y-1.5 block">
            <span className="text-xs font-mono text-[#8B949E] block">Discount Percentage (%)</span>
            <input
              type="number"
              min={0}
              max={100}
              value={draft.birthdayDiscountPct}
              onChange={(e) => setDraft({ ...draft, birthdayDiscountPct: Math.max(0, Number(e.target.value) || 0) })}
              className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3.5 py-2 text-sm font-mono font-bold text-[#D29922] focus:border-[#06B6D4] focus:outline-none"
            />
          </label>

          <label className="space-y-1.5 block">
            <span className="text-xs font-mono text-[#8B949E] block">
              Fixed Discount ({draft.currency})
            </span>
            <input
              type="number"
              min={0}
              value={draft.birthdayFixedDiscount}
              onChange={(e) => setDraft({ ...draft, birthdayFixedDiscount: Math.max(0, Number(e.target.value) || 0) })}
              className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3.5 py-2 text-sm font-mono font-bold text-[#D29922] focus:border-[#06B6D4] focus:outline-none"
            />
          </label>

          <label className="space-y-1.5 block">
            <span className="text-xs font-mono text-[#8B949E] block">Complimentary Service Gift</span>
            <input
              type="text"
              value={draft.birthdayGiftService}
              onChange={(e) => setDraft({ ...draft, birthdayGiftService: e.target.value })}
              placeholder="e.g. Free Organic Hair Mask"
              className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3.5 py-2 text-sm text-[#F0F6FC] focus:border-[#06B6D4] focus:outline-none"
            />
          </label>
        </div>

        <label className="space-y-1.5 block">
          <span className="text-xs font-mono text-[#8B949E] block">
            Customizable Offer Message Text (Tokens: {'{client_name}'}, {'{salon_name}'}, {'{offer_summary}'})
          </span>
          <textarea
            rows={2}
            value={draft.birthdayMessageTemplate}
            onChange={(e) => setDraft({ ...draft, birthdayMessageTemplate: e.target.value })}
            className="w-full rounded-xl border border-[#30363D] bg-[#0D1117] px-3.5 py-2.5 text-sm text-[#F0F6FC] focus:border-[#06B6D4] focus:outline-none"
          />
        </label>

        {/* Live Language Preview */}
        <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3.5 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-mono font-bold text-[#8B949E] uppercase">
              9:00 AM Dispatch Live Preview
            </span>
            <div className="flex flex-wrap gap-1.5">
              {PREVIEW_LANG_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setPreviewLang(t.id)}
                  className={`min-h-[36px] rounded-lg border px-2.5 py-1 text-xs font-mono font-bold transition ${
                    previewLang === t.id
                      ? 'border-[#06B6D4] bg-[#06B6D4]/15 text-[#06B6D4]'
                      : 'border-[#30363D] bg-[#161B22] text-[#8B949E]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <p
            dir={activeDir}
            className={`rounded-xl border border-[#30363D] bg-[#161B22] p-3 text-sm text-[#F0F6FC] leading-relaxed ${
              activeDir === 'rtl' ? 'text-right' : 'text-left'
            }`}
          >
            {formatBirthdayPreview(previewLang)}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => handleTriggerCron('birthday_9am')}
            className="min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] hover:border-[#D29922] px-4 py-2 text-xs font-mono font-bold text-[#D29922] transition flex items-center gap-2"
          >
            <Play className="size-3.5" />
            <span>Test 9:00 AM Birthday Dispatch Now</span>
          </button>

          <button
            type="button"
            disabled={savingSection === 'BIRTHDAY'}
            onClick={() => handleSaveSettings('BIRTHDAY')}
            className="min-h-[48px] rounded-xl bg-[#06B6D4] hover:bg-[#22D3EE] text-[#0D1117] px-5 py-2 text-xs font-mono font-bold uppercase transition flex items-center gap-2"
          >
            {savingSection === 'BIRTHDAY' ? <RefreshCw className="size-4 animate-spin" /> : <Save className="size-4" />}
            <span>Save Settings</span>
          </button>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* MODULE 3: WIN-BACK RULES (30-DAY DORMANT CLIENT ENGINE)                   */}
      {/* ========================================================================= */}
      <section className="rounded-2xl border border-[#30363D] bg-[#161B22] p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#30363D] pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-[#06B6D4] shrink-0" />
              <h3 className="text-base font-bold text-[#F0F6FC]">
                3. Win-Back Rules · 30-Day Dormant Client Engine
              </h3>
            </div>
            <p className="text-xs text-[#8B949E] font-sans">
              Monitors <code className="font-mono text-[#06B6D4]">last_completed_visit_at</code> across clients with no upcoming booking and sends a 1-tap rebooking offer at {draft.winbackDays} days.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setDraft({ ...draft, winbackEnabled: !draft.winbackEnabled })}
            className={`min-h-[48px] rounded-xl border px-4 py-2 text-xs font-mono font-bold uppercase transition shrink-0 ${
              draft.winbackEnabled
                ? 'border-[#116329] bg-[#0D3822] text-[#3FB950]'
                : 'border-[#30363D] bg-[#0D1117] text-[#8B949E]'
            }`}
          >
            {draft.winbackEnabled ? '30-Day Win-Back: ON' : '30-Day Win-Back: OFF'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="space-y-1.5 block">
            <span className="text-xs font-mono text-[#8B949E] block">Inactivity Trigger (Days)</span>
            <input
              type="number"
              min={1}
              max={365}
              value={draft.winbackDays}
              onChange={(e) => setDraft({ ...draft, winbackDays: Math.max(1, Number(e.target.value) || 30) })}
              className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3.5 py-2 text-sm font-mono font-bold text-[#06B6D4] focus:border-[#06B6D4] focus:outline-none"
            />
          </label>

          <label className="space-y-1.5 block">
            <span className="text-xs font-mono text-[#8B949E] block">Win-Back Discount (%)</span>
            <input
              type="number"
              min={0}
              max={100}
              value={draft.winbackDiscountPct}
              onChange={(e) => setDraft({ ...draft, winbackDiscountPct: Math.max(0, Number(e.target.value) || 0) })}
              className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3.5 py-2 text-sm font-mono font-bold text-[#D29922] focus:border-[#06B6D4] focus:outline-none"
            />
          </label>

          <label className="space-y-1.5 block">
            <span className="text-xs font-mono text-[#8B949E] block">Complimentary Add-On Service</span>
            <input
              type="text"
              value={draft.winbackAddonService}
              onChange={(e) => setDraft({ ...draft, winbackAddonService: e.target.value })}
              placeholder="e.g. Free Express Hair Wash"
              className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3.5 py-2 text-sm text-[#F0F6FC] focus:border-[#06B6D4] focus:outline-none"
            />
          </label>
        </div>

        <label className="space-y-1.5 block">
          <span className="text-xs font-mono text-[#8B949E] block">
            Win-Back Message Template (Tokens: {'{client_name}'}, {'{salon_name}'}, {'{days}'}, {'{offer_summary}'})
          </span>
          <textarea
            rows={2}
            value={draft.winbackMessageTemplate}
            onChange={(e) => setDraft({ ...draft, winbackMessageTemplate: e.target.value })}
            className="w-full rounded-xl border border-[#30363D] bg-[#0D1117] px-3.5 py-2.5 text-sm text-[#F0F6FC] focus:border-[#06B6D4] focus:outline-none"
          />
        </label>

        <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3.5 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-mono font-bold text-[#8B949E] uppercase">
              Win-Back Live Preview ({previewLang.toUpperCase()} · {dormantClients.length} Dormant Client(s) Eligible)
            </span>
          </div>
          <p
            dir={activeDir}
            className={`rounded-xl border border-[#30363D] bg-[#161B22] p-3 text-sm text-[#F0F6FC] leading-relaxed ${
              activeDir === 'rtl' ? 'text-right' : 'text-left'
            }`}
          >
            {formatWinBackPreview(previewLang)}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleTriggerCron('winback_30d')}
              className="min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] hover:border-[#06B6D4] px-4 py-2 text-xs font-mono font-bold text-[#06B6D4] transition flex items-center gap-2"
            >
              <Play className="size-3.5" />
              <span>Run 30-Day Win-Back Scan</span>
            </button>
            <button
              type="button"
              disabled={dormantClients.length === 0 || isWebhookBusy}
              onClick={async () => {
                const target = dormantClients[0];
                if (!target) return;
                await fetch('/api/whatsapp/webhook', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    salonId,
                    fromPhone: target.phone,
                    clientName: target.name,
                    messageText: 'REBOOK',
                  }),
                }).then((r) => r.json()).then((d) => {
                  onStateUpdated(d.state);
                  onShowToast(`✓ 1-Tap REBOOK confirmed for ${target.name}!`);
                });
              }}
              className="min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] hover:border-[#3FB950] px-4 py-2 text-xs font-mono font-bold text-[#3FB950] transition disabled:opacity-40"
            >
              Test 1-Tap &ldquo;REBOOK&rdquo; Reply
            </button>
          </div>

          <button
            type="button"
            disabled={savingSection === 'WINBACK'}
            onClick={() => handleSaveSettings('WINBACK')}
            className="min-h-[48px] rounded-xl bg-[#06B6D4] hover:bg-[#22D3EE] text-[#0D1117] px-5 py-2 text-xs font-mono font-bold uppercase transition flex items-center gap-2"
          >
            {savingSection === 'WINBACK' ? <RefreshCw className="size-4 animate-spin" /> : <Save className="size-4" />}
            <span>Save Settings</span>
          </button>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* MODULE 4: POST-SERVICE GOOGLE REVIEW & SMART REPUTATION ROUTER (T+2H)     */}
      {/* ========================================================================= */}
      <section className="rounded-2xl border border-[#30363D] bg-[#161B22] p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#30363D] pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Star className="size-4 text-[#D29922] shrink-0" />
              <h3 className="text-base font-bold text-[#F0F6FC]">
                4. Post-Service Google Review &amp; Rating Booster (T+2 Hours)
              </h3>
            </div>
            <p className="text-xs text-[#8B949E] font-sans">
              Dispatches 2 hours after an appointment reaches <code className="font-mono text-[#3FB950]">COMPLETED</code>. Routes 4–5★ to Google Maps and intercepts 1–3★ privately with an <code className="font-mono text-[#F85149]">OWNER_INTERVENTION_NEEDED</code> alert.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setDraft({ ...draft, reviewBoosterEnabled: !draft.reviewBoosterEnabled })}
            className={`min-h-[48px] rounded-xl border px-4 py-2 text-xs font-mono font-bold uppercase transition shrink-0 ${
              draft.reviewBoosterEnabled
                ? 'border-[#116329] bg-[#0D3822] text-[#3FB950]'
                : 'border-[#30363D] bg-[#0D1117] text-[#8B949E]'
            }`}
          >
            {draft.reviewBoosterEnabled ? 'T+2h Booster: ON' : 'T+2h Booster: OFF'}
          </button>
        </div>

        <label className="space-y-1.5 block">
          <span className="text-xs font-mono text-[#8B949E] flex items-center gap-1.5">
            <Link2 className="size-3.5 text-[#06B6D4]" />
            <span>Direct Google Review URL (google_review_url)</span>
          </span>
          <input
            type="url"
            value={draft.googleReviewUrl}
            onChange={(e) => setDraft({ ...draft, googleReviewUrl: e.target.value })}
            placeholder="https://g.page/r/your-salon/review"
            className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3.5 py-2 text-sm font-mono text-[#06B6D4] break-all focus:border-[#06B6D4] focus:outline-none"
          />
          <span className="text-[11px] font-mono text-[#8B949E] break-all block">
            Active Public Link (4–5★ only): {draft.googleReviewUrl}
          </span>
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3.5 space-y-2">
            <span className="text-[11px] font-mono font-bold text-[#8B949E] uppercase block">
              T+2 Hours Feedback Prompt ({previewLang.toUpperCase()})
            </span>
            <p
              dir={activeDir}
              className={`rounded-xl border border-[#30363D] bg-[#161B22] p-3 text-sm text-[#F0F6FC] ${
                activeDir === 'rtl' ? 'text-right' : 'text-left'
              }`}
            >
              {formatReviewPromptPreview(previewLang)}
            </p>
          </div>

          <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3.5 space-y-2.5">
            <span className="text-[11px] font-mono font-bold text-[#D29922] uppercase block">
              Test Smart Reputation Routing (Simulate Client Reply)
            </span>
            <div className="grid grid-cols-5 gap-1.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  disabled={isWebhookBusy}
                  onClick={() => handleSimulateStarFeedback(star)}
                  className={`min-h-[48px] rounded-xl border font-mono text-xs font-bold transition ${
                    star <= 3
                      ? 'border-[#da3633] bg-[#4C1C1D] text-[#F85149] hover:bg-[#5e2223]'
                      : 'border-[#116329] bg-[#0D3822] text-[#3FB950] hover:bg-[#114a2d]'
                  }`}
                >
                  {star}★
                </button>
              ))}
            </div>
            {ratingSimOutcome && (
              <div
                dir={ratingSimOutcome.replyDir}
                className={`rounded-xl border p-3 text-xs space-y-1 ${
                  ratingSimOutcome.rating <= 3
                    ? 'border-[#da3633] bg-[#4C1C1D] text-[#F0F6FC]'
                    : 'border-[#116329] bg-[#0D3822] text-[#F0F6FC]'
                } ${ratingSimOutcome.replyDir === 'rtl' ? 'text-right' : 'text-left'}`}
              >
                <span className="text-[10px] font-mono font-bold uppercase block" dir="ltr">
                  {ratingSimOutcome.rating <= 3
                    ? 'GOOGLE LINK SUPPRESSED · OWNER_INTERVENTION_NEEDED ALERT SENT'
                    : '4–5★ POSITIVE · PUBLIC GOOGLE LINK SENT'}
                </span>
                <p className="break-all leading-relaxed">{ratingSimOutcome.replyText}</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => handleTriggerCron('review_t2h')}
            className="min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] hover:border-[#D29922] px-4 py-2 text-xs font-mono font-bold text-[#D29922] transition flex items-center gap-2"
          >
            <Play className="size-3.5" />
            <span>Dispatch T+2h Prompts Now</span>
          </button>

          <button
            type="button"
            disabled={savingSection === 'REVIEW'}
            onClick={() => handleSaveSettings('REVIEW')}
            className="min-h-[48px] rounded-xl bg-[#06B6D4] hover:bg-[#22D3EE] text-[#0D1117] px-5 py-2 text-xs font-mono font-bold uppercase transition flex items-center gap-2"
          >
            {savingSection === 'REVIEW' ? <RefreshCw className="size-4 animate-spin" /> : <Save className="size-4" />}
            <span>Save Settings</span>
          </button>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* CLIENT PROFILES: OPTIONAL BIRTH_DATE (DD/MM) & LAST VISIT TRACKER         */}
      {/* ========================================================================= */}
      <section className="rounded-2xl border border-[#30363D] bg-[#161B22] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#30363D] pb-3">
          <div className="flex items-center gap-2">
            <UserPlus className="size-4 text-[#06B6D4]" />
            <h3 className="text-base font-bold text-[#F0F6FC]">
              Client Retention Profiles (Birth Date &amp; Last Completed Visit)
            </h3>
          </div>
          <span className="text-xs font-mono text-[#8B949E]">
            {conciergeState.clients.length} Tracked Profiles
          </span>
        </div>

        <form onSubmit={handleSaveClientBirthDate} className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
          <input
            type="text"
            value={newBirthClientName}
            onChange={(e) => setNewBirthClientName(e.target.value)}
            placeholder="Client Name"
            className="min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3 text-sm text-[#F0F6FC] focus:border-[#06B6D4] focus:outline-none"
          />
          <input
            type="text"
            required
            value={newBirthClientPhone}
            onChange={(e) => setNewBirthClientPhone(e.target.value)}
            placeholder="WhatsApp (+92...)"
            className="min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3 text-sm font-mono text-[#F0F6FC] focus:border-[#06B6D4] focus:outline-none"
          />
          <input
            type="text"
            value={newBirthDayMonth}
            onChange={(e) => setNewBirthDayMonth(e.target.value)}
            placeholder="Birth Date (DD/MM)"
            className="min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3 text-sm font-mono text-[#D29922] focus:border-[#06B6D4] focus:outline-none"
          />
          <select
            value={newBirthLang}
            onChange={(e) => setNewBirthLang(e.target.value as ClientPreferredLang)}
            className="min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3 text-sm font-mono text-[#F0F6FC] focus:border-[#06B6D4] focus:outline-none"
          >
            <option value="en">English</option>
            <option value="roman_ur">Roman Urdu</option>
            <option value="ur">اردو (Urdu)</option>
            <option value="ar">العربية (Arabic)</option>
          </select>
          <button
            type="submit"
            className="min-h-[48px] rounded-xl bg-[#06B6D4] hover:bg-[#22D3EE] text-[#0D1117] px-4 text-xs font-mono font-bold uppercase transition"
          >
            Save Client Profile
          </button>
        </form>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {conciergeState.clients.map((cli) => {
            const lastVisitLabel = cli.lastCompletedVisitAt
              ? `${Math.floor((Date.now() - new Date(cli.lastCompletedVisitAt).getTime()) / 86400000)}d ago (${new Date(cli.lastCompletedVisitAt).toLocaleDateString()})`
              : 'No completed visit yet';
            return (
              <div
                key={cli.id}
                className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3.5 space-y-1 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-[#F0F6FC]">{cli.name}</span>
                  <span className="rounded-md border border-[#30363D] bg-[#161B22] px-2 py-0.5 font-mono text-[10px] text-[#06B6D4]">
                    {cli.preferredLanguage ? `LANG: ${cli.preferredLanguage.toUpperCase()}` : 'AWAITING LANG'}
                  </span>
                </div>
                <p className="font-mono text-[11px] text-[#8B949E]">{cli.phone}</p>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] font-mono">
                  <span className="text-[#D29922]">
                    Birth Date (DD/MM): {cli.birthDate || 'Not set'}
                  </span>
                  <span className="text-[#3FB950]">Last Visit: {lastVisitLabel}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Recent Concierge Dispatch Log */}
        {conciergeState.logs.length > 0 && (
          <div className="pt-2 space-y-2">
            <span className="text-[11px] font-mono font-bold uppercase text-[#8B949E] flex items-center gap-1.5">
              <MessageSquare className="size-3.5 text-[#06B6D4]" />
              <span>Recent Automated WhatsApp Webhook &amp; Cron Dispatches</span>
            </span>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {conciergeState.logs.slice(0, 8).map((log) => (
                <div
                  key={log.id}
                  className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3 space-y-1 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-[#8B949E]">
                    <span>
                      [{log.module}] {log.direction} · {log.clientName} ({log.clientPhone})
                    </span>
                    <span>
                      {log.language.toUpperCase()} · {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p
                    dir={log.dir}
                    className={`text-[#F0F6FC] leading-relaxed break-words [overflow-wrap:break-word] ${
                      log.dir === 'rtl' ? 'text-right' : 'text-left'
                    }`}
                  >
                    {log.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
