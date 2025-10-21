import { Module } from '@nestjs/common';
import { UserAccountsController } from './user-accounts.controller';
import { UserAccountsService } from './user-accounts.service';
import { PrismaLegacyModule } from '../prisma-legacy/prisma-legacy.module';

@Module({
  imports: [PrismaLegacyModule],
  controllers: [UserAccountsController],
  providers: [UserAccountsService],
  exports: [UserAccountsService],
})
export class UserAccountsModule {}
