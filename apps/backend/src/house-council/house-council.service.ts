import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaLegacyService } from '../prisma-legacy/prisma-legacy.service';
import { CreateHouseCouncilDto } from './dto/create-house-council.dto';
import { UpdateHouseCouncilDto } from './dto/update-house-council.dto';

@Injectable()
export class HouseCouncilService {
  private readonly logger = new Logger(HouseCouncilService.name);

  constructor(private legacyDb: PrismaLegacyService) {}

  // IDENTIČNO kao PHP HouseCouncilModel::getData() (linija 16-30)
  async findAll() {
    const houseCouncils = await this.legacyDb.$queryRawUnsafe<any[]>(`
      SELECT vwm.IDV AS idv, hc.*,
             CONCAT(oa.id, ' | ', oa.address_name) as adresa,
             CONCAT(oc.id, ' | ', oc.cities_name) as naselje
      FROM vodovod_house_council hc
      LEFT JOIN ordering_addresses oa ON oa.id = hc.idu
      LEFT JOIN ordering_cities oc ON oc.id = hc.naselje
      LEFT JOIN vodovod_water_meter vwm ON vwm.idmm = hc.idmm
      ORDER BY id
    `);

    return houseCouncils;
  }

  async findOne(id: number) {
    const result = await this.legacyDb.$queryRawUnsafe<any[]>(
      `SELECT vwm.IDV AS idv, hc.*,
              CONCAT(oa.id, ' | ', oa.address_name) as adresa,
              CONCAT(oc.id, ' | ', oc.cities_name) as naselje
       FROM vodovod_house_council hc
       LEFT JOIN ordering_addresses oa ON oa.id = hc.idu
       LEFT JOIN ordering_cities oc ON oc.id = hc.naselje
       LEFT JOIN vodovod_water_meter vwm ON vwm.idmm = hc.idmm
       WHERE hc.id = ?`,
      id,
    );

    if (!result || result.length === 0) {
      throw new NotFoundException(`Kućni savet sa ID ${id} nije pronađen`);
    }

    return result[0];
  }

