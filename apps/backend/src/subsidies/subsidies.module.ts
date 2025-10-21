import { Module } from '@nestjs/common';
import { SubsidiesService } from './subsidies.service';
import { SubsidiesController } from './subsidies.controller';
import { PrismaLegacyModule } from '../prisma-legacy/prisma-legacy.module';

@Module({
  imports: [PrismaLegacyModule],
  providers: [SubsidiesService],
  controllers: [SubsidiesController],
})
export class SubsidiesModule {}
