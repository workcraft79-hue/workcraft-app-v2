import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { dispatchFounderAlertWebhook, kvGetJson, kvSetJson } from './kvBridge.js';
import { sanitizePlainText, sanitizePhone, signServerBlob, verifyServerBlob } from './security.js';

const DATA_DIR = process.env.VERCEL
  ? path.join('/tmp', 'workcraft-data')
  : path.resolve(process.cwd(), '.data');
const OPS_STORE_FILE = path.join(DATA_DIR, 'ops-ledger.json');

const P256_SPKI_PREFIX = Buffer.from('3059301306072a8648ce3d020106082a8648ce3d030107034200', 'hex');

export interface BiometricDeviceRecord {
  credentialId: string;
  spkiBase64: string;
  deviceLabel: string;
  createdAtMs: number;
}

export interface CoAgentRecord {
  id: string;
  leadAgentId: string;
  leadAgentName: string;
  name: string;
  phone: string;
  city: string;
  splitPctOfAgentShare: number;
  cashHeld: number;
  dealsClosed: number;
  status: 'ACTIVE' | 'HANDOFF_PENDING';
  createdAt: string;
}

export interface FinancialLedgerEntry {
  id: string;
  type:
    | 'CASH_COLLECTED'
    | 'CASH_REMITTED'
    | 'CO_AGENT_HANDOFF'
    | 'MAINT_PAYMENT'
    | 'PACKAGE_UPGRADE';
  salonId?: string;
  salonName: string;
  agentId?: string;
  coAgentId?: string;
  amount: number;
  currency: string;
  method: string;
  referenceTid: string;
  proofHash: string;
  note: string;
  createdAt: string;
}

export interface BroadcastHistoryEntry {
  id: string;
  title: string;
  messageEn: string;
  regionFilter: string;
  tierFilter: string;
  recipientCount: number;
  createdAt: string;
}

export interface IncidentRecord {
  id: string;
  role: 'FOUNDER' | 'AGENT' | 'SALON_OWNER' | 'END_USER' | 'SYSTEM';
  area: string;
  route: string;
  severity: 'LOW' | 'MEDIUM' | 'CRITICAL';
  message: string;
  stackHint?: string;
  resolutionStatus: 'AUTO_RESOLVED' | 'FALLBACK_ACTIVE' | 'NEEDS_FOUNDER_ACTION' | 'RESOLVED_BY_FOUNDER';
  recoveryMs: number;
  founderAlerted: boolean;
  occurredAt: string;
  resolvedAt: string | null;
}

interface PersistedOpsState {
  biometricRevokedBeforeMs: number;
  biometricDevices: BiometricDeviceRecord[];
  founderReportPhone: string;
  pairingKey: string;
  pairingUpdatedAt: string;
  agentCashHeld: Record<string, { held: number; deals: number; lastUpdatedAt: string }>;
  coAgents: CoAgentRecord[];
  ledgerEntries: FinancialLedgerEntry[];
  broadcasts: BroadcastHistoryEntry[];
  incidents: IncidentRecord[];
}

const DEFAULT_OPS_STATE: PersistedOpsState = {
  biometricRevokedBeforeMs: 0,
  biometricDevices: [],
  founderReportPhone: '+92 321 0000000',
  pairingKey: `WC-${crypto.randomBytes(2).toString('hex').toUpperCase()}-LIVE`,
  pairingUpdatedAt: new Date().toISOString(),
  agentCashHeld: {
    'agent-pk-1': {
      held: 25000,
      deals: 1,
      lastUpdatedAt: new Date().toISOString(),
    },
  },
  coAgents: [
    {
      id: 'coagent-pk-1',
      leadAgentId: 'agent-pk-1',
      leadAgentName: 'Kamran Tariq',
      name: 'Bilal Raza (Co-Agent)',
      phone: '+92 302 5544332',
      city: 'Lahore Gulberg & Model Town',
      splitPctOfAgentShare: 50,
      cashHeld: 0,
      dealsClosed: 3,
      status: 'ACTIVE',
      createdAt: new Date(Date.now() - 86400_000 * 14).toISOString(),
    },
  ],
  ledgerEntries: [],
  broadcasts: [],
  incidents: [],
};

let opsState: PersistedOpsState = structuredClone(DEFAULT_OPS_STATE);

