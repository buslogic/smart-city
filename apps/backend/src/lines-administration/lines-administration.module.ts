import { Module } from '@nestjs/common';
import { LinesAdministrationController } from './lines-administration.controller';
import { LinesAdministrationService } from './lines-administration.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [LinesAdministrationController],
  providers: [LinesAdministrationService],
  exports: [LinesAdministrationService],
})
export class LinesAdministrationModule {}
