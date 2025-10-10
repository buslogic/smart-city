import { Module } from '@nestjs/common';
import { StopsSyncController } from './stops-sync.controller';
import { StopsSyncService } from './stops-sync.service';
import { PrismaModule } from '../prisma/prisma.module';
import { LegacyDatabasesModule } from '../legacy-databases/legacy-databases.module';

@Module({
  imports: [PrismaModule, LegacyDatabasesModule],
  controllers: [StopsSyncController],
  providers: [StopsSyncService],
  exports: [StopsSyncService],
})
export class StopsSyncModule {}
