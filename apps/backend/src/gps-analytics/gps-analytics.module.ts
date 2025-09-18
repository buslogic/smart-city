import { Module } from '@nestjs/common';
import { GpsAnalyticsController } from './gps-analytics.controller';
import { GpsAnalyticsService } from './gps-analytics.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [GpsAnalyticsController],
  providers: [GpsAnalyticsService, PrismaService],
  exports: [GpsAnalyticsService],
})
export class GpsAnalyticsModule {}
