import { Module } from '@nestjs/common';
import { WaterMeterService } from './water-meter.service';
import { WaterMeterController } from './water-meter.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [WaterMeterController],
  providers: [WaterMeterService],
  exports: [WaterMeterService],
})
export class WaterMeterModule {}
