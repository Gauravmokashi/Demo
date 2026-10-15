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
  jobTitle: 'Software Engineer',
  level: 'MID',
  hireDate: new Date('2022-03-01T00:00:00.000Z'),
  currency: Currency.INR,
  salary: new Prisma.Decimal('100000.00'),
  effectiveDate: new Date('2025-01-01T00:00:00.000Z'),
  isActive: true,
};
const salaryChange = { salary: 110000, effectiveDate: '2025-02-01', reason: 'Annual review' };

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
      count: jest.fn(async (): Promise<number> => 0),
      findMany: jest.fn(async (): Promise<unknown[]> => []),
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

// Resolve the cookie before building the next request: supertest closes the shared server
// when a request finishes, which would break a request that is already being built.
async function loginCookie(): Promise<string> {
  const response = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email: manager.email, password: managerPassword })
    .expect(201);
  return response.headers['set-cookie'][0].split(';')[0];
}

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
    await request(app.getHttpServer()).get('/api/employees/outliers').expect(401);
    await request(app.getHttpServer()).post('/api/employees').send({}).expect(401);
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
      .send(salaryChange)
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
        reason: 'Annual review',
      }),
    });
  });

  it('slides an active session forward with a fresh cookie', async () => {
    const cookie = await loginCookie();
    const response = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', cookie)
      .expect(200);

    expect(response.body.user).toMatchObject({ id: manager.id, email: manager.email });
    expect(response.headers['set-cookie'][0]).toContain(`${AUTH_COOKIE_NAME}=`);
    await request(app.getHttpServer()).post('/api/auth/refresh').expect(401);
  });
});

describe('CSV export', () => {
  it('returns the CSV body, not a serialized promise', async () => {
    prisma.employee.findMany.mockResolvedValueOnce([employeeRecord]);
    const cookie = await loginCookie();

    const response = await request(app.getHttpServer())
      .get('/api/employees/export?currency=INR')
      .set('Cookie', cookie)
      .expect(200);

    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.headers['content-disposition']).toMatch(/attachment; filename="employees-\d{4}-\d{2}-\d{2}\.csv"/);
    const lines = response.text.split('\n');
    expect(lines[0]).toBe(
      'id,employeeCode,fullName,jobTitle,level,department,country,hireDate,currency,salary,effectiveDate',
    );
    expect(lines[1]).toContain('"ACM-00007"');
    expect(lines[1]).toContain('"100000"');
  });

  it('validates export filters instead of failing in the database', async () => {
    const cookie = await loginCookie();
    await request(app.getHttpServer())
      .get('/api/employees/export?currency=XYZ')
      .set('Cookie', cookie)
      .expect(400);
  });
});

describe('request validation', () => {
  it('rejects malformed roster creation and unapproved analytics dimensions', async () => {
    const cookie = await loginCookie();
    await request(app.getHttpServer())
      .post('/api/employees')
      .set('Cookie', cookie)
      .send({ employeeCode: 'not-an-acme-code' })
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/employees/analytics?dimension=passwordHash')
      .set('Cookie', cookie)
      .expect(400);
  });

  it.each([
    ['a timestamp instead of a date', { ...salaryChange, effectiveDate: '2025-02-01T10:00:00Z' }],
    ['an impossible date', { ...salaryChange, effectiveDate: '2025-02-30' }],
    ['a salary above the business ceiling', { ...salaryChange, salary: 1e13 }],
    ['a missing reason', { salary: 110000, effectiveDate: '2025-02-01' }],
    ['a currency change', { ...salaryChange, currency: 'USD' }],
  ])('rejects a salary update with %s', async (_label, body) => {
    const cookie = await loginCookie();
    await request(app.getHttpServer())
      .patch(`/api/employees/${employeeRecord.id}/salary`)
      .set('Cookie', cookie)
      .send(body)
      .expect(400);
  });

  it.each([
    ['salary bounds without a currency', 'minSalary=1000'],
    ['an inverted salary range', 'currency=USD&minSalary=5000&maxSalary=1000'],
    ['salary sorting without a currency', 'sortBy=salary'],
    ['an unknown sort column', 'sortBy=passwordHash'],
  ])('rejects a directory query with %s', async (_label, query) => {
    const cookie = await loginCookie();
    await request(app.getHttpServer())
      .get(`/api/employees?${query}`)
      .set('Cookie', cookie)
      .expect(400);
  });

  it('maps database input errors to 4xx instead of 500', async () => {
    prisma.employee.count.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('value too long', { code: 'P2000', clientVersion: 'test' }),
    );

    const cookie = await loginCookie();

    const response = await request(app.getHttpServer())
      .get('/api/employees')
      .set('Cookie', cookie)
      .expect(400);
    expect(response.body.message).toBe('A value is too long or out of range.');
  });
});
