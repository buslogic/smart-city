import { PartialType } from '@nestjs/swagger';
import { CreateReplacementWaterMeterDto } from './create-replacement-water-meter.dto';

export class UpdateReplacementWaterMeterDto extends PartialType(CreateReplacementWaterMeterDto) {}
