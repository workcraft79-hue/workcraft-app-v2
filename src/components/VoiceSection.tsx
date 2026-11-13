import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  Volume2,
  CheckCircle2,
  Play,
  Pause,
  Sparkles,
  Send,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { PortalCard } from './PortalCard';
import { VoiceRecorder } from './VoiceRecorder';

interface VoiceSectionProps {
  onClose?: () => void;
}

type VoiceDialect =
  | 'Roman Urdu (Lahori)'
  | 'Standard Urdu'
  | 'Lahori Punjabi'
  | 'Gulf Arabic'
  | 'English';

interface VoiceThreadItem {
  id: string;
  recipientLabel: string;
  salonOwnerLabel: string;
  city: string;
  duration: string;
  receivedAgo: string;
  dialect: VoiceDialect;
  speechLangCode: string;
  transcript: string;
  speechPlayText: string;
  defaultReplySuggestion: string;
  unread: boolean;
}

const INITIAL_VOICE_THREADS: VoiceThreadItem[] = [
  {
    id: 'wc-101',
    recipientLabel: '[WC-101] Hamza · Seven Cuts Salon (Lahore)',
    salonOwnerLabel: '[WC-101] Hamza · Seven Cuts Salon',
    city: 'Lahore DHA',
    duration: '0:24',
    receivedAgo: '18m ago',
    dialect: 'Roman Urdu (Lahori)',
    speechLangCode: 'hi-IN',
    transcript:
      '“Salam Farhan bhai, humara weekend video deal upload kiya tha 58 second ka, check kar lein approved hai ke nahi taake blast schedule ho sake.”',
    speechPlayText:
      'Salam Farhan bhai, humara weekend video deal upload kiya tha 58 second ka, check kar lein approved hai ke nahi taake blast schedule ho sake.',
    defaultReplySuggestion:
      'Your video deal is verified, exactly 58 seconds, and approved. It will be scheduled for tomorrow morning broadcast.',
    unread: true,
  },
  {
    id: 'wc-102',
    recipientLabel: '[WC-102] Ayesha · Noor Beauty Lounge (Karachi)',
    salonOwnerLabel: '[WC-102] Ayesha · Noor Beauty Lounge',
    city: 'Karachi Clifton',
    duration: '0:19',
    receivedAgo: '42m ago',
    dialect: 'Standard Urdu',
    speechLangCode: 'ur-PK',
    transcript:
      '“فرائیڈے برائیڈل ڈسکاؤنٹ پیکیج ریٹ سسٹم میں اپڈیٹ ہو گیا ہے؟ کسٹمر پوچھ رہے ہیں۔”',
    speechPlayText:
      'فرائیڈے برائیڈل ڈسکاؤنٹ پیکیج ریٹ سسٹم میں اپڈیٹ ہو گیا ہے؟ کسٹمر پوچھ رہے ہیں۔',
    defaultReplySuggestion:
      'Yes, your Friday bridal discount package rates are updated and active in the system.',
    unread: true,
  },
  {
    id: 'wc-103',
    recipientLabel: '[WC-103] Bilal · The Groom Room (Islamabad)',
    salonOwnerLabel: '[WC-103] Bilal · The Groom Room',
    city: 'Islamabad F-7',
    duration: '0:21',
    receivedAgo: '1h ago',
    dialect: 'Lahori Punjabi',
    speechLangCode: 'hi-IN',
    transcript:
      '“Assalamu Alaikum sir, sade 2 barbers de slot timings update karanay si Friday layi, system vich save ho jange?”',
    speechPlayText:
      'Assalamu Alaikum sir, sade do barbers de slot timings update karanay si Friday layi, system vich save ho jange?',
    defaultReplySuggestion:
      'Yes Bilal, you can update both barbers directly in your live dashboard roster and slots save automatically.',
    unread: false,
  },
  {
    id: 'wc-104',
    recipientLabel: '[WC-104] Tareq · Elite Grooming (Dubai / MENA)',
    salonOwnerLabel: '[WC-104] Tareq · Elite Grooming',
    city: 'Dubai Marina, UAE',
    duration: '0:27',
    receivedAgo: '2h ago',
    dialect: 'Gulf Arabic',
    speechLangCode: 'ar-SA',
    transcript:
      '“مرحباً، هل تم تفعيل عرض نهاية الأسبوع لباقة VIP في الرد التلقائي على واتساب؟”',
    speechPlayText:
      'مرحباً، هل تم تفعيل عرض نهاية الأسبوع لباقة VIP في الرد التلقائي على واتساب؟',
    defaultReplySuggestion:
      'Hello Tareq, your weekend VIP deal is verified and live in WhatsApp auto-replies now.',
    unread: false,
  },
];

