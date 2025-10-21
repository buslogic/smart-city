import { PartialType } from '@nestjs/mapped-types';
import { CreateWaterSystemStreetDto } from './create-water-system-street.dto';

export class UpdateWaterSystemStreetDto extends PartialType(CreateWaterSystemStreetDto) {}
