import { IsDateString, IsEnum, IsNumber, Min } from 'class-validator';

export const SupportedCurrencyValues = ['USD', 'EUR', 'GBP', 'INR'] as const;
export type SupportedCurrency = (typeof SupportedCurrencyValues)[number];

export class UpdateSalaryDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  salary: number;

  @IsEnum(SupportedCurrencyValues)
  currency: SupportedCurrency;

  @IsDateString()
  effectiveDate: string;
}
