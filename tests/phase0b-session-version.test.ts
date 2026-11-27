import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'phase0b-session-version-test-secret-32-bytes-minimum';

const { signSessionToken, verifySessionToken } = await import('../server/security.js');

const testUser = {
  userId: 'usr-session-version-test',
  userRole: 'SALON_OWNER' as const,
  displayName: 'Session Version Test',
  email: 'session-version@workcraft.local',
  phone: '+923000000000',
  salonId: 'test-salon',
  allowedSalonIds: ['test-salon'],
  agentId: null,
};

function signClaims(claims: Record<string, unknown>): string {
  const encode = (value: string | Buffer) =>
    Buffer.from(value).toString('base64url');
  const header = encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = encode(JSON.stringify(claims));
  const data = `${header}.${payload}`;
  const signature = crypto
    .createHmac('sha256', process.env.JWT_SECRET!)
    .update(data)
    .digest('base64url');
  return `${data}.${signature}`;
}

test('session tokens with the current version remain valid', () => {
  const token = signSessionToken(testUser);
  assert.equal(verifySessionToken(token)?.userId, testUser.userId);
});

test('session tokens missing sv are rejected', () => {
  const now = Math.floor(Date.now() / 1000);
  const legacyToken = signClaims({
    sub: testUser.userId,
    user_role: testUser.userRole,
    salon_id: testUser.salonId,
    allowed_salon_ids: testUser.allowedSalonIds,
    agent_id: null,
    display_name: testUser.displayName,
    email: testUser.email,
    phone: testUser.phone,
    iat: now,
    exp: now + 300,
  });

  assert.equal(verifySessionToken(legacyToken), null);
});

test('session tokens with a stale or non-integer sv are rejected', () => {
  const now = Math.floor(Date.now() / 1000);
  const baseClaims = {
    sub: testUser.userId,
    user_role: testUser.userRole,
    salon_id: testUser.salonId,
    agent_id: null,
    display_name: testUser.displayName,
    email: testUser.email,
    phone: testUser.phone,
    iat: now,
    exp: now + 300,
  };

  assert.equal(verifySessionToken(signClaims({ ...baseClaims, sv: 0 })), null);
  assert.equal(verifySessionToken(signClaims({ ...baseClaims, sv: '1' })), null);
});
