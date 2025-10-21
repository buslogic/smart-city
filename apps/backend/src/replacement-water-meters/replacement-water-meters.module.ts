import { Module } from '@nestjs/common';
import { ReplacementWaterMetersService } from './replacement-water-meters.service';
import { ReplacementWaterMetersController } from './replacement-water-meters.controller';
import { PrismaLegacyModule } from '../prisma-legacy/prisma-legacy.module';

@Module({
  imports: [PrismaLegacyModule],
  controllers: [ReplacementWaterMetersController],
  providers: [ReplacementWaterMetersService],
  exports: [ReplacementWaterMetersService],
})
export class ReplacementWaterMetersModule {}
