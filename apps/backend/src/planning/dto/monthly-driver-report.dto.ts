import { IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class MonthlyDriverReportQueryDto {
  @IsInt()
  @Min(1)
  @Max(12)
  @Type(() => Number)
  month: number;

  @IsInt()
  @Min(2000)
  @Max(2100)
  @Type(() => Number)
  year: number;
}

export interface DriverReportDto {
  driverId: number;
  driverName: string;
  workPlace: string; // Format: "5-18 I" (turaža-linija smena)
  freeDays: string;  // Format: "67" (subota i nedelja) ili "23" (utorak i sreda)
  maintenanceDate?: string;
}
