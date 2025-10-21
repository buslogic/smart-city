import { IsString, IsNumber, IsBoolean, IsOptional, IsDate } from 'class-validator';

export class StopDto {
  @IsString()
  uniqueId: string;

  @IsString()
  stationName: string;

  @IsNumber()
  gpsx: number;

  @IsNumber()
  gpsy: number;

  @IsString()
  description: string;

  @IsNumber()
  range: number;

  @IsNumber()
  rangeForDriverConsole: number;

  @IsNumber()
  rangeForValidators: number;

  @IsBoolean()
  changed: boolean;

  @IsBoolean()
  mainOperator: boolean;

  @IsNumber()
  groupId: number;

  @IsNumber()
  readyForBooking: number;

  @IsNumber()
  usedInBooking: number;

  @IsOptional()
  @IsDate()
  dateValidFrom?: Date | null;
}