  // IDENTIČNO kao PHP HouseCouncilModel::addNewRow() (linija 140-214)
  async create(createDto: CreateHouseCouncilDto) {
    // Parse idmm from "ID | Address" format
    const idmmParts = (createDto.idmm || '').split(' | ');
    const idmm = idmmParts[0] && idmmParts[0] !== '' ? parseInt(idmmParts[0].trim()) : null;

    // Parse naselje from "ID | Name" format
    const naseljeParts = (createDto.naselje || '').split(' | ');
    const naselje = naseljeParts[0] ? parseInt(naseljeParts[0].trim()) : null;

    // Parse adresa from "ID | Name" format
    const adresaParts = (createDto.adresa || '').split(' | ');
    const adresa = adresaParts[0] ? parseInt(adresaParts[0].trim()) : null;

    // prim_MM ostaje kao string - MySQL će automatski konvertovati "19621 | LOLE RIBARA" -> 19621
    const prim_MM = createDto.prim_MM || null;

    const datum_ugradnje = createDto.datum_ugradnje || null;
    const broj_clanova_KS = createDto.broj_clanova_KS || null;
    const broj_potrosaca_KS = createDto.broj_potrosaca_KS || null;
    const broj = createDto.broj || null;

    // Start transaction (PHP linija 155)
    await this.legacyDb.$executeRawUnsafe('START TRANSACTION');

    try {
      // Insert into vodovod_house_council (PHP linija 157-189)
      await this.legacyDb.$executeRawUnsafe(
        `INSERT INTO vodovod_house_council (
          idmm, datum_ugradnje, broj_clanova_ks, broj_potrosaca_ks,
          prim_MM, naselje, idu, broj
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        idmm,
        datum_ugradnje,
        broj_clanova_KS,
        broj_potrosaca_KS,
        prim_MM,
        naselje,
        adresa,
        broj,
      );

      // Get inserted ID (PHP linija 187)
      const insertedIdResult = await this.legacyDb.$queryRawUnsafe<any[]>(
        'SELECT LAST_INSERT_ID() as id'
      );
      const insertedId = insertedIdResult[0].id;

      // Update vodovod_measuring_points (PHP linija 191-201)
      await this.legacyDb.$executeRawUnsafe(
        `UPDATE vodovod_measuring_points SET ks = ? WHERE idmm = ?`,
        insertedId,
        idmm,
      );

      // Commit transaction (PHP linija 204)
      await this.legacyDb.$executeRawUnsafe('COMMIT');

      return { success: true };
    } catch (error) {
      // Rollback on error (PHP linija 170, 195, 211)
      await this.legacyDb.$executeRawUnsafe('ROLLBACK');
      this.logger.error('❌ HouseCouncil CREATE error:', error);
      this.logger.error('Parsed values:', JSON.stringify({ idmm, adresa, naselje, prim_MM, datum_ugradnje, broj_clanova_KS, broj_potrosaca_KS, broj }));
      throw error;
    }
  }

  // IDENTIČNO kao PHP HouseCouncilModel::editRow() (linija 229-290)
  async update(id: number, updateDto: UpdateHouseCouncilDto) {
    await this.findOne(id);

    // Parse idmm from "ID | Address" format (PHP linija 238-239)
    const idmmParts = (updateDto.idmm || '').split(' | ');
    const idmm = idmmParts[0] && idmmParts[0] !== '' ? parseInt(idmmParts[0].trim()) : null;

    // Parse adresa from "ID | Name" format (PHP linija 241-242)
    const adresaParts = (updateDto.adresa || '').split(' | ');
    const adresa = adresaParts[0] ? parseInt(adresaParts[0].trim()) : null;

    // Parse naselje from "ID | Name" format (PHP linija 243-244)
    const naseljeParts = (updateDto.naselje || '').split(' | ');
    const naselje = naseljeParts[0] ? parseInt(naseljeParts[0].trim()) : null;

    // prim_MM ostaje kao string - MySQL će automatski konvertovati "19621 | LOLE RIBARA" -> 19621
    const primMM = updateDto.prim_MM || null;

    const datum_ugradnje = updateDto.datum_ugradnje || null;
    const brojClanovaKS = updateDto.broj_clanova_KS || null;
    const brojPotrosacaKS = updateDto.broj_potrosaca_KS || null;
    const broj = updateDto.broj || null;

    // Update query (PHP linija 251-280)
    await this.legacyDb.$executeRawUnsafe(
      `UPDATE vodovod_house_council SET
        idmm = ?, datum_ugradnje = ?, broj_clanova_ks = ?, broj_potrosaca_ks = ?,
        prim_MM = ?, naselje = ?, idu = ?, broj = ?
      WHERE id = ?`,
      idmm,
      datum_ugradnje,
      brojClanovaKS,
      brojPotrosacaKS,
      primMM,
      naselje,
      adresa,
      broj,
      id,
    );

    return { success: true };
  }

  // IDENTIČNO kao PHP HouseCouncilModel::removeRow() (linija 216-227)
  async remove(id: number) {
    await this.findOne(id);

    await this.legacyDb.$executeRawUnsafe(
      `DELETE FROM vodovod_house_council WHERE id = ?`,
      id,
    );

    return { success: true };
  }

  // IDENTIČNO kao PHP HouseCouncilModel::getMeasuringPoints() (linija 32-68)
  async searchMeasuringPoints(query: string = '', pageNumber: number = 0) {
    const limit = 50;
    const offset = pageNumber * limit;
    const searchQuery = `%${query}%`;

    // Main query (PHP linija 39-47)
    const data = await this.legacyDb.$queryRawUnsafe<any[]>(
      `SELECT mp.id, TRIM(mp.idmm) AS idmm, oa.address_name AS adresa
       FROM vodovod_measuring_points mp
       LEFT JOIN vodovod_house_council hc
         ON mp.IDMM = hc.idmm OR mp.KS = hc.id
       LEFT JOIN ordering_addresses oa ON oa.id = mp.idu
       WHERE ( mp.IDMM LIKE ? OR mp.id LIKE ? ) AND ( hc.idmm IS NULL )
       ORDER BY mp.id
       LIMIT ?, ?`,
      searchQuery,
      searchQuery,
      offset,
      limit,
    );

    // Count query (PHP linija 55-62)
    const countResult = await this.legacyDb.$queryRawUnsafe<Array<{ total: bigint }>>(
      `SELECT COUNT(*) as total
       FROM vodovod_measuring_points mp
       WHERE ( mp.IDMM LIKE ? OR mp.id LIKE ? )`,
      searchQuery,
      searchQuery,
    );

    const totalRows = Number(countResult[0]?.total ?? 0);
    const hasMore = offset + limit < totalRows; // PHP linija 62

    // Format output (PHP linija 50-53)
    return {
      data: data.map((row) => `${row.idmm} | ${row.adresa}`),
      hasMore,
    };
  }

  // IDENTIČNO kao PHP HouseCouncilModel::getAdress() (linija 70-103)
  async searchAddresses(query: string = '', pageNumber: number = 0) {
    const limit = 50;
    const offset = pageNumber * limit;
    const searchQuery = `%${query}%`;

    // Main query (PHP linija 77-82)
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

    // Count query (PHP linija 90-96)
    const countResult = await this.legacyDb.$queryRawUnsafe<Array<{ total: bigint }>>(
      `SELECT COUNT(*) as total
       FROM ordering_addresses oa
       WHERE ( oa.address_name LIKE ? OR oa.id LIKE ? )`,
      searchQuery,
      searchQuery,
    );

    const totalRows = Number(countResult[0]?.total ?? 0);
    const hasMore = offset + limit < totalRows; // PHP linija 97

    // Format output (PHP linija 85-88)
    return {
      data: data.map((row) => `${row.id} | ${row.address_name}`),
      hasMore,
    };
  }

  // IDENTIČNO kao PHP HouseCouncilModel::getCity() (linija 105-138)
  async searchCities(query: string = '', pageNumber: number = 0) {
    const limit = 50;
    const offset = pageNumber * limit;
    const searchQuery = `%${query}%`;

    // Main query (PHP linija 112-117)
    const data = await this.legacyDb.$queryRawUnsafe<any[]>(
      `SELECT oc.id, TRIM(oc.cities_name) AS cities_name
       FROM ordering_cities oc
       WHERE ( oc.cities_name LIKE ? OR oc.id LIKE ? )
       ORDER BY oc.id
       LIMIT ?, ?`,
      searchQuery,
      searchQuery,
      offset,
      limit,
    );

    // Count query (PHP linija 125-131)
    const countResult = await this.legacyDb.$queryRawUnsafe<Array<{ total: bigint }>>(
      `SELECT COUNT(*) as total
       FROM ordering_cities oc
       WHERE ( oc.cities_name LIKE ? OR oc.id LIKE ? )`,
      searchQuery,
      searchQuery,
    );

    const totalRows = Number(countResult[0]?.total ?? 0);
    const hasMore = offset + limit < totalRows; // PHP linija 132

    // Format output (PHP linija 120-123)
    return {
      data: data.map((row) => `${row.id} | ${row.cities_name}`),
      hasMore,
    };
  }
}
