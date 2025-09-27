import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { MailModule } from '../mail/mail.module';
import { LegacyDatabasesModule } from '../legacy-databases/legacy-databases.module';

@Module({
  imports: [MailModule, LegacyDatabasesModule],
  providers: [UsersService],
  controllers: [UsersController],
})
export class UsersModule {}
