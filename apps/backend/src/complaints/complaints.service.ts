import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaLegacyService } from '../prisma-legacy/prisma-legacy.service';
import { CreateComplaintDto } from './dto/create-complaint.dto';
import { UpdateComplaintDto } from './dto/update-complaint.dto';
import { SearchDto } from './dto/search.dto';
import { AssignExecutorDto } from './dto/assign-executor.dto';
import { CreateComplaintPriorityDto } from './dto/create-complaint-priority.dto';
import { UpdateComplaintPriorityDto } from './dto/update-complaint-priority.dto';
import { CreateStatusHistoryDto } from './dto/create-status-history.dto';

@Injectable()
export class ComplaintsService {
  constructor(private legacyDb: PrismaLegacyService) {}

  async getData() {
    // IDENTIČAN UPIT kao u PHP ComplaintModel::getData (linija 16-69)
    // Konvertujemo nevažeće datetime vrednosti u NULL
    const complaints = await this.legacyDb.$queryRawUnsafe<any[]>(`
      SELECT c.id, c.tip_id AS tip_id_raw, c.kategorija_id AS kategorija_id_raw,
        c.prioritet_id AS prioritet_id_raw, c.status_id AS status_id_raw,
        c.opis, c.napomena, c.korisnik_id AS korisnik_id_raw, c.idmm AS idmm_raw,
        c.faktura_id, c.obracun_id,
        CASE WHEN c.kreirano = '0000-00-00 00:00:00' THEN NULL ELSE DATE_FORMAT(c.kreirano, '%Y-%m-%d %H:%i:%s') END AS kreirano,
        c.kreirao_id AS kreirao_id_raw,
        CASE WHEN c.zatvoreno = '0000-00-00 00:00:00' THEN NULL ELSE DATE_FORMAT(c.zatvoreno, '%Y-%m-%d %H:%i:%s') END AS zatvoreno,
        c.odgovorno_lice_id AS odgovorno_lice_id_raw,
        CONCAT(ct.id, ' | ', ct.naziv) AS tip_id,
        CONCAT(cp.id, ' | ', cp.prioritet) AS prioritet_id,
        CONCAT(cc.id, ' | ', cc.naziv) AS kategorija_id,
        CONCAT(cs.id, ' | ', cs.naziv) AS status_id,
        COALESCE(ca1.crm_accounts_name,
          CONCAT(vua1.id, ' | ', crmc1.crm_contacts_first_name, ' ', crmc1.crm_contacts_last_name)
        ) AS kreirao_id,
        COALESCE(ca2.crm_accounts_name,
          CONCAT(vua2.id, ' | ', crmc2.crm_contacts_first_name, ' ', crmc2.crm_contacts_last_name)
        ) AS korisnik_id,
        COALESCE(ca3.crm_accounts_name,
          CONCAT(vua3.id, ' | ', crmc3.crm_contacts_first_name, ' ', crmc3.crm_contacts_last_name)
        ) AS odgovorno_lice_id,
        CONCAT(mp.IDMM, ' | ', oa.address_name) AS idmm
      FROM vodovod_complaint c
      LEFT JOIN vodovod_complaint_type ct ON c.tip_id = ct.id
      LEFT JOIN vodovod_complaint_priority cp ON c.prioritet_id = cp.id
      LEFT JOIN vodovod_complaint_category cc ON c.kategorija_id = cc.id
      LEFT JOIN vodovod_complaint_status cs ON c.status_id = cs.id

      LEFT JOIN users vua1 ON vua1.id = c.kreirao_id
      LEFT JOIN crm_contacts crmc1 ON crmc1.crm_contacts_user_id = vua1.id
      LEFT JOIN crm_accounts ca1 ON ca1.id = crmc1.crm_contacts_account_id

      LEFT JOIN vodovod_user_accounts vua2 ON vua2.id = c.korisnik_id
      LEFT JOIN crm_contacts crmc2 ON crmc2.id = vua2.crm_contact_id
      LEFT JOIN crm_accounts ca2 ON ca2.id = vua2.crm_account_id

      LEFT JOIN vodovod_user_accounts vua3 ON vua3.id = c.odgovorno_lice_id
      LEFT JOIN crm_contacts crmc3 ON crmc3.id = vua3.crm_contact_id
      LEFT JOIN crm_accounts ca3 ON ca3.id = vua3.crm_account_id

      LEFT JOIN vodovod_measuring_points mp ON c.idmm = mp.IDMM
      LEFT JOIN ordering_addresses oa ON mp.IDU = oa.id
      WHERE c.status_id IN (1, 2, 3, 4, 5)
      ORDER BY c.id DESC
    `);

    return this.mapComplaintsToResponse(complaints);
  }

