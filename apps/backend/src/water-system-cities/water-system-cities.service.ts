import { Injectable } from '@nestjs/common';
import { PrismaLegacyService } from '../prisma-legacy/prisma-legacy.service';
import { CreateWaterSystemCityDto } from './dto/create-water-system-city.dto';
import { UpdateWaterSystemCityDto } from './dto/update-water-system-city.dto';
import { WaterSystemCity } from './entities/water-system-city.entity';

@Injectable()
export class WaterSystemCitiesService {
  constructor(private prismaLegacy: PrismaLegacyService) {}

  async findAll(): Promise<WaterSystemCity[]> {
    const result = await this.prismaLegacy.$queryRawUnsafe<WaterSystemCity[]>(
      `SELECT id, cities_name, cities_zip_code,
              CAST(edit_datetime AS CHAR) as edit_datetime,
              edit_user_id
       FROM ordering_cities
       ORDER BY id DESC`
    );
    return result;
  }

  async findOne(id: number): Promise<WaterSystemCity | null> {
    const result = await this.prismaLegacy.$queryRawUnsafe<WaterSystemCity[]>(
      `SELECT id, cities_name, cities_zip_code,
              CAST(edit_datetime AS CHAR) as edit_datetime,
              edit_user_id
       FROM ordering_cities
       WHERE id = ?`,
      id
    );
    return result[0] || null;
  }

  async create(createDto: CreateWaterSystemCityDto): Promise<WaterSystemCity> {
    const fields: string[] = [];
    const values: any[] = [];

    if (createDto.cities_name !== undefined) {
      fields.push('cities_name');
      values.push(createDto.cities_name);
    }
    if (createDto.cities_zip_code !== undefined) {
      fields.push('cities_zip_code');
      values.push(createDto.cities_zip_code);
    }

    const placeholders = fields.map(() => '?').join(', ');
    const query = `INSERT INTO ordering_cities (${fields.join(', ')}) VALUES (${placeholders})`;

    await this.prismaLegacy.$executeRawUnsafe(query, ...values);

    const result = await this.prismaLegacy.$queryRawUnsafe<{ id: number }[]>(
      'SELECT LAST_INSERT_ID() as id'
    );

    const city = await this.findOne(result[0].id);
    if (!city) {
      throw new Error('Failed to create city');
    }
    return city;
  }

  async update(id: number, updateDto: UpdateWaterSystemCityDto): Promise<WaterSystemCity> {
    const fields: string[] = [];
    const values: any[] = [];

    if (updateDto.cities_name !== undefined) {
      fields.push('cities_name = ?');
      values.push(updateDto.cities_name);
    }
    if (updateDto.cities_zip_code !== undefined) {
      fields.push('cities_zip_code = ?');
      values.push(updateDto.cities_zip_code);
    }

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    const query = `UPDATE ordering_cities SET ${fields.join(', ')} WHERE id = ?`;
    values.push(id);

    await this.prismaLegacy.$executeRawUnsafe(query, ...values);

    const city = await this.findOne(id);
    if (!city) {
      throw new Error('City not found');
    }
    return city;
  }

  async remove(id: number): Promise<boolean> {
    await this.prismaLegacy.$executeRawUnsafe(
      'DELETE FROM ordering_cities WHERE id = ?',
      id
    );
    return true;
  }

  async bulkInsert(data: CreateWaterSystemCityDto[]): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      await this.prismaLegacy.$transaction(async (tx) => {
        for (const row of data) {
          const fields: string[] = [];
          const values: any[] = [];

          if (row.cities_name !== undefined) {
            fields.push('cities_name');
            values.push(row.cities_name);
          }
          if (row.cities_zip_code !== undefined) {
            fields.push('cities_zip_code');
            values.push(row.cities_zip_code);
          }

          const placeholders = fields.map(() => '?').join(', ');
          const query = `INSERT INTO ordering_cities (${fields.join(', ')}) VALUES (${placeholders})`;

          await tx.$executeRawUnsafe(query, ...values);
        }
      });

      return { success: true, message: 'bulk insert was successful!' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async exportCSV(): Promise<WaterSystemCity[]> {
    return this.findAll();
  }
}
