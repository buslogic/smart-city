import { Module } from '@nestjs/common';
import { ReadingListsService } from './reading-lists.service';
import { ReadingListsController } from './reading-lists.controller';
import { PrismaLegacyModule } from '../prisma-legacy/prisma-legacy.module';

@Module({
  imports: [PrismaLegacyModule],
  providers: [ReadingListsService],
  controllers: [ReadingListsController]
})
export class ReadingListsModule {}
