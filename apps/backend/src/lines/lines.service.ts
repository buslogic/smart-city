import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LegacyDatabasesService } from '../legacy-databases/legacy-databases.service';
import { CreateLineDto } from './dto/create-line.dto';
import { UpdateLineDto } from './dto/update-line.dto';
import { createConnection } from 'mysql2/promise';

@Injectable()
export class LinesService {
  constructor(
    private prisma: PrismaService,
    private legacyDatabasesService: LegacyDatabasesService,
  ) {}

  // ========== GLAVNI SERVER (NAŠA BAZA) ==========

  async create(createLineDto: CreateLineDto) {
    const { legacyCityId, legacyTicketingId, ...rest } = createLineDto;

    // Filter out undefined values
    const filteredData = Object.fromEntries(
      Object.entries(rest).filter(([_, value]) => value !== undefined),
    ) as any;

    const result = await this.prisma.line.create({
      data: {
        ...filteredData,
        legacyCityId: legacyCityId ? BigInt(legacyCityId) : null,
        legacyTicketingId: legacyTicketingId ? BigInt(legacyTicketingId) : null,
      },
    });

    return this.convertBigIntToString(result);
  }

  async findAllMain(dateValidFrom?: string, page = 1, limit = 50) {
    const where = dateValidFrom ? { dateValidFrom } : {};
    const skip = (page - 1) * limit;

    const [results, total] = await Promise.all([
      this.prisma.line.findMany({
        where,
        orderBy: { id: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.line.count({ where }),
    ]);

    return {
      data: results.map((line) => this.convertBigIntToString(line)),
      total,
      page,
      limit,
    };
  }

  async findOne(id: number) {
    const line = await this.prisma.line.findUnique({
      where: { id: BigInt(id) },
    });

    if (!line) {
      throw new NotFoundException(`Linija sa ID ${id} nije pronađena`);
    }

    return this.convertBigIntToString(line);
  }

  async update(id: number, updateLineDto: UpdateLineDto) {
    await this.findOne(id); // Proverava da li postoji

    const { legacyCityId, legacyTicketingId, ...rest } = updateLineDto;

    // Filter out undefined values
    const filteredData = Object.fromEntries(
      Object.entries(rest).filter(([_, value]) => value !== undefined),
    ) as any;

    const result = await this.prisma.line.update({
      where: { id: BigInt(id) },
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

    const result = await this.prisma.line.delete({
      where: { id: BigInt(id) },
    });

    return this.convertBigIntToString(result);
  }

  // ========== TIKETING SERVER (LEGACY BAZA) ==========

  async findAllTicketing(dateValidFrom?: string, page = 1, limit = 50) {
    return this.findAllFromLegacy('main_ticketing_database', dateValidFrom, page, limit);
  }

  // ========== GRADSKI SERVER (LEGACY BAZA) ==========

  async findAllCity(dateValidFrom?: string, page = 1, limit = 50) {
    return this.findAllFromLegacy('city_ticketing_database', dateValidFrom, page, limit);
  }

  // ========== SINHRONIZACIJA ==========

  async syncFromTicketing(userId: number) {
    console.log('🔄 Starting Ticketing Server sync for lines...');
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

      // Ako nema sinhronizovanih CP, ne sinhronizuj ništa
      if (syncedIds.length === 0) {
        console.log('⚠️ Nema sinhronizovanih centralnih tačaka - sinhronizacija preskočena');
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

      console.log(`🔍 Sinhronizacija samo za centralne tačke: ${syncedIds.join(', ')}`);

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
        // Kreiraj IN klauzulu za filtriranje
        const idsPlaceholder = syncedIds.map(() => '?').join(',');
        const query = `SELECT * FROM price_tables_index WHERE central_point_db_id IN (${idsPlaceholder}) ORDER BY id ASC`;

        const [rows] = await connection.execute(query, syncedIds);

        const legacyRecords = rows as any[];
        totalProcessed = legacyRecords.length;

        console.log(`📊 Found ${totalProcessed} records for synced central points in legacy database`);

        const BATCH_SIZE = 50;
        for (let i = 0; i < legacyRecords.length; i += BATCH_SIZE) {
          const batch = legacyRecords.slice(i, i + BATCH_SIZE);

          for (const legacyRecord of batch) {
            try {
              const result =
                await this.processLineSyncFromTicketing(legacyRecord);

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
    console.log('🔄 Starting City Server sync for lines...');
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
          'SELECT * FROM price_tables_index ORDER BY id ASC',
        );

        const legacyRecords = rows as any[];
        totalProcessed = legacyRecords.length;

        console.log(`📊 Found ${totalProcessed} records in legacy database`);

        const BATCH_SIZE = 50;
        for (let i = 0; i < legacyRecords.length; i += BATCH_SIZE) {
          const batch = legacyRecords.slice(i, i + BATCH_SIZE);

          for (const legacyRecord of batch) {
            try {
              const result = await this.processLineSyncFromCity(legacyRecord);

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

  private async processLineSyncFromTicketing(legacyRecord: any) {
    const legacyId = BigInt(legacyRecord.id);

    const existingRecord = await this.prisma.line.findUnique({
      where: { legacyTicketingId: legacyId },
    });

    const mappedData = this.mapLegacyLine(legacyRecord);

    if (!existingRecord) {
      await this.prisma.line.create({
        data: {
          ...mappedData,
          legacyTicketingId: legacyId,
        },
      });

      return { action: 'create' };
    } else {
      await this.prisma.line.update({
        where: { id: existingRecord.id },
        data: {
          ...mappedData,
          legacyTicketingId: legacyId,
        },
      });

      return { action: 'update' };
    }
  }

  private async processLineSyncFromCity(legacyRecord: any) {
    const legacyId = BigInt(legacyRecord.id);
    const mappedData = this.mapLegacyLine(legacyRecord);

    // Prvo proveri da li postoji linija sa legacyCityId
    let existingRecord = await this.prisma.line.findUnique({
      where: { legacyCityId: legacyId },
    });

    // Ako ne postoji sa legacyCityId, proveri po price_table_ident (UNIQUE)
    if (!existingRecord && mappedData.priceTableIdent) {
      existingRecord = await this.prisma.line.findUnique({
        where: { priceTableIdent: mappedData.priceTableIdent },
      });
    }

    if (!existingRecord) {
      // Kreiraj novu liniju
      await this.prisma.line.create({
        data: {
          ...mappedData,
          legacyCityId: legacyId,
        },
      });

      return { action: 'create' };
    } else {
      // Ažuriraj postojeću liniju (dodaj legacyCityId ako ga nema)
      await this.prisma.line.update({
        where: { id: existingRecord.id },
        data: {
          ...mappedData,
          legacyCityId: legacyId,
        },
      });

      return { action: 'update' };
    }
  }

  private mapLegacyLine(legacy: any) {
    const parseDate = (value: any): Date | null => {
      if (!value || value === '0000-00-00' || value === '0000-00-00 00:00:00')
        return null;
      const date = new Date(value);
      return isNaN(date.getTime()) ? null : date;
    };

    const parseTime = (value: any): Date => {
      if (!value) return new Date('1970-01-01 00:00:00');
      // Parse time as datetime (MySQL TIME is stored as duration)
      const timeStr = typeof value === 'string' ? value : value.toString();
      return new Date(`1970-01-01 ${timeStr}`);
    };

    const parseOnlineDiscountType = (value: any): 'ZERO' | 'ONE' | 'TWO' => {
      const strValue = value?.toString() || '0';
      switch (strValue) {
        case '1':
          return 'ONE';
        case '2':
          return 'TWO';
        default:
          return 'ZERO';
      }
    };

    // Helper za formatiranje datuma kao string (YYYY-MM-DD) - isto kao u PriceTableGroups
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
      lineNumber: legacy.line_number || '',
      actualLineNumber: legacy.actual_line_number || '',
      lineTitle: legacy.line_title || '',
      lineTitleReturn: legacy.line_title_return || '',
      rootLineNumber: legacy.root_line_number || '',
      lineNumberForDisplay: legacy.line_number_for_display || '',
      circleRoute: Boolean(legacy.circle_route),
      directionIdForDisplay: legacy.direction_id_for_display || 'A',
      lineTitleForDisplay: legacy.line_title_for_display || '',
      lineNumberForSite: legacy.line_number_for_site || '',
      furl: legacy.furl || '',
      toPlace: legacy.to_place || '',
      toPlaceTwo: legacy.to_place_two || '',
      numOfDirection: legacy.num_of_direction || 0,
      officialDeparture: legacy.official_departure || 'xx:xx',
      dateValidFrom: formatDateString(legacy.date_valid_from),
      priceTableIdent: legacy.price_table_ident || '',
      monthlyPriceTableIdent: legacy.monthly_price_table_ident || '',
      subversion: legacy.subversion || '0',
      numberOfStations: legacy.number_of_stations || 0,
      vatFromTaxTable: legacy.vat_from_tax_table || '',
      vatId: legacy.vat_id || '',
      vatValue: legacy.vat_value || '',
      discountTariffTableIdent: legacy.discount_tariff_table_ident || '',
      regionTableIdent: legacy.region_table_ident || '',
      zoneTableIdent: legacy.zone_table_ident || '',
      distanceTableIdent: legacy.distance_table_ident || '',
      citiesTableIdent: legacy.cities_table_ident || '',
      lineTypeId: legacy.line_type_id || 0,
      lineType: legacy.line_type || 'none',
      changedSinceSync: legacy.changed_since_sync || '0',
      changeLog: legacy.change_log || '',
      changeIncremental: legacy.change_incremental || '0',
      centralPointDbId: legacy.central_point_db_id || '0',
      centralPointName: legacy.central_point_name || '',
      changedBy: legacy.changed_by || 'legacy_sync',
      dateTime: parseDate(legacy.date_time) || new Date(),
      status: legacy.status || 'N',
      busOperator: legacy.bus_operator || 0,
      displayByDispachPlanning: Boolean(legacy.display_by_dispach_planning),
      lineRoute: legacy.line_route || '',
      lineRoute1: legacy.line_route1 || '',
      bestfrom: parseDate(legacy.bestfrom),
      gLineRoute: legacy.g_line_route || '',
      gLineRoute1: legacy.g_line_route1 || '',
      maxSpeed: legacy.max_speed || 0,
      timeAllowed: legacy.time_allowed || 0,
      isolatedExportsAccountingSoftware: Boolean(
        legacy.isolated_exports_accounting_software,
      ),
      daysSellInAdvance: legacy.days_sell_in_advance || 255,
      roundPrice: legacy.round_price || 500,
      bestFromRet: parseDate(legacy.best_from_ret) || new Date('2012-01-01'),
      daysSellInAdvanceRet: legacy.days_sell_in_advance_ret || 255,
      bestTo: parseDate(legacy.best_to) || new Date('2029-12-31'),
      bestToRet: parseDate(legacy.best_to_ret) || new Date('2029-12-31'),
      checkInAmount: legacy.check_in_amount?.toString() || '0.00',
      pricePerKm: legacy.price_per_km?.toString() || '0.00',
      additionalLineTypeId: legacy.additional_line_type_id || 0,
      usedInDispech: Boolean(legacy.used_in_dispech),
      showOnNet: Boolean(legacy.show_on_net),
      showOnNetCity: Boolean(legacy.show_on_net_city),
      netPricelistId: legacy.net_pricelist_id || 0,
      payOnDelivery: legacy.PAY_ON_DELIVERY || '',
      mobilePhone: legacy.MOBILE_PHONE || '',
      creditCard: legacy.CREDIT_CARD || '',
      usedInBooking: Boolean(legacy.used_in_booking),
      startTerminusKm: legacy.start_terminus_km?.toString() || '0.000',
      endTerminusKm: legacy.end_terminus_km?.toString() || '0.000',
      rvSaleFlag: Boolean(legacy.rv_sale_flag),
      rvLineSource: legacy.rv_line_source || 3,
      qrValidations: legacy.qr_validations || 0,
      qrValidationsReturn: legacy.qr_validations_return || 0,
      qrValidationsDir1: legacy.qr_validations_dir1 || 0,
      qrValidationsReturnDir1: legacy.qr_validations_return_dir1 || 0,
      transientPriceSetting: legacy.transient_price_setting || 0,
      sellWithoutSeatNo: Boolean(legacy.sell_without_seat_no),
      alwaysExportFlag: Boolean(legacy.always_export_flag),
      minModeSecurity: legacy.min_mode_security || 60,
      allowedMin: legacy.allowed_min || 240,
      mainLineFromGroup: legacy.main_line_from_group || '',
      routeCode: legacy.route_code || '',
      gtfsRouteId: legacy.gtfs_route_id || 0,
      priceVariationId: legacy.price_variation_id || 0,
      wrongDirectionType: legacy.wrong_direction_type || 0,
      gtfsShapeId: legacy.gtfs_shape_id || '',
      descriptionOfStreetsGtfs: legacy.description_of_streets_gtfs || '',
      usedInDateShedule: Boolean(legacy.used_in_date_shedule),
      lineKmMeanValueWithBusTerminus:
        legacy.line_km_mean_value_with_bus_terminus?.toString() || '0.000',
      systemTypesId: legacy.system_types_id || 0,
      categoriesLineId: legacy.categories_line_id || 0,
      timeFromByLine: parseTime(legacy.time_from_by_line),
      timeToByLine: parseTime(legacy.time_to_by_line),
      onlineDiscountType: parseOnlineDiscountType(legacy.online_discount_type),
      showOnWeb: Boolean(legacy.show_on_web),
      showOnAndroid:
        legacy.show_on_android !== undefined
          ? Boolean(legacy.show_on_android)
          : true,
    };
  }

  private async findAllFromLegacy(
    subtype: string,
    dateValidFrom?: string,
    page = 1,
    limit = 50,
  ) {
    try {
      // Prvo učitaj ID-eve sinhronizovanih centralnih tačaka
      const syncedCentralPoints = await this.prisma.centralPoint.findMany({
        where: { syncWithCityServer: true },
        select: { legacyTicketingId: true },
      });

      const syncedIds = syncedCentralPoints
        .map((cp) => cp.legacyTicketingId)
        .filter((id) => id !== null);

      // Ako nema sinhronizovanih CP, vrati prazan rezultat
      if (syncedIds.length === 0) {
        return {
          data: [],
          total: 0,
          page,
          limit,
        };
      }

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

        // Kreiraj IN klauzulu za filtriranje po central_point_db_id
        const idsPlaceholder = syncedIds.map(() => '?').join(',');

        // Построј WHERE klauzulu
        const whereClauses: string[] = [];
        const params: any[] = [];

        whereClauses.push(`central_point_db_id IN (${idsPlaceholder})`);
        params.push(...syncedIds);

        if (dateValidFrom) {
          whereClauses.push('date_valid_from = ?');
          params.push(dateValidFrom);
        }

        const whereClause = `WHERE ${whereClauses.join(' AND ')}`;

        // Get total count
        const countQuery = `SELECT COUNT(*) as total FROM price_tables_index ${whereClause}`;
        const [countRows] = await connection.execute(countQuery, params);
        const total = (countRows as any)[0].total;

        // Get paginated data
        const dataQuery = `SELECT * FROM price_tables_index ${whereClause} ORDER BY id ASC LIMIT ? OFFSET ?`;
        const [rows] = await connection.execute(dataQuery, [
          ...params,
          limit,
          offset,
        ]);

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

  private convertBigIntToString(line: any) {
    return {
      ...line,
      id: line.id.toString(),
      legacyTicketingId: line.legacyTicketingId
        ? line.legacyTicketingId.toString()
        : null,
      legacyCityId: line.legacyCityId ? line.legacyCityId.toString() : null,
    };
  }

  // ========== LINE UIDS SYNC (STANICE NA LINIJAMA) ==========

  /**
   * Sinhronizacija price_lists_line_uids tabele za odabranu grupu cenovnika
   * Automatski kreira tabelu ako ne postoji (iz template-a)
   */
  async syncLineUidsFromTicketing(dateValidFrom: string): Promise<{
    success: boolean;
    tableName: string;
    tableCreated: boolean;
    totalRecords: number;
    inserted: number;
    duration: string;
    message: string;
  }> {
    console.log(
      `🔄 Starting Line UIDs sync for date: ${dateValidFrom}...`,
    );
    const startTime = Date.now();

    // 1. Format table name (npr. "2023-09-01" -> "price_lists_line_uids_2023_09_01")
    const tableName = `price_lists_line_uids_${dateValidFrom.replace(/-/g, '_')}`;

    // 2. Proveri da li tabela postoji
    const tableExists = await this.checkIfTableExists(tableName);
    const tableCreated = !tableExists;

    // 3. Ako ne postoji, kreiraj iz template-a
    if (!tableExists) {
      console.log(`📋 Table ${tableName} does not exist, creating from template...`);
      await this.createTableFromTemplate(tableName);
    } else {
      console.log(`✅ Table ${tableName} already exists`);
    }

    // 4. Konektuj se na legacy bazu
    const legacyDb = await this.prisma.legacyDatabase.findFirst({
      where: { subtype: 'main_ticketing_database' },
    });

    if (!legacyDb) {
      throw new NotFoundException(
        'Legacy baza "Glavna Ticketing Baza" nije pronađena',
      );
    }

    // 5. Sinhronizuj podatke sa legacy tabele u našu tabelu
    const inserted = await this.syncDataFromLegacy(
      tableName,
      dateValidFrom,
      legacyDb,
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Line UIDs sync completed in ${duration}s`);

    return {
      success: true,
      tableName,
      tableCreated,
      totalRecords: inserted,
      inserted,
      duration: `${duration}s`,
      message: `${tableCreated ? 'Tabela kreirana i ' : ''}Sinhronizovano ${inserted} stanica za grupu ${dateValidFrom}`,
    };
  }

  /**
   * Sinhronizuj stanice sa Legacy City Servera
   * Kreira tabelu price_lists_line_uids_YYYY_MM_DD ako ne postoji
   * i sinhronizuje podatke sa legacy_city_database
   */
  async syncLineUidsFromCity(dateValidFrom: string): Promise<{
    success: boolean;
    tableName: string;
    tableCreated: boolean;
    totalRecords: number;
    inserted: number;
    duration: string;
    message: string;
  }> {
    console.log(
      `🔄 Starting Line UIDs sync from City Server for date: ${dateValidFrom}...`,
    );
    const startTime = Date.now();

    // 1. Format table name (npr. "2023-09-01" -> "price_lists_line_uids_2023_09_01")
    const tableName = `price_lists_line_uids_${dateValidFrom.replace(/-/g, '_')}`;

    // 2. Proveri da li tabela postoji
    const tableExists = await this.checkIfTableExists(tableName);
    const tableCreated = !tableExists;

    // 3. Ako ne postoji, kreiraj iz template-a
    if (!tableExists) {
      console.log(`📋 Table ${tableName} does not exist, creating from template...`);
      await this.createTableFromTemplate(tableName);
    } else {
      console.log(`✅ Table ${tableName} already exists`);
    }

    // 4. Konektuj se na legacy City bazu
    const legacyDb = await this.prisma.legacyDatabase.findFirst({
      where: { subtype: 'city_ticketing_database' },
    });

    if (!legacyDb) {
      throw new NotFoundException(
        'Legacy baza "Gradska Ticketing Baza" nije pronađena',
      );
    }

    // 5. Sinhronizuj podatke sa legacy City tabele u našu tabelu
    const inserted = await this.syncDataFromLegacy(
      tableName,
      dateValidFrom,
      legacyDb,
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Line UIDs sync from City Server completed in ${duration}s`);

    return {
      success: true,
      tableName,
      tableCreated,
      totalRecords: inserted,
      inserted,
      duration: `${duration}s`,
      message: `${tableCreated ? 'Tabela kreirana i ' : ''}Sinhronizovano ${inserted} stanica sa City servera za grupu ${dateValidFrom}`,
    };
  }

  /**
   * Proveri da li tabela postoji u bazi
   */
  private async checkIfTableExists(tableName: string): Promise<boolean> {
    const result = await this.prisma.$queryRawUnsafe<{ count: number }[]>(
      `
      SELECT COUNT(*) as count
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
      AND table_name = ?
    `,
      tableName,
    );

    return result[0].count > 0;
  }

  /**
   * Kreiraj novu tabelu iz template-a
   */
  private async createTableFromTemplate(tableName: string): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      `CREATE TABLE ${tableName} LIKE price_lists_line_uids_template`,
    );
    console.log(`✅ Created table: ${tableName}`);
  }

  /**
   * Sinhronizuj podatke sa legacy servera u našu tabelu
   */
  private async syncDataFromLegacy(
    tableName: string,
    dateValidFrom: string,
    legacyDb: any,
  ): Promise<number> {
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
      // Učitaj podatke iz legacy tabele
      const legacyTableName = `price_lists_line_uids_${dateValidFrom.replace(/-/g, '_')}`;

      console.log(`📥 Fetching data from legacy table: ${legacyTableName}`);

      const [rows] = await connection.execute(
        `SELECT * FROM ${legacyTableName}`,
      );

      const legacyRecords = rows as any[];
      console.log(`📊 Found ${legacyRecords.length} records in legacy table`);

      if (legacyRecords.length === 0) {
        return 0;
      }

      // Obriši sve postojeće podatke iz tabele (svaka tabela sadrži samo jednu verziju cenovnika)
      // TRUNCATE je brži od DELETE i resetuje auto-increment
      await this.prisma.$executeRawUnsafe(
        `TRUNCATE TABLE ${tableName}`,
      );

      console.log(`🗑️  Cleared all data from ${tableName} (TRUNCATE)`);

      // Batch insert u našu tabelu
      const BATCH_SIZE = 100;
      let totalInserted = 0;

      for (let i = 0; i < legacyRecords.length; i += BATCH_SIZE) {
        const batch = legacyRecords.slice(i, i + BATCH_SIZE);

        // Prepare values for batch insert
        const values = batch.map((record) => {
          return `(
            ${record.price_tables_index_id},
            ${record.station_number},
            ${record.station_uid},
            ${record.disable_show_on_public},
            '${this.formatDateTime(record.pricelist_version)}',
            ${record.active_flag},
            ${record.changed_by},
            '${this.formatDateTime(record.change_date_time)}',
            ${record.transient_station}
          )`;
        }).join(',');

        const insertQuery = `
          INSERT INTO ${tableName}
          (price_tables_index_id, station_number, station_uid, disable_show_on_public,
           pricelist_version, active_flag, changed_by, change_date_time, transient_station)
          VALUES ${values}
        `;

        await this.prisma.$executeRawUnsafe(insertQuery);
        totalInserted += batch.length;

        const processed = Math.min(i + BATCH_SIZE, legacyRecords.length);
        console.log(
          `📈 Progress: ${processed}/${legacyRecords.length} (${Math.round((processed / legacyRecords.length) * 100)}%)`,
        );
      }

      console.log(`✅ Inserted ${totalInserted} records into ${tableName}`);
      return totalInserted;
    } finally {
      await connection.end();
    }
  }

  /**
   * Helper za formatiranje datuma za SQL
   */
  private formatDateTime(value: any): string {
    if (!value) return new Date().toISOString().slice(0, 19).replace('T', ' ');

    if (value instanceof Date) {
      return value.toISOString().slice(0, 19).replace('T', ' ');
    }

    if (typeof value === 'string') {
      // Ako je već u MySQL formatu (YYYY-MM-DD HH:MM:SS)
      if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
        return value;
      }
      // Pokušaj parsiranje
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date.toISOString().slice(0, 19).replace('T', ' ');
      }
    }

    return new Date().toISOString().slice(0, 19).replace('T', ' ');
  }
}
