import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaLegacyService } from '../prisma-legacy/prisma-legacy.service';
import { CreateMeasuringPointDto } from './dto/create-measuring-point.dto';
import { UpdateMeasuringPointDto } from './dto/update-measuring-point.dto';

@Injectable()
export class MeasuringPointsService {
  constructor(private legacyDb: PrismaLegacyService) {}

  async findAll() {
    // DIREKTNA MySQL2 konekcija zaobilazi Prisma date parsing
    const mysql = require('mysql2/promise');

    const connection = await mysql.createConnection(process.env.LEGACY_DATABASE_URL);

    const [rows] = await connection.execute(`
      SELECT mp.*,
             CONCAT(ct.Id, ' | ', ct.tip) as tip,
             CONCAT(hc.id, ' | ', oa.address_name) AS kucni_savet,
             CONCAT(mps.id, ' | ', mps.status) AS mps_status,
             wm.idv as IDV,
             CONCAT(oa.id, ' | ', oa.address_name) as adresa,
             CONCAT(oc.id, ' | ', oc.cities_name) as naselje,
             hc.broj_clanova_KS as broj_clanova_ks,
             hc.broj_potrosaca_KS as broj_potrosaca_ks
        FROM vodovod_measuring_points mp
        LEFT JOIN vodovod_calculation_type ct ON mp.type_Id = ct.Id
        LEFT JOIN vodovod_house_council hc ON mp.IDMM = hc.idmm
        LEFT JOIN vodovod_measuring_points_status mps ON mp.status = mps.id
        LEFT JOIN vodovod_water_meter wm ON mp.IDMM = wm.idmm
        LEFT JOIN ordering_addresses oa ON mp.IDU = oa.id
        LEFT JOIN ordering_cities oc ON oc.id = mp.naselje
        WHERE mp.aktivan = 1
        ORDER BY mp.IDMM DESC
    `);

    await connection.end();

    // Konvertuj Decimal objekte u string/number
    return (rows as any[]).map(row => this.serializeRow(row));
  }

  private serializeRow(row: any) {
    const serialized = { ...row };
    // Konvertuj sve decimal vrednosti u stringove
    Object.keys(serialized).forEach(key => {
      const value = serialized[key];
      if (value && typeof value === 'object' && 's' in value && 'e' in value && 'd' in value) {
        // Ovo je Decimal objekat
        serialized[key] = value.toString();
      }
    });
    return serialized;
  }

  async findOne(idmm: number) {
    const measuringPoints = await this.legacyDb.$queryRawUnsafe<any[]>(
      `
      SELECT mp.*,
             CONCAT(ct.Id, ' | ', ct.tip) as tip,
             CONCAT(hc.id, ' | ', oa.address_name) AS kucni_savet,
             CONCAT(mps.id, ' | ', mps.status) AS mps_status,
             wm.idv as IDV,
             CONCAT(oa.id, ' | ', oa.address_name) as adresa,
             CONCAT(oc.id, ' | ', oc.cities_name) as naselje,
             hc.broj_clanova_KS as broj_clanova_ks,
             hc.broj_potrosaca_KS as broj_potrosaca_ks
      FROM vodovod_measuring_points mp
      LEFT JOIN vodovod_calculation_type ct ON mp.type_Id = ct.Id
      LEFT JOIN vodovod_house_council hc ON mp.IDMM = hc.idmm
      LEFT JOIN vodovod_measuring_points_status mps ON mp.status = mps.id
      LEFT JOIN vodovod_water_meter wm ON mp.IDMM = wm.idmm
      LEFT JOIN ordering_addresses oa ON mp.IDU = oa.id
      LEFT JOIN ordering_cities oc ON oc.id = mp.naselje
      WHERE mp.aktivan = 1 AND mp.IDMM = ?
    `,
      idmm,
    );

    if (!measuringPoints || measuringPoints.length === 0) {
      throw new NotFoundException(`Merno mesto sa IDMM ${idmm} nije pronađeno`);
    }

    return this.serializeRow(measuringPoints[0]);
  }

