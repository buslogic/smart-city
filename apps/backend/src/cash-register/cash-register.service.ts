import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaLegacyService } from '../prisma-legacy/prisma-legacy.service';
import { CreateCashRegisterDto } from './dto/create-cash-register.dto';
import { UpdateCashRegisterDto } from './dto/update-cash-register.dto';
import { SearchDto } from './dto/search-cash-register.dto';

@Injectable()
export class CashRegisterService {
  constructor(private legacyDb: PrismaLegacyService) {}

  async getRows() {
    const query = `
      SELECT cr.*,
        CONCAT(ss.id, ' | ', ss.naziv) as status,
        CONCAT(oa.id, ' | ', oa.address_name) as adresa,
        CONCAT(fd.id, ' | ', fd.naziv) as fiscal_device
      FROM vodovod_cash_register cr
      LEFT JOIN ordering_addresses oa ON oa.id = cr.adresa_id
      LEFT JOIN vodovod_subsidies_status ss ON cr.status = ss.id
      LEFT JOIN vodovod_fiscal_device fd ON fd.id = cr.fiscal_device_id
      WHERE cr.status = 1
      ORDER BY cr.id DESC
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

  async getFiscalDeviceForSL(dto: SearchDto) {
    const limit = 20;
    const offset = (dto.pageNumber ?? 0) * limit;
    const searchQuery = `%${dto.query ?? ''}%`;

    const sql = `
      SELECT fd.id, fd.naziv as fiscal_device
      FROM vodovod_fiscal_device fd
      WHERE (fd.naziv LIKE ? OR fd.id LIKE ?)
      ORDER BY fd.id
      LIMIT ?, ?
    `;

    const results = await this.legacyDb.$queryRawUnsafe<any[]>(
      sql,
      searchQuery,
      searchQuery,
      offset,
      limit,
    );

    const out = results.map((row) => `${row.id} | ${row.fiscal_device}`);

    const countSql = `
      SELECT COUNT(*) as total
      FROM vodovod_fiscal_device fd
      WHERE (fd.naziv LIKE ? OR fd.id LIKE ?)
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

  async getCashRegisterForSL(dto: SearchDto) {
    const limit = 20;
    const offset = (dto.pageNumber ?? 0) * limit;
    const searchQuery = `%${dto.query ?? ''}%`;

    const sql = `
      SELECT cr.id, cr.naziv as kasa_id
      FROM vodovod_cash_register cr
      WHERE (cr.naziv LIKE ? OR cr.id LIKE ?)
      ORDER BY cr.id
      LIMIT ?, ?
    `;

    const results = await this.legacyDb.$queryRawUnsafe<any[]>(
      sql,
      searchQuery,
      searchQuery,
      offset,
      limit,
    );

    const out = results.map((row) => `${row.id} | ${row.kasa_id}`);

    const countSql = `
      SELECT COUNT(*) as total
      FROM vodovod_cash_register cr
      WHERE (cr.naziv LIKE ? OR cr.id LIKE ?)
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
      SELECT cr.*,
        CONCAT(ss.id, ' | ', ss.naziv) as status,
        CONCAT(oa.id, ' | ', oa.address_name) as adresa,
        CONCAT(fd.id, ' | ', fd.naziv) as fiscal_device
      FROM vodovod_cash_register cr
      LEFT JOIN ordering_addresses oa ON oa.id = cr.adresa_id
      LEFT JOIN vodovod_subsidies_status ss ON cr.status = ss.id
      LEFT JOIN vodovod_fiscal_device fd ON fd.id = cr.fiscal_device_id
      WHERE cr.id = ?
    `;

    const result = await this.legacyDb.$queryRawUnsafe<any[]>(query, id);

    if (!result || result.length === 0) {
      throw new NotFoundException(`Blagajna sa ID ${id} nije pronađena`);
    }

    return result[0];
  }

  async create(createDto: CreateCashRegisterDto, userId: number) {
    try {
      const extractId = (value: string): number | null => {
        const idMatch = value.match(/ID:\s*(\d+)/) || value.match(/^(\d+)/);
        return idMatch ? parseInt(idMatch[1], 10) : null;
      };

      const adresaId = createDto.adresa ? extractId(createDto.adresa) : null;
      const fiscalDeviceId = createDto.fiscal_device
        ? extractId(createDto.fiscal_device)
        : null;
      const statusId = createDto.status ? extractId(createDto.status) : 1;

      const query = `
        INSERT INTO vodovod_cash_register (naziv, adresa_id, fiscal_device_id, status)
        VALUES (?, ?, ?, ?)
      `;

      await this.legacyDb.$executeRawUnsafe(
        query,
        createDto.naziv,
        adresaId,
        fiscalDeviceId,
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
      console.error('Greška pri kreiranju blagajne:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async update(id: number, updateDto: UpdateCashRegisterDto, userId: number) {
    await this.getRowById(id);

    try {
      const extractId = (value: string): number | null => {
        const idMatch = value.match(/ID:\s*(\d+)/) || value.match(/^(\d+)/);
        return idMatch ? parseInt(idMatch[1], 10) : null;
      };

      const adresaId = updateDto.adresa ? extractId(updateDto.adresa) : null;
      const fiscalDeviceId = updateDto.fiscal_device
        ? extractId(updateDto.fiscal_device)
        : null;
      const statusId = updateDto.status ? extractId(updateDto.status) : null;

      const query = `
        UPDATE vodovod_cash_register SET
          naziv = ?,
          adresa_id = ?,
          fiscal_device_id = ?,
          status = ?
        WHERE id = ?
      `;

      await this.legacyDb.$executeRawUnsafe(
        query,
        updateDto.naziv,
        adresaId,
        fiscalDeviceId,
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
      console.error('Greška pri izmeni blagajne:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async delete(id: number) {
    const query = `UPDATE vodovod_cash_register SET status = 0 WHERE id = ?`;

    const result = await this.legacyDb.$executeRawUnsafe(query, id);

    if (result === 0) {
      throw new NotFoundException(`Nije pronađen red za ID: ${id}`);
    }

    return {
      success: true,
      message: 'Red je uspešno obrisan.',
    };
  }

  async getCashRegisterReport(startDate?: string, endDate?: string) {
    let query = `
      SELECT
        cr.naziv AS blagajna,
        CONCAT(c.crm_contacts_first_name, ' ', c.crm_contacts_last_name) AS blagajnik_id,
        DATE(ct.datum_kreiranja) AS datum,
        COUNT(ct.id) AS broj_transakcija,
        SUM(ct.iznos_ukupno) AS ukupan_promet,
        SUM(ct.iznos_gotovina) AS promet_gotovina,
        SUM(ct.iznos_kartica) AS promet_kartica,
        SUM(ct.iznos_cek) AS promet_cek,
        SUM(ct.iznos_vaucer) AS promet_vaucer
      FROM vodovod_cash_tx ct
      LEFT JOIN crm_contacts c ON ct.kreirao_id = c.id
      LEFT JOIN vodovod_cashiers vc ON c.id = vc.crm_contact_id
      JOIN vodovod_cash_register cr ON vc.kasa_id = cr.id
      WHERE ct.status = 1
    `;

    const params: any[] = [];

    if (startDate && startDate !== 'null' && endDate && endDate !== 'null') {
      query += ' AND DATE(ct.datum_kreiranja) BETWEEN ? AND ?';
      params.push(startDate, endDate);
    } else if (startDate && startDate !== 'null') {
      query += ' AND DATE(ct.datum_kreiranja) >= ?';
      params.push(startDate);
    } else if (endDate && endDate !== 'null') {
      query += ' AND DATE(ct.datum_kreiranja) <= ?';
      params.push(endDate);
    }

    query += `
      GROUP BY cr.naziv, DATE(ct.datum_kreiranja)
      ORDER BY datum DESC
    `;

    const result = await this.legacyDb.$queryRawUnsafe<any[]>(query, ...params);

    return (result || []).map((row) => ({
      ...row,
      broj_transakcija: Number(row.broj_transakcija || 0),
      ukupan_promet: Number(row.ukupan_promet || 0),
      promet_gotovina: Number(row.promet_gotovina || 0),
      promet_kartica: Number(row.promet_kartica || 0),
      promet_cek: Number(row.promet_cek || 0),
      promet_vaucer: Number(row.promet_vaucer || 0),
    }));
  }

  async getPaymentsByPaymentMethod(userId: number, paymentMethodId: number) {
    const datum = new Date().toISOString().split('T')[0];

    const query = `
      SELECT
        DATE(tx.datum_kreiranja) AS datum,
        CONCAT(c.crm_contacts_first_name, ' ', c.crm_contacts_last_name) AS blagajnik,
        cr.naziv AS blagajna,
        SUM(
          CASE ?
            WHEN 1 THEN tx.iznos_gotovina
            WHEN 2 THEN tx.iznos_kartica
            WHEN 3 THEN tx.iznos_cek
            WHEN 4 THEN tx.iznos_vaucer
            ELSE 0
          END
        ) AS ukupno
      FROM vodovod_cash_tx tx
      LEFT JOIN crm_contacts c
        ON tx.kreirao_id = c.id
      LEFT JOIN users u
        ON c.crm_contacts_user_id = u.id
      LEFT JOIN vodovod_cash_session cs
        ON u.id = cs.user_id
      LEFT JOIN vodovod_cash_register cr
        ON tx.kasa_id = cr.id
      WHERE cs.user_id = ?
        AND DATE(cs.datum_otvaranja) = ?
        AND DATE(tx.datum_kreiranja) = ?
        AND cs.status = 1
      GROUP BY
        DATE(tx.datum_kreiranja),
        cr.naziv
      ORDER BY
        datum ASC,
        blagajna ASC
    `;

    const result = await this.legacyDb.$queryRawUnsafe<any[]>(
      query,
      paymentMethodId,
      userId,
      datum,
      datum,
    );

    return (result || []).map((row) => ({
      ...row,
      ukupno: Number(row.ukupno || 0),
    }));
  }
}
