import type { IncomingMessage, ServerResponse } from 'http';
import { createApiApp } from '../server/app.js';

export const config = {
  runtime: 'nodejs',
  maxDuration: 30,
};

const app = createApiApp();

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return app(req as Parameters<typeof app>[0], res as Parameters<typeof app>[1]);
}
