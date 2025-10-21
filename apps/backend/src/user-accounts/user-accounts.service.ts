import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaLegacyService } from '../prisma-legacy/prisma-legacy.service';
import {
  SearchUserAccountsDto,
  SearchUserAccountByIdDto,
  SearchUserAccountsByTypeDto,
} from './dto/search-user-accounts.dto';
import { CreateUserAccountDto } from './dto/create-user-account.dto';
import {
  GetServicesByUserAccountIdDto,
  AssignPricelistDto,
  EditUserAccountServiceDto,
  RemoveAccountServiceDto,
} from './dto/user-account-service.dto';

@Injectable()
export class UserAccountsService {
  private readonly logger = new Logger(UserAccountsService.name);
  private readonly entriesPerPage = 15;

  constructor(private readonly prismaLegacy: PrismaLegacyService) {}

  /**
   * Get user account services by user account ID
   */
  async getServicesByUserAccountID(dto: GetServicesByUserAccountIdDto) {
    const query = `
      SELECT vcc.category, vs.service, vuas.*
      FROM vodovod_user_account_services vuas
      LEFT JOIN vodovod_water_services_pricelist vwsp ON vuas.pricelist_id = vwsp.id
      LEFT JOIN vodovod_service vs ON vs.id = vwsp.service_id
      LEFT JOIN vodovod_consumer_categories vcc ON vcc.id = vwsp.category_id
      WHERE vuas.user_account_id = ?
      ORDER BY vuas.id DESC
    `;

    return this.prismaLegacy.$queryRawUnsafe(query, dto.user_account_id);
  }

  /**
   * Edit user account service
   */
  async editUserAccountService(dto: EditUserAccountServiceDto) {
    const updatedAt = new Date();

    const query = `
      UPDATE vodovod_user_account_services
      SET pricelist_id = ?, active = ?, updated_at = ?
      WHERE id = ?
    `;

    await this.prismaLegacy.$executeRawUnsafe(
      query,
      dto.pricelist_id,
      dto.active ? 1 : 0,
      updatedAt,
      dto.id,
    );

    // Return updated service
    return this.getUserAccountServiceByID(dto.id);
  }

  /**
   * Assign pricelist to user account
   */
  async assignPricelistToUserAccount(dto: AssignPricelistDto) {
    const query = `
      INSERT INTO vodovod_user_account_services (user_account_id, pricelist_id)
      VALUES (?, ?)
    `;

    const result: any = await this.prismaLegacy.$executeRawUnsafe(
      query,
      dto.user_account_id,
      dto.pricelist_id,
    );

    // Get the inserted ID
    const insertId = result.insertId || result;

    // Return the newly created service
    return this.getUserAccountServiceByID(insertId);
  }

  /**
   * Remove account service
   */
  async removeAccountService(dto: RemoveAccountServiceDto) {
    const query = `DELETE FROM vodovod_user_account_services WHERE id = ?`;

    const result: any = await this.prismaLegacy.$executeRawUnsafe(query, dto.id);

    return {
      success: result > 0,
      affectedRows: result,
    };
  }

  /**
   * Get rows by type (idmm or consumer)
   */
  async getRows(dto: SearchUserAccountsByTypeDto) {
    if (dto.type !== 'idmm' && dto.type !== 'consumer') {
      throw new BadRequestException('Invalid type. Must be "idmm" or "consumer"');
    }

    // Implementation depends on specific requirements
    // Return empty for now
    return {
      success: true,
      data: [],
    };
  }

