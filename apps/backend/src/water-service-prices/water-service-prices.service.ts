import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaLegacyService } from '../prisma-legacy/prisma-legacy.service';
import { CreateWaterServicePriceDto } from './dto/create-water-service-price.dto';
import { UpdateWaterServicePriceDto } from './dto/update-water-service-price.dto';

@Injectable()
export class WaterServicePricesService {
  constructor(private legacyDb: PrismaLegacyService) {}

  async findAll(categoryId?: number) {
    let query = `
      SELECT wsp.*,
             CONCAT(wsp.service_id, ' | ', vs.service) AS service,
             CONCAT(wsp.category_id, ' | ', vcc.category) AS category
      FROM vodovod_water_services_pricelist wsp
      LEFT JOIN vodovod_service vs ON wsp.service_id = vs.id
      LEFT JOIN vodovod_consumer_categories vcc ON wsp.category_id = vcc.id
      WHERE wsp.active = 1
    `;

    const params: any[] = [];

    if (categoryId) {
      query += ` AND vcc.id = ?`;
      params.push(categoryId);
    }

    query += ` ORDER BY wsp.id DESC`;

    const result = await this.legacyDb.$queryRawUnsafe<Array<any>>(query, ...params);

    // Konvertuj BigInt i numeričke vrednosti u JSON-serializabilne tipove
    return result.map(row => ({
      ...row,
      id: Number(row.id),
      service_id: Number(row.service_id),
      category_id: Number(row.category_id),
      fixed_charge: Number(row.fixed_charge),
      price: Number(row.price),
      usage_fee_from: Number(row.usage_fee_from),
      usage_fee_to: Number(row.usage_fee_to),
      VAT_rate: Number(row.VAT_rate),
      assign_by_default: Number(row.assign_by_default),
      active: Number(row.active),
    }));
  }

  async findOne(id: number) {
    const result = await this.legacyDb.$queryRawUnsafe<Array<any>>(
      `SELECT wsp.*,
              CONCAT(wsp.service_id, ' | ', vs.service) AS service,
              CONCAT(wsp.category_id, ' | ', vcc.category) AS category
       FROM vodovod_water_services_pricelist wsp
       LEFT JOIN vodovod_service vs ON wsp.service_id = vs.id
       LEFT JOIN vodovod_consumer_categories vcc ON wsp.category_id = vcc.id
       WHERE wsp.id = ?`,
      id,
    );

    if (!result || result.length === 0) {
      throw new NotFoundException(`Cenovnik sa ID ${id} nije pronađen`);
    }

    const row = result[0];
    return {
      ...row,
      id: Number(row.id),
      service_id: Number(row.service_id),
      category_id: Number(row.category_id),
      fixed_charge: Number(row.fixed_charge),
      price: Number(row.price),
      usage_fee_from: Number(row.usage_fee_from),
      usage_fee_to: Number(row.usage_fee_to),
      VAT_rate: Number(row.VAT_rate),
      assign_by_default: Number(row.assign_by_default),
      active: Number(row.active),
    };
  }

