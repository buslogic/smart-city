import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaLegacyService } from '../prisma-legacy/prisma-legacy.service';
import { SearchSubsidiesDto } from './dto/search-subsidies.dto';
import { SearchItemsDto } from './dto/search-items.dto';
import { AddSubsidyDto } from './dto/add-subsidy.dto';
import { EditSubsidyDto } from './dto/edit-subsidy.dto';
import { DeleteSubsidyDto } from './dto/delete-subsidy.dto';

@Injectable()
export class SubsidiesService {
  constructor(private prismaLegacy: PrismaLegacyService) {}

  /**
   * Dohvata subvencije sa paginacijom i filterima
   */
  async getRows(dto: SearchSubsidiesDto) {
    const sql = `
      SELECT
        s.id,
        s.naziv,
        CONCAT(st.id, ' | ', st.naziv_tipa) as tip,
        s.procenat,
        s.iznos,
        s.datum_od,
        s.datum_do,
        s.limit,
        s.fiksni_deo,
        s.varijabilni_deo,
        CONCAT(ss.id, ' | ', ss.naziv) as status
      FROM vodovod_subsidies s
      LEFT JOIN vodovod_subsidies_status ss ON s.status = ss.id
      LEFT JOIN vodovod_subsidies_type st ON s.tip = st.id
      ORDER BY s.id DESC
    `;

    const rows = await this.prismaLegacy.$queryRawUnsafe<any[]>(sql);

    const totalRows = rows.length;

    return {
      data: rows,
      rowCount: totalRows,
    };
  }

  /**
   * Dohvata tipove subvencija za SearchList komponentu
   */
  async getTypesForSL(dto: SearchItemsDto) {
    const query = dto.query || '';
    const pageNumber = dto.pageNumber || 0;
    const limit = 30;
    const offset = pageNumber * limit;
    const searchQuery = `%${query}%`;

    const sql = `
      SELECT id, naziv_tipa
      FROM vodovod_subsidies_type
      WHERE naziv_tipa LIKE ?
      ORDER BY naziv_tipa
      LIMIT ? OFFSET ?
    `;

    const rows = await this.prismaLegacy.$queryRawUnsafe<any[]>(
      sql,
      searchQuery,
      limit,
      offset,
    );

    const data = rows.map((row: any) => `${row.id} | ${row.naziv_tipa}`);

    // Brojanje ukupno
    const countSql = `
      SELECT COUNT(*) as total
      FROM vodovod_subsidies_type
      WHERE naziv_tipa LIKE ?
    `;

    const countResult = await this.prismaLegacy.$queryRawUnsafe<any[]>(
      countSql,
      searchQuery,
    );
    const totalRows = Number(countResult[0]?.total || 0);
    const hasMore = offset + limit < totalRows;

    return {
      data,
      hasMore,
    };
  }

  /**
   * Dohvata statuse subvencija za SearchList komponentu
   */
  async getStatusForSL(dto: SearchItemsDto) {
    const query = dto.query || '';
    const pageNumber = dto.pageNumber || 0;
    const limit = 30;
    const offset = pageNumber * limit;
    const searchQuery = `%${query}%`;

    const sql = `
      SELECT id, naziv
      FROM vodovod_subsidies_status
      WHERE naziv LIKE ?
      ORDER BY naziv
      LIMIT ? OFFSET ?
    `;

    const rows = await this.prismaLegacy.$queryRawUnsafe<any[]>(
      sql,
      searchQuery,
      limit,
      offset,
    );

    const data = rows.map((row: any) => `${row.id} | ${row.naziv}`);

    // Brojanje ukupno
    const countSql = `
      SELECT COUNT(*) as total
      FROM vodovod_subsidies_status
      WHERE naziv LIKE ?
    `;

    const countResult = await this.prismaLegacy.$queryRawUnsafe<any[]>(
      countSql,
      searchQuery,
    );
    const totalRows = Number(countResult[0]?.total || 0);
    const hasMore = offset + limit < totalRows;

    return {
      data,
      hasMore,
    };
  }

