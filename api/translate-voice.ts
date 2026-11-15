import type { IncomingMessage, ServerResponse } from 'http';
import { translateAndSynthesizeVoice } from '../server/voiceTranslator';

export const config = {
  runtime: 'nodejs',
  maxDuration: 30,
};

interface JsonRequest extends IncomingMessage {
  body?: Record<string, unknown>;
}

async function readJsonBody(req: JsonRequest): Promise<Record<string, unknown>> {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buf.length;
    if (totalBytes > 4 * 1024 * 1024) {
      throw new Error('Payload too large.');
    }
    chunks.push(buf);
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  return JSON.parse(raw) as Record<string, unknown>;
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

export default async function handler(req: JsonRequest, res: ServerResponse) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method Not Allowed. Use POST.' });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const text = typeof body.text === 'string' ? body.text.trim().slice(0, 1000) : '';
    const audioBase64 = typeof body.audioBase64 === 'string' ? body.audioBase64.trim() : '';
    const audioMimeType =
      typeof body.audioMimeType === 'string' ? body.audioMimeType.trim() : 'audio/webm;codecs=opus';
    const targetLocale = typeof body.targetLocale === 'string' ? body.targetLocale.trim() : undefined;
    const targetDialect = typeof body.targetDialect === 'string' ? body.targetDialect.trim() : undefined;

    if (!text && !audioBase64) {
      sendJson(res, 400, { error: 'Either compressed audioBase64 or text is required.' });
      return;
    }

    if (audioBase64.length > 3 * 1024 * 1024) {
      sendJson(res, 413, { error: 'Voice clip exceeds compressed size limit.' });
      return;
    }

    const result = await translateAndSynthesizeVoice({
      audioBase64,
      audioMimeType,
      text,
      targetLocale,
      targetDialect,
    });

    sendJson(res, 200, result);
  } catch (err) {
    console.error('Vercel /api/translate-voice error:', err);
    sendJson(res, 500, { error: 'Voice translation & TTS synthesis failed.' });
  }
}
