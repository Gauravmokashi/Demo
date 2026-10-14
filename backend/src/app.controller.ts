import { Controller, Get } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Public, Roles } from './auth/auth.decorators';
import { AppService } from './app.service';
import { EmployeesService } from './employees/employees.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly employeesService: EmployeesService,
  ) {}

  @Get()
  getHello(): { message: string } {
    return this.appService.getHello();
  }

  @Public()
  @Get('health')
  getHealth(): { status: string } {
    return { status: 'ok' };
  }

  @Roles(UserRole.HR_MANAGER)
  @Get('dashboard/summary')
  getDashboardSummary() {
    return this.employeesService.getSummary();
  }
}
