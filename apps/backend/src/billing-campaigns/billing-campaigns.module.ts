import { Module } from '@nestjs/common';
import { BillingCampaignsService } from './billing-campaigns.service';
import { BillingCampaignsController } from './billing-campaigns.controller';
import { PrismaLegacyModule } from '../prisma-legacy/prisma-legacy.module';

@Module({
  imports: [PrismaLegacyModule],
  providers: [BillingCampaignsService],
  controllers: [BillingCampaignsController],
})
export class BillingCampaignsModule {}
