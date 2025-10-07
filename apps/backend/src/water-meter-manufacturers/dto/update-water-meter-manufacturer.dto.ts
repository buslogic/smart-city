import { PartialType } from '@nestjs/swagger';
import { CreateWaterMeterManufacturerDto } from './create-water-meter-manufacturer.dto';

export class UpdateWaterMeterManufacturerDto extends PartialType(CreateWaterMeterManufacturerDto) {}
