import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { MailgunService } from './mailgun.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [MailService, MailgunService],
  exports: [MailService],
})
export class MailModule {}
