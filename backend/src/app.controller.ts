import { Controller, Get, Logger, ServiceUnavailableException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Public, Roles } from './auth/auth.decorators';
import { AppService } from './app.service';
import { EmployeesService } from './employees/employees.service';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(
    private readonly appService: AppService,
    private readonly employeesService: EmployeesService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  getHello(): { message: string } {
    return this.appService.getHello();
  }

  // Readiness check: reports healthy only when the database answers.
  @Public()
  @Get('health')
  async getHealth(): Promise<{ status: string; database: string }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'up' };
    } catch (error) {
      this.logger.warn(`Health check failed: ${error instanceof Error ? error.message : 'unknown error'}`);
      throw new ServiceUnavailableException({ status: 'error', database: 'down' });
    }
  }

  @Roles(UserRole.HR_MANAGER)
  @Get('dashboard/summary')
  getDashboardSummary() {
    return this.employeesService.getSummary();
  }
}