  /**
   * Get user account by ID with full details
   */
  async getUserAccountByID(dto: SearchUserAccountByIdDto) {
    const query = `
      SELECT oa.address_name AS delivery_address_name, vua.*
      FROM vodovod_user_accounts vua
      LEFT JOIN ordering_addresses oa ON oa.id = vua.delivery_address_id
      WHERE vua.id = ?
    `;

    const userAccounts: any[] = await this.prismaLegacy.$queryRawUnsafe(query, dto.id);

    if (!userAccounts || userAccounts.length === 0) {
      return null;
    }

    const userAccount = userAccounts[0];

    // Fetch CRM contact if exists
    if (userAccount.crm_contact_id) {
      const contactQuery = `SELECT * FROM crm_contacts WHERE id = ?`;
      const contacts: any[] = await this.prismaLegacy.$queryRawUnsafe(
        contactQuery,
        userAccount.crm_contact_id,
      );

      if (contacts && contacts.length > 0) {
        const contact = contacts[0];

        // Get consumer data if exists
        if (contact.sifra_potrosaca) {
          contact.consumer = await this.getConsumerData(contact.sifra_potrosaca);
        }

        // Get customer data if exists
        if (contact.sifra_kupca) {
          contact.customer = await this.getCustomerData(contact.sifra_kupca);
        }

        userAccount.crm_contact = contact;
      }
    }

    // Fetch CRM account if exists
    if (userAccount.crm_account_id) {
      const accountQuery = `SELECT * FROM crm_accounts WHERE id = ?`;
      const accounts: any[] = await this.prismaLegacy.$queryRawUnsafe(
        accountQuery,
        userAccount.crm_account_id,
      );

      if (accounts && accounts.length > 0) {
        const account = accounts[0];

        // Get consumer data if exists
        if (account.sifra_potrosaca) {
          account.consumer = await this.getConsumerData(account.sifra_potrosaca);
        }

        // Get customer data if exists
        if (account.sifra_kupca) {
          account.customer = await this.getCustomerData(account.sifra_kupca);
        }

        userAccount.crm_account = account;
      }
    }

    return userAccount;
  }

  /**
   * Get user accounts for SearchList component
   */
  async getUserAccountsForSL(dto: SearchUserAccountsDto) {
    const query = dto.query || '';
    const pageNumber = dto.pageNumber || 0;
    const offset = pageNumber * this.entriesPerPage;
    const searchQuery = `%${query}%`;

    const sql = `
      SELECT
        vua.id,
        COALESCE(ca.sifra_potrosaca, cc.sifra_potrosaca) AS sifra_potrosaca,
        COALESCE(ca.sifra_kupca, cc.sifra_kupca) AS sifra_kupca,
        COALESCE(ca.crm_accounts_name, CONCAT(cc.crm_contacts_first_name, ' ', cc.crm_contacts_last_name)) AS name
      FROM vodovod_user_accounts vua
      LEFT JOIN crm_contacts cc ON cc.id = vua.crm_contact_id
      LEFT JOIN crm_accounts ca ON ca.id = vua.crm_account_id
      WHERE
        (
          (ca.sifra_potrosaca IS NOT NULL OR ca.sifra_kupca IS NOT NULL)
          AND (
            ca.crm_accounts_name LIKE ?
            OR ca.sifra_potrosaca LIKE ?
            OR ca.sifra_kupca LIKE ?
          )
        )
        OR
        (
          (cc.sifra_potrosaca IS NOT NULL OR cc.sifra_kupca IS NOT NULL)
          AND (
            CONCAT(cc.crm_contacts_first_name, ' ', cc.crm_contacts_last_name) LIKE ?
            OR cc.sifra_potrosaca LIKE ?
            OR cc.sifra_kupca LIKE ?
          )
        )
      ORDER BY vua.id
      LIMIT ? OFFSET ?
    `;

    const rows: any[] = await this.prismaLegacy.$queryRawUnsafe(
      sql,
      searchQuery,
      searchQuery,
      searchQuery,
      searchQuery,
      searchQuery,
      searchQuery,
      this.entriesPerPage,
      offset,
    );

    // Format output
    const data = rows.map((row) => {
      let value = `ID: ${row.id}`;
      if (row.sifra_potrosaca) {
        value += ` | Potrošač: ${row.sifra_potrosaca}`;
      }
      if (row.sifra_kupca) {
        value += ` | Kupac: ${row.sifra_kupca}`;
      }
      value += ` | ${row.name}`;
      return value;
    });

    // Count total
    const countSql = `
      SELECT COUNT(*) AS total FROM vodovod_user_accounts vua
      LEFT JOIN crm_contacts cc ON cc.id = vua.crm_contact_id
      LEFT JOIN crm_accounts ca ON ca.id = vua.crm_account_id
      WHERE
        (
          (ca.sifra_potrosaca IS NOT NULL OR ca.sifra_kupca IS NOT NULL)
          AND (
            ca.crm_accounts_name LIKE ?
            OR ca.sifra_potrosaca LIKE ?
            OR ca.sifra_kupca LIKE ?
          )
        )
        OR
        (
          (cc.sifra_potrosaca IS NOT NULL OR cc.sifra_kupca IS NOT NULL)
          AND (
            CONCAT(cc.crm_contacts_first_name, ' ', cc.crm_contacts_last_name) LIKE ?
            OR cc.sifra_potrosaca LIKE ?
            OR cc.sifra_kupca LIKE ?
          )
        )
    `;

    const countResult: any[] = await this.prismaLegacy.$queryRawUnsafe(
      countSql,
      searchQuery,
      searchQuery,
      searchQuery,
      searchQuery,
      searchQuery,
      searchQuery,
    );

    const totalRows = countResult[0]?.total || 0;
    const hasMore = offset + this.entriesPerPage < totalRows;

    return {
      data,
      hasMore,
    };
  }

