import { IsInt, IsString, IsOptional } from 'class-validator';

export class UpdateSubCampaignDto {
  @IsInt()
  id: number;

  @IsOptional()
  @IsString()
  kampanja?: string;

  @IsOptional()
  @IsInt()
  kampanja_id?: number;

  @IsOptional()
  @IsString()
  dan?: string;

  @IsOptional()
  @IsInt()
  vreme_od?: number;

  @IsOptional()
  @IsInt()
  vreme_do?: number;

  @IsOptional()
  @IsString()
  region_id?: string;

  @IsOptional()
  @IsString()
  citac_id?: string;

  @IsOptional()
  @IsString()
  status_id?: string;

  @IsOptional()
  @IsInt()
  changed_by?: number;

  @IsOptional()
  @IsString()
  edit_datetime?: string;
}
