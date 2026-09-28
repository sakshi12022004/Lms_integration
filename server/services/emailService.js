// Email Service for OTP
const nodemailer = require('nodemailer');
require('dotenv').config(); // Load environment variables

class EmailService {
  constructor() {
    this.transporter = null;
    this.isInitialized = false;
    this.config = this.loadEmailConfig();
    this.initializeTransporter();
  }

  // Load email configuration from environment variables
  loadEmailConfig() {
    try {
      const config = {
        EMAIL_SERVICE: process.env.EMAIL_SERVICE || 'gmail',
        EMAIL_USER: process.env.EMAIL_USER,
        EMAIL_PASS: process.env.EMAIL_PASS,
        EMAIL_FROM: process.env.EMAIL_FROM || 'Core5 Academy <support@core5.co.in>'
      };
      
      console.log('✅ Email configuration loaded from environment variables');
      return config;
    } catch (error) {
      console.log('❌ Error loading email config:', error.message);
      return this.getFallbackConfig();
    }
  }

  // Get fallback configuration
  getFallbackConfig() {
    return {
      EMAIL_SERVICE: 'gmail',
      EMAIL_USER: 'noreply@core5academy.com',
      EMAIL_PASS: 'fallback-password',
      EMAIL_FROM: 'Core5 Academy <support@core5.co.in>'
    };
  }

  // Initialize email transporter
  async initializeTransporter() {
    try {
      // Check if we have real email credentials
      if (this.config.EMAIL_USER && this.config.EMAIL_PASS && 
          this.config.EMAIL_USER !== 'noreply@core5academy.com' &&
          this.config.EMAIL_PASS !== 'fallback-password') {
        
        let transporterConfig;
        
        // Configure based on email service
        if (this.config.EMAIL_SERVICE === 'zoho') {
          // Try multiple Zoho Mail SMTP configurations
          const zohoConfigs = [
            {
              // Zoho with SSL (port 465)
              host: 'smtp.zoho.com',
              port: 465,
              secure: true,
              auth: {
                user: this.config.EMAIL_USER,
                pass: this.config.EMAIL_PASS
              }
            },
            {
              // Zoho with TLS (port 587)
              host: 'smtp.zoho.com',
              port: 587,
              secure: false,
              requireTLS: true,
              auth: {
                user: this.config.EMAIL_USER,
                pass: this.config.EMAIL_PASS
              }
            },
            {
              // Zoho alternative configuration
              host: 'smtp.zoho.in',
              port: 465,
              secure: true,
              auth: {
                user: this.config.EMAIL_USER,
                pass: this.config.EMAIL_PASS
              }
            }
          ];

          // Try each configuration
          for (let i = 0; i < zohoConfigs.length; i++) {
            try {
              console.log(`🔄 Trying Zoho config ${i + 1}: ${zohoConfigs[i].host}:${zohoConfigs[i].port}`);
              this.transporter = nodemailer.createTransport(zohoConfigs[i]);
              await this.transporter.verify();
              console.log(`✅ Zoho config ${i + 1} successful!`);
              transporterConfig = zohoConfigs[i];
              break;
            } catch (error) {
              console.log(`❌ Zoho config ${i + 1} failed:`, error.message);
              if (i === zohoConfigs.length - 1) {
                throw error; // Re-throw if all configs fail
              }
            }
          }
        } else if (this.config.EMAIL_SERVICE === 'gmail') {
          // Gmail SMTP configuration
          transporterConfig = {
            service: 'gmail',
            auth: {
              user: this.config.EMAIL_USER,
              pass: this.config.EMAIL_PASS
            }
          };
        } else {
          // Default/other service
          transporterConfig = {
            service: this.config.EMAIL_SERVICE || 'gmail',
            auth: {
              user: this.config.EMAIL_USER,
              pass: this.config.EMAIL_PASS
            }
          };
        }

        // Create transporter with successful config (if not already created)
        if (this.config.EMAIL_SERVICE !== 'zoho' || !this.transporter) {
          this.transporter = nodemailer.createTransport(transporterConfig);
        }

        // Test the connection
        await this.transporter.verify();
        this.isInitialized = true;
        
        console.log(`✅ Real email service initialized with ${this.config.EMAIL_SERVICE.toUpperCase()} SMTP`);
        console.log(`📧 Sending from: ${this.config.EMAIL_USER}`);
        console.log('🔒 Credentials loaded from secure .env file');
        
      } else {
        // Fallback to Ethereal for development
        console.log('⚠️  No email credentials found in .env, using test service');
        const account = await nodemailer.createTestAccount();
        
        this.transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: account.user,
            pass: account.pass
          }
        });