  /**
   * Dohvata subvencije za SearchList komponentu
   */
  async getSubsidiesForSL(dto: SearchItemsDto) {
    const query = dto.query || '';
    const pageNumber = dto.pageNumber || 0;
    const limit = 30;
    const offset = pageNumber * limit;
    const searchQuery = `%${query}%`;

    const sql = `
      SELECT id, naziv
      FROM vodovod_subsidies
      WHERE naziv LIKE ? OR id LIKE ?
      ORDER BY id
      LIMIT ? OFFSET ?
    `;

    const rows = await this.prismaLegacy.$queryRawUnsafe<any[]>(
      sql,
      searchQuery,
      searchQuery,
      limit,
      offset,
    );

    const data = rows.map((row: any) => `${row.id} | ${row.naziv}`);

    // Brojanje ukupno
    const countSql = `
      SELECT COUNT(*) as total
      FROM vodovod_subsidies
      WHERE naziv LIKE ? OR id LIKE ?
    `;

    const countResult = await this.prismaLegacy.$queryRawUnsafe<any[]>(
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

  /**
   * Dohvata aktivne subvencije
   */
  async getActiveSubsidies() {
    const sql = `
      SELECT
        s.*,
        CONCAT(ss.id, ' | ', ss.naziv) as status,
        CONCAT(st.id, ' | ', st.naziv_tipa) as tip
      FROM vodovod_subsidies s
      LEFT JOIN vodovod_subsidies_status ss ON s.status = ss.id
      LEFT JOIN vodovod_subsidies_type st ON s.tip = st.id
      WHERE s.status = 1
      ORDER BY s.id DESC
    `;

    const rows = await this.prismaLegacy.$queryRawUnsafe<any[]>(sql);
    return rows;
  }

  /**
   * Dodaje novu subvenciju
   */
  async addRow(dto: AddSubsidyDto, userId: number) {
    // Parsiranje tipova (iz formata "ID | Naziv" izvlači samo ID)
    const tip = this.parseFilter(dto.tip);
    const status = this.parseFilter(dto.status);

    try {
      // Dodavanje zapisa
      const insertSql = `
        INSERT INTO vodovod_subsidies (
          naziv, tip, procenat, iznos, datum_od, datum_do, \`limit\`,
          fiksni_deo, varijabilni_deo, \`status\`, user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await this.prismaLegacy.$queryRawUnsafe(
        insertSql,
        dto.naziv,
        tip || null,
        dto.procenat || null,
        dto.iznos || null,
        dto.datum_od || null,
        dto.datum_do || null,
        dto.limit || null,
        dto.fiksni_deo || null,
        dto.varijabilni_deo || null,
        status || null,
        userId,
      );

      // Dohvatanje ID-a unetog reda
      const lastIdResult = await this.prismaLegacy.$queryRawUnsafe<any[]>(
        'SELECT LAST_INSERT_ID() as id'
      );
      const insertedId = Number(lastIdResult[0]?.id);

      // Dohvatanje kompletnog reda
      const row = await this.getRowById(insertedId);

      return { success: true, data: row };
    } catch (error) {
      console.error('Error adding subsidy:', error);
      throw new BadRequestException('Greška pri dodavanju subvencije');
    }
  }

  /**
   * Pomoćna metoda za dohvatanje jednog reda po ID-u
   */
  private async getRowById(id: number) {
    const sql = `
      SELECT
        s.id,
        s.naziv,
        CONCAT(st.id, ' | ', st.naziv_tipa) as tip,
        s.procenat,
        s.iznos,
        s.datum_od,
        s.datum_do,
        s.limit,
        s.fiksni_deo,
        s.varijabilni_deo,
        CONCAT(ss.id, ' | ', ss.naziv) as status
      FROM vodovod_subsidies s
      LEFT JOIN vodovod_subsidies_status ss ON s.status = ss.id
      LEFT JOIN vodovod_subsidies_type st ON s.tip = st.id
      WHERE s.id = ?
    `;

    const rows = await this.prismaLegacy.$queryRawUnsafe<any[]>(sql, id);
    return rows[0] || null;
  }

  /**
   * Briše subvenciju
   */
  async deleteRow(dto: DeleteSubsidyDto, userId: number) {
    try {
      // Prvo dohvatamo podatke pre brisanja
      const selectSql = `SELECT * FROM vodovod_subsidies WHERE id = ?`;
      const rows = await this.prismaLegacy.$queryRawUnsafe<any[]>(
        selectSql,
        dto.id,
      );

      if (rows.length === 0) {
        throw new BadRequestException('Subvencija ne postoji');
      }

      // TODO: Implementirati logovanje pre brisanja kada bude poznata tačna struktura log tabele
      // Log tabela koristi: subvencija_id, change_type, note, change_date, changed_by, old_value, new_value

      // Brisanje zapisa
      const deleteSql = `DELETE FROM vodovod_subsidies WHERE id = ?`;
      await this.prismaLegacy.$queryRawUnsafe(deleteSql, dto.id);

      return { success: true };
    } catch (error) {
      console.error('Error deleting subsidy:', error);
      throw new BadRequestException('Greška pri brisanju subvencije');
    }
  }

  /**
   * Izmena subvencije
   */
  async editRow(dto: EditSubsidyDto, userId: number) {
    // Parsiranje tipova (iz formata "ID | Naziv" izvlači samo ID)
    const tip = this.parseFilter(dto.tip);
    const status = this.parseFilter(dto.status);

    try {
      // Prvo dohvatamo stare podatke
      const selectSql = `SELECT * FROM vodovod_subsidies WHERE id = ?`;
      const rows = await this.prismaLegacy.$queryRawUnsafe<any[]>(
        selectSql,
        dto.id,
      );

      if (rows.length === 0) {
        throw new BadRequestException('Subvencija ne postoji');
      }

      // Ažuriranje zapisa
      const updateSql = `
        UPDATE vodovod_subsidies
        SET
          naziv = ?,
          tip = ?,
          procenat = ?,
          iznos = ?,
          datum_od = ?,
          datum_do = ?,
          \`limit\` = ?,
          fiksni_deo = ?,
          varijabilni_deo = ?,
          \`status\` = ?
        WHERE id = ?
      `;

      await this.prismaLegacy.$queryRawUnsafe(
        updateSql,
        dto.naziv,
        tip || null,
        dto.procenat || null,
        dto.iznos || null,
        dto.datum_od || null,
        dto.datum_do || null,
        dto.limit || null,
        dto.fiksni_deo || null,
        dto.varijabilni_deo || null,
        status || null,
        dto.id,
      );

      // Dohvatamo nove podatke sa formatiranim poljima
      const row = await this.getRowById(dto.id);

      // TODO: Implementirati logovanje kada bude poznata tačna struktura log tabele
      // Log tabela koristi: subvencija_id, change_type, note, change_date, changed_by, old_value, new_value

      return { success: true, data: row };
    } catch (error) {
      console.error('Error editing subsidy:', error);
      throw new BadRequestException('Greška pri izmeni subvencije');
    }
  }

  /**
   * Dohvata istoriju promena za subvenciju
   */
  async getSubsidiesHistory(subsidyId: number) {
    const sql = `
      SELECT
        sl.old_value,
        sl.new_value,
        ct.translate,
        sl.note,
        DATE_FORMAT(sl.change_date, '%Y-%m-%d') as change_date,
        u.real_name as changed_by
      FROM vodovod_subsidies_log sl
      LEFT JOIN vodovod_change_type ct ON sl.change_type = ct.id
      LEFT JOIN users u ON u.id = sl.changed_by
      WHERE sl.subvencija_id = ?
      ORDER BY sl.change_date DESC
    `;

    const rows = await this.prismaLegacy.$queryRawUnsafe<any[]>(sql, subsidyId);
    return rows;
  }

  /**
   * Helper metoda za parsiranje filtera u formatu "id | naziv"
   */
  private parseFilter(value?: string): string | null {
    if (!value) return null;
    const parts = value.split(' | ');
    if (parts.length > 0 && parts[0].trim() !== '') {
      return parts[0].trim();
    }
    return null;
  }
}
