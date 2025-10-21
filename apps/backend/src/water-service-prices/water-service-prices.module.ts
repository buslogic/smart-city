import { Module } from '@nestjs/common';
import { WaterServicePricesService } from './water-service-prices.service';
import { WaterServicePricesController } from './water-service-prices.controller';
import { PrismaLegacyModule } from '../prisma-legacy/prisma-legacy.module';

@Module({
  imports: [PrismaLegacyModule],
  controllers: [WaterServicePricesController],
  providers: [WaterServicePricesService],
  exports: [WaterServicePricesService],
})
export class WaterServicePricesModule {}
