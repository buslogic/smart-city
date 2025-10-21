import { IsOptional, IsString, IsInt, IsNumber } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class UpdateMeasuringPointDto {
  @ApiPropertyOptional({ description: 'ID mernog mesta (IDMM) - read only' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  IDMM?: number;

  @ApiPropertyOptional({ description: 'ID vodomera (IDV)' })
  @IsOptional()
  @IsString()
  IDV?: string;

  @ApiPropertyOptional({ description: 'Datum ugradnje' })
  @IsOptional()
  @IsString()
  datum_ugradnje?: string;

  @ApiPropertyOptional({ description: 'Naselje (ID | naziv)' })
  @IsOptional()
  @IsString()
  naselje?: string;

  @ApiPropertyOptional({ description: 'Adresa (ID | naziv)' })
  @IsOptional()
  @IsString()
  adresa?: string;

  @ApiPropertyOptional({ description: 'Ulaz' })
  @IsOptional()
  @IsString()
  ulaz?: string;

  @ApiPropertyOptional({ description: 'Kućni broj' })
  @IsOptional()
  @IsString()
  broj?: string;

  @ApiPropertyOptional({ description: 'Prosek PS' })
  @IsOptional()
  prosek_ps?: string | number | null;

  @ApiPropertyOptional({ description: 'Napomena' })
  @IsOptional()
  @IsString()
  napomena?: string;

  @ApiPropertyOptional({ description: 'Broj članova kućnog saveta' })
  @IsOptional()
  broj_clanova_ks?: string | number | null;

  @ApiPropertyOptional({ description: 'Broj potrošača kućnog saveta' })
  @IsOptional()
  broj_potrosaca_ks?: string | number | null;

  @ApiPropertyOptional({ description: 'Korektivno (0/1)' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  korektivno?: number;

  @ApiPropertyOptional({ description: 'Virtuelno (0/1)' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  virtuelno?: number;

  @ApiPropertyOptional({ description: 'Kontrolno (0/1)' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  kontrolno?: number;

  @ApiPropertyOptional({ description: 'Prosek U' })
  @IsOptional()
  prosek_u?: string | number | null;

  @ApiPropertyOptional({ description: 'Primarno merno mesto' })
  @IsOptional()
  @IsString()
  prim_mm?: string;

  @ApiPropertyOptional({ description: 'Redosled mernog mesta' })
  @IsOptional()
  redosled_mm?: string | number | null;

  @ApiPropertyOptional({ description: 'Broj 2' })
  @IsOptional()
  broj2?: string | number | null;

  @ApiPropertyOptional({ description: 'Check LL' })
  @IsOptional()
  @IsString()
  check_ll?: string;

  @ApiPropertyOptional({ description: 'Latitude' })
  @IsOptional()
  latitude?: string | number | null;

  @ApiPropertyOptional({ description: 'Longitude' })
  @IsOptional()
  longtitude?: string | number | null;

  @ApiPropertyOptional({ description: 'Kućni savet (ID | naziv)' })
  @IsOptional()
  @IsString()
  kucni_savet?: string;

  @ApiPropertyOptional({ description: 'Napomena mernog mesta' })
  @IsOptional()
  @IsString()
  _Napomena_MM?: string;

  @ApiPropertyOptional({ description: 'Prosek O' })
  @IsOptional()
  prosek_o?: string | number | null;

  @ApiPropertyOptional({ description: 'Status (ID | naziv)' })
  @IsOptional()
  @IsString()
  mps_status?: string;

  @ApiPropertyOptional({ description: 'Tip (ID | naziv)' })
  @IsOptional()
  @IsString()
  tip?: string;

  // Dodatna polja koja mogu doći ali se ne koriste
  @ApiPropertyOptional()
  @IsOptional()
  type_selection?: string;

  @ApiPropertyOptional()
  @IsOptional()
  IDU?: any;

  @ApiPropertyOptional()
  @IsOptional()
  type_Id?: any;

  @ApiPropertyOptional()
  @IsOptional()
  status?: any;

  @ApiPropertyOptional()
  @IsOptional()
  aktivan?: any;

  @ApiPropertyOptional()
  @IsOptional()
  user_id?: any;

  @ApiPropertyOptional()
  @IsOptional()
  id?: any;
}
