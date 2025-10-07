import { IsInt, IsString, IsBoolean, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWaterMeterDto {
  @ApiPropertyOptional({ description: 'IDMM', example: 12345 })
  @IsInt()
  @IsOptional()
  idmm?: number;

  @ApiPropertyOptional({ description: 'ID tipa vodomera', example: 1 })
  @IsInt()
  @IsOptional()
  typeId?: number;

  @ApiPropertyOptional({ description: 'ID dostupnosti vodomera', example: 1 })
  @IsInt()
  @IsOptional()
  availabilityId?: number;

  @ApiPropertyOptional({ description: 'ID proizvođača vodomera', example: 1 })
  @IsInt()
  @IsOptional()
  manufacturerId?: number;

  @ApiPropertyOptional({ description: 'Datum početka kalibracije', example: '2024-01-01' })
  @IsDateString()
  @IsOptional()
  calibratedFrom?: string;

  @ApiPropertyOptional({ description: 'Datum kraja kalibracije', example: '2029-01-01' })
  @IsDateString()
  @IsOptional()
  calibratedTo?: string;

  @ApiPropertyOptional({ description: 'Serijski broj', example: 'SN123456' })
  @IsString()
  @IsOptional()
  serialNumber?: string;

  @ApiPropertyOptional({ description: 'Brojač', example: 1000 })
  @IsInt()
  @IsOptional()
  counter?: number;

  @ApiPropertyOptional({ description: 'IDV', example: 'IDV-001' })
  @IsString()
  @IsOptional()
  idv?: string;

  @ApiPropertyOptional({ description: 'Modul', example: 'Modul A' })
  @IsString()
  @IsOptional()
  module?: string;

  @ApiPropertyOptional({ description: 'Datum isključenja', example: '2024-12-31' })
  @IsDateString()
  @IsOptional()
  disconnectionDate?: string;

  @ApiProperty({ description: 'Da li je vodomer aktivan', example: true, default: true })
  @IsBoolean()
  aktivan: boolean;
}
