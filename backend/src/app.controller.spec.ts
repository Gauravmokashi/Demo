import { Test, TestingModule } from '@nestjs/testing';
import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EmployeesService } from './employees/employees.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: EmployeesService, useValue: { getSummary: jest.fn() } },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  it('should return hello message', () => {
    expect(appController.getHello()).toEqual({ message: 'ACME Salary Management API is running' });
  });
});
