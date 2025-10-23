import { Module } from '@nestjs/common';
import { FiscalDeviceService } from './fiscal-device.service';
import { FiscalDeviceController } from './fiscal-device.controller';
import { PrismaLegacyModule } from '../prisma-legacy/prisma-legacy.module';

@Module({
  imports: [PrismaLegacyModule],
  providers: [FiscalDeviceService],
  controllers: [FiscalDeviceController],
})
export class FiscalDeviceModule {}
