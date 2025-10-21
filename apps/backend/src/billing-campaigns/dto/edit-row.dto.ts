import { IsString, IsInt, IsOptional, Matches } from 'class-validator';
import { Type } from 'class-transformer';

export class EditRowDto {
  @IsInt()
  @Type(() => Number)
  id: number;

  @IsString()
  @Matches(/^\d{4}-\d{2}$/, { message: 'Period must be in format YYYY-MM' })
  period: string;

  @IsString()
  @IsOptional()
  id_popis?: string;

  @IsString()
  @IsOptional()
  idmm?: string;

  @IsString()
  @IsOptional()
  idv?: string;

  @IsInt()
  @Type(() => Number)
  @IsOptional()
  pocetno_stanje?: number;

  @IsInt()
  @Type(() => Number)
  @IsOptional()
  zavrsno_stanje?: number;

  @IsInt()
  @Type(() => Number)
  @IsOptional()
  izmereno?: number;

  @IsInt()
  @Type(() => Number)
  @IsOptional()
  z_pocetno_stanje?: number;

  @IsInt()
  @Type(() => Number)
  @IsOptional()
  z_zavrsno_stanje?: number;

  @IsInt()
  @Type(() => Number)
  @IsOptional()
  z_izmereno?: number;

  @IsInt()
  @Type(() => Number)
  @IsOptional()
  z_vodomer?: number;

  @IsInt()
  @Type(() => Number)
  @IsOptional()
  stanje_vodomera?: number;

  @IsString()
  @IsOptional()
  meter_reading?: string;

  @IsString()
  @IsOptional()
  procenat?: string;

  @IsString()
  @IsOptional()
  napomena?: string;

  @IsString()
  @IsOptional()
  nacin_upisa?: string;
}
