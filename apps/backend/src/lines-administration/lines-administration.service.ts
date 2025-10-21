import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import {
  GetLinesQueryDto,
  LineResponseDto,
  PaginatedLinesResponseDto,
  PriceTableGroupDto,
  VariationStatus,
  TimetableResponseDto,
  TimetableScheduleDto,
  StationTimesDto,
  StationsOnLineResponseDto,
} from './dto';

@Injectable()
export class LinesAdministrationService {
  constructor(private readonly prisma: PrismaService) {}

  async getPriceTableGroups(): Promise<PriceTableGroupDto[]> {
    const groups = await this.prisma.$queryRaw<any[]>`
      SELECT
        id,
        name,
        status,
        date_valid_from as dateValidFrom
      FROM price_table_groups
      ORDER BY name
    `;

    // Convert BigInt to Number for JSON serialization
    return groups.map(group => ({
      ...group,
      id: Number(group.id),
    }));
  }

  async getLines(query: GetLinesQueryDto): Promise<PaginatedLinesResponseDto> {
    const { groupId, page = 1, limit = 50, search = '', showExpired = false, showOnlyActive = false, showInactive = false } = query;

    // Build WHERE clause
    const whereConditions: string[] = [];
    const params: any[] = [];

    // Veza između price_table_groups i lines je preko date_valid_from
    // Prvo pročitamo datum grupe, pa filtriramo linije
    if (groupId) {
      const group = await this.prisma.$queryRaw<any[]>`
        SELECT date_valid_from FROM price_table_groups WHERE id = ${groupId}
      `;

      if (group.length > 0) {
        whereConditions.push(`l.date_valid_from = ?`);
        params.push(group[0].date_valid_from);
      }
    }

    if (search) {
      whereConditions.push(`(l.line_number_for_display LIKE ? OR l.line_title LIKE ?)`);
      params.push(`%${search}%`, `%${search}%`);
    }

    // Filter by line status - po defaultu prikaži samo aktivne linije (status = 'A')
    if (!showInactive) {
      whereConditions.push(`l.status = ?`);
      params.push('A');
    }

    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    // Filter by variation status
    let statusFilter = '';
    if (showOnlyActive) {
      // Prikaži samo linije sa aktivnim varijacijama
      statusFilter = `WHERE variationStatus = 'AKTUELNA'`;
    } else if (!showExpired) {
      // Sakrij istekle varijacije
      statusFilter = `WHERE variationStatus != 'ISTEKLA'`;
    }

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as count
      FROM (
        SELECT
          l.id,
          CASE
            WHEN pv.id IS NULL THEN 'BEZ_VARIJACIJE'
            WHEN NOW() BETWEEN pv.datetime_from AND pv.datetime_to THEN 'AKTUELNA'
            WHEN NOW() < pv.datetime_from THEN 'BUDUĆA'
            ELSE 'ISTEKLA'
          END as variationStatus
        FROM \`lines\` l
        LEFT JOIN price_variations pv ON l.price_variation_id = pv.legacy_ticketing_id AND l.price_variation_id > 0
        ${whereClause}
      ) as subquery
      ${statusFilter}
    `;

    const countResult = await this.prisma.$queryRawUnsafe<any[]>(
      countQuery,
      ...params
    );
    const total = Number(countResult[0]?.count || 0);

    // Calculate pagination
    const offset = (page - 1) * limit;
    const totalPages = Math.ceil(total / limit);

    // Get paginated data
    const dataQuery = `
      SELECT * FROM (
        SELECT
          l.id,
          l.line_number as lineNumber,
          l.line_number_for_display as lineNumberForDisplay,
          l.line_title as lineTitle,
          l.direction_id_for_display as direction,
          l.line_type as lineType,
          l.status as lineStatus,
          l.price_table_ident as priceTableIdent,
          pv.id as variationId,
          pv.variation_name as variationName,
          pv.datetime_from as datetimeFrom,
          pv.datetime_to as datetimeTo,
          CASE
            WHEN pv.id IS NULL THEN 'BEZ_VARIJACIJE'
            WHEN NOW() BETWEEN pv.datetime_from AND pv.datetime_to THEN 'AKTUELNA'
            WHEN NOW() < pv.datetime_from THEN 'BUDUĆA'
            ELSE 'ISTEKLA'
          END as variationStatus
        FROM \`lines\` l
        LEFT JOIN price_variations pv ON l.price_variation_id = pv.legacy_ticketing_id AND l.price_variation_id > 0
        ${whereClause}
      ) as subquery
      ${statusFilter}
      ORDER BY lineNumber, variationStatus
      LIMIT ? OFFSET ?
    `;

    const data = await this.prisma.$queryRawUnsafe<LineResponseDto[]>(
      dataQuery,
      ...params,
      limit,
      offset
    );

    // Convert BigInt to Number for JSON serialization
    const serializedData = data.map(line => ({
      ...line,
      id: Number(line.id),
      variationId: line.variationId ? Number(line.variationId) : null,
    }));

    return {
      data: serializedData,
      total,
      page,
      limit,
      totalPages,
    };
  }

  async getTimetablesByPriceTableIdent(priceTableIdent: string): Promise<TimetableResponseDto> {
    // First, get line info
    const lineInfo = await this.prisma.$queryRaw<any[]>`
      SELECT
        line_number as lineNumber,
        line_number_for_display as lineNumberForDisplay,
        line_title as lineTitle
      FROM \`lines\`
      WHERE price_table_ident = ${priceTableIdent}
      LIMIT 1
    `;

    if (lineInfo.length === 0) {
      throw new NotFoundException(`Line with price_table_ident ${priceTableIdent} not found`);
    }

    // Get timetable schedules
    const schedules = await this.prisma.$queryRaw<any[]>`
      SELECT
        id,
        datum,
        idlinije,
        smer,
        pon,
        uto,
        sre,
        cet,
        pet,
        sub,
        ned,
        dk1,
        dk1naziv,
        dk2,
        dk2naziv,
        dk3,
        dk3naziv,
        dk4,
        dk4naziv,
        variation,
        datetime_from as datetimeFrom,
        datetime_to as datetimeTo,
        variation_description as variationDescription,
        legacy_ticketing_id as legacyTicketingId,
        legacy_city_id as legacyCityId
      FROM vremena_polaska
      WHERE idlinije = ${priceTableIdent}
      ORDER BY smer, variation, datum
    `;

    // Convert BigInt to Number for JSON serialization
    const serializedSchedules: TimetableScheduleDto[] = schedules.map(schedule => ({
      ...schedule,
      id: Number(schedule.id),
      legacyTicketingId: schedule.legacyTicketingId ? Number(schedule.legacyTicketingId) : null,
      legacyCityId: schedule.legacyCityId ? Number(schedule.legacyCityId) : null,
    }));

    return {
      schedules: serializedSchedules,
      lineInfo: lineInfo[0],
    };
  }

  async getStationTimes(
    idlinije: string,
    smer: number,
    dan: string,
    vreme: string
  ): Promise<StationTimesDto | null> {
    // 1. Povući date_valid_from za liniju
    const lineData = await this.prisma.$queryRaw<any[]>`
      SELECT date_valid_from
      FROM \`lines\`
      WHERE price_table_ident = ${idlinije}
      LIMIT 1
    `;

    if (lineData.length === 0) {
      // Fallback: ako nema linije, vrati samo osnovne podatke
      return this.getStationTimesBasic(idlinije, smer, dan, vreme);
    }

    // 2. Formatiraj datum u YYYY_MM_DD za ime tabele
    const dateValidFrom = lineData[0].date_valid_from;
    const dateStr = dateValidFrom instanceof Date
      ? dateValidFrom.toISOString().split('T')[0]
      : dateValidFrom.toString().split('T')[0];
    const tableName = `price_lists_line_uids_${dateStr.replace(/-/g, '_')}`;

    // 3. Proveri da li tabela postoji
    const tableExists = await this.checkIfTableExists(tableName);

    if (!tableExists) {
      // Tabela ne postoji - vrati samo osnovne podatke
      return this.getStationTimesBasic(idlinije, smer, dan, vreme);
    }

    // 4. Izvršiti JOIN query sa nazivima stanica
    try {
      const result = await this.prisma.$queryRawUnsafe<any[]>(
        `
        SELECT
          vps.id,
          vps.datum,
          vps.idlinije,
          vps.smer,
          vps.dan,
          vps.vreme,
          vps.stanice,
          vps.opis,
          vps.gtfs_trip_id as gtfsTripId,
          vps.legacy_ticketing_id as legacyTicketingId,
          vps.legacy_city_id as legacyCityId,
          GROUP_CONCAT(usil.station_name ORDER BY plu.station_number SEPARATOR '|||') as stationNames
        FROM vremena_polaska_st vps
        LEFT JOIN \`lines\` l
          ON l.price_table_ident = vps.idlinije
        LEFT JOIN ${tableName} plu
          ON plu.price_tables_index_id = l.legacy_ticketing_id AND plu.active_flag = 1
        LEFT JOIN unique_station_id_local usil
          ON usil.unique_id = plu.station_uid
        WHERE vps.idlinije = ?
          AND vps.smer = ?
          AND vps.dan = ?
          AND vps.vreme = ?
        GROUP BY vps.id
        LIMIT 1
        `,
        idlinije,
        smer,
        dan,
        vreme
      );

      if (result.length === 0) {
        return null;
      }

      const record = result[0];
      return {
        ...record,
        id: Number(record.id),
        legacyTicketingId: record.legacyTicketingId ? Number(record.legacyTicketingId) : null,
        legacyCityId: record.legacyCityId ? Number(record.legacyCityId) : null,
        stationNames: record.stationNames || undefined,
      };
    } catch (error) {
      console.error('Error fetching station times with names:', error);
      // Ako JOIN query ne uspe, vrati osnovne podatke
      return this.getStationTimesBasic(idlinije, smer, dan, vreme);
    }
  }

  // Helper metod za osnovne podatke bez naziva stanica
  private async getStationTimesBasic(
    idlinije: string,
    smer: number,
    dan: string,
    vreme: string
  ): Promise<StationTimesDto | null> {
    const result = await this.prisma.$queryRaw<any[]>`
      SELECT
        id,
        datum,
        idlinije,
        smer,
        dan,
        vreme,
        stanice,
        opis,
        gtfs_trip_id as gtfsTripId,
        legacy_ticketing_id as legacyTicketingId,
        legacy_city_id as legacyCityId
      FROM vremena_polaska_st
      WHERE idlinije = ${idlinije}
        AND smer = ${smer}
        AND dan = ${dan}
        AND vreme = ${vreme}
      LIMIT 1
    `;

    if (result.length === 0) {
      return null;
    }

    const record = result[0];
    return {
      ...record,
      id: Number(record.id),
      legacyTicketingId: record.legacyTicketingId ? Number(record.legacyTicketingId) : null,
      legacyCityId: record.legacyCityId ? Number(record.legacyCityId) : null,
    };
  }

  // Helper metod za proveru postojanja tabele (reused from lines service)
  private async checkIfTableExists(tableName: string): Promise<boolean> {
    const result = await this.prisma.$queryRawUnsafe<any[]>(
      `
      SELECT COUNT(*) as count
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name = ?
      `,
      tableName
    );
    return result[0].count > 0;
  }

  async getStationsOnLine(priceTableIdent: string): Promise<StationsOnLineResponseDto> {
    // 1. Povući line info (date_valid_from, legacy_ticketing_id, line_number, etc.)
    const lineInfo = await this.prisma.$queryRaw<any[]>`
      SELECT
        line_number as lineNumber,
        line_number_for_display as lineNumberForDisplay,
        line_title as lineTitle,
        date_valid_from as dateValidFrom,
        legacy_ticketing_id as legacyTicketingId
      FROM \`lines\`
      WHERE price_table_ident = ${priceTableIdent}
      LIMIT 1
    `;

    if (lineInfo.length === 0) {
      throw new NotFoundException(`Line with price_table_ident ${priceTableIdent} not found`);
    }

    const line = lineInfo[0];

    if (!line.legacyTicketingId) {
      throw new NotFoundException(`Line does not have legacy_ticketing_id - cannot fetch stations`);
    }

    // 2. Formatirati datum u YYYY_MM_DD za ime tabele
    const dateValidFrom = line.dateValidFrom;
    const dateStr = dateValidFrom instanceof Date
      ? dateValidFrom.toISOString().split('T')[0]
      : dateValidFrom.toString().split('T')[0];
    const tableName = `price_lists_line_uids_${dateStr.replace(/-/g, '_')}`;

    // 3. Proveriti da li tabela postoji
    const tableExists = await this.checkIfTableExists(tableName);

    if (!tableExists) {
      throw new NotFoundException(`Stations table ${tableName} does not exist for this line`);
    }

    // 4. Izvršiti JOIN query sa unique_station_id_local
    try {
      const stations = await this.prisma.$queryRawUnsafe<any[]>(
        `
        SELECT
          plu.station_number as stationNumber,
          plu.station_uid as stationUid,
          plu.disable_show_on_public as disableShowOnPublic,
          plu.transient_station as transientStation,
          plu.changed_by as changedBy,
          plu.change_date_time as changeDateTime,
          usil.station_name as stationName,
          usil.gpsx,
          usil.gpsy
        FROM ${tableName} plu
        LEFT JOIN unique_station_id_local usil
          ON usil.unique_id = plu.station_uid
        WHERE plu.price_tables_index_id = ?
          AND plu.active_flag = 1
        ORDER BY plu.station_number
        `,
        line.legacyTicketingId
      );

      return {
        stations,
        lineInfo: {
          lineNumber: line.lineNumber,
          lineNumberForDisplay: line.lineNumberForDisplay,
          lineTitle: line.lineTitle,
          dateValidFrom: line.dateValidFrom,
        },
        tableName,
        totalStations: stations.length,
      };
    } catch (error) {
      console.error('Error fetching stations on line:', error);
      throw new NotFoundException(`Failed to fetch stations from table ${tableName}`);
    }
  }
}
