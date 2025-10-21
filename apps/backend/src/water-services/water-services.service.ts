import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaLegacyService } from '../prisma-legacy/prisma-legacy.service';
import { CreateWaterServiceDto } from './dto/create-water-service.dto';
import { UpdateWaterServiceDto } from './dto/update-water-service.dto';

@Injectable()
export class WaterServicesService {
  constructor(private legacyDb: PrismaLegacyService) {}

  async findAll() {
    const result = await this.legacyDb.$queryRawUnsafe<
      Array<{ id: number; service: string | null; note: string | null; code: number | null }>
    >(`SELECT id, service, note, code FROM vodovod_service ORDER BY id DESC`);
    return result;
  }

  async findOne(id: number) {
    const result = await this.legacyDb.$queryRawUnsafe<
      Array<{ id: number; service: string | null; note: string | null; code: number | null }>
    >(
      `SELECT id, service, note, code FROM vodovod_service WHERE id = ?`,
      id,
    );

    if (!result || result.length === 0) {
      throw new NotFoundException(`Usluga sa ID ${id} nije pronađena`);
    }

    return result[0];
  }

  async create(createWaterServiceDto: CreateWaterServiceDto) {
    try {
      const { service, note, code } = createWaterServiceDto;

      // Pripremimo vrednosti, postavljajući NULL za nedefinisane vrednosti
      const noteValue = note ?? null;
      const codeValue = code ?? null;

      await this.legacyDb.$executeRawUnsafe(
        `INSERT INTO vodovod_service (service, note, code) VALUES (?, ?, ?)`,
        service,
        noteValue,
        codeValue,
      );

      // Dohvati poslednji uneti ID
      const lastInsertId = await this.legacyDb.$queryRawUnsafe<Array<{ id: number }>>(
        `SELECT LAST_INSERT_ID() as id`
      );

      const insertedId = lastInsertId[0]?.id;

      if (!insertedId) {
        throw new Error('Failed to get inserted ID');
      }

      return this.findOne(insertedId);
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        throw new ConflictException('Usluga već postoji');
      }
      throw error;
    }
  }

  async update(id: number, updateWaterServiceDto: UpdateWaterServiceDto) {
    await this.findOne(id);

    try {
      const { service, note, code } = updateWaterServiceDto;

      // Pripremimo vrednosti
      const serviceValue = service ?? null;
      const noteValue = note ?? null;
      const codeValue = code ?? null;

      await this.legacyDb.$executeRawUnsafe(
        `UPDATE vodovod_service SET service = ?, note = ?, code = ? WHERE id = ?`,
        serviceValue,
        noteValue,
        codeValue,
        id,
      );

      return this.findOne(id);
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        throw new ConflictException('Usluga već postoji');
      }
      throw error;
    }
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.legacyDb.$executeRawUnsafe(
      `DELETE FROM vodovod_service WHERE id = ?`,
      id,
    );
    return { success: true };
  }

  async searchForList(
    query: string = '',
    pageNumber: number = 0,
    limit: number = 50,
  ) {
    const offset = pageNumber * limit;
    const searchQuery = `%${query}%`;

    const [data, total] = await Promise.all([
      this.legacyDb.$queryRawUnsafe<Array<{ id: number; service: string }>>(
        `SELECT id, TRIM(service) AS service
         FROM vodovod_service
         WHERE service LIKE ? OR CAST(id AS CHAR) LIKE ?
         ORDER BY id
         LIMIT ? OFFSET ?`,
        searchQuery,
        searchQuery,
        limit,
        offset,
      ),
      this.legacyDb.$queryRawUnsafe<Array<{ total: bigint }>>(
        `SELECT COUNT(*) as total
         FROM vodovod_service
         WHERE service LIKE ? OR CAST(id AS CHAR) LIKE ?`,
        searchQuery,
        searchQuery,
      ),
    ]);

    const totalRows = Number(total[0]?.total ?? 0);
    const hasMore = offset + limit < totalRows;

    return {
      data: data.map((row) => `${row.id} | ${row.service}`),
      hasMore,
    };
  }
}
