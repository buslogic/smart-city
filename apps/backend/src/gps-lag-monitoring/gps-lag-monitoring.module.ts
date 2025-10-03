import { Module } from '@nestjs/common';
import { GpsLagMonitoringController } from './gps-lag-monitoring.controller';
import { GpsLagMonitoringService } from './gps-lag-monitoring.service';

@Module({
  controllers: [GpsLagMonitoringController],
  providers: [GpsLagMonitoringService],
  exports: [GpsLagMonitoringService],
})
export class GpsLagMonitoringModule {}
