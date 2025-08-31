import { Module } from '@nestjs/common';
import { GpsSyncController } from './gps-sync.controller';
import { GpsSyncService } from './gps-sync.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [GpsSyncController],
  providers: [GpsSyncService],
  exports: [GpsSyncService],
})
export class GpsSyncModule {}