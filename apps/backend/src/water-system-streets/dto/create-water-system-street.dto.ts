import { IsString, IsOptional, IsInt } from 'class-validator';

export class CreateWaterSystemStreetDto {
  @IsInt()
  city_id: number;

  @IsString()
  address_name: string;

  @IsOptional()
  @IsString()
  address_number?: string | null;

  @IsOptional()
  @IsString()
  official_address_code?: string | null;

  @IsOptional()
  @IsInt()
  region_id?: number | null;

  @IsOptional()
  @IsInt()
  active?: number;

  @IsOptional()
  @IsInt()
  edit_user_id?: number | null;

  @IsOptional()
  edit_datetime?: string | null;
}
