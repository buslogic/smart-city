import { Injectable } from '@nestjs/common';
import { PrismaLegacyService } from '../prisma-legacy/prisma-legacy.service';

@Injectable()
export class ConsumersService {
  constructor(private legacyDb: PrismaLegacyService) {}

  // IDENTIČNO kao PHP ConsumersModel::getConsumersForSL() (linija 108-152)
  async getConsumersForSL(query: string = '', pageNumber: number = 0) {
    const limit = 30;
    const offset = pageNumber * limit;
    const searchQuery = `%${query}%`;

    // PHP linija 115-121
    const data = await this.legacyDb.$queryRawUnsafe<any[]>(
      `SELECT sifra_potrosaca, naziv_potrosaca
       FROM vodovod_consumers
       WHERE (sifra_potrosaca LIKE ? OR naziv_potrosaca LIKE ?)
       ORDER BY naziv_potrosaca DESC
       LIMIT ?, ?`,
      searchQuery,
      searchQuery,
      offset,
      limit
    );

    // Format: "sifra_potrosaca | naziv_potrosaca" (PHP linija 127-133)
    const formattedData = data.map((row) => {
      let value = String(row.sifra_potrosaca);
      if (row.naziv_potrosaca) {
        value += ' | ' + row.naziv_potrosaca;
      }
      return value;
    });

    // Count query (PHP linija 137-143)
    const countResult = await this.legacyDb.$queryRawUnsafe<Array<{ total: bigint }>>(`
      SELECT COUNT(*) as total
      FROM vodovod_consumers
      WHERE (sifra_potrosaca LIKE ? OR naziv_potrosaca LIKE ?)
    `, searchQuery, searchQuery);

    const totalRows = Number(countResult[0]?.total ?? 0);
    const hasMore = offset + limit < totalRows;

    return {
      data: formattedData,
      hasMore
    };
  }
}
