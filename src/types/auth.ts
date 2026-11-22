export type AuthRole = 'FOUNDER' | 'AGENT' | 'SALON_OWNER';

export interface AuthUser {
  userId: string;
  userRole: AuthRole;
  displayName: string;
  email: string;
  phone: string;
  salonId: string | null;
  allowedSalonIds?: string[];
  agentId: string | null;
  salonName?: string;
  sessionVersion?: number;
}

export interface DevTestAccount {
  userId: string;
  userRole: AuthRole;
  displayName: string;
  email: string;
  phone: string;
  salonId: string | null;
  agentId: string | null;
  salonName?: string;
  badge: string;
}