  /**
   * Get CRM contacts for SearchList
   */
  async getCrmContactsForSL(dto: SearchUserAccountsDto) {
    const query = dto.query || '';
    const pageNumber = dto.pageNumber || 0;
    const offset = pageNumber * this.entriesPerPage;
    const searchQuery = `%${query}%`;

    const sql = `
      SELECT
        cc.id,
        cc.sifra_potrosaca,
        cc.sifra_kupca,
        CONCAT(cc.crm_contacts_first_name, ' ', cc.crm_contacts_last_name) AS name
      FROM crm_contacts cc
      WHERE
        (
          (cc.sifra_potrosaca IS NOT NULL OR cc.sifra_kupca IS NOT NULL) AND
          (
            CONCAT(cc.crm_contacts_first_name, ' ', cc.crm_contacts_last_name) LIKE ?
            OR cc.id LIKE ?
            OR cc.sifra_potrosaca LIKE ?
            OR cc.sifra_kupca LIKE ?
          )
        )
      ORDER BY cc.id
      LIMIT ? OFFSET ?
    `;

    const rows: any[] = await this.prismaLegacy.$queryRawUnsafe(
      sql,
      searchQuery,
      searchQuery,
      searchQuery,
      searchQuery,
      this.entriesPerPage,
      offset,
    );

    const data = rows.map((row) => {
      let value = `ID: ${row.id}`;
      if (row.sifra_potrosaca) {
        value += ` | Potrošač: ${row.sifra_potrosaca}`;
      }
      if (row.sifra_kupca) {
        value += ` | Kupac: ${row.sifra_kupca}`;
      }
      value += ` | ${row.name}`;
      return value;
    });

    const countSql = `
      SELECT COUNT(*) AS total FROM crm_contacts cc
      WHERE
        (
          (cc.sifra_potrosaca IS NOT NULL OR cc.sifra_kupca IS NOT NULL) AND
          (
            CONCAT(cc.crm_contacts_first_name, ' ', cc.crm_contacts_last_name) LIKE ?
            OR cc.id LIKE ?
            OR cc.sifra_potrosaca LIKE ?
            OR cc.sifra_kupca LIKE ?
          )
        )
    `;

    const countResult: any[] = await this.prismaLegacy.$queryRawUnsafe(
      countSql,
      searchQuery,
      searchQuery,
      searchQuery,
      searchQuery,
    );

    const totalRows = countResult[0]?.total || 0;
    const hasMore = offset + this.entriesPerPage < totalRows;

    return {
      data,
      hasMore,
    };
  }

