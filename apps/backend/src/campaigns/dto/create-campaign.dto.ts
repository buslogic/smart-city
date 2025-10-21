import { IsInt, IsString, IsOptional } from 'class-validator';

export class CreateCampaignDto {
  @IsString()
  period: string;

  @IsOptional()
  @IsInt()
  godina?: number;

  @IsOptional()
  @IsInt()
  mesec?: number;

  @IsOptional()
  @IsString()
  sifra?: string;

  @IsString()
  status_id: string;

  @IsOptional()
  @IsString()
  datum_kreiranja?: string;

  @IsOptional()
  @IsString()
  datum_zatvaranja?: string;
}
