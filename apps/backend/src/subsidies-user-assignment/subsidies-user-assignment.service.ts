import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaLegacyService } from '../prisma-legacy/prisma-legacy.service';
import { AssignSubsidyDto } from './dto/assign-subsidy.dto';
import { ReassignSubsidyDto } from './dto/reassign-subsidy.dto';
import { RemoveSubsidyDto } from './dto/remove-subsidy.dto';

@Injectable()
export class SubsidiesUserAssignmentService {
  constructor(private prismaLegacy: PrismaLegacyService) {}

  /**
   * Dohvata dodeljene subvencije za korisnika
   */
  async getAssignedSubventions(userId: number) {
    const sql = `
      SELECT
        vus.*,
        vs.naziv,
        vs.limit,
        vs.iznos,
        u.login AS dodelio
      FROM vodovod_users_subsidies vus
      LEFT JOIN vodovod_subsidies vs ON vs.id = vus.subvencija_id
      LEFT JOIN users u ON u.id = vus.dodelio
      WHERE vus.korisnik_id = ?
    `;

    const rows = await this.prismaLegacy.$queryRawUnsafe<any[]>(sql, userId);
    return rows;
  }

  /**
   * Dodeljuje subvenciju korisniku
   */
  async assignSubvention(dto: AssignSubsidyDto, userId: number) {
    try {
      const insertSql = `
        INSERT INTO vodovod_users_subsidies (korisnik_id, subvencija_id, dodelio, \`status\`)
        VALUES (?, ?, ?, ?)
      `;

      await this.prismaLegacy.$queryRawUnsafe(
        insertSql,
        dto.korisnik_id,
        dto.subvencija_id,
        userId,
        dto.status,
      );

      // Dohvatanje ID-a unetog reda
      const lastIdResult = await this.prismaLegacy.$queryRawUnsafe<any[]>(
        'SELECT LAST_INSERT_ID() as id',
      );
      const insertedId = Number(lastIdResult[0]?.id);

      // Dohvatanje kompletnog reda
      const row = await this.getAssignedSubventionByRowId(insertedId);

      return { success: true, data: row };
    } catch (error) {
      console.error('Error assigning subsidy:', error);
      throw new BadRequestException('Greška pri dodeli subvencije');
    }
  }

  /**
   * Menja dodeljenu subvenciju
   */
  async reassignSubvention(dto: ReassignSubsidyDto, userId: number) {
    try {
      const updateSql = `
        UPDATE vodovod_users_subsidies
        SET \`status\` = ?, subvencija_id = ?, dodelio = ?
        WHERE id = ? AND korisnik_id = ?
      `;

      const result = await this.prismaLegacy.$queryRawUnsafe(
        updateSql,
        dto.status,
        dto.subvencija_id,
        userId,
        dto.id,
        dto.korisnik_id,
      );

      // Dohvatanje ažuriranog reda
      const row = await this.getAssignedSubventionByRowId(dto.id);

      if (!row) {
        throw new BadRequestException('Dodeljena subvencija ne postoji');
      }

      return { success: true, data: row };
    } catch (error) {
      console.error('Error reassigning subsidy:', error);
      throw new BadRequestException('Greška pri izmeni dodele subvencije');
    }
  }

  /**
   * Uklanja dodeljenu subvenciju
   */
  async removeSubvention(dto: RemoveSubsidyDto) {
    try {
      const deleteSql = `DELETE FROM vodovod_users_subsidies WHERE id = ?`;
      await this.prismaLegacy.$queryRawUnsafe(deleteSql, dto.id);

      return { success: true };
    } catch (error) {
      console.error('Error removing subsidy:', error);
      throw new BadRequestException('Greška pri uklanjanju dodele subvencije');
    }
  }

  /**
   * Pomoćna metoda za dohvatanje jednog reda po ID-u
   */
  private async getAssignedSubventionByRowId(id: number) {
    const sql = `
      SELECT
        vus.*,
        vs.naziv,
        vs.limit,
        vs.iznos,
        u.login AS dodelio
      FROM vodovod_users_subsidies vus
      LEFT JOIN vodovod_subsidies vs ON vs.id = vus.subvencija_id
      LEFT JOIN users u ON u.id = vus.dodelio
      WHERE vus.id = ?
    `;

    const rows = await this.prismaLegacy.$queryRawUnsafe<any[]>(sql, id);
    return rows[0] || null;
  }
}
