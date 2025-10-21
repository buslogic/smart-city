import { Injectable } from '@nestjs/common';
import { PrismaLegacyService } from '../prisma-legacy/prisma-legacy.service';
import { CreateReadingDto } from './dto/create-reading.dto';
import { UpdateReadingDto } from './dto/update-reading.dto';

export interface Reading {
  id: number;
  pod_kampanja_id: string;
  idmm: string;
  idv: string;
  stavka_za_citanje_id?: string;
  datum?: string;
  pocetno_stanje?: number;
  zavrsno_stanje?: number;
  izvor_citanja?: string;
  napomena?: string;
  status?: string;
  citac_id?: string;
  anomalija?: string;
  z_vodomer?: string;
  z_pocetno?: number;
  z_zavrsno_stanje?: number;
  z_izmereno_stanje?: number;
  izmereno_stanje?: number;
}

@Injectable()
export class ReadingsService {
  constructor(private prismaLegacy: PrismaLegacyService) {}

  // Helper function to convert DECIMAL objects to numbers
  private convertDecimalFields(row: any): any {
    return {
      ...row,
      pocetno_stanje: row.pocetno_stanje ? Number(row.pocetno_stanje) : null,
      zavrsno_stanje: row.zavrsno_stanje ? Number(row.zavrsno_stanje) : null,
      z_pocetno: row.z_pocetno ? Number(row.z_pocetno) : null,
      z_zavrsno_stanje: row.z_zavrsno_stanje ? Number(row.z_zavrsno_stanje) : null,
      z_izmereno_stanje: row.z_izmereno_stanje ? Number(row.z_izmereno_stanje) : null,
      izmereno_stanje: row.izmereno_stanje ? Number(row.izmereno_stanje) : null,
    };
  }