  async create(createDto: CreateMeasuringPointDto) {
    // Kreiraj preko raw SQL-a
    const IDU = createDto.IDU ?? null;
    const typeId = createDto.typeId ?? null;
    const status = createDto.status ?? null;
    const aktivan = createDto.aktivan ? 1 : 0;

    await this.legacyDb.$executeRawUnsafe(
      `INSERT INTO vodovod_measuring_points (IDMM, IDU, type_Id, status, aktivan) VALUES (?, ?, ?, ?, ?)`,
      createDto.IDMM,
      IDU,
      typeId,
      status,
      aktivan
    );

    return this.findOne(createDto.IDMM);
  }

  async update(idmm: number, updateDto: UpdateMeasuringPointDto) {
    await this.findOne(idmm);

    // Parsiranje vrednosti iz formata "ID | naziv"
    const parseFilter = (value?: string): string | null => {
      if (!value) return null;
      const parts = value.split(' | ');
      return parts.length > 0 && parts[0].trim() !== '' ? parts[0].trim() : null;
    };

    const IDU = parseFilter(updateDto.adresa);
    const typeId = parseFilter(updateDto.tip);
    const status = parseFilter(updateDto.mps_status);
    const naselje = parseFilter(updateDto.naselje);

    // Pripremanje SQL-a sa svim poljima kao u PHP modelu
    const sql = `
      UPDATE vodovod_measuring_points SET
        type_id = ?,
        napomena = ?,
        datum_ugradnje = ?,
        prosek_ps = ?,
        korektivno = ?,
        virtuelno = ?,
        kontrolno = ?,
        prosek_u = ?,
        prim_mm = ?,
        redosled_mm = ?,
        naselje = ?,
        IDU = ?,
        broj2 = ?,
        check_ll = ?,
        latitude = ?,
        longtitude = ?,
        ulaz = ?,
        broj = ?,
        prosek_o = ?,
        status = ?,
        _Napomena_MM = ?
      WHERE IDMM = ?
    `;

    await this.legacyDb.$executeRawUnsafe(
      sql,
      typeId || null,
      updateDto.napomena || null,
      updateDto.datum_ugradnje || null,
      updateDto.prosek_ps || null,
      updateDto.korektivno || 0,
      updateDto.virtuelno || 0,
      updateDto.kontrolno || 0,
      updateDto.prosek_u || null,
      updateDto.prim_mm || null,
      updateDto.redosled_mm || null,
      naselje || null,
      IDU || null,
      updateDto.broj2 || null,
      updateDto.check_ll || null,
      updateDto.latitude || null,
      updateDto.longtitude || null,
      updateDto.ulaz || null,
      updateDto.broj || null,
      updateDto.prosek_o || null,
      status || null,
      updateDto._Napomena_MM || null,
      idmm,
    );

    // Ažuriranje podataka u vodovod_house_council tabeli
    if (updateDto.broj_clanova_ks !== undefined || updateDto.broj_potrosaca_ks !== undefined) {
      const updateHC = `
        UPDATE vodovod_house_council
        SET broj_clanova_ks = ?,
            broj_potrosaca_ks = ?
        WHERE idmm = ?
      `;

      await this.legacyDb.$executeRawUnsafe(
        updateHC,
        updateDto.broj_clanova_ks || null,
        updateDto.broj_potrosaca_ks || null,
        idmm,
      );
    }

    return this.findOne(idmm);
  }

  async remove(idmm: number) {
    await this.findOne(idmm);
    // Soft delete - postavi aktivan = 0
    await this.legacyDb.$executeRawUnsafe(`UPDATE vodovod_measuring_points SET aktivan = 0 WHERE IDMM = ?`, idmm);
    return { success: true };
  }

  async getMeasuringPointsHistory(idmm: number) {
    const sql = `
      SELECT mpch.*, ct.translate, u.real_name as changed_by
      FROM vodovod_measuring_points_change_history mpch
      LEFT JOIN vodovod_change_type ct ON mpch.change_type = ct.id
      LEFT JOIN users u ON u.id = mpch.changed_by
      WHERE idmm = ?
      ORDER BY mpch.change_date DESC
    `;
    const rows = await this.legacyDb.$queryRawUnsafe<any[]>(sql, idmm);
    return rows;
  }

