import { PartialType } from '@nestjs/swagger';
import { CreateWaterServiceDto } from './create-water-service.dto';

export class UpdateWaterServiceDto extends PartialType(CreateWaterServiceDto) {}
