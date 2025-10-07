import { Module } from '@nestjs/common';
import { WaterMeterAvailabilityService } from './water-meter-availability.service';
import { WaterMeterAvailabilityController } from './water-meter-availability.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [WaterMeterAvailabilityController],
  providers: [WaterMeterAvailabilityService],
  exports: [WaterMeterAvailabilityService],
})
export class WaterMeterAvailabilityModule {}
