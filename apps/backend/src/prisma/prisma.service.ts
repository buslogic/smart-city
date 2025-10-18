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

    // Povećaj MySQL session timeout-e za long-running operacije
    try {
      await this.$executeRaw`SET SESSION net_read_timeout = 600`;
      await this.$executeRaw`SET SESSION net_write_timeout = 600`;
      await this.$executeRaw`SET SESSION wait_timeout = 3600`;
      this.logger.log('✅ MySQL session timeouts increased (read: 600s, write: 600s, wait: 3600s)');
    } catch (error) {
      this.logger.warn('⚠️  Failed to set MySQL session timeouts:', error.message);
    }

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

            // Ponovo postavi session timeouts nakon reconnect-a
            try {
              await this.$executeRaw`SET SESSION net_read_timeout = 600`;
              await this.$executeRaw`SET SESSION net_write_timeout = 600`;
              await this.$executeRaw`SET SESSION wait_timeout = 3600`;
              this.logger.log('✅ MySQL session timeouts re-applied after reconnect');
            } catch (timeoutError) {
              this.logger.warn('⚠️  Failed to re-apply session timeouts:', timeoutError.message);
            }
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
