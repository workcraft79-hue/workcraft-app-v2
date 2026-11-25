// server/voiceTranslator.ts
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${Math.round(ms / 1e3)}s.`));
    }, ms);
    promise.then((val) => {
      clearTimeout(timer);
      resolve(val);
    }).catch((err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}
var LOCALE_TO_EDGE_VOICE = {
  "ar-AE": "ar-AE-HamdanNeural",
  "ur-PK": "ur-PK-AsadNeural",
  "en-US": "en-US-AndrewNeural"
};
var LOCALE_TO_GEMINI_VOICE = {
  "ar-AE": "Charon",
  "ur-PK": "Charon",
  "en-US": "Kore"
};
var LOCALE_TO_DIALECT_LABEL = {
  "ar-AE": "Gulf Arabic",
  "ur-PK": "Standard Urdu",
  "en-US": "English"
};
function resolveTargetLocale(targetLocale, targetDialect) {
  const normLocale = (targetLocale || "").trim().toLowerCase();
  const normDialect = (targetDialect || "").trim().toLowerCase();
  if (normLocale.startsWith("ar") || normDialect.includes("arabic")) {
    return "ar-AE";
  }
  if (normLocale.startsWith("ur") || normDialect.includes("urdu") || normDialect.includes("punjabi")) {
    return "ur-PK";
  }
  if (normLocale.startsWith("en") || normDialect.includes("english")) {
    return "en-US";
  }
  return "ur-PK";
}
function detectTextLanguageLabel(text) {
  if (/[\u0679\u067E\u0686\u0688\u0691\u0698\u06BA\u06BE\u06C1\u06D2]/.test(text)) {
    return "Urdu";
  }
  if (/[\u0600-\u06FF]/.test(text)) {
    return "Arabic";
  }
  return "English / Auto";
}
function createGeminiClient(apiKey) {
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build"
      }
    }
  });
}
function formatGeminiError(err) {
  const raw = err instanceof Error ? err.message : String(err || "");
  if (/API_KEY_INVALID|PERMISSION_DENIED|401|403/i.test(raw)) {
    return "Gemini API key is invalid or unauthorized. Please verify GEMINI_API_KEY in Settings > Secrets.";
  }
  if (/RESOURCE_EXHAUSTED|429|quota/i.test(raw)) {
    return "Gemini API rate/daily free-tier limit reached. Wait ~60 seconds or attach a pay-as-you-go GEMINI_API_KEY in Settings > Secrets.";
  }
  if (/timed out|timeout/i.test(raw)) {
    return "Voice translation took too long on the server. Please try a shorter clip (3\u201315s) or tap Retry.";
  }
  return raw ? `Voice translation upstream error: ${raw.slice(0, 180)}` : "Voice translation upstream error.";
}
async function synthesizeGeminiTts(ai, text, targetLocale) {
  const prebuiltVoice = LOCALE_TO_GEMINI_VOICE[targetLocale];
  const displayVoiceName = `Gemini ${prebuiltVoice} (${targetLocale})`;
  const cleanText = text.trim().slice(0, 1200);
  if (!cleanText) {
    return { audioBase64: null, voiceName: displayVoiceName, ttsSource: "unavailable", ttsError: "Empty speech text." };
  }
  const styleHint = targetLocale === "ur-PK" ? "Speak clearly in natural, warm Pakistani Urdu pronunciation for a salon owner." : targetLocale === "ar-AE" ? "Speak clearly in natural, warm Gulf Arabic pronunciation for a salon owner." : "Speak clearly in natural, warm English pronunciation.";
  try {
    const response = await withTimeout(
      ai.models.generateContent({
        model: "gemini-3.8-flash-lite-tts",
        contents: [
          {
            role: "user",
            parts: [
              {
                text: cleanText,
                speechMetadata: {
                  style: styleHint
                }
              }
            ]
          }
        ],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: prebuiltVoice }
            }
          }
        }
      }),
      15e3,
      "Gemini TTS"
    );
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio && base64Audio.length > 0) {
      return {
        audioBase64: base64Audio,
        voiceName: displayVoiceName,
        ttsSource: "gemini-tts"
      };
    }
    return {
      audioBase64: null,
      voiceName: displayVoiceName,
      ttsSource: "unavailable",
      ttsError: "Gemini TTS returned no audio data."
    };
  } catch (err) {
    return {
      audioBase64: null,
      voiceName: displayVoiceName,
      ttsSource: "unavailable",
      ttsError: err instanceof Error ? err.message : "Gemini TTS failed."
    };
  }
}
var LOCALE_BACKUP_EDGE_VOICE = {
  "ar-AE": "ar-SA-HamedNeural",
  "ur-PK": "ur-PK-UzmaNeural",
  "en-US": "en-US-GuyNeural"
};
async function synthesizeEdgeTtsInMemory(text, targetLocale) {
  const primaryVoice = LOCALE_TO_EDGE_VOICE[targetLocale];
  const backupVoice = LOCALE_BACKUP_EDGE_VOICE[targetLocale];
  const cleanText = text.trim().slice(0, 1500);
  if (!cleanText) {
    return { audioBase64: null, voiceName: primaryVoice, ttsSource: "unavailable", ttsError: "Empty speech text." };
  }
  const attemptVoice = async (voiceName) => {
    const tts = new MsEdgeTTS({
      connectionTimeoutMs: 5e3,
      synthesisTimeoutMs: 8e3
    });
    try {
      await tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
      const { audioStream } = tts.toStream(cleanText);
      return await new Promise((resolve, reject) => {
        const chunks = [];
        let settled = false;
        const timeout = setTimeout(() => {
          if (!settled) {
            settled = true;
            reject(new Error("Edge TTS stream timed out."));
          }
        }, 8500);
        audioStream.on("data", (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        audioStream.on("end", () => {
          clearTimeout(timeout);
          if (!settled) {
            settled = true;
            resolve(Buffer.concat(chunks));
          }
        });
        audioStream.on("error", (err) => {
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
      }
    }
  };
  let lastErr = "Edge TTS synthesis failed.";
  for (const voiceName of [primaryVoice, backupVoice]) {
    try {
      const buffer = await attemptVoice(voiceName);
      if (buffer.length > 0) {
        return {
          audioBase64: buffer.toString("base64"),
          voiceName,
          ttsSource: "msedge-tts"
        };
      }
      lastErr = "Empty audio buffer from Edge TTS.";
    } catch (err) {
      lastErr = err instanceof Error ? err.message : "Edge TTS synthesis failed.";
    }
  }
  return {
    audioBase64: null,
    voiceName: primaryVoice,
    ttsSource: "unavailable",
    ttsError: lastErr
  };
}
async function translateAndSynthesizeVoice(req) {
  const targetLocale = resolveTargetLocale(req.targetLocale, req.targetDialect);
  const targetDialect = req.targetDialect?.trim() || LOCALE_TO_DIALECT_LABEL[targetLocale];
  const cleanAudioBase64 = (req.audioBase64 || "").replace(/^data:[^;]+;base64,/, "").trim();
  const cleanAudioMime = (req.audioMimeType || "audio/webm;codecs=opus").split(";")[0].trim() || "audio/webm";
  const cleanText = (req.text || "").trim().slice(0, 1e3);
  const localeInstruction = targetLocale === "ar-AE" ? "Natural conversational Gulf Arabic (UAE/Saudi salon style) in Arabic script (\u0627\u0644\u0639\u0631\u0628\u064A\u0629). Translate EVERY detail accurately without omitting names, numbers, or instructions. Do not include transliteration." : targetLocale === "ur-PK" ? "Natural polite Pakistani Urdu in Urdu script (\u0627\u0631\u062F\u0648). Translate EVERY detail accurately without omitting names, numbers, or instructions. Keep it clear and conversational for a salon owner." : "Clear, polite natural English. Translate EVERY detail accurately without omitting names, numbers, or instructions.";
  const apiKey = (process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) {
    if (cleanText && !cleanAudioBase64) {
      const edgeTts2 = await synthesizeEdgeTtsInMemory(cleanText, targetLocale);
      return {
        transcript: cleanText,
        detectedInputLanguage: detectTextLanguageLabel(cleanText),
        targetLocale,
        targetDialect,
        translatedText: cleanText,
        voiceName: edgeTts2.voiceName,
        audioBase64: edgeTts2.audioBase64,
        audioMimeType: "audio/mpeg",
        translationSource: "local-fallback",
        ttsSource: edgeTts2.ttsSource,
        ttsError: edgeTts2.ttsError
      };
    }
    return {
      transcript: cleanText,
      detectedInputLanguage: cleanText ? detectTextLanguageLabel(cleanText) : "Audio",
      targetLocale,
      targetDialect,
      translatedText: "",
      voiceName: LOCALE_TO_EDGE_VOICE[targetLocale],
      audioBase64: null,
      audioMimeType: "audio/mpeg",
      translationSource: "error",
      translationError: "GEMINI_API_KEY is not set on the server. Add GEMINI_API_KEY in Settings > Secrets so live Arabic/Urdu/English voice transcription and translation can run.",
      ttsSource: "unavailable",
      ttsError: "Translation skipped because GEMINI_API_KEY is missing."
    };
  }
  if (!cleanAudioBase64 && !cleanText) {
    return {
      transcript: "",
      detectedInputLanguage: "Unknown",
      targetLocale,
      targetDialect,
      translatedText: "",
      voiceName: LOCALE_TO_EDGE_VOICE[targetLocale],
      audioBase64: null,
      audioMimeType: "audio/mpeg",
      translationSource: "error",
      translationError: "No voice recording or text message provided.",
      ttsSource: "unavailable"
    };
  }
  const ai = createGeminiClient(apiKey);
  let finalTranscript = cleanText;
  let finalTranslated = "";
  let detectedInputLanguage = finalTranscript ? detectTextLanguageLabel(finalTranscript) : "Audio";
  let translationSucceeded = false;
  let lastErrorMsg = "";
  const translationModels = ["gemini-4-hydrogen", "gemini-3.1-flash-lite"];
  for (const modelName of translationModels) {
    try {
      const hasAudio = Boolean(cleanAudioBase64);
      const prompt = hasAudio ? `Listen carefully to the attached voice recording${cleanText ? ` (with additional note: "${cleanText}")` : ""}.
