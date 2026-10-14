import { ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EmployeesService } from './employees/employees.service';
import { PrismaService } from './prisma/prisma.service';

describe('AppController', () => {
  let appController: AppController;
  const prisma = { $queryRaw: jest.fn<() => Promise<unknown>>() };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: EmployeesService, useValue: { getSummary: jest.fn() } },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  it('should return hello message', () => {
    expect(appController.getHello()).toEqual({ message: 'ACME Salary Management API is running' });
  });

  it('reports healthy when the database responds', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([{ '?column?': 1 }]);
    await expect(appController.getHealth()).resolves.toEqual({ status: 'ok', database: 'up' });
  });

  it('reports unavailable when the database is down', async () => {
    prisma.$queryRaw.mockRejectedValueOnce(new Error('connection refused'));
    await expect(appController.getHealth()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
