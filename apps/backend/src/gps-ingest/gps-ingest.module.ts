import { Module } from '@nestjs/common';
import { GpsIngestController } from './gps-ingest.controller';
import { GpsIngestService } from './gps-ingest.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ApiKeysModule } from '../api-keys/api-keys.module';

@Module({
  imports: [PrismaModule, ApiKeysModule],
  controllers: [GpsIngestController],
  providers: [GpsIngestService],
  exports: [GpsIngestService],
})
export class GpsIngestModule {}