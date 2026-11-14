import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  KeyRound,
  Lock,
  Phone,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import type { AuthUser, DevTestAccount } from '../types/auth';
import { WATERMARK_URL } from '../data/portalData';

export interface PostInstallChallenge {
  identifier: string;
  maskedTarget: string;
  targetName: string;
  salonName: string;
  devOtpPreview?: string | null;
}

interface AuthLoginScreenProps {
  onAuthenticated: (user: AuthUser) => void;
  onStartSelfOnboarding?: () => void;
  postInstallChallenge?: PostInstallChallenge | null;
  onClearPostInstallChallenge?: () => void;
  externalNotice?: string | null;
}

export const AuthLoginScreen: React.FC<AuthLoginScreenProps> = ({
  onAuthenticated,
  onStartSelfOnboarding,
  postInstallChallenge,
  onClearPostInstallChallenge,
  externalNotice,
}) => {
  const [step, setStep] = useState<'IDENTIFIER' | 'OTP'>(
    postInstallChallenge ? 'OTP' : 'IDENTIFIER'
  );
  const [identifier, setIdentifier] = useState(postInstallChallenge?.identifier || '');
  const [otp, setOtp] = useState('');
  const [maskedTarget, setMaskedTarget] = useState(postInstallChallenge?.maskedTarget || '');
  const [targetName, setTargetName] = useState(postInstallChallenge?.targetName || '');
  const [devOtpHint, setDevOtpHint] = useState<string | null>(
    postInstallChallenge?.devOtpPreview ?? null
  );
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Strict Dev-Only Quick Switch Test Accounts (only hydrated when NODE_ENV === 'development')
  const [devAccounts, setDevAccounts] = useState<DevTestAccount[]>([]);
  const [isDevSwitching, setIsDevSwitching] = useState<string | null>(null);

  useEffect(() => {
    if (!postInstallChallenge) return;
    setStep('OTP');
    setIdentifier(postInstallChallenge.identifier);
    setMaskedTarget(postInstallChallenge.maskedTarget);
    setTargetName(postInstallChallenge.targetName);
    setDevOtpHint(postInstallChallenge.devOtpPreview ?? null);
    setOtp('');
    setError(null);
  }, [postInstallChallenge]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    let cancelled = false;
    fetch('/api/auth/dev-accounts')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { accounts?: DevTestAccount[] } | null) => {
        if (!cancelled && Array.isArray(data?.accounts)) {
          setDevAccounts(data.accounts);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleaned = identifier.trim();
    if (!cleaned) {
      setError('Enter your registered email address or WhatsApp phone number.');
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: cleaned }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'Could not initiate verification.');
        return;
      }
      setMaskedTarget(data.maskedTarget || cleaned);
      setTargetName(data.displayName || 'Authorized User');
      setDevOtpHint(typeof data.devOtpPreview === 'string' ? data.devOtpPreview : null);
      setOtp('');
      setStep('OTP');
    } catch {
      setError('Network error while requesting verification code.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleanedOtp = otp.replace(/\D/g, '').slice(0, 6);
    if (cleanedOtp.length !== 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim(), otp: cleanedOtp }),
      });
      const data = await res.json();
      if (!res.ok || !data?.user) {
        setError(data?.error || 'Verification failed. Check your code and try again.');
        return;
      }
      onClearPostInstallChallenge?.();
      onAuthenticated(data.user as AuthUser);
    } catch {
      setError('Network error while verifying code.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDevQuickLogin = async (userId: string) => {
    if (!import.meta.env.DEV) return;
    setError(null);
    setIsDevSwitching(userId);
    try {
      const res = await fetch('/api/auth/dev-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok || !data?.user) {
        setError(data?.error || 'Quick switch failed.');
        return;
      }
      onClearPostInstallChallenge?.();
      onAuthenticated(data.user as AuthUser);
    } catch {
      setError('Could not connect to dev session endpoint.');
    } finally {
      setIsDevSwitching(null);
    }
  };

  return (
    <main className="min-h-screen bg-[#0D1117] text-[#F0F6FC] flex flex-col items-center justify-center px-4 py-10 pb-28">
      <div className="w-full max-w-md space-y-5">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center space-y-2">
          <img
            src={WATERMARK_URL}
            alt="WORKCRAFT"
            className="h-auto w-[168px] object-contain opacity-95"
          />
          <div className="inline-flex items-center gap-1.5 rounded-lg border border-[#116329] bg-[#0D3822] px-3 py-1 text-[11px] font-mono font-bold text-[#3FB950]">
            <ShieldCheck className="size-3.5 shrink-0" />
            <span>SESSION AUTHENTICATED · TENANT ISOLATED</span>
          </div>
        </div>

        {/* Main Login Card */}
        <section className="rounded-2xl border border-[#30363D] bg-[#161B22] p-5 sm:p-6 space-y-5">
          <div className="space-y-1 border-b border-[#30363D] pb-4">
            <h1 className="text-xl font-black tracking-tight text-[#F0F6FC]">
              {postInstallChallenge && step === 'OTP'
                ? 'Post-Install Security Verification'
                : step === 'IDENTIFIER'
                ? 'Sign in to WORKCRAFT Local'
                : 'Verify 6-Digit Login Code'}
            </h1>
            <p className="text-xs text-[#8B949E] leading-relaxed">
              {step === 'IDENTIFIER'
                ? 'Enter your registered WhatsApp number or email to receive a one-time session code bound to your role and tenant.'
                : `Enter the 6-digit OTP issued for ${targetName} (${maskedTarget}).`}
            </p>
          </div>

          {postInstallChallenge && step === 'OTP' && (
            <div className="rounded-xl border border-[#116329] bg-[#0D3822] px-3.5 py-3 text-xs font-mono text-[#3FB950] space-y-1">
              <p className="font-bold">
                ✓ Installation & WhatsApp Pairing Complete for {postInstallChallenge.salonName}
              </p>
              <p className="text-[11px] text-[#F0F6FC]/85 font-sans">
                Complete this one-time OTP security check to lock your session cookie to your salon tenant and open your Live Floor Dashboard.
              </p>
            </div>
          )}

          {externalNotice && !error && (
            <div className="rounded-xl border border-[#9E6A03] bg-[#3B2E0B] px-3.5 py-2.5 text-xs font-mono font-bold text-[#D29922] break-words [overflow-wrap:break-word]">
              {externalNotice}
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-[#da3633] bg-[#4C1C1D] px-3.5 py-2.5 text-xs font-mono font-bold text-[#F85149] break-words [overflow-wrap:break-word]">
              {error}
            </div>
          )}

          {step === 'IDENTIFIER' ? (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <label className="block space-y-1.5">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#8B949E] flex items-center gap-1.5">
                  <Phone className="size-3.5 text-[#06B6D4]" />
                  WhatsApp Phone or Email
                </span>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g. +92 321 8472910 or email"
                  autoComplete="username"
                  className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3.5 py-2.5 text-base text-[#F0F6FC] placeholder:text-[#6E7681] focus:border-[#06B6D4] focus:outline-none"
                />
              </label>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full min-h-[48px] rounded-xl bg-[#06B6D4] hover:bg-[#22D3EE] text-[#0D1117] px-4 py-3 text-xs font-mono font-black uppercase tracking-wider transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <RefreshCw className="size-4 animate-spin" />
                ) : (
                  <KeyRound className="size-4" />
                )}
                <span>{isLoading ? 'Sending OTP...' : 'Send 6-Digit Login OTP'}</span>
                <ArrowRight className="size-4" />
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              {devOtpHint && (
                <div className="rounded-xl border border-[#9E6A03] bg-[#3B2E0B] p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-[10px] font-mono font-bold uppercase text-[#D29922] block">
                      DEV OTP PREVIEW (NODE_ENV=development)
                    </span>
                    <span className="text-base font-mono font-black tracking-widest text-[#F0F6FC]">
                      {devOtpHint}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOtp(devOtpHint)}
                    className="min-h-[40px] rounded-lg border border-[#D29922] bg-[#0D1117] px-3 py-1.5 text-[11px] font-mono font-bold text-[#D29922] hover:bg-[#21262D] shrink-0"
                  >
                    Auto-Fill
                  </button>
                </div>
              )}

              <label className="block space-y-1.5">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#8B949E] flex items-center gap-1.5">
                  <Lock className="size-3.5 text-[#06B6D4]" />
                  6-Digit Verification Code
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6-digit OTP"
                  autoComplete="one-time-code"
                  className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3.5 py-2.5 text-base font-mono font-bold tracking-[0.35em] text-[#F0F6FC] placeholder:text-[#6E7681] placeholder:tracking-normal focus:border-[#06B6D4] focus:outline-none"
                />
              </label>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setStep('IDENTIFIER');
                    setError(null);
                    setDevOtpHint(null);
                    onClearPostInstallChallenge?.();
                  }}
                  className="min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] hover:bg-[#21262D] px-4 py-2.5 text-xs font-mono font-bold text-[#8B949E] hover:text-[#F0F6FC] transition"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 min-h-[48px] rounded-xl bg-[#06B6D4] hover:bg-[#22D3EE] text-[#0D1117] px-4 py-2.5 text-xs font-mono font-black uppercase tracking-wider transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isLoading ? (
                    <RefreshCw className="size-4 animate-spin" />
                  ) : (
                    <UserCheck className="size-4" />
                  )}
                  <span>{isLoading ? 'Verifying...' : 'Verify & Open Portal'}</span>
                </button>
              </div>
            </form>
          )}
        </section>

        {/* Zero-Privilege New Salon Owner Self-Onboarding & PWA Installation Entry */}
        {step === 'IDENTIFIER' && onStartSelfOnboarding && (
          <section className="rounded-2xl border border-[#30363D] bg-[#161B22] p-4 sm:p-5 space-y-3">
            <div className="space-y-1">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#06B6D4] block">
                New Salon Partner?
              </span>
              <h2 className="text-sm font-bold text-[#F0F6FC]">
                Setup Shop, Pair WhatsApp & Install App First
              </h2>
              <p className="text-[11px] text-[#8B949E] leading-relaxed">
                Complete the 4-step salon installation wizard first, then verify your 6-digit OTP to unlock your live tenant-isolated dashboard.
              </p>
            </div>
            <button
              type="button"
              onClick={onStartSelfOnboarding}
              className="w-full min-h-[48px] rounded-xl border border-[#06B6D4] bg-[#0D1117] hover:bg-[#21262D] text-[#06B6D4] px-4 py-2.5 text-xs font-mono font-bold uppercase tracking-wider transition flex items-center justify-center gap-2"
            >
              <span>New Salon Owner? Complete 4-Step Setup & Install</span>
              <ArrowRight className="size-4" />
            </button>
          </section>
        )}

        {/* Dev-Only Quick Switch Test Account Selector (Strict NODE_ENV === 'development') */}
        {import.meta.env.DEV && devAccounts.length > 0 && (
          <section className="rounded-2xl border border-[#30363D] bg-[#161B22] p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between gap-2 border-b border-[#30363D] pb-2.5">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-[#D29922] shrink-0" />
                <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-[#D29922]">
                  Quick Switch Test Account (Dev Only)
                </h2>
              </div>
              <span className="rounded border border-[#9E6A03] bg-[#3B2E0B] px-2 py-0.5 text-[10px] font-mono font-bold text-[#D29922]">
                DEV
              </span>
            </div>
            <p className="text-[11px] text-[#8B949E] leading-snug">
              Issues a real signed JWT HttpOnly session bound to the selected role and tenant ID. Hidden in production builds.
            </p>
            <div className="grid grid-cols-1 gap-2">
              {devAccounts.map((acc) => {
                const isBusy = isDevSwitching === acc.userId;
                return (
                  <button
                    key={acc.userId}
                    type="button"
                    disabled={Boolean(isDevSwitching)}
                    onClick={() => handleDevQuickLogin(acc.userId)}
                    className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] hover:border-[#06B6D4] px-3.5 py-2.5 text-left transition flex items-center justify-between gap-3 disabled:opacity-50"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-[#F0F6FC] truncate">
                          {acc.displayName}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-mono font-bold uppercase ${
                            acc.userRole === 'FOUNDER'
                              ? 'bg-[#3B2E0B] text-[#D29922] border border-[#9E6A03]'
                              : acc.userRole === 'AGENT'
                              ? 'bg-[#21262D] text-[#06B6D4] border border-[#30363D]'
                              : 'bg-[#0D3822] text-[#3FB950] border border-[#116329]'
                          }`}
                        >
                          {acc.userRole}
                        </span>
                      </div>
                      <p className="text-[11px] font-mono text-[#8B949E] truncate mt-0.5">
                        {acc.badge}
                      </p>
                      <p className="text-[10px] font-mono text-[#6E7681] break-all">
                        {acc.phone} · {acc.email}
                      </p>
                    </div>
                    {isBusy ? (
                      <RefreshCw className="size-4 animate-spin text-[#06B6D4] shrink-0" />
                    ) : (
                      <ArrowRight className="size-4 text-[#06B6D4] shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </main>
  );
};
