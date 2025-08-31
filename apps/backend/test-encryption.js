const crypto = require('crypto');

class TestEncryption {
  constructor() {
    this.algorithm = 'aes-256-cbc';
    this.encryptionKey = this.generateEncryptionKey();
  }

  generateEncryptionKey() {
    const key = process.env.DATABASE_ENCRYPTION_KEY || 'default-key-for-dev-only';
    // Ensure key is exactly 32 bytes for AES-256
    return crypto.scryptSync(key, 'salt', 32);
  }

  encryptPassword(password) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);
    let encrypted = cipher.update(password, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  decryptPassword(encryptedPassword) {
    try {
      const parts = encryptedPassword.split(':');
      if (parts.length !== 2) {
        // If not in expected format, assume it's already plain text (backward compatibility)
        return encryptedPassword;
      }
      
      const iv = Buffer.from(parts[0], 'hex');
      const encryptedText = parts[1];
      const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      // If decryption fails, assume it's already plain text (backward compatibility)
      console.error('Decryption error:', error.message);
      return encryptedPassword;
    }
  }
}

// Test encryption/decryption
const testPassword = 'gspBeograd123!';
console.log('Original password:', testPassword);

const encryptor = new TestEncryption();
const encrypted = encryptor.encryptPassword(testPassword);
console.log('Encrypted password:', encrypted);

const decrypted = encryptor.decryptPassword(encrypted);
console.log('Decrypted password:', decrypted);

console.log('Match:', testPassword === decrypted);
