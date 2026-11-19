export const config = {
  runtime: 'edge',
};

const AUDIT_STARTED_AT_ISO = '2026-11-18T21:14:20Z';
const AUDIT_EXPIRES_AT_ISO = '2026-11-19T21:14:20Z';
const AUDIT_EXPIRES_AT_MS = Date.parse(AUDIT_EXPIRES_AT_ISO);

export default function handler(): Response {
  const serverNowMs = Date.now();
  const auditOpen = serverNowMs < AUDIT_EXPIRES_AT_MS;

  return new Response(
    JSON.stringify({
      auditOpen,
      serverNowMs,
      startedAtIso: AUDIT_STARTED_AT_ISO,
      expiresAtIso: AUDIT_EXPIRES_AT_ISO,
      expiresAtMs: AUDIT_EXPIRES_AT_MS,
      remainingMs: Math.max(0, AUDIT_EXPIRES_AT_MS - serverNowMs),
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      },
    }
  );
}
