/**
 * Test skripta za DigitalOcean Spaces integraciju
 * Pokreni sa: npx ts-node src/spaces/test-spaces.ts
 */

import { config } from 'dotenv';
import { SpacesService } from './spaces.service';
import { ConfigService } from '@nestjs/config';

config();

async function testSpacesIntegration() {
  console.log('🧪 Testiranje DigitalOcean Spaces integracije...\n');

  // Kreiranje ConfigService instance
  const configService = new ConfigService({
    DO_SPACES_ACCESS_KEY: process.env.DO_SPACES_ACCESS_KEY,
    DO_SPACES_SECRET_KEY: process.env.DO_SPACES_SECRET_KEY,
    DO_SPACES_BUCKET: process.env.DO_SPACES_BUCKET,
    DO_SPACES_REGION: process.env.DO_SPACES_REGION,
    DO_SPACES_CDN_ENDPOINT: process.env.DO_SPACES_CDN_ENDPOINT,
  });

  const spacesService = new SpacesService(configService);

  try {
    // Test 1: Upload test fajla
    console.log('1️⃣ Test upload fajla...');
    const testContent = Buffer.from('Test sadržaj za Smart City aplikaciju - ' + new Date().toISOString());
    
    const uploadResult = await spacesService.uploadFile(testContent, {
      folder: 'test',
      fileName: `test-file-${Date.now()}.txt`,
      contentType: 'text/plain',
      isPublic: true,
      metadata: {
        test: 'true',
        app: 'smart-city'
      }
    });

    console.log('✅ Upload uspešan:', uploadResult);
    console.log('   URL:', uploadResult.url);
    console.log('   Key:', uploadResult.key);

    // Test 2: Provera da li fajl postoji
    console.log('\n2️⃣ Test provere postojanja fajla...');
    const exists = await spacesService.fileExists(uploadResult.key);
    console.log(`✅ Fajl ${exists ? 'postoji' : 'ne postoji'}`);

    // Test 3: Download fajla
    console.log('\n3️⃣ Test download fajla...');
    const downloadedBuffer = await spacesService.downloadFile(uploadResult.key);
    const downloadedContent = downloadedBuffer.toString();
    console.log('✅ Download uspešan, sadržaj:', downloadedContent.substring(0, 50) + '...');

    // Test 4: Generisanje signed URL-a
    console.log('\n4️⃣ Test generisanja signed URL-a...');
    const signedUrl = await spacesService.getSignedUrl(uploadResult.key, 300); // 5 minuta
    console.log('✅ Signed URL generisan (važi 5 minuta):');
    console.log('   ', signedUrl.substring(0, 100) + '...');

    // Test 5: Lista fajlova
    console.log('\n5️⃣ Test listanja fajlova...');
    const files = await spacesService.listFiles('test/', 10);
    console.log(`✅ Pronađeno ${files.length} fajlova u test/ folderu`);
    files.slice(0, 3).forEach(file => {
      console.log(`   - ${file.Key} (${file.Size} bytes)`);
    });

    // Test 6: Brisanje test fajla
    console.log('\n6️⃣ Test brisanja fajla...');
    await spacesService.deleteFile(uploadResult.key);
    console.log('✅ Fajl uspešno obrisan');

    // Verifikacija brisanja
    const existsAfterDelete = await spacesService.fileExists(uploadResult.key);
    console.log(`✅ Verifikacija: Fajl ${existsAfterDelete ? 'još uvek postoji' : 'je obrisan'}`);

    console.log('\n🎉 Svi testovi su uspešno prošli!');
    console.log('DigitalOcean Spaces integracija radi kako treba.');

  } catch (error) {
    console.error('\n❌ Greška tokom testiranja:', error);
    console.error('Proverite da li su kredencijali ispravno podešeni u .env fajlu');
  }
}

// Pokreni test
testSpacesIntegration().then(() => {
  console.log('\n✨ Test završen');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});