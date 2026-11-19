export const config = {
  runtime: 'edge',
};

const FOUNDER_PIN_SHA256 = 'd9c0ad4c45814b38c9f92098f09ac965c7b8000c2943c04edf140c46f32f269f';

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ valid: false }), {
      status: 405,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  try {
    const body = (await request.json()) as { pin?: string };
    const normalized = (body?.pin || '').trim().toUpperCase();
    if (!normalized) {
      return new Response(JSON.stringify({ valid: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }

    const encoded = new TextEncoder().encode(normalized);
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
    const hex = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    return new Response(JSON.stringify({ valid: hex === FOUNDER_PIN_SHA256 }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return new Response(JSON.stringify({ valid: false }), {
      status: 400,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
}
