import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../prisma/prisma.service';
import {
  AUTH_JWT_AUDIENCE,
  AUTH_JWT_ISSUER,
  requireJwtSecret,
} from './auth.constants';
import { LoginDto } from './login.dto';
import { AuthPrincipal } from './auth.types';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  private readonly dummyPasswordHash = bcrypt.hash(
    randomBytes(32).toString('hex'),
    BCRYPT_ROUNDS,
  );

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async login(credentials: LoginDto): Promise<{ token: string; user: AuthPrincipal }> {
    const user = await this.prisma.user.findUnique({
      where: { email: credentials.email },
    });
    const hash = user?.passwordHash ?? (await this.dummyPasswordHash);
    const passwordMatches = await bcrypt.compare(credentials.password, hash);

    if (!user || !user.isActive || user.role !== UserRole.HR_MANAGER || !passwordMatches) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    return this.issueSession({ id: user.id, email: user.email, role: user.role });
  }

  /** Signs a fresh short-lived session. Used at login and to slide an active session forward. */
  issueSession(principal: Omit<AuthPrincipal, 'expiresAt'>): { token: string; user: AuthPrincipal } {
    const token = jwt.sign({ sub: String(principal.id) }, requireJwtSecret(), {
      algorithm: 'HS256',
      issuer: AUTH_JWT_ISSUER,
      audience: AUTH_JWT_AUDIENCE,
      expiresIn: '15m',
    });
    const expiration = (jwt.decode(token) as jwt.JwtPayload).exp;
    if (!expiration) throw new Error('Could not determine session expiry.');

    return {
      token,
      user: {
        id: principal.id,
        email: principal.email,
        role: principal.role,
        expiresAt: new Date(expiration * 1000).toISOString(),
      },
    };
  }
}
