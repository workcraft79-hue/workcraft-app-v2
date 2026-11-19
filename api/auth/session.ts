export const config = {
  runtime: 'edge',
};

const AUDIT_EXPIRES_AT_ISO = '2026-11-19T21:14:20Z';
const AUDIT_EXPIRES_AT_MS = Date.parse(AUDIT_EXPIRES_AT_ISO);
const SESSION_COOKIE_NAME = 'wc_founder_session';
const EXPECTED_COOKIE_TOKEN = 'wc_founder_d9c0ad4c45814b38c9f92098f09ac965';

function hasValidFounderCookie(request: Request): boolean {
  const cookieHeader = request.headers.get('cookie') || '';
  return cookieHeader
    .split(';')
    .map((part) => part.trim())
    .some((part) => part === `${SESSION_COOKIE_NAME}=${EXPECTED_COOKIE_TOKEN}`);
}

export default function handler(request: Request): Response {
  const auditOpen = Date.now() < AUDIT_EXPIRES_AT_MS;
  const hasCookie = hasValidFounderCookie(request);

  if (auditOpen || hasCookie) {
    return new Response(
      JSON.stringify({
        authenticated: true,
        auditOpen,
        expiresAtIso: AUDIT_EXPIRES_AT_ISO,
        user: {
          userRole: 'FOUNDER',
          displayName: auditOpen ? 'Public Audit Preview' : 'Founder Command',
        },
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

  return new Response(
    JSON.stringify({
      authenticated: false,
      auditOpen: false,
      expiresAtIso: AUDIT_EXPIRES_AT_ISO,
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
