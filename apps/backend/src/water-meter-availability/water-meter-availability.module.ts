import { Module } from '@nestjs/common';
import { WaterMeterAvailabilityService } from './water-meter-availability.service';
import { WaterMeterAvailabilityController } from './water-meter-availability.controller';
import { PrismaLegacyModule } from '../prisma-legacy/prisma-legacy.module';

@Module({
  imports: [PrismaLegacyModule],
  controllers: [WaterMeterAvailabilityController],
  providers: [WaterMeterAvailabilityService],
  exports: [WaterMeterAvailabilityService],
})
export class WaterMeterAvailabilityModule {}
