import { PartialType } from '@nestjs/mapped-types';
import { CreateCentralPointDto } from './create-central-point.dto';

export class UpdateCentralPointDto extends PartialType(CreateCentralPointDto) {}