  /**
   * Get unused CRM accounts for SearchList
   */
  async getUnusedCrmAccountsForSL(dto: SearchUserAccountsDto) {
    const query = dto.query || '';
    const pageNumber = dto.pageNumber || 0;
    const offset = pageNumber * this.entriesPerPage;
    const searchQuery = `%${query}%`;

    const sql = `
      SELECT
        ca.id,
        ca.sifra_potrosaca,
        ca.sifra_kupca,
        ca.crm_accounts_name
      FROM crm_accounts ca
      LEFT JOIN vodovod_user_accounts vua ON vua.crm_account_id = ca.id
      WHERE
        (vua.crm_account_id IS NULL OR vua.crm_account_id != ca.id)
        AND (ca.sifra_potrosaca IS NOT NULL OR ca.sifra_kupca IS NOT NULL)
        AND (
          ca.crm_accounts_name LIKE ?
          OR ca.id LIKE ?
          OR ca.sifra_potrosaca LIKE ?
          OR ca.sifra_kupca LIKE ?
        )
      ORDER BY ca.id
      LIMIT ? OFFSET ?
    `;

    const rows: any[] = await this.prismaLegacy.$queryRawUnsafe(
      sql,
      searchQuery,
      searchQuery,
      searchQuery,
      searchQuery,
      this.entriesPerPage,
      offset,
    );

    const data = rows.map((row) => {
      let value = `ID: ${row.id}`;
      if (row.sifra_potrosaca) {
        value += ` | Potrošač: ${row.sifra_potrosaca}`;
      }
      if (row.sifra_kupca) {
        value += ` | Kupac: ${row.sifra_kupca}`;
      }
      value += ` | ${row.crm_accounts_name}`;
      return value;
    });

    const countSql = `
      SELECT COUNT(*) AS total FROM crm_accounts ca
      LEFT JOIN vodovod_user_accounts vua ON vua.crm_account_id = ca.id
      WHERE
        (vua.crm_account_id IS NULL OR vua.crm_account_id != ca.id)
        AND (ca.sifra_potrosaca IS NOT NULL OR ca.sifra_kupca IS NOT NULL)
        AND (
          ca.crm_accounts_name LIKE ?
          OR ca.id LIKE ?
          OR ca.sifra_potrosaca LIKE ?
          OR ca.sifra_kupca LIKE ?
        )
    `;

    const countResult: any[] = await this.prismaLegacy.$queryRawUnsafe(
      countSql,
      searchQuery,
      searchQuery,
      searchQuery,
      searchQuery,
    );

    const totalRows = countResult[0]?.total || 0;
    const hasMore = offset + this.entriesPerPage < totalRows;

    return {
      data,
      hasMore,
    };
  }

  /**
   * Get unused CRM contacts for SearchList
   */
  async getUnusedCrmContactsForSL(dto: SearchUserAccountsDto) {
    const query = dto.query || '';
    const pageNumber = dto.pageNumber || 0;
    const offset = pageNumber * this.entriesPerPage;
    const searchQuery = `%${query}%`;

    const sql = `
      SELECT
        cc.id,
        cc.sifra_potrosaca,
        cc.sifra_kupca,
        CONCAT(cc.crm_contacts_first_name, ' ', cc.crm_contacts_last_name) AS name
      FROM crm_contacts cc
      LEFT JOIN vodovod_user_accounts vua ON vua.crm_contact_id = cc.id
      WHERE
        (
          (vua.crm_contact_id IS NULL OR vua.crm_contact_id != cc.id) AND
          (cc.sifra_potrosaca IS NOT NULL OR cc.sifra_kupca IS NOT NULL) AND
          (
            CONCAT(cc.crm_contacts_first_name, ' ', cc.crm_contacts_last_name) LIKE ?
            OR cc.id LIKE ?
            OR cc.sifra_potrosaca LIKE ?
            OR cc.sifra_kupca LIKE ?
          )
        )
      ORDER BY cc.id
      LIMIT ? OFFSET ?
    `;

    const rows: any[] = await this.prismaLegacy.$queryRawUnsafe(
      sql,
      searchQuery,
      searchQuery,
      searchQuery,
      searchQuery,
      this.entriesPerPage,
      offset,
    );

    const data = rows.map((row) => {
      let value = `ID: ${row.id}`;
      if (row.sifra_potrosaca) {
        value += ` | Potrošač: ${row.sifra_potrosaca}`;
      }
      if (row.sifra_kupca) {
        value += ` | Kupac: ${row.sifra_kupca}`;
      }
      value += ` | ${row.name}`;
      return value;
    });

    const countSql = `
      SELECT COUNT(*) AS total FROM crm_contacts cc
      LEFT JOIN vodovod_user_accounts vua ON vua.crm_contact_id = cc.id
      WHERE
        (
          (vua.crm_contact_id IS NULL OR vua.crm_contact_id != cc.id) AND
          (cc.sifra_potrosaca IS NOT NULL OR cc.sifra_kupca IS NOT NULL) AND
          (
            CONCAT(cc.crm_contacts_first_name, ' ', cc.crm_contacts_last_name) LIKE ?
            OR cc.id LIKE ?
            OR cc.sifra_potrosaca LIKE ?
            OR cc.sifra_kupca LIKE ?
          )
        )
    `;

    const countResult: any[] = await this.prismaLegacy.$queryRawUnsafe(
      countSql,
      searchQuery,
      searchQuery,
      searchQuery,
      searchQuery,
    );

    const totalRows = countResult[0]?.total || 0;
    const hasMore = offset + this.entriesPerPage < totalRows;

    return {
      data,
      hasMore,
    };
  }

