import { Module } from '@nestjs/common';
import { ConsumersService } from './consumers.service';
import { ConsumersController } from './consumers.controller';
import { LegacyDatabasesModule } from '../legacy-databases/legacy-databases.module';

@Module({
  imports: [LegacyDatabasesModule],
  providers: [ConsumersService],
  controllers: [ConsumersController]
})
export class ConsumersModule {}
