import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaLegacyService } from '../prisma-legacy/prisma-legacy.service';
import { CreateWaterMeterAvailabilityDto } from './dto/create-water-meter-availability.dto';
import { UpdateWaterMeterAvailabilityDto } from './dto/update-water-meter-availability.dto';

@Injectable()
export class WaterMeterAvailabilityService {
  constructor(private legacyDb: PrismaLegacyService) {}

  async findAll() {
    const result = await this.legacyDb.$queryRawUnsafe<Array<{ id: number; availability: string }>>(
      `SELECT id, availability FROM vodovod_water_meter_availability ORDER BY id DESC`
    );
    return result;
  }

  async findOne(id: number) {
    const result = await this.legacyDb.$queryRawUnsafe<Array<{ id: number; availability: string }>>(
      `SELECT id, availability FROM vodovod_water_meter_availability WHERE id = ?`,
      id
    );

    if (!result || result.length === 0) {
      throw new NotFoundException(`Dostupnost sa ID ${id} nije pronađena`);
    }

    return result[0];
  }

  async create(createDto: CreateWaterMeterAvailabilityDto) {
    try {
      await this.legacyDb.$executeRawUnsafe(
        `INSERT INTO vodovod_water_meter_availability (availability) VALUES (?)`,
        createDto.availability
      );
      return this.findAll();
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        throw new ConflictException('Dostupnost već postoji');
      }
      throw error;
    }
  }

  async update(id: number, updateDto: UpdateWaterMeterAvailabilityDto) {
    await this.findOne(id);

    try {
      await this.legacyDb.$executeRawUnsafe(
        `UPDATE vodovod_water_meter_availability SET availability = ? WHERE id = ?`,
        updateDto.availability,
        id
      );
      return this.findAll(); // Vraća kompletnu sortiranu listu
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        throw new ConflictException('Dostupnost već postoji');
      }
      throw error;
    }
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.legacyDb.$executeRawUnsafe(
      `DELETE FROM vodovod_water_meter_availability WHERE id = ?`,
      id
    );
    return { success: true };
  }

  async searchForList(query: string = '', pageNumber: number = 0, limit: number = 50) {
    const offset = pageNumber * limit;
    const searchQuery = `%${query}%`;

    const [data, total] = await Promise.all([
      this.legacyDb.$queryRawUnsafe<Array<{ id: number; availability: string }>>(
        `SELECT id, TRIM(availability) AS availability
         FROM vodovod_water_meter_availability
         WHERE availability LIKE ? OR CAST(id AS CHAR) LIKE ?
         ORDER BY id
         LIMIT ? OFFSET ?`,
        searchQuery,
        searchQuery,
        limit,
        offset,
      ),
      this.legacyDb.$queryRawUnsafe<Array<{ total: bigint }>>(
        `SELECT COUNT(*) as total
         FROM vodovod_water_meter_availability
         WHERE availability LIKE ? OR CAST(id AS CHAR) LIKE ?`,
        searchQuery,
        searchQuery,
      ),
    ]);

    const totalRows = Number(total[0]?.total ?? 0);
    const hasMore = offset + limit < totalRows;

    return {
      data: data.map((row) => `${row.id} | ${row.availability}`),
      hasMore,
    };
  }
}
