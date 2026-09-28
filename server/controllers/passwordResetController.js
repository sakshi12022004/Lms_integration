const bcrypt = require('bcrypt');
const otpService = require('../services/otpService');
const emailService = require('../services/emailService');

// Helper function to get database from request context or fallback to master
function getDatabaseFromRequest(req) {
  return req.tenant?.database || require('../config/database-switch');
}


// Password Reset Controller
const passwordResetController = {
  // Step 1: Send OTP to email
  sendOTP: async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Email is required'
        });
      }

      // Check if email exists in database
      getDatabaseFromRequest(req).get(
        'SELECT email FROM users WHERE email = ?',
        [email],
        async (err, user) => {
          if (err) {
            return res.status(500).json({
              success: false,
              message: 'Database error'
            });
          }

          if (!user) {
            // Don't reveal if email exists or not for security
            return res.status(200).json({
              success: true,
              message: 'If the email exists, an OTP will be sent'
            });
          }

          // Check cooldown
          const cooldownCheck = await otpService.canRequestOTP(req, email);
          if (!cooldownCheck.canRequest) {
            return res.status(429).json({
              success: false,
              message: `Please wait ${cooldownCheck.cooldownRemaining} seconds before requesting another OTP`,
              cooldownRemaining: cooldownCheck.cooldownRemaining
            });
          }

          // Generate and store OTP
          const otp = otpService.generateOTP();
          await otpService.storeOTP(req, email, otp);

          // Send OTP email
          const emailResult = await emailService.sendOTPEmail(email, otp);

          if (!emailResult.success) {
            return res.status(500).json({
              success: false,
              message: 'Failed to send OTP'
            });
          }

          res.status(200).json({
            success: true,
            message: 'OTP sent to your email',
            // In development, include OTP for testing
            ...(process.env.NODE_ENV !== 'production' && { developmentOTP: otp })
          });
        }
      );
    } catch (error) {
      console.error('Send OTP error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },

  // Step 2: Verify OTP
  verifyOTP: async (req, res) => {
    try {
      const { email, otp } = req.body;

      if (!email || !otp) {
        return res.status(400).json({
          success: false,
          message: 'Email and OTP are required'
        });
      }

      const verification = await otpService.verifyOTP(req, email, otp);

      if (!verification.valid) {
        let message = 'Invalid or expired OTP';
        if (verification.reason === 'max_attempts') {
          message = 'Maximum attempts reached. Please request a new OTP';
        }

        return res.status(400).json({
          success: false,
          message,
          reason: verification.reason
        });
      }

      res.status(200).json({
        success: true,
        message: 'OTP verified successfully'
      });
    } catch (error) {
      console.error('Verify OTP error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },

  // Step 3: Reset password
  resetPassword: async (req, res) => {
    try {
      const { email, newPassword, confirmPassword } = req.body;

      if (!email || !newPassword || !confirmPassword) {
        return res.status(400).json({
          success: false,
          message: 'All fields are required'
        });
      }

      if (newPassword !== confirmPassword) {
        return res.status(400).json({
          success: false,
          message: 'Passwords do not match'
        });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 8 characters long'
        });
      }

      // Check if OTP is verified
      const otpCheck = await otpService.isOTPVerified(req, email);
      if (!otpCheck.verified) {
        return res.status(400).json({
          success: false,
          message: 'OTP verification required'
        });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password in database
      getDatabaseFromRequest(req).run(
        'UPDATE users SET password = ? WHERE email = ?',
        [hashedPassword, email],
        async function(err) {
          if (err) {
            return res.status(500).json({
              success: false,
              message: 'Failed to update password'
            });
          }

          if (this.changes === 0) {
            return res.status(404).json({
              success: false,
              message: 'User not found'
            });
          }

          // Clear OTP after successful password reset
          await otpService.clearOTP(req, email);

          res.status(200).json({
            success: true,
            message: 'Password updated successfully'
          });
        }
      );
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  },

  // Check OTP cooldown status
  checkCooldown: async (req, res) => {
    try {
      const { email } = req.query;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Email is required'
        });
      }

      const cooldownCheck = await otpService.canRequestOTP(req, email);
      
      res.status(200).json({
        success: true,
        canRequest: cooldownCheck.canRequest,
        cooldownRemaining: cooldownCheck.cooldownRemaining
      });
    } catch (error) {
      console.error('Check cooldown error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
};

module.exports = passwordResetController;
