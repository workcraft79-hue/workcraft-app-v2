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
  if (locale === 'ar-AE') return 'Gemini Charon (ar-AE)';
  if (locale === 'en-US') return 'Gemini Kore (en-US)';
  return 'Gemini Charon (ur-PK)';
}

interface VerifiedVoicePreview {
  transcript: string;
  translatedText: string;
  detectedInputLanguage: string;
  voiceName: string;
  convertedAudioUrl: string | null;
  ttsWarning?: string;
  sourceSignature: string;
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
  const [isPreviewingVoice, setIsPreviewingVoice] = useState(false);
  const [replySent, setReplySent] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [ttsWarning, setTtsWarning] = useState<string | null>(null);
  const [verifiedPreview, setVerifiedPreview] = useState<VerifiedVoicePreview | null>(null);

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
    setTtsWarning(null);
    setVerifiedPreview(null);
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

  const currentInputSignature = `${activeThread.id}::${activeThread.targetLocale}::${recordedClip?.base64.slice(0, 48) || ''}::${founderInputText.trim()}`;

  const markThreadAsRead = async (threadId: string) => {
    const nextThreads = threads.map((t) =>
      t.id === threadId ? { ...t, unread: false } : t
    );
    onThreadsUpdated(nextThreads);
    try {
      await fetch(`/api/voice/threads/${encodeURIComponent(threadId)}/read`, {
        method: 'PATCH',
        credentials: 'include',
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
      const mimeCandidates = [
        'audio/webm;codecs=opus',
        'audio/ogg;codecs=opus',
        'audio/mp4',
        'audio/webm',
      ];
      const mime = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || '';
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
        const resolvedMime = recorder.mimeType || mime || 'audio/mp4';
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

  const requestTranslationFromServer = async (): Promise<VerifiedVoicePreview> => {
    const cleanDraft = founderInputText.trim();
    const translateRes = await fetch('/api/translate-voice', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audioBase64: recordedClip?.base64 || undefined,
        audioMimeType: recordedClip?.mimeType || undefined,
        text: cleanDraft || undefined,
        targetLocale: activeThread.targetLocale,
        targetDialect: activeThread.dialect,
      }),
    });

    const translateData = (await translateRes.json().catch(() => ({}))) as {
      transcript?: string;
      translatedText?: string;
      detectedInputLanguage?: string;
      voiceName?: string;
      audioBase64?: string | null;
      audioMimeType?: string;
      translationSource?: 'gemini-audio' | 'gemini-text' | 'error';
      translationError?: string;
      ttsSource?: 'gemini-tts' | 'msedge-tts' | 'unavailable';
      ttsError?: string;
      usage?: LiveUsageMeter;
      error?: string;
    };

    if (translateData.usage && onUsageUpdated) {
      onUsageUpdated(translateData.usage);
    }

    if (
      !translateRes.ok ||
      translateData.error ||
      translateData.translationError ||
      translateData.translationSource === 'error' ||
      !translateData.translatedText?.trim()
    ) {
      throw new Error(
        translateData.error ||
          translateData.translationError ||
          'Server could not translate your message. Please verify GEMINI_API_KEY and try again.'
      );
    }

    const finalTranscript =
      translateData.transcript?.trim() || cleanDraft || '(Recorded voice clip)';
    const finalTranslated = translateData.translatedText.trim();
    const finalVoiceName =
      translateData.voiceName || getVoiceNameForLocale(activeThread.targetLocale);
    const convertedDataUrl = translateData.audioBase64
      ? `data:${translateData.audioMimeType || 'audio/wav'};base64,${translateData.audioBase64}`
      : null;

    const preview: VerifiedVoicePreview = {
      transcript: finalTranscript,
      translatedText: finalTranslated,
      detectedInputLanguage: translateData.detectedInputLanguage || 'Auto',
      voiceName: finalVoiceName,
      convertedAudioUrl: convertedDataUrl,
      ttsWarning: !convertedDataUrl
        ? translateData.ttsError || 'Neural audio was unavailable; translated text is ready for delivery.'
        : undefined,
      sourceSignature: currentInputSignature,
    };

    setDetectedFounderLang(preview.detectedInputLanguage);
    setAutoTranslatedOutput(preview.translatedText);
    setTtsVoiceUsed(preview.voiceName);
    setConvertedAudioUrl(preview.convertedAudioUrl);
    setTtsWarning(preview.ttsWarning || null);
    setVerifiedPreview(preview);

    return preview;
  };

  const handlePreviewTranslation = async () => {
    const cleanDraft = founderInputText.trim();
    if (!cleanDraft && !recordedClip) {
      setVoiceError('Record a compressed Opus voice clip or enter a reply message first.');
      return;
    }
    setVoiceError(null);
    setTtsWarning(null);
    setReplySent(false);
    setIsPreviewingVoice(true);
    try {
      await requestTranslationFromServer();
    } catch (err) {
      setVoiceError(
        err instanceof Error ? err.message : 'Unable to translate preview right now.'
      );
    } finally {
      setIsPreviewingVoice(false);
    }
  };

  const handleConvertAndSendReply = async () => {
    const cleanDraft = founderInputText.trim();
    if (!cleanDraft && !recordedClip && !verifiedPreview) {
      setVoiceError('Record a compressed Opus voice clip or enter a reply message first.');
      return;
    }

    setVoiceError(null);
    setIsProcessingVoice(true);
    setReplySent(false);

    try {
      const activePreview =
        verifiedPreview && verifiedPreview.sourceSignature === currentInputSignature
          ? verifiedPreview
          : await requestTranslationFromServer();

      const finalTranscript = activePreview.transcript.trim();
      const finalTranslated = activePreview.translatedText.trim();
      const finalVoiceName = activePreview.voiceName;
      const audioDataUrl = activePreview.convertedAudioUrl || undefined;

      if (!finalTranslated) {
        throw new Error('Translated reply text is empty. Please re-record or type your reply.');
      }

      // Persist unified message into backend voice thread (syncs straight to Salon Owner Dashboard)
      const saveRes = await fetch('/api/voice/threads/message', {
        method: 'POST',
        credentials: 'include',
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
          detectedInputLanguage: activePreview.detectedInputLanguage || 'Auto',
          voiceName: finalVoiceName,
          audioDataUrl: audioDataUrl?.startsWith('data:audio/') ? audioDataUrl : undefined,
          sizeBytes: audioDataUrl
            ? Math.round((audioDataUrl.length * 3) / 4)
            : recordedClip?.sizeBytes || 2048,
        }),
      });

      if (!saveRes.ok) {
        const errBody = (await saveRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error || `Failed to save voice reply (HTTP ${saveRes.status}).`);
      }

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

      setRecordedClip(null);
      setFounderInputText('');
      setVerifiedPreview(null);
      setReplySent(true);
      window.setTimeout(() => setReplySent(false), 5000);
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
                subtitle="Speak in Arabic, Urdu, or English. Click Translate & Preview to verify exact words & target audio before sending."
                onRecorded={(clip) => {
                  setRecordedClip(clip);
                  setVerifiedPreview(null);
                  setVoiceError(null);
                  setTtsWarning(null);
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
                      onClick={() => {
                        setRecordedClip(null);
                        setVerifiedPreview(null);
                      }}
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
                  onChange={(e) => {
                    setFounderInputText(e.target.value);
                    setVerifiedPreview(null);
                  }}
                  placeholder={`Optional text note for ${activeThread.ownerName} (${activeThread.salonName})...`}
                  rows={2}
                  className="w-full rounded-xl border border-[#30363D] bg-[#161B22] px-3 py-2 text-sm font-mono text-[#F0F6FC] focus:outline-none focus:border-[#06B6D4] resize-none"
                />
              </div>

              {voiceError && (
                <div className="rounded-xl border border-[#da3633] bg-[#4C1C1D] px-3 py-2 text-xs font-mono text-[#F85149] flex items-start gap-2">
                  <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                  <span>{voiceError}</span>
                </div>
              )}

              {ttsWarning && (
                <div className="rounded-xl border border-[#9E6A03] bg-[#3B2E0B] px-3 py-2 text-[11px] font-mono text-[#D29922] flex items-start gap-2">
                  <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                  <span>{ttsWarning}</span>
                </div>
              )}

              {/* Verified Preview / Converted Output (Both Target Text + Target Audio) */}
              {(verifiedPreview || autoTranslatedOutput || convertedAudioUrl) && (
                <div className="rounded-xl border border-[#116329] bg-[#0D3822]/50 p-3 space-y-2.5 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono">
                    <span className="text-[#3FB950] font-bold">
                      {verifiedPreview ? '✓ Preview Ready — Verify Before Sending' : '✓ Delivered Output'} ({activeThread.targetLocale} · {ttsVoiceUsed || getVoiceNameForLocale(activeThread.targetLocale)})
                    </span>
                    <span className="text-[#8B949E]">
                      Detected: {verifiedPreview?.detectedInputLanguage || detectedFounderLang}
                    </span>
                  </div>

                  {verifiedPreview ? (
                    <>
                      <div className="space-y-1">
                        <label className="text-[10px] font-mono text-[#8B949E] block">
                          Heard Original ({verifiedPreview.detectedInputLanguage}):
                        </label>
                        <input
                          type="text"
                          value={verifiedPreview.transcript}
                          onChange={(e) =>
                            setVerifiedPreview((prev) =>
                              prev ? { ...prev, transcript: e.target.value } : prev
                            )
                          }
                          className="w-full rounded-lg border border-[#30363D] bg-[#0D1117] px-2.5 py-1.5 text-xs text-[#F0F6FC] font-sans"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-mono text-[#3FB950] block">
                          Translated Text Sent to {activeThread.ownerName} ({activeThread.targetLocale} — Voice + Text Fallback):
                        </label>
                        <textarea
                          rows={2}
                          dir={isAutoOutputRtl ? 'rtl' : 'ltr'}
                          value={verifiedPreview.translatedText}
                          onChange={(e) =>
                            setVerifiedPreview((prev) =>
                              prev ? { ...prev, translatedText: e.target.value } : prev
                            )
                          }
                          className={`w-full rounded-lg border border-[#116329] bg-[#0D1117] px-2.5 py-1.5 text-xs text-[#F0F6FC] font-sans leading-relaxed resize-none ${
                            isAutoOutputRtl ? 'text-right' : 'text-left'
                          }`}
                        />
                      </div>
                    </>
                  ) : (
                    autoTranslatedOutput && (
                      <p
                        dir={isAutoOutputRtl ? 'rtl' : 'ltr'}
                        className={`text-xs text-[#F0F6FC] font-sans leading-relaxed ${
                          isAutoOutputRtl ? 'text-right' : 'text-left'
                        }`}
                      >
                        “{autoTranslatedOutput}”
                      </p>
                    )
                  )}

                  {(verifiedPreview?.convertedAudioUrl || convertedAudioUrl) && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-mono text-[#06B6D4] block">
                        Converted {activeThread.dialect} Audio Preview:
                      </span>
                      <audio
                        controls
                        src={verifiedPreview?.convertedAudioUrl || convertedAudioUrl || undefined}
                        className="w-full h-9"
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#161B22] border border-[#30363D] p-3">
                <span className="text-[11px] font-mono text-[#8B949E]">
                  Target: #{activeThread.serialNumber} · {activeThread.ownerName} ({activeThread.targetLocale})
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={
                      isPreviewingVoice ||
                      isProcessingVoice ||
                      (!recordedClip && !founderInputText.trim())
                    }
                    onClick={handlePreviewTranslation}
                    className="min-h-[48px] px-4 py-2.5 border border-[#06B6D4] bg-[#0D1117] hover:bg-[#161B22] disabled:opacity-50 text-[#06B6D4] font-mono font-bold text-xs uppercase rounded-xl transition active:scale-95 flex items-center gap-2"
                  >
                    {isPreviewingVoice ? (
                      <>
                        <RefreshCw className="size-3.5 animate-spin" />
                        <span>Translating...</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="size-3.5" />
                        <span>Translate &amp; Preview</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={
                      isProcessingVoice ||
                      isPreviewingVoice ||
                      (!recordedClip && !founderInputText.trim() && !verifiedPreview)
                    }
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
                        <span>
                          {replySent
                            ? 'Sent Voice + Text ✓'
                            : verifiedPreview
                            ? 'Confirm & Send Reply'
                            : 'Send Reply'}
                        </span>
                      </>
                    )}
                  </button>
                </div>
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
