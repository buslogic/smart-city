import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreatePaymentDto {
  @IsNotEmpty()
  @IsString()
  uplatilac_id: string;

  @IsOptional()
  @IsNumber()
  id_fakture?: number;

  @IsOptional()
  @IsNumber()
  iznos_gotovina?: number;

  @IsOptional()
  @IsNumber()
  iznos_kartica?: number;

  @IsOptional()
  @IsNumber()
  iznos_cek?: number;

  @IsOptional()
  @IsNumber()
  iznos_vaucer?: number;

  @IsOptional()
  @IsNumber()
  iznos_ukupno?: number;

  @IsNotEmpty()
  @IsString()
  valuta: string;

  @IsNotEmpty()
  @IsString()
  status: string;

  @IsOptional()
  @IsString()
  broj_fiskalnog_racuna?: string;

  @IsOptional()
  @IsString()
  pos_referenca?: string;

  @IsOptional()
  @IsString()
  ip_adresa?: string;

  @IsNotEmpty()
  @IsString()
  kasa_id: string;

  @IsOptional()
  nacin_placanja_id?: string | string[];
}
