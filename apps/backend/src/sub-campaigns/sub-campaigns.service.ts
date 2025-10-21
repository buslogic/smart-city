import { Injectable } from '@nestjs/common';
import { PrismaLegacyService } from '../prisma-legacy/prisma-legacy.service';
import { CreateSubCampaignDto } from './dto/create-sub-campaign.dto';
import { UpdateSubCampaignDto } from './dto/update-sub-campaign.dto';
import { SearchQueryDto } from './dto/search-query.dto';

@Injectable()
export class SubCampaignsService {
  constructor(private prismaLegacy: PrismaLegacyService) {}

  async getRows() {
    const query = `
      SELECT sc.*,
        CONCAT(ss.id, ' | ', ss.naziv) as status_id,
        CONCAT(r.id, ' | ', r.region_name) as region_id,
        CONCAT(re.id, ' | ', re.first_name, ' ', re.last_name) as citac_id,
        CONCAT(c.id, ' | ', c.godina, '-', c.mesec) as kampanja
      FROM vodovod_sub_campaign sc
      LEFT JOIN vodovod_sub_campaign_status ss on sc.status_id = ss.id
      LEFT JOIN vodovod_regions r on sc.region_id = r.id
      LEFT JOIN vodovod_readers re on sc.citac_id = re.id
      LEFT JOIN vodovod_campaign c on sc.kampanja_id = c.id
      ORDER BY sc.id DESC
    `;

    const rows = await this.prismaLegacy.$queryRawUnsafe<any[]>(query);
    return rows;
  }

  async getRowById(id: number) {
    const query = `
      SELECT sc.*,
        CONCAT(ss.id, ' | ', ss.naziv) as status_id,
        CONCAT(r.id, ' | ', r.region_name) as region_id,
        CONCAT(re.id, ' | ', re.first_name, ' ', re.last_name) as citac_id,
        CONCAT(c.id, ' | ', c.godina, '-', c.mesec) as kampanja
      FROM vodovod_sub_campaign sc
      LEFT JOIN vodovod_sub_campaign_status ss on sc.status_id = ss.id
      LEFT JOIN vodovod_regions r on sc.region_id = r.id
      LEFT JOIN vodovod_readers re on sc.citac_id = re.id
      LEFT JOIN vodovod_campaign c on sc.kampanja_id = c.id
      WHERE sc.id = ?
    `;

    const rows = await this.prismaLegacy.$queryRawUnsafe<any[]>(query, id);
    return rows.length > 0 ? rows[0] : null;
  }

  async getCampaignForSL(searchDto: SearchQueryDto) {
    const query = searchDto.query || '';
    const pageNumber = searchDto.pageNumber || 0;
    const limit = 30;
    const offset = pageNumber * limit;
    const searchQuery = `%${query}%`;

    const sql = `
      SELECT c.id, CONCAT(c.godina, '-', c.mesec) as kampanja
      FROM vodovod_campaign c
      WHERE (c.godina LIKE ? OR c.mesec LIKE ? OR c.id LIKE ?)
      ORDER BY c.id
      LIMIT ? OFFSET ?
    `;

    const rows = await this.prismaLegacy.$queryRawUnsafe<any[]>(
      sql,
      searchQuery,
      searchQuery,
      searchQuery,
      limit,
      offset,
    );

    const data = rows.map((row) => `${row.id} | ${row.kampanja}`);

    const countSql = `
      SELECT COUNT(*) as total
      FROM vodovod_campaign c
      WHERE (c.godina LIKE ? OR c.mesec LIKE ? OR c.id LIKE ?)
    `;

    const countResult = await this.prismaLegacy.$queryRawUnsafe<any[]>(
      countSql,
      searchQuery,
      searchQuery,
      searchQuery,
    );
    const totalRows = countResult[0]?.total || 0;
    const hasMore = offset + limit < totalRows;

    return {
      data,
      hasMore,
    };
  }

  async getStatusForSL(searchDto: SearchQueryDto) {
    const query = searchDto.query || '';
    const pageNumber = searchDto.pageNumber || 0;
    const limit = 30;
    const offset = pageNumber * limit;
    const searchQuery = `%${query}%`;

    const sql = `
      SELECT ss.id, ss.naziv as status_id
      FROM vodovod_sub_campaign_status ss
      WHERE (ss.naziv LIKE ? OR ss.id LIKE ?)
      ORDER BY ss.id
      LIMIT ? OFFSET ?
    `;

    const rows = await this.prismaLegacy.$queryRawUnsafe<any[]>(
      sql,
      searchQuery,
      searchQuery,
      limit,
      offset,
    );

    const data = rows.map((row) => `${row.id} | ${row.status_id}`);

    const countSql = `
      SELECT COUNT(*) as total
      FROM vodovod_sub_campaign_status ss
      WHERE (ss.naziv LIKE ? OR ss.id LIKE ?)
    `;

    const countResult = await this.prismaLegacy.$queryRawUnsafe<any[]>(
      countSql,
      searchQuery,
      searchQuery,
    );
    const totalRows = countResult[0]?.total || 0;
    const hasMore = offset + limit < totalRows;

    return {
      data,
      hasMore,
    };
  }

