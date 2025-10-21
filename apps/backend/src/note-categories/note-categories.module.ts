import { Module } from '@nestjs/common';
import { NoteCategoriesService } from './note-categories.service';
import { NoteCategoriesController } from './note-categories.controller';
import { PrismaLegacyModule } from '../prisma-legacy/prisma-legacy.module';

@Module({
  imports: [PrismaLegacyModule],
  controllers: [NoteCategoriesController],
  providers: [NoteCategoriesService],
  exports: [NoteCategoriesService],
})
export class NoteCategoriesModule {}
