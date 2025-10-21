import { Module } from '@nestjs/common';
import { WaterMeterTypesService } from './water-meter-types.service';
import { WaterMeterTypesController } from './water-meter-types.controller';
import { PrismaLegacyModule } from '../prisma-legacy/prisma-legacy.module';

@Module({
  imports: [PrismaLegacyModule],
  controllers: [WaterMeterTypesController],
  providers: [WaterMeterTypesService],
  exports: [WaterMeterTypesService],
})
export class WaterMeterTypesModule {}
