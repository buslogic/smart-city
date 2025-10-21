import { PartialType } from '@nestjs/swagger';
import { IsOptional, IsNumber } from 'class-validator';
import { CreateWaterMeterAvailabilityDto } from './create-water-meter-availability.dto';

export class UpdateWaterMeterAvailabilityDto extends PartialType(CreateWaterMeterAvailabilityDto) {
  @IsOptional()
  @IsNumber()
  id?: number; // ID je opcioni i ignoriše se (koristi se samo iz URL-a)
}
