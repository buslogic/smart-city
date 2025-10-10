import { Module } from '@nestjs/common';
import { TimetableSchedulesController } from './timetable-schedules.controller';
import { TimetableSchedulesService } from './timetable-schedules.service';
import { PrismaModule } from '../prisma/prisma.module';
import { LegacyDatabasesModule } from '../legacy-databases/legacy-databases.module';

@Module({
  imports: [PrismaModule, LegacyDatabasesModule],
  controllers: [TimetableSchedulesController],
  providers: [TimetableSchedulesService],
  exports: [TimetableSchedulesService],
})
export class TimetableSchedulesModule {}
