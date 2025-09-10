import { Module } from '@nestjs/common';
import { DrivingRecreationController } from './driving-recreation.controller';
import { DrivingRecreationService } from './driving-recreation.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [PrismaModule, CommonModule],
  controllers: [DrivingRecreationController],
  providers: [DrivingRecreationService],
  exports: [DrivingRecreationService],
})
export class DrivingRecreationModule {}