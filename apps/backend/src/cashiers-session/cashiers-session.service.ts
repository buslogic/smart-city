import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaLegacyService } from '../prisma-legacy/prisma-legacy.service';
import { OpenSessionDto } from './dto/open-session.dto';
import { CloseSessionDto } from './dto/close-session.dto';

@Injectable()
export class CashiersSessionService {
  constructor(private legacyDb: PrismaLegacyService) {}

  async getByID(sessionId: number) {
    const query = `
      SELECT
        vcr.naziv AS kasa,
        CONCAT(cc.crm_contacts_first_name, ' ', cc.crm_contacts_last_name) AS blagajnik,
        vcs.*
      FROM vodovod_cash_session vcs
      LEFT JOIN crm_contacts cc ON cc.crm_contacts_user_id = vcs.user_id
      LEFT JOIN vodovod_cashiers vc ON cc.id = vc.crm_contact_id
      LEFT JOIN vodovod_cash_register vcr ON vcr.id = vc.kasa_id
      WHERE vcs.id = ?
    `;

    const result = await this.legacyDb.$queryRawUnsafe<any[]>(query, sessionId);
    if (!result || result.length === 0) return null;

    const row = result[0];
    return {
      ...row,
      pocetni_iznos: row.pocetni_iznos ? Number(row.pocetni_iznos) : null,
      krajnji_iznos: row.krajnji_iznos ? Number(row.krajnji_iznos) : null,
    };
  }

  async isSessionOpen(userId: number) {
    try {
      const query = `
        SELECT COUNT(*) AS count
        FROM vodovod_cash_session vcs
        LEFT JOIN crm_contacts cc ON cc.crm_contacts_user_id = vcs.user_id
        LEFT JOIN vodovod_cashiers vc ON cc.id = vc.crm_contact_id
        LEFT JOIN vodovod_cash_register vcr ON vcr.id = vc.kasa_id
        WHERE vcs.user_id = ? AND vcs.status = 1 AND vcs.datum_otvaranja > ?
        LIMIT 1
      `;

      const currentDate = new Date().toISOString().split('T')[0];
      const result = await this.legacyDb.$queryRawUnsafe<Array<{ count: bigint }>>(
        query,
        userId,
        currentDate,
      );

      return Number(result[0]?.count || 0) > 0;
    } catch (error) {
      console.error('isSessionOpen error:', error);
      return null;
    }
  }

  async getCashierSession(userId: number) {
    try {
      const query = `
        SELECT
          vcr.naziv AS kasa,
          CONCAT(cc.crm_contacts_first_name, ' ', cc.crm_contacts_last_name) AS blagajnik,
          vcs.*
        FROM vodovod_cash_session vcs
        LEFT JOIN crm_contacts cc ON cc.crm_contacts_user_id = vcs.user_id
        LEFT JOIN vodovod_cashiers vc ON cc.id = vc.crm_contact_id
        LEFT JOIN vodovod_cash_register vcr ON vcr.id = vc.kasa_id
        WHERE vcs.user_id = ? AND DATE(vcs.datum_otvaranja) = ?
        LIMIT 1
      `;

      const currentDate = new Date().toISOString().split('T')[0];
      const result = await this.legacyDb.$queryRawUnsafe<any[]>(
        query,
        userId,
        currentDate,
      );

      if (!result || result.length === 0) return null;

      const row = result[0];
      return {
        ...row,
        pocetni_iznos: row.pocetni_iznos ? Number(row.pocetni_iznos) : null,
        krajnji_iznos: row.krajnji_iznos ? Number(row.krajnji_iznos) : null,
      };
    } catch (error) {
      console.error('getCashierSession error:', error);
      return null;
    }
  }

  async openSession(userId: number, dto: OpenSessionDto) {
    const isOpen = await this.isSessionOpen(userId);
    if (isOpen) {
      throw new BadRequestException(
        'Smena je već otvorena za ovog korisnika',
      );
    }

    const query = `
      INSERT INTO vodovod_cash_session (user_id, pocetni_iznos, status)
      VALUES (?, ?, 1)
    `;

    await this.legacyDb.$executeRawUnsafe(query, userId, dto.pocetni_iznos);

    const lastInsertId = await this.legacyDb.$queryRawUnsafe<Array<{ id: bigint }>>(
      `SELECT LAST_INSERT_ID() as id`,
    );

    const insertedId = Number(lastInsertId[0]?.id);

    if (!insertedId) {
      throw new Error('Greška pri dobijanju ID-a unesenog reda');
    }

    return this.getByID(insertedId);
  }

  async getAllTransactionsForSession(userId: number, datumOtvaranja: string) {
    const query = `
      SELECT
        vct.broj_fiskalnog_racuna,
        vct.status,
        vct.iznos_ukupno,
        vpt.naziv AS nacin_placanja_id
      FROM vodovod_cash_tx vct
      LEFT JOIN vodovod_payment_type vpt ON vct.nacin_placanja_id = vpt.id
      WHERE vct.kreirao_id = ? AND vct.datum_kreiranja > ?
    `;

    const result = await this.legacyDb.$queryRawUnsafe<any[]>(
      query,
      userId,
      datumOtvaranja,
    );

    return (result || []).map((row) => ({
      ...row,
      iznos_ukupno: row.iznos_ukupno ? Number(row.iznos_ukupno) : 0,
    }));
  }

  private calculateFinalAmount(transactions: any[]): number {
    return transactions.reduce((sum, tx) => sum + (tx.iznos_ukupno || 0), 0);
  }

  async closeSession(userId: number, dto: CloseSessionDto) {
    try {
      const transactions = await this.getAllTransactionsForSession(
        userId,
        dto.datum_otvaranja,
      );
      const krajnjiIznos = this.calculateFinalAmount(transactions);

      const napomena = dto.napomena || null;

      const query = `
        UPDATE vodovod_cash_session
        SET krajnji_iznos = ?, napomena = ?, datum_zatvaranja = NOW(), status = 0
        WHERE id = ? AND user_id = ?
      `;

      await this.legacyDb.$executeRawUnsafe(
        query,
        krajnjiIznos,
        napomena,
        dto.id,
        userId,
      );

      return this.getByID(dto.id);
    } catch (error) {
      console.error('closeSession error:', error);
      return null;
    }
  }
}
