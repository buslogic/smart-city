import { Module } from '@nestjs/common';
import { WaterSystemZonesService } from './water-system-zones.service';
import { WaterSystemZonesController } from './water-system-zones.controller';
import { PrismaLegacyModule } from '../prisma-legacy/prisma-legacy.module';

@Module({
  imports: [PrismaLegacyModule],
  providers: [WaterSystemZonesService],
  controllers: [WaterSystemZonesController],
})
export class WaterSystemZonesModule {}