  async getCities(params: { query?: string; pageNumber?: number }) {
    const query = params.query || '';
    const pageNumber = params.pageNumber || 0;
    const limit = 30;
    const offset = pageNumber * limit;
    const searchQuery = `%${query}%`;

    const sql = `
      SELECT oc.id, TRIM(oc.cities_name) AS cities_name
      FROM ordering_cities oc
      WHERE oc.cities_name LIKE ? OR oc.id LIKE ?
      ORDER BY oc.id
      LIMIT ? OFFSET ?
    `;

    const rows = await this.legacyDb.$queryRawUnsafe<any[]>(
      sql,
      searchQuery,
      searchQuery,
      limit,
      offset,
    );

    const data = rows.map((row: any) => `${row.id} | ${row.cities_name}`);

    const countSql = `
      SELECT COUNT(*) as total
      FROM ordering_cities oc
      WHERE oc.cities_name LIKE ? OR oc.id LIKE ?
    `;

    const countResult = await this.legacyDb.$queryRawUnsafe<any[]>(
      countSql,
      searchQuery,
      searchQuery,
    );
    const totalRows = Number(countResult[0]?.total || 0);
    const hasMore = offset + limit < totalRows;

    return {
      data,
      hasMore,
    };
  }

  async getAddresses(params: { query?: string; pageNumber?: number }) {
    const query = params.query || '';
    const pageNumber = params.pageNumber || 0;
    const limit = 30;
    const offset = pageNumber * limit;
    const searchQuery = `%${query}%`;

    const sql = `
      SELECT oa.id, TRIM(oa.address_name) AS address_name
      FROM ordering_addresses oa
      WHERE oa.address_name LIKE ? OR oa.id LIKE ?
      ORDER BY oa.id
      LIMIT ? OFFSET ?
    `;

    const rows = await this.legacyDb.$queryRawUnsafe<any[]>(
      sql,
      searchQuery,
      searchQuery,
      limit,
      offset,
    );

    const data = rows.map((row: any) => `${row.id} | ${row.address_name}`);

    const countSql = `
      SELECT COUNT(*) as total
      FROM ordering_addresses oa
      WHERE oa.address_name LIKE ? OR oa.id LIKE ?
    `;

    const countResult = await this.legacyDb.$queryRawUnsafe<any[]>(
      countSql,
      searchQuery,
      searchQuery,
    );
    const totalRows = Number(countResult[0]?.total || 0);
    const hasMore = offset + limit < totalRows;

    return {
      data,
      hasMore,
    };
  }

  async getStatusOptions(params: { query?: string; pageNumber?: number }) {
    const query = params.query || '';
    const pageNumber = params.pageNumber || 0;
    const limit = 30;
    const offset = pageNumber * limit;
    const searchQuery = `%${query}%`;

    const sql = `
      SELECT id, TRIM(\`status\`) AS status
      FROM vodovod_measuring_points_status
      WHERE status LIKE ? OR id LIKE ?
      ORDER BY id
      LIMIT ? OFFSET ?
    `;

    const rows = await this.legacyDb.$queryRawUnsafe<any[]>(
      sql,
      searchQuery,
      searchQuery,
      limit,
      offset,
    );

    const data = rows.map((row: any) => `${row.id} | ${row.status}`);

    const countSql = `
      SELECT COUNT(*) as total
      FROM vodovod_measuring_points_status
      WHERE status LIKE ? OR id LIKE ?
    `;

    const countResult = await this.legacyDb.$queryRawUnsafe<any[]>(
      countSql,
      searchQuery,
      searchQuery,
    );
    const totalRows = Number(countResult[0]?.total || 0);
    const hasMore = offset + limit < totalRows;

    return {
      data,
      hasMore,
    };
  }