        this.isInitialized = true;
        console.log('✅ Fallback email service initialized with Ethereal');
        console.log(`📧 Test email URL: https://ethereal.email/messages`);
      }
      
    } catch (error) {
      console.log('❌ Email service initialization failed:', error.message);
      console.log('🔄 Falling back to mock service');
      this.isInitialized = false;
    }
  }

  // Send OTP email
  async sendOTPEmail(email, otp) {
    try {
      // Wait for initialization if not ready
      if (!this.isInitialized && this.transporter === null) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds for init
      }

      // If transporter is still not available, fallback to mock
      if (!this.transporter) {
        return this.sendMockOTPEmail(email, otp);
      }

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8f9fa;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 20px;">
            <h1 style="color: white; margin: 0; font-size: 32px; font-weight: bold;">Core5 Academy</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0; font-size: 16px;">Password Reset OTP</p>
          </div>
          
          <div style="background: white; padding: 30px; border-radius: 10px; margin: 20px 0; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h2 style="color: #333; text-align: center; margin-bottom: 20px; font-size: 24px;">Your OTP Code</h2>
            <div style="background: #f8f9fa; padding: 25px; border-radius: 8px; text-align: center; border: 2px dashed #667eea; margin: 20px 0;">
              <span style="font-size: 42px; font-weight: bold; color: #667eea; letter-spacing: 8px; font-family: monospace;">${otp}</span>
            </div>
            <p style="color: #666; text-align: center; margin-top: 20px; font-size: 16px;">
              This OTP will expire in <strong style="color: #e74c3c;">1 minute</strong>
            </p>
            <p style="color: #999; text-align: center; margin-top: 10px; font-size: 14px;">
              Requested at: ${new Date().toLocaleString()}
            </p>
          </div>
          
          <div style="background: #fff3cd; padding: 20px; border-radius: 10px; border-left: 4px solid #ffc107; margin: 20px 0;">
            <p style="color: #856404; margin: 0; font-size: 14px; line-height: 1.5;">
              <strong>🔒 Security Notice:</strong> Never share this OTP with anyone. Our team will never ask for your OTP via phone or email. This code can only be used once.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
            <p style="color: #999; margin: 0; font-size: 12px;">
              This is an automated message from Core5 Academy LMS System.<br>
              If you didn't request this password reset, please ignore this email.
            </p>
            <p style="color: #999; margin: 10px 0 0; font-size: 11px;">
              © 2024 Core5 Academy. All rights reserved.
            </p>
          </div>
        </div>
      `;

      const mailOptions = {
        from: this.config.EMAIL_FROM || '"Core5 Academy" <support@core5.co.in>',
        to: email,
        subject: '🔐 Password Reset OTP - Core5 Academy',
        html: htmlContent
      };

      const info = await this.transporter.sendMail(mailOptions);
      
      console.log('📧 ===== OTP EMAIL SENT =====');
      console.log(`📬 To: ${email}`);
      console.log(`📋 Message ID: ${info.messageId}`);
      
      // Show different info based on email service
      if (this.config.EMAIL_USER && this.config.EMAIL_USER !== 'noreply@core5academy.com') {
        console.log(`✅ Real email sent via secure ${this.config.EMAIL_SERVICE.toUpperCase()} SMTP`);
        console.log('📱 Check your email inbox for the OTP');
        console.log('🔒 Credentials loaded from secure .env file');
      } else {
        console.log(`🔗 Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
        console.log('⚠️  This is a test email service');
      }
      
      console.log(`🔢 OTP: ${otp}`);
      console.log('========================');

      return {
        success: true,
        message: 'OTP sent successfully',
        messageId: info.messageId,
        previewUrl: this.config.EMAIL_USER !== 'noreply@core5academy.com' ? null : nodemailer.getTestMessageUrl(info),
        emailService: this.config.EMAIL_USER !== 'noreply@core5academy.com' ? this.config.EMAIL_SERVICE : 'test-ethereal',
        // In development, also return the OTP for testing
        developmentOTP: otp
      };

    } catch (error) {
      console.error('❌ Error sending email:', error);
      // Fallback to mock service
      return this.sendMockOTPEmail(email, otp);
    }
  }

  // Mock email service (fallback)
  async sendMockOTPEmail(email, otp) {
    try {
      console.log('📧 ===== MOCK OTP EMAIL SENT =====');
      console.log(`📬 To: ${email}`);
      console.log(`📋 Subject: Password Reset OTP`);
      console.log(`📝 Message: Your OTP code is: ${otp}`);
      console.log(`⏰ This OTP will expire in 1 minute.`);
      console.log('==================================');

      // Mock email sending delay
      await new Promise(resolve => setTimeout(resolve, 100));

      return {
        success: true,
        message: 'OTP sent successfully (mock service)',
        emailService: 'mock',
        // In development, return the OTP for testing
        developmentOTP: otp
      };
    } catch (error) {
      console.error('❌ Error sending mock email:', error);
      return {
        success: false,
        message: 'Failed to send OTP',
        error: error.message
      };
    }
  }
}

module.exports = new EmailService();
