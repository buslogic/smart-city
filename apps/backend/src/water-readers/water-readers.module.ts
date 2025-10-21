import { Module } from '@nestjs/common';
import { WaterReadersService } from './water-readers.service';
import { WaterReadersController } from './water-readers.controller';
import { PrismaLegacyModule } from '../prisma-legacy/prisma-legacy.module';

@Module({
  imports: [PrismaLegacyModule],
  providers: [WaterReadersService],
  controllers: [WaterReadersController]
})
export class WaterReadersModule {}
