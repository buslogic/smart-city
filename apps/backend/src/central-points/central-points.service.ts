import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LegacyDatabasesService } from '../legacy-databases/legacy-databases.service';
import { CreateCentralPointDto } from './dto/create-central-point.dto';
import { UpdateCentralPointDto } from './dto/update-central-point.dto';
import { createConnection } from 'mysql2/promise';

@Injectable()
export class CentralPointsService {
  constructor(
    private prisma: PrismaService,
    private legacyDatabasesService: LegacyDatabasesService,
  ) {}

  // ========== GLAVNI SERVER (NAŠA BAZA) ==========

  async create(createCentralPointDto: CreateCentralPointDto) {
    const result = await this.prisma.centralPoint.create({
      data: {
        ...createCentralPointDto,
        dateTime: new Date(), // Automatski setuj trenutno vreme
      },
    });

    // Konvertuj BigInt u string za JSON serialization
    return {
      ...result,
      androidAdmin: result.androidAdmin.toString(),
    };
  }

  async findAllMain() {
    const results = await this.prisma.centralPoint.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        address: true,
        zip: true,
        city: true,
        phone1: true,
        phone2: true,
        email: true,
        boss: true,
        bossPhone: true,
        bossEmail: true,
        mainStationUid: true,
        longitude: true,
        latitude: true,
        comment: true,
        owes: true,
        expects: true,
        saldo: true,
        incomeSettlementTimeframe: true,
        changedBy: true,
        dateTime: true,
        enableJavaApplet: true,
        enableTicketReturn: true,
        enableTicketDelete: true,
        enableOtherTicketsCheck: true,
        enableJournalCheck: true,
        internalFuel: true,
        color: true,
        lineColor: true,
        // ISKLJUČUJEMO BLOB polja za brže učitavanje
        // image: false,
        // imageAndroid: false,
        // customerInfoCloseDeparture: false,
        // customerInfoOpenDeparture: false,
        // validatorCloseDeparture: false,
        // validatorOpenDeparture: false,
        sendAndroidPinRequestToAdmin: true,
        androidAdmin: true,
        countryId: true,
        countryName: true,
        vatId: true,
        createdAt: true,
        updatedAt: true,
        otherCpView: true,
        dispatchOrderByCp: true,
        active: true,
        placeOfInvoice: true,
        currentAccount: true,
        currentAccountForPlastic: true,
        depotCode: true,
        creatingZipByGtfsStandard: true,
        defaultDeviceListSubgroupId: true,
        legacyTicketingId: true,
        legacyCityId: true,
        syncSource: true,
      },
    });

    // Konvertuj BigInt u string za JSON serialization
    return results.map((cp) => ({
      ...cp,
      androidAdmin: cp.androidAdmin.toString(),
    }));
  }

  async findOne(id: number) {
    const centralPoint = await this.prisma.centralPoint.findUnique({
      where: { id },
    });

    if (!centralPoint) {
      throw new NotFoundException(`Centralna tačka sa ID ${id} nije pronađena`);
    }

    // Konvertuj BigInt u string za JSON serialization
    return {
      ...centralPoint,
      androidAdmin: centralPoint.androidAdmin.toString(),
    };
  }

  async update(id: number, updateCentralPointDto: UpdateCentralPointDto) {
    await this.findOne(id); // Proverava da li postoji

    const result = await this.prisma.centralPoint.update({
      where: { id },
      data: updateCentralPointDto,
    });

    // Konvertuj BigInt u string za JSON serialization
    return {
      ...result,
      androidAdmin: result.androidAdmin.toString(),
    };
  }

  async remove(id: number) {
    await this.findOne(id); // Proverava da li postoji

    return this.prisma.centralPoint.delete({
      where: { id },
    });
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
    console.log('🔄 Starting Ticketing Server sync...');
    const startTime = Date.now();

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    let totalProcessed = 0;

    try {
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
        // Učitaj sve rekorde iz legacy tabele
        const [rows] = await connection.execute(
          'SELECT * FROM central_points ORDER BY id ASC',
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
              const result = await this.processCentralPointSync(legacyRecord);

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
    console.log('🔄 Starting City Server sync...');
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
          'SELECT * FROM central_points ORDER BY id ASC',
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
              const result = await this.processCentralPointCitySync(
                legacyRecord,
              );

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

  private async processCentralPointCitySync(legacyRecord: any) {
    const legacyId = legacyRecord.id;

    // Proveri da li rekord već postoji
    const existingRecord = await this.prisma.centralPoint.findUnique({
      where: { legacyCityId: legacyId },
    });

    // Mapiraj legacy podatke
    const mappedData = this.mapLegacyCentralPoint(legacyRecord);

    if (!existingRecord) {
      // CREATE - novi rekord
      await this.prisma.centralPoint.create({
        data: {
          ...mappedData,
          legacyCityId: legacyId,
          syncSource: 'manual', // Ne setujemo ticketing_sync za Gradski server
        },
      });

      return { action: 'create' };
    } else {
      // Proveri syncSource
      if (existingRecord.syncSource === 'manual') {
        // SKIP - zaštiti ručne izmene
        return { action: 'skip' };
      }

      // UPDATE - ažuriraj postojeći rekord
      await this.prisma.centralPoint.update({
        where: { id: existingRecord.id },
        data: {
          ...mappedData,
          legacyCityId: legacyId,
          // Ne menjamo syncSource - ostaje 'manual' ili 'ticketing_sync'
        },
      });

      return { action: 'update' };
    }
  }

  private async processCentralPointSync(legacyRecord: any) {
    const legacyId = legacyRecord.id;

    // Proveri da li rekord već postoji
    const existingRecord = await this.prisma.centralPoint.findUnique({
      where: { legacyTicketingId: legacyId },
    });

    // Mapiraj legacy podatke
    const mappedData = this.mapLegacyCentralPoint(legacyRecord);

    if (!existingRecord) {
      // CREATE - novi rekord
      await this.prisma.centralPoint.create({
        data: {
          ...mappedData,
          legacyTicketingId: legacyId,
          syncSource: 'ticketing_sync',
        },
      });

      return { action: 'create' };
    } else {
      // Proveri syncSource
      if (existingRecord.syncSource === 'manual') {
        // SKIP - zaštiti ručne izmene
        return { action: 'skip' };
      }

      // UPDATE - ažuriraj postojeći rekord
      await this.prisma.centralPoint.update({
        where: { id: existingRecord.id },
        data: {
          ...mappedData,
          syncSource: 'ticketing_sync',
        },
      });

      return { action: 'update' };
    }
  }

  private mapLegacyCentralPoint(legacy: any) {
    // Helper za parsiranje datuma
    const parseDate = (value: any): Date => {
      if (!value) return new Date();
      const date = new Date(value);
      return isNaN(date.getTime()) ? new Date() : date;
    };

    // Helper za parsiranje brojeva
    const parseNumber = (value: any, defaultValue: number = 0): number => {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? defaultValue : parsed;
    };

    // Helper za parsiranje boolean iz 0/1
    const parseBoolean = (value: any): boolean => {
      return value === 1 || value === '1' || value === true;
    };

    return {
      // Osnovne informacije
      name: legacy.cp_name || '',
      address: legacy.cp_address || '',
      zip: legacy.cp_zip || '',
      city: legacy.cp_city || '',

      // Kontakt
      phone1: legacy.cp_phone1 || '',
      phone2: legacy.cp_phone2 || '',
      email: legacy.cp_email || '',

      // Boss
      boss: legacy.cp_boss || '',
      bossPhone: legacy.cp_boss_phone || '',
      bossEmail: legacy.cp_boss_email || '',

      // Geografija
      mainStationUid: legacy.main_station_uid || '',
      longitude: legacy.cp_longitude || '',
      latitude: legacy.cp_latitude || '',

      // Komentar
      comment: legacy.cp_comment || '',

      // Finansije
      owes: parseNumber(legacy.cp_owes),
      expects: parseNumber(legacy.cp_expects),
      saldo: parseNumber(legacy.cp_saldo),
      incomeSettlementTimeframe:
        legacy.income_settlement_timeframe_cp || '0',

      // Audit
      changedBy: legacy.changed_by || 'legacy_sync',
      dateTime: parseDate(legacy.date_time),

      // Java/Applet settings
      enableJavaApplet: parseBoolean(legacy.enablejavaapplet),
      enableTicketReturn: parseInt(legacy.enableticketreturn) || 0,
      enableTicketDelete: parseBoolean(legacy.enableticketdelete),
      enableOtherTicketsCheck: parseBoolean(legacy.enableotherticketscheck),
      enableJournalCheck: parseInt(legacy.enablejournalcheck) || 1,

      // Fuel
      internalFuel: legacy.internal_fuel !== null ? parseBoolean(legacy.internal_fuel) : null,

      // UI/Display
      color: legacy.cp_color || '#000000',
      lineColor: legacy.cp_line_color || '#000000',
      image: legacy.cp_image || null,
      imageAndroid: legacy.cp_image_android || null,

      // Customer info images
      customerInfoCloseDeparture: legacy.cp_customer_info_close_departure || null,
      customerInfoOpenDeparture: legacy.cp_customer_info_open_departure || null,
      validatorCloseDeparture: legacy.cp_validator_close_departure || null,
      validatorOpenDeparture: legacy.cp_validator_open_departure || null,

      // Android settings
      sendAndroidPinRequestToAdmin: parseInt(legacy.send_android_pin_request_to_admin) || 0,
      androidAdmin: BigInt(legacy.android_admin || 0),

      // Country/VAT
      countryId: parseInt(legacy.cp_country_id) || 0,
      countryName: legacy.cp_country_name || null,
      vatId: legacy.cp_vat_id || null,

      // Additional settings
      otherCpView: parseInt(legacy.other_cp_view) || 0,
      dispatchOrderByCp: parseInt(legacy.dispatch_order_by_cp) || 0,
      active: parseBoolean(legacy.active),

      // Invoice/Account
      placeOfInvoice: legacy.place_of_the_invoice || null,
      currentAccount: legacy.current_account || null,
      currentAccountForPlastic: legacy.current_account_for_plastic || null,

      // Depot
      depotCode: legacy.depot_code ? legacy.depot_code.trim() : null,

      // GTFS
      creatingZipByGtfsStandard: parseBoolean(legacy.creating_zip_by_gtfs_starndard),

      // Device list
      defaultDeviceListSubgroupId: legacy.default_device_list_subgroup_id
        ? parseInt(legacy.default_device_list_subgroup_id)
        : null,
    };
  }

  // ========== HELPER METODE ==========

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
        // Učitaj sve central points iz legacy baze
        const [rows] = await connection.execute(
          'SELECT * FROM central_points ORDER BY id DESC',
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
