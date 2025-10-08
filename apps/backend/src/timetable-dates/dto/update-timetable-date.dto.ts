import { PartialType } from '@nestjs/swagger';
import { CreateTimetableDateDto } from './create-timetable-date.dto';

export class UpdateTimetableDateDto extends PartialType(
  CreateTimetableDateDto,
) {}
