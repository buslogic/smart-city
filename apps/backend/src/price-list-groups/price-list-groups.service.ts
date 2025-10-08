import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LegacyDatabasesService } from '../legacy-databases/legacy-databases.service';
import { CreatePriceListGroupDto } from './dto/create-price-list-group.dto';
import { UpdatePriceListGroupDto } from './dto/update-price-list-group.dto';
import { createConnection } from 'mysql2/promise';

@Injectable()
export class PriceListGroupsService {
  constructor(
    private prisma: PrismaService,
    private legacyDatabasesService: LegacyDatabasesService,
  ) {}

  // ========== GLAVNI SERVER (NAŠA BAZA) ==========

  async create(createPriceListGroupDto: CreatePriceListGroupDto) {
    const { legacyCityId, ...rest } = createPriceListGroupDto;

    const result = await this.prisma.priceTableGroup.create({
      data: {
        ...rest,
        dateTime: new Date(), // Automatski setuj trenutno vreme
        legacyCityId: legacyCityId ? BigInt(legacyCityId) : null,
      },
    });

    // Konvertuj BigInt u string za JSON serialization
    return {
      ...result,
      id: result.id.toString(),
      legacyTicketingId: result.legacyTicketingId ? result.legacyTicketingId.toString() : null,
      legacyCityId: result.legacyCityId ? result.legacyCityId.toString() : null,
    };
  }

  async findAllMain() {
    const results = await this.prisma.priceTableGroup.findMany({
      orderBy: { dateTime: 'desc' },
    });

    // Konvertuj BigInt u string za JSON serialization
    return results.map((group) => ({
      ...group,
      id: group.id.toString(),
      legacyTicketingId: group.legacyTicketingId ? group.legacyTicketingId.toString() : null,
      legacyCityId: group.legacyCityId ? group.legacyCityId.toString() : null,
    }));
  }

  async findOne(id: number) {
    const priceListGroup = await this.prisma.priceTableGroup.findUnique({
      where: { id: BigInt(id) },
    });

    if (!priceListGroup) {
      throw new NotFoundException(`Grupa cenovnika sa ID ${id} nije pronađena`);
    }

    // Konvertuj BigInt u string za JSON serialization
    return {
      ...priceListGroup,
      id: priceListGroup.id.toString(),
      legacyTicketingId: priceListGroup.legacyTicketingId ? priceListGroup.legacyTicketingId.toString() : null,
      legacyCityId: priceListGroup.legacyCityId ? priceListGroup.legacyCityId.toString() : null,
    };
  }

  async update(id: number, updatePriceListGroupDto: UpdatePriceListGroupDto) {
    await this.findOne(id); // Proverava da li postoji

    const { legacyCityId, ...rest } = updatePriceListGroupDto;

    const result = await this.prisma.priceTableGroup.update({
      where: { id: BigInt(id) },
      data: {
        ...rest,
        dateTime: new Date(), // Ažuriraj vreme izmene
        legacyCityId: legacyCityId !== undefined ? (legacyCityId ? BigInt(legacyCityId) : null) : undefined,
      },
    });

    // Konvertuj BigInt u string za JSON serialization
    return {
      ...result,
      id: result.id.toString(),
      legacyTicketingId: result.legacyTicketingId ? result.legacyTicketingId.toString() : null,
      legacyCityId: result.legacyCityId ? result.legacyCityId.toString() : null,
    };
  }

  async remove(id: number) {
    await this.findOne(id); // Proverava da li postoji

    const result = await this.prisma.priceTableGroup.delete({
      where: { id: BigInt(id) },
    });

    return {
      ...result,
      id: result.id.toString(),
      legacyTicketingId: result.legacyTicketingId ? result.legacyTicketingId.toString() : null,
      legacyCityId: result.legacyCityId ? result.legacyCityId.toString() : null,
    };
  }

  // ========== TIKETING SERVER (LEGACY BAZA) ==========

  async findAllTicketing() {
    return this.findAllFromLegacy('main_ticketing_database');
  }

  // ========== GRADSKI SERVER (LEGACY BAZA) ==========

  async findAllCity() {
    return this.findAllFromLegacy('city_ticketing_database');
  }

  // ========== SINHRONIZACIJA ==========

