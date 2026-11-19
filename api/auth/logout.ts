export const config = {
  runtime: 'edge',
};

export default function handler(): Response {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Set-Cookie': 'wc_founder_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax',
    },
  });
}
