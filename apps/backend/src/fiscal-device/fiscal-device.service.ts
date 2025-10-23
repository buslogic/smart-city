import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaLegacyService } from '../prisma-legacy/prisma-legacy.service';
import { CreateFiscalDeviceDto } from './dto/create-fiscal-device.dto';
import { UpdateFiscalDeviceDto } from './dto/update-fiscal-device.dto';
import { SearchDto } from './dto/search-fiscal-device.dto';

@Injectable()
export class FiscalDeviceService {
  constructor(private legacyDb: PrismaLegacyService) {}

  async getRows() {
    const query = `
      SELECT fd.*,
        CONCAT(ss.id, ' | ', ss.naziv) as status
      FROM vodovod_fiscal_device fd
      LEFT JOIN vodovod_subsidies_status ss ON fd.status = ss.id
      WHERE fd.status = 1
      ORDER BY fd.id DESC
    `;

    const result = await this.legacyDb.$queryRawUnsafe<any[]>(query);
    return result;
  }

  async getStatusForSL(dto: SearchDto) {
    const limit = 20;
    const offset = (dto.pageNumber ?? 0) * limit;
    const searchQuery = `%${dto.query ?? ''}%`;

    const sql = `
      SELECT ss.id, ss.naziv as status
      FROM vodovod_subsidies_status ss
      WHERE (ss.naziv LIKE ? OR ss.id LIKE ?)
      ORDER BY ss.id
      LIMIT ?, ?
    `;

    const results = await this.legacyDb.$queryRawUnsafe<any[]>(
      sql,
      searchQuery,
      searchQuery,
      offset,
      limit,
    );

    const out = results.map((row) => `${row.id} | ${row.status}`);

    const countSql = `
      SELECT COUNT(*) as total
      FROM vodovod_subsidies_status ss
      WHERE (ss.naziv LIKE ? OR ss.id LIKE ?)
    `;

    const countResult = await this.legacyDb.$queryRawUnsafe<Array<{ total: bigint }>>(
      countSql,
      searchQuery,
      searchQuery,
    );

    const totalRows = Number(countResult[0]?.total || 0);
    const hasMore = offset + limit < totalRows;

    return {
      data: out,
      hasMore,
    };
  }

  async getRowById(id: number) {
    const query = `
      SELECT fd.*,
        CONCAT(ss.id, ' | ', ss.naziv) as status
      FROM vodovod_fiscal_device fd
      LEFT JOIN vodovod_subsidies_status ss ON fd.status = ss.id
      WHERE fd.id = ?
    `;

    const result = await this.legacyDb.$queryRawUnsafe<any[]>(query, id);

    if (!result || result.length === 0) {
      throw new NotFoundException(`Fiskalni uređaj sa ID ${id} nije pronađen`);
    }

    return result[0];
  }

  async create(createDto: CreateFiscalDeviceDto, userId: number) {
    try {
      const extractId = (value: string): number | null => {
        if (!value) return null;
        // Format: "1 | Naziv" or just "1"
        const parts = value.split('|');
        const id = parts[0].trim();
        return id ? parseInt(id, 10) : null;
      };

      const statusId = createDto.status ? extractId(createDto.status) : 1;

      const poslednjaSinhronizacija = createDto.poslednja_sinhronizacija
        ? new Date(createDto.poslednja_sinhronizacija).toISOString().slice(0, 19).replace('T', ' ')
        : null;

      const query = `
        INSERT INTO vodovod_fiscal_device (naziv, model, krajnja_tacka, poslednja_sinhronizacija, status)
        VALUES (?, ?, ?, ?, ?)
      `;

      await this.legacyDb.$executeRawUnsafe(
        query,
        createDto.naziv,
        createDto.model || null,
        createDto.krajnja_tacka || null,
        poslednjaSinhronizacija,
        statusId,
      );

      const lastInsertId = await this.legacyDb.$queryRawUnsafe<Array<{ id: bigint }>>(
        `SELECT LAST_INSERT_ID() as id`,
      );

      const insertedId = Number(lastInsertId[0]?.id);

      if (!insertedId) {
        throw new Error('Greška pri dobijanju ID-a unesenog reda');
      }

      const row = await this.getRowById(insertedId);

      return {
        success: true,
        message: 'Uspešno!',
        data: row,
      };
    } catch (error) {
      console.error('Greška pri kreiranju fiskalnog uređaja:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async update(id: number, updateDto: UpdateFiscalDeviceDto, userId: number) {
    await this.getRowById(id);

    try {
      const extractId = (value: string): number | null => {
        if (!value) return null;
        // Format: "1 | Naziv" or just "1"
        const parts = value.split('|');
        const id = parts[0].trim();
        return id ? parseInt(id, 10) : null;
      };

      const statusId = updateDto.status ? extractId(updateDto.status) : null;

      const poslednjaSinhronizacija = updateDto.poslednja_sinhronizacija
        ? new Date(updateDto.poslednja_sinhronizacija).toISOString().slice(0, 19).replace('T', ' ')
        : null;

      const query = `
        UPDATE vodovod_fiscal_device SET
          naziv = ?,
          model = ?,
          krajnja_tacka = ?,
          poslednja_sinhronizacija = ?,
          status = ?
        WHERE id = ?
      `;

      await this.legacyDb.$executeRawUnsafe(
        query,
        updateDto.naziv,
        updateDto.model || null,
        updateDto.krajnja_tacka || null,
        poslednjaSinhronizacija,
        statusId,
        id,
      );

      const row = await this.getRowById(id);

      return {
        success: true,
        message: 'Uspešno!',
        data: row,
      };
    } catch (error) {
      console.error('Greška pri izmeni fiskalnog uređaja:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async delete(id: number) {
    const query = `UPDATE vodovod_fiscal_device SET status = 0 WHERE id = ?`;

    const result = await this.legacyDb.$executeRawUnsafe(query, id);

    if (result === 0) {
      throw new NotFoundException(`Nije pronađen red za ID: ${id}`);
    }

    return {
      success: true,
      message: 'Red je uspešno obrisan.',
    };
  }
}
