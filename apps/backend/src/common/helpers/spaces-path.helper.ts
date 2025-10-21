/**
 * Helper za generisanje path-ova u DigitalOcean Spaces sa company code prefiksom
 *
 * Struktura: {COMPANY_CODE}/{category}/{filename}
 * Primer: litas/avatars/user_123.jpg
 *
 * Omogućava multi-tenant file storage gde svaka firma (Litas, Topola, GSP, Beograd)
 * ima svoj izdvojen folder sa podfolderima za različite tipove fajlova.
 */
export class SpacesPathHelper {
  /**
   * Generiše folder path sa company code prefiksom
   *
   * @param companyCode - Kod firme (litas, topola, gsp, beograd)
   * @param category - Kategorija fajla (avatars, company-logos, documents, reports)
   * @returns Path u formatu: companyCode/category
   *
   * @example
   * SpacesPathHelper.getFolderPath('litas', 'avatars')
   * // Returns: 'litas/avatars'
   */
  static getFolderPath(companyCode: string, category: string): string {
    if (!companyCode || !category) {
      throw new Error('Company code and category are required');
    }

    // Normalizuj company code na lowercase
    const normalizedCode = companyCode.toLowerCase().trim();
    const normalizedCategory = category.trim();

    return `${normalizedCode}/${normalizedCategory}`;
  }

  /**
   * Generiše kompletan path za fajl
   *
   * @param companyCode - Kod firme
   * @param category - Kategorija fajla
   * @param filename - Ime fajla
   * @returns Path u formatu: companyCode/category/filename
   *
   * @example
   * SpacesPathHelper.getFilePath('litas', 'avatars', 'user_123.jpg')
   * // Returns: 'litas/avatars/user_123.jpg'
   */
  static getFilePath(
    companyCode: string,
    category: string,
    filename: string,
  ): string {
    if (!companyCode || !category || !filename) {
      throw new Error('Company code, category, and filename are required');
    }

    const folder = this.getFolderPath(companyCode, category);
    const normalizedFilename = filename.trim();

    return `${folder}/${normalizedFilename}`;
  }

  /**
   * Ekstraktuje company code iz postojećeg path-a
   *
   * @param path - Path u formatu: companyCode/category/filename
   * @returns Company code ili null ako path nije validan
   *
   * @example
   * SpacesPathHelper.extractCompanyCode('litas/avatars/user_123.jpg')
   * // Returns: 'litas'
   *
   * SpacesPathHelper.extractCompanyCode('invalid-path')
   * // Returns: 'invalid-path' (prvi segment)
   */
  static extractCompanyCode(path: string): string | null {
    if (!path) {
      return null;
    }

    const parts = path.split('/');
    return parts.length >= 1 ? parts[0] : null;
  }

  /**
   * Proverava da li path pripada određenoj firmi
   *
   * @param path - Path za proveru
   * @param companyCode - Kod firme
   * @returns true ako path pripada firmi
   *
   * @example
   * SpacesPathHelper.belongsToCompany('litas/avatars/user.jpg', 'litas')
   * // Returns: true
   *
   * SpacesPathHelper.belongsToCompany('topola/avatars/user.jpg', 'litas')
   * // Returns: false
   */
  static belongsToCompany(path: string, companyCode: string): boolean {
    if (!path || !companyCode) {
      return false;
    }

    const normalizedCode = companyCode.toLowerCase().trim();
    return path.toLowerCase().startsWith(`${normalizedCode}/`);
  }

  /**
   * Migrira stari path (bez company code-a) na novi format
   *
   * @param oldPath - Stari path (npr. avatars/file.jpg)
   * @param companyCode - Kod firme za novu strukturu
   * @returns Novi path (npr. litas/avatars/file.jpg)
   *
   * @example
   * // Path već ima company code - vrati kao što je
   * SpacesPathHelper.migrateOldPath('litas/avatars/file.jpg', 'litas')
   * // Returns: 'litas/avatars/file.jpg'
   *
   * // Path nema company code - dodaj ga
   * SpacesPathHelper.migrateOldPath('avatars/file.jpg', 'litas')
   * // Returns: 'litas/avatars/file.jpg'
   */
  static migrateOldPath(oldPath: string, companyCode: string): string {
    if (!oldPath || !companyCode) {
      throw new Error('Old path and company code are required');
    }

    // Lista poznatih company code-ova
    const knownCompanies = ['litas', 'topola', 'gsp', 'beograd', 'default'];
    const firstPart = oldPath.split('/')[0].toLowerCase();

    // Ako već ima company code, vrati kao što je
    if (knownCompanies.includes(firstPart)) {
      return oldPath;
    }

    // Dodaj company code prefix
    const normalizedCode = companyCode.toLowerCase().trim();
    return `${normalizedCode}/${oldPath}`;
  }

  /**
   * Ekstraktuje kategoriju iz path-a
   *
   * @param path - Path u formatu: companyCode/category/filename
   * @returns Kategorija ili null ako path nije validan
   *
   * @example
   * SpacesPathHelper.extractCategory('litas/avatars/user_123.jpg')
   * // Returns: 'avatars'
   */
  static extractCategory(path: string): string | null {
    if (!path) {
      return null;
    }

    const parts = path.split('/');
    return parts.length >= 2 ? parts[1] : null;
  }

  /**
   * Ekstraktuje filename iz path-a
   *
   * @param path - Path u formatu: companyCode/category/filename
   * @returns Filename ili null ako path nije validan
   *
   * @example
   * SpacesPathHelper.extractFilename('litas/avatars/user_123.jpg')
   * // Returns: 'user_123.jpg'
   */
  static extractFilename(path: string): string | null {
    if (!path) {
      return null;
    }

    const parts = path.split('/');
    return parts.length >= 3 ? parts[parts.length - 1] : null;
  }

  /**
   * Validira da li je path u ispravnom formatu
   *
   * @param path - Path za validaciju
   * @returns true ako je path validan (companyCode/category/filename format)
   *
   * @example
   * SpacesPathHelper.isValidPath('litas/avatars/user.jpg')
   * // Returns: true
   *
   * SpacesPathHelper.isValidPath('invalid')
   * // Returns: false
   */
  static isValidPath(path: string): boolean {
    if (!path) {
      return false;
    }

    const parts = path.split('/');
    // Validan path ima bar 2 dela (company/category ili company/category/filename)
    return parts.length >= 2 && parts.every((part) => part.trim().length > 0);
  }
}
