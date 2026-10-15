import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Response } from 'express';
import { Roles } from '../auth/auth.decorators';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthPrincipal } from '../auth/auth.types';
import {
  AnalyticsQueryDto,
  CreateEmployeeDto,
  EmployeeQueryDto,
  UpdateEmployeeDto,
} from './employee-query.dto';
import { UpdateSalaryDto } from './salary-update.dto';
import { EmployeesService } from './employees.service';

@Controller('employees')
@Roles(UserRole.HR_MANAGER)
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  listEmployees(@Query() query: EmployeeQueryDto) {
    return this.employeesService.listEmployees(query);
  }

  @Get('analytics')
  getAnalytics(@Query() query: AnalyticsQueryDto) {
    return this.employeesService.getAnalytics(query);
  }

  @Get('options')
  getOptions() {
    return this.employeesService.getOptions();
  }

  @Get('outliers')
  getOutliers() {
    return this.employeesService.getOutliers();
  }

  @Post()
  createEmployee(@Body() body: CreateEmployeeDto) {
    return this.employeesService.createEmployee(body);
  }

  // Uses the same validated filters as the directory; pagination params are ignored so the
  // export contains every matching row.
  @Get('export')
  async exportCsv(@Query() query: EmployeeQueryDto, @Res() res: Response) {
    const csv = await this.employeesService.exportCsv(query);
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="employees-${date}.csv"`);
    res.send(csv);
  }

  @Get(':id')
  getEmployee(@Param('id', ParseIntPipe) id: number) {
    return this.employeesService.findById(id);
  }

  @Get(':id/history')
  getHistory(@Param('id', ParseIntPipe) id: number) {
    return this.employeesService.getHistory(id);
  }

  @Patch(':id')
  updateEmployee(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateEmployeeDto) {
    return this.employeesService.updateEmployee(id, body);
  }

  @Delete(':id')
  deactivateEmployee(@Param('id', ParseIntPipe) id: number) {
    return this.employeesService.deactivateEmployee(id);
  }

  @Patch(':id/salary')
  updateSalary(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateSalaryDto,
    @CurrentUser() actor: AuthPrincipal,
  ) {
    return this.employeesService.updateSalary(id, body, actor.id);
  }
}
