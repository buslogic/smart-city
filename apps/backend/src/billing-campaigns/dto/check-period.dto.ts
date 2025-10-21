import { IsString, Matches } from 'class-validator';

export class CheckPeriodDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}$/, { message: 'Period must be in format YYYY-MM' })
  period: string;
}
