import { Injectable } from '@nestjs/common';
import { PrismaLegacyService } from '../prisma-legacy/prisma-legacy.service';
import { CreateWaterSystemRegionDto } from './dto/create-water-system-region.dto';
import { UpdateWaterSystemRegionDto } from './dto/update-water-system-region.dto';
import { WaterSystemRegion } from './entities/water-system-region.entity';

@Injectable()
export class WaterSystemRegionsService {
  constructor(private prismaLegacy: PrismaLegacyService) {}

  async findAll(): Promise<WaterSystemRegion[]> {
    const result = await this.prismaLegacy.$queryRawUnsafe<WaterSystemRegion[]>(
      'SELECT * FROM vodovod_regions ORDER BY id DESC'
    );
    return result;
  }

  async findOne(id: number): Promise<WaterSystemRegion | null> {
    const result = await this.prismaLegacy.$queryRawUnsafe<WaterSystemRegion[]>(
      'SELECT * FROM vodovod_regions WHERE id = ?',
      id
    );
    return result[0] || null;
  }

  async create(createDto: CreateWaterSystemRegionDto): Promise<WaterSystemRegion> {
    await this.prismaLegacy.$executeRawUnsafe(
      'INSERT INTO vodovod_regions (region_name) VALUES (?)',
      createDto.region_name
    );

    const result = await this.prismaLegacy.$queryRawUnsafe<{ id: number }[]>(
      'SELECT LAST_INSERT_ID() as id'
    );

    const region = await this.findOne(result[0].id);
    if (!region) {
      throw new Error('Failed to create region');
    }
    return region;
  }

  async update(id: number, updateDto: UpdateWaterSystemRegionDto): Promise<WaterSystemRegion> {
    await this.prismaLegacy.$executeRawUnsafe(
      'UPDATE vodovod_regions SET region_name = ? WHERE id = ?',
      updateDto.region_name,
      id
    );

    const region = await this.findOne(id);
    if (!region) {
      throw new Error('Region not found');
    }
    return region;
  }

  async remove(id: number): Promise<boolean> {
    // Prvo ukloni region_id iz svih povezanih ulica
    await this.prismaLegacy.$executeRawUnsafe(
      'UPDATE ordering_addresses SET region_id = NULL WHERE region_id = ?',
      id
    );

    // Zatim obriši rejon
    await this.prismaLegacy.$executeRawUnsafe(
      'DELETE FROM vodovod_regions WHERE id = ?',
      id
    );

    return true;
  }

  async getStreetsByRegion(regionId: number) {
    const result = await this.prismaLegacy.$queryRawUnsafe(
      `SELECT oa.*, oc.cities_name FROM ordering_addresses oa
       LEFT JOIN ordering_cities oc ON oa.city_id = oc.id
       WHERE oa.region_id = ?
       ORDER BY oa.id DESC`,
      regionId
    );
    return result;
  }

  async removeStreet(streetId: number): Promise<boolean> {
    await this.prismaLegacy.$executeRawUnsafe(
      'UPDATE ordering_addresses SET region_id = NULL WHERE id = ?',
      streetId
    );
    return true;
  }

  async getRegionsForSL(query: string = '', pageNumber: number = 0, limit: number = 50) {
    const offset = pageNumber * limit;
    const searchQuery = `%${query}%`;

    const data = await this.prismaLegacy.$queryRawUnsafe<{ id: number; region_name: string }[]>(
      `SELECT id, region_name FROM vodovod_regions
       WHERE (region_name LIKE ? OR id LIKE ?)
       ORDER BY id
       LIMIT ? OFFSET ?`,
      searchQuery,
      searchQuery,
      limit,
      offset
    );

    const countResult = await this.prismaLegacy.$queryRawUnsafe<{ total: bigint }[]>(
      `SELECT COUNT(*) as total FROM vodovod_regions
       WHERE (region_name LIKE ? OR id LIKE ?)`,
      searchQuery,
      searchQuery
    );

    const totalRows = Number(countResult[0].total);
    const hasMore = offset + limit < totalRows;

    return {
      data: data.map((row) => `${row.id} | ${row.region_name}`),
      hasMore,
    };
  }

  async bulkInsert(data: CreateWaterSystemRegionDto[]): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      await this.prismaLegacy.$transaction(async (tx) => {
        for (const row of data) {
          await tx.$executeRawUnsafe(
            'INSERT INTO vodovod_regions (region_name) VALUES (?)',
            row.region_name
          );
        }
      });

      return { success: true, message: 'bulk insert was successful!' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async exportCSV(): Promise<WaterSystemRegion[]> {
    return this.findAll();
  }
}