  async getInactiveData() {
    // IDENTIČAN UPIT kao u PHP ComplaintModel::getInactiveData (linija 71-126)
    // Konvertujemo nevažeće datetime vrednosti u NULL
    const complaints = await this.legacyDb.$queryRawUnsafe<any[]>(`
      SELECT c.id, c.tip_id AS tip_id_raw, c.kategorija_id AS kategorija_id_raw,
        c.prioritet_id AS prioritet_id_raw, c.status_id AS status_id_raw,
        c.opis, c.napomena, c.korisnik_id AS korisnik_id_raw, c.idmm AS idmm_raw,
        c.faktura_id, c.obracun_id,
        CASE WHEN c.kreirano = '0000-00-00 00:00:00' THEN NULL ELSE DATE_FORMAT(c.kreirano, '%Y-%m-%d %H:%i:%s') END AS kreirano,
        c.kreirao_id AS kreirao_id_raw,
        CASE WHEN c.zatvoreno = '0000-00-00 00:00:00' THEN NULL ELSE DATE_FORMAT(c.zatvoreno, '%Y-%m-%d %H:%i:%s') END AS zatvoreno,
        c.odgovorno_lice_id AS odgovorno_lice_id_raw,
        CONCAT(ct.id, ' | ', ct.naziv) AS tip_id,
        CONCAT(cp.id, ' | ', cp.prioritet) AS prioritet_id,
        CONCAT(cc.id, ' | ', cc.naziv) AS kategorija_id,
        CONCAT(cs.id, ' | ', cs.naziv) AS status_id,
        COALESCE(ca1.crm_accounts_name,
          CONCAT(vua1.id, ' | ', crmc1.crm_contacts_first_name, ' ', crmc1.crm_contacts_last_name)
        ) AS kreirao_id,
        COALESCE(ca2.crm_accounts_name,
          CONCAT(vua2.id, ' | ', crmc2.crm_contacts_first_name, ' ', crmc2.crm_contacts_last_name)
        ) AS korisnik_id,
        CASE WHEN c.status_id IN (1,2,3,4,5)
          THEN COALESCE(ca3.crm_accounts_name,
            CONCAT(vua3.id, ' | ', crmc3.crm_contacts_first_name, ' ', crmc3.crm_contacts_last_name)
          )
          ELSE NULL
        END AS odgovorno_lice_id,
        CONCAT(mp.IDMM, ' | ', oa.address_name) AS idmm
      FROM vodovod_complaint c
      LEFT JOIN vodovod_complaint_type ct ON c.tip_id = ct.id
      LEFT JOIN vodovod_complaint_priority cp ON c.prioritet_id = cp.id
      LEFT JOIN vodovod_complaint_category cc ON c.kategorija_id = cc.id
      LEFT JOIN vodovod_complaint_status cs ON c.status_id = cs.id

      LEFT JOIN users vua1 ON vua1.id = c.kreirao_id
      LEFT JOIN crm_contacts crmc1 ON crmc1.crm_contacts_user_id = vua1.id
      LEFT JOIN crm_accounts ca1 ON ca1.id = crmc1.crm_contacts_account_id

      LEFT JOIN vodovod_user_accounts vua2 ON vua2.id = c.korisnik_id
      LEFT JOIN crm_contacts crmc2 ON crmc2.id = vua2.crm_contact_id
      LEFT JOIN crm_accounts ca2 ON ca2.id = vua2.crm_account_id

      LEFT JOIN vodovod_user_accounts vua3 ON vua3.id = c.odgovorno_lice_id
      LEFT JOIN crm_contacts crmc3 ON crmc3.id = vua3.crm_contact_id
      LEFT JOIN crm_accounts ca3 ON ca3.id = vua3.crm_account_id

      LEFT JOIN vodovod_measuring_points mp ON c.idmm = mp.IDMM
      LEFT JOIN ordering_addresses oa ON mp.IDU = oa.id
      ORDER BY c.id DESC
    `);

    return this.mapComplaintsToResponse(complaints);
  }

