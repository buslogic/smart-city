import { Module, Global } from '@nestjs/common';
import { VehicleMapperService } from './helpers/vehicle-mapper';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [VehicleMapperService],
  exports: [VehicleMapperService],
})
export class CommonModule {}