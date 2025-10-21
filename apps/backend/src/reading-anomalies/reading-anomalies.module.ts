import { Module } from '@nestjs/common';
import { ReadingAnomaliesService } from './reading-anomalies.service';
import { ReadingAnomaliesController } from './reading-anomalies.controller';
import { PrismaLegacyModule } from '../prisma-legacy/prisma-legacy.module';

@Module({
  imports: [PrismaLegacyModule],
  providers: [ReadingAnomaliesService],
  controllers: [ReadingAnomaliesController],
})
export class ReadingAnomaliesModule {}
