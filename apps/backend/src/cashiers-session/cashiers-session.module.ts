import { Module } from '@nestjs/common';
import { CashiersSessionController } from './cashiers-session.controller';
import { CashiersSessionService } from './cashiers-session.service';
import { PrismaLegacyModule } from '../prisma-legacy/prisma-legacy.module';

@Module({
  imports: [PrismaLegacyModule],
  controllers: [CashiersSessionController],
  providers: [CashiersSessionService],
})
export class CashiersSessionModule {}
