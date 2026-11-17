import React, { useEffect, useState } from 'react';
import {
  Eye,
  EyeOff,
  Fingerprint,
  KeyRound,
  Lock,
  ShieldCheck,
  Smartphone,
  X,
} from 'lucide-react';
import type { AuthUser } from '../types/auth';
import { WATERMARK_URL } from '../data/portalData';

export const FOUNDER_BIOMETRIC_STORAGE_KEY = 'wcl_founder_biometric_v1';

export interface StoredFounderBiometric {
  credentialId: string;
  biometricBlob: string;
  deviceLabel: string;
  registeredAt: string;
}

export function detectMobileFounderDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isMobileUa = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isCoarsePointer =
    typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  return isMobileUa || (isCoarsePointer && window.innerWidth <= 1024);
}

export function supportsPlatformBiometric(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    Boolean(navigator.credentials?.create) &&
    Boolean(navigator.credentials?.get)
  );
}

export function loadStoredFounderBiometric(): StoredFounderBiometric | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(FOUNDER_BIOMETRIC_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredFounderBiometric;
    if (!parsed?.credentialId || !parsed?.biometricBlob) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearStoredFounderBiometric(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(FOUNDER_BIOMETRIC_STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
}

function base64UrlToUint8Array(base64url: string): Uint8Array {
  const padded = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  const binary = window.atob(padded + '='.repeat(padLen));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function bufferToBase64Url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function bufferToBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export async function enrollFounderBiometricDevice(
  deviceLabel = 'Founder Mobile Device'
): Promise<{ ok: true; stored: StoredFounderBiometric } | { ok: false; error: string }> {
  if (!supportsPlatformBiometric()) {
    return {
      ok: false,
      error: 'Biometric authentication (Thumb / Face ID) is not available in this browser.',
    };
  }

  try {
    const chRes = await fetch('/api/auth/founder-webauthn/challenge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ purpose: 'register' }),
    });
    const chData = (await chRes.json()) as {
      challenge?: string;
      challengeToken?: string;
      rpId?: string;
      rpName?: string;
      error?: string;
    };
    if (!chRes.ok || !chData.challenge || !chData.challengeToken) {
      return { ok: false, error: chData.error || 'Could not start biometric enrollment.' };
    }

    const userBytes = new TextEncoder().encode('workcraft-founder-wc3118');
    const createOptions: CredentialCreationOptions = {
      publicKey: {
        rp: {
          name: chData.rpName || 'WorkCraft',
          id: chData.rpId || window.location.hostname,
        },
        user: {
          id: userBytes,
          name: 'founder@workcraft.local',
          displayName: 'WorkCraft Founder',
        },
        challenge: base64UrlToUint8Array(chData.challenge) as BufferSource,
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred',
        },
        timeout: 60000,
        attestation: 'none',
      },
    };

    const cred = (await navigator.credentials.create(createOptions)) as PublicKeyCredential | null;
    if (!cred) {
      return { ok: false, error: 'Biometric scan was cancelled.' };
    }

    const response = cred.response as AuthenticatorAttestationResponse;
    const spkiBuf =
      typeof response.getPublicKey === 'function' ? response.getPublicKey() : null;
    const authDataBuf =
      typeof response.getAuthenticatorData === 'function'
        ? response.getAuthenticatorData()
        : null;

    const regRes = await fetch('/api/auth/founder-webauthn/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        challengeToken: chData.challengeToken,
        credentialId: bufferToBase64Url(cred.rawId),
        clientDataJSON: bufferToBase64Url(response.clientDataJSON),
        publicKeySpkiBase64: spkiBuf ? bufferToBase64(spkiBuf) : undefined,
        authenticatorDataBase64: authDataBuf ? bufferToBase64(authDataBuf) : undefined,
        deviceLabel,
      }),
    });
    const regData = (await regRes.json()) as {
      ok?: boolean;
      credentialId?: string;
      biometricBlob?: string;
      deviceLabel?: string;
      error?: string;
    };

    if (!regRes.ok || !regData.ok || !regData.credentialId || !regData.biometricBlob) {
      return { ok: false, error: regData.error || 'Could not save biometric credential.' };
    }

    const stored: StoredFounderBiometric = {
      credentialId: regData.credentialId,
      biometricBlob: regData.biometricBlob,
      deviceLabel: regData.deviceLabel || deviceLabel,
      registeredAt: new Date().toISOString(),
    };
    window.localStorage.setItem(FOUNDER_BIOMETRIC_STORAGE_KEY, JSON.stringify(stored));
    return { ok: true, stored };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error && err.name === 'NotAllowedError'
          ? 'Biometric prompt was cancelled or timed out. You can still unlock with PIN.'
          : err instanceof Error
          ? err.message
          : 'Biometric setup failed on this device.',
    };
  }
}

