import { Module } from '@nestjs/common';
import { WaterServicesPricelistService } from './water-services-pricelist.service';
import { WaterServicesPricelistController } from './water-services-pricelist.controller';
import { LegacyDatabasesModule } from '../legacy-databases/legacy-databases.module';

@Module({
  imports: [LegacyDatabasesModule],
  providers: [WaterServicesPricelistService],
  controllers: [WaterServicesPricelistController]
})
export class WaterServicesPricelistModule {}
