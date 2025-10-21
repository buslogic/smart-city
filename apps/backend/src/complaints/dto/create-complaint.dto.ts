import { IsString, IsInt, IsOptional, IsNotEmpty, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateComplaintDto {
  @ApiProperty({ description: 'Tip reklamacije (ID | naziv format)' })
  @IsNotEmpty()
  tip_id: string | number;

  @ApiProperty({ description: 'Kategorija reklamacije (ID | naziv format)' })
  @IsNotEmpty()
  kategorija_id: string | number;

  @ApiProperty({ description: 'Prioritet reklamacije (ID | naziv format)' })
  @IsNotEmpty()
  prioritet_id: string | number;

  @ApiProperty({ description: 'Status reklamacije (ID | naziv format)' })
  @IsNotEmpty()
  status_id: string | number;

  @ApiProperty({ description: 'Opis reklamacije' })
  @IsString()
  @IsNotEmpty()
  opis: string;

  @ApiPropertyOptional({ description: 'Napomena' })
  @IsString()
  @IsOptional()
  napomena?: string;

  @ApiProperty({ description: 'ID korisnika (ID | naziv format)' })
  @IsNotEmpty()
  korisnik_id: string | number;

  @ApiProperty({ description: 'ID mernog mesta (IDMM | adresa format)' })
  @IsNotEmpty()
  idmm: string | number;

  @ApiPropertyOptional({ description: 'ID fakture' })
  @IsOptional()
  faktura_id?: number | null;

  @ApiPropertyOptional({ description: 'ID obračuna' })
  @IsOptional()
  obracun_id?: number | null;

  @ApiPropertyOptional({ description: 'Datum kreiranja' })
  @IsDateString()
  @IsOptional()
  kreirano?: string;

  @ApiPropertyOptional({ description: 'ID korisnika koji je kreirao' })
  @IsOptional()
  kreirao_id?: string | number;

  @ApiPropertyOptional({ description: 'Datum zatvaranja' })
  @IsDateString()
  @IsOptional()
  zatvoreno?: string | null;
}
