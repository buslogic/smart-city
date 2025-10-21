import { IsInt, IsOptional, IsString, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMeasuringPointDto {
  @ApiProperty({ description: 'ID mernog mesta (IDMM)' })
  @IsInt()
  IDMM: number;

  @ApiPropertyOptional({ description: 'ID adrese (IDU)' })
  @IsOptional()
  @IsInt()
  IDU?: number;

  @ApiPropertyOptional({ description: 'ID zone' })
  @IsOptional()
  @IsInt()
  zoneId?: number;

  @ApiPropertyOptional({ description: 'ID ulice' })
  @IsOptional()
  @IsInt()
  streetId?: number;

  @ApiPropertyOptional({ description: 'Kućni broj' })
  @IsOptional()
  @IsString()
  houseNumber?: string;

  @ApiPropertyOptional({ description: 'ID tipa mernog mesta' })
  @IsOptional()
  @IsInt()
  typeId?: number;

  @ApiPropertyOptional({ description: 'Status ID' })
  @IsOptional()
  @IsInt()
  status?: number;

  @ApiPropertyOptional({ description: 'Da li je aktivno', default: true })
  @IsOptional()
  @IsBoolean()
  aktivan?: boolean;
}
