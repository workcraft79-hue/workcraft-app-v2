export const config = {
  runtime: 'edge',
};

function getEnv(key: string): string {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  return proc?.env?.[key] || '';
}

function buildWelcomeInteractivePayload(toPhone: string, salonName: string, flowId: string) {
  return {
    messaging_product: 'whatsapp',
    to: toPhone,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: {
        text: `Welcome to ${salonName}. Choose Language (English / Urdu / Roman Urdu / Arabic) or tap an option below:`,
      },
      action: {
        buttons: [
          { type: 'reply', reply: { id: `flow:${flowId || 'booking_flow'}`, title: 'Book Appointment' } },
          { type: 'reply', reply: { id: 'menu:services', title: 'Services & Prices' } },
          { type: 'reply', reply: { id: 'menu:hours_location', title: 'Hours & Location' } },
        ],
      },
    },
  };
}

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const verifyToken = getEnv('WHATSAPP_VERIFY_TOKEN') || 'workcraft_verify_token';
  const accessToken = getEnv('WHATSAPP_ACCESS_TOKEN');
  const phoneNumberId = getEnv('WHATSAPP_PHONE_NUMBER_ID');
  const flowId = getEnv('WHATSAPP_FLOW_ID');

  // Meta Webhook Verification Challenge (GET)
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    if (mode === 'subscribe' && token === verifyToken && challenge) {
      return new Response(challenge, { status: 200 });
    }
    return new Response(
      JSON.stringify({
        ok: true,
        webhookReady: true,
        metaCredentialsConfigured: Boolean(accessToken && phoneNumberId),
        unsolicitedPromoVideos: false,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }

  if (req.method === 'POST') {
    let payload: Record<string, unknown> | null = null;
    try {
      payload = (await req.json()) as Record<string, unknown>;
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid webhook payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }

    const fromPhone = typeof payload?.from === 'string' ? payload.from : '+923001234567';
    const salonName = typeof payload?.salonName === 'string' ? payload.salonName : 'WORKCRAFT Partner Salon';
    const outgoingPreview = buildWelcomeInteractivePayload(fromPhone, salonName, flowId);

    // Real Meta Cloud API delivery only occurs when WHATSAPP_ACCESS_TOKEN & WHATSAPP_PHONE_NUMBER_ID are configured
    if (!accessToken || !phoneNumberId) {
      return new Response(
        JSON.stringify({
          accepted: true,
          deliveredViaMetaApi: false,
          requiresMetaCredentials: true,
          missingEnvVars: ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID'],
          welcomePayloadPreview: outgoingPreview,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }

    const graphRes = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(outgoingPreview),
    });

    const graphBody = await graphRes.json().catch(() => null);
    return new Response(
      JSON.stringify({
        accepted: true,
        deliveredViaMetaApi: graphRes.ok,
        graphResponse: graphBody,
      }),
      { status: graphRes.ok ? 200 : 502, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
