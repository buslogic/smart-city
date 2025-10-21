import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaLegacyService } from '../prisma-legacy/prisma-legacy.service';
import { CreateWaterMeterRemarkDto } from './dto/create-water-meter-remark.dto';
import { UpdateWaterMeterRemarkDto } from './dto/update-water-meter-remark.dto';

@Injectable()
export class WaterMeterRemarksService {
  constructor(private legacyDb: PrismaLegacyService) {}

  async findAll() {
    // IDENTIČAN UPIT kao u PHP WaterMeterRemarksModel::getRows (linija 11)
    const remarks = await this.legacyDb.$queryRawUnsafe<any[]>(`
      SELECT * FROM vodovod_water_meter_readings
      WHERE meter_reading != '-'
      ORDER BY id DESC
    `);

    // Transformiši snake_case u camelCase za frontend
    return remarks.map((remark) => ({
      id: remark.id,
      meterReading: remark.meter_reading,
      faulty: remark.faulty,
      unreadable: remark.unreadable,
      notFoundOnSite: remark.not_found_on_site,
      noMeter: remark.no_meter,
      negativeConsumption: remark.negative_consumption,
      transferToNextCl: remark.transfer_to_next_cl,
      billPrintout: remark.bill_printout,
      note: remark.note,
      userAccount: remark.user_account,
      canceled: remark.canceled,
      priority: remark.priority,
      average: remark.average,
      meterReaderOnly: remark.meter_reader_only,
      disconnected: remark.disconnected,
      censusSelect: remark.census_select,
    }));
  }

  async findOne(id: number) {
    // IDENTIČAN UPIT kao u PHP WaterMeterRemarksModel::getRowById (linija 205)
    const remarks = await this.legacyDb.$queryRawUnsafe<any[]>(
      `SELECT * FROM vodovod_water_meter_readings WHERE id = ?`,
      id,
    );

    if (!remarks || remarks.length === 0) {
      throw new NotFoundException(`Očitavanje vodomera sa ID ${id} nije pronađeno`);
    }

    const remark = remarks[0];
    // Transformiši snake_case u camelCase za frontend
    return {
      id: remark.id,
      meterReading: remark.meter_reading,
      faulty: remark.faulty,
      unreadable: remark.unreadable,
      notFoundOnSite: remark.not_found_on_site,
      noMeter: remark.no_meter,
      negativeConsumption: remark.negative_consumption,
      transferToNextCl: remark.transfer_to_next_cl,
      billPrintout: remark.bill_printout,
      note: remark.note,
      userAccount: remark.user_account,
      canceled: remark.canceled,
      priority: remark.priority,
      average: remark.average,
      meterReaderOnly: remark.meter_reader_only,
      disconnected: remark.disconnected,
      censusSelect: remark.census_select,
    };
  }

  async create(createDto: CreateWaterMeterRemarkDto) {
    // IDENTIČNA LOGIKA kao u PHP WaterMeterRemarksModel::addRow (linija 24-108)
    const data: any = {
      meter_reading: createDto.meterReading || '',
      faulty: createDto.faulty || 0,
      unreadable: createDto.unreadable || 0,
      not_found_on_site: createDto.notFoundOnSite || 0,
      no_meter: createDto.noMeter || 0,
      negative_consumption: createDto.negativeConsumption || 0,
      transfer_to_next_cl: createDto.transferToNextCl || 0,
      bill_printout: createDto.billPrintout || 0,
      note: createDto.note || '',
      user_account: createDto.userAccount || '',
      canceled: createDto.canceled || 0,
      priority: createDto.priority || 0,
      average: createDto.average || 0,
      meter_reader_only: createDto.meterReaderOnly || 0,
      disconnected: createDto.disconnected || 0,
      census_select: createDto.censusSelect || 0,
    };

    const columns = Object.keys(data);
    const placeholders = columns.map(() => '?').join(',');
    const values = Object.values(data);

    const result = await this.legacyDb.$executeRawUnsafe(
      `INSERT INTO vodovod_water_meter_readings (${columns.join(',')}) VALUES (${placeholders})`,
      ...values,
    );

    // Dohvati poslednji inserted ID
    const lastIdResult = await this.legacyDb.$queryRawUnsafe<any[]>('SELECT LAST_INSERT_ID() as id');
    const insertedId = lastIdResult[0]?.id;

    return this.findOne(insertedId);
  }

  async update(id: number, updateDto: UpdateWaterMeterRemarkDto) {
    await this.findOne(id);

    // IDENTIČNA LOGIKA kao u PHP WaterMeterRemarksModel::editRow (linija 111-201)
    const data: any = {};

    if (updateDto.meterReading !== undefined) data.meter_reading = updateDto.meterReading;
    if (updateDto.faulty !== undefined) data.faulty = updateDto.faulty;
    if (updateDto.unreadable !== undefined) data.unreadable = updateDto.unreadable;
    if (updateDto.notFoundOnSite !== undefined) data.not_found_on_site = updateDto.notFoundOnSite;
    if (updateDto.noMeter !== undefined) data.no_meter = updateDto.noMeter;
    if (updateDto.negativeConsumption !== undefined) data.negative_consumption = updateDto.negativeConsumption;
    if (updateDto.transferToNextCl !== undefined) data.transfer_to_next_cl = updateDto.transferToNextCl;
    if (updateDto.billPrintout !== undefined) data.bill_printout = updateDto.billPrintout;
    if (updateDto.note !== undefined) data.note = updateDto.note;
    if (updateDto.userAccount !== undefined) data.user_account = updateDto.userAccount;
    if (updateDto.canceled !== undefined) data.canceled = updateDto.canceled;
    if (updateDto.priority !== undefined) data.priority = updateDto.priority;
    if (updateDto.average !== undefined) data.average = updateDto.average;
    if (updateDto.meterReaderOnly !== undefined) data.meter_reader_only = updateDto.meterReaderOnly;
    if (updateDto.disconnected !== undefined) data.disconnected = updateDto.disconnected;
    if (updateDto.censusSelect !== undefined) data.census_select = updateDto.censusSelect;
    if (updateDto.availability !== undefined) data.availability = updateDto.availability;

    if (Object.keys(data).length === 0) {
      return this.findOne(id);
    }

    const setClause = Object.keys(data)
      .map((key) => `${key} = ?`)
      .join(', ');
    const values = [...Object.values(data), id];

    await this.legacyDb.$executeRawUnsafe(`UPDATE vodovod_water_meter_readings SET ${setClause} WHERE id = ?`, ...values);

    return this.findOne(id);
  }

  async remove(id: number) {
    await this.findOne(id);
    // IDENTIČAN UPIT kao u PHP WaterMeterRemarksModel::deleteRow (linija 217)
    await this.legacyDb.$executeRawUnsafe(`DELETE FROM vodovod_water_meter_readings WHERE id = ?`, id);
    return { success: true };
  }
}
