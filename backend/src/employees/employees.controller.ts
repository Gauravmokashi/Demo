import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  Res,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/auth.decorators';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthPrincipal } from '../auth/auth.types';
import { EmployeeQueryDto } from './employee-query.dto';
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
  getAnalytics() {
    return this.employeesService.getAnalytics();
  }

  @Get('export')
  exportCsv(
    @Query('search') search?: string,
    @Query('country') country?: string,
    @Query('department') department?: string,
    @Query('currency') currency?: string,
    @Res() res?: any,
  ) {
    const csv = this.employeesService.exportCsv(search, country, department, currency);

    if (res) {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="employees.csv"');
      res.send(csv);
      return;
    }

    return csv;
  }

  @Get(':id')
  getEmployee(@Param('id', ParseIntPipe) id: number) {
    return this.employeesService.findById(id);
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
