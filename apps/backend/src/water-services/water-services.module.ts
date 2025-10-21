import { Module } from '@nestjs/common';
import { WaterServicesService } from './water-services.service';
import { WaterServicesController } from './water-services.controller';
import { PrismaLegacyModule } from '../prisma-legacy/prisma-legacy.module';

@Module({
  imports: [PrismaLegacyModule],
  controllers: [WaterServicesController],
  providers: [WaterServicesService],
  exports: [WaterServicesService],
})
export class WaterServicesModule {}
