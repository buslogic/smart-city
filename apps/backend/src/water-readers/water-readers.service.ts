import { Injectable } from '@nestjs/common';
import { PrismaLegacyService } from '../prisma-legacy/prisma-legacy.service';
import { CreateWaterReaderDto } from './dto/create-water-reader.dto';
import { UpdateWaterReaderDto } from './dto/update-water-reader.dto';

@Injectable()
export class WaterReadersService {
  constructor(private prismaLegacy: PrismaLegacyService) {}

  private extractId(value: any): number | null {
    if (!value) return null;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parts = value.split(' | ');
      return parts.length > 1 ? parseInt(parts[0]) : parseInt(value);
    }
    return null;
  }

  async findAll() {
    const query = 'SELECT vr.* FROM vodovod_readers AS vr ORDER BY id DESC';
    const readers = await this.prismaLegacy.$queryRawUnsafe<any[]>(query);

    const out: any[] = [];
    for (const reader of readers) {
      const assignments = await this.getAssignmentsByReaderID(reader.id);
      reader.addresses = assignments.addresses;
      reader.regions = assignments.regions;
      out.push(reader);
    }

    return out;
  }

  async findOne(id: number) {
    const query = 'SELECT * FROM vodovod_readers WHERE id = ?';
    const readers = await this.prismaLegacy.$queryRawUnsafe<any[]>(query, id);

    if (readers.length === 0) {
      return null;
    }

    const reader = readers[0];
    const assignments = await this.getAssignmentsByReaderID(id);
    reader.addresses = assignments.addresses;
    reader.regions = assignments.regions;

    return reader;
  }

  async getAssignmentsByReaderID(reader_id: number) {
    return {
      regions: await this.getReaderRegions(reader_id),
      addresses: await this.getReaderAddresses(reader_id),
    };
  }

  async getReaderRegions(reader_id: number) {
    const query = `
      SELECT vr.region_name, vr.id, vrr.reader_id
      FROM vodovod_reader_regions AS vrr
      LEFT JOIN vodovod_regions AS vr ON vr.id = vrr.region_id
      WHERE vrr.reader_id = ?
    `;

    const regions = await this.prismaLegacy.$queryRawUnsafe<any[]>(
      query,
      reader_id,
    );

    return regions;
  }

  async getReaderAddresses(reader_id: number) {
    const query = `
      SELECT oa.address_name, oa.id, vra.reader_id
      FROM vodovod_reader_addresses AS vra
      LEFT JOIN ordering_addresses AS oa ON oa.id = vra.address_id
      WHERE vra.reader_id = ?
    `;

    const addresses = await this.prismaLegacy.$queryRawUnsafe<any[]>(
      query,
      reader_id,
    );

    return addresses;
  }

  async getRegionsForSL(
    data: { query?: string; pageNumber?: number },
    limit = 30,
  ) {
    const query = data.query || '';
    const pageNumber = data.pageNumber || 0;
    const offset = pageNumber * limit;
    const searchQuery = `%${query}%`;

    const sql = `
      SELECT id, region_name
      FROM vodovod_regions
      WHERE (region_name LIKE ? OR id LIKE ?)
      LIMIT ?, ?
    `;

    const items = await this.prismaLegacy.$queryRawUnsafe<any[]>(
      sql,
      searchQuery,
      searchQuery,
      offset,
      limit,
    );

    const countSql = `
      SELECT COUNT(*) as total
      FROM vodovod_regions
      WHERE (region_name LIKE ? OR id LIKE ?)
    `;

    const countResult = await this.prismaLegacy.$queryRawUnsafe<any[]>(
      countSql,
      searchQuery,
      searchQuery,
    );

    const totalRows = countResult[0]?.total || 0;
    const hasMore = offset + limit < totalRows;

    return {
      data: items.map((item) => `${item.id} | ${item.region_name}`),
      hasMore,
    };
  }

  async getAddressesForSL(
    data: { query?: string; pageNumber?: number; region_id?: number },
    limit = 30,
  ) {
    const query = data.query || '';
    const pageNumber = data.pageNumber || 0;
    const regionId = data.region_id || null;
    const offset = pageNumber * limit;
    const searchQuery = `%${query}%`;

    let whereClause = '(address_name LIKE ? OR id LIKE ?)';
    const params: any[] = [searchQuery, searchQuery];

    if (regionId) {
      whereClause += ' AND region_id = ?';
      params.push(regionId);
    }

    params.push(offset);
    params.push(limit);

    const sql = `
      SELECT id, address_name
      FROM ordering_addresses
      WHERE ${whereClause}
      LIMIT ?, ?
    `;

    const items = await this.prismaLegacy.$queryRawUnsafe<any[]>(sql, ...params);

    const countParams: any[] = [searchQuery, searchQuery];
    if (regionId) {
      countParams.push(regionId);
    }

    const countSql = `
      SELECT COUNT(*) as total
      FROM ordering_addresses
      WHERE ${whereClause}
    `;

    const countResult = await this.prismaLegacy.$queryRawUnsafe<any[]>(
      countSql,
      ...countParams,
    );

    const totalRows = countResult[0]?.total || 0;
    const hasMore = offset + limit < totalRows;

    return {
      data: items.map((item) => `${item.id} | ${item.address_name}`),
      hasMore,
    };
  }

  async assignReaderRegion(reader_id: number, region_ids: number[]) {
    try {
      for (const region_id of region_ids) {
        const query =
          'INSERT INTO vodovod_reader_regions (reader_id, region_id) VALUES (?, ?)';
        await this.prismaLegacy.$executeRawUnsafe(query, reader_id, region_id);
      }
      return true;
    } catch (error) {
      console.error('assignReaderRegion error:', error);
      return false;
    }
  }

  async assignReaderAddress(reader_id: number, address_ids: number[]) {
    try {
      for (const address_id of address_ids) {
        const query =
          'INSERT INTO vodovod_reader_addresses (reader_id, address_id) VALUES (?, ?)';
        await this.prismaLegacy.$executeRawUnsafe(
          query,
          reader_id,
          address_id,
        );
      }
      return true;
    } catch (error) {
      console.error('assignReaderAddress error:', error);
      return false;
    }
  }

  async removeReaderRegion(reader_id: number, region_id: number) {
    try {
      const query =
        'DELETE FROM vodovod_reader_regions WHERE reader_id = ? AND region_id = ?';
      await this.prismaLegacy.$executeRawUnsafe(query, reader_id, region_id);
      return true;
    } catch (error) {
      console.error('removeReaderRegion error:', error);
      return false;
    }
  }

  async removeReaderAddress(reader_id: number, address_id: number) {
    try {
      const query =
        'DELETE FROM vodovod_reader_addresses WHERE reader_id = ? AND address_id = ?';
      await this.prismaLegacy.$executeRawUnsafe(query, reader_id, address_id);
      return true;
    } catch (error) {
      console.error('removeReaderAddress error:', error);
      return false;
    }
  }

  async create(createDto: CreateWaterReaderDto) {
    try {
      const query =
        'INSERT INTO vodovod_readers (first_name, last_name, employee_code) VALUES (?, ?, ?)';
      const result = await this.prismaLegacy.$executeRawUnsafe(
        query,
        createDto.first_name,
        createDto.last_name,
        createDto.employee_code,
      );

      // Get the inserted ID
      const idResult = await this.prismaLegacy.$queryRawUnsafe<any[]>(
        'SELECT LAST_INSERT_ID() as id',
      );
      const insertedId = idResult[0].id;

      if (createDto.region_ids && createDto.region_ids.length > 0) {
        await this.assignReaderRegion(insertedId, createDto.region_ids);
      }

      if (createDto.address_ids && createDto.address_ids.length > 0) {
        await this.assignReaderAddress(insertedId, createDto.address_ids);
      }

      const row = await this.findOne(insertedId);

      return {
        success: true,
        message: 'Successful!',
        data: row,
      };
    } catch (error) {
      console.error('error when adding the row:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async update(id: number, updateDto: UpdateWaterReaderDto) {
    const fields = Object.keys(updateDto).filter(
      (key) => updateDto[key] !== undefined,
    );

    if (fields.length === 0) {
      return { success: false };
    }

    const setParts = fields.map((field) => `${field} = ?`);
    const setClause = setParts.join(', ');
    const values = fields.map((field) => updateDto[field]);
    values.push(id);

    const query = `UPDATE vodovod_readers SET ${setClause} WHERE id = ?`;

    try {
      await this.prismaLegacy.$executeRawUnsafe(query, ...values);
      const row = await this.findOne(id);
      return {
        success: true,
        data: row,
      };
    } catch (error) {
      console.error('error when updating the row:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async delete(id: number) {
    try {
      const query = 'DELETE FROM vodovod_readers WHERE id = ?';
      await this.prismaLegacy.$executeRawUnsafe(query, id);
      return true;
    } catch (error) {
      console.error('error when deleting the row:', error);
      return false;
    }
  }
}
