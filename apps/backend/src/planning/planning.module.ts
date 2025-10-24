import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PlanningController } from './planning.controller';
import { PlanningService } from './planning.service';
import { PrismaModule } from '../prisma/prisma.module';
import { LinkedTurnusiModule } from '../linked-turnusi/linked-turnusi.module';

@Module({
  imports: [
    PrismaModule,
    LinkedTurnusiModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET') || 'your-secret-key',
        signOptions: {
          expiresIn: configService.get('JWT_EXPIRATION') || '15m',
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [PlanningController],
  providers: [PlanningService],
  exports: [PlanningService],
})
export class PlanningModule {}
