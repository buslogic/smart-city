import { Global, Module } from '@nestjs/common';
import { PrismaLegacyService } from './prisma-legacy.service';

@Global()
@Module({
  providers: [PrismaLegacyService],
  exports: [PrismaLegacyService],
})
export class PrismaLegacyModule {}
