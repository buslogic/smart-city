import { Module } from '@nestjs/common';
import { WaterMeterCalculationService } from './water-meter-calculation.service';
import { WaterMeterCalculationController } from './water-meter-calculation.controller';
import { PrismaLegacyModule } from '../prisma-legacy/prisma-legacy.module';

@Module({
  imports: [PrismaLegacyModule],
  providers: [WaterMeterCalculationService],
  controllers: [WaterMeterCalculationController]
})
export class WaterMeterCalculationModule {}
