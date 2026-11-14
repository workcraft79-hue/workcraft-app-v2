export type AuthRole = 'FOUNDER' | 'AGENT' | 'SALON_OWNER';

export interface AuthUser {
  userId: string;
  userRole: AuthRole;
  displayName: string;
  email: string;
  phone: string;
  salonId: string | null;
  agentId: string | null;
  salonName?: string;
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
