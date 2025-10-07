import { Module } from '@nestjs/common';
import { WaterMeterTypesService } from './water-meter-types.service';
import { WaterMeterTypesController } from './water-meter-types.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [WaterMeterTypesController],
  providers: [WaterMeterTypesService],
  exports: [WaterMeterTypesService],
})
export class WaterMeterTypesModule {}
