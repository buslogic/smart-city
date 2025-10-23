import { PartialType } from '@nestjs/mapped-types';
import { CreateHouseCouncilDto } from './create-house-council.dto';

export class UpdateHouseCouncilDto extends PartialType(CreateHouseCouncilDto) {}
