import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LegacyDatabasesService } from '../legacy-databases/legacy-databases.service';
import { CreatePriceVariationDto } from './dto/create-price-variation.dto';
import { UpdatePriceVariationDto } from './dto/update-price-variation.dto';
import { createConnection } from 'mysql2/promise';

@Injectable()
export class PriceVariationsService {
  constructor(
    private prisma: PrismaService,
    private legacyDatabasesService: LegacyDatabasesService,
  ) {}

  // ========== GLAVNI SERVER (NAŠA BAZA) ==========

  async create(createPriceVariationDto: CreatePriceVariationDto) {
    const { legacyCityId, legacyTicketingId, ...rest } = createPriceVariationDto;

    // Filter out undefined values
    const filteredData = Object.fromEntries(
      Object.entries(rest).filter(([_, value]) => value !== undefined),
    ) as any;

    const result = await this.prisma.priceVariation.create({
      data: {
        ...filteredData,
        legacyCityId: legacyCityId ? BigInt(legacyCityId) : null,
        legacyTicketingId: legacyTicketingId ? BigInt(legacyTicketingId) : null,
      },
    });

    return this.convertBigIntToString(result);
  }

  async findAllMain(page = 1, limit = 50) {
    const skip = (page - 1) * limit;

    const [results, total] = await Promise.all([
      this.prisma.priceVariation.findMany({
        orderBy: { id: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.priceVariation.count(),
    ]);

    return {
      data: results.map((variation) => this.convertBigIntToString(variation)),
      total,
      page,
      limit,
    };
  }

  async findOne(id: number) {
    const variation = await this.prisma.priceVariation.findUnique({
      where: { id },
    });

    if (!variation) {
      throw new NotFoundException(`Varijacija sa ID ${id} nije pronađena`);
    }

    return this.convertBigIntToString(variation);
  }

  async update(id: number, updatePriceVariationDto: UpdatePriceVariationDto) {
    await this.findOne(id); // Proverava da li postoji

    const { legacyCityId, legacyTicketingId, ...rest } = updatePriceVariationDto;

    // Filter out undefined values
    const filteredData = Object.fromEntries(
      Object.entries(rest).filter(([_, value]) => value !== undefined),
    ) as any;

    const result = await this.prisma.priceVariation.update({
      where: { id },
      data: {
        ...filteredData,
        ...(legacyCityId !== undefined && {
          legacyCityId: legacyCityId ? BigInt(legacyCityId) : null,
        }),
        ...(legacyTicketingId !== undefined && {
          legacyTicketingId: legacyTicketingId
            ? BigInt(legacyTicketingId)
            : null,
        }),
      },
    });

    return this.convertBigIntToString(result);
  }

  async remove(id: number) {
    await this.findOne(id); // Proverava da li postoji

    const result = await this.prisma.priceVariation.delete({
      where: { id },
    });

    return this.convertBigIntToString(result);
  }

  // ========== TIKETING SERVER (LEGACY BAZA) ==========

  async findAllTicketing(page = 1, limit = 50) {
    return this.findAllFromLegacy('main_ticketing_database', page, limit);
  }

  // ========== GRADSKI SERVER (LEGACY BAZA) ==========

  async findAllCity(page = 1, limit = 50) {
    return this.findAllFromLegacy('city_ticketing_database', page, limit);
  }

  // ========== SINHRONIZACIJA ==========

  async syncFromTicketing(userId: number) {
    console.log('🔄 Starting Ticketing Server sync for price variations...');
    const startTime = Date.now();

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    let totalProcessed = 0;

    try {
      const legacyDb = await this.prisma.legacyDatabase.findFirst({
        where: { subtype: 'main_ticketing_database' },
      });

      if (!legacyDb) {
        throw new NotFoundException(
          'Legacy baza "Glavna Ticketing Baza" nije pronađena',
        );
      }

      const decryptedPassword =
        this.legacyDatabasesService.decryptPassword(legacyDb.password);

      const connection = await createConnection({
        host: legacyDb.host,
        port: legacyDb.port,
        user: legacyDb.username,
        password: decryptedPassword,
        database: legacyDb.database,
      });

      try {
        const [rows] = await connection.execute(
          'SELECT * FROM price_variation ORDER BY id ASC',
        );

        const legacyRecords = rows as any[];
        totalProcessed = legacyRecords.length;

        console.log(`📊 Found ${totalProcessed} records in legacy database`);

        const BATCH_SIZE = 50;
        for (let i = 0; i < legacyRecords.length; i += BATCH_SIZE) {
          const batch = legacyRecords.slice(i, i + BATCH_SIZE);

          for (const legacyRecord of batch) {
            try {
              const result =
                await this.processPriceVariationSyncFromTicketing(legacyRecord);

              switch (result.action) {
                case 'create':
                  created++;
                  break;
                case 'update':
                  updated++;
                  break;
                case 'skip':
                  skipped++;
                  break;
              }
            } catch (error) {
              errors++;
              console.error(
                `❌ Error processing record ID ${legacyRecord.id}:`,
                error.message,
              );
            }
          }

          const processed = Math.min(i + BATCH_SIZE, legacyRecords.length);
          console.log(
            `📈 Progress: ${processed}/${totalProcessed} (${Math.round((processed / totalProcessed) * 100)}%)`,
          );
        }
      } finally {
        await connection.end();
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✅ Sync completed in ${duration}s`);
      console.log(
        `   Created: ${created}, Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}`,
      );

      return {
        success: true,
        created,
        updated,
        skipped,
        errors,
        totalProcessed,
        message: `Sinhronizacija završena: ${created} kreirano, ${updated} ažurirano, ${skipped} preskočeno${errors > 0 ? `, ${errors} grešaka` : ''}`,
      };
    } catch (error) {
      console.error('❌ Sync failed:', error);
      throw new InternalServerErrorException(
        `Greška pri sinhronizaciji: ${error.message}`,
      );
    }
  }

  async syncFromCity(userId: number) {
    console.log('🔄 Starting City Server sync for price variations...');
    const startTime = Date.now();

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    let totalProcessed = 0;

    try {
      const legacyDb = await this.prisma.legacyDatabase.findFirst({
        where: { subtype: 'city_ticketing_database' },
      });

      if (!legacyDb) {
        throw new NotFoundException(
          'Legacy baza "Gradska Ticketing Baza" nije pronađena',
        );
      }

      const decryptedPassword =
        this.legacyDatabasesService.decryptPassword(legacyDb.password);

      const connection = await createConnection({
        host: legacyDb.host,
        port: legacyDb.port,
        user: legacyDb.username,
        password: decryptedPassword,
        database: legacyDb.database,
      });

      try {
        const [rows] = await connection.execute(
          'SELECT * FROM price_variation ORDER BY id ASC',
        );

        const legacyRecords = rows as any[];
        totalProcessed = legacyRecords.length;

        console.log(`📊 Found ${totalProcessed} records in legacy database`);

        const BATCH_SIZE = 50;
        for (let i = 0; i < legacyRecords.length; i += BATCH_SIZE) {
          const batch = legacyRecords.slice(i, i + BATCH_SIZE);

          for (const legacyRecord of batch) {
            try {
              const result = await this.processPriceVariationSyncFromCity(legacyRecord);

              switch (result.action) {
                case 'create':
                  created++;
                  break;
                case 'update':
                  updated++;
                  break;
                case 'skip':
                  skipped++;
                  break;
              }
            } catch (error) {
              errors++;
              console.error(
                `❌ Error processing record ID ${legacyRecord.id}:`,
                error.message,
              );
            }
          }

          const processed = Math.min(i + BATCH_SIZE, legacyRecords.length);
          console.log(
            `📈 Progress: ${processed}/${totalProcessed} (${Math.round((processed / totalProcessed) * 100)}%)`,
          );
        }
      } finally {
        await connection.end();
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✅ Sync completed in ${duration}s`);
      console.log(
        `   Created: ${created}, Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}`,
      );

      return {
        success: true,
        created,
        updated,
        skipped,
        errors,
        totalProcessed,
        message: `Sinhronizacija završena: ${created} kreirano, ${updated} ažurirano, ${skipped} preskočeno${errors > 0 ? `, ${errors} grešaka` : ''}`,
      };
    } catch (error) {
      console.error('❌ Sync failed:', error);
      throw new InternalServerErrorException(
        `Greška pri sinhronizaciji: ${error.message}`,
      );
    }
  }

  // ========== HELPER METODE ==========

  private async processPriceVariationSyncFromTicketing(legacyRecord: any) {
    const legacyId = BigInt(legacyRecord.id);

    const existingRecord = await this.prisma.priceVariation.findUnique({
      where: { legacyTicketingId: legacyId },
    });

    const mappedData = this.mapLegacyPriceVariation(legacyRecord);

    if (!existingRecord) {
      await this.prisma.priceVariation.create({
        data: {
          ...mappedData,
          legacyTicketingId: legacyId,
        },
      });

      return { action: 'create' };
    } else {
      await this.prisma.priceVariation.update({
        where: { id: existingRecord.id },
        data: {
          ...mappedData,
          legacyTicketingId: legacyId,
        },
      });

      return { action: 'update' };
    }
  }

  private async processPriceVariationSyncFromCity(legacyRecord: any) {
    const legacyId = BigInt(legacyRecord.id);

    const existingRecord = await this.prisma.priceVariation.findUnique({
      where: { legacyCityId: legacyId },
    });

    const mappedData = this.mapLegacyPriceVariation(legacyRecord);

    if (!existingRecord) {
      await this.prisma.priceVariation.create({
        data: {
          ...mappedData,
          legacyCityId: legacyId,
        },
      });

      return { action: 'create' };
    } else {
      await this.prisma.priceVariation.update({
        where: { id: existingRecord.id },
        data: {
          ...mappedData,
          legacyCityId: legacyId,
        },
      });

      return { action: 'update' };
    }
  }

  private mapLegacyPriceVariation(legacy: any) {
    const parseDate = (value: any): Date | null => {
      if (!value || value === '0000-00-00 00:00:00' || value === '0000-00-00')
        return null;
      const date = new Date(value);
      return isNaN(date.getTime()) ? null : date;
    };

    return {
      variationName: legacy.variation_name || '',
      variationDescription: legacy.variation_description || '',
      gtfsRouteSettingsId: legacy.gtfs_route_settings_id || null,
      direction: legacy.direction || null,
      mainBasicRoute: legacy.main_basic_route ? Boolean(legacy.main_basic_route) : null,
      datetimeFrom: parseDate(legacy.datetime_from),
      datetimeTo: parseDate(legacy.datetime_to),
      lineTypeId: legacy.line_type_id || 0,
    };
  }

  private async findAllFromLegacy(
    subtype: string,
    page = 1,
    limit = 50,
  ) {
    try {
      const legacyDb = await this.prisma.legacyDatabase.findFirst({
        where: { subtype },
      });

      if (!legacyDb) {
        throw new NotFoundException(
          `Legacy baza sa subtype "${subtype}" nije pronađena`,
        );
      }

      const decryptedPassword =
        this.legacyDatabasesService.decryptPassword(legacyDb.password);

      const connection = await createConnection({
        host: legacyDb.host,
        port: legacyDb.port,
        user: legacyDb.username,
        password: decryptedPassword,
        database: legacyDb.database,
      });

      try {
        const offset = (page - 1) * limit;

        // Get total count
        const countQuery = 'SELECT COUNT(*) as total FROM price_variation';
        const [countRows] = await connection.execute(countQuery);
        const total = (countRows as any)[0].total;

        // Get paginated data
        const dataQuery = 'SELECT * FROM price_variation ORDER BY id ASC LIMIT ? OFFSET ?';
        const [rows] = await connection.execute(dataQuery, [limit, offset]);

        return {
          data: rows,
          total,
          page,
          limit,
        };
      } finally {
        await connection.end();
      }
    } catch (error) {
      console.error(`Greška pri učitavanju iz legacy baze (${subtype}):`, error);
      throw new InternalServerErrorException(
        `Greška pri konektovanju na legacy bazu: ${error.message}`,
      );
    }
  }

  private convertBigIntToString(variation: any) {
    return {
      ...variation,
      legacyTicketingId: variation.legacyTicketingId
        ? variation.legacyTicketingId.toString()
        : null,
      legacyCityId: variation.legacyCityId ? variation.legacyCityId.toString() : null,
    };
  }
}
