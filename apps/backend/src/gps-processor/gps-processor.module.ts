import { Module } from '@nestjs/common';
import { GpsProcessorService } from './gps-processor.service';
import { GpsProcessorController } from './gps-processor.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [GpsProcessorController],
  providers: [GpsProcessorService],
  exports: [GpsProcessorService],
})
export class GpsProcessorModule {}