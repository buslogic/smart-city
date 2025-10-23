import { Module } from '@nestjs/common';
import { MeasuringPointsByAddressService } from './measuring-points-by-address.service';
import { MeasuringPointsByAddressController } from './measuring-points-by-address.controller';
import { LegacyDatabasesModule } from '../legacy-databases/legacy-databases.module';

@Module({
  imports: [LegacyDatabasesModule],
  providers: [MeasuringPointsByAddressService],
  controllers: [MeasuringPointsByAddressController]
})
export class MeasuringPointsByAddressModule {}
