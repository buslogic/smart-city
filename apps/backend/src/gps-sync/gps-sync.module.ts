import { Module } from '@nestjs/common';
import { GpsSyncController } from './gps-sync.controller';
import { GpsSyncDashboardController } from './gps-sync-dashboard.controller';
import { GpsSyncService } from './gps-sync.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [PrismaModule, CommonModule],
  controllers: [GpsSyncController, GpsSyncDashboardController],
  providers: [GpsSyncService],
  exports: [GpsSyncService],
})
export class GpsSyncModule {}