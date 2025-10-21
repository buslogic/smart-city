import { IsInt, IsOptional, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateZoneMeasuringPointDto {
  @Type(() => Number)
  @IsInt()
  zone_id: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idmm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  region_id?: number;
}
