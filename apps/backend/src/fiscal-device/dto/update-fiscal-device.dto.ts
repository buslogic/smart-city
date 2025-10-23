import { PartialType } from '@nestjs/swagger';
import { CreateFiscalDeviceDto } from './create-fiscal-device.dto';

export class UpdateFiscalDeviceDto extends PartialType(CreateFiscalDeviceDto) {}
