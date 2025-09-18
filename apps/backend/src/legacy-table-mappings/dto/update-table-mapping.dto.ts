import { PartialType } from '@nestjs/swagger';
import { CreateTableMappingDto } from './create-table-mapping.dto';

export class UpdateTableMappingDto extends PartialType(CreateTableMappingDto) {}
