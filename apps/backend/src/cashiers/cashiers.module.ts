import { Module } from '@nestjs/common';
import { CashiersController } from './cashiers.controller';
import { CashiersService } from './cashiers.service';
import { PrismaLegacyModule } from '../prisma-legacy/prisma-legacy.module';

@Module({
  imports: [PrismaLegacyModule],
  controllers: [CashiersController],
  providers: [CashiersService],
})
export class CashiersModule {}
