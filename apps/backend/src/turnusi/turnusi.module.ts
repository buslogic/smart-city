import { Module } from '@nestjs/common';
import { TurnusiController } from './turnusi.controller';
import { TurnusiService } from './turnusi.service';
import { PrismaModule } from '../prisma/prisma.module';
import { LegacyDatabasesModule } from '../legacy-databases/legacy-databases.module';

@Module({
  imports: [PrismaModule, LegacyDatabasesModule],
  controllers: [TurnusiController],
  providers: [TurnusiService],
  exports: [TurnusiService],
})
export class TurnusiModule {}