  async findOne(id: number) {
    // IDENTIČAN UPIT kao u PHP ComplaintModel::getRowById (linija 314-364)
    const complaints = await this.legacyDb.$queryRawUnsafe<any[]>(
      `SELECT c.*,
        CONCAT(ct.id, ' | ', ct.naziv) AS tip_id,
        CONCAT(cp.id, ' | ', cp.prioritet) AS prioritet_id,
        CONCAT(cc.id, ' | ', cc.naziv) AS kategorija_id,
        CONCAT(cs.id, ' | ', cs.naziv) AS status_id,
        COALESCE(ca1.crm_accounts_name,
          CONCAT(vua1.id, ' | ', crmc1.crm_contacts_first_name, ' ', crmc1.crm_contacts_last_name)
        ) AS kreirao_id,
        COALESCE(ca2.crm_accounts_name,
          CONCAT(vua2.id, ' | ', crmc2.crm_contacts_first_name, ' ', crmc2.crm_contacts_last_name)
        ) AS korisnik_id,
        CASE WHEN c.status_id IN (1,2,3,4,5)
          THEN COALESCE(ca3.crm_accounts_name,
            CONCAT(vua3.id, ' | ', crmc3.crm_contacts_first_name, ' ', crmc3.crm_contacts_last_name)
          )
          ELSE NULL
        END AS odgovorno_lice_id,
        CONCAT(mp.IDMM, ' | ', oa.address_name) AS idmm
      FROM vodovod_complaint c
      LEFT JOIN vodovod_complaint_type ct ON c.tip_id = ct.id
      LEFT JOIN vodovod_complaint_priority cp ON c.prioritet_id = cp.id
      LEFT JOIN vodovod_complaint_category cc ON c.kategorija_id = cc.id
      LEFT JOIN vodovod_complaint_status cs ON c.status_id = cs.id

      LEFT JOIN users vua1 ON vua1.id = c.kreirao_id
      LEFT JOIN crm_contacts crmc1 ON crmc1.crm_contacts_user_id = vua1.id
      LEFT JOIN crm_accounts ca1 ON ca1.id = crmc1.crm_contacts_account_id

      LEFT JOIN vodovod_user_accounts vua2 ON vua2.id = c.korisnik_id
      LEFT JOIN crm_contacts crmc2 ON crmc2.id = vua2.crm_contact_id
      LEFT JOIN crm_accounts ca2 ON ca2.id = vua2.crm_account_id

      LEFT JOIN vodovod_user_accounts vua3 ON vua3.id = c.odgovorno_lice_id
      LEFT JOIN crm_contacts crmc3 ON crmc3.id = vua3.crm_contact_id
      LEFT JOIN crm_accounts ca3 ON ca3.id = vua3.crm_account_id

      LEFT JOIN vodovod_measuring_points mp ON c.idmm = mp.IDMM
      LEFT JOIN ordering_addresses oa ON mp.IDU = oa.id
      WHERE c.id = ?`,
      id,
    );

    if (!complaints || complaints.length === 0) {
      throw new NotFoundException(`Reklamacija sa ID ${id} nije pronađena`);
    }

    const mapped = this.mapComplaintsToResponse(complaints);
    return mapped[0];
  }

