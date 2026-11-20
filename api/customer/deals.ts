export const config = {
  runtime: 'edge',
};

interface EdgeDealRecord {
  id: string;
  salonId: string;
  title: string;
  description: string;
  discountPercent: number;
  serviceIds: string[];
  videoUrl: string | null;
  expiresAtIso: string;
  retentionDaysAfterExpiry: number;
  videoDeletedAtIso?: string;
}

const globalStore = globalThis as unknown as {
  __wclCustomerDeals?: EdgeDealRecord[];
};

function getSeedDeals(): EdgeDealRecord[] {
  const now = Date.now();
  return [
    {
      id: 'deal-weekend-fade-1',
      salonId: '1',
      title: 'Weekend Skin Fade + Beard Sculpt VIP Deal (25% OFF)',
      description:
        'Book Master Haircut & Skin Fade + Classic Beard Trim together at 25% OFF.',
      discountPercent: 25,
      serviceIds: ['s1', 's2'],
      videoUrl: 'procedural://weekend-vip-reel',
      expiresAtIso: new Date(now + 7 * 86400_000).toISOString(),
      retentionDaysAfterExpiry: 30,
    },
  ];
}

function purgeExpiredDealVideos(deals: EdgeDealRecord[]): EdgeDealRecord[] {
  const nowMs = Date.now();
  return deals.map((deal) => {
    const expiryMs = Date.parse(deal.expiresAtIso);
    const retentionMs = (deal.retentionDaysAfterExpiry || 30) * 86400_000;
    if (!Number.isNaN(expiryMs) && nowMs >= expiryMs + retentionMs && deal.videoUrl) {
      return {
        ...deal,
        videoUrl: null,
        videoDeletedAtIso: new Date(nowMs).toISOString(),
      };
    }
    return deal;
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (!globalStore.__wclCustomerDeals) {
    globalStore.__wclCustomerDeals = getSeedDeals();
  }

  globalStore.__wclCustomerDeals = purgeExpiredDealVideos(globalStore.__wclCustomerDeals);

  const url = new URL(req.url);
  if (req.method === 'GET') {
    const salonId = url.searchParams.get('salonId');
    const includeExpired = url.searchParams.get('includeExpired') === 'true';
    const nowMs = Date.now();

    const filtered = globalStore.__wclCustomerDeals.filter((d) => {
      if (salonId && d.salonId !== salonId) return false;
      if (!includeExpired && Date.parse(d.expiresAtIso) <= nowMs) return false;
      return true;
    });

    return new Response(JSON.stringify({ deals: filtered }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