export const VoiceSection: React.FC<VoiceSectionProps> = ({ onClose }) => {
  const [threads, setThreads] = useState<VoiceThreadItem[]>(INITIAL_VOICE_THREADS);
  const [selectedThreadId, setSelectedThreadId] = useState<string>('wc-101');
  const [uploadedUrl, setUploadedUrl] = useState<string>('');
  const [replySent, setReplySent] = useState(false);

  const activeThread =
    threads.find((t) => t.id === selectedThreadId) || threads[0];

  const [founderInputText, setFounderInputText] = useState<string>(
    INITIAL_VOICE_THREADS[0].defaultReplySuggestion
  );
  const [detectedFounderLang, setDetectedFounderLang] = useState<string>('English');
  const [isAutoDetecting, setIsAutoDetecting] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [autoTranslatedOutput, setAutoTranslatedOutput] = useState<string>(
    'Aap ka video deal check ho gaya hai, bilkul 58 seconds ka hai aur approve kar diya hai. Kal subah broadcast schedule ho jayega.'
  );

  // Audio playback state
  const [playingThreadId, setPlayingThreadId] = useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [isDictating, setIsDictating] = useState(false);
  const [dictationNotice, setDictationNotice] = useState<string | null>(null);

  // Dispatched voice replies log
  const [dispatchedHistory, setDispatchedHistory] = useState<
    Array<{
      id: string;
      threadLabel: string;
      targetDialect: VoiceDialect;
      originalText: string;
      convertedText: string;
      audioAttachment?: string;
      time: string;
    }>
  >([]);

  const translateTimerRef = useRef<number | null>(null);
  const replyTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const isAutoOutputRtl =
    activeThread.dialect === 'Standard Urdu' || activeThread.dialect === 'Gulf Arabic';

  // Run dynamic server translation whenever founderInputText or target dialect changes
  useEffect(() => {
    const clean = founderInputText.trim();
    if (!clean) {
      setAutoTranslatedOutput('');
      return;
    }

    if (translateTimerRef.current) {
      window.clearTimeout(translateTimerRef.current);
    }

    translateTimerRef.current = window.setTimeout(async () => {
      setIsTranslating(true);
      try {
        const res = await fetch('/api/translate-voice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: clean,
            targetDialect: activeThread.dialect,
          }),
        });
        if (res.ok) {
          const data = (await res.json()) as {
            translatedText?: string;
            detectedInputLanguage?: string;
          };
          if (data.translatedText) {
            setAutoTranslatedOutput(data.translatedText);
          }
          if (data.detectedInputLanguage) {
            setDetectedFounderLang(data.detectedInputLanguage);
          }
        }
      } catch {
        // Keep last valid translated text if network request fails
      } finally {
        setIsTranslating(false);
      }
    }, 350);

    return () => {
      if (translateTimerRef.current) {
        window.clearTimeout(translateTimerRef.current);
      }
    };
  }, [founderInputText, activeThread.dialect]);

  const handleSelectThread = (thread: VoiceThreadItem, focusReply = false) => {
    setSelectedThreadId(thread.id);
    setIsAutoDetecting(true);
    setReplySent(false);
    setTimeout(() => {
      setIsAutoDetecting(false);
    }, 280);
    if (focusReply) {
      setTimeout(() => {
        replyTextareaRef.current?.focus();
      }, 150);
    }
  };

  const playSpeechText = (
    text: string,
    langHint: string,
    onDone: () => void
  ) => {
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const voices = window.speechSynthesis.getVoices() || [];
        const prefix = langHint.split('-')[0];
        const matched =
          voices.find((v) => v.lang.toLowerCase().startsWith(prefix.toLowerCase())) ||
          (prefix === 'ur' ? voices.find((v) => v.lang.toLowerCase().startsWith('hi')) : undefined);

        const utterance = new SpeechSynthesisUtterance(text);
        if (matched) utterance.voice = matched;
        utterance.lang = matched ? matched.lang : langHint;
        utterance.rate = 0.96;
        utterance.pitch = 1.0;
        utterance.onend = onDone;
        utterance.onerror = onDone;
        window.speechSynthesis.speak(utterance);
        return;
      }
    } catch {
      // ignore speech synthesis block
    }
    setTimeout(onDone, 3000);
  };

  const handleTogglePlayIncoming = (thread: VoiceThreadItem) => {
    if (playingThreadId === thread.id) {
      try {
        window.speechSynthesis?.cancel();
      } catch {}
      setPlayingThreadId(null);
      return;
    }

    // Stop any existing playback
    setIsPlayingPreview(false);
    setPlayingThreadId(thread.id);

    // Mark as listened & immediately point the Reply Composer to this sender (e.g. Seven Cuts)
    setThreads((prev) =>
      prev.map((t) => (t.id === thread.id ? { ...t, unread: false } : t))
    );
    handleSelectThread(thread, true);

    playSpeechText(thread.speechPlayText, thread.speechLangCode, () => {
      setPlayingThreadId((curr) => (curr === thread.id ? null : curr));
    });
  };

  const handlePlayPreviewOutput = () => {
    if (!autoTranslatedOutput.trim()) return;
    if (isPlayingPreview) {
      try {
        window.speechSynthesis?.cancel();
      } catch {}
      setIsPlayingPreview(false);
      return;
    }

    setPlayingThreadId(null);
    setIsPlayingPreview(true);
    const previewLang =
      activeThread.dialect === 'Gulf Arabic'
        ? 'ar-SA'
        : activeThread.dialect === 'Standard Urdu'
        ? 'ur-PK'
        : activeThread.dialect === 'English'
        ? 'en-US'
        : 'hi-IN';

    playSpeechText(autoTranslatedOutput, previewLang, () => {
      setIsPlayingPreview(false);
    });
  };

  const handleStartDictation = () => {
    setDictationNotice(null);
    const SpeechRec =
      (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: any }).webkitSpeechRecognition;

    if (!SpeechRec) {
      setDictationNotice(
        'Voice-to-text microphone dictation is not supported in this browser; type your reply in any language below or record an audio note directly.'
      );
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      setIsDictating(true);
      recognition.onresult = (event: any) => {
        const transcript = event?.results?.[0]?.[0]?.transcript;
        if (transcript) {
          setFounderInputText(transcript);
        }
        setIsDictating(false);
      };
      recognition.onerror = () => {
        setIsDictating(false);
        setDictationNotice(
          'Could not capture voice dictation. You can type your reply in any language or attach a recording below.'
        );
      };
      recognition.onend = () => setIsDictating(false);
      recognition.start();
    } catch {
      setIsDictating(false);
    }
  };

  const handleDispatchReply = () => {
    if (!founderInputText.trim() && !uploadedUrl) return;
    setReplySent(true);
    setDispatchedHistory((prev) => [
      {
        id: `rep-${Date.now()}`,
        threadLabel: activeThread.salonOwnerLabel,
        targetDialect: activeThread.dialect,
        originalText: founderInputText.trim() || '(Recorded Founder Voice Clip)',
        convertedText: autoTranslatedOutput,
        audioAttachment: uploadedUrl || undefined,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
      ...prev,
    ]);
    setThreads((prev) =>
      prev.map((t) => (t.id === activeThread.id ? { ...t, unread: false } : t))
    );
    setTimeout(() => setReplySent(false), 4000);
  };

  const unreadCount = threads.filter((t) => t.unread).length;

  return (
    <div className="space-y-6 pb-28 lg:pb-8 min-w-0">
      {/* Voice Hub Header Card */}
      <PortalCard title="Voice Ticker & Audio Feed" kicker="AUTONOMOUS AUDIO CONVERSION" onClose={onClose}>
        <div className="space-y-4">
          <p className="text-xs text-[#8B949E] font-sans leading-relaxed">
            Listen to incoming salon owner voice notes (such as Hamza at Seven Cuts Salon) and reply in any language—the system automatically detects your language and converts your reply into that salon owner&apos;s native dialect without exposing personal phone numbers.
          </p>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Record Outbound Voice & Autonomous Dialect Translation */}
            <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-4 space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Mic className="size-4 text-cyan-400" />
                  <span className="text-xs font-mono font-bold text-[#F0F6FC] uppercase tracking-wider">
                    Founder Voice &amp; Auto-Language Conversion
                  </span>
                </div>
                <span className="text-[10px] font-mono text-[#3FB950] font-bold flex items-center gap-1 shrink-0">
                  <span className="size-1.5 rounded-full bg-[#3FB950] animate-pulse" />
                  GATEWAY ACTIVE
                </span>
              </div>

              {/* Recipient Selection */}
              <div>
                <label className="text-[10px] font-mono text-[#8B949E] block mb-1">
                  Replying to Incoming Voice Thread
                </label>
                <select
                  value={selectedThreadId}
                  onChange={(e) => {
                    const next = threads.find((t) => t.id === e.target.value);
                    if (next) handleSelectThread(next, false);
                  }}
                  className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#161B22] px-3 py-2 text-sm font-mono text-[#F0F6FC] focus:outline-none focus:border-[#06B6D4]"
                >
                  {threads.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.recipientLabel} · Dialect: {t.dialect}
                    </option>
                  ))}
                </select>
              </div>

              {/* Auto-Detection Telemetry Box */}
              <div className="rounded-xl border border-[#30363D] bg-[#161B22] p-3 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono">
                  <span className="text-cyan-400 font-bold uppercase flex items-center gap-1.5">
                    <Sparkles className="size-3 text-cyan-400" />
                    Auto-Detected Owner Dialect:
                  </span>
                  <span className="text-[#3FB950] font-bold bg-[#0D3822] px-2 py-0.5 rounded border border-[#116329]">
                    {isAutoDetecting ? 'Detecting Audio...' : `${activeThread.dialect} ✓`}
                  </span>
                </div>
                <p className="text-[11px] text-[#8B949E] font-sans leading-relaxed">
                  Speak or type in <strong>any language</strong> (English, Urdu, Arabic, Roman Urdu). System converts it automatically into{' '}
                  <strong className="text-[#F0F6FC]">{activeThread.dialect}</strong> for {activeThread.salonOwnerLabel}.
                </p>
              </div>

              {/* Founder Draft / Speaking Input */}
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-[10px] font-mono text-[#8B949E]">
                    Founder Reply (Detected Input: <span className="text-[#06B6D4] font-bold">{detectedFounderLang}</span>)
                  </label>
                  <button
                    type="button"
                    onClick={handleStartDictation}
                    className={`min-h-[32px] px-2.5 py-1 rounded-lg border text-[10px] font-mono font-bold transition flex items-center gap-1 ${
                      isDictating
                        ? 'border-[#da3633] bg-[#4C1C1D] text-[#F85149]'
                        : 'border-[#30363D] bg-[#161B22] text-[#06B6D4] hover:border-[#06B6D4]'
                    }`}
                  >
                    <Mic className="size-3" />
                    <span>{isDictating ? 'Listening...' : 'Speak Reply'}</span>
                  </button>
                </div>

                {dictationNotice && (
                  <p className="text-[11px] font-mono text-[#D29922]">{dictationNotice}</p>
                )}

                <textarea
                  ref={replyTextareaRef}
                  value={founderInputText}
                  onChange={(e) => setFounderInputText(e.target.value)}
                  placeholder="Type or speak in English, Urdu, or Arabic..."
                  rows={2}
                  className="w-full rounded-xl border border-[#30363D] bg-[#161B22] px-3 py-2 text-sm font-mono text-[#F0F6FC] focus:outline-none focus:border-[#06B6D4] resize-none"
                />
              </div>

              {/* Live Dialect Audio Synthesis Preview Box */}
              <div className="rounded-xl border border-[#30363D] bg-[#161B22] p-3 space-y-2 font-mono text-xs overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[10px]">
                  <span className="text-[#D29922] font-bold flex items-center gap-1.5">
                    {isTranslating && <RefreshCw className="size-3 animate-spin" />}
                    <span>
                      Auto-Converted Output ({activeThread.dialect})
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={handlePlayPreviewOutput}
                    className="min-h-[28px] px-2.5 py-0.5 rounded-lg border border-[#06B6D4]/50 bg-[#06B6D4]/15 text-[#06B6D4] hover:bg-[#06B6D4]/25 font-bold flex items-center gap-1 transition"
                  >
                    {isPlayingPreview ? <Pause className="size-3" /> : <Play className="size-3" />}
                    <span>{isPlayingPreview ? 'Stop Preview' : 'Hear Preview'}</span>
                  </button>
                </div>
                <p
                  dir={isAutoOutputRtl ? 'rtl' : 'ltr'}
                  className={`text-xs text-[#F0F6FC] italic font-sans leading-relaxed break-words [overflow-wrap:break-word] ${
                    isAutoOutputRtl ? 'text-right' : 'text-left'
                  }`}
                >
                  {autoTranslatedOutput ? `“${autoTranslatedOutput}”` : 'Type your reply above to generate instant dialect output...'}
                </p>
              </div>

              <VoiceRecorder onUploaded={setUploadedUrl} />

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#0D3822] border border-[#116329] p-3 text-xs text-[#3FB950]">
                <span className="text-[11px] font-mono">
                  Target: {activeThread.salonOwnerLabel} ({activeThread.dialect})
                </span>
                <button
                  type="button"
                  onClick={handleDispatchReply}
                  className="min-h-[48px] px-4 py-2 bg-[#06B6D4] hover:bg-[#22D3EE] text-[#0D1117] font-mono font-bold text-xs uppercase rounded-xl transition active:scale-95 flex items-center gap-1.5"
                >
                  <Send className="size-3.5" />
                  <span>{replySent ? 'Dispatched in Owner Language ✓' : 'Dispatch Converted Reply'}</span>
                </button>
              </div>
            </div>

            {/* Privacy Shield Telemetry & Dispatched Log */}
            <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-4 space-y-3.5 font-mono">
              <div className="flex items-center gap-2 text-cyan-400">
                <ShieldCheck className="size-4" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Central SIM Gateway &amp; Identity Isolation
                </span>
              </div>
              <p className="text-[11px] text-[#8B949E] font-sans leading-relaxed">
                Founder personal mobile number and WhatsApp profile remain 100% isolated. After you listen to any incoming salon voice note, your reply is translated into that salon owner&apos;s detected dialect and sent through WorkCraft&apos;s private line.
              </p>

              {/* Status Metrics */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-[#161B22] p-2.5 border border-[#30363D]">
                  <span className="text-[10px] text-[#6E7681] block">BUSINESS LINE</span>
                  <span className="text-cyan-400 font-bold truncate block">WorkCraft Private Line</span>
                </div>
                <div className="rounded-lg bg-[#161B22] p-2.5 border border-[#30363D]">
                  <span className="text-[10px] text-[#6E7681] block">VOICE QUALITY</span>
                  <span className="text-[#3FB950] font-bold truncate block">Clear HD Native Voice</span>
                </div>
              </div>

              {/* Sent Replies Thread History */}
              <div className="rounded-xl border border-[#30363D] bg-[#161B22] p-3 space-y-2 text-[10px]">
                <div className="flex items-center justify-between text-[#8B949E]">
                  <span className="font-bold text-[#D29922]">RECENT CONVERTED REPLIES SENT</span>
                  <span className="text-[#3FB950]">{dispatchedHistory.length} SENT</span>
                </div>
                {dispatchedHistory.length === 0 ? (
                  <p className="text-[11px] text-[#8B949E] font-sans leading-relaxed">
                    Play Hamza&apos;s voice note in the Incoming Queue below, type or speak your reply in any language, and click Dispatch to see the converted WhatsApp delivery here.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {dispatchedHistory.map((item) => (
                      <div key={item.id} className="rounded-lg border border-[#30363D] bg-[#0D1117] p-2.5 space-y-1">
                        <div className="flex items-center justify-between gap-2 text-[10px]">
                          <span className="text-[#06B6D4] font-bold">{item.threadLabel}</span>
                          <span className="text-[#3FB950]">{item.time} ✓</span>
                        </div>
                        <p className="text-[10px] text-[#8B949E] font-sans">
                          Founder Input: &ldquo;{item.originalText}&rdquo;
                        </p>
                        <p className="text-[11px] text-[#F0F6FC] font-sans">
                          Sent ({item.targetDialect}): &ldquo;{item.convertedText}&rdquo;
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </PortalCard>

      {/* Incoming Voice Feed */}
      <PortalCard
        title="Incoming Voice Queue"
        kicker={`${unreadCount} UNREAD MESSAGE${unreadCount === 1 ? '' : 'S'}`}
      >
        <div className="grid gap-4 md:grid-cols-2">
          {threads.map((thread) => {
            const isPlaying = playingThreadId === thread.id;
            const isSelected = selectedThreadId === thread.id;
            const isRtlNote = thread.dialect === 'Standard Urdu' || thread.dialect === 'Gulf Arabic';

            return (
              <div
                key={thread.id}
                className={`rounded-xl border p-4 space-y-3 transition ${
                  isSelected
                    ? 'border-[#06B6D4] bg-[#161B22]'
                    : 'border-[#30363D] bg-[#0D1117]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-[#F0F6FC] font-mono">
                        {thread.salonOwnerLabel}
                      </span>
                      {thread.unread ? (
                        <span className="rounded-full bg-[#06B6D4]/15 border border-[#06B6D4]/40 px-2 py-0.5 text-[9px] font-mono font-bold text-cyan-400">
                          UNREAD
                        </span>
                      ) : (
                        <span className="rounded-full bg-[#0D3822] border border-[#116329] px-2 py-0.5 text-[9px] font-mono font-bold text-[#3FB950] inline-flex items-center gap-1">
                          <CheckCircle2 className="size-2.5" />
                          <span>LISTENED</span>
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] font-mono text-[#6E7681] mt-0.5">
                      Received {thread.receivedAgo} · {thread.city} · {thread.duration} · {thread.dialect}
                    </p>
                  </div>
                  <Volume2 className={`size-4 shrink-0 ${isPlaying ? 'text-[#06B6D4] animate-pulse' : 'text-[#D29922]'}`} />
                </div>

                {/* Interactive Audio Player + Listen & Reply Actions */}
                <div className="flex flex-wrap items-center gap-2 bg-[#161B22] rounded-lg p-2.5 border border-[#30363D]">
                  <button
                    type="button"
                    onClick={() => handleTogglePlayIncoming(thread)}
                    className={`min-h-[40px] px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1.5 ${
                      isPlaying
                        ? 'bg-[#D29922] text-[#0D1117]'
                        : 'bg-[#06B6D4] hover:bg-[#22D3EE] text-[#0D1117]'
                    }`}
                  >
                    {isPlaying ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                    <span>{isPlaying ? 'Playing Voice Note...' : 'Listen Voice Note'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setThreads((prev) =>
                        prev.map((t) => (t.id === thread.id ? { ...t, unread: false } : t))
                      );
                      handleSelectThread(thread, true);
                    }}
                    className="min-h-[40px] px-3 py-1.5 rounded-lg border border-[#30363D] bg-[#0D1117] hover:border-[#06B6D4] text-xs font-mono font-bold text-[#F0F6FC] transition ml-auto"
                  >
                    Reply in {thread.dialect.split(' ')[0]} →
                  </button>
                </div>

                <p
                  dir={isRtlNote ? 'rtl' : 'ltr'}
                  className={`text-[11px] text-[#8B949E] italic bg-[#161B22] p-2.5 rounded-lg border border-[#30363D] font-sans leading-relaxed ${
                    isRtlNote ? 'text-right' : 'text-left'
                  }`}
                >
                  {thread.transcript}
                </p>
              </div>
            );
          })}
        </div>
      </PortalCard>
    </div>
  );
};
