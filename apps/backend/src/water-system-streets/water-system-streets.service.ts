import { Injectable } from '@nestjs/common';
import { PrismaLegacyService } from '../prisma-legacy/prisma-legacy.service';
import { CreateWaterSystemStreetDto } from './dto/create-water-system-street.dto';
import { UpdateWaterSystemStreetDto } from './dto/update-water-system-street.dto';
import { WaterSystemStreet } from './entities/water-system-street.entity';

@Injectable()
export class WaterSystemStreetsService {
  constructor(private prismaLegacy: PrismaLegacyService) {}

  async findAll(): Promise<WaterSystemStreet[]> {
    const result = await this.prismaLegacy.$queryRawUnsafe<WaterSystemStreet[]>(
      `SELECT oa.id, oa.city_id, oa.address_name, oa.address_number, oa.official_address_code,
              oa.region_id, oa.active, oc.cities_name, vr.region_name
       FROM ordering_addresses AS oa
       LEFT JOIN ordering_cities AS oc ON oc.id = oa.city_id
       LEFT JOIN vodovod_regions AS vr ON vr.id = oa.region_id
       ORDER BY oa.id DESC`
    );
    return result;
  }

  async findOne(id: number): Promise<WaterSystemStreet | null> {
    const result = await this.prismaLegacy.$queryRawUnsafe<WaterSystemStreet[]>(
      `SELECT oa.id, oa.city_id, oa.address_name, oa.address_number, oa.official_address_code,
              oa.region_id, oa.active, oc.cities_name, vr.region_name
       FROM ordering_addresses AS oa
       LEFT JOIN ordering_cities AS oc ON oc.id = oa.city_id
       LEFT JOIN vodovod_regions AS vr ON vr.id = oa.region_id
       WHERE oa.id = ?`,
      id
    );
    return result[0] || null;
  }

  async create(createDto: CreateWaterSystemStreetDto): Promise<WaterSystemStreet> {
    const fields: string[] = [];
    const values: any[] = [];

    if (createDto.city_id !== undefined) {
      fields.push('city_id');
      values.push(createDto.city_id);
    }
    if (createDto.address_name !== undefined) {
      fields.push('address_name');
      values.push(createDto.address_name);
    }
    if (createDto.address_number !== undefined && createDto.address_number !== null) {
      fields.push('address_number');
      values.push(createDto.address_number);
    }
    if (createDto.official_address_code !== undefined && createDto.official_address_code !== null) {
      fields.push('official_address_code');
      values.push(createDto.official_address_code);
    }
    if (createDto.region_id !== undefined && createDto.region_id !== null) {
      fields.push('region_id');
      values.push(createDto.region_id);
    }
    if (createDto.active !== undefined) {
      fields.push('active');
      values.push(createDto.active);
    } else {
      fields.push('active');
      values.push(1);
    }

    const placeholders = fields.map(() => '?').join(', ');
    const query = `INSERT INTO ordering_addresses (${fields.join(', ')}) VALUES (${placeholders})`;

    await this.prismaLegacy.$executeRawUnsafe(query, ...values);

    const result = await this.prismaLegacy.$queryRawUnsafe<{ id: number }[]>(
      'SELECT LAST_INSERT_ID() as id'
    );

    const street = await this.findOne(result[0].id);
    if (!street) {
      throw new Error('Failed to create street');
    }
    return street;
  }

  async update(id: number, updateDto: UpdateWaterSystemStreetDto): Promise<WaterSystemStreet> {
    const fields: string[] = [];
    const values: any[] = [];

    if (updateDto.city_id !== undefined) {
      fields.push('city_id = ?');
      values.push(updateDto.city_id);
    }
    if (updateDto.address_name !== undefined) {
      fields.push('address_name = ?');
      values.push(updateDto.address_name);
    }
    if (updateDto.address_number !== undefined) {
      if (updateDto.address_number === null) {
        fields.push('address_number = NULL');
      } else {
        fields.push('address_number = ?');
        values.push(updateDto.address_number);
      }
    }
    if (updateDto.official_address_code !== undefined) {
      if (updateDto.official_address_code === null) {
        fields.push('official_address_code = NULL');
      } else {
        fields.push('official_address_code = ?');
        values.push(updateDto.official_address_code);
      }
    }
    if (updateDto.region_id !== undefined) {
      if (updateDto.region_id === null) {
        fields.push('region_id = NULL');
      } else {
        fields.push('region_id = ?');
        values.push(updateDto.region_id);
      }
    }
    if (updateDto.active !== undefined) {
      fields.push('active = ?');
      values.push(updateDto.active);
    }

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    const query = `UPDATE ordering_addresses SET ${fields.join(', ')} WHERE id = ?`;
    values.push(id);

    await this.prismaLegacy.$executeRawUnsafe(query, ...values);

    const street = await this.findOne(id);
    if (!street) {
      throw new Error('Street not found');
    }
    return street;
  }

