import { Module } from '@nestjs/common';
import { GpsAnalyticsController } from './gps-analytics.controller';
import { GpsAnalyticsService } from './gps-analytics.service';

@Module({
  controllers: [GpsAnalyticsController],
  providers: [GpsAnalyticsService],
  exports: [GpsAnalyticsService],
})
export class GpsAnalyticsModule {}