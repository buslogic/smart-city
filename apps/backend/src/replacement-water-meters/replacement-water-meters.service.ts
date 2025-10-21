import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaLegacyService } from '../prisma-legacy/prisma-legacy.service';
import { CreateReplacementWaterMeterDto } from './dto/create-replacement-water-meter.dto';
import { UpdateReplacementWaterMeterDto } from './dto/update-replacement-water-meter.dto';

@Injectable()
export class ReplacementWaterMetersService {
  constructor(private legacyDb: PrismaLegacyService) {}

  async findAll() {
    // IDENTIČAN UPIT kao u PHP ReplacementWaterMetersModel::getRows (linija 13)
    const replacements = await this.legacyDb.$queryRawUnsafe<any[]>(`
      SELECT rwm.*,
             CONCAT(t2.id, ' | ', t2.type) as type_id,
             CONCAT(t3.id, ' | ', t3.availability) as availability_id,
             CONCAT(t4.id, ' | ', t4.manufacturer) as manufacturer_id,
             t1.idv as old_idv,
             CONCAT(t5.IDMM, ' | ', oa.address_name) as measuring_point
      FROM vodovod_replaced_water_meter AS rwm
      LEFT JOIN vodovod_water_meter t1 ON rwm.replaced_id = t1.id
      LEFT JOIN vodovod_water_meter_type AS t2 ON t2.id = rwm.type
      LEFT JOIN vodovod_water_meter_availability AS t3 ON t3.id = rwm.availability
      LEFT JOIN vodovod_water_meter_manufacturer AS t4 ON t4.id = rwm.manufacturer
      LEFT JOIN vodovod_measuring_points AS t5 ON t5.IDMM = rwm.idmm
      LEFT JOIN ordering_addresses AS oa ON t5.IDU = oa.id
      ORDER BY rwm.id DESC
    `);

    // Transformiši snake_case u camelCase za frontend
    return replacements.map((r) => ({
      id: r.id,
      replacedId: r.replaced_id,
      counter: r.counter,
      idmm: r.idmm,
      idv: r.idv,
      calibratedFrom: r.calibrated_from,
      calibratedTo: r.calibrated_to,
      serialNumber: r.serial_number,
      type: r.type,
      manufacturer: r.manufacturer,
      availability: r.availability,
      module: r.module,
      replacementDate: r.replacement_date,
      changedBy: r.changed_by,
      editDatetime: r.edit_datetime,
      typeId: r.type_id,
      availabilityId: r.availability_id,
      manufacturerId: r.manufacturer_id,
      oldIdv: r.old_idv,
      measuringPoint: r.measuring_point,
    }));
  }

  async findOne(id: number) {
    // IDENTIČAN UPIT kao u PHP ReplacementWaterMetersModel::getRowById (linija 37)
    const replacements = await this.legacyDb.$queryRawUnsafe<any[]>(
      `
      SELECT rwm.*,
             CONCAT(t2.id, ' | ', t2.type) as type_id,
             CONCAT(t3.id, ' | ', t3.availability) as availability_id,
             CONCAT(t4.id, ' | ', t4.manufacturer) as manufacturer_id,
             t1.idv as old_idv,
             CONCAT(t5.IDMM, ' | ', oa.address_name) as measuring_point
      FROM vodovod_replaced_water_meter AS rwm
      LEFT JOIN vodovod_water_meter t1 ON rwm.replaced_id = t1.id
      LEFT JOIN vodovod_water_meter_type AS t2 ON t2.id = rwm.type
      LEFT JOIN vodovod_water_meter_availability AS t3 ON t3.id = rwm.availability
      LEFT JOIN vodovod_water_meter_manufacturer AS t4 ON t4.id = rwm.manufacturer
      LEFT JOIN vodovod_measuring_points AS t5 ON t5.IDMM = rwm.idmm
      LEFT JOIN ordering_addresses AS oa ON t5.IDU = oa.id
      WHERE rwm.id = ?
    `,
      id,
    );

    if (!replacements || replacements.length === 0) {
      throw new NotFoundException(`Zamenjen vodomer sa ID ${id} nije pronađen`);
    }

    const r = replacements[0];
    // Transformiši snake_case u camelCase za frontend
    return {
      id: r.id,
      replacedId: r.replaced_id,
      counter: r.counter,
      idmm: r.idmm,
      idv: r.idv,
      calibratedFrom: r.calibrated_from,
      calibratedTo: r.calibrated_to,
      serialNumber: r.serial_number,
      type: r.type,
      manufacturer: r.manufacturer,
      availability: r.availability,
      module: r.module,
      replacementDate: r.replacement_date,
      changedBy: r.changed_by,
      editDatetime: r.edit_datetime,
      typeId: r.type_id,
      availabilityId: r.availability_id,
      manufacturerId: r.manufacturer_id,
      oldIdv: r.old_idv,
      measuringPoint: r.measuring_point,
    };
  }

