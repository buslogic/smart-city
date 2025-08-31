import { Module } from '@nestjs/common';
import { VehicleSyncService } from './vehicle-sync.service';
import { VehicleSyncController } from './vehicle-sync.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { LegacyDatabasesModule } from '../legacy-databases/legacy-databases.module';
import { VehiclesModule } from '../vehicles/vehicles.module';

@Module({
  imports: [PrismaModule, LegacyDatabasesModule, VehiclesModule],
  providers: [VehicleSyncService],
  controllers: [VehicleSyncController],
  exports: [VehicleSyncService],
})
export class VehicleSyncModule {}
