import { IsString, IsOptional, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateFiscalDeviceDto {
  @ApiProperty({ description: 'Naziv fiskalnog uređaja' })
  @IsString()
  @IsNotEmpty()
  naziv: string;

  @ApiPropertyOptional({ description: 'Model' })
  @IsString()
  @IsOptional()
  model?: string;

  @ApiPropertyOptional({ description: 'Krajnja tačka (endpoint)' })
  @IsString()
  @IsOptional()
  krajnja_tacka?: string;

  @ApiPropertyOptional({ description: 'Datum poslednje sinhronizacije' })
  @IsOptional()
  poslednja_sinhronizacija?: string;

  @ApiPropertyOptional({ description: 'Status (ID | naziv format)' })
  @IsOptional()
  status?: string;
}
