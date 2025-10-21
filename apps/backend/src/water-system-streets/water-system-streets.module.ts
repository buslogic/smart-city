import { Module } from '@nestjs/common';
import { WaterSystemStreetsService } from './water-system-streets.service';
import { WaterSystemStreetsController } from './water-system-streets.controller';
import { PrismaLegacyModule } from '../prisma-legacy/prisma-legacy.module';

@Module({
  imports: [PrismaLegacyModule],
  controllers: [WaterSystemStreetsController],
  providers: [WaterSystemStreetsService],
  exports: [WaterSystemStreetsService],
})
export class WaterSystemStreetsModule {}
