import { Module } from '@nestjs/common';
import { TurnusiSyncController } from './turnusi-sync.controller';
import { TurnusiSyncService } from './turnusi-sync.service';
import { PrismaModule } from '../prisma/prisma.module';
import { LegacyDatabasesModule } from '../legacy-databases/legacy-databases.module';

@Module({
  imports: [PrismaModule, LegacyDatabasesModule],
  controllers: [TurnusiSyncController],
  providers: [TurnusiSyncService],
  exports: [TurnusiSyncService],
})
export class TurnusiSyncModule {}
