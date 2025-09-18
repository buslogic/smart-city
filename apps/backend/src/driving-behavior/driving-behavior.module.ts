import { Module } from '@nestjs/common';
import { DrivingBehaviorService } from './driving-behavior.service';
import { DrivingBehaviorController } from './driving-behavior.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [DrivingBehaviorService],
  controllers: [DrivingBehaviorController],
  exports: [DrivingBehaviorService],
})
export class DrivingBehaviorModule {}
