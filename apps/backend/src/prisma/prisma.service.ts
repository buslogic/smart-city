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
    // FIX #9: Eksplicitno konfiguriši Prisma connection pool da spreči exhaustion
    // Prisma po defaultu koristi 10 konekcija što je dovoljno za normalne operacije,
    // ali Turnusi sync sa 827k rekorda troši sve konekcije zbog paralelnih raw SQL upita
    const databaseUrl = process.env.DATABASE_URL || '';

    // Parsuj postojeći URL i dodaj connection_limit parametar
    const url = new URL(databaseUrl);

    // Ukloni postojeće pool parametre (koji ne rade sa mysql2)
    url.searchParams.delete('connection_limit');
    url.searchParams.delete('pool_timeout');
    url.searchParams.delete('connect_timeout');

    // Dodaj Prisma-specifične pool parametre
    // connection_limit: maksimalan broj konekcija u pool-u (smanjeno sa 10 na 5)
    // pool_timeout: timeout za dobijanje konekcije iz pool-a (60s)
    url.searchParams.set('connection_limit', '5');
    url.searchParams.set('pool_timeout', '60');

    super({
      datasources: {
        db: {
          url: url.toString(),
        },
      },
      log: ['warn', 'error'],
      errorFormat: 'minimal',
    });

    this.logger.log(`🔧 Prisma connection pool configured: connection_limit=5, pool_timeout=60s`);
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
