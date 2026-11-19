export const config = {
  runtime: 'edge',
};

const FOUNDER_PIN_SHA256 = 'd9c0ad4c45814b38c9f92098f09ac965c7b8000c2943c04edf140c46f32f269f';
const SESSION_COOKIE_NAME = 'wc_founder_session';
const EXPECTED_COOKIE_TOKEN = 'wc_founder_d9c0ad4c45814b38c9f92098f09ac965';

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ authenticated: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  try {
    const body = (await request.json()) as { pin?: string };
    const normalized = (body?.pin || '').trim().toUpperCase();
    if (!normalized) {
      return new Response(
        JSON.stringify({ authenticated: false, error: 'Enter your 6-character Founder PIN.' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
          },
        }
      );
    }

    const encoded = new TextEncoder().encode(normalized);
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
    const hex = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    if (hex !== FOUNDER_PIN_SHA256) {
      return new Response(
        JSON.stringify({ authenticated: false, error: 'Incorrect Founder PIN.' }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
          },
        }
      );
    }

    return new Response(
      JSON.stringify({
        authenticated: true,
        user: {
          userRole: 'FOUNDER',
          displayName: 'Founder Command',
        },
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
          'Set-Cookie': `${SESSION_COOKIE_NAME}=${EXPECTED_COOKIE_TOKEN}; Path=/; Max-Age=43200; HttpOnly; Secure; SameSite=Lax`,
        },
      }
    );
  } catch {
    return new Response(
      JSON.stringify({ authenticated: false, error: 'Invalid request.' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      }
    );
  }
}
