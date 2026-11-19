export const config = {
  runtime: 'edge',
};

const AUDIT_EXPIRES_AT_ISO = '2026-11-19T21:14:20Z';
const AUDIT_EXPIRES_AT_MS = Date.parse(AUDIT_EXPIRES_AT_ISO);

export default function handler(): Response {
  const auditOpen = Date.now() < AUDIT_EXPIRES_AT_MS;

  const body = auditOpen
    ? [
        '# WorkCraft Local - Temporary 24-Hour Public & AI Audit Window',
        `# Active until ${AUDIT_EXPIRES_AT_ISO} (automatically reverts to Disallow after expiry)`,
        'User-agent: *',
        'Allow: /',
        'Allow: /llms.txt',
      ].join('\n')
    : [
        '# WorkCraft Local - Protected Production Portal',
        '# 24-hour public audit window expired; crawler access restricted.',
        'User-agent: *',
        'Disallow: /',
      ].join('\n');

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    },
  });
}
