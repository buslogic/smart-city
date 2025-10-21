import { Injectable } from '@nestjs/common';
import { PrismaLegacyService } from '../prisma-legacy/prisma-legacy.service';
import { CreateWaterSystemZoneDto } from './dto/create-water-system-zone.dto';
import { UpdateWaterSystemZoneDto } from './dto/update-water-system-zone.dto';
import { CreateZoneMeasuringPointDto } from './dto/create-zone-measuring-point.dto';
import { WaterSystemZone } from './entities/water-system-zone.entity';
import { ZoneMeasuringPoint } from './entities/zone-measuring-point.entity';

@Injectable()
export class WaterSystemZonesService {
  constructor(private prismaLegacy: PrismaLegacyService) {}

  async findAll(): Promise<WaterSystemZone[]> {
    const result = await this.prismaLegacy.$queryRawUnsafe<WaterSystemZone[]>(
      `SELECT vz.id, vz.zone_name, vz.type_id,
              CONCAT(vzt.id, ' | ', vzt.type_name) as type,
              vzt.type_name
       FROM vodovod_zones vz
       LEFT JOIN vodovod_zone_types vzt ON vzt.id = vz.type_id
       ORDER BY vz.id DESC`
    );
    return result;
  }

  async findOne(id: number): Promise<WaterSystemZone | null> {
    const result = await this.prismaLegacy.$queryRawUnsafe<WaterSystemZone[]>(
      `SELECT vz.id, vz.zone_name, vz.type_id,
              CONCAT(vzt.id, ' | ', vzt.type_name) as type,
              vzt.type_name
       FROM vodovod_zones vz
       LEFT JOIN vodovod_zone_types vzt ON vzt.id = vz.type_id
       WHERE vz.id = ?`,
      id
    );
    return result[0] || null;
  }

  async create(createDto: CreateWaterSystemZoneDto): Promise<WaterSystemZone> {
    await this.prismaLegacy.$executeRawUnsafe(
      `INSERT INTO vodovod_zones (zone_name, type_id) VALUES (?, ?)`,
      createDto.zone_name,
      createDto.type_id
    );

    const result = await this.prismaLegacy.$queryRawUnsafe<{ id: number }[]>(
      'SELECT LAST_INSERT_ID() as id'
    );

    const zone = await this.findOne(result[0].id);
    if (!zone) {
      throw new Error('Failed to create zone');
    }
    return zone;
  }

  async update(id: number, updateDto: UpdateWaterSystemZoneDto): Promise<WaterSystemZone> {
    const fields: string[] = [];
    const values: any[] = [];

    if (updateDto.zone_name !== undefined) {
      fields.push('zone_name = ?');
      values.push(updateDto.zone_name);
    }
    if (updateDto.type_id !== undefined) {
      fields.push('type_id = ?');
      values.push(updateDto.type_id);
    }

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    const query = `UPDATE vodovod_zones SET ${fields.join(', ')} WHERE id = ?`;
    values.push(id);

    await this.prismaLegacy.$executeRawUnsafe(query, ...values);

    const zone = await this.findOne(id);
    if (!zone) {
      throw new Error('Zone not found');
    }
    return zone;
  }

  async remove(id: number): Promise<boolean> {
    await this.prismaLegacy.$executeRawUnsafe(
      'DELETE FROM vodovod_zones WHERE id = ?',
      id
    );
    return true;
  }

  // Zone Types for SearchList
  async getZoneTypesForSearchList(search: string = '', page: number = 0, limit: number = 20): Promise<{ data: string[], hasMore: boolean }> {
    const offset = page * limit;
    const searchPattern = `%${search}%`;

    const results = await this.prismaLegacy.$queryRawUnsafe<{ type: string }[]>(
      `SELECT CONCAT(id, ' | ', type_name) as type
       FROM vodovod_zone_types
       WHERE type_name LIKE ?
       ORDER BY type_name
       LIMIT ? OFFSET ?`,
      searchPattern,
      limit + 1,
      offset
    );

    const hasMore = results.length > limit;
    const data = results.slice(0, limit).map((r) => r.type);

    return { data, hasMore };
  }

  // Zone Measuring Points
  async getZoneMeasuringPoints(zone_id: number): Promise<ZoneMeasuringPoint[]> {
    const results = await this.prismaLegacy.$queryRawUnsafe<ZoneMeasuringPoint[]>(
      `SELECT vzr.*, oa.address_name, vr.region_name
       FROM vodovod_zone_rel vzr
       LEFT JOIN vodovod_measuring_points vmp ON vmp.IDMM = vzr.idmm
       LEFT JOIN ordering_addresses oa ON oa.id = vmp.IDU
       LEFT JOIN vodovod_regions vr ON vr.id = oa.region_id
       WHERE vzr.zone_id = ?`,
      zone_id
    );
    return results;
  }

  async createZoneMeasuringPoint(createDto: CreateZoneMeasuringPointDto): Promise<{ success: boolean; message?: string; addedCount?: number }> {
    const idmms: number[] = [];

    // Add single idmm if provided
    if (createDto.idmm) {
      idmms.push(createDto.idmm);
    }

    // Add all idmms from region if region_id is provided
    if (createDto.region_id) {
      const regionIdmms = await this.getAllMeasuringPointsByRegionID(createDto.region_id);
      idmms.push(...regionIdmms);
    }

    // Remove duplicates
    const uniqueIdmms = [...new Set(idmms)];

    // Check which idmms already exist
    const existingIdmms = await this.prismaLegacy.$queryRawUnsafe<{ idmm: number }[]>(
      `SELECT idmm FROM vodovod_zone_rel WHERE zone_id = ? AND idmm IN (${uniqueIdmms.map(() => '?').join(',')})`,
      createDto.zone_id,
      ...uniqueIdmms
    );

    const existingIdmmSet = new Set(existingIdmms.map(r => r.idmm));
    const newIdmms = uniqueIdmms.filter(idmm => !existingIdmmSet.has(idmm));

    // Insert only new idmms
    let addedCount = 0;
    for (const idmm of newIdmms) {
      await this.prismaLegacy.$executeRawUnsafe(
        `INSERT INTO vodovod_zone_rel (zone_id, idmm) VALUES (?, ?)`,
        createDto.zone_id,
        idmm
      );
      addedCount++;
    }

    if (addedCount === 0 && existingIdmmSet.size > 0) {
      return {
        success: true,
        message: 'Sva merna mesta već postoje u ovoj zoni',
        addedCount: 0
      };
    }

    if (addedCount > 0 && existingIdmmSet.size > 0) {
      return {
        success: true,
        message: `Dodato ${addedCount} novih mernih mesta. ${existingIdmmSet.size} već postoji u zoni.`,
        addedCount
      };
    }

    return {
      success: true,
      message: `Uspešno dodato ${addedCount} mernih mesta`,
      addedCount
    };
  }

  async deleteZoneMeasuringPoint(zone_id: number, idmm: number): Promise<boolean> {
    await this.prismaLegacy.$executeRawUnsafe(
      `DELETE FROM vodovod_zone_rel WHERE zone_id = ? AND idmm = ?`,
      zone_id,
      idmm
    );
    return true;
  }

  private async getAllMeasuringPointsByRegionID(region_id: number): Promise<number[]> {
    const results = await this.prismaLegacy.$queryRawUnsafe<{ IDMM: number }[]>(
      `SELECT vmp.IDMM
       FROM ordering_addresses voa
       INNER JOIN vodovod_measuring_points vmp ON vmp.IDU = voa.id
       WHERE voa.region_id = ?`,
      region_id
    );
    return results.map(r => r.IDMM);
  }
}
