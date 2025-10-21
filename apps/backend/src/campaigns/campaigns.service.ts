import { Injectable } from '@nestjs/common';
import { PrismaLegacyService } from '../prisma-legacy/prisma-legacy.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { SearchQueryDto } from './dto/search-query.dto';

@Injectable()
export class CampaignsService {
  constructor(private prismaLegacy: PrismaLegacyService) {}

  async getRows() {
    const query = `
      SELECT c.id,
        c.godina,
        c.mesec,
        c.sifra,
        c.status,
        CASE
          WHEN c.datum_kreiranja = '0000-00-00' OR c.datum_kreiranja IS NULL
          THEN NULL
          ELSE c.datum_kreiranja
        END as datum_kreiranja,
        CASE
          WHEN c.datum_zatvaranja = '0000-00-00' OR c.datum_zatvaranja IS NULL
          THEN NULL
          ELSE c.datum_zatvaranja
        END as datum_zatvaranja,
        CONCAT(ss.id, ' | ', ss.naziv) as status_id,
        CONCAT(c.godina, '/', c.mesec) as period
      FROM vodovod_campaign c
      LEFT JOIN vodovod_campaign_status ss on c.status = ss.id
      ORDER BY c.id DESC
    `;

    const rows = await this.prismaLegacy.$queryRawUnsafe<any[]>(query);
    return rows;
  }

  async checkIfCampaignExists(godina: number, mesec: number) {
    const query = `
      SELECT COUNT(*) as total
      FROM vodovod_campaign
      WHERE godina = ? AND mesec = ?
    `;

    const result = await this.prismaLegacy.$queryRawUnsafe<any[]>(
      query,
      godina,
      mesec,
    );
    const exists = result[0]?.total > 0;
    return { exists };
  }

