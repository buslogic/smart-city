import { PartialType } from '@nestjs/mapped-types';
import { CreateWaterSystemRegionDto } from './create-water-system-region.dto';

export class UpdateWaterSystemRegionDto extends PartialType(CreateWaterSystemRegionDto) {}
