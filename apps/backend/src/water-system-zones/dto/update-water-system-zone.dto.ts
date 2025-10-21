import { IsString, IsInt, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateWaterSystemZoneDto {
  @IsOptional()
  @IsString()
  zone_name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  type_id?: number;
}