  async getStatusForSL(searchDto: SearchQueryDto) {
    const query = searchDto.query || '';
    const pageNumber = searchDto.pageNumber || 0;
    const limit = 30;
    const offset = pageNumber * limit;
    const searchQuery = `%${query}%`;

    const sql = `
      SELECT ss.id, ss.naziv as status_id
      FROM vodovod_campaign_status ss
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

    // Count total
    const countSql = `
      SELECT COUNT(*) as total
      FROM vodovod_campaign_status ss
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

  async getRowById(id: number) {
    const query = `
      SELECT c.id,
        c.godina,
        c.mesec,
        c.sifra,
        c.status,
        CASE
          WHEN c.datum_kreiranja = '0000-00-00' OR c.datum_kreiranja IS NULL
          THEN NULL
          ELSE c.datum_kreiranja
        END as datum_kreiranja,
        CASE
          WHEN c.datum_zatvaranja = '0000-00-00' OR c.datum_zatvaranja IS NULL
          THEN NULL
          ELSE c.datum_zatvaranja
        END as datum_zatvaranja,
        CONCAT(ss.id, ' | ', ss.naziv) as status_id,
        CONCAT(c.godina, '/', c.mesec) as period
      FROM vodovod_campaign c
      LEFT JOIN vodovod_campaign_status ss on c.status = ss.id
      WHERE c.id = ?
    `;

    const rows = await this.prismaLegacy.$queryRawUnsafe<any[]>(query, id);
    return rows.length > 0 ? rows[0] : null;
  }

  async addRow(createDto: CreateCampaignDto) {
    try {
      // Parsiraj period (format: YYYY/MM)
      let godina = createDto.godina;
      let mesec = createDto.mesec;

      if (!godina || !mesec) {
        const parts = createDto.period.split('/');
        if (parts.length === 2) {
          godina = parseInt(parts[0]);
          mesec = parseInt(parts[1]);
        }
      }

      // PRAVILO 1: Provera da li je period obavezan
      if (!godina || !mesec || isNaN(godina) || isNaN(mesec)) {
        return {
          success: false,
          message: 'Polje Period kampanje je obavezno i mora biti u formatu YYYY/MM',
        };
      }

      // PRAVILO 2: Provera da li kampanja za izabrani period već postoji
      const existsCheck = await this.checkIfCampaignExists(
        godina,
        mesec,
      );
      if (existsCheck.exists) {
        return {
          success: false,
          message: 'Kampanja za izabrani period već postoji',
        };
      }

      // PRAVILO 3: Provera da li je period u prošlosti (Period Lock)
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1; // JavaScript months are 0-indexed

      const isPeriodLocked =
        godina < currentYear ||
        (godina === currentYear && mesec < currentMonth);

      if (isPeriodLocked) {
        return {
          success: false,
          message: 'Ne može se kreirati kampanja za prethodni period',
        };
      }

      // PRAVILO 4: Status je obavezan
      if (!createDto.status_id) {
        return {
          success: false,
          message: 'Status kampanje je obavezan',
        };
      }

      // PRAVILO 5: Default vrednosti
      const datum_kreiranja =
        createDto.datum_kreiranja ||
        now.toISOString().split('T')[0]; // YYYY-MM-DD

      // Extract status ID from "ID | Name" format
      const statusId = createDto.status_id.split(' | ')[0];

      const query = `
        INSERT INTO vodovod_campaign (godina, mesec, sifra, status, datum_kreiranja, datum_zatvaranja)
        VALUES (?, ?, ?, ?, ?, ?)
      `;

      await this.prismaLegacy.$executeRawUnsafe(
        query,
        godina,
        mesec,
        createDto.sifra || null,
        statusId,
        datum_kreiranja,
        createDto.datum_zatvaranja || null,
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

  async editRow(id: number, updateDto: UpdateCampaignDto) {
    try {
      // Get current data for change history
      const currentQuery = `SELECT * FROM vodovod_campaign WHERE id = ?`;
      const currentResult = await this.prismaLegacy.$queryRawUnsafe<any[]>(
        currentQuery,
        id,
      );

      if (currentResult.length === 0) {
        console.error('No record found with id:', id);
        return { success: false, message: 'Record not found' };
      }

      const currentData = currentResult[0];

      // Extract godina and mesec from period if provided, otherwise use current values
      let godina = updateDto.godina || currentData.godina;
      let mesec = updateDto.mesec || currentData.mesec;

      if (updateDto.period) {
        const parts = updateDto.period.split('/');
        godina = parseInt(parts[0]);
        mesec = parseInt(parts[1]);
      }

      // Extract status ID from "ID | Name" format
      const statusId = updateDto.status_id
        ? updateDto.status_id.split(' | ')[0]
        : currentData.status;

      const query = `
        UPDATE vodovod_campaign
        SET godina = ?, mesec = ?, sifra = ?, status = ?, datum_kreiranja = ?, datum_zatvaranja = ?
        WHERE id = ?
      `;

      await this.prismaLegacy.$executeRawUnsafe(
        query,
        godina,
        mesec,
        updateDto.sifra !== undefined ? updateDto.sifra : currentData.sifra,
        statusId,
        updateDto.datum_kreiranja !== undefined
          ? updateDto.datum_kreiranja
          : currentData.datum_kreiranja,
        updateDto.datum_zatvaranja !== undefined
          ? updateDto.datum_zatvaranja
          : currentData.datum_zatvaranja,
        id,
      );

      // Get change types for logging
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

      // Field mapping for change detection
      const fieldMapping: Record<
        string,
        { col: string; part: number | null }
      > = {
        godina: { col: 'godina', part: null },
        mesec: { col: 'mesec', part: null },
        sifra: { col: 'sifra', part: null },
        datum_kreiranja: { col: 'datum_kreiranja', part: null },
        datum_zatvaranja: { col: 'datum_zatvaranja', part: null },
        status: { col: 'status', part: null },
      };

      const changes: any[] = [];
      const userId = updateDto.changed_by;

      // Detect changes
      for (const [field, info] of Object.entries(changeTypes)) {
        if (!fieldMapping[field]) continue;

        const col = fieldMapping[field].col;
        const part = fieldMapping[field].part;

        let newValue: any;
        let oldValue: any;

        if (field === 'godina') newValue = godina;
        else if (field === 'mesec') newValue = mesec;
        else if (field === 'status') newValue = statusId;
        else newValue = updateDto[field];

        if (newValue === undefined || newValue === '') continue;

        oldValue = currentData[col];

        if (part !== null && typeof oldValue === 'string') {
          oldValue = oldValue.split(' | ')[part] || oldValue;
        }

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
          INSERT INTO vodovod_campaign_change_history (
            campaign_id,
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
      const query = `DELETE FROM vodovod_campaign WHERE id = ?`;

      const result = await this.prismaLegacy.$executeRawUnsafe(query, id);

      return { success: true, message: 'Uspešno brisanje' };
    } catch (error) {
      console.error('Error when deleting the row:', error);

      if (error.message.includes('foreign key constraint')) {
        throw new Error(
          'Nije moguće obrisati kampanju jer postoje povezani podaci',
        );
      }

      throw new Error('Došlo je do greške prilikom brisanja');
    }
  }
}
