export type TelemetryRole = 'FOUNDER' | 'AGENT' | 'SALON_OWNER' | 'END_USER' | 'SYSTEM';

export interface TelemetryIncidentInput {
  role?: TelemetryRole;
  area: string;
  route?: string;
  severity?: 'LOW' | 'MEDIUM' | 'CRITICAL';
  message: string;
  stackHint?: string;
  resolutionStatus?: 'AUTO_RESOLVED' | 'FALLBACK_ACTIVE' | 'NEEDS_FOUNDER_ACTION';
  recoveryMs?: number;
}

let activeTelemetryRole: TelemetryRole = 'END_USER';
const recentFingerprints = new Map<string, number>();

export function setActiveTelemetryRole(role: string | null | undefined) {
  if (role === 'FOUNDER') activeTelemetryRole = 'FOUNDER';
  else if (role === 'AGENT' || role === 'FIELD_AGENT') activeTelemetryRole = 'AGENT';
  else if (role === 'SALON_OWNER') activeTelemetryRole = 'SALON_OWNER';
  else activeTelemetryRole = 'END_USER';
}

export function getActiveTelemetryRole(): TelemetryRole {
  return activeTelemetryRole;
}

export function reportClientIncident(input: TelemetryIncidentInput): void {
  if (typeof window === 'undefined' || !input.message) return;
  const role = input.role || activeTelemetryRole;
  const fingerprint = `${role}:${input.area}:${input.message.slice(0, 80)}`;
  const now = Date.now();
  const lastSent = recentFingerprints.get(fingerprint);
  if (lastSent && now - lastSent < 4000) {
    return;
  }
  recentFingerprints.set(fingerprint, now);

  const payload = {
    role,
    area: input.area,
    route: input.route || window.location.pathname || '/',
    severity: input.severity || 'MEDIUM',
    message: input.message.slice(0, 320),
    stackHint: input.stackHint ? input.stackHint.slice(0, 240) : undefined,
    resolutionStatus: input.resolutionStatus || 'AUTO_RESOLVED',
    recoveryMs: input.recoveryMs || 800,
  };

  try {
    void fetch('/api/telemetry/incident', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Telemetry reporting must never throw or disrupt UX
  }
}
