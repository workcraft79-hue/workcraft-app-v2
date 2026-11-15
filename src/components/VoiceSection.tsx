import React, { useEffect, useRef, useState } from 'react';
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
  Square,
  AlertTriangle,
} from 'lucide-react';
import { PortalCard } from './PortalCard';
import { VoiceRecorder, type RecordedOpusClip } from './VoiceRecorder';
import {
  type LiveUsageMeter,
  type SupportedVoiceLocale,
  type VoiceThreadItem,
} from '../data/portalData';

interface VoiceSectionProps {
  threads: VoiceThreadItem[];
  onThreadsUpdated: (threads: VoiceThreadItem[]) => void;
  onUsageUpdated?: (usage: LiveUsageMeter) => void;
  onClose?: () => void;
}

function getSpeechLangForLocale(locale: SupportedVoiceLocale): string {
  if (locale === 'ar-AE') return 'ar-AE';
  if (locale === 'en-US') return 'en-US';
  return 'ur-PK';
}

function getVoiceNameForLocale(locale: SupportedVoiceLocale): string {
  if (locale === 'ar-AE') return 'ar-AE-HamdanNeural';
  if (locale === 'en-US') return 'en-US-AndrewNeural';
  return 'ur-PK-AsadNeural';
}

export const VoiceSection: React.FC<VoiceSectionProps> = ({
  threads,
  onThreadsUpdated,
  onUsageUpdated,
  onClose,
}) => {
  const [selectedThreadId, setSelectedThreadId] = useState<string>(
    threads[0]?.id || 'wc-101'
  );
  const activeThread = threads.find((t) => t.id === selectedThreadId) || threads[0];

  const [founderInputText, setFounderInputText] = useState<string>('');
  const [recordedClip, setRecordedClip] = useState<RecordedOpusClip | null>(null);
  const [detectedFounderLang, setDetectedFounderLang] = useState<string>('Auto');
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [replySent, setReplySent] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const [autoTranslatedOutput, setAutoTranslatedOutput] = useState<string>('');
  const [convertedAudioUrl, setConvertedAudioUrl] = useState<string | null>(null);
  const [ttsVoiceUsed, setTtsVoiceUsed] = useState<string>('');

  // Quick row mic capture state (recording directly from an incoming row's Mic button)
  const [rowRecordingThreadId, setRowRecordingThreadId] = useState<string | null>(null);
  const rowRecorderRef = useRef<MediaRecorder | null>(null);
  const rowChunksRef = useRef<Blob[]>([]);

  // Audio playback state
  const [playingThreadId, setPlayingThreadId] = useState<string | null>(null);
  const activeAudioElRef = useRef<HTMLAudioElement | null>(null);
  const replyTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Thread-switching state reset: always clear draft, recorded Opus clip, and synthesized TTS when salon changes
  useEffect(() => {
    setRecordedClip(null);
    setFounderInputText('');
    setAutoTranslatedOutput('');
    setConvertedAudioUrl(null);
    setTtsVoiceUsed('');
    setDetectedFounderLang('Auto');
    setReplySent(false);
    setVoiceError(null);
  }, [selectedThreadId]);

  useEffect(() => {
    return () => {
      if (activeAudioElRef.current) {
        activeAudioElRef.current.pause();
        activeAudioElRef.current = null;
      }
      try {
        window.speechSynthesis?.cancel();
      } catch {}
    };
  }, []);

  if (!activeThread) return null;

  const isAutoOutputRtl =
    activeThread.targetLocale === 'ur-PK' || activeThread.targetLocale === 'ar-AE';

  const markThreadAsRead = async (threadId: string) => {
    const nextThreads = threads.map((t) =>
      t.id === threadId ? { ...t, unread: false } : t
    );
    onThreadsUpdated(nextThreads);
    try {
      await fetch(`/api/voice/threads/${encodeURIComponent(threadId)}/read`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unread: false }),
      });
    } catch {
      // keep optimistic state on static host
    }
  };

  const handleSelectThread = (thread: VoiceThreadItem, focusComposer = false) => {
    if (thread.id !== selectedThreadId) {
      setSelectedThreadId(thread.id);
    }
    if (thread.unread) {
      void markThreadAsRead(thread.id);
    }
    if (focusComposer) {
      window.setTimeout(() => {
        replyTextareaRef.current?.focus();
      }, 120);
    }
  };

  const stopAllPlayback = () => {
    if (activeAudioElRef.current) {
      activeAudioElRef.current.pause();
      activeAudioElRef.current = null;
    }
    try {
      window.speechSynthesis?.cancel();
    } catch {}
    setPlayingThreadId(null);
  };

  const handleTogglePlayIncoming = (thread: VoiceThreadItem) => {
    if (playingThreadId === thread.id) {
      stopAllPlayback();
      return;
    }

    stopAllPlayback();
    setPlayingThreadId(thread.id);
    handleSelectThread(thread, false);

    // Prefer recorded real audio from latest Salon Owner message if available
    const latestOwnerAudio = [...thread.messages]
      .reverse()
      .find((m) => m.senderRole === 'SALON_OWNER' && m.audioDataUrl);

    if (latestOwnerAudio?.audioDataUrl) {
      const audio = new Audio(latestOwnerAudio.audioDataUrl);
      activeAudioElRef.current = audio;
      audio.onended = () => setPlayingThreadId((curr) => (curr === thread.id ? null : curr));
      audio.onerror = () => setPlayingThreadId((curr) => (curr === thread.id ? null : curr));
      void audio.play().catch(() => {
        setPlayingThreadId(null);
      });
      return;
    }

    // Fallback playback via localized synthesis for seed messages without MP3 attachment
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const langHint = getSpeechLangForLocale(thread.targetLocale);
        const voices = window.speechSynthesis.getVoices() || [];
        const prefix = langHint.split('-')[0];
        const matched =
          voices.find((v) => v.lang.toLowerCase().startsWith(prefix)) ||
          (prefix === 'ur' ? voices.find((v) => v.lang.toLowerCase().startsWith('hi')) : undefined);
        const utterance = new SpeechSynthesisUtterance(thread.speechPlayText);
        if (matched) utterance.voice = matched;
        utterance.lang = matched ? matched.lang : langHint;
        utterance.rate = 0.96;
        utterance.onend = () => setPlayingThreadId((curr) => (curr === thread.id ? null : curr));
        utterance.onerror = () => setPlayingThreadId((curr) => (curr === thread.id ? null : curr));
        window.speechSynthesis.speak(utterance);
        return;
      }
    } catch {
      // ignore fallback errors
    }

    window.setTimeout(() => {
      setPlayingThreadId((curr) => (curr === thread.id ? null : curr));
    }, 2500);
  };

  const handleToggleRowMic = async (thread: VoiceThreadItem) => {
    handleSelectThread(thread, false);

    if (rowRecordingThreadId === thread.id) {
      rowRecorderRef.current?.stop();
      setRowRecordingThreadId(null);
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setVoiceError('Microphone permission unavailable in this browser.');
      return;
    }

    try {
      setVoiceError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      const mime =
        MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
          ? 'audio/ogg;codecs=opus'
          : '';
      const recorder = new MediaRecorder(
        stream,
        mime ? { mimeType: mime, audioBitsPerSecond: 20000 } : { audioBitsPerSecond: 20000 }
      );
      rowChunksRef.current = [];
      rowRecorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) rowChunksRef.current.push(ev.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const resolvedMime = recorder.mimeType || mime || 'audio/webm;codecs=opus';
        const blob = new Blob(rowChunksRef.current, { type: resolvedMime });
        const url = URL.createObjectURL(blob);
        const reader = new FileReader();
        reader.onloadend = () => {
          const raw = typeof reader.result === 'string' ? reader.result : '';
          const comma = raw.indexOf(',');
          const base64 = comma >= 0 ? raw.slice(comma + 1) : raw;
          setRecordedClip({
            url,
            base64,
            mimeType: resolvedMime,
            sizeBytes: blob.size,
            sizeKb: Math.max(1, Math.round(blob.size / 1024)),
            durationSec: 5,
          });
        };
        reader.readAsDataURL(blob);
      };

      recorder.start(250);
      setRowRecordingThreadId(thread.id);
    } catch {
      setVoiceError('Could not access microphone. Please allow microphone permission.');
    }
  };

  const handleConvertAndSendReply = async () => {
    const cleanDraft = founderInputText.trim();
    if (!cleanDraft && !recordedClip) {
      setVoiceError('Record a compressed Opus voice clip or enter a reply message first.');
      return;
    }

    setVoiceError(null);
    setIsProcessingVoice(true);
    setReplySent(false);

    try {
      const translateRes = await fetch('/api/translate-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64: recordedClip?.base64 || undefined,
          audioMimeType: recordedClip?.mimeType || undefined,
          text: cleanDraft || undefined,
          targetLocale: activeThread.targetLocale,
          targetDialect: activeThread.dialect,
        }),
      });

      const translateData = (await translateRes.json()) as {
        transcript?: string;
        translatedText?: string;
        detectedInputLanguage?: string;
        voiceName?: string;
        audioBase64?: string | null;
        audioMimeType?: string;
        ttsError?: string;
        usage?: LiveUsageMeter;
        error?: string;
      };

      if (!translateRes.ok || translateData.error) {
        throw new Error(translateData.error || 'Server voice pipeline failed.');
      }

      const finalTranscript =
        translateData.transcript?.trim() || cleanDraft || '(Compressed Opus Voice Clip)';
      const finalTranslated = translateData.translatedText?.trim() || finalTranscript;
      const finalVoiceName =
        translateData.voiceName || getVoiceNameForLocale(activeThread.targetLocale);
      const audioDataUrl = translateData.audioBase64
        ? `data:${translateData.audioMimeType || 'audio/mpeg'};base64,${translateData.audioBase64}`
        : recordedClip?.url || undefined;

      setDetectedFounderLang(translateData.detectedInputLanguage || 'Auto');
      setAutoTranslatedOutput(finalTranslated);
      setTtsVoiceUsed(finalVoiceName);
      setConvertedAudioUrl(audioDataUrl || null);
      if (translateData.usage && onUsageUpdated) {
        onUsageUpdated(translateData.usage);
      }

      // Persist unified message into backend voice thread (syncs straight to Salon Owner Dashboard)
      try {
        const saveRes = await fetch('/api/voice/threads/message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            threadId: activeThread.id,
            salonId: activeThread.salonId,
            salonName: activeThread.salonName,
            ownerName: activeThread.ownerName,
            city: activeThread.city,
            targetLocale: activeThread.targetLocale,
            senderRole: 'FOUNDER',
            originalText: finalTranscript,
            translatedText: finalTranslated,
            detectedInputLanguage: translateData.detectedInputLanguage || 'Auto',
            voiceName: finalVoiceName,
            audioDataUrl: audioDataUrl?.startsWith('data:audio/') ? audioDataUrl : undefined,
            sizeBytes: recordedClip?.sizeBytes || (translateData.audioBase64 ? Math.round((translateData.audioBase64.length * 3) / 4) : 2048),
          }),
        });
        if (saveRes.ok) {
          const savedData = (await saveRes.json()) as {
            threads?: VoiceThreadItem[];
            usage?: LiveUsageMeter;
          };
          if (savedData.threads) {
            onThreadsUpdated(savedData.threads);
          }
          if (savedData.usage && onUsageUpdated) {
            onUsageUpdated(savedData.usage);
          }
        }
      } catch {
        // Optimistic update below handles static fallback
      }

      // Ensure local UI updates immediately even if backend is unavailable
      const localNewMsg = {
        id: `vmsg-${Date.now()}`,
        senderRole: 'FOUNDER' as const,
        senderLabel: 'WorkCraft Founder (Private Line)',
        originalText: finalTranscript,
        translatedText: finalTranslated,
        detectedInputLanguage: translateData.detectedInputLanguage || 'Auto',
        targetLocale: activeThread.targetLocale,
        voiceName: finalVoiceName,
        audioDataUrl,
        sizeBytes: recordedClip?.sizeBytes || 2048,
        createdAtMs: Date.now(),
        expiresAtMs: Date.now() + 7 * 24 * 60 * 60 * 1000,
      };
      onThreadsUpdated(
        threads.map((t) =>
          t.id === activeThread.id
            ? {
                ...t,
                unread: false,
                messages: t.messages.some((m) => m.translatedText === localNewMsg.translatedText && Date.now() - m.createdAtMs < 3000)
                  ? t.messages
                  : [...t.messages, localNewMsg],
              }
            : t
        )
      );

      setRecordedClip(null);
      setFounderInputText('');
      setReplySent(true);
      window.setTimeout(() => setReplySent(false), 4500);
    } catch (err) {
      setVoiceError(
        err instanceof Error
          ? err.message
          : 'Could not convert and send voice reply right now.'
      );
    } finally {
      setIsProcessingVoice(false);
    }
  };

  const unreadCount = threads.filter((t) => t.unread).length;
  const activeMessages = activeThread.messages || [];

  return (
    <div className="space-y-6 pb-28 lg:pb-8 min-w-0">
      {/* Unified Voice Inbox & Gemini -> msedge-tts Translation Pipeline */}
      <PortalCard
        title="Unified Voice Inbox"
        kicker={`ZERO-COST MULTILINGUAL VOICE PIPELINE · ${unreadCount} UNREAD`}
        onClose={onClose}
      >
        <div className="space-y-4">
          <p className="text-xs text-[#8B949E] font-sans leading-relaxed">
            Listen to incoming salon voice notes and reply directly with compressed Opus audio (~150 KB, 7-day auto-purge). Selecting any salon switches target locale automatically and clears prior draft state cleanly.
          </p>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Composer: Opus Record -> Server Gemini + msedge-tts -> Send Reply */}
            <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-4 space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Mic className="size-4 text-[#06B6D4] shrink-0" />
                  <span className="text-xs font-mono font-bold text-[#F0F6FC] uppercase tracking-wider truncate">
                    #{activeThread.serialNumber} · {activeThread.ownerName} · {activeThread.salonName}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-[#3FB950] font-bold flex items-center gap-1 shrink-0">
                  <span className="size-1.5 rounded-full bg-[#3FB950]" />
                  {activeThread.targetLocale}
                </span>
              </div>

              {/* Active Target Salon Selector */}
              <div>
                <label className="text-[10px] font-mono text-[#8B949E] block mb-1">
                  Active Voice Thread (Switching Resets Reply Draft &amp; Audio)
                </label>
                <select
                  value={activeThread.id}
                  onChange={(e) => {
                    const next = threads.find((t) => t.id === e.target.value);
                    if (next) handleSelectThread(next, false);
                  }}
                  className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#161B22] px-3 py-2 text-sm font-mono text-[#F0F6FC] focus:outline-none focus:border-[#06B6D4]"
                >
                  {threads.map((t) => (
                    <option key={t.id} value={t.id}>
                      #{t.serialNumber} · {t.ownerName} · {t.salonName} ({t.targetLocale})
                    </option>
                  ))}
                </select>
              </div>

              {/* Target Neural Voice Info */}
              <div className="rounded-xl border border-[#30363D] bg-[#161B22] p-3 space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono">
                  <span className="text-[#06B6D4] font-bold uppercase flex items-center gap-1.5">
                    <Sparkles className="size-3" />
                    Neural Output Voice:
                  </span>
                  <span className="text-[#3FB950] font-bold bg-[#0D3822] px-2 py-0.5 rounded border border-[#116329]">
                    {getVoiceNameForLocale(activeThread.targetLocale)}
                  </span>
                </div>
                <p className="text-[11px] text-[#8B949E] font-sans">
                  Record your reply in any language (or type below). Clicking{' '}
                  <strong className="text-[#F0F6FC]">Send Reply</strong> translates via Gemini into{' '}
                  <strong className="text-[#F0F6FC]">{activeThread.dialect}</strong> and streams native voice audio back in memory.
                </p>
              </div>

              {/* Compressed Opus Voice Recorder */}
              <VoiceRecorder
                key={activeThread.id}
                title={`Record Voice Reply for #${activeThread.serialNumber} · ${activeThread.ownerName}`}
                subtitle="Compressed Opus (~150 KB max) · Sent straight to Gemini + Edge Neural TTS."
                onRecorded={(clip) => {
                  setRecordedClip(clip);
                  setVoiceError(null);
                }}
              />

              {recordedClip && (
                <div className="rounded-xl border border-[#06B6D4]/50 bg-[#161B22] p-3 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-[#06B6D4] font-bold">
                      Recorded Opus Clip Ready ({recordedClip.sizeKb} KB · {recordedClip.durationSec}s)
                    </span>
                    <button
                      type="button"
                      onClick={() => setRecordedClip(null)}
                      className="text-[#F85149] hover:underline"
                    >
                      Discard
                    </button>
                  </div>
                  <audio controls src={recordedClip.url} className="w-full h-9" />
                </div>
              )}

              {/* Optional Text Note / Context */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] font-mono text-[#8B949E]">
                  <span>Optional Text Reply / Note (Detected: {detectedFounderLang})</span>
                </div>
                <textarea
                  ref={replyTextareaRef}
                  value={founderInputText}
                  onChange={(e) => setFounderInputText(e.target.value)}
                  placeholder={`Optional text note for ${activeThread.ownerName} (${activeThread.salonName})...`}
                  rows={2}
                  className="w-full rounded-xl border border-[#30363D] bg-[#161B22] px-3 py-2 text-sm font-mono text-[#F0F6FC] focus:outline-none focus:border-[#06B6D4] resize-none"
                />
              </div>

              {voiceError && (
                <div className="rounded-xl border border-[#da3633] bg-[#4C1C1D] px-3 py-2 text-xs font-mono text-[#F85149] flex items-center gap-2">
                  <AlertTriangle className="size-4 shrink-0" />
                  <span>{voiceError}</span>
                </div>
              )}

              {/* Converted Output & Streamed Neural Audio Preview */}
              {(autoTranslatedOutput || convertedAudioUrl) && (
                <div className="rounded-xl border border-[#116329] bg-[#0D3822]/50 p-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-[#3FB950] font-bold">
                      ✓ Converted Output ({activeThread.targetLocale} · {ttsVoiceUsed || getVoiceNameForLocale(activeThread.targetLocale)})
                    </span>
                  </div>
                  {autoTranslatedOutput && (
                    <p
                      dir={isAutoOutputRtl ? 'rtl' : 'ltr'}
                      className={`text-xs text-[#F0F6FC] font-sans leading-relaxed ${
                        isAutoOutputRtl ? 'text-right' : 'text-left'
                      }`}
                    >
                      “{autoTranslatedOutput}”
                    </p>
                  )}
                  {convertedAudioUrl && (
                    <audio controls src={convertedAudioUrl} className="w-full h-9" />
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#161B22] border border-[#30363D] p-3">
                <span className="text-[11px] font-mono text-[#8B949E]">
                  Target: #{activeThread.serialNumber} · {activeThread.ownerName}
                </span>
                <button
                  type="button"
                  disabled={isProcessingVoice || (!recordedClip && !founderInputText.trim())}
                  onClick={handleConvertAndSendReply}
                  className="min-h-[48px] px-5 py-2.5 bg-[#06B6D4] hover:bg-[#22D3EE] disabled:opacity-50 text-[#0D1117] font-mono font-bold text-xs uppercase rounded-xl transition active:scale-95 flex items-center gap-2"
                >
                  {isProcessingVoice ? (
                    <>
                      <RefreshCw className="size-3.5 animate-spin" />
                      <span>Converting Voice...</span>
                    </>
                  ) : (
                    <>
                      <Send className="size-3.5" />
                      <span>{replySent ? 'Sent in Owner Language ✓' : 'Send Reply'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Thread Conversation History + Founder Privacy Shield */}
            <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-4 space-y-3.5 font-mono">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[#06B6D4]">
                  <ShieldCheck className="size-4 shrink-0" />
                  <span className="text-xs font-bold uppercase tracking-wider">
                    Thread Timeline · 7-Day Auto-Purge
                  </span>
                </div>
                <span className="text-[10px] text-[#3FB950] font-bold">
                  {activeMessages.length} MSG{activeMessages.length === 1 ? '' : 'S'}
                </span>
              </div>

              <p className="text-[11px] text-[#8B949E] font-sans leading-relaxed">
                Personal Founder phone number remains 100% hidden. Replies stream in-memory via Edge Neural TTS and sync immediately to {activeThread.salonName}&apos;s Live Dashboard.
              </p>

              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {activeMessages.length === 0 ? (
                  <div className="rounded-xl border border-[#30363D] bg-[#161B22] p-3 text-xs text-[#8B949E] font-sans">
                    Incoming note: {activeThread.transcript}
                  </div>
                ) : (
                  activeMessages.map((msg) => {
                    const msgRtl = msg.targetLocale === 'ur-PK' || msg.targetLocale === 'ar-AE';
                    const isFounder = msg.senderRole === 'FOUNDER';
                    return (
                      <div
                        key={msg.id}
                        className={`rounded-xl border p-3 space-y-2 ${
                          isFounder
                            ? 'border-[#06B6D4]/50 bg-[#161B22]'
                            : 'border-[#30363D] bg-[#161B22]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 text-[10px]">
                          <span className={isFounder ? 'text-[#06B6D4] font-bold' : 'text-[#D29922] font-bold'}>
                            {msg.senderLabel}
                          </span>
                          <span className="text-[#6E7681]">
                            {new Date(msg.createdAtMs).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        {msg.originalText && msg.originalText !== msg.translatedText && (
                          <p className="text-[11px] text-[#8B949E] font-sans">
                            Original ({msg.detectedInputLanguage}): “{msg.originalText}”
                          </p>
                        )}
                        <p
                          dir={msgRtl ? 'rtl' : 'ltr'}
                          className={`text-xs text-[#F0F6FC] font-sans leading-relaxed ${
                            msgRtl ? 'text-right' : 'text-left'
                          }`}
                        >
                          {msg.translatedText}
                        </p>
                        {msg.audioDataUrl && (
                          <audio controls src={msg.audioDataUrl} className="w-full h-8" />
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </PortalCard>

      {/* Incoming Voice Rows: Left = Serial # · Owner Name · Salon Name | Right = Listen + Mic Record */}
      <PortalCard
        title="Incoming Salon Voice Queue"
        kicker={`${unreadCount} UNREAD MESSAGE${unreadCount === 1 ? '' : 'S'}`}
      >
        <div className="space-y-3">
          {threads.map((thread) => {
            const isPlaying = playingThreadId === thread.id;
            const isSelected = activeThread.id === thread.id;
            const isRowMicActive = rowRecordingThreadId === thread.id;
            const isRtlNote = thread.targetLocale === 'ur-PK' || thread.targetLocale === 'ar-AE';

            return (
              <div
                key={thread.id}
                onClick={() => handleSelectThread(thread, false)}
                className={`rounded-xl border p-4 space-y-2.5 transition cursor-pointer ${
                  isSelected
                    ? 'border-[#06B6D4] bg-[#161B22]'
                    : 'border-[#30363D] bg-[#0D1117] hover:border-[#484F58]'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Left: Strictly formatted Serial # · Owner Name · Salon Name */}
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-[#F0F6FC] font-mono">
                        #{thread.serialNumber} · {thread.ownerName} · {thread.salonName}
                      </span>
                      {thread.unread ? (
                        <span className="rounded-full bg-[#06B6D4]/15 border border-[#06B6D4]/40 px-2 py-0.5 text-[9px] font-mono font-bold text-[#06B6D4]">
                          UNREAD
                        </span>
                      ) : (
                        <span className="rounded-full bg-[#0D3822] border border-[#116329] px-2 py-0.5 text-[9px] font-mono font-bold text-[#3FB950] inline-flex items-center gap-1">
                          <CheckCircle2 className="size-2.5" />
                          <span>READ</span>
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] font-mono text-[#8B949E]">
                      {thread.receivedAgo} · {thread.city} · {thread.duration} · Target: {thread.targetLocale}
                    </p>
                  </div>

                  {/* Right: Listen and Mic Record buttons */}
                  <div
                    className="flex items-center gap-2 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => handleTogglePlayIncoming(thread)}
                      className={`min-h-[48px] px-4 py-2 rounded-xl text-xs font-mono font-bold transition flex items-center gap-1.5 ${
                        isPlaying
                          ? 'bg-[#D29922] text-[#0D1117]'
                          : 'bg-[#06B6D4] hover:bg-[#22D3EE] text-[#0D1117]'
                      }`}
                    >
                      {isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
                      <span>{isPlaying ? 'Stop' : 'Listen'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleRowMic(thread)}
                      className={`min-h-[48px] px-4 py-2 rounded-xl border text-xs font-mono font-bold transition flex items-center gap-1.5 ${
                        isRowMicActive
                          ? 'border-[#da3633] bg-[#F85149] text-[#0D1117]'
                          : 'border-[#30363D] bg-[#21262D] hover:border-[#06B6D4] text-[#F0F6FC]'
                      }`}
                    >
                      {isRowMicActive ? <Square className="size-4" /> : <Mic className="size-4 text-[#06B6D4]" />}
                      <span>{isRowMicActive ? 'Stop Rec' : 'Mic Record'}</span>
                    </button>
                  </div>
                </div>

                <p
                  dir={isRtlNote ? 'rtl' : 'ltr'}
                  className={`text-xs text-[#8B949E] italic bg-[#0D1117]/60 px-3 py-2 rounded-lg border border-[#30363D] font-sans leading-relaxed ${
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
