import { Injectable } from '@nestjs/common';
import { PrismaLegacyService } from '../prisma-legacy/prisma-legacy.service';

@Injectable()
export class WaterServicesPricelistService {
  constructor(private legacyDb: PrismaLegacyService) {}

  // IDENTIČNO kao PHP WaterServicesPricelistModel::getPricelistServicesForSL() (linija 137-179)
  async getPricelistServicesForSL(query: string = '', pageNumber: number = 0) {
    const limit = 30;
    const offset = pageNumber * limit;
    const searchQuery = `%${query}%`;

    // JOIN query identičan sa PHP linija 143-152
    const data = await this.legacyDb.$queryRawUnsafe<any[]>(
      `SELECT
         vs.service,
         vwsp.id,
         vcc.category
        FROM vodovod_water_services_pricelist vwsp
        LEFT JOIN vodovod_service vs ON vwsp.service_id = vs.id
        LEFT JOIN vodovod_consumer_categories vcc ON vwsp.category_id = vcc.id
        WHERE (vs.service LIKE ? OR vs.id LIKE ?)
        ORDER BY vs.id
        LIMIT ?, ?`,
      searchQuery, searchQuery, offset, limit
    );

    // Format: "id | category | service" (PHP linija 154-164)
    const formattedData = data.map((row) => {
      let value = String(row.id);

      if (row.category) {
        value += ' | ' + row.category;
      }
      if (row.service) {
        value += ' | ' + row.service;
      }

      return value;
    });

    // Count query identičan sa PHP linija 166-170
    const countResult = await this.legacyDb.$queryRawUnsafe<Array<{ total: bigint }>>(`
      SELECT COUNT(*) as total
      FROM vodovod_service vs
      WHERE ( vs.service LIKE ? OR vs.id LIKE ? )
    `, searchQuery, searchQuery);

    const totalRows = Number(countResult[0]?.total ?? 0);
    const hasMore = offset + limit < totalRows;

    return {
      data: formattedData,
      hasMore
    };
  }
}
