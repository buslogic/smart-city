const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

async function testDatabase() {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      port: 3325,
      user: 'smartcity_user',
      password: 'SecurePassword123!',
      database: 'smartcity_dev'
    });

    console.log('✅ Database connection successful');

    // Test if users exist
    const [users] = await connection.execute('SELECT id, email, firstName, lastName, password, isActive FROM users WHERE email = ?', ['admin@smartcity.rs']);
    
    if (users.length === 0) {
      console.log('❌ No admin user found');
      return;
    }

    const user = users[0];
    console.log('✅ User found:', {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isActive: user.isActive
    });

    // Test password
    const isPasswordValid = await bcrypt.compare('Test123!', user.password);
    console.log('Password valid:', isPasswordValid);

    // Test roles
    const [roles] = await connection.execute(`
      SELECT r.name 
      FROM user_roles ur 
      JOIN roles r ON ur.roleId = r.id 
      WHERE ur.userId = ?
    `, [user.id]);

    console.log('User roles:', roles.map(r => r.name));

    await connection.end();
  } catch (error) {
    console.error('Database error:', error);
  }
}

testDatabase();