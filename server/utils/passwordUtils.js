const crypto = require('crypto');

/**
 * Generate a random password for vendors
 * @param {number} length - Length of the password (default: 8)
 * @returns {string} Generated password
 */
function generateVendorPassword(length = 8) {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&';
  let password = '';
  
  // Ensure at least one uppercase, one lowercase, one number, and one special character
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%&';
  
  password += uppercase.charAt(Math.floor(Math.random() * uppercase.length));
  password += lowercase.charAt(Math.floor(Math.random() * lowercase.length));
  password += numbers.charAt(Math.floor(Math.random() * numbers.length));
  password += special.charAt(Math.floor(Math.random() * special.length));
  
  // Fill the rest with random characters from the full charset
  for (let i = 4; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  
  // Shuffle the password to avoid predictable patterns
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

/**
 * Hash a password using bcrypt (if available) or a simple hash
 * @param {string} password - Plain text password
 * @returns {string} Hashed password
 */
function hashPassword(password) {
  // For now, use a simple hash. In production, use bcrypt
  return crypto.createHash('sha256').update(password).digest('hex');
}

module.exports = {
  generateVendorPassword,
  hashPassword
};
