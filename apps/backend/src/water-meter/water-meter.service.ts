import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaLegacyService } from '../prisma-legacy/prisma-legacy.service';
import { CreateWaterMeterDto } from './dto/create-water-meter.dto';
import { UpdateWaterMeterDto } from './dto/update-water-meter.dto';

@Injectable()
export class WaterMeterService {
  constructor(
    private legacyDb: PrismaLegacyService,
  ) {}

  async findAll() {
    // IDENTIČAN UPIT kao u PHP WaterMeterModel::getWaterMeterRows (linija 21-32)
    const waterMeters = await this.legacyDb.$queryRawUnsafe<any[]>(`
      SELECT t1.id, t1.idmm, oa.address_name as adresa, CONCAT(t2.id, ' | ', t2.type) as type_id, CONCAT(t3.id, ' | ', t3.availability) as availability_id, CONCAT(t4.id, ' | ', t4.manufacturer) as manufacturer_id,
            t1.calibrated_from, t1.calibrated_to, t1.serial_number, t1.counter, t1.idv, t1.module,
            t1.disconnection_date
        FROM vodovod_water_meter AS t1
        LEFT JOIN vodovod_water_meter_type AS t2 ON t2.id = t1.type_id
        LEFT JOIN vodovod_water_meter_availability AS t3 ON t3.id = t1.availability_id
        LEFT JOIN vodovod_water_meter_manufacturer AS t4 ON t4.id = t1.manufacturer_id
        LEFT JOIN vodovod_measuring_points AS t5 ON t5.IDMM = t1.idmm
		LEFT JOIN ordering_addresses AS oa ON t5.IDU = oa.id
		WHERE t1.aktivan = 1
        ORDER BY t1.id DESC
    `);

    // IDENTIČNO formatiranje kao u PHP (linija 44)
    return waterMeters.map((wm) => ({
      ...wm,
      measuring_point: !wm.idmm || wm.idmm === '' ? '' : `${wm.idmm} | ${wm.adresa || ''}`,
    }));
  }

  async findOne(id: number) {
    // IDENTIČAN UPIT kao u PHP WaterMeterModel::getWaterMeterByRowID (linija 52-72)
    const result = await this.legacyDb.$queryRawUnsafe<any[]>(
      `SELECT t1.id, t1.idmm, oa.address_name as adresa,
              CONCAT(t2.id, ' ', t2.type) as type_id,
              CONCAT(t3.id, ' ', t3.availability) as availability_id,
              CONCAT(t4.id, ' ', t4.manufacturer) as manufacturer_id,
              t1.calibrated_from, t1.calibrated_to, t1.serial_number, t1.counter, t1.idv, t1.module,
              t1.disconnection_date
       FROM vodovod_water_meter AS t1
       LEFT JOIN vodovod_water_meter_type AS t2 ON t2.id = t1.type_id
       LEFT JOIN vodovod_water_meter_availability AS t3 ON t3.id = t1.availability_id
       LEFT JOIN vodovod_water_meter_manufacturer AS t4 ON t4.id = t1.manufacturer_id
       LEFT JOIN vodovod_measuring_points AS t5 ON t5.IDMM = t1.idmm
       LEFT JOIN ordering_addresses AS oa ON t5.IDU = oa.id
       WHERE t1.id = ?`,
      id,
    );

    if (!result || result.length === 0) {
      throw new NotFoundException(`Vodomer sa ID ${id} nije pronađen`);
    }

    const row = result[0];
    // IDENTIČNO formatiranje kao u PHP (linija 70)
    return {
      ...row,
      measuring_point: !row.idmm || row.idmm === '' ? '' : `${row.idmm} | ${row.adresa || ''}`,
    };
  }

