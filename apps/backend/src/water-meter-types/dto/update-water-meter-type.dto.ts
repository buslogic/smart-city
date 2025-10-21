import { PartialType } from '@nestjs/swagger';
import { IsOptional, IsNumber } from 'class-validator';
import { CreateWaterMeterTypeDto } from './create-water-meter-type.dto';

export class UpdateWaterMeterTypeDto extends PartialType(
  CreateWaterMeterTypeDto,
) {
  @IsOptional()
  @IsNumber()
  id?: number; // ID je opcioni i ignoriše se (koristi se samo iz URL-a)
}
