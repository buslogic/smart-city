import { PartialType } from '@nestjs/swagger';
import { CreateWaterMeterTypeDto } from './create-water-meter-type.dto';

export class UpdateWaterMeterTypeDto extends PartialType(
  CreateWaterMeterTypeDto,
) {}
