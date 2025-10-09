import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import {
  GetLinesQueryDto,
  LineResponseDto,
  PaginatedLinesResponseDto,
  PriceTableGroupDto,
  VariationStatus,
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
}
