import { Module } from '@nestjs/common';
import { VehiclesService } from './vehicles.service';
import { VehiclesController } from './vehicles.controller';
import { VehiclesGpsController } from './vehicles-gps.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [VehiclesController, VehiclesGpsController],
  providers: [VehiclesService],
  exports: [VehiclesService],
})
export class VehiclesModule {}