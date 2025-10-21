import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaLegacyService } from '../prisma-legacy/prisma-legacy.service';
import { CreateCashierDto } from './dto/create-cashier.dto';
import { UpdateCashierDto } from './dto/update-cashier.dto';

@Injectable()
export class CashiersService {
  constructor(private legacyDb: PrismaLegacyService) {}

  async getAll() {
    const query = `
      SELECT vc.*, cc.crm_contacts_first_name, cc.crm_contacts_last_name,
        vcr.naziv AS naziv_kase, vcr.status
      FROM vodovod_cashiers vc
      LEFT JOIN crm_contacts cc ON cc.id = vc.crm_contact_id
      LEFT JOIN vodovod_cash_register vcr ON vcr.id = vc.kasa_id
    `;

    const result = await this.legacyDb.$queryRawUnsafe<any[]>(query);
    return result;
  }

  async getById(id: number) {
    const query = `
      SELECT vc.*, cc.crm_contacts_first_name, cc.crm_contacts_last_name,
        vcr.naziv AS naziv_kase, vcr.status
      FROM vodovod_cashiers vc
      LEFT JOIN crm_contacts cc ON cc.id = vc.crm_contact_id
      LEFT JOIN vodovod_cash_register vcr ON vcr.id = vc.kasa_id
      WHERE vc.id = ?
    `;

    const result = await this.legacyDb.$queryRawUnsafe<any[]>(query, id);

    if (!result || result.length === 0) {
      throw new NotFoundException(`Blagajnik sa ID ${id} nije pronađen`);
    }

    return result[0];
  }

  async create(createDto: CreateCashierDto) {
    try {
      const query = `
        INSERT INTO vodovod_cashiers (crm_contact_id, kasa_id)
        VALUES (?, ?)
      `;

      await this.legacyDb.$executeRawUnsafe(
        query,
        createDto.crm_contact_id,
        createDto.kasa_id,
      );

      const lastInsertId = await this.legacyDb.$queryRawUnsafe<Array<{ id: bigint }>>(
        `SELECT LAST_INSERT_ID() as id`,
      );

      const insertedId = Number(lastInsertId[0]?.id);

      if (!insertedId) {
        throw new Error('Greška pri dobijanju ID-a unesenog reda');
      }

      const row = await this.getById(insertedId);

      return {
        success: true,
        message: 'Uspešno!',
        data: row,
      };
    } catch (error) {
      console.error('Greška pri kreiranju blagajnika:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async update(id: number, updateDto: UpdateCashierDto) {
    await this.getById(id);

    try {
      const query = `
        UPDATE vodovod_cashiers
        SET crm_contact_id = ?, kasa_id = ?
        WHERE id = ?
      `;

      await this.legacyDb.$executeRawUnsafe(
        query,
        updateDto.crm_contact_id,
        updateDto.kasa_id,
        id,
      );

      const row = await this.getById(id);

      return {
        success: true,
        message: 'Uspešno!',
        data: row,
      };
    } catch (error) {
      console.error('Greška pri izmeni blagajnika:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async delete(id: number) {
    const query = `DELETE FROM vodovod_cashiers WHERE id = ?`;

    const result = await this.legacyDb.$executeRawUnsafe(query, id);

    if (result === 0) {
      throw new NotFoundException(`Nije pronađen red za ID: ${id}`);
    }

    return {
      success: true,
      message: 'Red je uspešno obrisan.',
    };
  }

  async getUnusedCashierCrmContactsForSL(dto: { query?: string; pageNumber?: number }) {
    const limit = 20;
    const offset = (dto.pageNumber ?? 0) * limit;
    const searchQuery = `%${dto.query ?? ''}%`;

    const sql = `
      SELECT
        cc.id,
        cc.sifra_potrosaca,
        cc.sifra_kupca,
        CONCAT(cc.crm_contacts_first_name, ' ', cc.crm_contacts_last_name) AS name
      FROM crm_contacts cc
      LEFT JOIN vodovod_cashiers vc ON vc.crm_contact_id = cc.id
      WHERE
        (
          vc.crm_contact_id IS NULL AND
          (
            CONCAT(cc.crm_contacts_first_name, ' ', cc.crm_contacts_last_name) LIKE ?
            OR cc.id LIKE ?
            OR cc.sifra_potrosaca LIKE ?
            OR cc.sifra_kupca LIKE ?
          )
        )
      ORDER BY cc.id
      LIMIT ?, ?
    `;

    const results = await this.legacyDb.$queryRawUnsafe<any[]>(
      sql,
      searchQuery,
      searchQuery,
      searchQuery,
      searchQuery,
      offset,
      limit,
    );

    const out = results.map((row) => {
      let value = `ID: ${row.id}`;
      if (row.sifra_potrosaca) {
        value += ` | Potrošač: ${row.sifra_potrosaca}`;
      }
      if (row.sifra_kupca) {
        value += ` | Kupac: ${row.sifra_kupca}`;
      }
      value += ` | ${row.name}`;
      return value;
    });

    const countSql = `
      SELECT COUNT(*) as total
      FROM crm_contacts cc
      LEFT JOIN vodovod_cashiers vc ON vc.crm_contact_id = cc.id
      WHERE
        (
          vc.crm_contact_id IS NULL AND
          (
            CONCAT(cc.crm_contacts_first_name, ' ', cc.crm_contacts_last_name) LIKE ?
            OR cc.id LIKE ?
            OR cc.sifra_potrosaca LIKE ?
            OR cc.sifra_kupca LIKE ?
          )
        )
    `;

    const countResult = await this.legacyDb.$queryRawUnsafe<Array<{ total: bigint }>>(
      countSql,
      searchQuery,
      searchQuery,
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
}
