import { PartialType } from '@nestjs/swagger';
import { CreateReplacementWaterMeterDto } from './create-replacement-water-meter.dto';
import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateReplacementWaterMeterDto extends PartialType(CreateReplacementWaterMeterDto) {
  @ApiPropertyOptional({ description: 'Merno mesto (IDMM | adresa)' })
  @IsOptional()
  @IsString()
  measuringPoint?: string;

  @ApiPropertyOptional({ description: 'Tip (ID | naziv)' })
  @IsOptional()
  @IsString()
  typeId?: string;

  @ApiPropertyOptional({ description: 'Proizvođač (ID | naziv)' })
  @IsOptional()
  @IsString()
  manufacturerId?: string;

  @ApiPropertyOptional({ description: 'Dostupnost (ID | naziv)' })
  @IsOptional()
  @IsString()
  availabilityId?: string;
}
