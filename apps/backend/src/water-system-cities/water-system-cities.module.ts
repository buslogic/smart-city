import { Module } from '@nestjs/common';
import { WaterSystemCitiesService } from './water-system-cities.service';
import { WaterSystemCitiesController } from './water-system-cities.controller';
import { PrismaLegacyModule } from '../prisma-legacy/prisma-legacy.module';

@Module({
  imports: [PrismaLegacyModule],
  providers: [WaterSystemCitiesService],
  controllers: [WaterSystemCitiesController],
})
export class WaterSystemCitiesModule {}
