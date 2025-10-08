import { Module } from '@nestjs/common';
import { TimetableDatesService } from './timetable-dates.service';
import { TimetableDatesController } from './timetable-dates.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { LegacyDatabasesModule } from '../legacy-databases/legacy-databases.module';

@Module({
  imports: [PrismaModule, LegacyDatabasesModule],
  controllers: [TimetableDatesController],
  providers: [TimetableDatesService],
  exports: [TimetableDatesService],
})
export class TimetableDatesModule {}