  async create(createDto: CreateComplaintDto, userId: number) {
    // IDENTIČNA LOGIKA kao u PHP ComplaintModel::addRow (linija 366-435)
    const korisnikId = this.extractId(createDto.korisnik_id);
    const kreiraoId = this.extractId(createDto.kreirao_id) || userId;
    const kreirano = createDto.kreirano || new Date().toISOString().slice(0, 19).replace('T', ' ');
    const zatvoreno = createDto.zatvoreno || '';

    await this.legacyDb.$executeRawUnsafe(
      `INSERT INTO vodovod_complaint (
        tip_id, kategorija_id, prioritet_id, status_id, opis, napomena,
        korisnik_id, idmm, faktura_id, obracun_id, kreirano, kreirao_id, zatvoreno
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      this.extractId(createDto.tip_id),
      this.extractId(createDto.kategorija_id),
      this.extractId(createDto.prioritet_id),
      this.extractId(createDto.status_id),
      createDto.opis,
      createDto.napomena || null,
      korisnikId,
      this.extractId(createDto.idmm),
      createDto.faktura_id || null,
      createDto.obracun_id || null,
      kreirano,
      kreiraoId,
      zatvoreno,
    );

    const lastIdResult = await this.legacyDb.$queryRawUnsafe<any[]>('SELECT LAST_INSERT_ID() as id');
    const insertedId = Number(lastIdResult[0]?.id);

    return this.findOne(insertedId);
  }

  async update(id: number, updateDto: UpdateComplaintDto, userId: number) {
    await this.findOne(id);

    // IDENTIČNA LOGIKA kao u PHP ComplaintModel::editRow (linija 437-516)
    const korisnikId = updateDto.korisnik_id ? this.extractId(updateDto.korisnik_id) : null;
    const kreiraoId = updateDto.kreirao_id ? this.extractId(updateDto.kreirao_id) : userId;
    const kreirano = updateDto.kreirano || new Date().toISOString().slice(0, 19).replace('T', ' ');
    const zatvoreno = updateDto.zatvoreno || null;

    await this.legacyDb.$executeRawUnsafe(
      `UPDATE vodovod_complaint SET
        tip_id = ?, kategorija_id = ?, prioritet_id = ?, status_id = ?,
        opis = ?, napomena = ?, korisnik_id = ?, idmm = ?, faktura_id = ?,
        obracun_id = ?, kreirano = ?, kreirao_id = ?, zatvoreno = ?
      WHERE id = ?`,
      this.extractId(updateDto.tip_id),
      this.extractId(updateDto.kategorija_id),
      this.extractId(updateDto.prioritet_id),
      this.extractId(updateDto.status_id),
      updateDto.opis,
      updateDto.napomena || null,
      korisnikId,
      this.extractId(updateDto.idmm),
      updateDto.faktura_id || null,
      updateDto.obracun_id || null,
      kreirano,
      kreiraoId,
      zatvoreno,
      id,
    );

    return this.findOne(id);
  }

  async remove(id: number) {
    await this.findOne(id);

    // IDENTIČNA LOGIKA kao u PHP ComplaintModel::deleteRow (linija 539-558)
    const result = await this.legacyDb.$executeRawUnsafe(
      `DELETE FROM vodovod_complaint WHERE id = ?`,
      id,
    );

    return { success: true, message: 'Reklamacija uspešno obrisana' };
  }

  async searchTypes(searchDto: SearchDto, limit: number = 10) {
    // IDENTIČNA LOGIKA kao u PHP ComplaintModel::getComplaintTypeForSL (linija 128-161)
    const query = searchDto.query || '';
    const pageNumber = searchDto.pageNumber || 0;
    const offset = pageNumber * limit;
    const searchQuery = `%${query}%`;

    const types = await this.legacyDb.$queryRawUnsafe<any[]>(
      `SELECT ct.id, ct.naziv as tip_id
       FROM vodovod_complaint_type ct
       WHERE (ct.naziv LIKE ? OR ct.id LIKE ?)
       ORDER BY ct.id
       LIMIT ? OFFSET ?`,
      searchQuery,
      searchQuery,
      limit,
      offset,
    );

    const countResult = await this.legacyDb.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*) as total
       FROM vodovod_complaint_type ct
       WHERE (ct.naziv LIKE ? OR ct.id LIKE ?)`,
      searchQuery,
      searchQuery,
    );

    const totalRows = Number(countResult[0]?.total) || 0;
    const hasMore = offset + limit < totalRows;

    return {
      data: types.map((t) => `${Number(t.id)} | ${t.tip_id}`),
      hasMore,
    };
  }

