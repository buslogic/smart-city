import { IsString, IsOptional, IsInt } from 'class-validator';

export class CreateWaterSystemRegionDto {
  @IsString()
  region_name: string;

  @IsOptional()
  @IsInt()
  reader_id?: number | null;
}
