import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateWaterMeterManufacturerDto {
  @ApiProperty({ description: 'Proizvođač vodomera', example: 'Siemens' })
  @IsString()
  @IsNotEmpty()
  manufacturer: string;
}
