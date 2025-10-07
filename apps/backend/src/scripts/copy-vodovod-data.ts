import { PrismaClient } from '@prisma/client';
import { createConnection } from 'mysql2/promise';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

// Decrypt password function (copied from legacy-databases.service.ts)
function decryptPassword(encryptedPassword: string): string {
  try {
    const encryptionKey = crypto.scryptSync(
      process.env.DATABASE_ENCRYPTION_KEY || 'default-key-for-dev-only',
      'salt',
      32,
    );
    const algorithm = 'aes-256-cbc';

    const parts = encryptedPassword.split(':');
    if (parts.length !== 2) {
      return encryptedPassword;
    }

    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];
    const decipher = crypto.createDecipheriv(algorithm, encryptionKey, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    return encryptedPassword;
  }
}

async function main() {
  console.log('🚀 Započinjem kopiranje vodovod podataka...\n');

  // Get legacy database config
  const legacyDb = await prisma.legacyDatabase.findFirst({
    where: { name: 'Ticketing Original MySQL' },
  });

  if (!legacyDb) {
    throw new Error('Legacy database nije pronađena!');
  }

  const password = decryptPassword(legacyDb.password);

  console.log(`📡 Konektujem na ${legacyDb.host}:${legacyDb.port}/${legacyDb.database}`);

  const connection = await createConnection({
    host: legacyDb.host,
    port: legacyDb.port,
    user: legacyDb.username,
    password: password,
    database: legacyDb.database,
  });

  console.log('✅ Konekcija uspešna!\n');

  try {
    // 1. Copy Water Meter Types
    console.log('📦 1/6 Kopiram vodovod_water_meter_type...');
    const [types] = await connection.execute('SELECT * FROM vodovod_water_meter_type');
    let typeCount = 0;
    for (const type of types as any[]) {
      await prisma.waterMeterType.upsert({
        where: { id: type.id },
        update: { type: type.type },
        create: {
          id: type.id,
          type: type.type,
        },
      });
      typeCount++;
    }
    console.log(`   ✓ ${typeCount} tipova kopirano\n`);

    // 2. Copy Water Meter Availability
    console.log('📦 2/6 Kopiram vodovod_water_meter_availability...');
    const [availabilities] = await connection.execute('SELECT * FROM vodovod_water_meter_availability');
    let availCount = 0;
    for (const avail of availabilities as any[]) {
      await prisma.waterMeterAvailability.upsert({
        where: { id: avail.id },
        update: { availability: avail.availability },
        create: {
          id: avail.id,
          availability: avail.availability,
        },
      });
      availCount++;
    }
    console.log(`   ✓ ${availCount} dostupnosti kopirano\n`);

    // 3. Copy Water Meter Manufacturers
    console.log('📦 3/6 Kopiram vodovod_water_meter_manufacturer...');
    const [manufacturers] = await connection.execute('SELECT * FROM vodovod_water_meter_manufacturer');
    let manuCount = 0;
    for (const manu of manufacturers as any[]) {
      await prisma.waterMeterManufacturer.upsert({
        where: { id: manu.id },
        update: { manufacturer: manu.manufacturer },
        create: {
          id: manu.id,
          manufacturer: manu.manufacturer,
        },
      });
      manuCount++;
    }
    console.log(`   ✓ ${manuCount} proizvođača kopirano\n`);

    // 4. Copy Water Meters (LARGE TABLE - batch processing)
    console.log('📦 4/6 Kopiram vodovod_water_meter...');
    const [totalCount] = await connection.execute('SELECT COUNT(*) as cnt FROM vodovod_water_meter');
    const total = (totalCount as any[])[0].cnt;
    console.log(`   📊 Ukupno ${total} vodomera za kopiranje`);

    const batchSize = 1000;
    let offset = 0;
    let wmCount = 0;

    while (offset < total) {
      const [meters] = await connection.execute(
        `SELECT * FROM vodovod_water_meter LIMIT ${batchSize} OFFSET ${offset}`,
      );

      for (const meter of meters as any[]) {
        await prisma.waterMeter.upsert({
          where: { id: meter.id },
          update: {
            counter: meter.counter,
            idv: meter.idv,
            availabilityId: meter.availability_id,
            typeId: meter.type_id,
            manufacturerId: meter.manufacturer_id,
            serialNumber: meter.serial_number,
            calibratedFrom: meter.calibrated_from,
            calibratedTo: meter.calibrated_to,
            module: meter.module,
            disconnectionDate: meter.disconnection_date,
            idmm: meter.idmm,
            sifraPotrosaca: meter.sifra_potrosaca,
            sifraKupca: meter.sifra_kupca,
            aktivan: meter.aktivan === 1,
          },
          create: {
            id: meter.id,
            counter: meter.counter,
            idv: meter.idv,
            availabilityId: meter.availability_id,
            typeId: meter.type_id,
            manufacturerId: meter.manufacturer_id,
            serialNumber: meter.serial_number,
            calibratedFrom: meter.calibrated_from,
            calibratedTo: meter.calibrated_to,
            module: meter.module,
            disconnectionDate: meter.disconnection_date,
            idmm: meter.idmm,
            sifraPotrosaca: meter.sifra_potrosaca,
            sifraKupca: meter.sifra_kupca,
            aktivan: meter.aktivan === 1,
          },
        });
        wmCount++;
      }

      offset += batchSize;
      const progress = Math.min(100, Math.round((offset / total) * 100));
      console.log(`   ⏳ Progress: ${progress}% (${wmCount}/${total})`);
    }
    console.log(`   ✓ ${wmCount} vodomera kopirano\n`);

    // 5. Copy Replaced Water Meters
    console.log('📦 5/6 Kopiram vodovod_replaced_water_meter...');
    const [replaced] = await connection.execute('SELECT * FROM vodovod_replaced_water_meter');
    let replCount = 0;
    for (const repl of replaced as any[]) {
      await prisma.replacedWaterMeter.upsert({
        where: { id: repl.id },
        update: {
          counter: repl.counter,
          idv: repl.idv,
          availability: repl.availability,
          type: repl.type,
          manufacturer: repl.manufacturer,
          serialNumber: repl.serial_number,
          calibratedFrom: repl.calibrated_from,
          calibratedTo: repl.calibrated_to,
          module: repl.module,
          disconnectionDate: repl.disconnection_date,
          idmm: repl.idmm,
          sifraPotrosaca: repl.sifra_potrosaca,
          sifraKupca: repl.sifra_kupca,
          aktivan: repl.aktivan === 1,
          replacedId: repl.replaced_id,
        },
        create: {
          id: repl.id,
          counter: repl.counter,
          idv: repl.idv,
          availability: repl.availability,
          type: repl.type,
          manufacturer: repl.manufacturer,
          serialNumber: repl.serial_number,
          calibratedFrom: repl.calibrated_from,
          calibratedTo: repl.calibrated_to,
          module: repl.module,
          disconnectionDate: repl.disconnection_date,
          idmm: repl.idmm,
          sifraPotrosaca: repl.sifra_potrosaca,
          sifraKupca: repl.sifra_kupca,
          aktivan: repl.aktivan === 1,
          replacedId: repl.replaced_id,
        },
      });
      replCount++;
    }
    console.log(`   ✓ ${replCount} zamenjenih vodomera kopirano\n`);

    // 6. Copy Water Meter Readings
    console.log('📦 6/6 Kopiram vodovod_water_meter_readings...');
    const [readingsCount] = await connection.execute('SELECT COUNT(*) as cnt FROM vodovod_water_meter_readings');
    const totalReadings = (readingsCount as any[])[0].cnt;
    console.log(`   📊 Ukupno ${totalReadings} očitavanja za kopiranje`);

    offset = 0;
    let readCount = 0;

    while (offset < totalReadings) {
      const [readings] = await connection.execute(
        `SELECT * FROM vodovod_water_meter_readings LIMIT ${batchSize} OFFSET ${offset}`,
      );

      for (const reading of readings as any[]) {
        await prisma.waterMeterReading.upsert({
          where: { id: reading.id },
          update: {
            meterReading: reading.meter_reading,
            faulty: reading.faulty === 1,
            unreadable: reading.unreadable === 1,
            notFoundOnSite: reading.not_found_on_site === 1,
            noMeter: reading.no_meter === 1,
            negativeConsumption: reading.negative_consumption === 1,
            transferToNextCl: reading.transfer_to_next_cl === 1,
            billPrintout: reading.bill_printout === 1,
            note: reading.note,
            userAccount: reading.user_account,
            canceled: reading.canceled === 1,
            priority: reading.priority === 1,
            average: reading.average === 1,
            meterReaderOnly: reading.meter_reader_only === 1,
            disconnected: reading.disconnected === 1,
            censusSelect: reading.census_select === 1,
            zsPrintout: reading.zs_printout === 1,
          },
          create: {
            id: reading.id,
            meterReading: reading.meter_reading,
            faulty: reading.faulty === 1,
            unreadable: reading.unreadable === 1,
            notFoundOnSite: reading.not_found_on_site === 1,
            noMeter: reading.no_meter === 1,
            negativeConsumption: reading.negative_consumption === 1,
            transferToNextCl: reading.transfer_to_next_cl === 1,
            billPrintout: reading.bill_printout === 1,
            note: reading.note,
            userAccount: reading.user_account,
            canceled: reading.canceled === 1,
            priority: reading.priority === 1,
            average: reading.average === 1,
            meterReaderOnly: reading.meter_reader_only === 1,
            disconnected: reading.disconnected === 1,
            censusSelect: reading.census_select === 1,
            zsPrintout: reading.zs_printout === 1,
          },
        });
        readCount++;
      }

      offset += batchSize;
      const progress = Math.min(100, Math.round((offset / totalReadings) * 100));
      console.log(`   ⏳ Progress: ${progress}% (${readCount}/${totalReadings})`);
    }
    console.log(`   ✓ ${readCount} očitavanja kopirano\n`);

    console.log('🎉 Svi vodovod podaci su uspešno kopirani!');
  } finally {
    await connection.end();
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error('❌ Greška:', e);
    process.exit(1);
  });