interface FounderUnlockGateProps {
  onUnlocked: (user: AuthUser, unlockedVia: 'PIN' | 'BIOMETRIC') => void;
}

export const FounderUnlockGate: React.FC<FounderUnlockGateProps> = ({ onUnlocked }) => {
  const isMobile = React.useMemo(() => detectMobileFounderDevice(), []);
  const canBiometric = React.useMemo(() => supportsPlatformBiometric(), []);
  const [savedBiometric, setSavedBiometric] = useState<StoredFounderBiometric | null>(() =>
    loadStoredFounderBiometric()
  );

  // Returning mobile with saved biometric starts on Biometric tab, while keeping PIN available as dual option
  const showDualMobileOptions = isMobile && canBiometric && Boolean(savedBiometric);
  const [authMethod, setAuthMethod] = useState<'BIOMETRIC' | 'PIN'>(() =>
    showDualMobileOptions ? 'BIOMETRIC' : 'PIN'
  );

  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const fresh = loadStoredFounderBiometric();
    setSavedBiometric(fresh);
    if (isMobile && canBiometric && fresh) {
      setAuthMethod('BIOMETRIC');
    } else {
      setAuthMethod('PIN');
    }
  }, [isMobile, canBiometric]);

  const handlePinUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedPin = pin.trim().toUpperCase();
    if (cleanedPin.length < 4) {
      setErrorMsg('Enter your 6-character Founder PIN.');
      return;
    }

    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/founder-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: cleanedPin }),
      });
      const data = (await res.json()) as {
        authenticated?: boolean;
        user?: AuthUser;
        error?: string;
      };
      if (!res.ok || !data.authenticated || !data.user) {
        setErrorMsg(data.error || 'Incorrect Founder PIN.');
        return;
      }
      onUnlocked(data.user, 'PIN');
    } catch {
      setErrorMsg('Connection interrupted. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBiometricUnlock = async () => {
    if (!savedBiometric) {
      setAuthMethod('PIN');
      return;
    }
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      const chRes = await fetch('/api/auth/founder-webauthn/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purpose: 'login' }),
      });
      const chData = (await chRes.json()) as {
        challenge?: string;
        challengeToken?: string;
        rpId?: string;
        error?: string;
      };
      if (!chRes.ok || !chData.challenge || !chData.challengeToken) {
        setErrorMsg(chData.error || 'Could not initiate biometric sign-in. Use PIN instead.');
        return;
      }

      const assertion = (await navigator.credentials.get({
        publicKey: {
          challenge: base64UrlToUint8Array(chData.challenge) as BufferSource,
          rpId: chData.rpId || window.location.hostname,
          allowCredentials: [
            {
              type: 'public-key',
              id: base64UrlToUint8Array(savedBiometric.credentialId) as BufferSource,
              transports: ['internal'],
            },
          ],
          userVerification: 'required',
          timeout: 60000,
        },
      })) as PublicKeyCredential | null;

      if (!assertion) {
        setErrorMsg('Biometric check cancelled. Tap again or switch to PIN.');
        return;
      }

      const response = assertion.response as AuthenticatorAssertionResponse;
      const verifyRes = await fetch('/api/auth/founder-webauthn/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeToken: chData.challengeToken,
          biometricBlob: savedBiometric.biometricBlob,
          credentialId: bufferToBase64Url(assertion.rawId),
          authenticatorData: bufferToBase64Url(response.authenticatorData),
          clientDataJSON: bufferToBase64Url(response.clientDataJSON),
          signature: bufferToBase64Url(response.signature),
        }),
      });
      const verifyData = (await verifyRes.json()) as {
        authenticated?: boolean;
        user?: AuthUser;
        error?: string;
      };

      if (!verifyRes.ok || !verifyData.authenticated || !verifyData.user) {
        setErrorMsg(verifyData.error || 'Biometric verification failed. Use Founder PIN below.');
        return;
      }
      onUnlocked(verifyData.user, 'BIOMETRIC');
    } catch (err) {
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setErrorMsg('Biometric verification cancelled or timed out. You can also unlock with PIN.');
      } else {
        setErrorMsg('Biometric check unavailable on this browser session. Use Founder PIN.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0D1117] text-[#F0F6FC] flex items-center justify-center p-4 sm:p-6 pt-safe pb-safe">
      <div className="w-full max-w-md rounded-3xl border border-[#30363D] bg-[#161B22] p-6 sm:p-7 space-y-5 shadow-2xl">
        {/* WorkCraft Brand Header */}
        <div className="flex flex-col items-center text-center space-y-2">
          <img
            src={WATERMARK_URL}
            alt="WORKCRAFT"
            className="h-auto w-[148px] object-contain opacity-95"
          />
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#06B6D4]/40 bg-[#06B6D4]/10 px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-[#06B6D4]">
            <Lock className="size-3" />
            <span>FOUNDER COMMAND ACCESS</span>
          </span>
          <h1 className="text-xl font-black tracking-tight text-[#F0F6FC]">
            Unlock WorkCraft Control Room
          </h1>
          <p className="text-xs font-sans text-[#8B949E] leading-relaxed">
            {showDualMobileOptions
              ? 'Choose Thumb / Face ID or enter your 6-character Founder PIN to continue.'
              : isMobile
              ? 'First-time mobile login requires your 6-character Founder PIN. Once inside, you can save Thumb / Face ID for future logins.'
              : 'Enter your 6-character Founder PIN to open the Founder Command Center.'}
          </p>
        </div>

        {/* Returning Mobile Dual Selector: Biometric OR PIN */}
        {showDualMobileOptions && (
          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-[#30363D] bg-[#0D1117] p-1.5">
            <button
              type="button"
              onClick={() => {
                setAuthMethod('BIOMETRIC');
                setErrorMsg(null);
              }}
              className={`min-h-[48px] rounded-xl text-xs font-mono font-bold transition flex items-center justify-center gap-1.5 ${
                authMethod === 'BIOMETRIC'
                  ? 'bg-[#06B6D4] text-[#0D1117]'
                  : 'text-[#8B949E] hover:text-[#F0F6FC]'
              }`}
            >
              <Fingerprint className="size-4" />
              <span>Biometric ID</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMethod('PIN');
                setErrorMsg(null);
              }}
              className={`min-h-[48px] rounded-xl text-xs font-mono font-bold transition flex items-center justify-center gap-1.5 ${
                authMethod === 'PIN'
                  ? 'bg-[#D29922] text-[#0D1117]'
                  : 'text-[#8B949E] hover:text-[#F0F6FC]'
              }`}
            >
              <KeyRound className="size-4" />
              <span>Founder PIN</span>
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="rounded-xl border border-[#da3633] bg-[#4C1C1D] px-3.5 py-2.5 text-xs font-mono font-bold text-[#F85149] break-words [overflow-wrap:break-word]">
            {errorMsg}
          </div>
        )}

        {authMethod === 'BIOMETRIC' && showDualMobileOptions ? (
          <div className="space-y-4">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleBiometricUnlock}
              className="w-full min-h-[120px] rounded-2xl border-2 border-[#06B6D4]/60 bg-[#0D1117] hover:border-[#06B6D4] hover:bg-[#06B6D4]/10 p-5 flex flex-col items-center justify-center gap-2.5 transition active:scale-[0.98] disabled:opacity-60"
            >
              <span className="grid size-14 place-items-center rounded-2xl border border-[#06B6D4]/50 bg-[#06B6D4]/15 text-[#06B6D4]">
                <Fingerprint className="size-8" />
              </span>
              <span className="text-sm font-mono font-black text-[#F0F6FC] uppercase tracking-wide">
                {isSubmitting ? 'Verifying Biometrics...' : 'Tap to Unlock with Thumb / Face ID'}
              </span>
              <span className="text-[11px] font-mono text-[#3FB950]">
                Saved on {savedBiometric?.deviceLabel || 'This Mobile'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setAuthMethod('PIN');
                setErrorMsg(null);
              }}
              className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] hover:border-[#D29922] text-xs font-mono font-bold text-[#8B949E] hover:text-[#D29922] transition"
            >
              Use 6-Character Founder PIN Instead →
            </button>
          </div>
        ) : (
          <form onSubmit={handlePinUnlock} className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#8B949E] block">
                Founder 6-Character PIN (2 Letters + 4 Digits)
              </span>
              <div className="relative">
                <input
                  type={showPin ? 'text' : 'password'}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.toUpperCase().slice(0, 12))}
                  autoCapitalize="characters"
                  autoComplete="current-password"
                  placeholder="Enter 6-character PIN"
                  className="w-full min-h-[52px] rounded-xl border border-[#30363D] bg-[#0D1117] px-4 pr-12 text-center font-mono text-lg font-bold tracking-[0.3em] text-[#F0F6FC] placeholder:tracking-normal placeholder:text-sm placeholder:text-[#484F58] focus:border-[#06B6D4] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPin((v) => !v)}
                  aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] grid place-items-center text-[#8B949E] hover:text-[#F0F6FC]"
                >
                  {showPin ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </label>

            <button
              type="submit"
              disabled={isSubmitting || !pin.trim()}
              className="w-full min-h-[52px] rounded-xl bg-[#06B6D4] hover:bg-[#22D3EE] disabled:opacity-50 text-[#0D1117] text-xs font-mono font-black uppercase tracking-wider transition active:scale-[0.98]"
            >
              {isSubmitting ? 'Verifying Founder PIN...' : 'Unlock Founder Command Center'}
            </button>
          </form>
        )}

        <div className="border-t border-[#21262D] pt-3 flex items-center justify-between text-[10px] font-mono text-[#6E7681]">
          <span className="inline-flex items-center gap-1 text-[#3FB950]">
            <ShieldCheck className="size-3.5" />
            Hardware-Backed Session
          </span>
          <span>Zero PIN impact on Salons/Agents</span>
        </div>
      </div>
    </main>
  );
};

