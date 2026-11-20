import React, { useEffect, useState } from 'react';
import {
  Calendar,
  Clock,
  ExternalLink,
  Film,
  MapPin,
  MessageSquare,
  RotateCcw,
  Scissors,
  Send,
  ShieldAlert,
  Tag,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';
import type {
  ClientPreferredLang,
  CustomerActionMessageResponse,
  CustomerExperienceConfig,
  CustomerMenuActionId,
} from '../types/concierge';
import { CustomerBookingFlow } from './CustomerBookingFlow';
import { PublicSalonDealPage } from './PublicSalonDealPage';

interface CustomerWhatsAppDemoModalProps {
  salonId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface ChatBubbleItem {
  id: string;
  from: 'CUSTOMER' | 'SALON';
  text: string;
  dir: 'ltr' | 'rtl';
  lang: ClientPreferredLang;
  welcome?: CustomerActionMessageResponse['welcome'];
  services?: CustomerActionMessageResponse['services'];
  hours?: CustomerActionMessageResponse['hours'];
  address?: string;
  googleMapsUrl?: string;
  deals?: CustomerActionMessageResponse['deals'];
}

export const CustomerWhatsAppDemoModal: React.FC<CustomerWhatsAppDemoModalProps> = ({
  salonId,
  isOpen,
  onClose,
}) => {
  const [config, setConfig] = useState<CustomerExperienceConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeLang, setActiveLang] = useState<ClientPreferredLang>('en');
  const [customerMode, setCustomerMode] = useState<'NEW' | 'SAVED'>('NEW');
  const [simulateBusyBarber, setSimulateBusyBarber] = useState<string>('');
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<ChatBubbleItem[]>([]);
  const [activeSheet, setActiveSheet] = useState<
    | null
    | { kind: 'FLOW'; dealId?: string | null }
    | { kind: 'DEAL'; dealId: string }
  >(null);

  const loadConfigAndStartHi = async (langOverride?: ClientPreferredLang) => {
    setLoading(true);
    setActiveSheet(null);
    const chosenLang = langOverride || activeLang || 'en';
    try {
      const cfgRes = await fetch(
        `/api/public/salons/${encodeURIComponent(salonId)}/customer-experience?lang=${encodeURIComponent(chosenLang)}`
      );
      if (cfgRes.ok) {
        const cfgData = (await cfgRes.json()) as CustomerExperienceConfig;
        setConfig(cfgData);
      }

      const hiRes = await fetch(
        `/api/public/salons/${encodeURIComponent(salonId)}/customer-message`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            actionId: 'WELCOME',
            messageText: 'Hi',
            preferredLang: chosenLang,
            isDemo: true,
          }),
        }
      );
      if (hiRes.ok) {
        const welcomeData = (await hiRes.json()) as CustomerActionMessageResponse;
        setMessages([
          {
            id: `c-hi-${Date.now()}`,
            from: 'CUSTOMER',
            text: 'Hi',
            dir: 'ltr',
            lang: chosenLang,
          },
          {
            id: `s-welcome-${Date.now()}`,
            from: 'SALON',
            text: welcomeData.text,
            dir: welcomeData.dir,
            lang: welcomeData.language,
            welcome: welcomeData.welcome,
          },
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setActiveLang('en');
    void loadConfigAndStartHi('en');
  }, [isOpen, salonId]);

  if (!isOpen) return null;

  const triggerOption = async (
    actionId: CustomerMenuActionId,
    labelText: string,
    langOverride?: ClientPreferredLang
  ) => {
    const useLang = langOverride || activeLang;
    if (actionId === 'BOOK_APPOINTMENT') {
      setMessages((prev) => [
        ...prev,
        {
          id: `c-act-${Date.now()}`,
          from: 'CUSTOMER',
          text: labelText,
          dir: useLang === 'ur' || useLang === 'ar' ? 'rtl' : 'ltr',
          lang: useLang,
        },
      ]);
      setActiveSheet({ kind: 'FLOW', dealId: null });
      return;
    }

    const res = await fetch(
      `/api/public/salons/${encodeURIComponent(salonId)}/customer-message`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionId,
          preferredLang: useLang,
          isDemo: true,
        }),
      }
    );
    if (!res.ok) return;
    const data = (await res.json()) as CustomerActionMessageResponse;
    setMessages((prev) => [
      ...prev,
      {
        id: `c-act-${Date.now()}`,
        from: 'CUSTOMER',
        text: labelText,
        dir: useLang === 'ur' || useLang === 'ar' ? 'rtl' : 'ltr',
        lang: useLang,
      },
      {
        id: `s-act-${Date.now() + 1}`,
        from: 'SALON',
        text: data.text,
        dir: data.dir,
        lang: data.language,
        services: data.services,
        hours: data.hours,
        address: data.address,
        googleMapsUrl: data.googleMapsUrl,
        deals: data.deals,
      },
    ]);
  };

  const handleLanguageChange = async (nextLang: ClientPreferredLang) => {
    setActiveLang(nextLang);
    const res = await fetch(
      `/api/public/salons/${encodeURIComponent(salonId)}/customer-message`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionId: 'WELCOME',
          preferredLang: nextLang,
          isDemo: true,
        }),
      }
    );
    if (!res.ok) return;
    const data = (await res.json()) as CustomerActionMessageResponse;
    setMessages((prev) =>
      prev.map((m, idx) =>
        idx === 1 && m.from === 'SALON'
          ? {
              ...m,
              text: data.text,
              dir: data.dir,
              lang: data.language,
              welcome: data.welcome,
            }
          : m
      )
    );
  };

  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text) return;
    setChatInput('');
    const res = await fetch(
      `/api/public/salons/${encodeURIComponent(salonId)}/customer-message`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageText: text,
          preferredLang: activeLang,
          isDemo: true,
        }),
      }
    );
    if (!res.ok) return;
    const data = (await res.json()) as CustomerActionMessageResponse;
    setMessages((prev) => [
      ...prev,
      { id: `c-txt-${Date.now()}`, from: 'CUSTOMER', text, dir: 'ltr', lang: activeLang },
      {
        id: `s-txt-${Date.now() + 1}`,
        from: 'SALON',
        text: data.text,
        dir: data.dir,
        lang: data.language,
        welcome: data.welcome,
        services: data.services,
        hours: data.hours,
        address: data.address,
        googleMapsUrl: data.googleMapsUrl,
        deals: data.deals,
      },
    ]);
    if (data.openBookingFlow) {
      setActiveSheet({ kind: 'FLOW', dealId: null });
    }
  };

  return (
    <div
      className="fixed inset-0 z-[99] bg-[#0D1117]/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl rounded-3xl border border-[#30363D] bg-[#161B22] shadow-2xl overflow-hidden flex flex-col max-h-[94vh]"
      >
        {/* Top Bar */}
        <header className="px-4 sm:px-6 py-3.5 border-b border-[#30363D] bg-[#0D1117] flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <MessageSquare className="size-4 text-[#25D366]" />
              <h2 className="text-sm sm:text-base font-black text-[#F0F6FC]">
                Customer WhatsApp Experience — Live Demo
              </h2>
            </div>
            <p className="text-[11px] font-mono text-[#D29922] flex items-center gap-1.5">
              <ShieldAlert className="size-3.5 shrink-0" />
              <span>
                DEMO SANDBOX · Uses your real salon setup, never modifies real appointments or sends real WhatsApp messages.
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Live Demo"
            className="min-h-[40px] min-w-[40px] rounded-xl border border-[#30363D] bg-[#161B22] grid place-items-center text-[#8B949E] hover:text-[#F0F6FC]"
          >
            <X className="size-4" />
          </button>
        </header>

        {/* Body Split: Owner Test Controls + Mobile WhatsApp Frame */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 p-4 sm:p-5">
          {/* Left: Demo Scenario Controls */}
          <aside className="space-y-4">
            <div className="rounded-2xl border border-[#30363D] bg-[#0D1117] p-4 space-y-3">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#06B6D4]">
                Demo Scenario Controls
              </h3>

              {/* New vs Saved Customer Toggle */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-mono text-[#8B949E] block">
                  Customer Profile Test Mode
                </span>
                <div className="grid grid-cols-1 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCustomerMode('NEW')}
                    className={`min-h-[42px] rounded-xl border px-3 py-2 text-xs font-semibold flex items-center gap-2 transition ${
                      customerMode === 'NEW'
                        ? 'border-[#25D366] bg-[#0B2E1E] text-[#F0F6FC]'
                        : 'border-[#30363D] bg-[#161B22] text-[#8B949E]'
                    }`}
                  >
                    <UserPlus className="size-4 text-[#25D366] shrink-0" />
                    <span>New Customer (Name Required)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomerMode('SAVED')}
                    className={`min-h-[42px] rounded-xl border px-3 py-2 text-xs font-semibold flex items-center gap-2 transition ${
                      customerMode === 'SAVED'
                        ? 'border-[#25D366] bg-[#0B2E1E] text-[#F0F6FC]'
                        : 'border-[#30363D] bg-[#161B22] text-[#8B949E]'
                    }`}
                  >
                    <UserCheck className="size-4 text-[#06B6D4] shrink-0" />
                    <span>Saved Customer (Name Skipped)</span>
                  </button>
                </div>
              </div>

              {/* Busy / Unavailable Barber Simulation */}
              <div className="space-y-1.5 pt-1 border-t border-[#21262D]">
                <label className="block space-y-1">
                  <span className="text-[11px] font-mono text-[#8B949E] block">
                    Simulate Busy / Unavailable Barber
                  </span>
                  <select
                    value={simulateBusyBarber}
                    onChange={(e) => setSimulateBusyBarber(e.target.value)}
                    className="w-full min-h-[42px] rounded-xl border border-[#30363D] bg-[#161B22] px-3 text-xs text-[#F0F6FC] focus:outline-none focus:border-[#D29922]"
                  >
                    <option value="">None (Use real salon locks only)</option>
                    {(config?.barbers || []).map((b) => (
                      <option key={b} value={b}>
                        Mark &ldquo;{b}&rdquo; Busy in Demo
                      </option>
                    ))}
                  </select>
                </label>
                <p className="text-[11px] text-[#8B949E] leading-snug">
                  When selected, that barber appears disabled inside the Flow with a live busy reason.
                </p>
              </div>

              {/* Quick Reset / Direct Flow Launch */}
              <div className="pt-1 border-t border-[#21262D] space-y-2">
                <button
                  type="button"
                  onClick={() => void loadConfigAndStartHi('en')}
                  className="w-full min-h-[42px] rounded-xl border border-[#30363D] bg-[#161B22] hover:border-[#06B6D4] text-xs font-mono font-bold text-[#06B6D4] flex items-center justify-center gap-2 transition"
                >
                  <RotateCcw className="size-3.5" />
                  <span>Reset &amp; Send &ldquo;Hi&rdquo;</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSheet({ kind: 'FLOW', dealId: null })}
                  className="w-full min-h-[42px] rounded-xl bg-[#25D366] hover:bg-[#20BD5A] text-[#0B141A] text-xs font-bold flex items-center justify-center gap-2 transition"
                >
                  <Calendar className="size-3.5" />
                  <span>Open Booking Flow Directly</span>
                </button>
              </div>
            </div>
          </aside>

          {/* Right: Mobile WhatsApp Thread + Embedded Flow / Deal Overlay */}
          <div className="flex justify-center">
            <div className="w-full max-w-md h-[640px] rounded-3xl border-2 border-[#2A3942] bg-[#0B141A] flex flex-col overflow-hidden relative shadow-2xl">
              {/* Phone WhatsApp Top Bar */}
              <div className="bg-[#202C33] border-b border-[#2A3942] px-4 py-3 flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="size-9 rounded-full bg-[#25D366] text-[#0B141A] font-black text-xs grid place-items-center shrink-0">
                    {(config?.salonName || 'S').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#E9EDEF] truncate">
                      {config?.salonName || 'Salon WhatsApp'}
                    </p>
                    <p className="text-[10px] font-mono text-[#25D366]">
                      Official Demo · {activeLang.toUpperCase()}
                    </p>
                  </div>
                </div>
                <span className="rounded-md bg-[#111B21] border border-[#2A3942] px-2 py-0.5 text-[10px] font-mono text-[#FBBF24]">
                  DEMO
                </span>
              </div>

              {/* Chat Thread */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-[#0B141A]">
                {loading && messages.length === 0 ? (
                  <div className="text-center text-xs font-mono text-[#8696A0] py-8">
                    Loading WhatsApp preview...
                  </div>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex ${m.from === 'CUSTOMER' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        dir={m.dir}
                        className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-xs space-y-2.5 shadow ${
                          m.from === 'CUSTOMER'
                            ? 'bg-[#005C4B] text-[#E9EDEF] rounded-br-sm'
                            : 'bg-[#202C33] text-[#E9EDEF] rounded-bl-sm border border-[#2A3942]'
                        }`}
                      >
                        <p className="whitespace-pre-line leading-relaxed">{m.text}</p>

                        {/* Single Welcome Message Language Selector + 4 Interactive Options */}
                        {m.welcome && (
                          <div className="space-y-2 pt-1 border-t border-[#2A3942]">
                            <div className="flex flex-wrap gap-1.5" dir="ltr">
                              {m.welcome.availableLanguages.map((langOpt) => (
                                <button
                                  key={langOpt.lang}
                                  type="button"
                                  onClick={() => void handleLanguageChange(langOpt.lang)}
                                  className={`min-h-[30px] rounded-lg border px-2 py-1 text-[11px] font-semibold transition ${
                                    activeLang === langOpt.lang
                                      ? 'border-[#25D366] bg-[#0B2E1E] text-[#25D366]'
                                      : 'border-[#2A3942] bg-[#111B21] text-[#D1D7DB] hover:border-[#8696A0]'
                                  }`}
                                >
                                  {langOpt.nativeLabel}
                                </button>
                              ))}
                            </div>

                            <div className="grid grid-cols-1 gap-1.5">
                              {m.welcome.options.map((opt) => (
                                <button
                                  key={opt.id}
                                  type="button"
                                  onClick={() => void triggerOption(opt.id, opt.label)}
                                  className="min-h-[40px] w-full rounded-xl border border-[#2A3942] bg-[#111B21] hover:border-[#25D366] hover:bg-[#0B2E1E]/50 px-3 text-xs font-semibold text-[#53BDEB] flex items-center justify-between gap-2 transition"
                                >
                                  <span>{opt.label}</span>
                                  {opt.id === 'BOOK_APPOINTMENT' ? (
                                    <Calendar className="size-3.5 text-[#25D366] shrink-0" />
                                  ) : opt.id === 'SERVICES_PRICES' ? (
                                    <Scissors className="size-3.5 text-[#8696A0] shrink-0" />
                                  ) : opt.id === 'HOURS_LOCATION' ? (
                                    <Clock className="size-3.5 text-[#8696A0] shrink-0" />
                                  ) : (
                                    <Tag className="size-3.5 text-[#FBBF24] shrink-0" />
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Google Maps quick button for Hours & Location */}
                        {m.googleMapsUrl && (
                          <a
                            href={m.googleMapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="min-h-[38px] rounded-xl border border-[#2A3942] bg-[#111B21] px-3 text-[11px] font-semibold text-[#53BDEB] flex items-center justify-center gap-1.5"
                          >
                            <MapPin className="size-3.5 text-[#25D366]" />
                            <span>Open Google Maps</span>
                            <ExternalLink className="size-3" />
                          </a>
                        )}

                        {/* Active Deals Interactive Video Page Buttons */}
                        {m.deals && m.deals.length > 0 && (
                          <div className="space-y-1.5 pt-1 border-t border-[#2A3942]">
                            {m.deals.map((deal) => (
                              <div
                                key={deal.id}
                                className="rounded-xl border border-[#2A3942] bg-[#111B21] p-2.5 space-y-1.5"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-bold text-[#E9EDEF]">{deal.title}</span>
                                </div>
                                <div className="flex gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setActiveSheet({ kind: 'DEAL', dealId: deal.id })}
                                    className="flex-1 min-h-[36px] rounded-lg border border-[#2A3942] bg-[#202C33] hover:border-[#53BDEB] px-2.5 text-[11px] font-semibold text-[#53BDEB] flex items-center justify-center gap-1.5"
                                  >
                                    <Film className="size-3.5" />
                                    <span>View Offer &amp; Video</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setActiveSheet({ kind: 'FLOW', dealId: deal.id })}
                                    className="min-h-[36px] rounded-lg bg-[#25D366] text-[#0B141A] px-2.5 text-[11px] font-bold"
                                  >
                                    Book Deal
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Composer Bar */}
              <form
                onSubmit={handleSendText}
                className="bg-[#202C33] border-t border-[#2A3942] p-2.5 flex items-center gap-2 shrink-0"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder='Type "Hi", "Services", "Hours", or "Deals"...'
                  className="flex-1 min-h-[42px] rounded-full border border-[#2A3942] bg-[#111B21] px-4 text-xs text-[#E9EDEF] placeholder:text-[#8696A0] focus:outline-none focus:border-[#25D366]"
                />
                <button
                  type="submit"
                  aria-label="Send message"
                  className="size-10 rounded-full bg-[#25D366] hover:bg-[#20BD5A] text-[#0B141A] grid place-items-center shrink-0"
                >
                  <Send className="size-4" />
                </button>
              </form>

              {/* Embedded Continuous Flow or Deal Video Sheet Overlay inside Phone */}
              {activeSheet?.kind === 'FLOW' && (
                <div className="absolute inset-0 z-30 bg-[#0B141A]">
                  <CustomerBookingFlow
                    salonId={salonId}
                    initialDealId={activeSheet.dealId}
                    initialLang={activeLang}
                    initialClientPhone={
                      customerMode === 'NEW' ? '+92 300 0009999' : '+92 300 1234567'
                    }
                    isDemo={true}
                    demoForceNewCustomer={customerMode === 'NEW'}
                    demoSavedCustomerName={
                      config?.customerProfile.savedName || 'Bilal Ahmed'
                    }
                    demoBusyBarber={simulateBusyBarber || undefined}
                    onClose={() => setActiveSheet(null)}
                  />
                </div>
              )}

              {activeSheet?.kind === 'DEAL' && (
                <div className="absolute inset-0 z-30 bg-[#0B141A] overflow-y-auto">
                  <PublicSalonDealPage
                    salonId={salonId}
                    dealId={activeSheet.dealId}
                    initialLang={activeLang}
                    isDemo={true}
                    onBookDealInDemo={(dealId) => setActiveSheet({ kind: 'FLOW', dealId })}
                    onClose={() => setActiveSheet(null)}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
