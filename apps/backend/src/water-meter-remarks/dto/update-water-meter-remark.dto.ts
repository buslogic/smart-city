import { PartialType } from '@nestjs/swagger';
import { CreateWaterMeterRemarkDto } from './create-water-meter-remark.dto';

export class UpdateWaterMeterRemarkDto extends PartialType(CreateWaterMeterRemarkDto) {}