  async getRegionForSL(searchDto: SearchQueryDto) {
    const query = searchDto.query || '';
    const pageNumber = searchDto.pageNumber || 0;
    const limit = 30;
    const offset = pageNumber * limit;
    const searchQuery = `%${query}%`;

    const sql = `
      SELECT r.id, r.region_name as region_id
      FROM vodovod_regions r
      WHERE (r.region_name LIKE ? OR r.id LIKE ?)
      ORDER BY r.id
      LIMIT ? OFFSET ?
    `;

    const rows = await this.prismaLegacy.$queryRawUnsafe<any[]>(
      sql,
      searchQuery,
      searchQuery,
      limit,
      offset,
    );

    const data = rows.map((row) => `${row.id} | ${row.region_id}`);

    const countSql = `
      SELECT COUNT(*) as total
      FROM vodovod_regions r
      WHERE (r.region_name LIKE ? OR r.id LIKE ?)
    `;

    const countResult = await this.prismaLegacy.$queryRawUnsafe<any[]>(
      countSql,
      searchQuery,
      searchQuery,
    );
    const totalRows = countResult[0]?.total || 0;
    const hasMore = offset + limit < totalRows;

    return {
      data,
      hasMore,
    };
  }

  async getCitacForSL(searchDto: SearchQueryDto) {
    const query = searchDto.query || '';
    const pageNumber = searchDto.pageNumber || 0;
    const limit = 30;
    const offset = pageNumber * limit;
    const searchQuery = `%${query}%`;

    const sql = `
      SELECT r.id, CONCAT(r.first_name, ' ', r.last_name) as citac_id
      FROM vodovod_readers r
      WHERE (r.first_name LIKE ? OR r.last_name LIKE ? OR r.id LIKE ?)
      ORDER BY r.id
      LIMIT ? OFFSET ?
    `;

    const rows = await this.prismaLegacy.$queryRawUnsafe<any[]>(
      sql,
      searchQuery,
      searchQuery,
      searchQuery,
      limit,
      offset,
    );

    const data = rows.map((row) => `${row.id} | ${row.citac_id}`);

    const countSql = `
      SELECT COUNT(*) as total
      FROM vodovod_readers r
      WHERE (r.first_name LIKE ? OR r.last_name LIKE ? OR r.id LIKE ?)
    `;

    const countResult = await this.prismaLegacy.$queryRawUnsafe<any[]>(
      countSql,
      searchQuery,
      searchQuery,
      searchQuery,
    );
    const totalRows = countResult[0]?.total || 0;
    const hasMore = offset + limit < totalRows;

    return {
      data,
      hasMore,
    };
  }

