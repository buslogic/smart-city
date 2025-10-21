import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaLegacyService } from '../prisma-legacy/prisma-legacy.service';
import { CreateWaterSupplyNoteDto } from './dto/create-water-supply-note.dto';
import { UpdateWaterSupplyNoteDto } from './dto/update-water-supply-note.dto';
import { SearchCategoryDto } from './dto/search-category.dto';

@Injectable()
export class WaterSupplyNotesService {
  constructor(private legacyDb: PrismaLegacyService) {}

  async findAll() {
    // IDENTIČAN UPIT kao u PHP WaterSupplyNotesModel::getRows (linija 13-30)
    const notes = await this.legacyDb.$queryRawUnsafe<any[]>(`
      SELECT n.*, CONCAT(nc.id, ' | ', nc.name) as category_id
      FROM vodovod_notes n
      LEFT JOIN vodovod_note_categories nc on n.category_id = nc.id
      WHERE n.deleted_at IS NULL
      ORDER BY n.id DESC
    `);

    return notes.map((note) => ({
      id: Number(note.id),
      categoryId: note.category_id,
      title: note.title,
      body: note.body,
      authorId: note.author_id ? Number(note.author_id) : null,
      isPinned: Number(note.is_pinned),
      isPrivate: Number(note.is_private),
      createdAt: note.created_at,
      updatedAt: note.updated_at,
    }));
  }

  async findOne(id: number) {
    // IDENTIČAN UPIT kao u PHP WaterSupplyNotesModel::getRowById (linija 68-82)
    const notes = await this.legacyDb.$queryRawUnsafe<any[]>(
      `SELECT n.*, CONCAT(nc.id, ' | ', nc.name) as category_id
       FROM vodovod_notes n
       LEFT JOIN vodovod_note_categories nc on n.category_id = nc.id
       WHERE n.id = ?`,
      id,
    );

    if (!notes || notes.length === 0) {
      throw new NotFoundException(`Beleška sa ID ${id} nije pronađena`);
    }

    const note = notes[0];
    return {
      id: Number(note.id),
      categoryId: note.category_id,
      title: note.title,
      body: note.body,
      authorId: note.author_id ? Number(note.author_id) : null,
      isPinned: Number(note.is_pinned),
      isPrivate: Number(note.is_private),
      createdAt: note.created_at,
      updatedAt: note.updated_at,
    };
  }

  async create(createDto: CreateWaterSupplyNoteDto) {
    // IDENTIČNA LOGIKA kao u PHP WaterSupplyNotesModel::addRow (linija 84-125)
    const categoryIdPart = String(createDto.categoryId).split(' | ')[0];
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    const result = await this.legacyDb.$executeRawUnsafe(
      `INSERT INTO vodovod_notes (category_id, title, body, author_id, is_pinned, is_private, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      parseInt(categoryIdPart),
      createDto.title,
      createDto.body,
      createDto.authorId || null,
      createDto.isPinned || 0,
      createDto.isPrivate || 0,
      now,
    );

    const lastIdResult = await this.legacyDb.$queryRawUnsafe<any[]>('SELECT LAST_INSERT_ID() as id');
    const insertedId = Number(lastIdResult[0]?.id);

    return this.findOne(insertedId);
  }

  async update(id: number, updateDto: UpdateWaterSupplyNoteDto) {
    await this.findOne(id);

    // IDENTIČNA LOGIKA kao u PHP WaterSupplyNotesModel::editRow (linija 127-177)
    const categoryIdPart = updateDto.categoryId ? String(updateDto.categoryId).split(' | ')[0] : null;
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    const updates: string[] = [];
    const values: any[] = [];

    if (categoryIdPart !== null) {
      updates.push('category_id = ?');
      values.push(parseInt(categoryIdPart));
    }
    if (updateDto.title !== undefined) {
      updates.push('title = ?');
      values.push(updateDto.title);
    }
    if (updateDto.body !== undefined) {
      updates.push('body = ?');
      values.push(updateDto.body);
    }
    if (updateDto.isPinned !== undefined) {
      updates.push('is_pinned = ?');
      values.push(updateDto.isPinned);
    }
    if (updateDto.isPrivate !== undefined) {
      updates.push('is_private = ?');
      values.push(updateDto.isPrivate);
    }

    if (updates.length === 0) {
      return this.findOne(id);
    }

    updates.push('updated_at = ?');
    values.push(now);
    values.push(id);

    const setClause = updates.join(', ');
    await this.legacyDb.$executeRawUnsafe(`UPDATE vodovod_notes SET ${setClause} WHERE id = ?`, ...values);

    return this.findOne(id);
  }

  async remove(id: number) {
    await this.findOne(id);

    // IDENTIČNA LOGIKA kao u PHP WaterSupplyNotesModel::deleteRow (linija 179-198)
    // Soft delete sa deleted_at timestampom
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    const result = await this.legacyDb.$executeRawUnsafe(`UPDATE vodovod_notes SET deleted_at = ? WHERE id = ?`, now, id);

    return { success: true, message: 'Beleška uspešno obrisana' };
  }

  async searchCategories(searchDto: SearchCategoryDto, limit: number = 10) {
    // IDENTIČNA LOGIKA kao u PHP WaterSupplyNotesModel::getCategoryForSL (linija 33-66)
    const query = searchDto.query || '';
    const pageNumber = searchDto.pageNumber || 0;
    const offset = pageNumber * limit;
    const searchQuery = `%${query}%`;

    const categories = await this.legacyDb.$queryRawUnsafe<any[]>(
      `SELECT st.id, st.name as category_id
       FROM vodovod_note_categories st
       WHERE (st.name LIKE ? OR st.id LIKE ?)
       ORDER BY st.id
       LIMIT ? OFFSET ?`,
      searchQuery,
      searchQuery,
      limit,
      offset,
    );

    const countResult = await this.legacyDb.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*) as total
       FROM vodovod_note_categories st
       WHERE (st.name LIKE ? OR st.id LIKE ?)`,
      searchQuery,
      searchQuery,
    );

    const totalRows = Number(countResult[0]?.total) || 0;
    const hasMore = offset + limit < totalRows;

    return {
      data: categories.map((cat) => `${Number(cat.id)} | ${cat.category_id}`),
      hasMore,
    };
  }
}
