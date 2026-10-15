import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  registerDecorator,
} from 'class-validator';
import { JobLevel } from '@prisma/client';
import { SupportedCurrencyValues } from './salary-update.dto';
import { EMPLOYEE_SORT_FIELDS } from './employees.types';

/** Cross-field rule: `check` receives the whole DTO, so it can compare properties. */
function Satisfies(check: (dto: EmployeeFilterDto, value: unknown) => boolean, message: string) {
  return (target: object, propertyName: string) =>
    registerDecorator({
      target: target.constructor,
      propertyName,
      options: { message },
      validator: { validate: (value, args) => check(args.object as EmployeeFilterDto, value) },
    });
}

/** Filters shared by the directory list and the CSV export. */
export class EmployeeFilterDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  department?: string;

  @IsOptional()
  @IsEnum(JobLevel)
  level?: JobLevel;

  @IsOptional()
  @IsEnum(SupportedCurrencyValues)
  currency?: string;

  // Salary bounds only make sense within one currency (INR 50,000 is not USD 50,000).
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Satisfies((dto) => Boolean(dto.currency), 'currency is required when filtering by salary')
  minSalary?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Satisfies((dto) => Boolean(dto.currency), 'currency is required when filtering by salary')
  @Satisfies(
    (dto, value) => dto.minSalary === undefined || Number(value) >= dto.minSalary,
    'maxSalary must be greater than or equal to minSalary',
  )
  maxSalary?: number;
}

export class EmployeeQueryDto extends EmployeeFilterDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsIn(EMPLOYEE_SORT_FIELDS)
  @Satisfies(
    (dto, value) => value !== 'salary' || Boolean(dto.currency),
    'currency is required when sorting by salary',
  )
  sortBy?: (typeof EMPLOYEE_SORT_FIELDS)[number];

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}

export const ANALYTICS_DIMENSIONS = ['country', 'department', 'level', 'jobTitle'] as const;
export type AnalyticsDimension = (typeof ANALYTICS_DIMENSIONS)[number];

/** Initial roster record; salary history begins with the supplied effective date. */
export class CreateEmployeeDto {
  @IsString()
  @Matches(/^ACM-[0-9]{5}$/)
  employeeCode: string;

  @IsString()
  @Length(1, 160)
  fullName: string;

  @IsString()
  @Length(1, 100)
  department: string;

  @IsString()
  @Length(1, 100)
  country: string;

  @IsString()
  @Length(1, 120)
  jobTitle: string;

  @IsEnum(JobLevel)
  level: JobLevel;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  hireDate: string;

  @IsEnum(SupportedCurrencyValues)
  currency: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100_000_000)
  salary: number;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  effectiveDate: string;
}

/** Roster edits intentionally cannot change salary or currency; compensation uses its audited route. */
export class UpdateEmployeeDto {
  @IsOptional()
  @IsString()
  @Length(1, 160)
  fullName?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  department?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  country?: string;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  jobTitle?: string;

  @IsOptional()
  @IsEnum(JobLevel)
  level?: JobLevel;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  hireDate?: string;
}

export class AnalyticsQueryDto {
  @IsOptional()
  @IsIn(ANALYTICS_DIMENSIONS)
  dimension?: AnalyticsDimension;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  department?: string;

  @IsOptional()
  @IsEnum(SupportedCurrencyValues)
  currency?: string;
}
