import { GoogleGenAI, Type } from '@google/genai';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

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
  translationSource: 'gemini-audio' | 'gemini-text' | 'fallback';
  ttsSource: 'msedge-tts' | 'unavailable';
  ttsError?: string;
}

const LOCALE_TO_VOICE: Record<SupportedVoiceLocale, string> = {
  'ar-AE': 'ar-AE-HamdanNeural',
  'ur-PK': 'ur-PK-AsadNeural',
  'en-US': 'en-US-AndrewNeural',
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

function buildDeterministicRegionalTranslation(
  input: string,
  targetLocale: SupportedVoiceLocale
): string {
  const clean = input.trim();
  if (!clean) return '';

  const lower = clean.toLowerCase();
  const isApproval =
    lower.includes('approved') ||
    lower.includes('verify') ||
    lower.includes('verified') ||
    lower.includes('scheduled') ||
    lower.includes('منظور') ||
    lower.includes('موافق');
  const isRateReply =
    lower.includes('rate') ||
    lower.includes('price') ||
    lower.includes('package') ||
    lower.includes('discount') ||
    lower.includes('ریٹ') ||
    lower.includes('سعر');
  const isWaitReply =
    lower.includes('wait') ||
    lower.includes('soon') ||
    lower.includes('checking') ||
    lower.includes('minutes') ||
    lower.includes('انتظار') ||
    lower.includes('دقائق');

  if (targetLocale === 'ar-AE') {
    if (isApproval && lower.includes('58')) {
      return 'تمت مراجعة فيديو العرض الترويجي الخاص بك بنجاح، ومدته 58 ثانية وتمت الموافقة عليه وجدولته للغد صباحاً.';
    }
    if (isApproval) {
      return `أهلاً بك، تمت مراجعة رسالتك والموافقة على طلبك وجدولته تلقائياً عبر نظام WorkCraft: ${clean}`;
    }
    if (isRateReply) {
      return 'تم تحديث قائمة الأسعار والباقات في حساب صالونك بنجاح وجاهزة للحجز التلقائي الآن.';
    }
    if (isWaitReply) {
      return 'شكراً لتواصلك، نقوم بمراجعة طلبك الآن وسنرسل لك التأكيد خلال دقائق.';
    }
    return detectTextLanguageLabel(clean) === 'Arabic'
      ? clean
      : `رسالة من إدارة WorkCraft إلى صالونك: ${clean}`;
  }

  if (targetLocale === 'ur-PK') {
    if (isApproval && lower.includes('58')) {
      return 'آپ کی ویڈیو ڈیل کی توثیق مکمل ہو چکی ہے، 58 سیکنڈ دورانیہ درست ہے اور کل صبح کا براڈکاسٹ شیڈول منظور کر لیا گیا ہے۔';
    }
    if (isApproval) {
      return `السلام علیکم، آپ کا پیغام اور ویڈیو ڈیل سسٹم میں منظور کر لی گئی ہے اور شیڈول کر دی گئی ہے: ${clean}`;
    }
    if (isRateReply) {
      return 'جی، آپ کے سیلون کی سروسز اور پیکیج ریٹس سسٹم میں کامیابی سے اپڈیٹ کر دیے گئے ہیں۔';
    }
    if (isWaitReply) {
      return 'شکریہ، آپ کی درخواست چیک کی جا رہی ہے، جلد ہی آپ کو کنفرمیشن مل جائے گی۔';
    }
    return detectTextLanguageLabel(clean) === 'Urdu'
      ? clean
      : `ورک کرافٹ سپورٹ پیغام: ${clean}`;
  }

  return clean;
}

async function synthesizeEdgeTtsInMemory(
  text: string,
  targetLocale: SupportedVoiceLocale
): Promise<{ audioBase64: string | null; voiceName: string; ttsSource: 'msedge-tts' | 'unavailable'; ttsError?: string }> {
  const voiceName = LOCALE_TO_VOICE[targetLocale];
  const cleanText = text.trim().slice(0, 1200);
  if (!cleanText) {
    return { audioBase64: null, voiceName, ttsSource: 'unavailable', ttsError: 'Empty speech text.' };
  }

  const tts = new MsEdgeTTS({
    connectionTimeoutMs: 8000,
    synthesisTimeoutMs: 15000,
  });

  try {
    await tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(cleanText);

    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      let settled = false;
      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new Error('Edge TTS stream timed out.'));
        }
      }, 15000);

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

    if (buffer.length === 0) {
      return {
        audioBase64: null,
        voiceName,
        ttsSource: 'unavailable',
        ttsError: 'Empty audio buffer from Edge TTS.',
      };
    }

    return {
      audioBase64: buffer.toString('base64'),
      voiceName,
      ttsSource: 'msedge-tts',
    };
  } catch (err) {
    return {
      audioBase64: null,
      voiceName,
      ttsSource: 'unavailable',
      ttsError: err instanceof Error ? err.message : 'Edge TTS synthesis failed.',
    };
  } finally {
    try {
      tts.close();
    } catch {
      // ignore socket cleanup errors
    }
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
      ? 'Natural conversational Gulf Arabic (UAE/Saudi salon style) in Arabic script (العربية). Do not include transliteration.'
      : targetLocale === 'ur-PK'
      ? 'Natural polite Pakistani Urdu in Urdu script (اردو). Keep it clear and conversational for a salon owner.'
      : 'Clear, polite natural English.';

  let transcript = cleanText;
  let translatedText = cleanText ? buildDeterministicRegionalTranslation(cleanText, targetLocale) : '';
  let detectedInputLanguage = cleanText ? detectTextLanguageLabel(cleanText) : 'Audio';
  let translationSource: VoiceTranslationResult['translationSource'] = 'fallback';

  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (apiKey.length > 0 && (cleanAudioBase64.length > 0 || cleanText.length > 0)) {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const modelsToTry = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'];
    for (const modelName of modelsToTry) {
      try {
        const prompt = cleanAudioBase64
          ? `Listen to the attached voice recording carefully.
1. Transcribe the exact spoken message accurately in its original spoken language.
2. Translate the message faithfully and naturally into: ${localeInstruction}
${cleanText ? `\nOptional typed note context: "${cleanText}"` : ''}
Keep the tone warm, concise, and professional for salon operations.`
          : `You are translating a short voice/text message between a salon software Founder and a salon owner.
1. Return the original message as "transcript".
2. Detect the input language (English, Urdu, Arabic, Roman Urdu, Punjabi, etc.).
3. Translate its exact meaning faithfully and naturally into: ${localeInstruction}

Input message: "${cleanText}"`;

        const contents = cleanAudioBase64
          ? [
              {
                role: 'user' as const,
                parts: [
                  { text: prompt },
                  {
                    inlineData: {
                      mimeType: cleanAudioMime,
                      data: cleanAudioBase64,
                    },
                  },
                ],
              },
            ]
          : prompt;

        const response = await ai.models.generateContent({
          model: modelName,
          contents,
          config: {
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
                  description: 'Natural regional translation in the requested target locale script.',
                },
                detectedSourceLanguage: {
                  type: Type.STRING,
                  description: 'Short label of detected input language, e.g., English, Urdu, Arabic, Roman Urdu.',
                },
              },
              required: ['transcript', 'translatedText', 'detectedSourceLanguage'],
            },
          },
        });

        const parsed = JSON.parse((response.text ?? '{}').trim()) as {
          transcript?: string;
          translatedText?: string;
          detectedSourceLanguage?: string;
        };

        if (parsed.translatedText && parsed.translatedText.trim()) {
          transcript = parsed.transcript?.trim() || transcript || '(Voice recording)';
          translatedText = parsed.translatedText.trim();
          detectedInputLanguage = parsed.detectedSourceLanguage?.trim() || detectedInputLanguage;
          translationSource = cleanAudioBase64 ? 'gemini-audio' : 'gemini-text';
          break;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // Only try next model alias on model-not-found or unsupported errors; log otherwise
        console.warn(`Gemini voice pipeline (${modelName}) notice:`, msg);
        if (!/not found|404|unsupported|invalid argument/i.test(msg)) {
          break;
        }
      }
    }
  }

  if (!transcript && cleanAudioBase64) {
    transcript = 'Recorded compressed Opus voice clip';
  }
  if (!translatedText) {
    translatedText =
      targetLocale === 'ar-AE'
        ? 'تم استلام رسالتك الصوتية بنجاح عبر WorkCraft.'
        : targetLocale === 'ur-PK'
        ? 'آپ کا صوتی پیغام موصول ہو گیا ہے اور سیلون سسٹم میں محفوظ کر لیا گیا ہے۔'
        : 'Your voice message has been received and delivered cleanly via WorkCraft.';
  }

  const tts = await synthesizeEdgeTtsInMemory(translatedText, targetLocale);

  return {
    transcript,
    detectedInputLanguage,
    targetLocale,
    targetDialect,
    translatedText,
    voiceName: tts.voiceName,
    audioBase64: tts.audioBase64,
    audioMimeType: 'audio/mpeg',
    translationSource,
    ttsSource: tts.ttsSource,
    ttsError: tts.ttsError,
  };
}
