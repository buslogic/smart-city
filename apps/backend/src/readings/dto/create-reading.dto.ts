import { IsOptional, IsString, IsNumber } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateReadingDto {
  @IsString()
  pod_kampanja_id: string;

  @IsString()
  idmm: string;

  @IsString()
  idv: string;

  @IsOptional()
  @IsString()
  stavka_za_citanje_id?: string;

  @IsOptional()
  @IsString()
  datum?: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' || value === null || value === undefined ? undefined : Number(value)))
  @IsNumber()
  pocetno_stanje?: number;

  @IsOptional()
  @Transform(({ value }) => (value === '' || value === null || value === undefined ? undefined : Number(value)))
  @IsNumber()
  zavrsno_stanje?: number;

  @IsOptional()
  @IsString()
  izvor_citanja?: string;

  @IsOptional()
  @IsString()
  napomena?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  citac_id?: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' || value === null || value === undefined ? undefined : Number(value)))
  @IsNumber()
  z_pocetno?: number;

  @IsOptional()
  @Transform(({ value }) => (value === '' || value === null || value === undefined ? undefined : Number(value)))
  @IsNumber()
  z_zavrsno_stanje?: number;
}
