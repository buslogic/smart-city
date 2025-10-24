import { Module } from '@nestjs/common';
import { LinkedTurnusiController } from './linked-turnusi.controller';
import { LinkedTurnusiService } from './linked-turnusi.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [LinkedTurnusiController],
  providers: [LinkedTurnusiService],
  exports: [LinkedTurnusiService],
})
export class LinkedTurnusiModule {}
