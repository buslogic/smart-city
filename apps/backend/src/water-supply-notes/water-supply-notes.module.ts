import { Module } from '@nestjs/common';
import { WaterSupplyNotesController } from './water-supply-notes.controller';
import { WaterSupplyNotesService } from './water-supply-notes.service';
import { PrismaLegacyModule } from '../prisma-legacy/prisma-legacy.module';

@Module({
  imports: [PrismaLegacyModule],
  controllers: [WaterSupplyNotesController],
  providers: [WaterSupplyNotesService],
  exports: [WaterSupplyNotesService],
})
export class WaterSupplyNotesModule {}
