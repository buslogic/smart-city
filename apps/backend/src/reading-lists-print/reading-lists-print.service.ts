import { Injectable } from '@nestjs/common';
import { PrismaLegacyService } from '../prisma-legacy/prisma-legacy.service';

@Injectable()
export class ReadingListsPrintService {
  constructor(private prismaLegacy: PrismaLegacyService) {}

  async getRegionsForSL(data: { query?: string; pageNumber?: number }, limit = 30) {
    const query = data.query || '';
    const pageNumber = data.pageNumber || 0;
    const offset = pageNumber * limit;
    const searchQuery = `%${query}%`;

    const sql = `
      SELECT r.id, r.region_name
      FROM vodovod_regions r
      WHERE ( r.region_name LIKE ? OR r.id LIKE ? )
      ORDER BY r.id
      LIMIT ?, ?
    `;

    const countSql = `
      SELECT COUNT(*) as total
      FROM vodovod_regions r
      WHERE ( r.region_name LIKE ? OR r.id LIKE ? )
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
      data: items.map((item) => `${item.id} | ${item.region_name}`),
      hasMore,
    };
  }

  async getAddressesForSL(data: { query?: string; pageNumber?: number }, limit = 30) {
    const query = data.query || '';
    const pageNumber = data.pageNumber || 0;
    const offset = pageNumber * limit;
    const searchQuery = `%${query}%`;

    const sql = `
      SELECT oa.id, oa.address_name
      FROM ordering_addresses oa
      WHERE ( oa.address_name LIKE ? OR oa.id LIKE ? )
      ORDER BY oa.address_name
      LIMIT ?, ?
    `;

    const countSql = `
      SELECT COUNT(*) as total
      FROM ordering_addresses oa
      WHERE ( oa.address_name LIKE ? OR oa.id LIKE ? )
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
      data: items.map((item) => `${item.id} | ${item.address_name}`),
      hasMore,
    };
  }

  async getReadersForSL(data: { query?: string; pageNumber?: number }, limit = 30) {
    const query = data.query || '';
    const pageNumber = data.pageNumber || 0;
    const offset = pageNumber * limit;
    const searchQuery = `%${query}%`;

    const sql = `
      SELECT id, first_name, last_name, employee_code
      FROM vodovod_readers
      WHERE (
        first_name LIKE ?
        OR id LIKE ?
        OR last_name LIKE ?
        OR CAST(employee_code AS CHAR) LIKE ?
      )
      LIMIT ?, ?
    `;

    const countSql = `
      SELECT COUNT(*) as total
      FROM vodovod_readers
      WHERE (first_name LIKE ? OR id LIKE ? OR last_name LIKE ? OR employee_code LIKE ?)
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
      data: items.map((item) => `${item.id} | ${item.first_name} ${item.last_name} (${item.employee_code})`),
      hasMore,
    };
  }

  async getRows(params: { id?: string; type?: string; date?: string }) {
    const { id, type, date } = params;

    // Identično kao PHP getRows metod
    if (type === 'address' && id && date) {
      return [await this.getPointsByAddressID(date, parseInt(id))];
    } else if (type === 'region' && id && date) {
      return await this.getPointsByRegionID(date, parseInt(id));
    } else if (type === 'reader' && id && date) {
      return [await this.getPointsByReaderID(date, parseInt(id))];
    } else if (date) {
      return [await this.getAllPoints(date)];
    }

    return [];
  }

  private async getAllPoints(date: string) {
    const [godina, mesec] = date.split('-');

    const sql = `
      SELECT
        vmm.redosled_mm,
        vmm.KS,
        vhc.broj_clanova_ks,
        vhc.broj_potrosaca_ks,
        oa.address_name,
        vmm.broj2,
        vmm.ulaz,
        vmm.prim_mm,
        CONCAT(r.idmm, ' - ', r.idv) AS brojilo,
        r.pocetno_stanje,
        r.zavrsno_stanje,
        r.napomena,
        vmm.IDU as address_id,
        oa.address_name
      FROM vodovod_campaign AS c
      JOIN vodovod_sub_campaign sc ON c.id = sc.kampanja_id
      JOIN vodovod_readings r ON sc.id = r.pod_kampanja_id
      LEFT JOIN vodovod_measuring_points AS vmm ON vmm.IDMM = r.idmm
      LEFT JOIN vodovod_house_council vhc ON vmm.IDMM = vhc.idmm
      LEFT JOIN ordering_addresses AS oa ON oa.id = vmm.IDU
      WHERE c.godina = ? AND c.mesec = ?
    `;

    const rows = await this.prismaLegacy.$queryRawUnsafe<any[]>(
      sql,
      parseInt(godina),
      parseInt(mesec),
    );

    return this.groupByAddress(rows);
  }

  private async getPointsByAddressID(date: string, addressId: number) {
    const [godina, mesec] = date.split('-');

    const sql = `
      SELECT
        vmm.redosled_mm,
        vmm.KS,
        vhc.broj_clanova_ks,
        vhc.broj_potrosaca_ks,
        oa.address_name,
        vmm.broj2,
        vmm.ulaz,
        vmm.prim_mm,
        CONCAT(r.idmm, ' - ', r.idv) AS brojilo,
        r.pocetno_stanje,
        r.zavrsno_stanje,
        r.napomena,
        vmm.IDU as address_id,
        oa.address_name
      FROM vodovod_campaign AS c
      LEFT JOIN vodovod_sub_campaign sc ON c.id = sc.kampanja_id
      LEFT JOIN vodovod_readings r ON sc.id = r.pod_kampanja_id
      LEFT JOIN vodovod_measuring_points AS vmm ON vmm.IDMM = r.idmm
      LEFT JOIN vodovod_house_council vhc ON vmm.IDMM = vhc.idmm
      LEFT JOIN ordering_addresses AS oa ON oa.id = vmm.IDU
      WHERE vmm.IDU = ? AND c.godina = ? AND c.mesec = ?
    `;

    const rows = await this.prismaLegacy.$queryRawUnsafe<any[]>(
      sql,
      addressId,
      parseInt(godina),
      parseInt(mesec),
    );

    return this.groupByAddress(rows);
  }

  private async getPointsByRegionID(date: string, regionId: number) {
    const addressesResult = await this.prismaLegacy.$queryRawUnsafe<any[]>(
      'SELECT id FROM ordering_addresses WHERE region_id = ?',
      regionId,
    );

    const out: any[] = [];
    for (const row of addressesResult) {
      const data = await this.getPointsByAddressID(date, row.id);
      if (Object.keys(data).length > 0) {
        out.push(data);
      }
    }

    return out;
  }

  private async getPointsByReaderID(date: string, readerId: number) {
    const [godina, mesec] = date.split('-');

    const sql = `
      SELECT
        vmm.redosled_mm,
        vmm.KS,
        vhc.broj_clanova_ks,
        vhc.broj_potrosaca_ks,
        oa.address_name,
        vmm.broj2,
        vmm.ulaz,
        vmm.prim_mm,
        CONCAT(r.idmm, ' - ', r.idv) AS brojilo,
        r.pocetno_stanje,
        r.zavrsno_stanje,
        r.napomena,
        vmm.IDU as address_id,
        oa.address_name
      FROM vodovod_campaign AS c
      LEFT JOIN vodovod_sub_campaign sc ON c.id = sc.kampanja_id
      LEFT JOIN vodovod_readings r ON sc.id = r.pod_kampanja_id
      LEFT JOIN vodovod_measuring_points AS vmm ON vmm.IDMM = r.idmm
      LEFT JOIN vodovod_house_council vhc ON vmm.IDMM = vhc.idmm
      LEFT JOIN ordering_addresses AS oa ON oa.id = vmm.IDU
      WHERE r.citac_id = ? AND c.godina = ? AND c.mesec = ?
    `;

    const rows = await this.prismaLegacy.$queryRawUnsafe<any[]>(
      sql,
      readerId,
      parseInt(godina),
      parseInt(mesec),
    );

    return this.groupByAddress(rows);
  }

  private convertDecimalFields(row: any): any {
    const converted = { ...row };

    // Konvertuj DECIMAL polja u brojeve
    if (converted.pocetno_stanje !== null && converted.pocetno_stanje !== undefined) {
      converted.pocetno_stanje = Number(converted.pocetno_stanje);
    }
    if (converted.zavrsno_stanje !== null && converted.zavrsno_stanje !== undefined) {
      converted.zavrsno_stanje = Number(converted.zavrsno_stanje);
    }

    return converted;
  }

  private groupByAddress(rows: any[]) {
    const out: Record<string, any[]> = {};

    for (const row of rows) {
      // Konvertuj DECIMAL polja u brojeve
      const convertedRow = this.convertDecimalFields(row);

      const bpks = convertedRow.broj_potrosaca_ks ?? '0';
      const bcks = convertedRow.broj_clanova_ks ?? '0';
      convertedRow.broj_clanova_potrosaca_ks = `${bcks} - ${bpks}`;

      let ulaz = convertedRow.ulaz || '';
      if (!ulaz && convertedRow.address_name) {
        const parts = convertedRow.address_name.split('Ulaz');
        if (parts.length > 1) {
          ulaz = parts[1] || '';
        }
      }

      convertedRow.broj_ulaz_stan = `${convertedRow.broj2 || ''} - ${ulaz} - ${''}`;

      const streetKey = `${convertedRow.address_name} (${convertedRow.address_id})`;
      if (!out[streetKey]) {
        out[streetKey] = [];
      }
      out[streetKey].push(convertedRow);
    }

    return out;
  }
}
