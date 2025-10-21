import { IsString, IsInt, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateWaterSystemCityDto {
  @IsOptional()
  @IsString()
  cities_name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  cities_zip_code?: number;
}
