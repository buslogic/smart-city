import {
  IsInt,
  IsDateString,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsArray,
  ArrayMinSize,
  IsEnum,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum DataSource {
  MYSQL = 'mysql',
  LEGACY = 'legacy',
}

export class AnalyzeHistoryDto {
  @ApiPropertyOptional({
    description: 'ID vozača za analizu (ako nije naveden, analizira sve vozače)',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  driverId?: number;

  @ApiPropertyOptional({
    description: 'Lista ID-eva vozača za analizu',
    example: [1, 2, 3],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Type(() => Number)
  driverIds?: number[];

  @ApiProperty({
    description: 'Početni datum za analizu (YYYY-MM-DD)',
    example: '2025-09-01',
  })
  @IsDateString()
  startDate: string;

  @ApiProperty({
    description: 'Krajnji datum za analizu (YYYY-MM-DD)',
    example: '2025-10-16',
  })
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional({
    description: 'Minimalni broj korišćenja za kreiranje default-a',
    example: 5,
    default: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  minUsageCount?: number;

  @ApiPropertyOptional({
    description: 'Minimalni confidence score za kreiranje default-a (0-100)',
    example: 70,
    default: 70,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  minConfidenceScore?: number;

  @ApiPropertyOptional({
    description: 'Da li da automatski kreira defaults na osnovu analize',
    example: false,
    default: false,
  })
  @IsOptional()
  autoCreateDefaults?: boolean;

  @ApiPropertyOptional({
    description: 'Izvor podataka za analizu (mysql - naša baza, legacy - legacy baza)',
    example: 'mysql',
    default: 'mysql',
    enum: DataSource,
  })
  @IsOptional()
  @IsEnum(DataSource)
  source?: DataSource;

  @ApiPropertyOptional({
    description: 'ID legacy baze iz koje se vrši analiza (samo ako je source=legacy)',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  legacyDatabaseId?: number;

  @ApiPropertyOptional({
    description: 'Broj linije za filtriranje (opciono - ako nije naveden, analiziraju se sve linije)',
    example: '18',
  })
  @IsOptional()
  @IsString()
  lineNumber?: string;
}
