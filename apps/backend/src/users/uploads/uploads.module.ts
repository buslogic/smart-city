import { Module } from '@nestjs/common';
import { UploadsController } from './uploads.controller';
import { SpacesModule } from '../../spaces/spaces.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [SpacesModule, ConfigModule],
  controllers: [UploadsController],
})
export class UploadsModule {}
