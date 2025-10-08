import { Module } from '@nestjs/common';
import { PriceListGroupsController } from './price-list-groups.controller';
import { PriceListGroupsService } from './price-list-groups.service';
import { PrismaModule } from '../prisma/prisma.module';
import { LegacyDatabasesModule } from '../legacy-databases/legacy-databases.module';

@Module({
  imports: [PrismaModule, LegacyDatabasesModule],
  controllers: [PriceListGroupsController],
  providers: [PriceListGroupsService],
})
export class PriceListGroupsModule {}
