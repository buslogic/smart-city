import { IsInt, IsString, IsOptional } from 'class-validator';

export class UpdateCampaignDto {
  @IsInt()
  id: number;

  @IsOptional()
  @IsString()
  period?: string;

  @IsOptional()
  @IsInt()
  godina?: number;

  @IsOptional()
  @IsInt()
  mesec?: number;

  @IsOptional()
  @IsString()
  sifra?: string;

  @IsOptional()
  @IsString()
  status_id?: string;

  @IsOptional()
  @IsString()
  datum_kreiranja?: string;

  @IsOptional()
  @IsString()
  datum_zatvaranja?: string;

  @IsOptional()
  @IsInt()
  changed_by?: number;

  @IsOptional()
  @IsString()
  edit_datetime?: string;
}