1. Transcribe the exact spoken message verbatim in its original spoken language (Arabic, Urdu, Punjabi, or English). Preserve names, times, and numbers.
2. Detect the spoken input language accurately (e.g., Arabic, Urdu, English, Punjabi).
3. Translate the exact meaning and wording faithfully into: ${localeInstruction}
Do NOT replace the message with generic greetings or omit any details.` : `You are translating a salon communication message verbatim.
1. Return the exact original message as "transcript".
2. Detect the input language accurately (e.g., Arabic, Urdu, English, Roman Urdu, Punjabi).
3. Translate the exact meaning and wording faithfully into: ${localeInstruction}
Do NOT add unrelated boilerplate or omit any numbers, times, or instructions.

Original message: "${finalTranscript}"`;
      const contents = hasAudio ? {
        parts: [
          {
            inlineData: {
              mimeType: cleanAudioMime,
              data: cleanAudioBase64
            }
          },
          { text: prompt }
        ]
      } : prompt;
      const response = await withTimeout(
        ai.models.generateContent({
          model: modelName,
          contents,
          config: {
            ...modelName === "gemini-4-hydrogen" ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {},
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                transcript: {
                  type: Type.STRING,
                  description: "Exact verbatim transcript of the spoken or written input."
                },
                translatedText: {
                  type: Type.STRING,
                  description: "Exact, faithful translation in the requested target locale script."
                },
                detectedSourceLanguage: {
                  type: Type.STRING,
                  description: "Short label of detected input language, e.g., Arabic, Urdu, English, Punjabi."
                }
              },
              required: ["transcript", "translatedText", "detectedSourceLanguage"]
            }
          }
        }),
        2e4,
        "Voice translation"
      );
      const parsed = JSON.parse((response.text ?? "{}").trim());
      if (parsed.translatedText && parsed.translatedText.trim()) {
        finalTranscript = parsed.transcript?.trim() || finalTranscript || "(Recorded Voice Note)";
        finalTranslated = parsed.translatedText.trim();
        detectedInputLanguage = parsed.detectedSourceLanguage?.trim() || detectedInputLanguage;
        translationSucceeded = true;
        break;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      lastErrorMsg = formatGeminiError(err);
      console.warn(`Gemini voice translation (${modelName}) notice:`, msg);
      if (/RESOURCE_EXHAUSTED|429|quota|API_KEY_INVALID|PERMISSION_DENIED|401|403/i.test(msg)) {
        break;
      }
      if (!/not found|404|unsupported|invalid argument|503|unavailable|high demand|overloaded|timed out/i.test(msg)) {
        break;
      }
    }
  }
  if (!translationSucceeded || !finalTranslated) {
    if (cleanText && !cleanAudioBase64) {
      const edgeTts2 = await synthesizeEdgeTtsInMemory(cleanText, targetLocale);
      return {
        transcript: cleanText,
        detectedInputLanguage,
        targetLocale,
        targetDialect,
        translatedText: cleanText,
        voiceName: edgeTts2.voiceName,
        audioBase64: edgeTts2.audioBase64,
        audioMimeType: "audio/mpeg",
        translationSource: "local-fallback",
        ttsSource: edgeTts2.ttsSource,
        ttsError: edgeTts2.ttsError || lastErrorMsg
      };
    }
    return {
      transcript: finalTranscript,
      detectedInputLanguage,
      targetLocale,
      targetDialect,
      translatedText: "",
      voiceName: LOCALE_TO_EDGE_VOICE[targetLocale],
      audioBase64: null,
      audioMimeType: "audio/mpeg",
      translationSource: "error",
      translationError: lastErrorMsg || "Could not transcribe or translate the voice recording. Please try speaking clearly or check your connection.",
      ttsSource: "unavailable"
    };
  }
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
      audioMimeType: "audio/mpeg",
      translationSource: cleanAudioBase64 ? "gemini-audio" : "gemini-text",
      ttsSource: "msedge-tts"
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
      audioMimeType: "audio/wav",
      translationSource: cleanAudioBase64 ? "gemini-audio" : "gemini-text",
      ttsSource: "gemini-tts"
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
    audioMimeType: "audio/mpeg",
    translationSource: cleanAudioBase64 ? "gemini-audio" : "gemini-text",
    ttsSource: "unavailable",
    ttsError: edgeTts.ttsError || geminiTts.ttsError || "Neural audio generation unavailable right now; translated text is ready."
  };
}

// server/voiceInboxStore.ts
import fs from "fs";
import path from "path";

// server/kvBridge.ts
function getKvCredentials() {
  const url = (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "").trim().replace(/\/+$/, "");
  const token = (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();
  if (!url || !token) return null;
  return { url, token };
}
async function kvSetJson(key, value) {
  const creds = getKvCredentials();
  if (!creds) return false;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(creds.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(["SET", key, JSON.stringify(value)]),
      signal: controller.signal
    });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

// server/voiceInboxStore.ts
var SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1e3;
var FREE_TIER_STORAGE_QUOTA_BYTES = 25 * 1024 * 1024;
var FREE_TIER_GEMINI_RPD_LIMIT = 1500;
var ALERT_THRESHOLD_PERCENT = 80;
function resolveStoreFilePath() {
  if (process.env.VERCEL) {
    return path.join("/tmp", "workcraft-voice-inbox.json");
  }
  return path.resolve(process.cwd(), ".data", "voice-inbox.json");
}
function getTodayKey() {
  return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
}
function buildSeedThreads(now) {
  return [
    {
      id: "wc-101",
      serialNumber: "101",
      salonId: "salon-1",
      ownerName: "Hamza",
      salonName: "Seven Cuts Salon",
      city: "Lahore DHA",
      duration: "0:24",
      receivedAgo: "18m ago",
      dialect: "Standard Urdu",
      targetLocale: "ur-PK",
      unread: true,
      transcript: "\u201CSalam Farhan bhai, humara weekend video deal upload kiya tha 58 second ka, check kar lein approved hai ke nahi taake blast schedule ho sake.\u201D",
      speechPlayText: "\u0627\u0644\u0633\u0644\u0627\u0645 \u0639\u0644\u06CC\u06A9\u0645 \u0641\u0631\u062D\u0627\u0646 \u0628\u06BE\u0627\u0626\u06CC\u060C \u06C1\u0645\u0627\u0631\u0627 \u0648\u06CC\u06A9 \u0627\u06CC\u0646\u0688 \u0648\u06CC\u0688\u06CC\u0648 \u0688\u06CC\u0644 58 \u0633\u06CC\u06A9\u0646\u0688 \u06A9\u0627 \u0627\u067E\u0644\u0648\u0688 \u06A9\u06CC\u0627 \u062A\u06BE\u0627\u060C \u0686\u06CC\u06A9 \u06A9\u0631 \u0644\u06CC\u06BA \u0645\u0646\u0638\u0648\u0631 \u06C1\u06D2 \u06CC\u0627 \u0646\u06C1\u06CC\u06BA \u062A\u0627\u06A9\u06C1 \u06A9\u0644 \u0635\u0628\u062D \u0628\u0644\u0627\u0633\u0679 \u0634\u06CC\u0688\u0648\u0644 \u06C1\u0648 \u0633\u06A9\u06D2\u06D4",
      defaultReplySuggestion: "Your 58-second weekend video deal is verified and approved for tomorrow morning broadcast.",
      messages: [
        {
          id: "msg-init-101",
          senderRole: "SALON_OWNER",
          senderLabel: "Hamza \xB7 Seven Cuts Salon",
          originalText: "Salam Farhan bhai, humara weekend video deal upload kiya tha 58 second ka, check kar lein approved hai ke nahi taake blast schedule ho sake.",
          translatedText: "\u0627\u0644\u0633\u0644\u0627\u0645 \u0639\u0644\u06CC\u06A9\u0645 \u0641\u0631\u062D\u0627\u0646 \u0628\u06BE\u0627\u0626\u06CC\u060C \u06C1\u0645\u0627\u0631\u0627 \u0648\u06CC\u06A9 \u0627\u06CC\u0646\u0688 \u0648\u06CC\u0688\u06CC\u0648 \u0688\u06CC\u0644 58 \u0633\u06CC\u06A9\u0646\u0688 \u06A9\u0627 \u0627\u067E\u0644\u0648\u0688 \u06A9\u06CC\u0627 \u062A\u06BE\u0627\u060C \u0686\u06CC\u06A9 \u06A9\u0631 \u0644\u06CC\u06BA \u0645\u0646\u0638\u0648\u0631 \u06C1\u06D2 \u06CC\u0627 \u0646\u06C1\u06CC\u06BA \u062A\u0627\u06A9\u06C1 \u06A9\u0644 \u0635\u0628\u062D \u0628\u0644\u0627\u0633\u0679 \u0634\u06CC\u0688\u0648\u0644 \u06C1\u0648 \u0633\u06A9\u06D2\u06D4",
          detectedInputLanguage: "Urdu / Roman Urdu",
          targetLocale: "ur-PK",
          sizeBytes: 142 * 1024,
          createdAtMs: now - 18 * 60 * 1e3,
          expiresAtMs: now - 18 * 60 * 1e3 + SEVEN_DAYS_MS
        }
      ]
    },
    {
      id: "wc-102",
      serialNumber: "102",
      salonId: "salon-5",
      ownerName: "Ayesha",
      salonName: "Noor Beauty Lounge",
      city: "Karachi Clifton",
      duration: "0:19",
      receivedAgo: "42m ago",
      dialect: "Standard Urdu",
      targetLocale: "ur-PK",
      unread: true,
      transcript: "\u201C\u0641\u0631\u0627\u0626\u06CC\u0688\u06D2 \u0628\u0631\u0627\u0626\u06CC\u0688\u0644 \u0688\u0633\u06A9\u0627\u0624\u0646\u0679 \u067E\u06CC\u06A9\u06CC\u062C \u0631\u06CC\u0679 \u0633\u0633\u0679\u0645 \u0645\u06CC\u06BA \u0627\u067E\u0688\u06CC\u0679 \u06C1\u0648 \u06AF\u06CC\u0627 \u06C1\u06D2\u061F \u06A9\u0633\u0679\u0645\u0631 \u067E\u0648\u0686\u06BE \u0631\u06C1\u06D2 \u06C1\u06CC\u06BA\u06D4\u201D",
      speechPlayText: "\u0641\u0631\u0627\u0626\u06CC\u0688\u06D2 \u0628\u0631\u0627\u0626\u06CC\u0688\u0644 \u0688\u0633\u06A9\u0627\u0624\u0646\u0679 \u067E\u06CC\u06A9\u06CC\u062C \u0631\u06CC\u0679 \u0633\u0633\u0679\u0645 \u0645\u06CC\u06BA \u0627\u067E\u0688\u06CC\u0679 \u06C1\u0648 \u06AF\u06CC\u0627 \u06C1\u06D2\u061F \u06A9\u0633\u0679\u0645\u0631 \u067E\u0648\u0686\u06BE \u0631\u06C1\u06D2 \u06C1\u06CC\u06BA\u06D4",
      defaultReplySuggestion: "Yes Ayesha, your Friday bridal discount package rates are updated and live in WhatsApp.",
      messages: [
        {
          id: "msg-init-102",
          senderRole: "SALON_OWNER",
          senderLabel: "Ayesha \xB7 Noor Beauty Lounge",
          originalText: "\u0641\u0631\u0627\u0626\u06CC\u0688\u06D2 \u0628\u0631\u0627\u0626\u06CC\u0688\u0644 \u0688\u0633\u06A9\u0627\u0624\u0646\u0679 \u067E\u06CC\u06A9\u06CC\u062C \u0631\u06CC\u0679 \u0633\u0633\u0679\u0645 \u0645\u06CC\u06BA \u0627\u067E\u0688\u06CC\u0679 \u06C1\u0648 \u06AF\u06CC\u0627 \u06C1\u06D2\u061F \u06A9\u0633\u0679\u0645\u0631 \u067E\u0648\u0686\u06BE \u0631\u06C1\u06D2 \u06C1\u06CC\u06BA\u06D4",
          translatedText: "\u0641\u0631\u0627\u0626\u06CC\u0688\u06D2 \u0628\u0631\u0627\u0626\u06CC\u0688\u0644 \u0688\u0633\u06A9\u0627\u0624\u0646\u0679 \u067E\u06CC\u06A9\u06CC\u062C \u0631\u06CC\u0679 \u0633\u0633\u0679\u0645 \u0645\u06CC\u06BA \u0627\u067E\u0688\u06CC\u0679 \u06C1\u0648 \u06AF\u06CC\u0627 \u06C1\u06D2\u061F \u06A9\u0633\u0679\u0645\u0631 \u067E\u0648\u0686\u06BE \u0631\u06C1\u06D2 \u06C1\u06CC\u06BA\u06D4",
          detectedInputLanguage: "Urdu",
          targetLocale: "ur-PK",
          sizeBytes: 118 * 1024,
          createdAtMs: now - 42 * 60 * 1e3,
          expiresAtMs: now - 42 * 60 * 1e3 + SEVEN_DAYS_MS
        }
      ]
    },
    {
      id: "wc-103",
      serialNumber: "103",
      salonId: "salon-3",
      ownerName: "Bilal",
      salonName: "The Groom Room",
      city: "Islamabad F-7",
      duration: "0:21",
      receivedAgo: "1h ago",
      dialect: "Standard Urdu",
      targetLocale: "ur-PK",
      unread: false,
      transcript: "\u201CAssalamu Alaikum sir, sade 2 barbers de slot timings update karanay si Friday layi, system vich save ho jange?\u201D",
      speechPlayText: "\u0627\u0644\u0633\u0644\u0627\u0645 \u0639\u0644\u06CC\u06A9\u0645 \u0633\u0631\u060C \u06C1\u0645\u0627\u0631\u06D2 \u062F\u0648 \u0628\u0627\u0631\u0628\u0631\u0632 \u06A9\u06D2 \u0641\u0631\u0627\u0626\u06CC\u0688\u06D2 \u0633\u0644\u0627\u0679 \u0679\u0627\u0626\u0645\u0646\u06AF\u0632 \u0627\u067E\u0688\u06CC\u0679 \u06A9\u0631\u0646\u06D2 \u062A\u06BE\u06D2\u060C \u06A9\u06CC\u0627 \u0633\u0633\u0679\u0645 \u0645\u06CC\u06BA \u0633\u06CC\u0648 \u06C1\u0648 \u062C\u0627\u0626\u06CC\u06BA \u06AF\u06D2\u061F",
      defaultReplySuggestion: "Yes Bilal, update both barber schedules inside Manage -> Staff & Barbers and slots sync automatically.",
      messages: [
        {
          id: "msg-init-103",
          senderRole: "SALON_OWNER",
          senderLabel: "Bilal \xB7 The Groom Room",
          originalText: "Assalamu Alaikum sir, sade 2 barbers de slot timings update karanay si Friday layi, system vich save ho jange?",
          translatedText: "\u0627\u0644\u0633\u0644\u0627\u0645 \u0639\u0644\u06CC\u06A9\u0645 \u0633\u0631\u060C \u06C1\u0645\u0627\u0631\u06D2 \u062F\u0648 \u0628\u0627\u0631\u0628\u0631\u0632 \u06A9\u06D2 \u0641\u0631\u0627\u0626\u06CC\u0688\u06D2 \u0633\u0644\u0627\u0679 \u0679\u0627\u0626\u0645\u0646\u06AF\u0632 \u0627\u067E\u0688\u06CC\u0679 \u06A9\u0631\u0646\u06D2 \u062A\u06BE\u06D2\u060C \u06A9\u06CC\u0627 \u0633\u0633\u0679\u0645 \u0645\u06CC\u06BA \u0633\u06CC\u0648 \u06C1\u0648 \u062C\u0627\u0626\u06CC\u06BA \u06AF\u06D2\u061F",
          detectedInputLanguage: "Punjabi / Roman Urdu",
          targetLocale: "ur-PK",
          sizeBytes: 126 * 1024,
          createdAtMs: now - 60 * 60 * 1e3,
          expiresAtMs: now - 60 * 60 * 1e3 + SEVEN_DAYS_MS
        }
      ]
    },
    {
      id: "wc-104",
      serialNumber: "104",
      salonId: "salon-4",
      ownerName: "Tareq",
      salonName: "Elite Grooming",
      city: "Dubai Marina, UAE",
      duration: "0:27",
      receivedAgo: "2h ago",
      dialect: "Gulf Arabic",
      targetLocale: "ar-AE",
      unread: false,
      transcript: "\u201C\u0645\u0631\u062D\u0628\u0627\u064B\u060C \u0647\u0644 \u062A\u0645 \u062A\u0641\u0639\u064A\u0644 \u0639\u0631\u0636 \u0646\u0647\u0627\u064A\u0629 \u0627\u0644\u0623\u0633\u0628\u0648\u0639 \u0644\u0628\u0627\u0642\u0629 VIP \u0641\u064A \u0627\u0644\u0631\u062F \u0627\u0644\u062A\u0644\u0642\u0627\u0626\u064A \u0639\u0644\u0649 \u0648\u0627\u062A\u0633\u0627\u0628\u061F\u201D",
      speechPlayText: "\u0645\u0631\u062D\u0628\u0627\u064B\u060C \u0647\u0644 \u062A\u0645 \u062A\u0641\u0639\u064A\u0644 \u0639\u0631\u0636 \u0646\u0647\u0627\u064A\u0629 \u0627\u0644\u0623\u0633\u0628\u0648\u0639 \u0644\u0628\u0627\u0642\u0629 VIP \u0641\u064A \u0627\u0644\u0631\u062F \u0627\u0644\u062A\u0644\u0642\u0627\u0626\u064A \u0639\u0644\u0649 \u0648\u0627\u062A\u0633\u0627\u0628\u061F",
      defaultReplySuggestion: "Hello Tareq, your weekend VIP deal is verified and live in WhatsApp auto-replies now.",
      messages: [
        {
          id: "msg-init-104",
          senderRole: "SALON_OWNER",
          senderLabel: "Tareq \xB7 Elite Grooming",
          originalText: "\u0645\u0631\u062D\u0628\u0627\u064B\u060C \u0647\u0644 \u062A\u0645 \u062A\u0641\u0639\u064A\u0644 \u0639\u0631\u0636 \u0646\u0647\u0627\u064A\u0629 \u0627\u0644\u0623\u0633\u0628\u0648\u0639 \u0644\u0628\u0627\u0642\u0629 VIP \u0641\u064A \u0627\u0644\u0631\u062F \u0627\u0644\u062A\u0644\u0642\u0627\u0626\u064A \u0639\u0644\u0649 \u0648\u0627\u062A\u0633\u0627\u0628\u061F",
          translatedText: "\u0645\u0631\u062D\u0628\u0627\u064B\u060C \u0647\u0644 \u062A\u0645 \u062A\u0641\u0639\u064A\u0644 \u0639\u0631\u0636 \u0646\u0647\u0627\u064A\u0629 \u0627\u0644\u0623\u0633\u0628\u0648\u0639 \u0644\u0628\u0627\u0642\u0629 VIP \u0641\u064A \u0627\u0644\u0631\u062F \u0627\u0644\u062A\u0644\u0642\u0627\u0626\u064A \u0639\u0644\u0649 \u0648\u0627\u062A\u0633\u0627\u0628\u061F",
          detectedInputLanguage: "Arabic",
          targetLocale: "ar-AE",
          sizeBytes: 148 * 1024,
          createdAtMs: now - 120 * 60 * 1e3,
          expiresAtMs: now - 120 * 60 * 1e3 + SEVEN_DAYS_MS
        }
      ]
    }
  ];
}
var storeCache = null;
function persistStore(store) {
  try {
    const filePath = resolveStoreFilePath();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(store, null, 2), "utf8");
  } catch {
  }
  void kvSetJson("wc:voice:v1", store);
}
function loadStore() {
  if (storeCache) {
    sweepExpiredVoiceBlobsInternal(storeCache);
    return storeCache;
  }
  const now = Date.now();
  const filePath = resolveStoreFilePath();
  if (fs.existsSync(filePath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
      if (Array.isArray(parsed.threads) && parsed.threads.length > 0) {
        storeCache = {
          threads: parsed.threads,
          purgedClipCount: Number(parsed.purgedClipCount || 0),
          lastCleanupAt: parsed.lastCleanupAt || new Date(now).toISOString(),
          geminiRequestsToday: Number(parsed.geminiRequestsToday || 2),
          edgeTtsRequestsToday: Number(parsed.edgeTtsRequestsToday || 2),
          usageDayKey: parsed.usageDayKey || getTodayKey(),
          autoAlertWhatsAppSent: Boolean(parsed.autoAlertWhatsAppSent),
          lastHeartbeatMs: Number(parsed.lastHeartbeatMs || now),
          lineSimulatedDown: Boolean(parsed.lineSimulatedDown),
          lineReason: parsed.lineReason || "Connected & Healthy via Central WorkCraft Gateway"
        };
        sweepExpiredVoiceBlobsInternal(storeCache);
        return storeCache;
      }
    } catch {
    }
  }
  storeCache = {
    threads: buildSeedThreads(now),
    purgedClipCount: 0,
    lastCleanupAt: new Date(now).toISOString(),
    geminiRequestsToday: 2,
    edgeTtsRequestsToday: 2,
    usageDayKey: getTodayKey(),
    autoAlertWhatsAppSent: false,
    lastHeartbeatMs: now,
    lineSimulatedDown: false,
    lineReason: "Connected & Healthy via Central WorkCraft Gateway"
  };
  persistStore(storeCache);
  return storeCache;
}
function sweepExpiredVoiceBlobsInternal(store) {
  const now = Date.now();
  const todayKey = getTodayKey();
  if (store.usageDayKey !== todayKey) {
    store.usageDayKey = todayKey;
    store.geminiRequestsToday = 0;
    store.edgeTtsRequestsToday = 0;
    store.autoAlertWhatsAppSent = false;
  }
  let purgedInRun = 0;
  for (const thread of store.threads) {
    const kept = [];
    for (const msg of thread.messages) {
      if (msg.expiresAtMs <= now) {
        purgedInRun += 1;
        continue;
      }
      kept.push(msg);
    }
    thread.messages = kept;
  }
  if (purgedInRun > 0) {
    store.purgedClipCount += purgedInRun;
  }
  store.lastCleanupAt = new Date(now).toISOString();
  return purgedInRun;
}
function recordAiVoiceApiUsage(usedGemini, usedEdgeTts) {
  const store = loadStore();
  if (usedGemini) store.geminiRequestsToday += 1;
  if (usedEdgeTts) store.edgeTtsRequestsToday += 1;
  const meter = getLiveUsageMeter(store);
  if (meter.alertTriggered && !store.autoAlertWhatsAppSent) {
    store.autoAlertWhatsAppSent = true;
    console.warn(`[WORKCRAFT AUTO-ALERT] Free-tier usage crossed 80%: ${meter.usagePercent}% \u2014 WhatsApp alert queued to Founder.`);
  }
  persistStore(store);
  return getLiveUsageMeter(store);
}
function getLiveUsageMeter(existingStore) {
  const store = existingStore || loadStore();
  let activeClipCount = 0;
  let storageUsedBytes = 0;
  for (const thread of store.threads) {
    for (const msg of thread.messages) {
      activeClipCount += 1;
      storageUsedBytes += Math.max(0, Number(msg.sizeBytes || 0));
    }
  }
  const storageUsedKb = Math.round(storageUsedBytes / 1024);
  const storageQuotaKb = Math.round(FREE_TIER_STORAGE_QUOTA_BYTES / 1024);
  const storagePercent = Math.min(
    100,
    Math.round(storageUsedBytes / FREE_TIER_STORAGE_QUOTA_BYTES * 1e3) / 10
  );
  const geminiPercent = Math.min(
    100,
    Math.round(store.geminiRequestsToday / FREE_TIER_GEMINI_RPD_LIMIT * 1e3) / 10
  );
  const usagePercent = Math.max(storagePercent, geminiPercent);
  const alertTriggered = usagePercent >= ALERT_THRESHOLD_PERCENT;
  return {
    monthlyExpenseUsd: 0,
    monthlyExpenseLabel: "$0.00 / mo",
    retentionDays: 7,
    targetClipKb: 150,
    activeClipCount,
    purgedClipCount: store.purgedClipCount,
    storageUsedBytes,
    storageUsedKb,
    storageQuotaKb,
    storagePercent,
    geminiRequestsToday: store.geminiRequestsToday,
    geminiDailyLimit: FREE_TIER_GEMINI_RPD_LIMIT,
    geminiPercent,
    edgeTtsRequestsToday: store.edgeTtsRequestsToday,
    usagePercent,
    alertThresholdPercent: ALERT_THRESHOLD_PERCENT,
    alertTriggered,
    autoAlertWhatsAppSent: store.autoAlertWhatsAppSent || alertTriggered,
    autoAlertMessage: alertTriggered ? `Free-tier threshold warning (${usagePercent}% >= 80%). Oldest clips will auto-purge cleanly at 7 days.` : null,
    lastCleanupAt: store.lastCleanupAt
  };
}

// server/vercelTranslateVoice.ts
async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }
  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buf.length;
    if (totalBytes > 4 * 1024 * 1024) {
      throw new Error("Payload too large.");
    }
    chunks.push(buf);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  return JSON.parse(raw);
}
function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}
async function handler(req, res) {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method Not Allowed. Use POST." });
    return;
  }
  try {
    const body = await readJsonBody(req);
    const text = typeof body.text === "string" ? body.text.trim().slice(0, 1e3) : "";
    const audioBase64 = typeof body.audioBase64 === "string" ? body.audioBase64.trim() : "";
    const audioMimeType = typeof body.audioMimeType === "string" ? body.audioMimeType.trim() : "audio/webm;codecs=opus";
    const targetLocale = typeof body.targetLocale === "string" ? body.targetLocale.trim() : void 0;
    const targetDialect = typeof body.targetDialect === "string" ? body.targetDialect.trim() : void 0;
    if (!text && !audioBase64) {
      sendJson(res, 400, { error: "Either compressed audioBase64 or text is required." });
      return;
    }
    if (audioBase64.length > 3 * 1024 * 1024) {
      sendJson(res, 413, { error: "Voice clip exceeds compressed size limit." });
      return;
    }
    const result = await translateAndSynthesizeVoice({
      audioBase64,
      audioMimeType,
      text,
      targetLocale,
      targetDialect
    });
    const usage = recordAiVoiceApiUsage(
      result.translationSource !== "error",
      result.ttsSource !== "unavailable"
    );
    if (result.translationSource === "error") {
      sendJson(res, 503, {
        ...result,
        error: result.translationError || "Voice translation & TTS synthesis failed.",
        usage
      });
      return;
    }
    sendJson(res, 200, { ...result, usage });
  } catch (err) {
    console.error("Vercel /api/translate-voice error:", err);
    sendJson(res, 500, { error: "Voice translation & TTS synthesis failed." });
  }
}
export {
  handler as default
};
