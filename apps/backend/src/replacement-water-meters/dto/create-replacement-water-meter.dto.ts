import { IsInt, IsString, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateReplacementWaterMeterDto {
  @ApiPropertyOptional({ description: 'ID zamenjenog vodomera', example: 1 })
  @IsInt()
  @IsOptional()
  replacedId?: number;

  @ApiPropertyOptional({ description: 'IDMM', example: 12345 })
  @IsInt()
  @IsOptional()
  idmm?: number;

  @ApiPropertyOptional({ description: 'IDV', example: 'IDV-001' })
  @IsString()
  @IsOptional()
  idv?: string;

  @ApiPropertyOptional({ description: 'ID tipa vodomera', example: 1 })
  @IsInt()
  @IsOptional()
  type?: number;

  @ApiPropertyOptional({ description: 'ID dostupnosti vodomera', example: 1 })
  @IsInt()
  @IsOptional()
  availability?: number;

  @ApiPropertyOptional({ description: 'ID proizvođača vodomera', example: 1 })
  @IsInt()
  @IsOptional()
  manufacturer?: number;

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

  @ApiPropertyOptional({ description: 'Modul', example: 'Modul A' })
  @IsString()
  @IsOptional()
  module?: string;
}
