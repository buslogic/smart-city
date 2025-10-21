import { Module } from '@nestjs/common';
import { WaterMeterManufacturersService } from './water-meter-manufacturers.service';
import { WaterMeterManufacturersController } from './water-meter-manufacturers.controller';
import { PrismaLegacyModule } from '../prisma-legacy/prisma-legacy.module';

@Module({
  imports: [PrismaLegacyModule],
  controllers: [WaterMeterManufacturersController],
  providers: [WaterMeterManufacturersService],
  exports: [WaterMeterManufacturersService],
})
export class WaterMeterManufacturersModule {}