interface FounderBiometricEnrollPromptProps {
  onEnrolled: (stored: StoredFounderBiometric) => void;
  onDismiss: () => void;
}

export const FounderBiometricEnrollPrompt: React.FC<FounderBiometricEnrollPromptProps> = ({
  onEnrolled,
  onDismiss,
}) => {
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEnroll = async () => {
    setError(null);
    setIsEnrolling(true);
    const label = /iPhone|iPad|iPod/i.test(navigator.userAgent)
      ? 'Founder iPhone / iPad'
      : /Android/i.test(navigator.userAgent)
      ? 'Founder Android Mobile'
      : 'Founder Mobile';
    const result = await enrollFounderBiometricDevice(label);
    setIsEnrolling(false);
    if (!result.ok) {
      setError('error' in result ? result.error : 'Biometric enrollment failed.');
      return;
    }
    onEnrolled(result.stored);
  };

  return (
    <div className="mb-5 rounded-2xl border border-[#06B6D4]/50 bg-[#0D1117] p-4 space-y-3 shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-[#06B6D4]/40 bg-[#06B6D4]/15 text-[#06B6D4]">
            <Smartphone className="size-5" />
          </span>
          <div className="space-y-1">
            <p className="text-xs font-mono font-bold uppercase tracking-wider text-[#06B6D4]">
              Save Mobile Biometric (Thumb / Face ID)
            </p>
            <p className="text-xs font-sans text-[#F0F6FC] leading-relaxed">
              Your Founder PIN is verified. Enable Thumb / Face ID on this mobile so future logins offer both <strong>Biometric</strong> and <strong>PIN</strong>.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss biometric prompt"
          className="min-h-[44px] min-w-[44px] grid place-items-center rounded-lg text-[#8B949E] hover:text-[#F0F6FC]"
        >
          <X className="size-4" />
        </button>
      </div>

      {error && (
        <p className="text-xs font-mono text-[#F85149]">{error}</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={isEnrolling}
          onClick={handleEnroll}
          className="min-h-[48px] flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-xl bg-[#06B6D4] hover:bg-[#22D3EE] disabled:opacity-60 px-4 py-2 text-xs font-mono font-black text-[#0D1117] uppercase transition"
        >
          <Fingerprint className="size-4" />
          <span>{isEnrolling ? 'Scanning Biometric...' : 'Add Founder Biometric Now'}</span>
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="min-h-[48px] rounded-xl border border-[#30363D] bg-[#161B22] px-4 py-2 text-xs font-mono font-bold text-[#8B949E] hover:text-[#F0F6FC] transition"
        >
          Maybe Later
        </button>
      </div>
    </div>
  );
};
