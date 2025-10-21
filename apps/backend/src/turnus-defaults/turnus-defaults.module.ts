import { Module } from '@nestjs/common';
import { TurnusDefaultsService } from './turnus-defaults.service';
import { TurnusDefaultsController } from './turnus-defaults.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { LegacyDatabasesModule } from '../legacy-databases/legacy-databases.module';

@Module({
  imports: [PrismaModule, LegacyDatabasesModule],
  controllers: [TurnusDefaultsController],
  providers: [TurnusDefaultsService],
  exports: [TurnusDefaultsService],
})
export class TurnusDefaultsModule {}
