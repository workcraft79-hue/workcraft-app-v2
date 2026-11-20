export const config = {
  runtime: 'edge',
};

interface EdgeAppointmentRecord {
  id: string;
  salonId: string;
  customerName: string;
  customerPhone: string;
  serviceIds: string[];
  serviceNames: string[];
  totalDurationMins: number;
  totalAmount: number;
  dealId?: string;
  dateIso: string;
  timeSlot: string;
  startMinutes: number;
  barberName: string;
  language: string;
  status: string;
  createdAtIso: string;
  isDemo?: boolean;
}

// Ephemeral Edge instance store (multi-instance production deployment should connect a persistent database)
const globalStore = globalThis as unknown as {
  __wclCustomerAppointments?: EdgeAppointmentRecord[];
};

function getAppointments(): EdgeAppointmentRecord[] {
  if (!globalStore.__wclCustomerAppointments) {
    globalStore.__wclCustomerAppointments = [];
  }
  return globalStore.__wclCustomerAppointments;
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    },
  });
}

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const list = getAppointments();

  if (req.method === 'GET') {
    const salonId = url.searchParams.get('salonId');
    const filtered = salonId ? list.filter((a) => a.salonId === salonId) : list;
    return jsonResponse({
      appointments: filtered,
      persistence: 'edge-memory-and-client-store',
    });
  }

  if (req.method === 'POST') {
    let body: Partial<EdgeAppointmentRecord> | null = null;
    try {
      body = (await req.json()) as Partial<EdgeAppointmentRecord>;
    } catch {
      return jsonResponse({ error: 'Invalid JSON request body.' }, 400);
    }

    if (!body || body.isDemo) {
      return jsonResponse({ error: 'Demo bookings are never written to live storage.' }, 400);
    }

    if (
      !body.salonId ||
      !body.customerName ||
      !body.dateIso ||
      !body.timeSlot ||
      typeof body.startMinutes !== 'number' ||
      !body.barberName
    ) {
      return jsonResponse({ error: 'Missing required appointment fields.' }, 400);
    }

    const dur = Math.max(15, Number(body.totalDurationMins) || 30);
    const reqEnd = body.startMinutes + dur;

    const hasConflict = list.some((existing) => {
      if (existing.salonId !== body!.salonId) return false;
      if (existing.dateIso !== body!.dateIso) return false;
      if (existing.status === 'COMPLETED') return false;
      if (existing.barberName.trim().toLowerCase() !== body!.barberName!.trim().toLowerCase()) {
        return false;
      }
      const exEnd = existing.startMinutes + Math.max(20, existing.totalDurationMins || 30);
      return body!.startMinutes! < exEnd && existing.startMinutes < reqEnd;
    });

    if (hasConflict) {
      return jsonResponse(
        {
          error: 'Selected barber and time slot already have a confirmed booking.',
          code: 'SLOT_TAKEN',
        },
        409
      );
    }

    const saved: EdgeAppointmentRecord = {
      id: body.id || `WC-${Date.now().toString().slice(-5)}`,
      salonId: body.salonId,
      customerName: body.customerName.trim(),
      customerPhone: (body.customerPhone || '').trim(),
      serviceIds: Array.isArray(body.serviceIds) ? body.serviceIds : [],
      serviceNames: Array.isArray(body.serviceNames) ? body.serviceNames : [],
      totalDurationMins: dur,
      totalAmount: Number(body.totalAmount) || 0,
      dealId: body.dealId,
      dateIso: body.dateIso,
      timeSlot: body.timeSlot,
      startMinutes: body.startMinutes,
      barberName: body.barberName,
      language: body.language || 'en',
      status: 'CONFIRMED',
      createdAtIso: body.createdAtIso || new Date().toISOString(),
    };

    list.unshift(saved);

    return jsonResponse(
      {
        ok: true,
        appointment: saved,
        confirmationInsideFlowOnly: true,
        separateWhatsAppSent: false,
      },
      201
    );
  }

  return jsonResponse({ error: 'Method not allowed' }, 405);
}
