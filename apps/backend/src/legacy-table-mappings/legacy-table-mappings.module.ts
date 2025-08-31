import { Module } from '@nestjs/common';
import { LegacyTableMappingsController } from './legacy-table-mappings.controller';
import { LegacyTableMappingsService } from './legacy-table-mappings.service';
import { PrismaModule } from '../prisma/prisma.module';
import { LegacyDatabasesModule } from '../legacy-databases/legacy-databases.module';

@Module({
  imports: [PrismaModule, LegacyDatabasesModule],
  controllers: [LegacyTableMappingsController],
  providers: [LegacyTableMappingsService],
  exports: [LegacyTableMappingsService],
})
export class LegacyTableMappingsModule {}
