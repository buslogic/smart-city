import { Module } from '@nestjs/common';
import { DispatcherController } from './dispatcher.controller';
import { DispatcherService } from './dispatcher.service';
import { PrismaModule } from '../prisma/prisma.module';
import { LegacyDatabasesModule } from '../legacy-databases/legacy-databases.module';

@Module({
  imports: [PrismaModule, LegacyDatabasesModule],
  controllers: [DispatcherController],
  providers: [DispatcherService],
  exports: [DispatcherService],
})
export class DispatcherModule {}
