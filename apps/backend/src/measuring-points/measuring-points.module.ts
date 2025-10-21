import { Module } from '@nestjs/common';
import { MeasuringPointsService } from './measuring-points.service';
import { MeasuringPointsController } from './measuring-points.controller';
import { PrismaLegacyModule } from '../prisma-legacy/prisma-legacy.module';

@Module({
  imports: [PrismaLegacyModule],
  controllers: [MeasuringPointsController],
  providers: [MeasuringPointsService],
})
export class MeasuringPointsModule {}
