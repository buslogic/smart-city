import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaLegacyService } from '../prisma-legacy/prisma-legacy.service';
import { CheckPeriodDto } from './dto/check-period.dto';
import { SearchItemsDto } from './dto/search-items.dto';
import { AddRowDto } from './dto/add-row.dto';
import { EditRowDto } from './dto/edit-row.dto';

@Injectable()
export class BillingCampaignsService {
  constructor(private prismaLegacy: PrismaLegacyService) {}

  /**
   * Vraća podatke za određeni period iz dinamičke tabele
   */
  async getData(dto: CheckPeriodDto) {
    const periodString = dto.period;
    const tableName = `vodovod_reading_lists_${periodString}`;

    // Proveravamo da li tabela postoji
    const checkTableQuery = `SHOW TABLES LIKE '${tableName}'`;
    const tableExists = await this.prismaLegacy.$queryRawUnsafe<any[]>(
      checkTableQuery,
    );

    if (!tableExists || tableExists.length === 0) {
      return { error: 'table_not_exists' };
    }

    // Dohvatamo podatke
    const query = `
      SELECT rl.*, wmr.meter_reading
      FROM \`${tableName}\` rl
      LEFT JOIN vodovod_water_meter_readings wmr ON rl.stanje_vodomera = wmr.id
      ORDER BY rl.id
    `;

    const rows = await this.prismaLegacy.$queryRawUnsafe<any[]>(query);
    return rows;
  }

  /**
   * Proverava da li postoji tabela za dati period
   */
  async checkOpenAccountingPeriod(dto: CheckPeriodDto) {
    const periodString = dto.period;
    const tableName = `vodovod_reading_lists_${periodString}`;

    const checkTableQuery = `SHOW TABLES LIKE '${tableName}'`;
    const tableExists = await this.prismaLegacy.$queryRawUnsafe<any[]>(
      checkTableQuery,
    );

    if (tableExists && tableExists.length > 0) {
      return { success: true };
    } else {
      return {
        success: false,
        message: 'Nije otvoren obračunski period za trenutni mesec.',
      };
    }
  }

