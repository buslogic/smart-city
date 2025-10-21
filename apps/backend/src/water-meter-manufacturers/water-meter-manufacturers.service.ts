import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaLegacyService } from '../prisma-legacy/prisma-legacy.service';
import { CreateWaterMeterManufacturerDto } from './dto/create-water-meter-manufacturer.dto';
import { UpdateWaterMeterManufacturerDto } from './dto/update-water-meter-manufacturer.dto';
import { SearchManufacturerDto } from './dto/search-manufacturer.dto';

@Injectable()
export class WaterMeterManufacturersService {
  constructor(private legacyDb: PrismaLegacyService) {}

  private readonly PAGE_LIMIT = 50;

  async findAll() {
    const result = await this.legacyDb.$queryRawUnsafe<Array<{ id: number; manufacturer: string }>>(
      `SELECT id, manufacturer FROM vodovod_water_meter_manufacturer ORDER BY id DESC`
    );
    return result;
  }

  async findOne(id: number) {
    const result = await this.legacyDb.$queryRawUnsafe<Array<{ id: number; manufacturer: string }>>(
      `SELECT id, manufacturer FROM vodovod_water_meter_manufacturer WHERE id = ?`,
      id
    );

    if (!result || result.length === 0) {
      throw new NotFoundException(`Proizvođač sa ID ${id} nije pronađen`);
    }

    return result[0];
  }

  async create(createDto: CreateWaterMeterManufacturerDto) {
    try {
      await this.legacyDb.$executeRawUnsafe(
        `INSERT INTO vodovod_water_meter_manufacturer (manufacturer) VALUES (?)`,
        createDto.manufacturer
      );
      return this.findAll();
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        throw new ConflictException('Proizvođač već postoji');
      }
      throw error;
    }
  }

  async update(id: number, updateDto: UpdateWaterMeterManufacturerDto) {
    await this.findOne(id);

    try {
      await this.legacyDb.$executeRawUnsafe(
        `UPDATE vodovod_water_meter_manufacturer SET manufacturer = ? WHERE id = ?`,
        updateDto.manufacturer,
        id
      );
      return this.findAll(); // Vraća kompletnu sortiranu listu
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        throw new ConflictException('Proizvođač već postoji');
      }
      throw error;
    }
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.legacyDb.$executeRawUnsafe(
      `DELETE FROM vodovod_water_meter_manufacturer WHERE id = ?`,
      id
    );
    return { success: true };
  }

  async searchForList(searchDto: SearchManufacturerDto) {
    const { query = '', pageNumber = 0 } = searchDto;
    const offset = pageNumber * this.PAGE_LIMIT;
    const searchQuery = `%${query}%`;

    const [data, total] = await Promise.all([
      this.legacyDb.$queryRawUnsafe<Array<{ id: number; manufacturer: string }>>(
        `SELECT id, TRIM(manufacturer) AS manufacturer
         FROM vodovod_water_meter_manufacturer
         WHERE manufacturer LIKE ? OR CAST(id AS CHAR) LIKE ?
         ORDER BY id
         LIMIT ? OFFSET ?`,
        searchQuery,
        searchQuery,
        this.PAGE_LIMIT,
        offset,
      ),
      this.legacyDb.$queryRawUnsafe<Array<{ total: bigint }>>(
        `SELECT COUNT(*) as total
         FROM vodovod_water_meter_manufacturer
         WHERE manufacturer LIKE ? OR CAST(id AS CHAR) LIKE ?`,
        searchQuery,
        searchQuery,
      ),
    ]);

    const totalRows = Number(total[0]?.total ?? 0);
    const hasMore = offset + this.PAGE_LIMIT < totalRows;

    return {
      data: data.map((row) => `${row.id} | ${row.manufacturer}`),
      hasMore,
    };
  }
}
