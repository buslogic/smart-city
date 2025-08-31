const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function fixPasswords() {
  try {
    console.log('🔧 Updating user passwords and emails...');
    
    // Hash password properly
    const correctPassword = await bcrypt.hash('Test123!', 10);
    console.log('New password hash:', correctPassword);

    // Update users with new emails and correct password
    const updates = [
      { oldEmail: 'admin@smartcity.rs', newEmail: 'admin@smart-city.rs' },
      { oldEmail: 'petar.petrovic@smartcity.rs', newEmail: 'petar.petrovic@smart-city.rs' },
      { oldEmail: 'milica.nikolic@smartcity.rs', newEmail: 'milica.nikolic@smart-city.rs' },
      { oldEmail: 'stefan.stojanovic@smartcity.rs', newEmail: 'stefan.stojanovic@smart-city.rs' },
      { oldEmail: 'ana.anic@smartcity.rs', newEmail: 'ana.anic@smart-city.rs' },
    ];

    for (const update of updates) {
      try {
        const result = await prisma.user.update({
          where: { email: update.oldEmail },
          data: { 
            email: update.newEmail,
            password: correctPassword 
          }
        });
        console.log(`✅ Updated: ${update.oldEmail} -> ${update.newEmail}`);
      } catch (error) {
        console.log(`⚠️ User ${update.oldEmail} not found or already updated`);
      }
    }

    // Test admin login
    const admin = await prisma.user.findUnique({
      where: { email: 'admin@smart-city.rs' }
    });

    if (admin) {
      const isValid = await bcrypt.compare('Test123!', admin.password);
      console.log('✅ Admin password test:', isValid);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixPasswords();