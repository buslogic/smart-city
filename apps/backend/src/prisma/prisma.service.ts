import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private healthCheckInterval: any;

  constructor() {
    super({
      log: ['warn', 'error'],
      errorFormat: 'minimal',
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('✅ Prisma connected to database');

    // Health check svakih 5 minuta
    this.healthCheckInterval = setInterval(
      async () => {
        try {
          await this.$queryRaw`SELECT 1`;
          // this.logger.debug('Prisma health check passed');
        } catch (error) {
          this.logger.error(
            '❌ Prisma health check failed, attempting reconnect...',
            error,
          );
          try {
            await this.$disconnect();
            await this.$connect();
            this.logger.log('✅ Prisma reconnected successfully');
          } catch (reconnectError) {
            this.logger.error('❌ Prisma reconnect failed:', reconnectError);
          }
        }
      },
      5 * 60 * 1000,
    ); // 5 minuta
  }

  async onModuleDestroy() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    await this.$disconnect();
    this.logger.log('🔌 Prisma disconnected from database');
  }
}
