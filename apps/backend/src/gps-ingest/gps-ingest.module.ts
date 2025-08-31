import { Module } from '@nestjs/common';
import { GpsIngestController } from './gps-ingest.controller';
import { GpsIngestService } from './gps-ingest.service';

@Module({
  controllers: [GpsIngestController],
  providers: [GpsIngestService],
  exports: [GpsIngestService],
})
export class GpsIngestModule {}