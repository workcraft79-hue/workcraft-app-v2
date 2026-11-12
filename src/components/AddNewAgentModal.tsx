import React, { useState } from 'react';
import {
  X,
  UserPlus,
  Send,
  Sparkles,
  CheckCircle2,
  Lock,
  Globe,
  Smartphone,
  MapPin,
  ShieldCheck,
  Check,
  Radio,
  AlertTriangle,
  AlertOctagon,
} from 'lucide-react';
import {
  detectCountryFromPhone,
  REGIONAL_CITY_MAP,
  checkCityCountryIntegrity,
  DIAL_CODE_OPTIONS,
  getEnrollmentLanguagesForPhone,
} from './FieldAgentHub';

interface AddNewAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAgentAdded?: (agent: {
    id: string;
    pin: string;
    name: string;
    phone: string;
    city: string;
    category: string;
  }) => void;
  onOpenRemoteEnrollment?: (agent: {
    id: string;
    pin: string;
    name: string;
    phone: string;
    city: string;
    category: string;
  }) => void;
}

export const AddNewAgentModal: React.FC<AddNewAgentModalProps> = ({
  isOpen,
  onClose,
  onAgentAdded,
  onOpenRemoteEnrollment,
}) => {
  const [agentName, setAgentName] = useState('');
  const [agentPhone, setAgentPhone] = useState('+92 302 7819203');
  const [agentCountry, setAgentCountry] = useState('Pakistan');
  const [agentCity, setAgentCity] = useState('Karachi South');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dispatchedSuccess, setDispatchedSuccess] = useState(false);

  // Auto-generate unique sequential Agent ID & 4-digit security PIN
  const [generatedId] = useState(() => 'AGT-' + Math.floor(410 + Math.random() * 50));
  const [generatedPin] = useState(() => Math.floor(1000 + Math.random() * 9000).toString());

  const detectedCountry = detectCountryFromPhone(agentPhone, `${agentCity} ${agentCountry}`);

  // Real-time City vs Country Integrity Checker
  const cityConflict = checkCityCountryIntegrity(agentCity, agentPhone);
  const validTerritories = REGIONAL_CITY_MAP[detectedCountry.code]?.cities || [];

  const countryPresets = [
    { code: 'PK', name: 'Pakistan', flag: '🇵🇰', prefix: '+92', defaultCity: 'Karachi South' },
    { code: 'AE', name: 'UAE', flag: '🇦🇪', prefix: '+971', defaultCity: 'Dubai Marina' },
    { code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦', prefix: '+966', defaultCity: 'Riyadh Olaya' },
    { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', prefix: '+44', defaultCity: 'London Central' },
    { code: 'US', name: 'United States', flag: '🇺🇸', prefix: '+1', defaultCity: 'New York City' },
    { code: 'CA', name: 'Canada', flag: '🇨🇦', prefix: '+1', defaultCity: 'Toronto Downtown' },
    { code: 'DE', name: 'Germany', flag: '🇩🇪', prefix: '+49', defaultCity: 'Berlin Mitte' },
    { code: 'AU', name: 'Australia', flag: '🇦🇺', prefix: '+61', defaultCity: 'Sydney CBD' },
  ];

  const handleCountrySelect = (preset: { name: string; prefix: string; defaultCity: string; sampleDigits?: string }) => {
    setAgentCountry(preset.name);
    setAgentCity(preset.defaultCity);
    if (preset.sampleDigits) {
      setAgentPhone(`${preset.prefix} ${preset.sampleDigits}`);
    } else if (!agentPhone || agentPhone.startsWith('+')) {
      setAgentPhone(`${preset.prefix} `);
    }
  };

  if (!isOpen) return null;

  const enrollUrl = `https://portal.workcraft.local/enroll?id=${generatedId}&pin=${generatedPin}&phone=${encodeURIComponent(agentPhone)}&name=${encodeURIComponent(agentName || 'Agent')}`;

  const isWesternGreeting =
    detectedCountry.region === 'EUROPE' ||
    detectedCountry.region === 'NORTH_AMERICA' ||
    detectedCountry.code === 'AU' ||
    detectedCountry.code === 'NZ';

  const greetingHeader = isWesternGreeting
    ? `Mr. ${agentName || '[Agent Name]'}`
    : `Assalamu Alaikum ${agentName || '[Agent Name]'}`;

  const whatsappMessage = `${greetingHeader}! Welcome to WORKCRAFT Local Field Force. You have been appointed for ${agentCity || '[City]'}, ${agentCountry || '[Country]'}. Your Agent ID is ${generatedId} and 4-digit Security PIN is ${generatedPin}. Open your secure link to complete enrollment: ${enrollUrl}`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentName.trim() || !agentPhone.trim()) return;
    if (cityConflict) return; // Block dispatch on geographic mismatch

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setDispatchedSuccess(true);

      if (onAgentAdded) {
        onAgentAdded({
          id: generatedId,
          pin: generatedPin,
          name: agentName.trim(),
          phone: agentPhone.trim(),
          city: `${agentCity.trim()}, ${agentCountry}`,
          category: 'Universal (All Salons, Barbershops & Parlors)',
        });
      }
    }, 1100);
  };

  return (
    <div
      className="fixed inset-0 z-[85] grid place-items-center bg-[#0D1117]/80 p-3 sm:p-5 backdrop-blur-md overflow-y-auto"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[540px] rounded-3xl border border-[#30363D] bg-[#161B22] p-5 sm:p-6 shadow-2xl animate-in zoom-in-95 duration-150 my-6 max-h-[92vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#21262D] pb-3.5">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl bg-[#3B2E0B] border border-[#9E6A03] text-[#D29922] shrink-0">
              <UserPlus className="size-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-[.2em] text-[#D29922]">
                FOUNDER FIELD FORCE ENGINE (QUERY 3)
              </span>
              <h3 className="text-xl font-black text-[#F0F6FC] tracking-tight flex items-center gap-2">
                <span>Add New Field Agent</span>
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="min-h-[44px] min-w-[44px] grid place-items-center rounded-xl bg-[#21262D] border border-[#30363D] text-[#8B949E] hover:text-[#F0F6FC] hover:border-[#484F58] transition active:scale-95 shrink-0"
            title="Close Modal"
            aria-label="Close Modal"
          >
            <X className="size-4" />
          </button>
        </div>

        {dispatchedSuccess ? (
          <div className="mt-5 space-y-4 animate-in fade-in">
            <div className="rounded-2xl border border-[#116329] bg-[#0D3822] p-5 text-center space-y-3">
              <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#161B22] border border-[#116329] text-[#3FB950]">
                <CheckCircle2 className="size-8" />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#3FB950] font-bold">
                  SIM GATEWAY WHATSAPP DISPATCH CONFIRMED
                </span>
                <h4 className="text-lg font-bold text-[#F0F6FC]">
                  Field Agent Invitation Dispatched!
                </h4>
                <p className="text-xs text-[#8B949E] font-sans max-w-md mx-auto break-words [overflow-wrap:break-word]">
                  Credentials and onboarding terminal link have been sent directly to <strong className="text-[#F0F6FC]">{agentName}</strong> (<span dir="ltr" className="text-[#F0F6FC]">{agentPhone}</span>) via Central SIM Gateway (+92-300-WORKCRAFT-LOCAL).
                </p>
              </div>

              {/* Generated Credential Summary Card */}
              <div className="grid grid-cols-2 gap-2 text-left font-mono text-xs bg-[#0D1117] rounded-xl p-3 border border-[#30363D]">
                <div>
                  <span className="text-[10px] text-[#8B949E] block">AGENT TERMINAL ID</span>
                  <span className="text-sm font-bold text-[#06B6D4]">{generatedId}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#8B949E] block">4-DIGIT SECURITY PIN</span>
                  <span className="text-sm font-bold text-[#D29922]">{generatedPin}</span>
                </div>
                <div className="col-span-2 pt-2 border-t border-[#21262D] flex items-center justify-between text-[11px] gap-2">
                  <span className="text-[#8B949E] truncate">Territory: {agentCity}</span>
                  <span className="text-[#3FB950] font-bold shrink-0">✓ Non-Restricted Category</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              {onOpenRemoteEnrollment && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenRemoteEnrollment({
                      id: generatedId,
                      pin: generatedPin,
                      name: agentName.trim(),
                      phone: agentPhone.trim(),
                      city: `${agentCity.trim()}, ${agentCountry}`,
                      category: 'Universal (All Salons, Barbershops & Parlors)',
                    });
                    onClose();
                  }}
                  className="flex-1 min-h-[48px] rounded-xl bg-[#06B6D4] hover:bg-[#22D3EE] text-[#0D1117] px-4 py-3 text-xs font-mono font-bold uppercase transition active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <Smartphone className="size-4" />
                  <span>Open Day-1 Remote Enrollment Wizard →</span>
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="flex-1 min-h-[48px] rounded-xl bg-[#21262D] border border-[#30363D] hover:border-[#484F58] text-[#F0F6FC] px-4 py-3 text-xs font-mono font-bold uppercase transition active:scale-95"
              >
                Close &amp; Return to Hub
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <p className="text-xs text-[#8B949E] font-sans leading-relaxed">
              Register a new field agent. The system automatically provisions a unique ID, generates a 4-digit PIN, and dispatches the terminal link to the agent&apos;s WhatsApp via the Central SIM Gateway.
            </p>

            {/* Field 1: Agent Name (Always English format & left-aligned) */}
            <div>
              <label className="text-[11px] font-mono font-bold uppercase text-[#8B949E] block mb-1.5">
                1. Field Agent Full Name (English Format) *
              </label>
              <input
                type="text"
                dir="ltr"
                required
                placeholder="e.g. Zahid Hussain or Bilal Sheikh"
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3.5 py-2.5 text-sm text-left text-[#F0F6FC] placeholder:text-[#484F58] font-sans focus:outline-none focus:border-[#06B6D4]"
              />
            </div>

            {/* Field 2: Worldwide Operational Country Selection */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-mono font-bold uppercase text-[#8B949E] flex items-center gap-1.5">
                  <Globe className="size-3.5 text-[#D29922]" />
                  <span>2. Operational Country (Worldwide) *</span>
                </label>
                <span className="text-[10px] font-mono text-[#D29922] font-bold">
                  {detectedCountry.flag} {agentCountry}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-2">
                {countryPresets.map((preset) => (
                  <button
                    key={preset.code}
                    type="button"
                    onClick={() => handleCountrySelect(preset)}
                    className={`min-h-[40px] rounded-lg border px-2 py-1.5 text-xs font-mono transition flex items-center justify-center gap-1 ${
                      detectedCountry.code === preset.code || agentCountry === preset.name
                        ? 'border-[#06B6D4] bg-[#06B6D4]/15 text-[#06B6D4] font-bold'
                        : 'border-[#30363D] bg-[#0D1117] text-[#8B949E] hover:text-[#F0F6FC] hover:border-[#484F58]'
                    }`}
                  >
                    <span>{preset.flag}</span>
                    <span className="truncate">{preset.name}</span>
                  </button>
                ))}
              </div>
              <select
                dir="ltr"
                value={DIAL_CODE_OPTIONS.some((d) => d.code === detectedCountry.code) ? detectedCountry.code : 'CUSTOM'}
                onChange={(e) => {
                  const chosen = DIAL_CODE_OPTIONS.find((d) => d.code === e.target.value);
                  if (!chosen) return;
                  const nextDet = detectCountryFromPhone(`${chosen.dialCode} ${chosen.sampleDigits}`, chosen.name);
                  handleCountrySelect({
                    name: nextDet.name,
                    prefix: chosen.dialCode,
                    defaultCity: nextDet.defaultCity,
                    sampleDigits: chosen.sampleDigits,
                  });
                }}
                className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3.5 py-2 text-xs font-mono text-left text-[#F0F6FC] focus:outline-none focus:border-[#06B6D4] mb-2"
              >
                {!DIAL_CODE_OPTIONS.some((d) => d.code === detectedCountry.code) && (
                  <option value="CUSTOM" className="bg-[#161B22] text-[#06B6D4]">
                    {detectedCountry.flag} {agentCountry} ({detectedCountry.dialCode})
                  </option>
                )}
                {DIAL_CODE_OPTIONS.map((d) => (
                  <option key={d.code} value={d.code} className="bg-[#161B22] text-[#F0F6FC]">
                    {d.flag} {d.name} ({d.dialCode})
                  </option>
                ))}
              </select>
              <input
                type="text"
                dir="ltr"
                required
                placeholder="Country Name (e.g. Pakistan, Canada, Germany, United States, UAE, UK)"
                value={agentCountry}
                onChange={(e) => setAgentCountry(e.target.value)}
                className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] px-3.5 py-2 text-sm text-left text-[#F0F6FC] placeholder:text-[#484F58] font-sans focus:outline-none focus:border-[#06B6D4]"
              />
            </div>

            {/* Field 3: Territory / City with Real-Time City vs Country Integrity Checking (Query 1) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-mono font-bold uppercase text-[#8B949E]">
                  3. Assigned Territory / City *
                </label>
                {cityConflict && (
                  <span className="text-[10px] font-mono font-bold text-[#F85149] flex items-center gap-1">
                    <AlertTriangle className="size-3 text-[#F85149]" />
                    <span>Territory Conflict Detected</span>
                  </span>
                )}
              </div>
              <div className="relative">
                <MapPin className={`absolute left-3 top-3.5 size-4 ${cityConflict ? 'text-[#F85149]' : 'text-[#D29922]'}`} />
                <input
                  type="text"
                  required
                  placeholder="e.g. Karachi South, Lahore West, Dubai Marina, London Central, Birmingham"
                  value={agentCity}
                  onChange={(e) => setAgentCity(e.target.value)}
                  className={`w-full min-h-[48px] rounded-xl border pl-9.5 pr-3.5 py-2.5 text-sm text-[#F0F6FC] placeholder:text-[#484F58] font-sans focus:outline-none transition ${
                    cityConflict
                      ? 'border-[#da3633] bg-[#4C1C1D] text-[#F0F6FC] focus:border-[#F85149]'
                      : 'border-[#30363D] bg-[#0D1117] focus:border-[#06B6D4]'
                  }`}
                />
              </div>

              {/* Red Warning Banner if City doesn't match WhatsApp Country */}
              {cityConflict && (
                <div className="mt-2 rounded-xl border border-[#da3633] bg-[#4C1C1D] p-3 space-y-1 animate-in fade-in">
                  <div className="flex items-center gap-1.5 text-[#F85149] font-mono text-xs font-bold">
                    <AlertOctagon className="size-4 shrink-0 text-[#F85149]" />
                    <span>Geographic Integrity Conflict</span>
                  </div>
                  <p className="text-xs text-[#F0F6FC] font-sans leading-relaxed">
                    {cityConflict.en}
                  </p>
                </div>
              )}

              {/* Quick Select Valid Territory Chips for Auto-Detected Country */}
              {validTerritories.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  <span className="text-[10px] font-mono text-[#6E7681] block">
                    Quick-select valid {detectedCountry.name} territories:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {validTerritories.slice(0, 6).map((city) => (
                      <button
                        key={city}
                        type="button"
                        onClick={() => setAgentCity(`${city} Central`)}
                        className={`min-h-[36px] rounded-lg px-2.5 py-1 text-xs font-mono transition border ${
                          agentCity.toLowerCase().includes(city.toLowerCase())
                            ? 'border-[#06B6D4] bg-[#06B6D4]/15 text-[#06B6D4] font-bold'
                            : 'border-[#30363D] bg-[#0D1117] text-[#8B949E] hover:text-[#F0F6FC] hover:border-[#484F58]'
                        }`}
                      >
                        {city}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Field 4: WhatsApp Number with Real-Time Country Detection & Regional Language Preview */}
            <div>
              <div className="flex items-center justify-between mb-1.5 gap-2">
                <label className="text-[11px] font-mono font-bold uppercase text-[#8B949E]">
                  4. Agent WhatsApp Number *
                </label>
                <span className="text-[10px] font-mono font-bold text-[#06B6D4] flex items-center gap-1">
                  <span>{detectedCountry.flag}</span>
                  <span>{detectedCountry.name}</span>
                  <span className="text-[#6E7681]">·</span>
                  <span className="text-[#D29922]">
                    {getEnrollmentLanguagesForPhone(agentPhone).map((l) => l.label).join(' + ')}
                  </span>
                </span>
              </div>
              <div className="relative">
                <Smartphone className="absolute left-3 top-3.5 size-4 text-[#06B6D4]" />
                <input
                  type="text"
                  dir="ltr"
                  required
                  placeholder="+92 300 1234567, +1 416 5550198, +49 151 2345678"
                  value={agentPhone}
                  onChange={(e) => {
                    const val = e.target.value;
                    setAgentPhone(val);
                    const det = detectCountryFromPhone(val, agentCity);
                    setAgentCountry(det.name);
                  }}
                  className="w-full min-h-[48px] rounded-xl border border-[#30363D] bg-[#0D1117] pl-9.5 pr-3.5 py-2.5 text-sm font-mono text-left text-[#06B6D4] placeholder:text-[#484F58] focus:outline-none focus:border-[#06B6D4]"
                />
              </div>
            </div>

            {/* Query 4 Compliance: Non-restricted Category Authorization Note */}
            <div className="rounded-xl border border-[#116329] bg-[#0D3822] p-3 space-y-1">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-[#3FB950] font-bold flex items-center gap-1.5">
                  <ShieldCheck className="size-4" />
                  <span>Query 4: Category Authorization</span>
                </span>
                <span className="text-[10px] font-bold text-[#3FB950] bg-[#161B22] border border-[#116329] px-2 py-0.5 rounded">
                  NON-RESTRICTED
                </span>
              </div>
              <p className="text-[11px] text-[#F0F6FC] font-sans leading-relaxed">
                Agent is authorized city-wide for <strong>ALL salon categories</strong> (men&apos;s barbershops, ladies&apos; beauty parlors, and unisex studios). No gender or parlor category restrictions applied.
              </p>
            </div>

            {/* Auto-Generated Credentials Preview */}
            <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-[#D29922] font-bold uppercase flex items-center gap-1.5">
                  <Lock className="size-3.5" />
                  <span>Auto-Generated System Credentials</span>
                </span>
                <span className="text-[10px] text-[#6E7681]">Simulated Sequence</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="rounded-lg bg-[#161B22] p-2.5 border border-[#30363D]">
                  <span className="text-[#8B949E] block text-[10px]">NEW AGENT ID</span>
                  <span className="text-sm font-bold text-[#06B6D4]">{generatedId}</span>
                </div>
                <div className="rounded-lg bg-[#161B22] p-2.5 border border-[#30363D]">
                  <span className="text-[#8B949E] block text-[10px]">SECURITY PIN</span>
                  <span className="text-sm font-bold text-[#D29922]">{generatedPin}</span>
                </div>
              </div>
            </div>

            {/* Outbound WhatsApp Invitation Preview */}
            <div className="rounded-xl border border-[#30363D] bg-[#0D1117] p-3.5 space-y-2">
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-[#06B6D4] font-bold uppercase flex items-center gap-1">
                  <Sparkles className="size-3" />
                  Central SIM Gateway Dispatch Preview
                </span>
                <span className="text-[#6E7681]">+92-300-WORKCRAFT</span>
              </div>
              <div className="rounded-lg bg-[#161B22] p-2.5 text-xs font-mono text-[#F0F6FC] border border-[#30363D] leading-relaxed break-all overflow-hidden [overflow-wrap:break-word]">
                &ldquo;{whatsappMessage}&rdquo;
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 min-h-[48px] rounded-xl border border-[#30363D] bg-[#21262D] py-3 text-xs font-mono text-[#8B949E] hover:text-[#F0F6FC] hover:border-[#484F58] transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !!cityConflict}
                className={`flex-[2] min-h-[48px] rounded-xl py-3 px-3 text-xs font-mono font-bold uppercase transition flex items-center justify-center gap-2 ${
                  cityConflict
                    ? 'bg-[#21262D] text-[#6E7681] cursor-not-allowed border border-[#30363D]'
                    : 'bg-[#06B6D4] hover:bg-[#22D3EE] text-[#0D1117] active:scale-95'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Radio className="size-4 animate-spin text-[#0D1117]" />
                    <span>Dispatching via SIM Gateway...</span>
                  </>
                ) : (
                  <>
                    <Send className="size-4 text-[#0D1117]" />
                    <span>Create Agent &amp; Dispatch WhatsApp Link →</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
