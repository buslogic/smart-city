import { Module } from '@nestjs/common';
import { WaterSystemRegionsService } from './water-system-regions.service';
import { WaterSystemRegionsController } from './water-system-regions.controller';
import { PrismaLegacyModule } from '../prisma-legacy/prisma-legacy.module';

@Module({
  imports: [PrismaLegacyModule],
  controllers: [WaterSystemRegionsController],
  providers: [WaterSystemRegionsService],
  exports: [WaterSystemRegionsService],
})
export class WaterSystemRegionsModule {}
