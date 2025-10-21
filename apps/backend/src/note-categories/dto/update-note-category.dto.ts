import { PartialType } from '@nestjs/swagger';
import { CreateNoteCategoryDto } from './create-note-category.dto';

export class UpdateNoteCategoryDto extends PartialType(CreateNoteCategoryDto) {}
