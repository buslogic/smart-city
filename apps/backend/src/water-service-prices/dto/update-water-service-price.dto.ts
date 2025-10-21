import { PartialType } from '@nestjs/swagger';
import { CreateWaterServicePriceDto } from './create-water-service-price.dto';

export class UpdateWaterServicePriceDto extends PartialType(CreateWaterServicePriceDto) {}
