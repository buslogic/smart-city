import { Module } from '@nestjs/common';
import { SubsidiesUserAssignmentController } from './subsidies-user-assignment.controller';
import { SubsidiesUserAssignmentService } from './subsidies-user-assignment.service';
import { PrismaLegacyModule } from '../prisma-legacy/prisma-legacy.module';

@Module({
  imports: [PrismaLegacyModule],
  controllers: [SubsidiesUserAssignmentController],
  providers: [SubsidiesUserAssignmentService],
  exports: [SubsidiesUserAssignmentService],
})
export class SubsidiesUserAssignmentModule {}
