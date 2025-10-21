import { PartialType } from '@nestjs/swagger';
import { CreateWaterSupplyNoteDto } from './create-water-supply-note.dto';

export class UpdateWaterSupplyNoteDto extends PartialType(CreateWaterSupplyNoteDto) {}
