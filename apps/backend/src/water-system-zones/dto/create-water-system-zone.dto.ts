import { IsString, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateWaterSystemZoneDto {
  @IsString()
  zone_name: string;

  @Type(() => Number)
  @IsInt()
  type_id: number;
}
