import { Module } from '@nestjs/common';
import { WaterMeterRemarksService } from './water-meter-remarks.service';
import { WaterMeterRemarksController } from './water-meter-remarks.controller';
import { PrismaLegacyModule } from '../prisma-legacy/prisma-legacy.module';

@Module({
  imports: [PrismaLegacyModule],
  controllers: [WaterMeterRemarksController],
  providers: [WaterMeterRemarksService],
  exports: [WaterMeterRemarksService],
})
export class WaterMeterRemarksModule {}
