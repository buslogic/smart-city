import { Module } from '@nestjs/common';
import { SubCampaignsController } from './sub-campaigns.controller';
import { SubCampaignsService } from './sub-campaigns.service';
import { PrismaLegacyModule } from '../prisma-legacy/prisma-legacy.module';

@Module({
  imports: [PrismaLegacyModule],
  controllers: [SubCampaignsController],
  providers: [SubCampaignsService],
  exports: [SubCampaignsService],
})
export class SubCampaignsModule {}
