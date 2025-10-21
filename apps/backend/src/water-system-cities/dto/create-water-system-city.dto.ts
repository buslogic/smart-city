import { IsString, IsInt, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateWaterSystemCityDto {
  @IsString()
  cities_name: string;

  @Type(() => Number)
  @IsInt()
  cities_zip_code: number;
}
