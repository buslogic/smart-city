import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaLegacyService } from '../prisma-legacy/prisma-legacy.service';
import { CreateNoteCategoryDto } from './dto/create-note-category.dto';
import { UpdateNoteCategoryDto } from './dto/update-note-category.dto';
import { SearchCategoryDto } from './dto/search-category.dto';

@Injectable()
export class NoteCategoriesService {
  constructor(private legacyDb: PrismaLegacyService) {}

  async findAll() {
    // IDENTIČAN UPIT kao u PHP NoteCategoriesModel::getAll (linija 9-21)
    const categories = await this.legacyDb.$queryRawUnsafe<any[]>(`
      SELECT * FROM vodovod_note_categories ORDER BY id DESC
    `);

    return categories.map((cat) => ({
      id: Number(cat.id),
      name: cat.name,
    }));
  }

  async findOne(id: number) {
    // IDENTIČAN UPIT kao u PHP NoteCategoriesModel::getRowById (linija 39-49)
    const categories = await this.legacyDb.$queryRawUnsafe<any[]>(
      `SELECT * FROM vodovod_note_categories WHERE id = ?`,
      id,
    );

    if (!categories || categories.length === 0) {
      throw new NotFoundException(`Kategorija sa ID ${id} nije pronađena`);
    }

    const cat = categories[0];
    return {
      id: Number(cat.id),
      name: cat.name,
    };
  }

  async create(createDto: CreateNoteCategoryDto) {
    // IDENTIČNA LOGIKA kao u PHP NoteCategoriesModel::addRow (linija 23-37)
    await this.legacyDb.$executeRawUnsafe(
      `INSERT INTO vodovod_note_categories (name) VALUES (?)`,
      createDto.name,
    );

    const lastIdResult = await this.legacyDb.$queryRawUnsafe<any[]>('SELECT LAST_INSERT_ID() as id');
    const insertedId = Number(lastIdResult[0]?.id);

    return this.findOne(insertedId);
  }

  async update(id: number, updateDto: UpdateNoteCategoryDto) {
    await this.findOne(id);

    // IDENTIČNA LOGIKA kao u PHP NoteCategoriesModel::editRow (linija 51-64)
    await this.legacyDb.$executeRawUnsafe(
      `UPDATE vodovod_note_categories SET name = ? WHERE id = ?`,
      updateDto.name,
      id,
    );

    return this.findOne(id);
  }

  async remove(id: number) {
    await this.findOne(id);

    // IDENTIČNA LOGIKA kao u PHP NoteCategoriesModel::deleteRow (linija 66-74)
    // Hard delete (ne soft delete)
    await this.legacyDb.$executeRawUnsafe(
      `DELETE FROM vodovod_note_categories WHERE id = ?`,
      id,
    );

    return { success: true, message: 'Kategorija uspešno obrisana' };
  }

  async searchCategories(searchDto: SearchCategoryDto, limit: number = 10) {
    // IDENTIČNA LOGIKA kao u PHP NoteCategoriesModel::getCategoriesForSL (linija 76-109)
    const query = searchDto.query || '';
    const pageNumber = searchDto.pageNumber || 0;
    const offset = pageNumber * limit;
    const searchQuery = `%${query}%`;

    const categories = await this.legacyDb.$queryRawUnsafe<any[]>(
      `SELECT nc.id, TRIM(nc.name) AS name
       FROM vodovod_note_categories nc
       WHERE (nc.name LIKE ? OR nc.id LIKE ?)
       ORDER BY nc.id
       LIMIT ? OFFSET ?`,
      searchQuery,
      searchQuery,
      limit,
      offset,
    );

    const countResult = await this.legacyDb.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*) as total
       FROM vodovod_note_categories nc
       WHERE (nc.name LIKE ? OR nc.id LIKE ?)`,
      searchQuery,
      searchQuery,
    );

    const totalRows = Number(countResult[0]?.total) || 0;
    const hasMore = offset + limit < totalRows;

    return {
      data: categories.map((cat) => `${Number(cat.id)} | ${cat.name}`),
      hasMore,
    };
  }
}
