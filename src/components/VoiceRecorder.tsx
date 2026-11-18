import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';

export interface RecordedOpusClip {
  url: string;
  base64: string;
  mimeType: string;
  sizeBytes: number;
  sizeKb: number;
  durationSec: number;
}

export interface VoiceRecorderHandle {
  stopAndGetClip: () => Promise<RecordedOpusClip | null>;
  isRecording: () => boolean;
}

interface VoiceRecorderProps {
  title?: string;
  subtitle?: string;
  compact?: boolean;
  onUploaded?: (url: string) => void;
  onRecorded?: (clip: RecordedOpusClip) => void;
  onRecordingChange?: (recording: boolean) => void;
}

function selectCompressedOpusMime(): string {
  if (typeof MediaRecorder === 'undefined') return 'audio/webm';
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/ogg;codecs=opus',
    'audio/webm',
    'audio/mp4',
  ];
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) {
      return mime;
    }
  }
  return '';
}

export const VoiceRecorder = React.forwardRef<VoiceRecorderHandle, VoiceRecorderProps>(
  (
    {
      title = 'Compressed Opus Voice Note',
      subtitle = 'Tap to record (~150 KB Opus · 7-day auto-purge · stays private).',
      compact = false,
      onUploaded,
      onRecorded,
      onRecordingChange,
    },
    ref
  ) => {
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const elapsedRef = useRef(0);
    const pendingStopResolveRef = useRef<((clip: RecordedOpusClip | null) => void) | null>(null);
    const lastClipRef = useRef<RecordedOpusClip | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [seconds, setSeconds] = useState(0);
    const [lastClipKb, setLastClipKb] = useState<number | null>(null);
    const [lastClipUrl, setLastClipUrl] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState('');
    const timerRef = useRef<number | null>(null);

    useEffect(() => {
      onRecordingChange?.(isRecording);
    }, [isRecording, onRecordingChange]);

    useEffect(() => {
      return () => {
        if (timerRef.current) window.clearInterval(timerRef.current);
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          try {
            mediaRecorderRef.current.stop();
          } catch {}
        }
      };
    }, []);

    const stopRecording = () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setIsRecording(false);
    };

    useImperativeHandle(ref, () => ({
      isRecording: () =>
        Boolean(mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive'),
      stopAndGetClip: () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          return new Promise<RecordedOpusClip | null>((resolve) => {
            pendingStopResolveRef.current = resolve;
            stopRecording();
            window.setTimeout(() => {
              if (pendingStopResolveRef.current) {
                const r = pendingStopResolveRef.current;
                pendingStopResolveRef.current = null;
                r(lastClipRef.current);
              }
            }, 2500);
          });
        }
        return Promise.resolve(lastClipRef.current);
      },
    }));

    const startRecording = async () => {
      setErrorMsg('');
      if (!navigator.mediaDevices?.getUserMedia) {
        setErrorMsg('Microphone access is unavailable in this browser.');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
          },
        });

        const preferredMime = selectCompressedOpusMime();
        const options: MediaRecorderOptions = {
          audioBitsPerSecond: 20000, // 20 kbps Opus (~150 KB per 60 sec)
        };
        if (preferredMime) {
          options.mimeType = preferredMime;
        }

        const recorder = new MediaRecorder(stream, options);
        audioChunksRef.current = [];
        mediaRecorderRef.current = recorder;
        elapsedRef.current = 0;

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        recorder.onstop = async () => {
          stream.getTracks().forEach((track) => track.stop());
          const resolvedMime = recorder.mimeType || preferredMime || 'audio/webm;codecs=opus';
          const audioBlob = new Blob(audioChunksRef.current, { type: resolvedMime });
          const localUrl = URL.createObjectURL(audioBlob);
          const sizeBytes = audioBlob.size;
          const sizeKb = Math.max(1, Math.round(sizeBytes / 1024));
          setLastClipKb(sizeKb);
          setLastClipUrl(localUrl);

          let base64 = '';
          try {
            const reader = new FileReader();
            base64 = await new Promise<string>((resolve) => {
              reader.onloadend = () => {
                const res = typeof reader.result === 'string' ? reader.result : '';
                const commaIdx = res.indexOf(',');
                resolve(commaIdx >= 0 ? res.slice(commaIdx + 1) : res);
              };
              reader.onerror = () => resolve('');
              reader.readAsDataURL(audioBlob);
            });
          } catch {
            base64 = '';
          }

          const clip: RecordedOpusClip = {
            url: localUrl,
            base64,
            mimeType: resolvedMime,
            sizeBytes,
            sizeKb,
            durationSec: Math.max(1, elapsedRef.current),
          };
          lastClipRef.current = clip;

          onUploaded?.(localUrl);
          onRecorded?.(clip);
          if (pendingStopResolveRef.current) {
            const r = pendingStopResolveRef.current;
            pendingStopResolveRef.current = null;
            r(clip);
          }
        };

        recorder.start(250);
        setSeconds(0);
        setIsRecording(true);

        timerRef.current = window.setInterval(() => {
          elapsedRef.current += 1;
          setSeconds((prev) => {
            if (prev >= 59) {
              stopRecording();
              return 60;
            }
            return prev + 1;
          });
        }, 1000);
      } catch {
        setErrorMsg('Microphone permission was not granted.');
      }
    };

    return (
      <div className={`rounded-xl border border-[#30363D] bg-[#0D1117] ${compact ? 'p-3' : 'p-4'}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold text-[#F0F6FC] font-mono">{title}</p>
            <p className="mt-1 text-[11px] text-[#8B949E] font-sans leading-snug">
              {subtitle}
              {lastClipKb !== null && !isRecording && (
                <span className="ml-1.5 text-[#3FB950] font-mono font-bold">
                  · Ready ({lastClipKb} KB Opus)
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            aria-label={isRecording ? 'Stop voice recording' : 'Start voice recording'}
            className={`grid size-12 min-h-[48px] min-w-[48px] shrink-0 place-items-center rounded-full transition active:scale-95 ${
              isRecording
                ? 'bg-[#F85149] text-[#0D1117]'
                : 'bg-[#06B6D4] hover:bg-[#22D3EE] text-[#0D1117]'
            }`}
          >
            {isRecording ? <Square className="size-4" /> : <Mic className="size-5" />}
          </button>
        </div>

        {isRecording && (
          <p className="mt-2.5 text-[11px] font-mono font-bold text-[#F85149]">
            Recording Opus {String(seconds).padStart(2, '0')} / 60 sec — tap Square OR Send directly
          </p>
        )}

        {lastClipUrl && !isRecording && (
          <div className="mt-2.5 flex items-center gap-2">
            <audio controls src={lastClipUrl} className="h-8 w-full max-w-xs" preload="metadata" />
          </div>
        )}

        {errorMsg && (
          <p className="mt-2.5 text-[11px] font-mono text-[#F85149]">{errorMsg}</p>
        )}
      </div>
    );
  }
);
VoiceRecorder.displayName = 'VoiceRecorder';