  async create(createDto: CreateReplacementWaterMeterDto) {
    const replacedId = createDto.replacedId ?? null;
    const counter = createDto.counter ?? null;
    const idv = createDto.idv ?? null;
    const idmm = createDto.idmm ?? null;
    const calibratedFrom = createDto.calibratedFrom ?? null;
    const calibratedTo = createDto.calibratedTo ?? null;
    const serialNumber = createDto.serialNumber ?? null;
    const typeId = createDto.type ?? null;
    const manufacturerId = createDto.manufacturer ?? null;
    const availabilityId = createDto.availability ?? null;
    const module = createDto.module ?? null;

    await this.legacyDb.$executeRawUnsafe(
      `INSERT INTO vodovod_replaced_water_meter (
        replaced_id, counter, idmm, idv, calibrated_from, calibrated_to,
        serial_number, type, manufacturer, availability, module
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      replacedId,
      counter,
      idmm,
      idv,
      calibratedFrom,
      calibratedTo,
      serialNumber,
      typeId,
      manufacturerId,
      availabilityId,
      module,
    );

    // Dohvati poslednji inserted ID
    const lastIdResult = await this.legacyDb.$queryRawUnsafe<any[]>('SELECT LAST_INSERT_ID() as id');
    const insertedId = lastIdResult[0]?.id;

    return this.findOne(insertedId);
  }

  async update(id: number, updateDto: UpdateReplacementWaterMeterDto) {
    await this.findOne(id);

    // IDENTIČNA LOGIKA kao u PHP ReplacementWaterMetersModel::editRow (linija 58)
    const counter = updateDto.counter;
    const idv = updateDto.idv;
    const idmm = updateDto.measuringPoint ? parseInt(updateDto.measuringPoint.split(' | ')[0]) : null;
    const calibratedFrom = updateDto.calibratedFrom;
    const calibratedTo = updateDto.calibratedTo;
    const serialNumber = updateDto.serialNumber;
    const typeId = updateDto.typeId ? parseInt(updateDto.typeId.split(' | ')[0]) : null;
    const manufacturerId = updateDto.manufacturerId ? parseInt(updateDto.manufacturerId.split(' | ')[0]) : null;
    const availabilityId = updateDto.availabilityId ? parseInt(updateDto.availabilityId.split(' | ')[0]) : null;
    const module = updateDto.module;

    await this.legacyDb.$executeRawUnsafe(
      `UPDATE vodovod_replaced_water_meter SET
        counter = ?,
        idmm = ?,
        idv = ?,
        calibrated_from = ?,
        calibrated_to = ?,
        serial_number = ?,
        type = ?,
        manufacturer = ?,
        availability = ?,
        module = ?
      WHERE id = ?`,
      counter,
      idmm,
      idv,
      calibratedFrom,
      calibratedTo,
      serialNumber,
      typeId,
      manufacturerId,
      availabilityId,
      module,
      id,
    );

    return this.findOne(id);
  }

  async remove(id: number) {
    await this.findOne(id);
    // IDENTIČAN UPIT kao u PHP ReplacementWaterMetersModel::deleteRow (linija 140)
    await this.legacyDb.$executeRawUnsafe(`DELETE FROM vodovod_replaced_water_meter WHERE id = ?`, id);
    return { success: true };
  }
}
