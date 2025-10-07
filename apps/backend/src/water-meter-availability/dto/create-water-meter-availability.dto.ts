import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateWaterMeterAvailabilityDto {
  @ApiProperty({ description: 'Dostupnost vodomera', example: 'Dostupan' })
  @IsString()
  @IsNotEmpty()
  availability: string;
}
