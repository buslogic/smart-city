import { Injectable } from '@nestjs/common';
import { PrismaLegacyService } from '../prisma-legacy/prisma-legacy.service';
import { CreateReadingListDto } from './dto/create-reading-list.dto';
import { UpdateReadingListDto } from './dto/update-reading-list.dto';

export interface ReadingList {
  id: number;
  pod_kampanja_id: string;
  ulica: string;
  status: string;
}

@Injectable()
export class ReadingListsService {
  constructor(private prismaLegacy: PrismaLegacyService) {}

  // Helper to extract ID from "ID | Name" format or return number directly
  private extractId(value: any): number | null {
    if (!value) return null;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parts = value.split(' | ');
      return parts.length > 1 ? parseInt(parts[0]) : parseInt(value);
    }
    return null;
  }

  async findAll(): Promise<ReadingList[]> {
    const query = `
      SELECT rl.*,
        CONCAT(ss.id, ' | ', ss.naziv) as status,
        CONCAT(sc.id, ' | ', c.godina, '-', c.mesec, '-', sc.dan) as pod_kampanja_id,
        CONCAT(oa.id, ' | ', oa.address_name) as ulica
      FROM vodovod_reading_list rl
      LEFT JOIN vodovod_reading_lists_status ss on rl.status = ss.id
      LEFT JOIN vodovod_sub_campaign sc on rl.pod_kampanja_id = sc.id
      LEFT JOIN vodovod_campaign c on sc.kampanja_id = c.id
      LEFT JOIN ordering_addresses oa on rl.ulica = oa.id
      ORDER BY rl.id DESC
    `;

    const lists = await this.prismaLegacy.$queryRawUnsafe<any[]>(query);
    return lists;
  }

  async getStatusForSL(data: { query?: string; pageNumber?: number }, limit = 30) {
    const query = data.query || '';
    const pageNumber = data.pageNumber || 0;
    const offset = pageNumber * limit;
    const searchQuery = `%${query}%`;

    const sql = `
      SELECT ss.id, ss.naziv as status_id
      FROM vodovod_reading_lists_status ss
      WHERE ( ss.naziv LIKE ? OR ss.id LIKE ? )
      ORDER BY ss.id
      LIMIT ?, ?
    `;

    const countSql = `
      SELECT COUNT(*) as total
      FROM vodovod_reading_lists_status ss
      WHERE ( ss.naziv LIKE ? OR ss.id LIKE ? )
    `;

    const items = await this.prismaLegacy.$queryRawUnsafe<any[]>(
      sql,
      searchQuery,
      searchQuery,
      offset,
      limit,
    );

    const countResult = await this.prismaLegacy.$queryRawUnsafe<any[]>(
      countSql,
      searchQuery,
      searchQuery,
    );

    const totalRows = countResult[0]?.total || 0;
    const hasMore = offset + limit < totalRows;

    return {
      data: items.map((item) => `${item.id} | ${item.status_id}`),
      hasMore,
    };
  }

  async getSubCampaignForSL(data: { query?: string; pageNumber?: number }, limit = 30) {
    const query = data.query || '';
    const pageNumber = data.pageNumber || 0;
    const offset = pageNumber * limit;
    const searchQuery = `%${query}%`;

    const sql = `
      SELECT sc.id, CONCAT(c.godina, '-', c.mesec, '-', sc.dan) as pod_kampanja_id
      FROM vodovod_sub_campaign sc
      LEFT JOIN vodovod_campaign c on sc.kampanja_id = c.id
      WHERE ( sc.dan LIKE ? OR c.godina LIKE ? OR c.mesec LIKE ? OR sc.id LIKE ? )
      ORDER BY sc.id
      LIMIT ?, ?
    `;

    const countSql = `
      SELECT COUNT(*) as total
      FROM vodovod_sub_campaign sc
      LEFT JOIN vodovod_campaign c on sc.kampanja_id = c.id
      WHERE ( sc.dan LIKE ? OR c.godina LIKE ? OR c.mesec LIKE ? OR sc.id LIKE ? )
    `;

    const items = await this.prismaLegacy.$queryRawUnsafe<any[]>(
      sql,
      searchQuery,
      searchQuery,
      searchQuery,
      searchQuery,
      offset,
      limit,
    );

    const countResult = await this.prismaLegacy.$queryRawUnsafe<any[]>(
      countSql,
      searchQuery,
      searchQuery,
      searchQuery,
      searchQuery,
    );

    const totalRows = countResult[0]?.total || 0;
    const hasMore = offset + limit < totalRows;

    return {
      data: items.map((item) => `${item.id} | ${item.pod_kampanja_id}`),
      hasMore,
    };
  }

  async create(createReadingListDto: CreateReadingListDto) {
    const podKampanjaId = this.extractId(createReadingListDto.pod_kampanja_id);
    const ulica = this.extractId(createReadingListDto.ulica);
    const status = this.extractId(createReadingListDto.status);

    const insertQuery = `
      INSERT INTO vodovod_reading_list (pod_kampanja_id, ulica, status)
      VALUES (?, ?, ?)
    `;

    await this.prismaLegacy.$executeRawUnsafe(
      insertQuery,
      podKampanjaId,
      ulica,
      status,
    );

    // Get inserted row
    const getLastInsertIdQuery = `SELECT LAST_INSERT_ID() as id`;
    const lastInsertResult = await this.prismaLegacy.$queryRawUnsafe<any[]>(
      getLastInsertIdQuery,
    );
    const insertedId = lastInsertResult[0]?.id;

    const rowQuery = `
      SELECT rl.*,
        CONCAT(ss.id, ' | ', ss.naziv) as status,
        CONCAT(sc.id, ' | ', c.godina, '-', c.mesec, '-', sc.dan) as pod_kampanja_id,
        CONCAT(oa.id, ' | ', oa.address_name) as ulica
      FROM vodovod_reading_list rl
      LEFT JOIN vodovod_reading_lists_status ss on rl.status = ss.id
      LEFT JOIN vodovod_sub_campaign sc on rl.pod_kampanja_id = sc.id
      LEFT JOIN vodovod_campaign c on sc.kampanja_id = c.id
      LEFT JOIN ordering_addresses oa on rl.ulica = oa.id
      WHERE rl.id = ?
    `;

    const row = await this.prismaLegacy.$queryRawUnsafe<any[]>(rowQuery, insertedId);

    if (row && row.length > 0) {
      return { success: true, message: 'Successful!', data: row[0] };
    }

    return { success: false, message: 'failed to get the data' };
  }

  async update(id: number, updateReadingListDto: UpdateReadingListDto) {
    const podKampanjaId = this.extractId(updateReadingListDto.pod_kampanja_id);
    const ulica = this.extractId(updateReadingListDto.ulica);
    const status = this.extractId(updateReadingListDto.status);

    const updateQuery = `
      UPDATE vodovod_reading_list
      SET pod_kampanja_id = ?, ulica = ?, status = ?
      WHERE id = ?
    `;

    await this.prismaLegacy.$executeRawUnsafe(
      updateQuery,
      podKampanjaId,
      ulica,
      status,
      id,
    );

    // Get updated row
    const rowQuery = `
      SELECT rl.*,
        CONCAT(ss.id, ' | ', ss.naziv) as status,
        CONCAT(sc.id, ' | ', c.godina, '-', c.mesec, '-', sc.dan) as pod_kampanja_id,
        CONCAT(oa.id, ' | ', oa.address_name) as ulica
      FROM vodovod_reading_list rl
      LEFT JOIN vodovod_reading_lists_status ss on rl.status = ss.id
      LEFT JOIN vodovod_sub_campaign sc on rl.pod_kampanja_id = sc.id
      LEFT JOIN vodovod_campaign c on sc.kampanja_id = c.id
      LEFT JOIN ordering_addresses oa on rl.ulica = oa.id
      WHERE rl.id = ?
    `;

    const row = await this.prismaLegacy.$queryRawUnsafe<any[]>(rowQuery, id);

    if (row && row.length > 0) {
      return { success: true, message: 'Successful!', data: row[0] };
    }

    return { success: false, message: 'failed to get the data' };
  }

  async remove(id: number) {
    const deleteQuery = `DELETE FROM vodovod_reading_list WHERE id = ?`;
    const result = await this.prismaLegacy.$executeRawUnsafe(deleteQuery, id);

    return { success: true, message: 'Red je uspešno obrisan.' };
  }

  async archive(id: number) {
    const archiveQuery = `UPDATE vodovod_reading_list SET status = 5 WHERE id = ?`;
    const result = await this.prismaLegacy.$executeRawUnsafe(archiveQuery, id);

    return { success: true, message: 'Red je uspešno arhiviran.' };
  }
}