  async searchPriorities(searchDto: SearchDto, limit: number = 10) {
    // IDENTIČNA LOGIKA kao u PHP ComplaintModel::getComplaintPriorityForSL (linija 163-196)
    const query = searchDto.query || '';
    const pageNumber = searchDto.pageNumber || 0;
    const offset = pageNumber * limit;
    const searchQuery = `%${query}%`;

    const priorities = await this.legacyDb.$queryRawUnsafe<any[]>(
      `SELECT cp.id, cp.prioritet as prioritet_id
       FROM vodovod_complaint_priority cp
       WHERE (cp.prioritet LIKE ? OR cp.id LIKE ?)
       ORDER BY cp.id
       LIMIT ? OFFSET ?`,
      searchQuery,
      searchQuery,
      limit,
      offset,
    );

    const countResult = await this.legacyDb.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*) as total
       FROM vodovod_complaint_priority cp
       WHERE (cp.prioritet LIKE ? OR cp.id LIKE ?)`,
      searchQuery,
      searchQuery,
    );

    const totalRows = Number(countResult[0]?.total) || 0;
    const hasMore = offset + limit < totalRows;

    return {
      data: priorities.map((p) => `${Number(p.id)} | ${p.prioritet_id}`),
      hasMore,
    };
  }

  async searchCategories(searchDto: SearchDto, limit: number = 10) {
    // IDENTIČNA LOGIKA kao u PHP ComplaintModel::getComplaintCategoryForSL (linija 198-231)
    const query = searchDto.query || '';
    const pageNumber = searchDto.pageNumber || 0;
    const offset = pageNumber * limit;
    const searchQuery = `%${query}%`;

    const categories = await this.legacyDb.$queryRawUnsafe<any[]>(
      `SELECT cc.id, cc.naziv as kategorija_id
       FROM vodovod_complaint_category cc
       WHERE (cc.naziv LIKE ? OR cc.id LIKE ?)
       ORDER BY cc.id
       LIMIT ? OFFSET ?`,
      searchQuery,
      searchQuery,
      limit,
      offset,
    );

    const countResult = await this.legacyDb.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*) as total
       FROM vodovod_complaint_category cc
       WHERE (cc.naziv LIKE ? OR cc.id LIKE ?)`,
      searchQuery,
      searchQuery,
    );

    const totalRows = Number(countResult[0]?.total) || 0;
    const hasMore = offset + limit < totalRows;

    return {
      data: categories.map((c) => `${Number(c.id)} | ${c.kategorija_id}`),
      hasMore,
    };
  }

  async searchStatuses(searchDto: SearchDto, limit: number = 10) {
    // IDENTIČNA LOGIKA kao u PHP ComplaintModel::getComplaintStatusForSL (linija 233-266)
    const query = searchDto.query || '';
    const pageNumber = searchDto.pageNumber || 0;
    const offset = pageNumber * limit;
    const searchQuery = `%${query}%`;

    const statuses = await this.legacyDb.$queryRawUnsafe<any[]>(
      `SELECT cs.id, cs.naziv as status_id
       FROM vodovod_complaint_status cs
       WHERE (cs.naziv LIKE ? OR cs.id LIKE ?)
       ORDER BY cs.id
       LIMIT ? OFFSET ?`,
      searchQuery,
      searchQuery,
      limit,
      offset,
    );

    const countResult = await this.legacyDb.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*) as total
       FROM vodovod_complaint_status cs
       WHERE (cs.naziv LIKE ? OR cs.id LIKE ?)`,
      searchQuery,
      searchQuery,
    );

    const totalRows = Number(countResult[0]?.total) || 0;
    const hasMore = offset + limit < totalRows;

    return {
      data: statuses.map((s) => `${Number(s.id)} | ${s.status_id}`),
      hasMore,
    };
  }

  async getKorisnikById(id: number) {
    // IDENTIČNA LOGIKA kao u PHP ComplaintModel::getKorisnikByID (linija 268-312)
    const result = await this.legacyDb.$queryRawUnsafe<any[]>(
      `SELECT
        COALESCE(ca.crm_accounts_name,
          CONCAT(crmc.crm_contacts_first_name, ' ', crmc.crm_contacts_last_name)
        ) AS naziv,
        c.idmm as idmm,
        COALESCE(ca.sifra_potrosaca, crmc.sifra_potrosaca) AS sifra_potrosaca,
        COALESCE(ca.crm_accounts_address, crmc.personal_number) AS jmbg,
        COALESCE(ca.crm_accounts_address, crmc.crm_contacts_address) AS ulica_broj,
        COALESCE(ca.crm_accounts_city, crmc.crm_contacts_city) AS mesto,
        crmc.goverment_id AS broj_lk,
        crmc.place_of_id_card AS mesto_izdavanja_lk,
        COALESCE(crmc.crm_contacts_email, ca.crm_accounts_email) AS email,
        COALESCE(crmc.crm_contacts_mobile_phone, ca.crm_accounts_mobile_phone) AS kontakt_telefon
      FROM vodovod_complaint c
      LEFT JOIN vodovod_user_accounts vua ON vua.id = c.korisnik_id
      LEFT JOIN crm_contacts crmc ON crmc.id = vua.crm_contact_id
      LEFT JOIN crm_accounts ca ON ca.id = vua.crm_account_id
      LEFT JOIN users u ON u.id = crmc.crm_contacts_user_id
      LEFT JOIN vodovod_measuring_points mp ON c.idmm = mp.IDMM
      LEFT JOIN ordering_addresses oa ON mp.IDU = oa.id
      WHERE c.id = ?`,
      id,
    );

    return result[0] || null;
  }

  async assignExecutor(assignDto: AssignExecutorDto) {
    // IDENTIČNA LOGIKA kao u PHP ComplaintModel::assignExecutor (linija 560-619)
    const izvrsilacId = this.extractId(assignDto.executorId);

    await this.legacyDb.$executeRawUnsafe(
      `UPDATE vodovod_complaint SET odgovorno_lice_id = ? WHERE id = ?`,
      izvrsilacId,
      assignDto.complaintId,
    );

    const napomena = `Dodeljen izvršilac (ID: ${izvrsilacId})`;
    await this.legacyDb.$executeRawUnsafe(
      `INSERT INTO vodovod_complaint_status_history
       (reklamacija_id, status_id, napomena, datum_promene, user_id)
       VALUES (?, ?, ?, NOW(), ?)`,
      assignDto.complaintId,
      this.extractId(assignDto.statusId),
      napomena,
      izvrsilacId,
    );

    return { success: true, message: 'Izvršilac uspešno dodeljen' };
  }

  async getExecutorForComplaint(complaintId: number) {
    // IDENTIČNA LOGIKA kao u PHP ComplaintModel::getExecutorForComplaint (linija 621-639)
    const result = await this.legacyDb.$queryRawUnsafe<any[]>(
      `SELECT odgovorno_lice_id FROM vodovod_complaint WHERE id = ?`,
      complaintId,
    );

    return {
      executorId: result[0]?.odgovorno_lice_id || null,
      row: result[0] || null,
    };
  }

  private extractId(value: any): number | null {
    // IDENTIČNA LOGIKA kao u PHP ComplaintModel::extractId (linija 518-537)
    if (!value) return null;

    const strValue = String(value);

    const idMatch = strValue.match(/ID:\s*(\d+)/);
    if (idMatch) {
      return Number(idMatch[1]);
    }

    if (strValue.includes(' | ')) {
      return Number(strValue.split(' | ')[0]);
    }

    if (!isNaN(Number(value))) {
      return Number(value);
    }

    return null;
  }

  private mapComplaintsToResponse(complaints: any[]) {
    return complaints.map((c) => ({
      id: Number(c.id),
      tip_id: c.tip_id,
      kategorija_id: c.kategorija_id,
      prioritet_id: c.prioritet_id,
      status_id: c.status_id,
      opis: c.opis,
      napomena: c.napomena,
      korisnik_id: c.korisnik_id,
      idmm: c.idmm,
      faktura_id: c.faktura_id ? Number(c.faktura_id) : null,
      obracun_id: c.obracun_id ? Number(c.obracun_id) : null,
      kreirano: c.kreirano,
      kreirao_id: c.kreirao_id,
      odgovorno_lice_id: c.odgovorno_lice_id,
      zatvoreno: c.zatvoreno,
    }));
  }

  // ==================== COMPLAINT PRIORITIES ====================

  async getAllPriorities() {
    // IDENTIČNO kao u PHP ComplaintPrioritiesModel::getAll (linija 9-21)
    const priorities = await this.legacyDb.$queryRawUnsafe<any[]>(
      `SELECT * FROM vodovod_complaint_priority ORDER BY id DESC`,
    );
    return priorities.map((p) => ({
      id: Number(p.id),
      prioritet: p.prioritet,
    }));
  }

  async createPriority(dto: CreateComplaintPriorityDto) {
    // IDENTIČNO kao u PHP ComplaintPrioritiesModel::addRow (linija 23-37)
    await this.legacyDb.$executeRawUnsafe(
      `INSERT INTO vodovod_complaint_priority (prioritet) VALUES (?)`,
      dto.prioritet,
    );

    const lastIdResult = await this.legacyDb.$queryRawUnsafe<any[]>('SELECT LAST_INSERT_ID() as id');
    const insertedId = Number(lastIdResult[0]?.id);

    return this.getPriorityById(insertedId);
  }

  async updatePriority(id: number, dto: UpdateComplaintPriorityDto) {
    // IDENTIČNO kao u PHP ComplaintPrioritiesModel::editRow (linija 51-64)
    await this.getPriorityById(id); // Provera da li postoji

    await this.legacyDb.$executeRawUnsafe(
      `UPDATE vodovod_complaint_priority SET prioritet = ? WHERE id = ?`,
      dto.prioritet,
      id,
    );

    return this.getPriorityById(id);
  }

  async deletePriority(id: number) {
    // IDENTIČNO kao u PHP ComplaintPrioritiesModel::deleteRow (linija 66-74)
    await this.getPriorityById(id); // Provera da li postoji

    await this.legacyDb.$executeRawUnsafe(
      `DELETE FROM vodovod_complaint_priority WHERE id = ?`,
      id,
    );

    return { success: true, message: 'Prioritet uspešno obrisan' };
  }

  private async getPriorityById(id: number) {
    // IDENTIČNO kao u PHP ComplaintPrioritiesModel::getRowById (linija 39-49)
    const result = await this.legacyDb.$queryRawUnsafe<any[]>(
      `SELECT * FROM vodovod_complaint_priority WHERE id = ?`,
      id,
    );

    if (!result || result.length === 0) {
      throw new NotFoundException(`Prioritet sa ID ${id} nije pronađen`);
    }

    return {
      id: Number(result[0].id),
      prioritet: result[0].prioritet,
    };
  }

  // ==================== COMPLAINTS BY ASSIGNEE ====================

  async getComplaintsByAssignee(currentUserId: number) {
    // IDENTIČNO kao u PHP ComplaintsByAssigneModel::getRows (linija 16-64)
    // Prvo pronađi vodovod_user_accounts.id za trenutnog korisnika
    const userIdResult = await this.legacyDb.$queryRawUnsafe<any[]>(
      `SELECT ua.id
       FROM vodovod_user_accounts ua
       LEFT JOIN crm_contacts cc ON ua.crm_contact_id = cc.id
       LEFT JOIN users u ON cc.crm_contacts_user_id = u.id
       WHERE u.id = ?`,
      currentUserId,
    );

    if (!userIdResult || userIdResult.length === 0) {
      return [];
    }

    const userAccountId = Number(userIdResult[0].id);

    // Dohvati poslednje statuse reklamacija za ovog korisnika
    const rows = await this.legacyDb.$queryRawUnsafe<any[]>(
      `SELECT csh.*,
              CONCAT(cs.id, ' | ', cs.naziv) AS status_id
       FROM vodovod_complaint_status_history csh
       LEFT JOIN vodovod_complaint_status cs ON csh.status_id = cs.id
       INNER JOIN (
           SELECT reklamacija_id, MAX(id) AS max_id
           FROM vodovod_complaint_status_history
           WHERE user_id = ?
           GROUP BY reklamacija_id
       ) latest ON csh.id = latest.max_id
       ORDER BY csh.id DESC`,
      userAccountId,
    );

    return rows.map((r) => ({
      id: Number(r.id),
      reklamacija_id: Number(r.reklamacija_id),
      status_id: r.status_id,
      napomena: r.napomena,
      datum_promene: r.datum_promene,
      user_id: Number(r.user_id),
    }));
  }

  async createStatusHistory(dto: CreateStatusHistoryDto, currentUserId: number) {
    // IDENTIČNO kao u PHP ComplaintsByAssigneModel::editRow (linija 66-135)

    // Pronađi vodovod_user_accounts.id za trenutnog korisnika
    const userIdResult = await this.legacyDb.$queryRawUnsafe<any[]>(
      `SELECT ua.id
       FROM vodovod_user_accounts ua
       LEFT JOIN crm_contacts cc ON ua.crm_contact_id = cc.id
       LEFT JOIN users u ON cc.crm_contacts_user_id = u.id
       WHERE u.id = ?`,
      currentUserId,
    );

    if (!userIdResult || userIdResult.length === 0) {
      throw new NotFoundException('Korisnik nije pronađen u vodovod_user_accounts');
    }

    const userAccountId = Number(userIdResult[0].id);

    const datumPromene = dto.datum_promene || new Date().toISOString().slice(0, 19).replace('T', ' ');
    const statusId = this.extractId(dto.status_id);

    await this.legacyDb.$executeRawUnsafe(
      `INSERT INTO vodovod_complaint_status_history
       (reklamacija_id, status_id, napomena, datum_promene, user_id)
       VALUES (?, ?, ?, ?, ?)`,
      dto.reklamacija_id,
      statusId,
      dto.napomena || null,
      datumPromene,
      userAccountId,
    );

    const lastIdResult = await this.legacyDb.$queryRawUnsafe<any[]>('SELECT LAST_INSERT_ID() as id');
    const insertedId = Number(lastIdResult[0]?.id);

    return this.getStatusHistoryRowById(insertedId);
  }

  async getStatusComplaintHistory(reklamacijaId: number) {
    // IDENTIČNO kao u PHP ComplaintsByAssigneModel::getStatusComplaintHistory (linija 160-191)
    const rows = await this.legacyDb.$queryRawUnsafe<any[]>(
      `SELECT csh.*,
              CONCAT(cs.id, ' | ', cs.naziv) AS status_id,
              COALESCE(ca.crm_accounts_name,
                CONCAT(vua.id, ' | ', crmc.crm_contacts_first_name, ' ', crmc.crm_contacts_last_name)
              ) AS user_id
       FROM vodovod_complaint_status_history csh
       LEFT JOIN vodovod_complaint_status cs ON csh.status_id = cs.id
       LEFT JOIN vodovod_complaint c ON csh.reklamacija_id = c.id
       LEFT JOIN vodovod_user_accounts vua ON vua.id = csh.user_id
       LEFT JOIN crm_contacts crmc ON crmc.id = vua.crm_contact_id
       LEFT JOIN crm_accounts ca ON ca.id = vua.crm_account_id
       WHERE csh.reklamacija_id = ?
       ORDER BY csh.id DESC`,
      reklamacijaId,
    );

    return rows.map((r) => ({
      id: Number(r.id),
      reklamacija_id: Number(r.reklamacija_id),
      status_id: r.status_id,
      napomena: r.napomena,
      datum_promene: r.datum_promene,
      user_id: r.user_id,
    }));
  }

  private async getStatusHistoryRowById(id: number) {
    // IDENTIČNO kao u PHP ComplaintsByAssigneModel::getRowById (linija 137-158)
    const result = await this.legacyDb.$queryRawUnsafe<any[]>(
      `SELECT csh.*,
              CONCAT(cs.id, ' | ', cs.naziv) AS status_id
       FROM vodovod_complaint_status_history csh
       LEFT JOIN vodovod_complaint_status cs ON csh.status_id = cs.id
       INNER JOIN (
           SELECT reklamacija_id, MAX(id) AS max_id
           FROM vodovod_complaint_status_history
           GROUP BY reklamacija_id
       ) latest ON csh.id = latest.max_id
       WHERE csh.id = ?`,
      id,
    );

    if (!result || result.length === 0) {
      throw new NotFoundException(`Status historija sa ID ${id} nije pronađena`);
    }

    return {
      id: Number(result[0].id),
      reklamacija_id: Number(result[0].reklamacija_id),
      status_id: result[0].status_id,
      napomena: result[0].napomena,
      datum_promene: result[0].datum_promene,
      user_id: Number(result[0].user_id),
    };
  }
}