  async create(createDto: CreateWaterMeterDto) {
    // Upisuj u legacy bazu kao u PHP WaterMeterModel::addRow
    const result = await this.legacyDb.$executeRawUnsafe(
      `INSERT INTO vodovod_water_meter (
        idmm, counter, idv, availability_id, type_id, manufacturer_id,
        serial_number, calibrated_from, calibrated_to, module, aktivan
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      createDto.idmm ?? null,
      createDto.counter ?? null,
      createDto.idv ?? null,
      createDto.availabilityId ?? null,
      createDto.typeId ?? null,
      createDto.manufacturerId ?? null,
      createDto.serialNumber ?? null,
      createDto.calibratedFrom ?? null,
      createDto.calibratedTo ?? null,
      createDto.module ?? null,
      createDto.aktivan ? 1 : 0,
    );

    // Vrati sve vodomere da bi frontend dobio ažuriranu listu
    return this.findAll();
  }

  async update(id: number, updateDto: UpdateWaterMeterDto) {
    await this.findOne(id);

    // Ažuriraj u legacy bazi
    await this.legacyDb.$executeRawUnsafe(
      `UPDATE vodovod_water_meter SET
        idmm = ?, counter = ?, idv = ?, availability_id = ?, type_id = ?, manufacturer_id = ?,
        serial_number = ?, calibrated_from = ?, calibrated_to = ?, module = ?, aktivan = ?
      WHERE id = ?`,
      updateDto.idmm ?? null,
      updateDto.counter ?? null,
      updateDto.idv ?? null,
      updateDto.availabilityId ?? null,
      updateDto.typeId ?? null,
      updateDto.manufacturerId ?? null,
      updateDto.serialNumber ?? null,
      updateDto.calibratedFrom ?? null,
      updateDto.calibratedTo ?? null,
      updateDto.module ?? null,
      updateDto.aktivan ? 1 : 0,
      id,
    );

    // Vrati sve vodomere da bi frontend dobio ažuriranu listu
    return this.findAll();
  }

  async remove(id: number) {
    await this.findOne(id);
    // Obriši iz legacy baze (soft delete - postavi aktivan na 0)
    await this.legacyDb.$executeRawUnsafe(
      `UPDATE vodovod_water_meter SET aktivan = 0 WHERE id = ?`,
      id,
    );
    return { success: true };
  }

  async searchMeasuringPoints(query: string = '', pageNumber: number = 0, limit: number = 50) {
    // IDENTIČAN UPIT kao u PHP WaterMeterModel::getMeasuringPointsForSL (linija 108-154)
    const offset = pageNumber * limit;
    const searchQuery = `%${query}%`;

    // Prvo izvršimo glavni upit za podatke (PHP linija 115-126)
    const data = await this.legacyDb.$queryRawUnsafe<Array<{ IDMM: number; adresa: string }>>(
      `SELECT IDMM, oa.address_name AS adresa
		FROM vodovod_measuring_points mp
		LEFT JOIN ordering_addresses oa on mp.IDU = oa.id
			WHERE (oa.address_name LIKE ? OR mp.IDMM LIKE ?) AND mp.aktivan = 1
			ORDER BY IDMM
			LIMIT ?, ?`,
      searchQuery,
      searchQuery,
      offset,
      limit,
    );

    // Zatim izvršimo COUNT upit (PHP linija 136-146)
    const countResult = await this.legacyDb.$queryRawUnsafe<Array<{ total: bigint }>>(
      `SELECT COUNT(*) as total
			FROM vodovod_measuring_points mp
			LEFT JOIN ordering_addresses oa ON mp.IDU = oa.id
	        WHERE (oa.address_name LIKE ? OR mp.IDMM LIKE ?) AND mp.aktivan = 1`,
      searchQuery,
      searchQuery,
    );

    const totalRows = Number(countResult[0]?.total ?? 0);
    const hasMore = offset + limit < totalRows; // PHP linija 148

    // IDENTIČNO formatiranje kao u PHP (linija 131)
    return {
      data: data.map((row) => `${row.IDMM} | ${row.adresa}`),
      hasMore,
    };
  }

  async getMeasuringPointByIDMM(idmm: number) {
    // IDENTIČAN UPIT kao u PHP WaterMeterModel::getMeasuingPointByIDMM
    const result = await this.legacyDb.$queryRawUnsafe<any[]>(
      `SELECT t1.*, t2.tip AS tip, t3.status AS mps_status, t4.idv as IDV
       FROM vodovod_measuring_points AS t1
       LEFT JOIN vodovod_calculation_type AS t2 ON t1.type_id = t2.Id
       LEFT JOIN vodovod_measuring_points_status AS t3 ON t3.id = t1.status
       LEFT JOIN vodovod_water_meter AS t4 ON t4.idmm = t1.IDMM
       WHERE t1.IDMM = ?`,
      idmm,
    );

    if (!result || result.length === 0) {
      throw new NotFoundException(`Merno mesto sa IDMM ${idmm} nije pronađeno`);
    }

    return this.convertBigIntAndDecimal(result[0]);
  }

  // Helper funkcija koja konvertuje sve BigInt i Decimal vrednosti u Number/String
  private convertBigIntAndDecimal(obj: any): any {
    if (obj === null || obj === undefined) return obj;

    // BigInt konverzija
    if (typeof obj === 'bigint') {
      return Number(obj);
    }

    // Date objekat - vrati kao string ili ostavi Date
    if (obj instanceof Date) {
      return obj;
    }

    // Prisma Decimal detekcija
    if (obj && typeof obj === 'object') {
      if (typeof obj.toNumber === 'function') {
        return obj.toNumber();
      }

      if ('s' in obj && 'e' in obj && 'd' in obj) {
        const keys = Object.keys(obj);
        if (keys.includes('s') && keys.includes('e') && keys.includes('d')) {
          try {
            const sign = obj.s;
            const exp = obj.e;
            const digits = obj.d;

            if (!Array.isArray(digits)) {
              return obj;
            }

            let num = 0;
            for (let i = 0; i < digits.length; i++) {
              num = num * 10 + digits[i];
            }
            num = num * Math.pow(10, exp - digits.length + 1);
            return sign === -1 ? -num : num;
          } catch (e) {
            console.warn('Decimal conversion failed, returning raw object', e);
            return obj;
          }
        }
      }

      // Prazan objekat ili objekat bez poznatih svojstava - vrati null
      if (Object.keys(obj).length === 0) {
        return null;
      }
    }

    // Rekurzivna obrada nizova
    if (Array.isArray(obj)) {
      return obj.map(item => this.convertBigIntAndDecimal(item));
    }

    // Rekurzivna obrada objekata
    if (typeof obj === 'object') {
      const converted: any = {};
      for (const key in obj) {
        converted[key] = this.convertBigIntAndDecimal(obj[key]);
      }
      return converted;
    }

    return obj;
  }

  async getUnassignedWaterMetersForSL(params: { query?: string; pageNumber?: number }) {
    const query = params.query || '';
    const pageNumber = params.pageNumber || 0;
    const limit = 30;
    const offset = pageNumber * limit;
    const searchQuery = `%${query}%`;

    const sql = `
      SELECT mm.id, mm.idv
      FROM vodovod_water_meter mm
      WHERE mm.idmm IS NULL
        AND (mm.idv LIKE ? OR mm.id LIKE ?)
      ORDER BY mm.id
      LIMIT ? OFFSET ?
    `;

    const rows = await this.legacyDb.$queryRawUnsafe<any[]>(
      sql,
      searchQuery,
      searchQuery,
      limit,
      offset,
    );

    const data = rows.map((row: any) => `${row.id} | ${row.idv}`);

    const countSql = `
      SELECT COUNT(*) as total
      FROM vodovod_water_meter mm
      WHERE mm.idmm IS NULL
        AND (mm.idv LIKE ? OR mm.id LIKE ?)
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

  async getWaterMeterByIDMM(idmm: number) {
    const result = await this.legacyDb.$queryRawUnsafe<any[]>(
      `SELECT t1.id, t1.idmm, oa.address_name as adresa,
              CONCAT(t2.id, ' | ', t2.type) as type_id,
              CONCAT(t3.id, ' | ', t3.availability) as availability_id,
              CONCAT(t4.id, ' | ', t4.manufacturer) as manufacturer_id,
              t1.calibrated_from, t1.calibrated_to, t1.serial_number,
              t1.counter, t1.idv, t1.module, t1.disconnection_date
       FROM vodovod_water_meter AS t1
       LEFT JOIN vodovod_water_meter_type AS t2 ON t2.id = t1.type_id
       LEFT JOIN vodovod_water_meter_availability AS t3 ON t3.id = t1.availability_id
       LEFT JOIN vodovod_water_meter_manufacturer AS t4 ON t4.id = t1.manufacturer_id
       LEFT JOIN vodovod_measuring_points AS t5 ON t5.IDMM = t1.idmm
       LEFT JOIN ordering_addresses AS oa ON t5.IDU = oa.id
       WHERE t1.idmm = ? AND t1.aktivan = 1`,
      idmm,
    );

    if (!result || result.length === 0) {
      throw new NotFoundException(`Vodomer sa IDMM ${idmm} nije pronađen`);
    }

    const wm = result[0];
    return {
      ...wm,
      measuring_point: !wm.idmm || wm.idmm === '' ? '' : `${wm.idmm} | ${wm.adresa || ''}`,
    };
  }

  async getWaterMeterHistoryByIDV(idv: number) {
    // IDENTIČAN UPIT kao u PHP WaterMeterModel::getWaterMeterHistoryByIDV
    const query = `
      SELECT t1.*, t2.translate, t3.real_name as changed_by
      FROM vodovod_water_meter_change_history AS t1
      LEFT JOIN vodovod_change_type AS t2 ON t2.id = t1.change_type
      LEFT JOIN users AS t3 ON t3.id = t1.changed_by
      WHERE t1.idv = ?
      ORDER BY id
    `;

    const result = await this.legacyDb.$queryRawUnsafe<any[]>(query, idv);
    return result;
  }

  async getAssignedUser(id: number) {
    // IDENTIČAN UPIT kao u PHP WaterMeterModel::getAssignedUser
    const query = `
      SELECT vwm.sifra_potrosaca, vwm.sifra_kupca, vua.id
      FROM vodovod_water_meter vwm
      LEFT JOIN crm_contacts cc ON cc.sifra_potrosaca = vwm.sifra_potrosaca OR cc.sifra_kupca = vwm.sifra_kupca
      LEFT JOIN crm_accounts ca ON ca.sifra_potrosaca = vwm.sifra_potrosaca OR ca.sifra_kupca = vwm.sifra_kupca
      LEFT JOIN vodovod_user_accounts vua ON vua.crm_contact_id = cc.id OR vua.crm_account_id = ca.id
      WHERE vwm.id = ?
    `;

    const result = await this.legacyDb.$queryRawUnsafe<any[]>(query, id);

    if (!result || result.length === 0) {
      return null;
    }

    return result[0];
  }

  async assignWaterMeterToUser(data: { id: number; sifra_potrosaca?: string; sifra_kupca?: string }) {
    // IDENTIČNO kao u PHP WaterMeterModel::assignWaterMeterToUser
    const fields: string[] = [];
    const params: any[] = [];

    if (data.sifra_potrosaca !== undefined) {
      fields.push('sifra_potrosaca = ?');
      params.push(data.sifra_potrosaca === '' ? null : parseInt(data.sifra_potrosaca));
    }

    if (data.sifra_kupca !== undefined) {
      fields.push('sifra_kupca = ?');
      params.push(data.sifra_kupca === '' ? null : parseInt(data.sifra_kupca));
    }

    if (fields.length === 0) {
      return false;
    }

    params.push(data.id);

    const query = `UPDATE vodovod_water_meter SET ${fields.join(', ')} WHERE id = ?`;

    const result = await this.legacyDb.$executeRawUnsafe(query, ...params);

    return result > 0;
  }
}
