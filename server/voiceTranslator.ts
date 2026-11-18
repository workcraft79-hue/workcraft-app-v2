import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s.`));
    }, ms);
    promise
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export type SupportedVoiceLocale = 'ar-AE' | 'ur-PK' | 'en-US';

export interface VoiceTranslationRequest {
  audioBase64?: string;
  audioMimeType?: string;
  text?: string;
  targetLocale?: string;
  targetDialect?: string;
}

export interface VoiceTranslationResult {
  transcript: string;
  detectedInputLanguage: string;
  targetLocale: SupportedVoiceLocale;
  targetDialect: string;
  translatedText: string;
  voiceName: string;
  audioBase64: string | null;
  audioMimeType: string;
  translationSource: 'gemini-audio' | 'gemini-text' | 'error';
  translationError?: string;
  ttsSource: 'gemini-tts' | 'msedge-tts' | 'unavailable';
  ttsError?: string;
}

const LOCALE_TO_EDGE_VOICE: Record<SupportedVoiceLocale, string> = {
  'ar-AE': 'ar-AE-HamdanNeural',
  'ur-PK': 'ur-PK-AsadNeural',
  'en-US': 'en-US-AndrewNeural',
};

const LOCALE_TO_GEMINI_VOICE: Record<SupportedVoiceLocale, string> = {
  'ar-AE': 'Charon',
  'ur-PK': 'Charon',
  'en-US': 'Kore',
};

const LOCALE_TO_DIALECT_LABEL: Record<SupportedVoiceLocale, string> = {
  'ar-AE': 'Gulf Arabic',
  'ur-PK': 'Standard Urdu',
  'en-US': 'English',
};

export function resolveTargetLocale(
  targetLocale?: string,
  targetDialect?: string
): SupportedVoiceLocale {
  const normLocale = (targetLocale || '').trim().toLowerCase();
  const normDialect = (targetDialect || '').trim().toLowerCase();

  if (normLocale.startsWith('ar') || normDialect.includes('arabic')) {
    return 'ar-AE';
  }
  if (
    normLocale.startsWith('ur') ||
    normDialect.includes('urdu') ||
    normDialect.includes('punjabi')
  ) {
    return 'ur-PK';
  }
  if (normLocale.startsWith('en') || normDialect.includes('english')) {
    return 'en-US';
  }
  return 'ur-PK';
}

function detectTextLanguageLabel(text: string): string {
  if (/[\u0679\u067E\u0686\u0688\u0691\u0698\u06BA\u06BE\u06C1\u06D2]/.test(text)) {
    return 'Urdu';
  }
  if (/[\u0600-\u06FF]/.test(text)) {
    return 'Arabic';
  }
  return 'English / Auto';
}

function createGeminiClient(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function formatGeminiError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err || '');
  if (/API_KEY_INVALID|PERMISSION_DENIED|401|403/i.test(raw)) {
    return 'Gemini API key is invalid or unauthorized. Please verify GEMINI_API_KEY in Settings > Secrets.';
  }
  if (/RESOURCE_EXHAUSTED|429|quota/i.test(raw)) {
    return 'Gemini API rate/daily free-tier limit reached. Wait ~60 seconds or attach a pay-as-you-go GEMINI_API_KEY in Settings > Secrets.';
  }
  if (/timed out|timeout/i.test(raw)) {
    return 'Voice translation took too long on the server. Please try a shorter clip (3–15s) or tap Retry.';
  }
  return raw ? `Voice translation upstream error: ${raw.slice(0, 180)}` : 'Voice translation upstream error.';
}

async function synthesizeGeminiTts(
  ai: GoogleGenAI,
  text: string,
  targetLocale: SupportedVoiceLocale
): Promise<{ audioBase64: string | null; voiceName: string; ttsSource: 'gemini-tts' | 'unavailable'; ttsError?: string }> {
  const prebuiltVoice = LOCALE_TO_GEMINI_VOICE[targetLocale];
  const displayVoiceName = `Gemini ${prebuiltVoice} (${targetLocale})`;
  const cleanText = text.trim().slice(0, 1200);
  if (!cleanText) {
    return { audioBase64: null, voiceName: displayVoiceName, ttsSource: 'unavailable', ttsError: 'Empty speech text.' };
  }

  const styleHint =
    targetLocale === 'ur-PK'
      ? 'Speak clearly in natural, warm Pakistani Urdu pronunciation for a salon owner.'
      : targetLocale === 'ar-AE'
      ? 'Speak clearly in natural, warm Gulf Arabic pronunciation for a salon owner.'
      : 'Speak clearly in natural, warm English pronunciation.';

  try {
    const response = await withTimeout(
      ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: cleanText,
                speechMetadata: {
                  style: styleHint,
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: prebuiltVoice },
            },
          },
        },
      }),
      15000,
      'Gemini TTS'
    );

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio && base64Audio.length > 0) {
      return {
        audioBase64: base64Audio,
        voiceName: displayVoiceName,
        ttsSource: 'gemini-tts',
      };
    }

    return {
      audioBase64: null,
      voiceName: displayVoiceName,
      ttsSource: 'unavailable',
      ttsError: 'Gemini TTS returned no audio data.',
    };
  } catch (err) {
    return {
      audioBase64: null,
      voiceName: displayVoiceName,
      ttsSource: 'unavailable',
      ttsError: err instanceof Error ? err.message : 'Gemini TTS failed.',
    };
  }
}

const LOCALE_BACKUP_EDGE_VOICE: Record<SupportedVoiceLocale, string> = {
  'ar-AE': 'ar-SA-HamedNeural',
  'ur-PK': 'ur-PK-UzmaNeural',
  'en-US': 'en-US-GuyNeural',
};

export async function synthesizeEdgeTtsInMemory(
  text: string,
  targetLocale: SupportedVoiceLocale
): Promise<{ audioBase64: string | null; voiceName: string; ttsSource: 'msedge-tts' | 'unavailable'; ttsError?: string }> {
  const primaryVoice = LOCALE_TO_EDGE_VOICE[targetLocale];
  const backupVoice = LOCALE_BACKUP_EDGE_VOICE[targetLocale];
  const cleanText = text.trim().slice(0, 1500);
  if (!cleanText) {
    return { audioBase64: null, voiceName: primaryVoice, ttsSource: 'unavailable', ttsError: 'Empty speech text.' };
  }

  const attemptVoice = async (voiceName: string): Promise<Buffer> => {
    const tts = new MsEdgeTTS({
      connectionTimeoutMs: 5000,
      synthesisTimeoutMs: 8000,
    });
    try {
      await tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
      const { audioStream } = tts.toStream(cleanText);
      return await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        let settled = false;
        const timeout = setTimeout(() => {
          if (!settled) {
            settled = true;
            reject(new Error('Edge TTS stream timed out.'));
          }
        }, 8500);

        audioStream.on('data', (chunk: Buffer | Uint8Array) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        audioStream.on('end', () => {
          clearTimeout(timeout);
          if (!settled) {
            settled = true;
            resolve(Buffer.concat(chunks));
          }
        });
        audioStream.on('error', (err: Error) => {
          clearTimeout(timeout);
          if (!settled) {
            settled = true;
            reject(err);
          }
        });
      });
    } finally {
      try {
        tts.close();
      } catch {
        // ignore socket cleanup errors
      }
    }
  };

  let lastErr = 'Edge TTS synthesis failed.';
  for (const voiceName of [primaryVoice, backupVoice]) {
    try {
      const buffer = await attemptVoice(voiceName);
      if (buffer.length > 0) {
        return {
          audioBase64: buffer.toString('base64'),
          voiceName,
          ttsSource: 'msedge-tts',
        };
      }
      lastErr = 'Empty audio buffer from Edge TTS.';
    } catch (err) {
      lastErr = err instanceof Error ? err.message : 'Edge TTS synthesis failed.';
    }
  }

  return {
    audioBase64: null,
    voiceName: primaryVoice,
    ttsSource: 'unavailable',
    ttsError: lastErr,
  };
}

export async function transcribeChairIntentAudio(
  audioBase64: string,
  audioMimeType: string,
  ownerLang: 'ur' | 'ar' | 'en'
): Promise<{ transcript: string; error?: string }> {
  const cleanAudioBase64 = (audioBase64 || '').replace(/^data:[^;]+;base64,/, '').trim();
  const cleanAudioMime = (audioMimeType || 'audio/webm').split(';')[0].trim() || 'audio/webm';
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!cleanAudioBase64) {
    return { transcript: '', error: 'No audio recording supplied.' };
  }
  if (!apiKey) {
    return { transcript: '', error: 'GEMINI_API_KEY is not configured.' };
  }

  const ai = createGeminiClient(apiKey);
  const hint =
    ownerLang === 'ur'
      ? 'Expected language: Urdu / English barber names & time durations.'
      : ownerLang === 'ar'
      ? 'Expected language: Arabic / English barber names & time durations.'
      : 'Expected language: English barber names & time durations.';

  try {
    const response = await withTimeout(
      ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: cleanAudioMime,
                data: cleanAudioBase64,
              },
            },
            {
              text: `Transcribe this short salon chair lock voice command verbatim (e.g., "Aslam 30 minutes" or "Hamza 7 to 8 PM"). ${hint} Return ONLY the concise spoken phrase.`,
            },
          ],
        },
      }),
      15000,
      'Chair lock audio'
    );
    return { transcript: (response.text ?? '').trim() };
  } catch (err) {
    return { transcript: '', error: formatGeminiError(err) };
  }
}

export async function translateAndSynthesizeVoice(
  req: VoiceTranslationRequest
): Promise<VoiceTranslationResult> {
  const targetLocale = resolveTargetLocale(req.targetLocale, req.targetDialect);
  const targetDialect = req.targetDialect?.trim() || LOCALE_TO_DIALECT_LABEL[targetLocale];

  const cleanAudioBase64 = (req.audioBase64 || '').replace(/^data:[^;]+;base64,/, '').trim();
  const cleanAudioMime = (req.audioMimeType || 'audio/webm;codecs=opus').split(';')[0].trim() || 'audio/webm';
  const cleanText = (req.text || '').trim().slice(0, 1000);

  const localeInstruction =
    targetLocale === 'ar-AE'
      ? 'Natural conversational Gulf Arabic (UAE/Saudi salon style) in Arabic script (العربية). Translate EVERY detail accurately without omitting names, numbers, or instructions. Do not include transliteration.'
      : targetLocale === 'ur-PK'
      ? 'Natural polite Pakistani Urdu in Urdu script (اردو). Translate EVERY detail accurately without omitting names, numbers, or instructions. Keep it clear and conversational for a salon owner.'
      : 'Clear, polite natural English. Translate EVERY detail accurately without omitting names, numbers, or instructions.';

  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    return {
      transcript: cleanText,
      detectedInputLanguage: cleanText ? detectTextLanguageLabel(cleanText) : 'Audio',
      targetLocale,
      targetDialect,
      translatedText: '',
      voiceName: LOCALE_TO_EDGE_VOICE[targetLocale],
      audioBase64: null,
      audioMimeType: 'audio/mpeg',
      translationSource: 'error',
      translationError:
        'GEMINI_API_KEY is not set on the server. Add GEMINI_API_KEY in Settings > Secrets so live Arabic/Urdu/English voice transcription and translation can run.',
      ttsSource: 'unavailable',
      ttsError: 'Translation skipped because GEMINI_API_KEY is missing.',
    };
  }

  if (!cleanAudioBase64 && !cleanText) {
    return {
      transcript: '',
      detectedInputLanguage: 'Unknown',
      targetLocale,
      targetDialect,
      translatedText: '',
      voiceName: LOCALE_TO_EDGE_VOICE[targetLocale],
      audioBase64: null,
      audioMimeType: 'audio/mpeg',
      translationSource: 'error',
      translationError: 'No voice recording or text message provided.',
      ttsSource: 'unavailable',
    };
  }

  const ai = createGeminiClient(apiKey);
  let finalTranscript = cleanText;
  let finalTranslated = '';
  let detectedInputLanguage = finalTranscript ? detectTextLanguageLabel(finalTranscript) : 'Audio';
  let translationSucceeded = false;
  let lastErrorMsg = '';

  // Single-pass multimodal transcription + translation (1 Gemini call instead of 3 -> 3x lower quota burn & much faster)
  const translationModels = ['gemini-3.1-flash-lite', 'gemini-4-hydrogen'];
  for (const modelName of translationModels) {
    try {
      const hasAudio = Boolean(cleanAudioBase64);
      const prompt = hasAudio
        ? `Listen carefully to the attached voice recording${cleanText ? ` (with additional note: "${cleanText}")` : ''}.
