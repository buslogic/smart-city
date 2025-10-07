import { Module } from '@nestjs/common';
import { ReplacementWaterMetersService } from './replacement-water-meters.service';
import { ReplacementWaterMetersController } from './replacement-water-meters.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ReplacementWaterMetersController],
  providers: [ReplacementWaterMetersService],
  exports: [ReplacementWaterMetersService],
})
export class ReplacementWaterMetersModule {}