  /**
   * Get unused cashier CRM contacts for SearchList
   */
  async getUnusedCashierCrmContactsForSL(dto: SearchUserAccountsDto) {
    const query = dto.query || '';
    const pageNumber = dto.pageNumber || 0;
    const offset = pageNumber * this.entriesPerPage;
    const searchQuery = `%${query}%`;

    const sql = `
      SELECT
        cc.id,
        cc.sifra_potrosaca,
        cc.sifra_kupca,
        CONCAT(cc.crm_contacts_first_name, ' ', cc.crm_contacts_last_name) AS name
      FROM crm_contacts cc
      LEFT JOIN vodovod_cashiers vc ON vc.crm_contact_id = cc.id
      WHERE
        (
          vc.crm_contact_id IS NULL AND
          (
            CONCAT(cc.crm_contacts_first_name, ' ', cc.crm_contacts_last_name) LIKE ?
            OR cc.id LIKE ?
            OR cc.sifra_potrosaca LIKE ?
            OR cc.sifra_kupca LIKE ?
          )
        )
      ORDER BY cc.id
      LIMIT ? OFFSET ?
    `;

    const rows: any[] = await this.prismaLegacy.$queryRawUnsafe(
      sql,
      searchQuery,
      searchQuery,
      searchQuery,
      searchQuery,
      this.entriesPerPage,
      offset,
    );

    const data = rows.map((row) => {
      let value = `ID: ${row.id}`;
      if (row.sifra_potrosaca) {
        value += ` | Potrošač: ${row.sifra_potrosaca}`;
      }
      if (row.sifra_kupca) {
        value += ` | Kupac: ${row.sifra_kupca}`;
      }
      value += ` | ${row.name}`;
      return value;
    });

    const countSql = `
      SELECT COUNT(*) AS total FROM crm_contacts cc
      WHERE
        (
          (cc.sifra_potrosaca IS NOT NULL OR cc.sifra_kupca IS NOT NULL) AND
          (
            CONCAT(cc.crm_contacts_first_name, ' ', cc.crm_contacts_last_name) LIKE ?
            OR cc.id LIKE ?
            OR cc.sifra_potrosaca LIKE ?
            OR cc.sifra_kupca LIKE ?
          )
        )
    `;

    const countResult: any[] = await this.prismaLegacy.$queryRawUnsafe(
      countSql,
      searchQuery,
      searchQuery,
      searchQuery,
      searchQuery,
    );

    const totalRows = countResult[0]?.total || 0;
    const hasMore = offset + this.entriesPerPage < totalRows;

    return {
      data,
      hasMore,
    };
  }

