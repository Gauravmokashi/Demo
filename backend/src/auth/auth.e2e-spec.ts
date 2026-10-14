process.env.JWT_SECRET ??= 'test-only-secret-that-is-at-least-32-bytes-long';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Currency, Prisma, UserRole } from '@prisma/client';
import { describe, expect, it, jest, beforeAll, afterAll, beforeEach } from '@jest/globals';
import cookieParser from 'cookie-parser';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import request from 'supertest';
import { AppModule } from '../app.module';
import { AUTH_COOKIE_NAME, AUTH_JWT_AUDIENCE, AUTH_JWT_ISSUER } from './auth.constants';
import { PrismaService } from '../prisma/prisma.service';

const managerPassword = 'test-manager-password-123';
const manager = {
  id: 1,
  email: 'manager@example.local',
  role: UserRole.HR_MANAGER,
  isActive: true,
  passwordHash: '',
};
const employeeUser = {
  id: 2,
  email: 'employee@example.local',
  role: UserRole.EMPLOYEE,
  isActive: true,
  passwordHash: '',
};
const employeeRecord = {
  id: 7,
  employeeCode: 'ACM-00007',
  fullName: 'Sample Employee',
  department: 'Engineering',
  country: 'India',
  currency: Currency.INR,
  salary: new Prisma.Decimal('100000.00'),
  effectiveDate: new Date('2025-01-01T00:00:00.000Z'),
};

let app: INestApplication;
let moduleRef: TestingModule;
let prisma: any;
let auditCreate: jest.Mock;

beforeAll(async () => {
  manager.passwordHash = await bcrypt.hash(managerPassword, 4);
  employeeUser.passwordHash = await bcrypt.hash('employee-password-123', 4);

  const historyCreate = jest.fn(async () => ({}));
  auditCreate = jest.fn(async () => ({}));
  const transaction = {
    $queryRaw: jest.fn(async () => [employeeRecord]),
    employee: {
      update: jest.fn(async () => ({
        ...employeeRecord,
        salary: new Prisma.Decimal('110000.00'),
      })),
    },
    salaryHistory: { create: historyCreate },
    salaryChangeAudit: { create: auditCreate },
  };
  prisma = {
    user: {
      findUnique: jest.fn(async ({ where, select }: any) => {
        const found = where.email
          ? [manager, employeeUser].find((user) => user.email === where.email)
          : [manager, employeeUser].find((user) => user.id === where.id);
        if (!found) return null;
        return select
          ? { id: found.id, email: found.email, role: found.role, isActive: found.isActive }
          : found;
      }),
    },
    employee: {
      count: jest.fn(async () => 0),
      findMany: jest.fn(async () => []),
      findUnique: jest.fn(async () => employeeRecord),
      groupBy: jest.fn(async () => []),
    },
    $transaction: jest.fn(async (operation: (client: typeof transaction) => unknown) =>
      operation(transaction),
    ),
  };

  moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue(prisma)
    .compile();
  app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  await app.init();
});

afterAll(async () => app.close());

beforeEach(() => {
  auditCreate.mockClear();
});

describe('HR-manager authentication and authorization', () => {
  it('logs in and returns a safe identity with an HttpOnly cookie', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: manager.email, password: managerPassword })
      .expect(201);

    expect(response.body.user).toMatchObject({
      id: manager.id,
      email: manager.email,
      role: UserRole.HR_MANAGER,
    });
    expect(Number.isNaN(Date.parse(response.body.user.expiresAt))).toBe(false);
    expect(response.body.user.passwordHash).toBeUndefined();
    expect(response.headers['set-cookie'][0]).toContain(`${AUTH_COOKIE_NAME}=`);
    expect(response.headers['set-cookie'][0].toLowerCase()).toContain('httponly');
    expect(response.headers['set-cookie'][0].toLowerCase()).toContain('samesite=strict');

    const cookie = response.headers['set-cookie'][0].split(';')[0];
    const identity = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', cookie)
      .expect(200);
    expect(identity.body.user).toMatchObject({
      id: manager.id,
      email: manager.email,
      role: UserRole.HR_MANAGER,
      expiresAt: response.body.user.expiresAt,
    });
    expect(identity.body.user.passwordHash).toBeUndefined();
  });

  it('rejects an incorrect password without disclosing account details', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: manager.email, password: 'incorrect-password-123' })
      .expect(401);

    expect(response.body.message).toBe('Invalid email or password.');
  });

  it('clears the session cookie on logout', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/logout')
      .expect(201);

    expect(response.body).toEqual({ message: 'Logged out.' });
    expect(response.headers['set-cookie'][0]).toContain(`${AUTH_COOKIE_NAME}=`);
    expect(response.headers['set-cookie'][0].toLowerCase()).toContain('expires=');
  });

  it('rejects unauthenticated requests to employee endpoints', async () => {
    await request(app.getHttpServer()).get('/api/employees').expect(401);
  });

  it('keeps the root greeting and dashboard summary private', async () => {
    await request(app.getHttpServer()).get('/api').expect(401);
    await request(app.getHttpServer()).get('/api/dashboard/summary').expect(401);
    await request(app.getHttpServer()).get('/api/employees/analytics').expect(401);
  });

  it('enforces the HR-manager role on protected routes', async () => {
    const token = jwt.sign({ sub: String(employeeUser.id) }, process.env.JWT_SECRET!, {
      algorithm: 'HS256',
      issuer: AUTH_JWT_ISSUER,
      audience: AUTH_JWT_AUDIENCE,
      expiresIn: '5m',
    });

    await request(app.getHttpServer())
      .get('/api/employees')
      .set('Cookie', `${AUTH_COOKIE_NAME}=${token}`)
      .expect(403);
  });

  it('denies CSV export without authentication', async () => {
    await request(app.getHttpServer()).get('/api/employees/export').expect(401);
  });

  it('records the acting manager and old/new compensation on salary update', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: manager.email, password: managerPassword })
      .expect(201);
    const cookie = login.headers['set-cookie'][0].split(';')[0];

    await request(app.getHttpServer())
      .patch(`/api/employees/${employeeRecord.id}/salary`)
      .set('Cookie', cookie)
      .send({ salary: 110000, currency: 'INR', effectiveDate: '2025-02-01' })
      .expect(200);

    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: manager.id,
        employeeId: employeeRecord.id,
        previousSalary: employeeRecord.salary,
        newSalary: new Prisma.Decimal('110000'),
        previousCurrency: Currency.INR,
        newCurrency: Currency.INR,
        effectiveDate: new Date('2025-02-01T00:00:00.000Z'),
      }),
    });
  });
});
