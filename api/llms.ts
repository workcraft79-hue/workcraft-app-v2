export const config = {
  runtime: 'edge',
};

const AUDIT_EXPIRES_AT_ISO = '2026-11-19T21:14:20Z';
const AUDIT_EXPIRES_AT_MS = Date.parse(AUDIT_EXPIRES_AT_ISO);

export default function handler(): Response {
  const nowMs = Date.now();
  const auditOpen = nowMs < AUDIT_EXPIRES_AT_MS;

  if (!auditOpen) {
    return new Response(
      '403 Forbidden: The 24-hour public AI inspection window has expired. Public role links and workflow manifests are automatically locked.',
      {
        status: 403,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        },
      }
    );
  }

  const guide = `# WorkCraft Local — 24-Hour AI & Public Workflow Audit Guide
# Window Expires Automatically At: ${AUDIT_EXPIRES_AT_ISO}

## 1. Purpose & Scope
WorkCraft Local is a multi-role mobile SaaS portal for managed WhatsApp automation, live chair queue management, hands-free multi-language voice alerts, field agent commissions, and revenue control for salons and parlors across South Asia (PKR), MENA (AED/SAR), and UK (GBP).
During this 24-hour inspection window, all workflows are open with sample data. Once ${AUDIT_EXPIRES_AT_ISO} passes, public role links automatically lock and Founder PIN protection restores.

## 2. Public Inspection Entry Links (Active During Temporary Audit Window Only)
- Founder Command Center & Full Portal (with Role Preview Switcher in Settings): /
- End User -> Social Ad Bypass into Step 1 Salon Self-Onboarding: /?onboard=true&ref=fb
- End User -> Salon 4-Step Self-Onboarding (Role Link): /?role=salon_owner
- Paired Salon Owner Live Dashboard & End-User WhatsApp Simulator: /?role=salon_owner&paired=true
- Field Agent Command Hub & Biometric Enrollment: /?role=agent

## 3. End-to-End Workflow Architecture
### A. End-User Booking & WhatsApp Concierge Flow (/?role=salon_owner&paired=true -> Rates, Bot & Proof tab)
- Tri-lingual client support (Urdu / Roman Urdu, Arabic, English).
- End-user service cart with automatic Fri-Sun / campaign VIP discount rules.
- Generates SHA-style immutable confirmation receipt and triggers live voice announcement on the Salon Owner dashboard.

### B. 4-Step Salon Self-Onboarding Flow (/?role=salon_owner)
- Step 1: Salon Info, Owner Name, WhatsApp Phone (+92/+971/+966/+44), Address, Men's/Ladies Category, and Language Switcher.
- Step 2: Interactive Service Menu, Rates & Barber Staff Roster.
- Step 3: Package Tier Selection (Starter Setup, Growth Automation, VIP Executive) + 10% Monthly Maintenance SLA fixed to the 5th of each month.
- Step 4: Single-Phone 8-Digit Pairing Code or QR Link -> Automated 2-Message WhatsApp Welcome Dispatch -> 1-Click "WorkCraft" Home Screen PWA Shortcut + Printable Window Poster PDF.

### C. Salon Owner Live Dashboard (/?role=salon_owner&paired=true)
- Top 3-language switcher (Urdu, English, Arabic).
- Live Client Queue with "+ Add Walk-In" modal, Chair Status ("Seat in Chair" / "Mark Done"), and Hands-Free Cross-Language Web Speech Announcements + Rush-Hour Loudspeaker Boost + Counter Screen Wake Lock.
- Package-gated analytics (Top Booked Services filterable per Barber/Stylist, Chair Capacity / Video Deal ROI, Peak Rush Hours, Repeat Retention).
- 5th-of-Month 10% Maintenance Billing & Difference-Only Plan Upgrades.

### D. Field Agent Hub (/?role=agent)
- Strictly isolated from Founder treasury & global controls.
- 4-Step Biometric & ID Agent Enrollment, 20% Agent / 80% WorkCraft commission ledger, PKR cash-held reconciliation, and node connection repair.

### E. Founder Command Center (/)
- Daily Overview, Country-by-Country Queue Pause (PK, AE, SA, GB), WhatsApp Line Health monitor, 1-Tap Social Campaign Marketing Links, 3-Way Financial Ledger, Voice Support Inbox, and Role Preview tools in Settings.
`;

  return new Response(guide, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    },
  });
}