  /**
   * Add new user account
   */
  async addRow(dto: CreateUserAccountDto) {
    // Validate that user is not both contact and account
    if (dto.crm_contact_id && dto.crm_account_id) {
      throw new BadRequestException('Korisnik ne može biti pravno i fizičko lice');
    }

    try {
      // Start transaction
      // Insert user account
      const fields: string[] = [];
      const values: any[] = [];

      if (dto.crm_contact_id !== undefined) {
        fields.push('crm_contact_id');
        values.push(dto.crm_contact_id);
      }

      if (dto.crm_account_id !== undefined) {
        fields.push('crm_account_id');
        values.push(dto.crm_account_id);
      }

      if (dto.delivery_address_id !== undefined) {
        fields.push('delivery_address_id');
        values.push(dto.delivery_address_id);
      }

      if (fields.length === 0) {
        throw new BadRequestException('No valid fields provided');
      }

      const placeholders = fields.map(() => '?').join(',');
      const insertQuery = `
        INSERT INTO vodovod_user_accounts (${fields.join(',')})
        VALUES (${placeholders})
      `;

      const result: any = await this.prismaLegacy.$executeRawUnsafe(insertQuery, ...values);

      const userAccountId = result.insertId || result;

      // Assign pricelists
      if (dto.pricelist_ids && dto.pricelist_ids.length > 0) {
        for (const pricelistId of dto.pricelist_ids) {
          await this.assignPricelistToUserAccount({
            user_account_id: userAccountId,
            pricelist_id: pricelistId,
          });
        }
      }

      return { success: true, id: userAccountId };
    } catch (error) {
      this.logger.error('Error adding user account:', error);

      if (error.code === 'ER_DUP_ENTRY') {
        throw new BadRequestException('Korisnik vec postoji!');
      }

      throw error;
    }
  }

  // Helper methods

  private async getUserAccountServiceByID(id: number) {
    const query = `
      SELECT vwsp.*, vs.*, vcc.category, vuas.*
      FROM vodovod_user_account_services vuas
      LEFT JOIN vodovod_water_services_pricelist vwsp ON vuas.pricelist_id = vwsp.id
      LEFT JOIN vodovod_service vs ON vs.id = vwsp.service_id
      LEFT JOIN vodovod_consumer_categories vcc ON vcc.id = vwsp.category_id
      WHERE vuas.id = ?
    `;

    const results: any[] = await this.prismaLegacy.$queryRawUnsafe(query, id);

    return results && results.length > 0 ? results[0] : null;
  }

  private async getConsumerData(consumerId: number) {
    const query = `
      SELECT
        oa.address_name AS mp_address_name,
        vmp.ulaz AS mp_ulaz,
        vmp.broj AS mp_broj,
        vmp.broj2 AS mp_broj2,
        vmp.latitude AS mp_latitude,
        vmp.longtitude AS mp_longtitude,
        oc.cities_name AS mp_cities_name,
        vc.*
      FROM vodovod_consumers vc
      LEFT JOIN vodovod_measuring_points vmp ON vmp.IDMM = vc.idmm
      LEFT JOIN ordering_addresses oa ON oa.id = vmp.IDU
      LEFT JOIN ordering_cities oc ON oc.id = oa.city_id
      WHERE vc.sifra_potrosaca = ?
    `;

    const results: any[] = await this.prismaLegacy.$queryRawUnsafe(query, consumerId);

    return results && results.length > 0 ? results[0] : null;
  }

  private async getCustomerData(customerId: number) {
    const query = `SELECT * FROM vodovod_customers WHERE sifra_kupca = ?`;

    const results: any[] = await this.prismaLegacy.$queryRawUnsafe(query, customerId);

    return results && results.length > 0 ? results[0] : null;
  }

  async getLoggedUser(userId: number) {
    const query = `
      SELECT
        c.id,
        CONCAT(c.crm_contacts_first_name, ' ', c.crm_contacts_last_name) as name
      FROM users u
      LEFT JOIN crm_contacts c ON u.id = c.crm_contacts_user_id
      WHERE u.id = ?
    `;

    const result = await this.prismaLegacy.$queryRawUnsafe<any[]>(query, userId);

    if (!result || result.length === 0) {
      return {
        id: userId,
        name: 'Unknown User',
      };
    }

    return {
      id: result[0].id,
      name: result[0].name,
    };
  }
}
