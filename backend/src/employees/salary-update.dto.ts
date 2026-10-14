import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

export const SupportedCurrencyValues = ['USD', 'EUR', 'GBP', 'INR'] as const;
export type SupportedCurrency = (typeof SupportedCurrencyValues)[number];

// Business ceiling well below the DECIMAL(14,2) column limit; catches typos such as an extra zero block.
export const MAX_ANNUAL_SALARY = 100_000_000;
// Changes larger than this fraction of the current salary need explicit confirmation.
export const LARGE_CHANGE_THRESHOLD = 0.2;

export class UpdateSalaryDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(MAX_ANNUAL_SALARY)
  salary: number;

  // Date only (YYYY-MM-DD). Strict ISO parsing also rejects impossible dates like 2025-02-30.
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'effectiveDate must be a date in YYYY-MM-DD format' })
  @IsISO8601({ strict: true })
  effectiveDate: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(3, 500)
  reason: string;

  @IsOptional()
  @IsBoolean()
  confirmLargeChange?: boolean;
}
