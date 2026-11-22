import type { IncomingMessage, ServerResponse } from 'http';
import { createApiApp } from '../server/app.js';

const app = createApiApp();

function restoreApiRequestUrl(req: IncomingMessage): void {
  try {
    const rawUrl = req.url || '/';
    const parsed = new URL(rawUrl, 'http://localhost');
    if (parsed.searchParams.has('__wc_path')) {
      const subPath = (parsed.searchParams.get('__wc_path') || '').replace(/^\/+/, '');
      parsed.searchParams.delete('__wc_path');
      const qs = parsed.searchParams.toString();
      req.url = `/api/${subPath}${qs ? `?${qs}` : ''}`;
    }
  } catch {
    // keep original req.url on malformed input
  }
}

export default function handler(req: IncomingMessage, res: ServerResponse) {
  restoreApiRequestUrl(req);
  return app(req as Parameters<typeof app>[0], res as Parameters<typeof app>[1]);
}