  // Helper to extract ID from "ID | Name" format or return number directly
  private extractId(value: any): number | null {
    if (!value) return null;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parts = value.split(' | ');
      return parts.length > 1 ? parseInt(parts[0]) : parseInt(value);
    }
    return null;
  }

  // Helper to extract second part from "ID | Name" format
  private extractName(value: any): string | null {
    if (!value) return null;
    if (typeof value === 'string') {
      const parts = value.split(' | ');
      return parts.length > 1 ? parts[1] : value;
    }
    return String(value);
  }

  async findAll(): Promise<Reading[]> {
    const query = `
      SELECT r.*,
        CONCAT(ss.id, ' | ', ss.meter_reading) as status,
        CONCAT(sc.id, ' | ', c.godina, '-', c.mesec, '-', sc.dan) as pod_kampanja_id,
        CONCAT(mp.IDMM , ' | ', oa.address_name) as idmm,
        CONCAT(ct.id, ' | ', ct.tip) as izvor_citanja,
        CONCAT(wm.id, ' | ', wm.idv) as idv,
        CONCAT(vr.id, ' | ', vr.first_name, ' ', vr.last_name) AS citac_id,
        CONCAT(vra.id, ' | ', vra.description) as anomalija,
        rwm.idv as z_vodomer,
        r.z_pocetno,
        r.z_zavrsno as z_zavrsno_stanje,
        (r.z_zavrsno - r.z_pocetno) as z_izmereno_stanje,
        (r.zavrsno_stanje - r.pocetno_stanje) as izmereno_stanje
      FROM vodovod_readings r
      LEFT JOIN vodovod_water_meter_readings ss on r.status_id = ss.id
      LEFT JOIN vodovod_sub_campaign sc on r.pod_kampanja_id = sc.id
      LEFT JOIN vodovod_campaign c on sc.kampanja_id = c.id
      LEFT JOIN vodovod_measuring_points mp on r.idmm = mp.IDMM
      LEFT JOIN ordering_addresses oa on mp.IDU = oa.id
      LEFT JOIN vodovod_calculation_type ct on r.izvor_citanja = ct.id
      LEFT JOIN vodovod_water_meter wm on r.idv = wm.idv
      LEFT JOIN vodovod_readers vr on r.citac_id = vr.id
      LEFT JOIN vodovod_replaced_water_meter rwm on r.idmm = rwm.idmm AND rwm.aktivan = 1
      LEFT JOIN vodovod_reading_anomalies vra on r.anomalija_id = vra.id
      ORDER BY r.id DESC
    `;

    const readings = await this.prismaLegacy.$queryRawUnsafe<any[]>(query);

    // Convert DECIMAL objects to numbers
    return readings.map((r) => this.convertDecimalFields(r));
  }

  async getStatusForSL(data: { query?: string; pageNumber?: number }, limit = 30) {
    const query = data.query || '';
    const pageNumber = data.pageNumber || 0;
    const offset = pageNumber * limit;
    const searchQuery = `%${query}%`;

    const sql = `
      SELECT ss.id, ss.meter_reading as status_id
      FROM vodovod_water_meter_readings ss
      WHERE ( ss.meter_reading LIKE ? OR ss.id LIKE ? )
      ORDER BY ss.id
      LIMIT ?, ?
    `;

    const countSql = `
      SELECT COUNT(*) as total
      FROM vodovod_water_meter_readings ss
      WHERE ( ss.meter_reading LIKE ? OR ss.id LIKE ? )
    `;

    const items = await this.prismaLegacy.$queryRawUnsafe<any[]>(
      sql,
      searchQuery,
      searchQuery,
      offset,
      limit,
    );

    const countResult = await this.prismaLegacy.$queryRawUnsafe<any[]>(
      countSql,
      searchQuery,
      searchQuery,
    );

    const totalRows = countResult[0]?.total || 0;
    const hasMore = offset + limit < totalRows;

    return {
      data: items.map((item) => `${item.id} | ${item.status_id}`),
      hasMore,
    };
  }

  async getReaderForSL(data: { query?: string; pageNumber?: number }, limit = 30) {
    const query = data.query || '';
    const pageNumber = data.pageNumber || 0;
    const offset = pageNumber * limit;
    const searchQuery = `%${query}%`;

    const sql = `
      SELECT ss.id, CONCAT(ss.first_name, ' ', ss.last_name) as citac_id
      FROM vodovod_readers ss
      WHERE ( ss.first_name LIKE ? OR ss.last_name LIKE ? OR ss.id LIKE ? )
      ORDER BY ss.id
      LIMIT ?, ?
    `;

    const countSql = `
      SELECT COUNT(*) as total
      FROM vodovod_readers ss
      WHERE ( ss.first_name LIKE ? OR ss.last_name LIKE ? OR ss.id LIKE ? )
    `;

    const items = await this.prismaLegacy.$queryRawUnsafe<any[]>(
      sql,
      searchQuery,
      searchQuery,
      searchQuery,
      offset,
      limit,
    );

    const countResult = await this.prismaLegacy.$queryRawUnsafe<any[]>(
      countSql,
      searchQuery,
      searchQuery,
      searchQuery,
    );

    const totalRows = countResult[0]?.total || 0;
    const hasMore = offset + limit < totalRows;

    return {
      data: items.map((item) => `${item.id} | ${item.citac_id}`),
      hasMore,
    };
  }

  async getReadingItemForSL(data: { query?: string; pageNumber?: number }, limit = 30) {
    const query = data.query || '';
    const pageNumber = data.pageNumber || 0;
    const offset = pageNumber * limit;
    const searchQuery = `%${query}%`;

    const sql = `
      SELECT rs.id, rs.naziv as stavka_za_citanje_id
      FROM vodovod_reading_items rs
      WHERE ( rs.dan LIKE ? OR rs.id LIKE ? )
      ORDER BY rs.id
      LIMIT ?, ?
    `;

    const countSql = `
      SELECT COUNT(*) as total
      FROM vodovod_reading_items rs
      WHERE ( rs.dan LIKE ? OR rs.id LIKE ? )
    `;

    const items = await this.prismaLegacy.$queryRawUnsafe<any[]>(
      sql,
      searchQuery,
      searchQuery,
      offset,
      limit,
    );

    const countResult = await this.prismaLegacy.$queryRawUnsafe<any[]>(
      countSql,
      searchQuery,
      searchQuery,
    );

    const totalRows = countResult[0]?.total || 0;
    const hasMore = offset + limit < totalRows;

    return {
      data: items.map((item) => `${item.id} | ${item.stavka_za_citanje_id}`),
      hasMore,
    };
  }

  async getReadingSourceForSL(data: { query?: string; pageNumber?: number }, limit = 30) {
    const query = data.query || '';
    const pageNumber = data.pageNumber || 0;
    const offset = pageNumber * limit;
    const searchQuery = `%${query}%`;

    const sql = `
      SELECT ct.id, ct.tip as izvor_citanja
      FROM vodovod_calculation_type ct
      WHERE ( ct.tip LIKE ? OR ct.id LIKE ? )
      ORDER BY ct.id
      LIMIT ?, ?
    `;

    const countSql = `
      SELECT COUNT(*) as total
      FROM vodovod_calculation_type ct
      WHERE ( ct.tip LIKE ? OR ct.id LIKE ? )
    `;

    const items = await this.prismaLegacy.$queryRawUnsafe<any[]>(
      sql,
      searchQuery,
      searchQuery,
      offset,
      limit,
    );

    const countResult = await this.prismaLegacy.$queryRawUnsafe<any[]>(
      countSql,
      searchQuery,
      searchQuery,
    );

    const totalRows = countResult[0]?.total || 0;
    const hasMore = offset + limit < totalRows;

    return {
      data: items.map((item) => `${item.id} | ${item.izvor_citanja}`),
      hasMore,
    };
  }

  async getSubCampaignForSL(data: { query?: string; pageNumber?: number }, limit = 30) {
    const query = data.query || '';
    const pageNumber = data.pageNumber || 0;
    const offset = pageNumber * limit;
    const searchQuery = `%${query}%`;

    const sql = `
      SELECT sc.id, CONCAT(c.godina, '-', c.mesec, '-', sc.dan) as pod_kampanja_id
      FROM vodovod_sub_campaign sc
      LEFT JOIN vodovod_campaign c on sc.kampanja_id = c.id
      WHERE ( sc.dan LIKE ? OR c.godina LIKE ? OR c.mesec LIKE ? OR sc.id LIKE ? )
      ORDER BY sc.id
      LIMIT ?, ?
    `;

    const countSql = `
      SELECT COUNT(*) as total
      FROM vodovod_sub_campaign sc
      LEFT JOIN vodovod_campaign c on sc.kampanja_id = c.id
      WHERE ( sc.dan LIKE ? OR c.godina LIKE ? OR c.mesec LIKE ? OR sc.id LIKE ? )
    `;

    const items = await this.prismaLegacy.$queryRawUnsafe<any[]>(
      sql,
      searchQuery,
      searchQuery,
      searchQuery,
      searchQuery,
      offset,
      limit,
    );

    const countResult = await this.prismaLegacy.$queryRawUnsafe<any[]>(
      countSql,
      searchQuery,
      searchQuery,
      searchQuery,
      searchQuery,
    );

    const totalRows = countResult[0]?.total || 0;
    const hasMore = offset + limit < totalRows;

    return {
      data: items.map((item) => `${item.id} | ${item.pod_kampanja_id}`),
      hasMore,
    };
  }

  async getMeasuringPoints(
    data: { query?: string; pageNumber?: number },
    limit = 30,
    campaignId?: number,
  ) {
    const query = data.query || '';
    const pageNumber = data.pageNumber || 0;
    const offset = pageNumber * limit;
    const searchQuery = `%${query}%`;

    let regionId: number | null = null;
    if (campaignId) {
      const regionResult = await this.prismaLegacy.$queryRawUnsafe<any[]>(
        `SELECT region_id FROM vodovod_sub_campaign WHERE id = ?`,
        campaignId,
      );
      regionId = regionResult[0]?.region_id || null;
    }

    const sql = `
      SELECT mp.id, TRIM(mp.idmm) AS idmm, oa.address_name AS adresa
      FROM vodovod_measuring_points mp
      LEFT JOIN vodovod_house_council hc
        ON mp.IDMM = hc.idmm OR mp.KS = hc.id
      LEFT JOIN ordering_addresses oa ON oa.id = mp.idu
      WHERE oa.region_id = ? AND ( mp.IDMM LIKE ? OR mp.id LIKE ? ) AND ( hc.idmm IS NULL )
      ORDER BY mp.id
      LIMIT ?, ?
    `;

    const countSql = `
      SELECT COUNT(*) as total
      FROM vodovod_measuring_points mp
      LEFT JOIN vodovod_house_council hc
        ON mp.IDMM = hc.idmm OR mp.KS = hc.id
      LEFT JOIN ordering_addresses oa ON oa.id = mp.idu
      WHERE oa.region_id = ? AND ( mp.IDMM LIKE ? OR mp.id LIKE ? )
    `;

    const items = await this.prismaLegacy.$queryRawUnsafe<any[]>(
      sql,
      regionId,
      searchQuery,
      searchQuery,
      offset,
      limit,
    );

    const countResult = await this.prismaLegacy.$queryRawUnsafe<any[]>(
      countSql,
      regionId,
      searchQuery,
      searchQuery,
    );

    const totalRows = countResult[0]?.total || 0;
    const hasMore = offset + limit < totalRows;

    return {
      data: items.map((item) => `${item.idmm} | ${item.adresa}`),
      hasMore,
    };
  }

  async getWaterMeter(
    data: { query?: string; pageNumber?: number },
    limit = 30,
    idmm?: number,
  ) {
    const query = data.query || '';
    const pageNumber = data.pageNumber || 0;
    const offset = pageNumber * limit;
    const searchQuery = `%${query}%`;

    const sql = `
      SELECT wm.id, TRIM(wm.idv) AS idv
      FROM vodovod_water_meter wm
      WHERE wm.idmm = ? AND ( wm.idv LIKE ? OR wm.id LIKE ? )
      ORDER BY wm.id
      LIMIT ?, ?
    `;

    const countSql = `
      SELECT COUNT(*) as total
      FROM vodovod_water_meter wm
      WHERE wm.idmm = ? AND ( wm.idv LIKE ? OR wm.id LIKE ? )
    `;

    const items = await this.prismaLegacy.$queryRawUnsafe<any[]>(
      sql,
      idmm,
      searchQuery,
      searchQuery,
      offset,
      limit,
    );

    const countResult = await this.prismaLegacy.$queryRawUnsafe<any[]>(
      countSql,
      idmm,
      searchQuery,
      searchQuery,
    );

    const totalRows = countResult[0]?.total || 0;
    const hasMore = offset + limit < totalRows;

    return {
      data: items.map((item) => `${item.id} | ${item.idv}`),
      hasMore,
    };
  }

  async create(createReadingDto: CreateReadingDto) {
    const podKampanjaId = this.extractId(createReadingDto.pod_kampanja_id);
    const idmm = this.extractId(createReadingDto.idmm);
    const idv = this.extractName(createReadingDto.idv);
    const stavkaZaCitanjeId = this.extractId(createReadingDto.stavka_za_citanje_id);
    const izvorCitanja = this.extractId(createReadingDto.izvor_citanja);
    const statusId = this.extractId(createReadingDto.status);
    const citacId = this.extractId(createReadingDto.citac_id);

    // Get last zavrsno_stanje for pocetno_stanje
    const lastReadingQuery = `
      SELECT zavrsno_stanje FROM vodovod_readings
      WHERE idmm = ?
      ORDER BY id DESC
      LIMIT 1
    `;
    const lastReading = await this.prismaLegacy.$queryRawUnsafe<any[]>(
      lastReadingQuery,
      idmm,
    );
    const pocetnoStanje = lastReading[0]?.zavrsno_stanje || 0;

    const zPocetno = createReadingDto.z_pocetno || null;
    const zZavrsno = createReadingDto.z_zavrsno_stanje || null;

    // Insert new reading
    const insertQuery = `
      INSERT INTO vodovod_readings
      (pod_kampanja_id, idmm, idv, stavka_za_citanje_id, datum, pocetno_stanje, zavrsno_stanje, izvor_citanja, napomena, status_id, citac_id, z_pocetno, z_zavrsno)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await this.prismaLegacy.$executeRawUnsafe(
      insertQuery,
      podKampanjaId,
      idmm,
      idv,
      stavkaZaCitanjeId,
      createReadingDto.datum || null,
      pocetnoStanje,
      createReadingDto.zavrsno_stanje || null,
      izvorCitanja,
      createReadingDto.napomena || null,
      statusId,
      citacId,
      zPocetno,
      zZavrsno,
    );

    // Get inserted row
    const getLastInsertIdQuery = `SELECT LAST_INSERT_ID() as id`;
    const lastInsertResult = await this.prismaLegacy.$queryRawUnsafe<any[]>(
      getLastInsertIdQuery,
    );
    const insertedId = lastInsertResult[0]?.id;

    const rowQuery = `
      SELECT r.*,
        CONCAT(ss.id, ' | ', ss.meter_reading) as status,
        CONCAT(sc.id, ' | ', c.godina, '-', c.mesec, '-', sc.dan) as pod_kampanja_id,
        CONCAT(mp.IDMM , ' | ', oa.address_name) as idmm,
        CONCAT(ct.id, ' | ', ct.tip) as izvor_citanja,
        CONCAT(wm.id, ' | ', wm.idv) as idv,
        CONCAT(vr.id, ' | ', vr.first_name, ' ', vr.last_name) AS citac_id,
        CONCAT(vra.id, ' | ', vra.description) as anomalija,
        rwm.idv as z_vodomer,
        r.z_pocetno,
        r.z_zavrsno as z_zavrsno_stanje,
        (r.z_zavrsno - r.z_pocetno) as z_izmereno_stanje,
        (r.zavrsno_stanje - r.pocetno_stanje) as izmereno_stanje
      FROM vodovod_readings r
      LEFT JOIN vodovod_water_meter_readings ss on r.status_id = ss.id
      LEFT JOIN vodovod_sub_campaign sc on r.pod_kampanja_id = sc.id
      LEFT JOIN vodovod_campaign c on sc.kampanja_id = c.id
      LEFT JOIN vodovod_measuring_points mp on r.idmm = mp.IDMM
      LEFT JOIN ordering_addresses oa on mp.IDU = oa.id
      LEFT JOIN vodovod_calculation_type ct on r.izvor_citanja = ct.id
      LEFT JOIN vodovod_water_meter wm on r.idv = wm.idv
      LEFT JOIN vodovod_readers vr on r.citac_id = vr.id
      LEFT JOIN vodovod_replaced_water_meter rwm on r.idmm = rwm.idmm AND rwm.aktivan = 1
      LEFT JOIN vodovod_reading_anomalies vra on r.anomalija_id = vra.id
      WHERE r.id = ?
    `;

    const row = await this.prismaLegacy.$queryRawUnsafe<any[]>(rowQuery, insertedId);

    if (row && row.length > 0) {
      return { success: true, message: 'Successful!', data: this.convertDecimalFields(row[0]) };
    }

    return { success: false, message: 'failed to get the data' };
  }

  async update(id: number, updateReadingDto: UpdateReadingDto) {
    const podKampanjaId = this.extractId(updateReadingDto.pod_kampanja_id);
    const idmm = this.extractId(updateReadingDto.idmm);
    const idv = this.extractName(updateReadingDto.idv);
    const stavkaZaCitanjeId = this.extractId(updateReadingDto.stavka_za_citanje_id);
    const izvorCitanja = this.extractId(updateReadingDto.izvor_citanja);
    const statusId = this.extractId(updateReadingDto.status);
    const citacId = this.extractId(updateReadingDto.citac_id);

    const zPocetno = updateReadingDto.z_pocetno || null;
    const zZavrsno = updateReadingDto.z_zavrsno_stanje || null;

    // Convert ISO date to YYYY-MM-DD format
    let datum = updateReadingDto.datum || null;
    if (datum && datum.includes('T')) {
      datum = datum.split('T')[0];
    }

    // Update reading
    const updateQuery = `
      UPDATE vodovod_readings
      SET
        pod_kampanja_id = ?,
        idmm = ?,
        idv = ?,
        stavka_za_citanje_id = ?,
        datum = ?,
        pocetno_stanje = ?,
        zavrsno_stanje = ?,
        izvor_citanja = ?,
        napomena = ?,
        status_id = ?,
        citac_id = ?,
        z_pocetno = ?,
        z_zavrsno = ?
      WHERE id = ?
    `;

    await this.prismaLegacy.$executeRawUnsafe(
      updateQuery,
      podKampanjaId,
      idmm,
      idv,
      stavkaZaCitanjeId,
      datum,
      updateReadingDto.pocetno_stanje || null,
      updateReadingDto.zavrsno_stanje || null,
      izvorCitanja,
      updateReadingDto.napomena || null,
      statusId,
      citacId,
      zPocetno,
      zZavrsno,
      id,
    );

    // Get updated row
    const rowQuery = `
      SELECT r.*,
        CONCAT(ss.id, ' | ', ss.meter_reading) as status,
        CONCAT(sc.id, ' | ', c.godina, '-', c.mesec, '-', sc.dan) as pod_kampanja_id,
        CONCAT(mp.IDMM , ' | ', oa.address_name) as idmm,
        CONCAT(ct.id, ' | ', ct.tip) as izvor_citanja,
        CONCAT(wm.id, ' | ', wm.idv) as idv,
        CONCAT(vr.id, ' | ', vr.first_name, ' ', vr.last_name) AS citac_id,
        CONCAT(vra.id, ' | ', vra.description) as anomalija,
        rwm.idv as z_vodomer,
        r.z_pocetno,
        r.z_zavrsno as z_zavrsno_stanje,
        (r.z_zavrsno - r.z_pocetno) as z_izmereno_stanje,
        (r.zavrsno_stanje - r.pocetno_stanje) as izmereno_stanje
      FROM vodovod_readings r
      LEFT JOIN vodovod_water_meter_readings ss on r.status_id = ss.id
      LEFT JOIN vodovod_sub_campaign sc on r.pod_kampanja_id = sc.id
      LEFT JOIN vodovod_campaign c on sc.kampanja_id = c.id
      LEFT JOIN vodovod_measuring_points mp on r.idmm = mp.IDMM
      LEFT JOIN ordering_addresses oa on mp.IDU = oa.id
      LEFT JOIN vodovod_calculation_type ct on r.izvor_citanja = ct.id
      LEFT JOIN vodovod_water_meter wm on r.idv = wm.idv
      LEFT JOIN vodovod_readers vr on r.citac_id = vr.id
      LEFT JOIN vodovod_replaced_water_meter rwm on r.idmm = rwm.idmm AND rwm.aktivan = 1
      LEFT JOIN vodovod_reading_anomalies vra on r.anomalija_id = vra.id
      WHERE r.id = ?
    `;

    const row = await this.prismaLegacy.$queryRawUnsafe<any[]>(rowQuery, id);

    if (row && row.length > 0) {
      return { success: true, message: 'Successful!', data: this.convertDecimalFields(row[0]) };
    }

    return { success: false, message: 'failed to get the data' };
  }

  async remove(id: number) {
    const deleteQuery = `DELETE FROM vodovod_readings WHERE id = ?`;
    await this.prismaLegacy.$executeRawUnsafe(deleteQuery, id);
    return { success: true, message: 'Red je uspešno obrisan.' };
  }
}
