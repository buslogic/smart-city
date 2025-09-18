import { Module } from '@nestjs/common';
import { GpsProcessorService } from './gps-processor.service';
import { GpsProcessorController } from './gps-processor.controller';
import { GpsLegacyController } from './gps-legacy.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { DrivingBehaviorModule } from '../driving-behavior/driving-behavior.module';

@Module({
  imports: [PrismaModule, DrivingBehaviorModule],
  controllers: [GpsProcessorController, GpsLegacyController],
  providers: [GpsProcessorService],
  exports: [GpsProcessorService],
})
export class GpsProcessorModule {}
