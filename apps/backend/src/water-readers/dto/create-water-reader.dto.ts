import { IsString, IsOptional, IsArray, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateWaterReaderDto {
  @IsString()
  first_name: string;

  @IsString()
  last_name: string;

  @IsInt()
  @Type(() => Number)
  employee_code: number;

  @IsOptional()
  @IsArray()
  @Type(() => Number)
  region_ids?: number[];

  @IsOptional()
  @IsArray()
  @Type(() => Number)
  address_ids?: number[];
}
