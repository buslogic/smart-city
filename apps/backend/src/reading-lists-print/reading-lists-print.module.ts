import { Module } from '@nestjs/common';
import { ReadingListsPrintService } from './reading-lists-print.service';
import { ReadingListsPrintController } from './reading-lists-print.controller';
import { PrismaLegacyModule } from '../prisma-legacy/prisma-legacy.module';

@Module({
  imports: [PrismaLegacyModule],
  providers: [ReadingListsPrintService],
  controllers: [ReadingListsPrintController]
})
export class ReadingListsPrintModule {}