  async remove(id: number): Promise<boolean> {
    await this.prismaLegacy.$executeRawUnsafe(
      'DELETE FROM ordering_addresses WHERE id = ?',
      id
    );
    return true;
  }

  async getAddressesForSL(query: string = '', pageNumber: number = 0, limit: number = 50) {
    const offset = pageNumber * limit;
    const searchQuery = `%${query}%`;

    const data = await this.prismaLegacy.$queryRawUnsafe<{ id: number; address_name: string }[]>(
      `SELECT id, TRIM(address_name) AS address_name FROM ordering_addresses
       WHERE (address_name LIKE ? OR id LIKE ?)
       ORDER BY id
       LIMIT ? OFFSET ?`,
      searchQuery,
      searchQuery,
      limit,
      offset
    );

    const countResult = await this.prismaLegacy.$queryRawUnsafe<{ total: bigint }[]>(
      `SELECT COUNT(*) as total FROM ordering_addresses
       WHERE (address_name LIKE ? OR id LIKE ?)`,
      searchQuery,
      searchQuery
    );

    const totalRows = Number(countResult[0].total);
    const hasMore = offset + limit < totalRows;

    return {
      data: data.map((row) => `${row.id} | ${row.address_name}`),
      hasMore,
    };
  }

  async getCitiesForSL(query: string = '', pageNumber: number = 0, limit: number = 50) {
    const offset = pageNumber * limit;
    const searchQuery = `%${query}%`;

    const data = await this.prismaLegacy.$queryRawUnsafe<{ id: number; cities_name: string }[]>(
      `SELECT id, cities_name FROM ordering_cities
       WHERE (cities_name LIKE ? OR id LIKE ?)
       ORDER BY id
       LIMIT ? OFFSET ?`,
      searchQuery,
      searchQuery,
      limit,
      offset
    );

    const countResult = await this.prismaLegacy.$queryRawUnsafe<{ total: bigint }[]>(
      `SELECT COUNT(*) as total FROM ordering_cities
       WHERE (cities_name LIKE ? OR id LIKE ?)`,
      searchQuery,
      searchQuery
    );

    const totalRows = Number(countResult[0].total);
    const hasMore = offset + limit < totalRows;

    return {
      data: data.map((row) => `${row.id} | ${row.cities_name}`),
      hasMore,
    };
  }

  async bulkInsert(data: CreateWaterSystemStreetDto[]): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      await this.prismaLegacy.$transaction(async (tx) => {
        for (const row of data) {
          const fields: string[] = [];
          const values: any[] = [];

          if (row.city_id !== undefined) {
            fields.push('city_id');
            values.push(row.city_id);
          }
          if (row.address_name !== undefined) {
            fields.push('address_name');
            values.push(row.address_name);
          }
          if (row.address_number !== undefined && row.address_number !== null) {
            fields.push('address_number');
            values.push(row.address_number);
          }
          if (row.official_address_code !== undefined && row.official_address_code !== null) {
            fields.push('official_address_code');
            values.push(row.official_address_code);
          }
          if (row.region_id !== undefined && row.region_id !== null) {
            fields.push('region_id');
            values.push(row.region_id);
          }
          if (row.active !== undefined) {
            fields.push('active');
            values.push(row.active);
          } else {
            fields.push('active');
            values.push(1);
          }

          const placeholders = fields.map(() => '?').join(', ');
          const query = `INSERT INTO ordering_addresses (${fields.join(', ')}) VALUES (${placeholders})`;

          await tx.$executeRawUnsafe(query, ...values);
        }
      });

      return { success: true, message: 'bulk insert was successful!' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async exportCSV(): Promise<WaterSystemStreet[]> {
    return this.findAll();
  }
}
