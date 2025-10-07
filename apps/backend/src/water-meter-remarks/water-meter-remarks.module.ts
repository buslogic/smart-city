import { Module } from '@nestjs/common';
import { WaterMeterRemarksService } from './water-meter-remarks.service';
import { WaterMeterRemarksController } from './water-meter-remarks.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [WaterMeterRemarksController],
  providers: [WaterMeterRemarksService],
  exports: [WaterMeterRemarksService],
})
export class WaterMeterRemarksModule {}