  async syncFromTicketing(userId: number) {
    console.log('🔄 Starting Ticketing Server sync for price list groups...');
    const startTime = Date.now();

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    let totalProcessed = 0;

    try {
      // Prvo učitaj ID-eve sinhronizovanih centralnih tačaka
      const syncedCentralPoints = await this.prisma.centralPoint.findMany({
        where: { syncWithCityServer: true },
        select: { legacyTicketingId: true },
      });

      const syncedIds = syncedCentralPoints
        .map((cp) => cp.legacyTicketingId)
        .filter((id) => id !== null);

      if (syncedIds.length === 0) {
        console.log('⚠️ Nema sinhronizovanih centralnih tačaka');
        return {
          success: true,
          created: 0,
          updated: 0,
          skipped: 0,
          errors: 0,
          totalProcessed: 0,
          message: 'Nema sinhronizovanih centralnih tačaka za procesiranje',
        };
      }

      console.log(`📍 Found ${syncedIds.length} synced central points:`, syncedIds);

      // Pronađi legacy bazu
      const legacyDb = await this.prisma.legacyDatabase.findFirst({
        where: { subtype: 'main_ticketing_database' },
      });

      if (!legacyDb) {
        throw new NotFoundException(
          'Legacy baza "Glavna Ticketing Baza" nije pronađena',
        );
      }

      // Dekriptuj password
      const decryptedPassword =
        this.legacyDatabasesService.decryptPassword(legacyDb.password);

      // Konektuj se na legacy bazu
      const connection = await createConnection({
        host: legacyDb.host,
        port: legacyDb.port,
        user: legacyDb.username,
        password: decryptedPassword,
        database: legacyDb.database,
      });

      try {
        // Prvo učitaj sve jedinstvene date_valid_from vrednosti iz linija koje pripadaju sinhronizovanim centralnim tačkama
        const idsPlaceholder = syncedIds.map(() => '?').join(',');
        const dateQuery = `
          SELECT DISTINCT date_valid_from
          FROM price_tables_index
          WHERE central_point_db_id IN (${idsPlaceholder})
          ORDER BY date_valid_from DESC
        `;

        const [dateRows] = await connection.execute(dateQuery, syncedIds);
        const dateValidFromList = (dateRows as any[]).map((row) => row.date_valid_from);

        if (dateValidFromList.length === 0) {
          console.log('⚠️ Nema linija za sinhronizovane centralne tačke');
          await connection.end();
          return {
            success: true,
            created: 0,
            updated: 0,
            skipped: 0,
            errors: 0,
            totalProcessed: 0,
            message: 'Nema linija za sinhronizovane centralne tačke',
          };
        }

        console.log(`📅 Found ${dateValidFromList.length} unique date_valid_from values`);

        // Sada učitaj samo grupe cenovnika koje odgovaraju tim datumima
        const datePlaceholder = dateValidFromList.map(() => '?').join(',');
        const groupQuery = `
          SELECT * FROM price_table_groups
          WHERE date_valid_from IN (${datePlaceholder})
          ORDER BY id ASC
        `;

        const [rows] = await connection.execute(groupQuery, dateValidFromList);
        const legacyRecords = rows as any[];
        totalProcessed = legacyRecords.length;

        console.log(`📊 Found ${totalProcessed} price list groups to sync`);

        // Procesiraj u batch-ovima od 50 rekorda
        const BATCH_SIZE = 50;
        for (let i = 0; i < legacyRecords.length; i += BATCH_SIZE) {
          const batch = legacyRecords.slice(i, i + BATCH_SIZE);

          for (const legacyRecord of batch) {
            try {
              const result = await this.processPriceListGroupSyncFromTicketing(legacyRecord);

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

          // Log progress
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
    console.log('🔄 Starting City Server sync for price list groups...');
    const startTime = Date.now();

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    let totalProcessed = 0;

    try {
      // Pronađi legacy bazu
      const legacyDb = await this.prisma.legacyDatabase.findFirst({
        where: { subtype: 'city_ticketing_database' },
      });

      if (!legacyDb) {
        throw new NotFoundException(
          'Legacy baza "Gradska Ticketing Baza" nije pronađena',
        );
      }

      // Dekriptuj password
      const decryptedPassword =
        this.legacyDatabasesService.decryptPassword(legacyDb.password);

      // Konektuj se na legacy bazu
      const connection = await createConnection({
        host: legacyDb.host,
        port: legacyDb.port,
        user: legacyDb.username,
        password: decryptedPassword,
        database: legacyDb.database,
      });

      try {
        // Učitaj sve rekorde iz legacy tabele
        const [rows] = await connection.execute(
          'SELECT * FROM price_table_groups ORDER BY id ASC',
        );

        const legacyRecords = rows as any[];
        totalProcessed = legacyRecords.length;

        console.log(`📊 Found ${totalProcessed} records in legacy database`);

        // Procesiraj u batch-ovima od 50 rekorda
        const BATCH_SIZE = 50;
        for (let i = 0; i < legacyRecords.length; i += BATCH_SIZE) {
          const batch = legacyRecords.slice(i, i + BATCH_SIZE);

          for (const legacyRecord of batch) {
            try {
              const result = await this.processPriceListGroupSyncFromCity(legacyRecord);

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

          // Log progress
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

  private async processPriceListGroupSyncFromTicketing(legacyRecord: any) {
    const legacyId = BigInt(legacyRecord.id);

    // Proveri da li rekord već postoji na osnovu legacyTicketingId
    const existingRecord = await this.prisma.priceTableGroup.findUnique({
      where: { legacyTicketingId: legacyId },
    });

    // Mapiraj legacy podatke
    const mappedData = this.mapLegacyPriceListGroup(legacyRecord);

    if (!existingRecord) {
      // CREATE - novi rekord
      await this.prisma.priceTableGroup.create({
        data: {
          ...mappedData,
          legacyTicketingId: legacyId,
        },
      });

      return { action: 'create' };
    } else {
      // UPDATE - ažuriraj postojeći rekord
      await this.prisma.priceTableGroup.update({
        where: { id: existingRecord.id },
        data: {
          ...mappedData,
          legacyTicketingId: legacyId,
        },
      });

      return { action: 'update' };
    }
  }

  private async processPriceListGroupSyncFromCity(legacyRecord: any) {
    const legacyId = BigInt(legacyRecord.id);

    // Proveri da li rekord već postoji na osnovu legacyCityId
    const existingRecord = await this.prisma.priceTableGroup.findUnique({
      where: { legacyCityId: legacyId },
    });

    // Mapiraj legacy podatke
    const mappedData = this.mapLegacyPriceListGroup(legacyRecord);

    if (!existingRecord) {
      // CREATE - novi rekord
      await this.prisma.priceTableGroup.create({
        data: {
          ...mappedData,
          legacyCityId: legacyId,
        },
      });

      return { action: 'create' };
    } else {
      // UPDATE - ažuriraj postojeći rekord
      await this.prisma.priceTableGroup.update({
        where: { id: existingRecord.id },
        data: {
          ...mappedData,
          legacyCityId: legacyId,
        },
      });

      return { action: 'update' };
    }
  }

  private mapLegacyPriceListGroup(legacy: any) {
    // Helper za parsiranje datuma
    const parseDate = (value: any): Date => {
      if (!value) return new Date();
      const date = new Date(value);
      return isNaN(date.getTime()) ? new Date() : date;
    };

    // Helper za formatiranje datuma kao string (YYYY-MM-DD)
    // VAŽNO: Ne koristimo new Date() jer pravi timezone konverziju koja pomera datum za 1 dan
    const formatDateString = (value: any): string => {
      if (!value) return new Date().toISOString().split('T')[0];

      // Ako je već string u YYYY-MM-DD formatu, vrati direktno
      const strValue = value.toString().trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(strValue)) {
        return strValue;
      }

      // Ako je Date objekat, ekstraktuj komponente lokalno (bez UTC konverzije)
      if (value instanceof Date) {
        const year = value.getFullYear();
        const month = String(value.getMonth() + 1).padStart(2, '0');
        const day = String(value.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }

      // Fallback: pokušaj parsiranje
      const date = new Date(value);
      if (isNaN(date.getTime())) return new Date().toISOString().split('T')[0];

      // Ekstraktuj komponente lokalno (bez UTC konverzije)
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    return {
      dateValidFrom: formatDateString(legacy.date_valid_from),
      status: legacy.status || 'N',
      synchroStatus: legacy.synchro_status || 'N',
      sendIncremental: legacy.send_incremental || '0',
      changedBy: legacy.changed_by || 'legacy_sync',
      dateTime: parseDate(legacy.date_time),
      name: legacy.name || '',
    };
  }

  private async findAllFromLegacy(subtype: string) {
    try {
      // Pronađi legacy bazu prema subtype-u
      const legacyDb = await this.prisma.legacyDatabase.findFirst({
        where: { subtype },
      });

      if (!legacyDb) {
        throw new NotFoundException(
          `Legacy baza sa subtype "${subtype}" nije pronađena`,
        );
      }

      // Dekriptuj password
      const decryptedPassword =
        this.legacyDatabasesService.decryptPassword(legacyDb.password);

      // Kreiraj konekciju
      const connection = await createConnection({
        host: legacyDb.host,
        port: legacyDb.port,
        user: legacyDb.username,
        password: decryptedPassword,
        database: legacyDb.database,
      });

      try {
        // Učitaj sve price_table_groups iz legacy baze
        // Koristi DATE_FORMAT da bi MySQL vratio string u YYYY-MM-DD formatu
        const [rows] = await connection.execute(
          'SELECT id, DATE_FORMAT(date_valid_from, "%Y-%m-%d") as date_valid_from, status, synchro_status, send_incremental, changed_by, date_time, name FROM price_table_groups ORDER BY id DESC',
        );

        return rows;
      } finally {
        // Uvek zatvori konekciju
        await connection.end();
      }
    } catch (error) {
      console.error(`Greška pri učitavanju iz legacy baze (${subtype}):`, error);
      throw new InternalServerErrorException(
        `Greška pri konektovanju na legacy bazu: ${error.message}`,
      );
    }
  }
}
