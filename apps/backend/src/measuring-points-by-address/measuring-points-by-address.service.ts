import { Injectable } from '@nestjs/common';
import { PrismaLegacyService } from '../prisma-legacy/prisma-legacy.service';

@Injectable()
export class MeasuringPointsByAddressService {
  constructor(private legacyDb: PrismaLegacyService) {}

  // IDENTIČNO kao PHP MeasuringPointsByAddressModel::getAddressByIDMM() (linija 16-38)
  async getAddressByIDMM(idmm: number) {
    const result = await this.legacyDb.$queryRawUnsafe<any[]>(
      `SELECT mp.*, CONCAT(oa.id, ' | ', oa.address_name) as adresa
       FROM vodovod_measuring_points mp
       LEFT JOIN ordering_addresses oa ON mp.IDU = oa.id
       WHERE mp.IDMM = ?`,
      idmm,
    );

    return result;
  }

  // IDENTIČNO kao PHP MeasuringPointsByAddressModel::getAddresses() (linija 40-73)
  async getAddresses(query: string = '', pageNumber: number = 0) {
    const limit = 30;
    const offset = pageNumber * limit;
    const searchQuery = `%${query}%`;

    // Main query (PHP linija 47-52)
    const data = await this.legacyDb.$queryRawUnsafe<any[]>(
      `SELECT oa.id, TRIM(oa.address_name) AS address_name
       FROM ordering_addresses oa
       WHERE ( oa.address_name LIKE ? OR oa.id LIKE ? )
       ORDER BY oa.id
       LIMIT ?, ?`,
      searchQuery,
      searchQuery,
      offset,
      limit,
    );

    // Count query (PHP linija 60-63)
    const countResult = await this.legacyDb.$queryRawUnsafe<Array<{ total: bigint }>>(`
      SELECT COUNT(*) as total
      FROM ordering_addresses oa
      WHERE ( oa.address_name LIKE ? OR oa.id LIKE ? )
    `, searchQuery, searchQuery);

    const totalRows = Number(countResult[0]?.total ?? 0);
    const hasMore = offset + limit < totalRows;

    // Format output (PHP linija 56-58)
    return {
      data: data.map((row) => `${row.id} | ${row.address_name}`),
      hasMore,
    };
  }

  // IDENTIČNO kao PHP MeasuringPointsByAddressModel::getAddressHistory() (linija 75-86)
  async getAddressHistory() {
    const result = await this.legacyDb.$queryRawUnsafe<any[]>(`
      SELECT * FROM vodovod_address_history
      ORDER BY idmm DESC
    `);

    return result;
  }

  // IDENTIČNO kao PHP MeasuringPointsByAddressModel::saveNewAddress() (linija 88-143)
  async saveNewAddress(data: {
    idmm: string;
    staraAdresa: string;
    brojAdrese: string;
    ulaz: string;
    novaAdresa: string;
    noviBroj: string;
    noviUlaz: string;
  }) {
    // Parse data (PHP linija 97-104)
    const idmm = parseInt(data.idmm);
    const staraAdresa = parseInt(data.staraAdresa.split(' | ')[0]);
    const brojAdrese = data.brojAdrese;
    const ulaz = data.ulaz;
    const novaAdresaParts = data.novaAdresa.split(' | ');
    const novaAdresa = parseInt(novaAdresaParts[0]);
    const novaAdresaNaziv = novaAdresaParts[1];
    const noviBroj = data.noviBroj;
    const noviUlaz = data.noviUlaz;

    // Insert into vodovod_address_history (PHP linija 91-118)
    await this.legacyDb.$executeRawUnsafe(
      `INSERT INTO vodovod_address_history
       (idmm, stara_adresa, nova_adresa, stari_broj, novi_broj, stari_ulaz, novi_ulaz)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      idmm,
      staraAdresa,
      novaAdresa,
      brojAdrese,
      noviBroj,
      ulaz,
      noviUlaz,
    );

    // Update vodovod_measuring_points (PHP linija 120-136)
    await this.legacyDb.$executeRawUnsafe(
      `UPDATE vodovod_measuring_points
       SET adresa = ?, broj2 = ?, ulaz = ?, IDU = ?
       WHERE IDMM = ?`,
      novaAdresaNaziv,
      noviBroj,
      noviUlaz,
      novaAdresa,
      idmm,
    );

    // Get last inserted row (PHP linija 138-139)
    const lastInserted = await this.legacyDb.$queryRawUnsafe<any[]>(`
      SELECT * FROM vodovod_address_history
      ORDER BY id DESC LIMIT 1
    `);

    return lastInserted[0];
  }
}