  async create(createDto: CreateWaterServicePriceDto) {
    try {
      // Validacija cene
      if (createDto.price <= 0) {
        throw new BadRequestException('Cena mora biti veća od nule!');
      }

      const {
        service_id,
        category_id,
        fixed_charge,
        price,
        usage_fee_from,
        usage_fee_to,
        VAT_rate,
        assign_by_default,
        document_name,
      } = createDto;

      await this.legacyDb.$executeRawUnsafe(
        `INSERT INTO vodovod_water_services_pricelist
         (service_id, category_id, fixed_charge, price, usage_fee_from, usage_fee_to, VAT_rate, assign_by_default, document_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        service_id,
        category_id,
        fixed_charge ?? 0,
        price,
        usage_fee_from ?? 0,
        usage_fee_to ?? 0,
        VAT_rate ?? 0,
        assign_by_default ? 1 : 0,
        document_name ?? null,
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
      if (error.code === 1062 || error.code === 'ER_DUP_ENTRY') {
        throw new ConflictException('Već postoji cenovnik za ovu uslugu i kategoriju.');
      }
      throw error;
    }
  }

  async update(id: number, updateDto: UpdateWaterServicePriceDto) {
    await this.findOne(id);

    // Validacija cene
    if (updateDto.price !== undefined && updateDto.price <= 0) {
      throw new BadRequestException('Cena mora biti veća od nule!');
    }

    try {
      const {
        service_id,
        category_id,
        fixed_charge,
        price,
        usage_fee_from,
        usage_fee_to,
        VAT_rate,
        assign_by_default,
        document_name,
      } = updateDto;

      await this.legacyDb.$executeRawUnsafe(
        `UPDATE vodovod_water_services_pricelist
         SET service_id = COALESCE(?, service_id),
             category_id = COALESCE(?, category_id),
             fixed_charge = COALESCE(?, fixed_charge),
             price = COALESCE(?, price),
             usage_fee_from = COALESCE(?, usage_fee_from),
             usage_fee_to = COALESCE(?, usage_fee_to),
             VAT_rate = COALESCE(?, VAT_rate),
             assign_by_default = COALESCE(?, assign_by_default),
             document_name = COALESCE(?, document_name)
         WHERE id = ?`,
        service_id ?? null,
        category_id ?? null,
        fixed_charge ?? null,
        price ?? null,
        usage_fee_from ?? null,
        usage_fee_to ?? null,
        VAT_rate ?? null,
        assign_by_default !== undefined ? (assign_by_default ? 1 : 0) : null,
        document_name ?? null,
        id,
      );

      return this.findOne(id);
    } catch (error) {
      if (error.code === 1062 || error.code === 'ER_DUP_ENTRY') {
        throw new ConflictException('Već postoji cenovnik za ovu uslugu i kategoriju.');
      }
      throw error;
    }
  }

  async remove(id: number) {
    await this.findOne(id);

    // Soft delete - postavi active na 0
    await this.legacyDb.$executeRawUnsafe(
      `UPDATE vodovod_water_services_pricelist SET active = 0 WHERE id = ?`,
      id,
    );

    return { success: true };
  }

  async searchCategoriesForList(
    query: string = '',
    pageNumber: number = 0,
    limit: number = 50,
  ) {
    const offset = pageNumber * limit;
    const searchQuery = `%${query}%`;

    const [data, total] = await Promise.all([
      this.legacyDb.$queryRawUnsafe<Array<{ id: number; category: string }>>(
        `SELECT id, category
         FROM vodovod_consumer_categories
         WHERE category LIKE ? OR CAST(id AS CHAR) LIKE ?
         ORDER BY id
         LIMIT ? OFFSET ?`,
        searchQuery,
        searchQuery,
        limit,
        offset,
      ),
      this.legacyDb.$queryRawUnsafe<Array<{ total: bigint }>>(
        `SELECT COUNT(*) as total
         FROM vodovod_consumer_categories
         WHERE category LIKE ? OR CAST(id AS CHAR) LIKE ?`,
        searchQuery,
        searchQuery,
      ),
    ]);

    const totalRows = Number(total[0]?.total ?? 0);
    const hasMore = offset + limit < totalRows;

    return {
      data: data.map((row) => `${row.id} | ${row.category}`),
      hasMore,
    };
  }

  async getPricelistHistory(
    pricelistId: number,
    startDate?: string,
    endDate?: string,
  ) {
    let query = `
      SELECT *
      FROM vodovod_water_services_pricelist_change_hist
      WHERE pricelist_id = ?
    `;

    const params: any[] = [pricelistId];

    if (startDate && endDate) {
      query += ` AND created_at BETWEEN ? AND ?`;
      params.push(startDate, endDate);
    } else if (startDate) {
      query += ` AND created_at >= ?`;
      params.push(startDate);
    } else if (endDate) {
      query += ` AND created_at <= ?`;
      params.push(endDate);
    }

    query += ` ORDER BY created_at DESC`;

    const result = await this.legacyDb.$queryRawUnsafe<Array<any>>(
      query,
      ...params,
    );

    // Konvertuj BigInt u Number
    return result.map((row) => ({
      ...row,
      id: Number(row.id),
      pricelist_id: Number(row.pricelist_id),
      service_id: Number(row.service_id),
      category_id: Number(row.category_id),
      fixed_charge: Number(row.fixed_charge),
      price: Number(row.price),
      usage_fee_from: Number(row.usage_fee_from),
      usage_fee_to: Number(row.usage_fee_to),
      VAT_rate: Number(row.VAT_rate),
      assign_by_default: Number(row.assign_by_default),
    }));
  }

  async searchPricelistServicesForList(
    query: string = '',
    pageNumber: number = 0,
    limit: number = 50,
  ) {
    const offset = pageNumber * limit;
    const searchQuery = `%${query}%`;

    const [data, total] = await Promise.all([
      this.legacyDb.$queryRawUnsafe<
        Array<{ id: number; service: string; category: string }>
      >(
        `SELECT
          vs.service,
          vwsp.id,
          vcc.category
         FROM vodovod_water_services_pricelist vwsp
         LEFT JOIN vodovod_service vs ON vwsp.service_id = vs.id
         LEFT JOIN vodovod_consumer_categories vcc ON vwsp.category_id = vcc.id
         WHERE (vs.service LIKE ? OR CAST(vs.id AS CHAR) LIKE ?)
         ORDER BY vs.id
         LIMIT ? OFFSET ?`,
        searchQuery,
        searchQuery,
        limit,
        offset,
      ),
      this.legacyDb.$queryRawUnsafe<Array<{ total: bigint }>>(
        `SELECT COUNT(*) as total
         FROM vodovod_water_services_pricelist vwsp
         LEFT JOIN vodovod_service vs ON vwsp.service_id = vs.id
         WHERE (vs.service LIKE ? OR CAST(vs.id AS CHAR) LIKE ?)`,
        searchQuery,
        searchQuery,
      ),
    ]);

    const totalRows = Number(total[0]?.total ?? 0);
    const hasMore = offset + limit < totalRows;

    return {
      data: data.map(
        (row) => `${row.id} | ${row.service} - ${row.category}`,
      ),
      hasMore,
    };
  }

  async getPricelistsByMeasuringPoint(idmm: number) {
    const query = `
      SELECT
        vc.sifra_potrosaca,
        vc.naziv_potrosaca,
        vws.service,
        vuas.pricelist_id
      FROM vodovod_consumers vc
      LEFT JOIN crm_contacts cc ON vc.sifra_potrosaca = cc.sifra_potrosaca
      LEFT JOIN vodovod_user_accounts vua ON vua.crm_contact_id = cc.id
      LEFT JOIN vodovod_user_account_services vuas ON vuas.user_account_id = vua.id
      LEFT JOIN vodovod_water_services_pricelist vwsp ON vwsp.id = vuas.pricelist_id
      LEFT JOIN vodovod_service vws ON vws.id = vwsp.service_id
      WHERE vc.idmm = ? AND vuas.pricelist_id IS NOT NULL
    `;

    const result = await this.legacyDb.$queryRawUnsafe<Array<any>>(
      query,
      idmm,
    );

    // Konvertuj BigInt u Number
    return result.map((row) => ({
      ...row,
      sifra_potrosaca: Number(row.sifra_potrosaca),
      pricelist_id: Number(row.pricelist_id),
    }));
  }
}