  async addRow(createDto: CreateSubCampaignDto) {
    try {
      // Parse kampanja_id from format "ID | YYYY-MM"
      let kampanjaId = createDto.kampanja_id;
      if (!kampanjaId && createDto.kampanja) {
        kampanjaId = parseInt(createDto.kampanja.split(' | ')[0]);
      }

      // Extract IDs from "ID | Name" format
      const statusId = createDto.status_id.split(' | ')[0];
      const regionId = createDto.region_id.split(' | ')[0];
      const citacId = createDto.citac_id.split(' | ')[0];

      const query = `
        INSERT INTO vodovod_sub_campaign (kampanja_id, dan, vreme_od, vreme_do, region_id, citac_id, status_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      await this.prismaLegacy.$executeRawUnsafe(
        query,
        kampanjaId,
        createDto.dan,
        createDto.vreme_od,
        createDto.vreme_do,
        regionId,
        citacId,
        statusId,
      );

      // Get last inserted ID
      const idResult = await this.prismaLegacy.$queryRawUnsafe<any[]>(
        'SELECT LAST_INSERT_ID() as id',
      );
      const insertedId = idResult[0].id;

      const row = await this.getRowById(insertedId);

      if (row) {
        return { success: true, message: 'Successful!', data: row };
      }

      return { success: false, message: 'Failed to get the data' };
    } catch (error) {
      console.error('Error when adding the row:', error);
      return { success: false, error: error.message };
    }
  }

  async editRow(id: number, updateDto: UpdateSubCampaignDto) {
    try {
      // Get current data for change history
      const currentQuery = `SELECT * FROM vodovod_sub_campaign WHERE id = ?`;
      const currentResult = await this.prismaLegacy.$queryRawUnsafe<any[]>(
        currentQuery,
        id,
      );

      if (currentResult.length === 0) {
        console.error('No record found with id:', id);
        return { success: false, message: 'Record not found' };
      }

      const currentData = currentResult[0];

      // Parse kampanja_id
      let kampanjaId = updateDto.kampanja_id || currentData.kampanja_id;
      if (updateDto.kampanja && !updateDto.kampanja_id) {
        kampanjaId = parseInt(updateDto.kampanja.split(' | ')[0]);
      }

      // Extract IDs from "ID | Name" format
      const statusId = updateDto.status_id
        ? updateDto.status_id.split(' | ')[0]
        : currentData.status_id;
      const regionId = updateDto.region_id
        ? updateDto.region_id.split(' | ')[0]
        : currentData.region_id;
      const citacId = updateDto.citac_id
        ? updateDto.citac_id.split(' | ')[0]
        : currentData.citac_id;

      const query = `
        UPDATE vodovod_sub_campaign
        SET kampanja_id = ?, dan = ?, vreme_od = ?, vreme_do = ?, region_id = ?, citac_id = ?, status_id = ?
        WHERE id = ?
      `;

      await this.prismaLegacy.$executeRawUnsafe(
        query,
        kampanjaId,
        updateDto.dan !== undefined ? updateDto.dan : currentData.dan,
        updateDto.vreme_od !== undefined
          ? updateDto.vreme_od
          : currentData.vreme_od,
        updateDto.vreme_do !== undefined
          ? updateDto.vreme_do
          : currentData.vreme_do,
        regionId,
        citacId,
        statusId,
        id,
      );

      // Change history logging
      const changeTypesQuery = `
        SELECT id, type, translate
        FROM vodovod_change_type
      `;
      const changeTypesResult = await this.prismaLegacy.$queryRawUnsafe<any[]>(
        changeTypesQuery,
      );

      const changeTypes: Record<string, { id: number; translate: string }> = {};
      changeTypesResult.forEach((row) => {
        changeTypes[row.type] = { id: row.id, translate: row.translate };
      });

      const fieldMapping: Record<
        string,
        { col: string; part: number | null }
      > = {
        kampanja: { col: 'kampanja_id', part: null },
        dan: { col: 'dan', part: null },
        vreme_od: { col: 'vreme_od', part: null },
        vreme_do: { col: 'vreme_do', part: null },
        region_id: { col: 'region_id', part: null },
        citac_id: { col: 'citac_id', part: null },
        status_id: { col: 'status_id', part: null },
      };

      const changes: any[] = [];
      const userId = updateDto.changed_by;

      // Detect changes
      for (const [field, info] of Object.entries(changeTypes)) {
        if (!fieldMapping[field]) continue;

        const col = fieldMapping[field].col;

        let newValue: any;
        let oldValue: any;

        if (field === 'kampanja') newValue = kampanjaId;
        else if (field === 'region_id') newValue = regionId;
        else if (field === 'citac_id') newValue = citacId;
        else if (field === 'status_id') newValue = statusId;
        else newValue = updateDto[field];

        if (newValue === undefined) continue;

        oldValue = currentData[col];

        if (newValue != oldValue) {
          changes.push({
            change_type_id: info.id,
            note: `Nova vrednost: '${newValue}', prethodna vrednost: '${oldValue}'`,
            change_date: new Date(),
            changed_by: userId,
            old_value: oldValue,
            new_value: newValue,
          });
        }
      }

      // Log changes to history
      for (const change of changes) {
        const insertQuery = `
          INSERT INTO vodovod_sub_campaign_change_history (
            sub_campaign_id,
            change_type,
            note,
            change_date,
            changed_by,
            old_value,
            new_value
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        await this.prismaLegacy.$executeRawUnsafe(
          insertQuery,
          id,
          change.change_type_id,
          change.note,
          change.change_date,
          change.changed_by,
          change.old_value,
          change.new_value,
        );
      }

      const row = await this.getRowById(id);

      if (row) {
        return { success: true, message: 'Successful!', data: row };
      }

      return { success: false, message: 'Failed to get the data' };
    } catch (error) {
      console.error('Error when editing the row:', error);
      return { success: false, error: error.message };
    }
  }

  async deleteRow(id: number) {
    try {
      const query = `DELETE FROM vodovod_sub_campaign WHERE id = ?`;

      await this.prismaLegacy.$executeRawUnsafe(query, id);

      return { success: true, message: 'Uspeano brisanje' };
    } catch (error) {
      console.error('Error when deleting the row:', error);

      if (error.message.includes('foreign key constraint')) {
        throw new Error(
          'Nije mogue obrisati pod-kampanju jer postoje povezani podaci',
        );
      }

      throw new Error('Doalo je do greake prilikom brisanja');
    }
  }
}
