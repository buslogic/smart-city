import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaLegacyService } from '../prisma-legacy/prisma-legacy.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { SearchCurrencyDto } from './dto/search-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(private legacyDb: PrismaLegacyService) {}

  // Helper funkcija koja konvertuje sve BigInt i Decimal vrednosti u Number/String
  private convertBigIntAndDecimal(obj: any): any {
    if (obj === null || obj === undefined) return obj;

    // BigInt konverzija
    if (typeof obj === 'bigint') {
      return Number(obj);
    }

    // Prisma Decimal detekcija - objekat sa {s, e, d} ili sa toNumber metodom
    if (obj && typeof obj === 'object') {
      // Proveri da li ima toNumber metod (Prisma Decimal klasa)
      if (typeof obj.toNumber === 'function') {
        return obj.toNumber();
      }

      // Proveri da li ima strukturu {s, e, d} (serijalizovani Decimal)
      if ('s' in obj && 'e' in obj && 'd' in obj) {
        const keys = Object.keys(obj);
        // Prisma Decimal će imati tačno 3 ili više ključeva uključujući s, e, d
        if (keys.includes('s') && keys.includes('e') && keys.includes('d')) {
          // Manuelna konverzija iz Decimal strukture
          try {
            const sign = obj.s;
            const exp = obj.e;
            const digits = obj.d;

            if (!Array.isArray(digits)) {
              return obj; // Not a valid Decimal structure
            }

            let num = 0;
            for (let i = 0; i < digits.length; i++) {
              num = num * 10 + digits[i];
            }
            num = num * Math.pow(10, exp - digits.length + 1);
            return sign === -1 ? -num : num;
          } catch (e) {
            // Ako manuelna konverzija ne uspe, vrati string reprezentaciju
            console.warn('Decimal conversion failed, returning raw object', e);
            return obj;
          }
        }
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

  async getPaymentData(payerId: number, userId: number) {
    const query = `
      SELECT
        ct.*,
        COALESCE(
          CONCAT(vua.id, ' | ', ca.crm_accounts_name),
          CONCAT(vua.id, ' | ', cc.crm_contacts_first_name, ' ', cc.crm_contacts_last_name)
        ) AS uplatilac_id,
        CONCAT(cr.id, ' | ', cr.naziv) AS kasa_id,
        CONCAT(ss.id, ' | ', ss.naziv) AS status,
        CONCAT(vua.id, ' | ', cc.crm_contacts_first_name, ' ', cc.crm_contacts_last_name) AS kreirao_id,
        CONCAT(cn.id, ' | ', cn.alpha_code) AS valuta
      FROM vodovod_cash_tx ct
      LEFT JOIN vodovod_cash_register cr ON ct.kasa_id = cr.id
      LEFT JOIN vodovod_subsidies_status ss ON ct.status = ss.id
      LEFT JOIN vodovod_user_accounts vua ON vua.id = ct.uplatilac_id
      LEFT JOIN crm_contacts cc ON cc.id = vua.crm_contact_id
      LEFT JOIN crm_accounts ca ON ca.id = vua.crm_account_id
      LEFT JOIN currency_new cn ON ct.valuta = cn.id
      WHERE ct.uplatilac_id = ? AND ct.status = 1
      ORDER BY ct.id DESC
    `;

    const result = await this.legacyDb.$queryRawUnsafe<any[]>(query, payerId);
    console.log('RAW RESULT:', JSON.stringify(result[0], null, 2));
    const converted = this.convertBigIntAndDecimal(result);
    console.log('CONVERTED RESULT:', JSON.stringify(converted[0], null, 2));
    return converted;
  }

  async getInactivePaymentData(payerId: number, userId: number) {
    const query = `
      SELECT
        ct.*,
        COALESCE(
          ca.crm_accounts_name,
          CONCAT(vua.id, ' | ', cc.crm_contacts_first_name, ' ', cc.crm_contacts_last_name)
        ) AS uplatilac_id,
        CONCAT(cr.id, ' | ', cr.naziv) AS kasa_id,
        CONCAT(ss.id, ' | ', ss.naziv) AS status,
        CONCAT(vua.id, ' | ', cc.crm_contacts_first_name, ' ', cc.crm_contacts_last_name) AS kreirao_id,
        CONCAT(cn.id, ' | ', cn.alpha_code) AS valuta
      FROM vodovod_cash_tx ct
      LEFT JOIN vodovod_cash_register cr ON ct.kasa_id = cr.id
      LEFT JOIN vodovod_subsidies_status ss ON ct.status = ss.id
      LEFT JOIN vodovod_user_accounts vua ON vua.id = ct.uplatilac_id
      LEFT JOIN crm_contacts cc ON cc.id = vua.crm_contact_id
      LEFT JOIN crm_accounts ca ON ca.id = vua.crm_account_id
      LEFT JOIN currency_new cn ON ct.valuta = cn.id
      WHERE ct.uplatilac_id = ? AND ct.status = 2
      ORDER BY ct.id DESC
    `;

    const result = await this.legacyDb.$queryRawUnsafe<any[]>(query, payerId);
    return this.convertBigIntAndDecimal(result);
  }

  async getCurrencyForSL(dto: SearchCurrencyDto) {
    const limit = 20;
    const offset = dto.pageNumber * limit;
    const searchQuery = `%${dto.query || ''}%`;

    const sql = `
      SELECT cn.id, cn.alpha_code as valuta
      FROM currency_new cn
      WHERE (cn.alpha_code LIKE ? OR cn.id LIKE ?) AND cn.usage = 1
      ORDER BY cn.id
      LIMIT ?, ?
    `;

    const results = await this.legacyDb.$queryRawUnsafe<any[]>(
      sql,
      searchQuery,
      searchQuery,
      offset,
      limit,
    );

    const out = results.map((row) => `${row.id} | ${row.valuta}`);

    const countSql = `
      SELECT COUNT(*) as total
      FROM currency_new cn
      WHERE (cn.alpha_code LIKE ? OR cn.id LIKE ?) AND cn.usage = 1
    `;

    const countResult = await this.legacyDb.$queryRawUnsafe<Array<{ total: bigint }>>(
      countSql,
      searchQuery,
      searchQuery,
    );

    const totalRows = Number(countResult[0]?.total || 0);
    const hasMore = offset + limit < totalRows;

    return {
      data: out,
      hasMore,
    };
  }

  async getCashRegister(userId: number) {
    const query = `
      SELECT cr.id, cr.naziv AS name
      FROM vodovod_cash_register cr
      LEFT JOIN vodovod_cashiers vc ON vc.kasa_id = cr.id
      LEFT JOIN crm_contacts cc ON vc.crm_contact_id = cc.id
      LEFT JOIN users u ON cc.crm_contacts_user_id = u.id
      WHERE u.id = ?
    `;

    const result = await this.legacyDb.$queryRawUnsafe<any[]>(query, userId);

    if (!result || result.length === 0) {
      return null;
    }

    const row = result[0];
    return {
      id: Number(row.id),
      name: row.name,
    };
  }

  async getRowById(id: number) {
    const query = `
      SELECT
        ct.*,
        COALESCE(
          ca.crm_accounts_name,
          CONCAT(vua.id, ' | ', cc.crm_contacts_first_name, ' ', cc.crm_contacts_last_name)
        ) AS uplatilac_id,
        CONCAT(cr.id, ' | ', cr.naziv) AS kasa_id,
        CONCAT(ss.id, ' | ', ss.naziv) AS status,
        CONCAT(vua.id, ' | ', cc.crm_contacts_first_name, ' ', cc.crm_contacts_last_name) AS kreirao_id,
        CONCAT(cn.id, ' | ', cn.alpha_code) AS valuta
      FROM vodovod_cash_tx ct
      LEFT JOIN vodovod_cash_register cr ON ct.kasa_id = cr.id
      LEFT JOIN vodovod_subsidies_status ss ON ct.status = ss.id
      LEFT JOIN vodovod_user_accounts vua ON vua.id = ct.uplatilac_id
      LEFT JOIN crm_contacts cc ON cc.id = vua.crm_contact_id
      LEFT JOIN crm_accounts ca ON ca.id = vua.crm_account_id
      LEFT JOIN currency_new cn ON ct.valuta = cn.id
      WHERE ct.id = ?
    `;

    const result = await this.legacyDb.$queryRawUnsafe<any[]>(query, id);

    if (!result || result.length === 0) {
      throw new NotFoundException(`Uplata sa ID ${id} nije pronađena`);
    }

    return this.convertBigIntAndDecimal(result[0]);
  }

  async create(createPaymentDto: CreatePaymentDto, userId: number) {
    try {
      // Izvlačimo ID iz formata "ID: 123" ili "123 | ..."
      const extractId = (value: string): number | null => {
        const idMatch = value.match(/ID:\s*(\d+)/) || value.match(/^(\d+)/);
        return idMatch ? parseInt(idMatch[1], 10) : null;
      };

      const uplatilacId = extractId(createPaymentDto.uplatilac_id);
      const valutaId = extractId(createPaymentDto.valuta);
      const statusId = extractId(createPaymentDto.status);
      const kasaId = extractId(createPaymentDto.kasa_id);

      if (!uplatilacId || !valutaId || !statusId || !kasaId) {
        throw new BadRequestException('Neispravni ID-evi u podacima');
      }

      // Koristimo NOW() funkciju MySQL-a da dobijemo trenutno vreme na serveru
      const query = `
        INSERT INTO vodovod_cash_tx (
          uplatilac_id, id_fakture, iznos_gotovina, iznos_kartica,
          iznos_cek, iznos_vaucer, iznos_ukupno, valuta, datum_kreiranja, status,
          broj_fiskalnog_racuna, pos_referenca, ip_adresa, kreirao_id, kasa_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?)
      `;

      await this.legacyDb.$executeRawUnsafe(
        query,
        uplatilacId,
        createPaymentDto.id_fakture || null,
        createPaymentDto.iznos_gotovina || 0,
        createPaymentDto.iznos_kartica || 0,
        createPaymentDto.iznos_cek || 0,
        createPaymentDto.iznos_vaucer || 0,
        createPaymentDto.iznos_ukupno || 0,
        valutaId,
        statusId,
        createPaymentDto.broj_fiskalnog_racuna || null,
        createPaymentDto.pos_referenca || null,
        createPaymentDto.ip_adresa || null,
        userId,
        kasaId,
      );

      const lastInsertId = await this.legacyDb.$queryRawUnsafe<Array<{ id: bigint }>>(
        `SELECT LAST_INSERT_ID() as id`,
      );

      const insertedId = Number(lastInsertId[0]?.id);

      if (!insertedId) {
        throw new Error('Greška pri dobijanju ID-a unesenog reda');
      }

      const row = await this.getRowById(insertedId);

      return {
        success: true,
        message: 'Uspešno!',
        data: row,
      };
    } catch (error) {
      console.error('Greška pri kreiranju uplate:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async update(id: number, updatePaymentDto: UpdatePaymentDto, userId: number) {
    await this.getRowById(id);

    try {
      const extractId = (value: string): number | null => {
        const idMatch = value.match(/ID:\s*(\d+)/) || value.match(/^(\d+)/);
        return idMatch ? parseInt(idMatch[1], 10) : null;
      };

      const uplatilacId = updatePaymentDto.uplatilac_id
        ? extractId(updatePaymentDto.uplatilac_id)
        : null;
      const valutaId = updatePaymentDto.valuta
        ? extractId(updatePaymentDto.valuta)
        : null;
      const statusId = updatePaymentDto.status
        ? extractId(updatePaymentDto.status)
        : null;
      const kasaId = updatePaymentDto.kasa_id
        ? extractId(updatePaymentDto.kasa_id)
        : null;

      const query = `
        UPDATE vodovod_cash_tx SET
          uplatilac_id = ?,
          id_fakture = ?,
          iznos_gotovina = ?,
          iznos_kartica = ?,
          iznos_cek = ?,
          iznos_vaucer = ?,
          valuta = ?,
          status = ?,
          broj_fiskalnog_racuna = ?,
          pos_referenca = ?,
          ip_adresa = ?,
          kreirao_id = ?,
          kasa_id = ?
        WHERE id = ?
      `;

      await this.legacyDb.$executeRawUnsafe(
        query,
        uplatilacId,
        updatePaymentDto.id_fakture,
        updatePaymentDto.iznos_gotovina,
        updatePaymentDto.iznos_kartica,
        updatePaymentDto.iznos_cek,
        updatePaymentDto.iznos_vaucer,
        valutaId,
        statusId,
        updatePaymentDto.broj_fiskalnog_racuna,
        updatePaymentDto.pos_referenca,
        updatePaymentDto.ip_adresa,
        userId,
        kasaId,
        id,
      );

      const row = await this.getRowById(id);

      return {
        success: true,
        message: 'Uspešno!',
        data: row,
      };
    } catch (error) {
      console.error('Greška pri izmeni uplate:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async delete(id: number) {
    const query = `UPDATE vodovod_cash_tx SET status = 2 WHERE id = ?`;

    const result = await this.legacyDb.$executeRawUnsafe(query, id);

    // Prisma vraća broj izmenjenih redova
    if (result === 0) {
      throw new NotFoundException(`Nije pronađen red za ID: ${id}`);
    }

    return {
      success: true,
      message: 'Red je uspešno obrisan.',
    };
  }
}
