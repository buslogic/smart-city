import { Module } from '@nestjs/common';
import { HouseCouncilService } from './house-council.service';
import { HouseCouncilController } from './house-council.controller';
import { PrismaLegacyModule } from '../prisma-legacy/prisma-legacy.module';

@Module({
  imports: [PrismaLegacyModule],
  controllers: [HouseCouncilController],
  providers: [HouseCouncilService],
  exports: [HouseCouncilService],
})
export class HouseCouncilModule {}
