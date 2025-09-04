import { Module } from '@nestjs/common';
import { GpsSyncController } from './gps-sync.controller';
import { GpsSyncDashboardController } from './gps-sync-dashboard.controller';
import { LegacySyncController } from './legacy-sync.controller';
import { GpsSyncService } from './gps-sync.service';
import { LegacySyncService } from './legacy-sync.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [PrismaModule, CommonModule],
  controllers: [GpsSyncController, GpsSyncDashboardController, LegacySyncController],
  providers: [GpsSyncService, LegacySyncService],
  exports: [GpsSyncService, LegacySyncService],
})
export class GpsSyncModule {}