import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaLegacyService } from '../prisma-legacy/prisma-legacy.service';
import { CreateWaterMeterTypeDto } from './dto/create-water-meter-type.dto';
import { UpdateWaterMeterTypeDto } from './dto/update-water-meter-type.dto';

@Injectable()
export class WaterMeterTypesService {
  constructor(private legacyDb: PrismaLegacyService) {}

  async findAll() {
    const result = await this.legacyDb.$queryRawUnsafe<Array<{ id: number; type: string }>>(
      `SELECT id, type FROM vodovod_water_meter_type ORDER BY id DESC`
    );
    return result;
  }

  async findOne(id: number) {
    const result = await this.legacyDb.$queryRawUnsafe<Array<{ id: number; type: string }>>(
      `SELECT id, type FROM vodovod_water_meter_type WHERE id = ?`,
      id
    );

    if (!result || result.length === 0) {
      throw new NotFoundException(`Tip vodomera sa ID ${id} nije pronađen`);
    }

    return result[0];
  }

  async create(createWaterMeterTypeDto: CreateWaterMeterTypeDto) {
    try {
      await this.legacyDb.$executeRawUnsafe(
        `INSERT INTO vodovod_water_meter_type (type) VALUES (?)`,
        createWaterMeterTypeDto.type
      );
      return this.findAll();
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        throw new ConflictException('Tip vodomera već postoji');
      }
      throw error;
    }
  }

  async update(id: number, updateWaterMeterTypeDto: UpdateWaterMeterTypeDto) {
    await this.findOne(id);

    try {
      await this.legacyDb.$executeRawUnsafe(
        `UPDATE vodovod_water_meter_type SET type = ? WHERE id = ?`,
        updateWaterMeterTypeDto.type,
        id
      );
      return this.findOne(id);
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        throw new ConflictException('Tip vodomera već postoji');
      }
      throw error;
    }
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.legacyDb.$executeRawUnsafe(
      `DELETE FROM vodovod_water_meter_type WHERE id = ?`,
      id
    );
    return { success: true };
  }

  async searchForList(query: string = '', pageNumber: number = 0, limit: number = 50) {
    const offset = pageNumber * limit;
    const searchQuery = `%${query}%`;

    const [data, total] = await Promise.all([
      this.legacyDb.$queryRawUnsafe<Array<{ id: number; type: string }>>(
        `SELECT id, TRIM(type) AS type
         FROM vodovod_water_meter_type
         WHERE type LIKE ? OR CAST(id AS CHAR) LIKE ?
         ORDER BY id
         LIMIT ? OFFSET ?`,
        searchQuery,
        searchQuery,
        limit,
        offset,
      ),
      this.legacyDb.$queryRawUnsafe<Array<{ total: bigint }>>(
        `SELECT COUNT(*) as total
         FROM vodovod_water_meter_type
         WHERE type LIKE ? OR CAST(id AS CHAR) LIKE ?`,
        searchQuery,
        searchQuery,
      ),
    ]);

    const totalRows = Number(total[0]?.total ?? 0);
    const hasMore = offset + limit < totalRows;

    return {
      data: data.map((row) => `${row.id} | ${row.type}`),
      hasMore,
    };
  }
}
