import { PartialType } from '@nestjs/swagger';
import { IsOptional, IsNumber } from 'class-validator';
import { CreateWaterMeterManufacturerDto } from './create-water-meter-manufacturer.dto';

export class UpdateWaterMeterManufacturerDto extends PartialType(CreateWaterMeterManufacturerDto) {
  @IsOptional()
  @IsNumber()
  id?: number; // ID je opcioni i ignoriše se (koristi se samo iz URL-a)
}
