/**
 * HealthFlow Cequens SMS Provider
 * Custom notification provider for Egyptian SMS delivery via Cequens API
 * 
 * API Documentation: https://developer.cequens.com/reference/sending-sms
 */

const axios = require('axios');

class CequensSMSProvider {
  constructor(config) {
    this.baseUrl = config.apiUrl || 'https://apis.cequens.com/sms/v1';
    this.authUrl = config.authUrl || 'https://developer.cequens.com/oauth/token';
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.username = config.username;
    this.password = config.password;
    this.senderId = config.senderId || 'HealthFlow';
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  /**
   * Authenticate with Cequens OAuth2 API
   */
  async authenticate() {
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const response = await axios.post(this.authUrl, {
        grant_type: 'password',
        username: this.username,
        password: this.password,
        client_id: this.clientId,
        client_secret: this.clientSecret
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      this.accessToken = response.data.access_token;
      // Set expiry 5 minutes before actual expiry for safety
      this.tokenExpiry = Date.now() + ((response.data.expires_in - 300) * 1000);
      
      return this.accessToken;
    } catch (error) {
      console.error('Cequens authentication failed:', error.response?.data || error.message);
      throw new Error('Failed to authenticate with Cequens API');
    }
  }

  /**
   * Format Egyptian phone number to E.164
   */
  formatPhoneNumber(phone) {
    // Remove any spaces, dashes, or special characters
    let cleaned = phone.replace(/[\s\-\(\)]/g, '');
    
    // Handle different Egyptian phone formats
    if (cleaned.startsWith('+20')) {
      return cleaned.substring(1); // Remove + for Cequens
    } else if (cleaned.startsWith('20')) {
      return cleaned;
    } else if (cleaned.startsWith('0')) {
      return '20' + cleaned.substring(1);
    } else if (cleaned.length === 10) {
      return '20' + cleaned;
    }
    
    return cleaned;
  }

  /**
   * Send single SMS message
   */
  async sendSMS(recipient, message, options = {}) {
    const token = await this.authenticate();
    
    const formattedRecipient = this.formatPhoneNumber(recipient);
    
    const payload = {
      senderName: options.senderId || this.senderId,
      messageText: message,
      messageType: options.messageType || 'text',
      recipients: formattedRecipient
    };

    // Add optional parameters
    if (options.scheduledTime) {
      payload.scheduledTime = options.scheduledTime;
    }
    if (options.clientRequestId) {
      payload.clientRequestId = options.clientRequestId;
    }

    try {
      const response = await axios.post(`${this.baseUrl}/messages`, payload, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      return {
        success: response.data.replyCode === 0,
        messageId: response.data.data?.SentSMSIDs?.[0]?.SMSId,
        requestId: response.data.requestId,
        response: response.data
      };
    } catch (error) {
      console.error('Cequens SMS send failed:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.replyMessage || error.message
      };
    }
  }

  /**
   * Send bulk SMS messages
   */
  async sendBulkSMS(recipients, message, options = {}) {
    const token = await this.authenticate();
    
    const formattedRecipients = recipients
      .map(r => this.formatPhoneNumber(r))
      .join(',');
    
    const payload = {
      senderName: options.senderId || this.senderId,
      messageText: message,
      messageType: options.messageType || 'text',
      recipients: formattedRecipients
    };

    try {
      const response = await axios.post(`${this.baseUrl}/messages`, payload, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      return {
        success: response.data.replyCode === 0,
        sentCount: response.data.data?.SentSMSIDs?.length || 0,
        invalidRecipients: response.data.data?.InvalidRecipients,
        requestId: response.data.requestId,
        response: response.data
      };
    } catch (error) {
      console.error('Cequens bulk SMS send failed:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.replyMessage || error.message
      };
    }
  }

  /**
   * Get SMS delivery status
   */
  async getMessageStatus(messageId) {
    const token = await this.authenticate();
    
    try {
      const response = await axios.get(`${this.baseUrl}/messages/${messageId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      return {
        success: true,
        status: response.data.data?.status,
        deliveredAt: response.data.data?.deliveredAt,
        response: response.data
      };
    } catch (error) {
      console.error('Cequens status check failed:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.replyMessage || error.message
      };
    }
  }

  /**
   * Get account balance
   */
  async getBalance() {
    const token = await this.authenticate();
    
    try {
      const response = await axios.get(`${this.baseUrl}/account/balance`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      return {
        success: true,
        balance: response.data.data?.balance,
        currency: response.data.data?.currency,
        response: response.data
      };
    } catch (error) {
      console.error('Cequens balance check failed:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.replyMessage || error.message
      };
    }
  }
}

// Notification service plugin interface
class CequensNotificationPlugin {
  constructor() {
    this.provider = null;
  }

  initialize(config) {
    this.provider = new CequensSMSProvider({
      clientId: config.CEQUENS_CLIENT_ID || process.env.CEQUENS_CLIENT_ID,
      clientSecret: config.CEQUENS_CLIENT_SECRET || process.env.CEQUENS_CLIENT_SECRET,
      username: config.CEQUENS_USERNAME || process.env.CEQUENS_USERNAME,
      password: config.CEQUENS_PASSWORD || process.env.CEQUENS_PASSWORD,
      senderId: config.CEQUENS_SENDER_ID || process.env.CEQUENS_SENDER_ID || 'HealthFlow',
      apiUrl: config.CEQUENS_API_URL || process.env.CEQUENS_API_URL,
      authUrl: config.CEQUENS_AUTH_URL || process.env.CEQUENS_AUTH_URL
    });
  }

  /**
   * Send notification via SMS
   * Called by Sunbird RC notification service
   */
  async sendNotification(notification) {
    const { recipient, message, templateId, templateData, type } = notification;

    // Only handle SMS type
    if (type !== 'sms' && type !== 'SMS') {
      return { success: false, error: 'Unsupported notification type' };
    }

    // Format message with template data if provided
    let finalMessage = message;
    if (templateId && templateData) {
      finalMessage = this.formatTemplate(templateId, templateData);
    }

    return await this.provider.sendSMS(recipient, finalMessage);
  }

  /**
   * Send OTP via SMS
   * Used for Keycloak OTP integration
   */
  async sendOTP(recipient, otp, options = {}) {
    const message = options.templateAr 
      ? `رمز التحقق الخاص بك من هيلث فلو هو: ${otp}. صالح لمدة ${options.validity || 5} دقائق.`
      : `Your HealthFlow verification code is: ${otp}. Valid for ${options.validity || 5} minutes.`;
    
    return await this.provider.sendSMS(recipient, message, {
      senderId: 'HealthFlow'
    });
  }

  /**
   * Format message template
   */
  formatTemplate(templateId, data) {
    const templates = {
      // Registration notifications
      'registration_success_ar': `مرحباً {{name}}، تم تسجيلك بنجاح في منصة هيلث فلو. رقم التسجيل: {{registrationNumber}}`,
      'registration_success_en': `Welcome {{name}}! You have been successfully registered on HealthFlow. Registration Number: {{registrationNumber}}`,
      
      // License notifications
      'license_approved_ar': `تهانينا {{name}}! تم اعتماد ترخيصك رقم {{licenseNumber}}. صالح حتى {{expiryDate}}.`,
      'license_approved_en': `Congratulations {{name}}! Your license #{{licenseNumber}} has been approved. Valid until {{expiryDate}}.`,
      'license_expiring_ar': `تنبيه: ترخيصك رقم {{licenseNumber}} سينتهي في {{expiryDate}}. يرجى التجديد.`,
      'license_expiring_en': `Alert: Your license #{{licenseNumber}} expires on {{expiryDate}}. Please renew.`,
      
      // Verification notifications
      'verification_pending_ar': `{{name}}، طلب التحقق الخاص بك قيد المراجعة. رقم الطلب: {{requestId}}`,
      'verification_pending_en': `{{name}}, your verification request is under review. Request ID: {{requestId}}`,
      'verification_complete_ar': `تم التحقق من بياناتك بنجاح. رقم الطلب: {{requestId}}`,
      'verification_complete_en': `Your verification is complete. Request ID: {{requestId}}`,
      
      // Credential notifications
      'credential_issued_ar': `تم إصدار شهادتك الرقمية. يمكنك تحميلها من: {{downloadUrl}}`,
      'credential_issued_en': `Your digital credential has been issued. Download it from: {{downloadUrl}}`,
      
      // HCX notifications
      'hcx_claim_submitted_ar': `تم تقديم مطالبتك بنجاح. رقم المطالبة: {{claimId}}`,
      'hcx_claim_submitted_en': `Your claim has been submitted. Claim ID: {{claimId}}`,
      'hcx_preauth_approved_ar': `تمت الموافقة على طلب التفويض المسبق. رقم: {{preauthId}}`,
      'hcx_preauth_approved_en': `Pre-authorization approved. ID: {{preauthId}}`,
      
      // OTP templates
      'otp_ar': `رمز التحقق: {{otp}}. صالح لمدة {{validity}} دقائق.`,
      'otp_en': `Verification code: {{otp}}. Valid for {{validity}} minutes.`
    };

    let template = templates[templateId] || '';
    
    // Replace placeholders with data
    Object.keys(data).forEach(key => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      template = template.replace(regex, data[key]);
    });

    return template;
  }

  /**
   * Bulk notification sending
   */
  async sendBulkNotifications(notifications) {
    const results = [];
    
    for (const notification of notifications) {
      const result = await this.sendNotification(notification);
      results.push({
        recipient: notification.recipient,
        ...result
      });
    }

    return {
      total: notifications.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    };
  }
}

module.exports = { CequensSMSProvider, CequensNotificationPlugin };
