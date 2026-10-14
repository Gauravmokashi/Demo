import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../prisma/prisma.service';
import {
  AUTH_COOKIE_NAME,
  AUTH_JWT_AUDIENCE,
  AUTH_JWT_ISSUER,
  requireJwtSecret,
} from './auth.constants';
import { IS_PUBLIC_KEY } from './auth.decorators';
import { AuthPrincipal } from './auth.types';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<{
      cookies?: Record<string, string>;
      user?: AuthPrincipal;
    }>();
    const token = request.cookies?.[AUTH_COOKIE_NAME];
    if (!token) throw new UnauthorizedException();

    let payload: jwt.JwtPayload;
    try {
      const decoded = jwt.verify(token, requireJwtSecret(), {
        algorithms: ['HS256'],
        issuer: AUTH_JWT_ISSUER,
        audience: AUTH_JWT_AUDIENCE,
      });
      if (typeof decoded === 'string') throw new Error('Invalid token payload');
      payload = decoded;
    } catch {
      throw new UnauthorizedException();
    }

    if (
      typeof payload.sub !== 'string' ||
      !/^\d+$/.test(payload.sub) ||
      typeof payload.exp !== 'number'
    ) {
      throw new UnauthorizedException();
    }
    const user = await this.prisma.user.findUnique({
      where: { id: Number(payload.sub) },
      select: { id: true, email: true, role: true, isActive: true },
    });
    if (!user || !user.isActive || !Object.values(UserRole).includes(user.role)) {
      throw new UnauthorizedException();
    }
    request.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      expiresAt: new Date(payload.exp * 1000).toISOString(),
    };
    return true;
  }
}
