import { PartialType } from '@nestjs/swagger';
import { CreateWaterMeterAvailabilityDto } from './create-water-meter-availability.dto';

export class UpdateWaterMeterAvailabilityDto extends PartialType(CreateWaterMeterAvailabilityDto) {}