function loadOpsState() {
  try {
    if (!fs.existsSync(OPS_STORE_FILE)) return;
    const raw = fs.readFileSync(OPS_STORE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<PersistedOpsState>;
    opsState = {
      ...structuredClone(DEFAULT_OPS_STATE),
      ...parsed,
      agentCashHeld: parsed.agentCashHeld || structuredClone(DEFAULT_OPS_STATE.agentCashHeld),
      coAgents: Array.isArray(parsed.coAgents) ? parsed.coAgents : structuredClone(DEFAULT_OPS_STATE.coAgents),
      ledgerEntries: Array.isArray(parsed.ledgerEntries) ? parsed.ledgerEntries : [],
      broadcasts: Array.isArray(parsed.broadcasts) ? parsed.broadcasts : [],
      biometricDevices: Array.isArray(parsed.biometricDevices) ? parsed.biometricDevices : [],
      incidents: Array.isArray(parsed.incidents) ? parsed.incidents : [],
    };
  } catch {
    // boot cleanly from defaults
  }
}

export async function hydrateOpsStoreFromKv(): Promise<void> {
  const remote = await kvGetJson<Partial<PersistedOpsState>>('wc:ops:v1');
  if (!remote) return;
  opsState = {
    ...structuredClone(DEFAULT_OPS_STATE),
    ...remote,
    agentCashHeld: remote.agentCashHeld || opsState.agentCashHeld,
    coAgents: Array.isArray(remote.coAgents) ? remote.coAgents : opsState.coAgents,
    ledgerEntries: Array.isArray(remote.ledgerEntries) ? remote.ledgerEntries : opsState.ledgerEntries,
    broadcasts: Array.isArray(remote.broadcasts) ? remote.broadcasts : opsState.broadcasts,
    biometricDevices: Array.isArray(remote.biometricDevices) ? remote.biometricDevices : opsState.biometricDevices,
    incidents: Array.isArray(remote.incidents) ? remote.incidents : opsState.incidents,
  };
}

function saveOpsState() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(OPS_STORE_FILE, JSON.stringify(opsState, null, 2), 'utf8');
  } catch (err) {
    console.warn('Could not persist ops state:', err);
  }
  void kvSetJson('wc:ops:v1', opsState);
}

loadOpsState();

function decodeBase64Flexible(input: string): Buffer {
  const clean = (input || '').trim().replace(/-/g, '+').replace(/_/g, '/');
  const pad = clean.length % 4 === 0 ? '' : '='.repeat(4 - (clean.length % 4));
  return Buffer.from(clean + pad, 'base64');
}

