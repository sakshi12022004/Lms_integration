const crypto = require('crypto');

// Helper function to get database from request context or fallback to master
function getDatabaseFromRequest(req) {
  return req.tenant?.database || require('../config/database-switch');
}


// OTP Service for password reset
class OTPService {
  constructor() {
    this.otpExpiry = 60 * 1000; // 1 minute in milliseconds
    this.maxAttempts = 5;
    this.resendCooldown = 60 * 1000; // 1 minute cooldown
  }

  // Generate secure 6-digit OTP
  generateOTP() {
    return crypto.randomInt(100000, 999999).toString();
  }

  // Store OTP in database
  async storeOTP(req, email, otp) {
    return new Promise((resolve, reject) => {
      const expiresAt = new Date(Date.now() + this.otpExpiry).toISOString();
      
      // Delete any existing OTP for this email first
      getDatabaseFromRequest(req).run(
        'DELETE FROM otp_reset WHERE email = ?',
        [email],
        (err) => {
          if (err) {
            return reject(err);
          }

          // Insert new OTP
          getDatabaseFromRequest(req).run(
            'INSERT INTO otp_reset (email, otp, expires_at, attempts, created_at) VALUES (?, ?, ?, ?, ?)',
            [email, otp, expiresAt, 0, new Date().toISOString()],
            function(err) {
              if (err) {
                return reject(err);
              }
              resolve({ success: true, otpId: this.lastID });
            }
          );
        }
      );
    });
  }

  // Verify OTP
  async verifyOTP(req, email, otp) {
    return new Promise((resolve, reject) => {
      getDatabaseFromRequest(req).get(
        'SELECT * FROM otp_reset WHERE email = ? AND otp = ? AND expires_at > datetime("now")',
        [email, otp],
        (err, row) => {
          if (err) {
            return reject(err);
          }

          if (!row) {
            return resolve({ valid: false, reason: 'invalid_or_expired' });
          }

          // Check attempts
          if (row.attempts >= this.maxAttempts) {
            return resolve({ valid: false, reason: 'max_attempts' });
          }

          // Increment attempts
          getDatabaseFromRequest(req).run(
            'UPDATE otp_reset SET attempts = attempts + 1 WHERE id = ?',
            [row.id],
            (err) => {
              if (err) {
                return reject(err);
              }

              // Mark as verified
              getDatabaseFromRequest(req).run(
                'UPDATE otp_reset SET verified = 1 WHERE id = ?',
                [row.id],
                (err) => {
                  if (err) {
                    return reject(err);
                  }

                  resolve({ valid: true, reason: 'success' });
                }
              );
            }
          );
        }
      );
    });
  }

  // Check if email can request new OTP (cooldown)
  async canRequestOTP(req, email) {
    return new Promise((resolve, reject) => {
      getDatabaseFromRequest(req).get(
        'SELECT created_at FROM otp_reset WHERE email = ? ORDER BY created_at DESC LIMIT 1',
        [email],
        (err, row) => {
          if (err) {
            return reject(err);
          }

          if (!row) {
            return resolve({ canRequest: true, cooldownRemaining: 0 });
          }

          const lastRequestTime = new Date(row.created_at).getTime();
          const currentTime = Date.now();
          const timePassed = currentTime - lastRequestTime;

          if (timePassed < this.resendCooldown) {
            const cooldownRemaining = Math.ceil((this.resendCooldown - timePassed) / 1000);
            return resolve({ canRequest: false, cooldownRemaining });
          }

          resolve({ canRequest: true, cooldownRemaining: 0 });
        }
      );
    });
  }

  // Check if OTP is verified for password reset
  async isOTPVerified(req, email) {
    return new Promise((resolve, reject) => {
      getDatabaseFromRequest(req).get(
        'SELECT verified FROM otp_reset WHERE email = ? AND verified = 1 AND expires_at > datetime("now")',
        [email],
        (err, row) => {
          if (err) {
            return reject(err);
          }

          resolve({ verified: !!row });
        }
      );
    });
  }

  // Cleanup expired OTPs
  async cleanupExpiredOTPs(req) {
    return new Promise((resolve, reject) => {
      getDatabaseFromRequest(req).run(
        'DELETE FROM otp_reset WHERE expires_at <= datetime("now")',
        [],
        function(err) {
          if (err) {
            return reject(err);
          }
          resolve({ deleted: this.changes });
        }
      );
    });
  }

  // Clear OTP after successful password reset
  async clearOTP(req, email) {
    return new Promise((resolve, reject) => {
      getDatabaseFromRequest(req).run(
        'DELETE FROM otp_reset WHERE email = ?',
        [email],
        function(err) {
          if (err) {
            return reject(err);
          }
          resolve({ deleted: this.changes });
        }
      );
    });
  }
}

module.exports = new OTPService();
