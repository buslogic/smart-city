import { Module } from '@nestjs/common';
import { WaterMeterManufacturersService } from './water-meter-manufacturers.service';
import { WaterMeterManufacturersController } from './water-meter-manufacturers.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [WaterMeterManufacturersController],
  providers: [WaterMeterManufacturersService],
  exports: [WaterMeterManufacturersService],
})
export class WaterMeterManufacturersModule {}
