import { Module } from '@nestjs/common';
import { PriceVariationsService } from './price-variations.service';
import { PriceVariationsController } from './price-variations.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { LegacyDatabasesModule } from '../legacy-databases/legacy-databases.module';

@Module({
  imports: [PrismaModule, LegacyDatabasesModule],
  controllers: [PriceVariationsController],
  providers: [PriceVariationsService],
  exports: [PriceVariationsService],
})
export class PriceVariationsModule {}
