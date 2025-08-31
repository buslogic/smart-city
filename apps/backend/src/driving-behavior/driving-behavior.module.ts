import { Module } from '@nestjs/common';
import { DrivingBehaviorService } from './driving-behavior.service';
import { DrivingBehaviorController } from './driving-behavior.controller';

@Module({
  providers: [DrivingBehaviorService],
  controllers: [DrivingBehaviorController]
})
export class DrivingBehaviorModule {}
