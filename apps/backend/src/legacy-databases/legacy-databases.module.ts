import { Module } from '@nestjs/common';
import { LegacyDatabasesService } from './legacy-databases.service';
import { LegacyDatabasesController } from './legacy-databases.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [LegacyDatabasesController],
  providers: [LegacyDatabasesService],
  exports: [LegacyDatabasesService],
})
export class LegacyDatabasesModule {}