  /**
   * Vraća vodomere sa paginacijom i pretraživanjem
   */
  async getWaterMeters(dto: SearchItemsDto) {
    const query = dto.query || '';
    const pageNumber = dto.pageNumber || 0;
    const limit = 30;
    const offset = pageNumber * limit;
    const searchQuery = `%${query}%`;

    const sql = `
      SELECT mm.id, TRIM(mm.idv) AS idv
      FROM vodovod_water_meter mm
      LEFT JOIN vodovod_measuring_points mp ON mm.idmm = mp.IDMM
      WHERE (mm.idv LIKE ? OR mm.id LIKE ?)
        AND (mm.idmm IS NULL OR TRIM(mm.idmm) <> TRIM(mp.idmm))
      ORDER BY mm.id
      LIMIT ? OFFSET ?
    `;

    const rows = await this.prismaLegacy.$queryRawUnsafe<any[]>(
      sql,
      searchQuery,
      searchQuery,
      limit,
      offset,
    );

    const data = rows.map((row: any) => `${row.id} | ${row.idv}`);

    // Brojanje ukupno
    const countSql = `
      SELECT COUNT(mm.id) as total
      FROM vodovod_water_meter mm
      LEFT JOIN vodovod_measuring_points mp ON mm.idmm = mp.IDMM
      WHERE (mm.idv LIKE ? OR mm.id LIKE ?)
        AND (mm.idmm IS NULL OR TRIM(mm.idmm) <> TRIM(mp.idmm))
    `;

    const countResult = await this.prismaLegacy.$queryRawUnsafe<any[]>(
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

  /**
   * Vraća merna mesta sa paginacijom i pretraživanjem
   */
  async getMeasuringPoints(dto: SearchItemsDto) {
    const query = dto.query || '';
    const pageNumber = dto.pageNumber || 0;
    const limit = 30;
    const offset = pageNumber * limit;
    const searchQuery = `%${query}%`;

    const sql = `
      SELECT mp.id, TRIM(mp.idmm) AS idmm, oa.address_name AS adresa
      FROM vodovod_measuring_points mp
      LEFT JOIN vodovod_house_council hc ON mp.KS = hc.id
      LEFT JOIN ordering_addresses oa ON oa.id = mp.IDU
      WHERE (mp.IDMM LIKE ? OR mp.id LIKE ?)
        AND (mp.KS IS NULL OR mp.KS <> hc.id)
      ORDER BY mp.id
      LIMIT ? OFFSET ?
    `;

    const rows = await this.prismaLegacy.$queryRawUnsafe<any[]>(
      sql,
      searchQuery,
      searchQuery,
      limit,
      offset,
    );

    const data = rows.map((row: any) => `${row.idmm} | ${row.adresa || ''}`);

    // Brojanje ukupno
    const countSql = `
      SELECT COUNT(*) as total
      FROM vodovod_measuring_points mp
      WHERE (mp.IDMM LIKE ? OR mp.id LIKE ?)
    `;

    const countResult = await this.prismaLegacy.$queryRawUnsafe<any[]>(
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

  /**
   * Vraća očitavanja vodomera sa paginacijom i pretraživanjem
   */
  async getWaterMeterReadings(dto: SearchItemsDto) {
    const query = dto.query || '';
    const pageNumber = dto.pageNumber || 0;
    const limit = 30;
    const offset = pageNumber * limit;
    const searchQuery = `%${query}%`;

    const sql = `
      SELECT mp.id, TRIM(mp.meter_reading) AS meter_reading
      FROM vodovod_water_meter_readings mp
      WHERE (mp.meter_reading LIKE ? OR mp.id LIKE ?)
      ORDER BY mp.id
      LIMIT ? OFFSET ?
    `;

    const rows = await this.prismaLegacy.$queryRawUnsafe<any[]>(
      sql,
      searchQuery,
      searchQuery,
      limit,
      offset,
    );

    const data = rows.map(
      (row: any) => `${row.id} | ${row.meter_reading || ''}`,
    );

    // Brojanje ukupno
    const countSql = `
      SELECT COUNT(*) as total
      FROM vodovod_water_meter_readings mp
      WHERE (mp.meter_reading LIKE ? OR mp.id LIKE ?)
    `;

    const countResult = await this.prismaLegacy.$queryRawUnsafe<any[]>(
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

  /**
   * Dodaje novi red u tabelu za period
   */
  async addNewRow(dto: AddRowDto) {
    const periodString = dto.period;
    const tableName = `vodovod_reading_lists_${periodString}`;

    // Parsiranje IDV
    const idvParts = dto.idv?.split(' | ') || [];
    const vodomer =
      idvParts[1] && idvParts[1].trim() !== ''
        ? idvParts[1].trim()
        : dto.idv?.trim() || null;

    // Parsiranje IDMM
    const idmmParts = dto.idmm?.split(' | ') || [];
    const idmm =
      idmmParts[0] && idmmParts[0].trim() !== ''
        ? idmmParts[0].trim()
        : null;

    // Parsiranje napomene
    let napomena = dto.napomena;
    if (napomena) {
      const parts = napomena.split(' | ');
      if (parts.length > 0) {
        napomena = parts[0];
      }
    }

    const query = `
      INSERT INTO \`${tableName}\` (
        id_popis,
        idmm,
        idv,
        pocetno_stanje,
        zavrsno_stanje,
        izmereno,
        z_pocetno_stanje,
        z_zavrsno_stanje,
        z_izmereno,
        z_vodomer,
        stanje_vodomera,
        procenat,
        napomena,
        nacin_upisa,
        zatvoren
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `;

    try {
      await this.prismaLegacy.$queryRawUnsafe(
        query,
        periodString,
        idmm,
        vodomer,
        dto.pocetno_stanje || null,
        dto.zavrsno_stanje || null,
        dto.izmereno || null,
        dto.z_pocetno_stanje || null,
        dto.z_zavrsno_stanje || null,
        dto.z_izmereno || null,
        dto.z_vodomer || null,
        dto.stanje_vodomera || null,
        dto.procenat || null,
        napomena || null,
        dto.nacin_upisa || null,
      );
      return true;
    } catch (error) {
      console.error('Error adding new row:', error);
      throw new BadRequestException(
        'Greška pri unosu podataka u tabelu: ' + error.message,
      );
    }
  }

  /**
   * Kreira novu tabelu za period (otvara novi obračunski period)
   */
  async createNewCalculation(dto: CheckPeriodDto) {
    const periodString = dto.period;
    const tableName = `vodovod_reading_lists_${periodString}`;

    // Proveravamo da li tabela već postoji
    const checkQuery = `SHOW TABLES LIKE '${tableName}'`;
    const result = await this.prismaLegacy.$queryRawUnsafe<any[]>(
      checkQuery,
    );

    if (result && result.length > 0) {
      return {
        success: false,
        message: `Obračun za period ${dto.period} već postoji.`,
      };
    }

    // Kreiramo novu tabelu
    const createTableQuery = `
      CREATE TABLE \`${tableName}\` (
        id INT(11) NOT NULL AUTO_INCREMENT,
        id_popis VARCHAR(50) DEFAULT NULL,
        idmm INT(11) DEFAULT NULL,
        idv VARCHAR(50) DEFAULT NULL,
        pocetno_stanje INT(11) DEFAULT NULL,
        zavrsno_stanje INT(11) DEFAULT NULL,
        izmereno INT(11) DEFAULT NULL,
        z_pocetno_stanje INT(11) DEFAULT NULL,
        z_zavrsno_stanje INT(11) DEFAULT NULL,
        z_izmereno INT(11) DEFAULT NULL,
        z_vodomer INT(11) DEFAULT NULL,
        stanje_vodomera INT(11) DEFAULT NULL,
        procenat VARCHAR(50) DEFAULT NULL,
        napomena INT DEFAULT NULL,
        nacin_upisa VARCHAR(50) DEFAULT NULL,
        zatvoren TINYINT(1) DEFAULT '0',
        PRIMARY KEY (id) USING BTREE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `;

    try {
      await this.prismaLegacy.$queryRawUnsafe(createTableQuery);

      // Dodajemo foreign key
      const constraintName = `fk_${tableName.replace(/-/g, '_')}_napomena_reading`;
      const alterTableQuery = `
        ALTER TABLE \`${tableName}\`
        ADD CONSTRAINT ${constraintName}
        FOREIGN KEY (napomena) REFERENCES vodovod_water_meter_readings(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
      `;

      await this.prismaLegacy.$queryRawUnsafe(alterTableQuery);

      return {
        success: true,
        message: `Obračun za period ${dto.period} je uspešno kreiran.`,
      };
    } catch (error) {
      console.error('Error creating calculation:', error);
      return {
        success: false,
        message: 'Greška pri kreiranju tabele: ' + error.message,
      };
    }
  }

  /**
   * Zatvara obračunski period (postavlja zatvoren = 1)
   */
  async closeAccountingPeriod(dto: CheckPeriodDto) {
    const periodString = dto.period;
    const tableName = `vodovod_reading_lists_${periodString}`;

    const query = `UPDATE \`${tableName}\` SET zatvoren = 1`;

    try {
      await this.prismaLegacy.$queryRawUnsafe(query);
      return { success: true };
    } catch (error) {
      console.error('Error closing accounting period:', error);
      return { success: false };
    }
  }

  /**
   * Ažurira postojeći red u tabeli
   */
  async editRow(dto: EditRowDto) {
    const periodString = dto.period;
    const tableName = `vodovod_reading_lists_${periodString}`;

    // Parsiranje IDV
    const idvParts = dto.idv?.split(' | ') || [];
    const vodomer =
      idvParts[1] && idvParts[1].trim() !== ''
        ? idvParts[1].trim()
        : dto.idv?.trim() || null;

    // Parsiranje IDMM
    const idmmParts = dto.idmm?.split(' | ') || [];
    const idmm =
      idmmParts[0] && idmmParts[0].trim() !== ''
        ? idmmParts[0].trim()
        : null;

    // Parsiranje napomene
    let napomena = dto.napomena;
    if (napomena) {
      const parts = napomena.split(' | ');
      if (parts.length > 0) {
        napomena = parts[0];
      }
    }

    // Uzimamo stanje_vodomera iz meter_reading ako postoji, inače iz stanje_vodomera
    const stanjeVodomera = dto.meter_reading || dto.stanje_vodomera || null;

    const query = `
      UPDATE \`${tableName}\`
      SET
        id_popis = ?,
        idmm = ?,
        idv = ?,
        pocetno_stanje = ?,
        zavrsno_stanje = ?,
        izmereno = ?,
        z_pocetno_stanje = ?,
        z_zavrsno_stanje = ?,
        z_izmereno = ?,
        z_vodomer = ?,
        stanje_vodomera = ?,
        procenat = ?,
        napomena = ?,
        nacin_upisa = ?
      WHERE id = ?
    `;

    try {
      await this.prismaLegacy.$queryRawUnsafe(
        query,
        periodString,
        idmm,
        vodomer,
        dto.pocetno_stanje || null,
        dto.zavrsno_stanje || null,
        dto.izmereno || null,
        dto.z_pocetno_stanje || null,
        dto.z_zavrsno_stanje || null,
        dto.z_izmereno || null,
        dto.z_vodomer || null,
        stanjeVodomera,
        dto.procenat || null,
        napomena || null,
        dto.nacin_upisa || null,
        dto.id,
      );
      return { success: true };
    } catch (error) {
      console.error('Error editing row:', error);
      return { success: false };
    }
  }
}