function encodeBase64Url(buf: Buffer): string {
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

// Extract P-256 uncompressed point from COSE key embedded in WebAuthn authenticatorData if getPublicKey() wasn't sent
function extractSpkiFromAuthenticatorData(authData: Buffer): string | null {
  try {
    if (authData.length < 55) return null;
    const flags = authData[32];
    const hasAttestedCredentialData = (flags & 0x40) !== 0;
    if (!hasAttestedCredentialData) return null;

    let offset = 37 + 16; // rpIdHash(32)+flags(1)+signCount(4)+aaguid(16)
    const credIdLen = authData.readUInt16BE(offset);
    offset += 2 + credIdLen;

    // Minimal CBOR map walk for standard ES256 COSE key (-2: x 32b, -3: y 32b)
    const cose = authData.subarray(offset);
    const xMarker = Buffer.from([0x21, 0x58, 0x20]); // -2, bytes(32)
    const yMarker = Buffer.from([0x22, 0x58, 0x20]); // -3, bytes(32)
    const xIdx = cose.indexOf(xMarker);
    const yIdx = cose.indexOf(yMarker);
    if (xIdx < 0 || yIdx < 0) return null;
    const x = cose.subarray(xIdx + 3, xIdx + 35);
    const y = cose.subarray(yIdx + 3, yIdx + 35);
    if (x.length !== 32 || y.length !== 32) return null;
    const spki = Buffer.concat([P256_SPKI_PREFIX, Buffer.from([0x04]), x, y]);
    return spki.toString('base64');
  } catch {
    return null;
  }
}

export function issueFounderWebAuthnChallenge(purpose: 'register' | 'login') {
  const challenge = encodeBase64Url(crypto.randomBytes(32));
  const challengeToken = signServerBlob({
    kind: 'webauthn-challenge',
    purpose,
    challenge,
    exp: Date.now() + 120_000, // 2-minute challenge window
  });
  return { challenge, challengeToken };
}

export function registerFounderBiometricCredential(params: {
  challengeToken: string;
  credentialId: string;
  clientDataJSON: string;
  publicKeySpkiBase64?: string;
  authenticatorDataBase64?: string;
  deviceLabel?: string;
}):
  | { ok: true; biometricBlob: string; deviceLabel: string; credentialId: string }
  | { ok: false; error: string } {
  const challengeClaims = verifyServerBlob<{
    kind?: string;
    purpose?: string;
    challenge?: string;
    exp?: number;
  }>(params.challengeToken);

  if (
    !challengeClaims ||
    challengeClaims.kind !== 'webauthn-challenge' ||
    challengeClaims.purpose !== 'register' ||
    !challengeClaims.challenge ||
    !challengeClaims.exp ||
    challengeClaims.exp < Date.now()
  ) {
    return { ok: false, error: 'Biometric setup session expired. Please try again.' };
  }

  let clientData: { type?: string; challenge?: string } = {};
  try {
    clientData = JSON.parse(decodeBase64Flexible(params.clientDataJSON).toString('utf8'));
  } catch {
    return { ok: false, error: 'Malformed WebAuthn client data.' };
  }

  if (clientData.type !== 'webauthn.create' || clientData.challenge !== challengeClaims.challenge) {
    return { ok: false, error: 'Biometric challenge mismatch.' };
  }

  let spkiBase64 = (params.publicKeySpkiBase64 || '').trim();
  if (!spkiBase64 && params.authenticatorDataBase64) {
    const authBuf = decodeBase64Flexible(params.authenticatorDataBase64);
    spkiBase64 = extractSpkiFromAuthenticatorData(authBuf) || '';
  }

  if (!spkiBase64) {
    return { ok: false, error: 'Browser did not expose an ECDSA P-256 public key for biometrics.' };
  }

  try {
    const spkiBuf = decodeBase64Flexible(spkiBase64);
    crypto.createPublicKey({ key: spkiBuf, format: 'der', type: 'spki' });
    spkiBase64 = spkiBuf.toString('base64');
  } catch {
    return { ok: false, error: 'Unsupported biometric key format. Please use Fingerprint or Face ID.' };
  }

  const credentialId = sanitizePlainText(params.credentialId, 300);
  if (!credentialId) {
    return { ok: false, error: 'Missing WebAuthn credential ID.' };
  }

  const deviceLabel = sanitizePlainText(params.deviceLabel, 80) || 'Founder Mobile Device';
  const createdAtMs = Date.now();

  opsState.biometricDevices = [
    { credentialId, spkiBase64, deviceLabel, createdAtMs },
    ...opsState.biometricDevices.filter((d) => d.credentialId !== credentialId),
  ].slice(0, 10);
  saveOpsState();

  const biometricBlob = signServerBlob({
    kind: 'founder-biometric',
    credentialId,
    spkiBase64,
    deviceLabel,
    createdAtMs,
  });

  return { ok: true, biometricBlob, deviceLabel, credentialId };
}

export function verifyFounderBiometricAssertion(params: {
  challengeToken: string;
  biometricBlob: string;
  credentialId: string;
  authenticatorData: string;
  clientDataJSON: string;
  signature: string;
}): { ok: true; deviceLabel: string } | { ok: false; error: string } {
  const challengeClaims = verifyServerBlob<{
    kind?: string;
    purpose?: string;
    challenge?: string;
    exp?: number;
  }>(params.challengeToken);

  if (
    !challengeClaims ||
    challengeClaims.kind !== 'webauthn-challenge' ||
    challengeClaims.purpose !== 'login' ||
    !challengeClaims.challenge ||
    !challengeClaims.exp ||
    challengeClaims.exp < Date.now()
  ) {
    return { ok: false, error: 'Biometric prompt expired. Please tap Unlock with Biometric again.' };
  }

  const blobClaims = verifyServerBlob<{
    kind?: string;
    credentialId?: string;
    spkiBase64?: string;
    deviceLabel?: string;
    createdAtMs?: number;
  }>(params.biometricBlob);

  if (
    !blobClaims ||
    blobClaims.kind !== 'founder-biometric' ||
    !blobClaims.credentialId ||
    !blobClaims.spkiBase64 ||
    (blobClaims.createdAtMs || 0) < opsState.biometricRevokedBeforeMs
  ) {
    return {
      ok: false,
      error: 'Saved device biometric was revoked or expired. Unlock once with your Founder PIN (WC3118) to re-enable.',
    };
  }

  if (blobClaims.credentialId !== params.credentialId.trim()) {
    return { ok: false, error: 'Credential ID mismatch for this mobile device.' };
  }

  const clientDataBuf = decodeBase64Flexible(params.clientDataJSON);
  let clientData: { type?: string; challenge?: string } = {};
  try {
    clientData = JSON.parse(clientDataBuf.toString('utf8'));
  } catch {
    return { ok: false, error: 'Invalid WebAuthn client data.' };
  }

  if (clientData.type !== 'webauthn.get' || clientData.challenge !== challengeClaims.challenge) {
    return { ok: false, error: 'Biometric login challenge verification failed.' };
  }

  const authDataBuf = decodeBase64Flexible(params.authenticatorData);
  if (authDataBuf.length < 37 || (authDataBuf[32] & 0x01) === 0) {
    return { ok: false, error: 'User presence was not confirmed by device biometric sensor.' };
  }

  try {
    const publicKey = crypto.createPublicKey({
      key: decodeBase64Flexible(blobClaims.spkiBase64),
      format: 'der',
      type: 'spki',
    });
    const clientHash = crypto.createHash('sha256').update(clientDataBuf).digest();
    const signedPayload = Buffer.concat([authDataBuf, clientHash]);
    const sigBuf = decodeBase64Flexible(params.signature);
    const verified = crypto.verify('sha256', signedPayload, publicKey, sigBuf);
    if (!verified) {
      return { ok: false, error: 'Biometric signature verification failed.' };
    }
  } catch {
    return { ok: false, error: 'Could not verify hardware biometric signature.' };
  }

  return { ok: true, deviceLabel: blobClaims.deviceLabel || 'Founder Mobile Device' };
}

export function revokeAllFounderBiometrics() {
  opsState.biometricRevokedBeforeMs = Date.now();
  opsState.biometricDevices = [];
  saveOpsState();
  return { revokedAt: new Date(opsState.biometricRevokedBeforeMs).toISOString() };
}

// =============================================================================
// Persistent Agent Cash, Co-Agent Splits, Payments, Settings & Broadcast Store
// =============================================================================

export function getFinanceAndAgentSummary(agentId = 'agent-pk-1') {
  const agentCash = opsState.agentCashHeld[agentId] || {
    held: 0,
    deals: 0,
    lastUpdatedAt: new Date().toISOString(),
  };
  const coAgents = opsState.coAgents.filter((c) => c.leadAgentId === agentId);
  return {
    agentId,
    cashHeld: agentCash.held,
    dealsCount: agentCash.deals,
    lastUpdatedAt: agentCash.lastUpdatedAt,
    coAgents,
    recentLedger: opsState.ledgerEntries.slice(0, 25),
  };
}

export function recordAgentCashCollection(params: {
  agentId: string;
  salonName: string;
  amount: number;
  tid: string;
  proofHash: string;
  coAgentId?: string;
}) {
  const agentKey = params.agentId || 'agent-pk-1';
  const current = opsState.agentCashHeld[agentKey] || {
    held: 0,
    deals: 0,
    lastUpdatedAt: new Date().toISOString(),
  };
  const amount = Math.max(0, Math.round(Number(params.amount || 0)));
  const updatedHeld = current.held + amount;
  const updatedDeals = current.deals + 1;
  opsState.agentCashHeld[agentKey] = {
    held: updatedHeld,
    deals: updatedDeals,
    lastUpdatedAt: new Date().toISOString(),
  };

  if (params.coAgentId) {
    const coAgent = opsState.coAgents.find((c) => c.id === params.coAgentId);
    if (coAgent) {
      coAgent.cashHeld += amount;
      coAgent.dealsClosed += 1;
      coAgent.status = 'HANDOFF_PENDING';
    }
  }

  const entry: FinancialLedgerEntry = {
    id: `led-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
    type: 'CASH_COLLECTED',
    salonName: sanitizePlainText(params.salonName, 100) || 'Partner Salon',
    agentId: agentKey,
    coAgentId: params.coAgentId,
    amount,
    currency: 'PKR',
    method: 'Biometric Cash Collection',
    referenceTid: sanitizePlainText(params.tid, 60) || `CASH-${Date.now()}`,
    proofHash: sanitizePlainText(params.proofHash, 80) || 'sha256:verified',
    note: params.coAgentId
      ? `Cash collected via Co-Agent (${params.coAgentId}) — pending handover to Lead Agent.`
      : 'Cash collected by Lead Field Agent with biometric seal.',
    createdAt: new Date().toISOString(),
  };
  opsState.ledgerEntries.unshift(entry);
  opsState.ledgerEntries = opsState.ledgerEntries.slice(0, 100);
  saveOpsState();

  return { entry, ...getFinanceAndAgentSummary(agentKey) };
}

export function recordAgentCashRemittance(params: {
  agentId: string;
  amount?: number;
  tid: string;
}) {
  const agentKey = params.agentId || 'agent-pk-1';
  const current = opsState.agentCashHeld[agentKey] || {
    held: 0,
    deals: 0,
    lastUpdatedAt: new Date().toISOString(),
  };
  const clearedAmount =
    typeof params.amount === 'number' && params.amount > 0
      ? Math.min(current.held, Math.round(params.amount))
      : current.held;

  const nextHeld = Math.max(0, current.held - clearedAmount);
  opsState.agentCashHeld[agentKey] = {
    held: nextHeld,
    deals: nextHeld === 0 ? 0 : current.deals,
    lastUpdatedAt: new Date().toISOString(),
  };

  const entry: FinancialLedgerEntry = {
    id: `led-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
    type: 'CASH_REMITTED',
    salonName: 'WORKCRAFT Main Account',
    agentId: agentKey,
    amount: clearedAmount,
    currency: 'PKR',
    method: 'Official Bank / Wallet Remittance',
    referenceTid: sanitizePlainText(params.tid, 80),
    proofHash: `sha256:${crypto.createHash('sha256').update(params.tid).digest('hex').slice(0, 16)}`,
    note: 'Agent remitted held cash into WORKCRAFT Main Account.',
    createdAt: new Date().toISOString(),
  };
  opsState.ledgerEntries.unshift(entry);
  opsState.ledgerEntries = opsState.ledgerEntries.slice(0, 100);
  saveOpsState();

  return { clearedAmount, entry, ...getFinanceAndAgentSummary(agentKey) };
}

export function createCoAgentRecord(params: {
  leadAgentId: string;
  leadAgentName: string;
  name: string;
  phone: string;
  city: string;
  splitPctOfAgentShare: number;
}) {
  const record: CoAgentRecord = {
    id: `coagent-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`,
    leadAgentId: params.leadAgentId || 'agent-pk-1',
    leadAgentName: sanitizePlainText(params.leadAgentName, 80) || 'Lead Field Agent',
    name: sanitizePlainText(params.name, 80),
    phone: sanitizePhone(params.phone),
    city: sanitizePlainText(params.city, 100) || 'Pakistan',
    splitPctOfAgentShare: Math.max(10, Math.min(90, Math.round(Number(params.splitPctOfAgentShare || 50)))),
    cashHeld: 0,
    dealsClosed: 0,
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
  };
  opsState.coAgents.unshift(record);
  saveOpsState();
  return record;
}

export function recordCoAgentCashHandoff(params: {
  leadAgentId: string;
  coAgentId: string;
  referenceTid: string;
}) {
  const coAgent = opsState.coAgents.find((c) => c.id === params.coAgentId);
  if (!coAgent) return null;
  const handedOffAmount = coAgent.cashHeld;
  coAgent.cashHeld = 0;
  coAgent.status = 'ACTIVE';

  const entry: FinancialLedgerEntry = {
    id: `led-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
    type: 'CO_AGENT_HANDOFF',
    salonName: `Co-Agent Handoff (${coAgent.name})`,
    agentId: params.leadAgentId || coAgent.leadAgentId,
    coAgentId: coAgent.id,
    amount: handedOffAmount,
    currency: 'PKR',
    method: 'Co-Agent ➔ Lead Agent Biometric Handoff',
    referenceTid: sanitizePlainText(params.referenceTid, 60) || `HANDOFF-${Date.now()}`,
    proofHash: `sha256:${crypto.createHash('sha256').update(`${coAgent.id}:${Date.now()}`).digest('hex').slice(0, 16)}`,
    note: `Verified ${coAgent.splitPctOfAgentShare}% co-agent split settlement & physical handoff.`,
    createdAt: new Date().toISOString(),
  };
  opsState.ledgerEntries.unshift(entry);
  opsState.ledgerEntries = opsState.ledgerEntries.slice(0, 100);
  saveOpsState();

  return { coAgent, entry, ...getFinanceAndAgentSummary(params.leadAgentId || coAgent.leadAgentId) };
}

export function recordSalonFinancialPayment(params: {
  type: 'MAINT_PAYMENT' | 'PACKAGE_UPGRADE';
  salonId: string;
  salonName: string;
  amount: number;
  currency: string;
  method: string;
  referenceTid: string;
  note: string;
}) {
  const entry: FinancialLedgerEntry = {
    id: `led-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
    type: params.type,
    salonId: params.salonId,
    salonName: sanitizePlainText(params.salonName, 100) || 'Partner Salon',
    amount: Math.max(0, Math.round(Number(params.amount || 0))),
    currency: sanitizePlainText(params.currency, 8) || 'PKR',
    method: sanitizePlainText(params.method, 80) || 'Digital Gateway',
    referenceTid: sanitizePlainText(params.referenceTid, 80) || `TXN-${Date.now()}`,
    proofHash: `sha256:${crypto.createHash('sha256').update(`${params.salonId}:${params.referenceTid}:${Date.now()}`).digest('hex').slice(0, 16)}`,
    note: sanitizePlainText(params.note, 220),
    createdAt: new Date().toISOString(),
  };
  opsState.ledgerEntries.unshift(entry);
  opsState.ledgerEntries = opsState.ledgerEntries.slice(0, 100);
  saveOpsState();
  return entry;
}

export function getFounderSettings() {
  return {
    founderReportPhone: opsState.founderReportPhone,
    pairingKey: opsState.pairingKey,
    pairingUpdatedAt: opsState.pairingUpdatedAt,
    biometricDeviceCount: opsState.biometricDevices.length,
    broadcasts: opsState.broadcasts.slice(0, 10),
  };
}

export function updateFounderReportPhone(phone: string) {
  const cleaned = sanitizePhone(phone);
  if (!cleaned) return null;
  opsState.founderReportPhone = cleaned;
  saveOpsState();
  return getFounderSettings();
}

export function rotateFounderPairingKey() {
  opsState.pairingKey = `WC-${crypto.randomBytes(2).toString('hex').toUpperCase()}-LIVE`;
  opsState.pairingUpdatedAt = new Date().toISOString();
  saveOpsState();
  return getFounderSettings();
}

export function recordFounderBroadcastDispatch(params: {
  title: string;
  messageEn: string;
  regionFilter: string;
  tierFilter: string;
  recipientCount: number;
}) {
  const entry: BroadcastHistoryEntry = {
    id: `bc-${Date.now().toString(36)}`,
    title: sanitizePlainText(params.title, 160),
    messageEn: sanitizePlainText(params.messageEn, 800),
    regionFilter: sanitizePlainText(params.regionFilter, 20) || 'ALL',
    tierFilter: sanitizePlainText(params.tierFilter, 20) || 'ALL',
    recipientCount: Math.max(1, Math.round(Number(params.recipientCount || 1))),
    createdAt: new Date().toISOString(),
  };
  opsState.broadcasts.unshift(entry);
  opsState.broadcasts = opsState.broadcasts.slice(0, 20);
  saveOpsState();
  return entry;
}

export function recordIncidentReport(params: {
  role?: string;
  area?: string;
  route?: string;
  severity?: string;
  message: string;
  stackHint?: string;
  resolutionStatus?: string;
  recoveryMs?: number;
}): IncidentRecord {
  const normRole = sanitizePlainText(params.role || 'SYSTEM', 24).toUpperCase();
  const role: IncidentRecord['role'] =
    normRole === 'FOUNDER' ||
    normRole === 'AGENT' ||
    normRole === 'SALON_OWNER' ||
    normRole === 'END_USER'
      ? normRole
      : 'SYSTEM';

  const normSeverity = sanitizePlainText(params.severity || 'MEDIUM', 16).toUpperCase();
  const severity: IncidentRecord['severity'] =
    normSeverity === 'CRITICAL' ? 'CRITICAL' : normSeverity === 'LOW' ? 'LOW' : 'MEDIUM';

  const normStatus = sanitizePlainText(params.resolutionStatus || 'AUTO_RESOLVED', 32).toUpperCase();
  const resolutionStatus: IncidentRecord['resolutionStatus'] =
    normStatus === 'NEEDS_FOUNDER_ACTION'
      ? 'NEEDS_FOUNDER_ACTION'
      : normStatus === 'FALLBACK_ACTIVE'
      ? 'FALLBACK_ACTIVE'
      : normStatus === 'RESOLVED_BY_FOUNDER'
      ? 'RESOLVED_BY_FOUNDER'
      : 'AUTO_RESOLVED';

  const occurredAt = new Date().toISOString();
  const shouldAlertFounder =
    severity === 'CRITICAL' || resolutionStatus === 'NEEDS_FOUNDER_ACTION' || resolutionStatus === 'AUTO_RESOLVED';

  const record: IncidentRecord = {
    id: `inc-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`,
    role,
    area: sanitizePlainText(params.area || 'Application UI', 80),
    route: sanitizePlainText(params.route || '/', 140),
    severity,
    message: sanitizePlainText(params.message || 'Recovered runtime glitch', 320),
    stackHint: params.stackHint ? sanitizePlainText(params.stackHint, 240) : undefined,
    resolutionStatus,
    recoveryMs: Math.max(10, Math.min(30000, Math.round(Number(params.recoveryMs || 800)))),
    founderAlerted: shouldAlertFounder,
    occurredAt,
    resolvedAt: resolutionStatus === 'AUTO_RESOLVED' ? occurredAt : null,
  };

  opsState.incidents.unshift(record);
  opsState.incidents = opsState.incidents.slice(0, 80);
  saveOpsState();

  if (severity === 'CRITICAL' || resolutionStatus === 'NEEDS_FOUNDER_ACTION') {
    void dispatchFounderAlertWebhook({
      id: record.id,
      severity: record.severity,
      role: record.role,
      area: record.area,
      route: record.route,
      message: record.message,
      resolutionStatus: record.resolutionStatus,
      recoveryMs: record.recoveryMs,
      occurredAt: record.occurredAt,
    });
  }

  return record;
}

export function listIncidentReports(limit = 50): {
  incidents: IncidentRecord[];
  summary: {
    totalRecorded: number;
    autoResolvedCount: number;
    openActionCount: number;
    avgRecoveryMs: number;
    founderPhone: string;
  };
} {
  const list = opsState.incidents.slice(0, Math.max(1, Math.min(80, limit)));
  const autoResolvedCount = opsState.incidents.filter(
    (i) => i.resolutionStatus === 'AUTO_RESOLVED' || i.resolutionStatus === 'RESOLVED_BY_FOUNDER'
  ).length;
  const openActionCount = opsState.incidents.filter(
    (i) => i.resolutionStatus === 'NEEDS_FOUNDER_ACTION'
  ).length;
  const avgRecoveryMs =
    opsState.incidents.length > 0
      ? Math.round(
          opsState.incidents.reduce((sum, i) => sum + (i.recoveryMs || 0), 0) /
            opsState.incidents.length
        )
      : 420;
  return {
    incidents: list,
    summary: {
      totalRecorded: opsState.incidents.length,
      autoResolvedCount,
      openActionCount,
      avgRecoveryMs,
      founderPhone: opsState.founderReportPhone,
    },
  };
}

export function resolveIncidentReport(incidentId: string): IncidentRecord | null {
  const item = opsState.incidents.find((i) => i.id === incidentId);
  if (!item) return null;
  item.resolutionStatus = 'RESOLVED_BY_FOUNDER';
  item.resolvedAt = new Date().toISOString();
  saveOpsState();
  return item;
}