  async getTypeOptions(params: { query?: string; pageNumber?: number }) {
    const query = params.query || '';
    const pageNumber = params.pageNumber || 0;
    const limit = 30;
    const offset = pageNumber * limit;
    const searchQuery = `%${query}%`;

    const sql = `
      SELECT Id, TRIM(\`tip\`) AS tip
      FROM vodovod_calculation_type
      WHERE tip LIKE ? OR Id LIKE ?
      ORDER BY Id
      LIMIT ? OFFSET ?
    `;

    const rows = await this.legacyDb.$queryRawUnsafe<any[]>(
      sql,
      searchQuery,
      searchQuery,
      limit,
      offset,
    );

    const data = rows.map((row: any) => `${row.Id} | ${row.tip}`);

    const countSql = `
      SELECT COUNT(*) as total
      FROM vodovod_calculation_type
      WHERE tip LIKE ? OR Id LIKE ?
    `;

    const countResult = await this.legacyDb.$queryRawUnsafe<any[]>(
      countSql,
      searchQuery,
      searchQuery,
    );
    const totalRows = Number(countResult[0]?.total || 0);
    const hasMore = offset + limit < totalRows;

    return {
      data,
      hasMore,
    };
  }

  async getHouseCouncilOptions(params: { query?: string; pageNumber?: number }) {
    const query = params.query || '';
    const pageNumber = params.pageNumber || 0;
    const limit = 30;
    const offset = pageNumber * limit;
    const searchQuery = `%${query}%`;

    const sql = `
      SELECT hc.id, oa.address_name as adresa
      FROM vodovod_house_council hc
      LEFT JOIN ordering_addresses oa ON hc.idu = oa.id
      LEFT JOIN vodovod_measuring_points mp ON hc.idmm = mp.IDMM
      WHERE (hc.idmm <> mp.IDMM OR hc.idmm IS NULL)
        AND (oa.address_name LIKE ? OR hc.id LIKE ?)
      ORDER BY hc.id
      LIMIT ? OFFSET ?
    `;

    const rows = await this.legacyDb.$queryRawUnsafe<any[]>(
      sql,
      searchQuery,
      searchQuery,
      limit,
      offset,
    );

    const data = rows.map((row: any) => `${row.id} | ${row.adresa}`);

    const countSql = `
      SELECT COUNT(hc.id) as total
      FROM vodovod_house_council hc
      LEFT JOIN ordering_addresses oa ON hc.idu = oa.id
      LEFT JOIN vodovod_measuring_points mp ON hc.idmm = mp.IDMM
      WHERE (hc.idmm <> mp.IDMM OR hc.idmm IS NULL)
        AND (oa.address_name LIKE ? OR hc.id LIKE ?)
    `;

    const countResult = await this.legacyDb.$queryRawUnsafe<any[]>(
      countSql,
      searchQuery,
      searchQuery,
    );
    const totalRows = Number(countResult[0]?.total || 0);
    const hasMore = offset + limit < totalRows;

    return {
      data,
      hasMore,
    };
  }

  async getPrimaryMeasuringPoints(params: { query?: string; pageNumber?: number; excludeId?: string }) {
    const query = params.query || '';
    const pageNumber = params.pageNumber || 0;
    const excludeId = params.excludeId || '';
    const limit = 30;
    const offset = pageNumber * limit;
    const searchQuery = `%${query}%`;

    const sql = `
      SELECT TRIM(mp.IDMM) AS idmm
      FROM vodovod_measuring_points mp
      WHERE mp.IDMM LIKE ? AND mp.IDMM != ?
      ORDER BY mp.IDMM
      LIMIT ? OFFSET ?
    `;

    const rows = await this.legacyDb.$queryRawUnsafe<any[]>(
      sql,
      searchQuery,
      excludeId,
      limit,
      offset,
    );

    const data = rows.map((row: any) => row.idmm);

    const countSql = `
      SELECT COUNT(mp.IDMM) as total
      FROM vodovod_measuring_points mp
      WHERE mp.IDMM LIKE ? AND mp.IDMM != ?
    `;

    const countResult = await this.legacyDb.$queryRawUnsafe<any[]>(
      countSql,
      searchQuery,
      excludeId,
    );
    const totalRows = Number(countResult[0]?.total || 0);
    const hasMore = offset + limit < totalRows;

    return {
      data,
      hasMore,
    };
  }
}
