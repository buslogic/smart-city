import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsInt, IsBoolean, IsOptional, IsIn } from 'class-validator';

export class CreateTableMappingDto {
  @ApiProperty({ description: 'ID legacy baze podataka' })
  @IsInt()
  legacyDatabaseId: number;

  @ApiProperty({ description: 'Naziv tabele u legacy bazi' })
  @IsString()
  legacyTableName: string;

  @ApiProperty({ description: 'Naziv tabele u lokalnoj bazi' })
  @IsString()
  localTableName: string;

  @ApiProperty({ 
    description: 'Tip mapiranja',
    enum: ['one_way', 'two_way', 'manual'],
    default: 'one_way'
  })
  @IsOptional()
  @IsString()
  @IsIn(['one_way', 'two_way', 'manual'])
  mappingType?: string;

  @ApiProperty({ description: 'Da li je sinhronizacija omogućena', default: false })
  @IsOptional()
  @IsBoolean()
  syncEnabled?: boolean;

  @ApiProperty({ description: 'Frekvencija sinhronizacije (cron expression)', required: false })
  @IsOptional()
  @IsString()
  syncFrequency?: string;

  @ApiProperty({ description: 'Konfiguracija mapiranja polja (JSON)', required: false })
  @IsOptional()
  @IsString()
  mappingConfig?: string;

  @ApiProperty({ description: 'Opis mapiranja', required: false })
  @IsOptional()
  @IsString()
  description?: string;
}