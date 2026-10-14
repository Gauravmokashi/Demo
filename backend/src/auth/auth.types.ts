import { UserRole } from '@prisma/client';

export interface AuthPrincipal {
  id: number;
  email: string;
  role: UserRole;
  expiresAt: string;
}
