import { Module } from '@nestjs/common';
import { TimescaledbController } from './timescaledb.controller';
import { TimescaledbService } from './timescaledb.service';

@Module({
  controllers: [TimescaledbController],
  providers: [TimescaledbService],
  exports: [TimescaledbService],
})
export class TimescaledbModule {}