import React, { useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';

interface VoiceRecorderProps {
  onUploaded?: (url: string) => void;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ onUploaded }) => {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);
  };

  const startRecording = async () => {
    setErrorMsg('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorMsg('Microphone access is unavailable in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const localUrl = URL.createObjectURL(audioBlob);
        
        // Pass audio url to callback
        onUploaded?.(localUrl);
      };

      recorder.start();
      setSeconds(0);
      setIsRecording(true);

      timerRef.current = setInterval(() => {
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
    <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black text-[#F0F6FC]">In-Portal Voice Support</p>
          <p className="mt-1 text-[10px] text-[#8B949E]">
            Hold to record up to 60 seconds. Your number stays private.
          </p>
        </div>
        <button
          onClick={isRecording ? stopRecording : startRecording}
          aria-label={isRecording ? 'Stop voice recording' : 'Start voice recording'}
          className={`grid size-12 min-h-[48px] min-w-[48px] shrink-0 place-items-center rounded-full transition-transform active:scale-95 ${
            isRecording
              ? 'bg-[#F85149] text-[#0D1117]'
              : 'bg-[#06B6D4] hover:bg-[#22D3EE] text-[#0D1117]'
          }`}
        >
          {isRecording ? <Square className="size-4" /> : <Mic className="size-5" />}
        </button>
      </div>

      {isRecording && (
        <p className="mt-3 text-[10px] font-black text-[#F85149]">
          Recording {String(seconds).padStart(2, '0')} / 60 sec
        </p>
      )}

      {errorMsg && (
        <p className="mt-3 text-[10px] text-[#F85149]">{errorMsg}</p>
      )}
    </div>
  );
};