1. Transcribe the exact spoken message verbatim in its original spoken language (Arabic, Urdu, Punjabi, or English). Preserve names, times, and numbers.
2. Detect the spoken input language accurately (e.g., Arabic, Urdu, English, Punjabi).
3. Translate the exact meaning and wording faithfully into: ${localeInstruction}
Do NOT replace the message with generic greetings or omit any details.`
        : `You are translating a salon communication message verbatim.
1. Return the exact original message as "transcript".
2. Detect the input language accurately (e.g., Arabic, Urdu, English, Roman Urdu, Punjabi).
3. Translate the exact meaning and wording faithfully into: ${localeInstruction}
Do NOT add unrelated boilerplate or omit any numbers, times, or instructions.

Original message: "${finalTranscript}"`;

      const contents = hasAudio
        ? {
            parts: [
              {
                inlineData: {
                  mimeType: cleanAudioMime,
                  data: cleanAudioBase64,
                },
              },
              { text: prompt },
            ],
          }
        : prompt;

      const response = await withTimeout(
        ai.models.generateContent({
          model: modelName,
          contents,
          config: {
            ...(modelName === 'gemini-4-hydrogen'
              ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
              : {}),
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                transcript: {
                  type: Type.STRING,
                  description: 'Exact verbatim transcript of the spoken or written input.',
                },
                translatedText: {
                  type: Type.STRING,
                  description: 'Exact, faithful translation in the requested target locale script.',
                },
                detectedSourceLanguage: {
                  type: Type.STRING,
                  description: 'Short label of detected input language, e.g., Arabic, Urdu, English, Punjabi.',
                },
              },
              required: ['transcript', 'translatedText', 'detectedSourceLanguage'],
            },
          },
        }),
        20000,
        'Voice translation'
      );

      const parsed = JSON.parse((response.text ?? '{}').trim()) as {
        transcript?: string;
        translatedText?: string;
        detectedSourceLanguage?: string;
      };

      if (parsed.translatedText && parsed.translatedText.trim()) {
        finalTranscript = parsed.transcript?.trim() || finalTranscript || '(Recorded Voice Note)';
        finalTranslated = parsed.translatedText.trim();
        detectedInputLanguage = parsed.detectedSourceLanguage?.trim() || detectedInputLanguage;
        translationSucceeded = true;
        break;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      lastErrorMsg = formatGeminiError(err);
      console.warn(`Gemini voice translation (${modelName}) notice:`, msg);
      // Do NOT retry on quota/429 or auth errors (avoids double-burning quota)
      if (/RESOURCE_EXHAUSTED|429|quota|API_KEY_INVALID|PERMISSION_DENIED|401|403/i.test(msg)) {
        break;
      }
      if (!/not found|404|unsupported|invalid argument|503|unavailable|high demand|overloaded|timed out/i.test(msg)) {
        break;
      }
    }
  }

  if (!translationSucceeded || !finalTranslated) {
    return {
      transcript: finalTranscript,
      detectedInputLanguage,
      targetLocale,
      targetDialect,
      translatedText: '',
      voiceName: LOCALE_TO_EDGE_VOICE[targetLocale],
      audioBase64: null,
      audioMimeType: 'audio/mpeg',
      translationSource: 'error',
      translationError:
        lastErrorMsg || 'Could not transcribe or translate the voice recording. Please try speaking clearly or check your connection.',
      ttsSource: 'unavailable',
    };
  }

  // Neural Human Speech Synthesis — primary msedge-tts (MP3, zero Gemini quota), secondary gemini-tts
  const edgeTts = await synthesizeEdgeTtsInMemory(finalTranslated, targetLocale);
  if (edgeTts.audioBase64) {
    return {
      transcript: finalTranscript,
      detectedInputLanguage,
      targetLocale,
      targetDialect,
      translatedText: finalTranslated,
      voiceName: edgeTts.voiceName,
      audioBase64: edgeTts.audioBase64,
      audioMimeType: 'audio/mpeg',
      translationSource: cleanAudioBase64 ? 'gemini-audio' : 'gemini-text',
      ttsSource: 'msedge-tts',
    };
  }

  const geminiTts = await synthesizeGeminiTts(ai, finalTranslated, targetLocale);
  if (geminiTts.audioBase64) {
    return {
      transcript: finalTranscript,
      detectedInputLanguage,
      targetLocale,
      targetDialect,
      translatedText: finalTranslated,
      voiceName: geminiTts.voiceName,
      audioBase64: geminiTts.audioBase64,
      audioMimeType: 'audio/wav',
      translationSource: cleanAudioBase64 ? 'gemini-audio' : 'gemini-text',
      ttsSource: 'gemini-tts',
    };
  }

  return {
    transcript: finalTranscript,
    detectedInputLanguage,
    targetLocale,
    targetDialect,
    translatedText: finalTranslated,
    voiceName: edgeTts.voiceName,
    audioBase64: null,
    audioMimeType: 'audio/mpeg',
    translationSource: cleanAudioBase64 ? 'gemini-audio' : 'gemini-text',
    ttsSource: 'unavailable',
    ttsError: edgeTts.ttsError || geminiTts.ttsError || 'Neural audio generation unavailable right now; translated text is ready.',
  };
}
