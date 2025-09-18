import { Module } from '@nestjs/common';
import { MigrationController } from './migration.controller';
import { MigrationService } from './migration.service';
import { MigrationParallelService } from './migration-parallel.service';

@Module({
  controllers: [MigrationController],
  providers: [MigrationService, MigrationParallelService],
  exports: [MigrationService, MigrationParallelService],
})
export class MigrationModule {}
