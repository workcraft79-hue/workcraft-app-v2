import React, { useState } from 'react';
import { Lock, ShieldAlert, ShieldCheck, KeyRound, Eye, EyeOff, ArrowRight, Ban } from 'lucide-react';
import { WATERMARK_URL } from '../data/portalData';
import { verifyFounderPin, DetectedPublicRoute, AUDIT_EXPIRES_AT_ISO } from '../config/auditWindow';

interface FounderPinGateProps {
  blockedRoute: DetectedPublicRoute;
  isGenuineWindowStillOpen: boolean;
  onUnlockSuccess: (mode: 'FOUNDER' | 'RESUME_AUDIT') => void;
}

export const FounderPinGate: React.FC<FounderPinGateProps> = ({
  blockedRoute,
  isGenuineWindowStillOpen,
  onUnlockSuccess,
}) => {
  const [pinInput, setPinInput] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [showFounderFormForBlockedRoute, setShowFounderFormForBlockedRoute] = useState(
    blockedRoute.type === null
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinInput.trim()) {
      setErrorMsg('Enter your Founder Security PIN to unlock.');
      return;
    }
    setIsVerifying(true);
    setErrorMsg(null);
    const valid = await verifyFounderPin(pinInput);
    setIsVerifying(false);
    if (valid) {
      onUnlockSuccess('FOUNDER');
    } else {
      setErrorMsg('Invalid Security PIN. Access remains locked.');
      setPinInput('');
    }
  };

  return (
    <main className="min-h-screen bg-[#0D1117] text-[#F0F6FC] font-sans flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md rounded-3xl border border-[#30363D] bg-[#161B22] p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="flex flex-col items-center text-center space-y-3">
          <img
            src={WATERMARK_URL}
            alt="WORKCRAFT"
            className="h-auto w-[150px] object-contain opacity-95"
          />

          {blockedRoute.type ? (
            <div className="size-14 rounded-2xl bg-[#4C1C1D] border border-[#da3633] grid place-items-center text-[#F85149]">
              <Ban className="size-7" />
            </div>
          ) : (
            <div className="size-14 rounded-2xl bg-[#3B2E0B] border border-[#9E6A03] grid place-items-center text-[#D29922]">
              <Lock className="size-7" />
            </div>
          )}

          {blockedRoute.type ? (
            <div className="space-y-1.5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#da3633] bg-[#4C1C1D] px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-[#F85149]">
                <ShieldAlert className="size-3" />
                Public Role Link Blocked
              </span>
              <h1 className="text-xl font-black text-[#F0F6FC] tracking-tight pt-1">
                24-Hour Inspection Window Closed
              </h1>
              <p className="text-xs text-[#8B949E] leading-relaxed">
                Public test access via{' '}
                <code className="rounded bg-[#0D1117] border border-[#30363D] px-1.5 py-0.5 font-mono text-[#D29922]">
                  {blockedRoute.label || blockedRoute.type}
                </code>{' '}
                is automatically locked after the 24-hour audit window ({AUDIT_EXPIRES_AT_ISO}).
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#9E6A03] bg-[#3B2E0B] px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-[#D29922]">
                <ShieldCheck className="size-3" />
                Founder Security Lock Active
              </span>
              <h1 className="text-xl font-black text-[#F0F6FC] tracking-tight pt-1">
                WorkCraft Command Center Locked
              </h1>
              <p className="text-xs text-[#8B949E] leading-relaxed">
                The temporary 24-hour public inspection window has ended. Enter your Founder Security PIN to access the portal.
              </p>
            </div>
          )}
        </div>

        {blockedRoute.type && !showFounderFormForBlockedRoute ? (
          <div className="space-y-3 pt-1">
            <div className="rounded-2xl border border-[#30363D] bg-[#0D1117] p-4 text-xs text-[#8B949E] space-y-1.5">
              <p className="font-mono font-bold text-[#F0F6FC] text-[11px] uppercase">
                Protected Production Procedure
              </p>
              <p className="leading-relaxed">
                Public role URLs (<span className="font-mono text-[#F0F6FC]">?role=salon_owner</span> and{' '}
                <span className="font-mono text-[#F0F6FC]">?role=agent</span>) are disabled. Only Founder authentication can unlock the dashboard.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowFounderFormForBlockedRoute(true)}
              className="w-full min-h-[48px] rounded-xl border border-[#06B6D4]/50 bg-[#06B6D4]/10 hover:bg-[#06B6D4]/20 text-[#06B6D4] px-4 py-2.5 text-xs font-mono font-bold uppercase transition flex items-center justify-center gap-2"
            >
              <KeyRound className="size-4" />
              <span>Founder Override (Enter PIN)</span>
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="founder-pin-input"
                className="block text-[11px] font-mono font-bold uppercase tracking-wider text-[#8B949E] mb-1.5"
              >
                Founder Security PIN
              </label>
              <div className="relative">
                <input
                  id="founder-pin-input"
                  type={showPin ? 'text' : 'password'}
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder="Enter Security PIN"
                  autoComplete="off"
                  autoFocus
                  className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] pl-4 pr-12 py-3 text-sm font-mono tracking-widest text-[#F0F6FC] focus:border-[#06B6D4] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPin((prev) => !prev)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[36px] min-w-[36px] grid place-items-center text-[#8B949E] hover:text-[#F0F6FC]"
                  aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
                >
                  {showPin ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {errorMsg && (
                <p className="mt-2 text-xs font-mono text-[#F85149] flex items-center gap-1.5">
                  <ShieldAlert className="size-3.5 shrink-0" />
                  <span>{errorMsg}</span>
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isVerifying}
              className="w-full min-h-[48px] rounded-xl bg-[#06B6D4] hover:bg-[#22D3EE] text-[#0D1117] px-5 py-2.5 text-xs font-mono font-bold uppercase transition active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <span>{isVerifying ? 'Verifying...' : 'Unlock Founder Portal'}</span>
              <ArrowRight className="size-4" />
            </button>
          </form>
        )}

        {isGenuineWindowStillOpen && (
          <div className="pt-2 border-t border-[#21262D] text-center">
            <button
              type="button"
              onClick={() => onUnlockSuccess('RESUME_AUDIT')}
              className="text-[11px] font-mono text-[#8B949E] hover:text-[#06B6D4] underline transition"
            >
              Exit Lock Preview &amp; Resume Active 24h Inspection Window
            </button>
          </div>
        )}
      </div>
    </main>
  );
};
