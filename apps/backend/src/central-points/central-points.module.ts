import { Module } from '@nestjs/common';
import { CentralPointsController } from './central-points.controller';
import { CentralPointsService } from './central-points.service';
import { PrismaModule } from '../prisma/prisma.module';
import { LegacyDatabasesModule } from '../legacy-databases/legacy-databases.module';

@Module({
  imports: [PrismaModule, LegacyDatabasesModule],
  controllers: [CentralPointsController],
  providers: [CentralPointsService],
})
export class CentralPointsModule {}
