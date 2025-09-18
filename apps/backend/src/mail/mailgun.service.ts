import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import FormData from 'form-data';
import Mailgun from 'mailgun.js';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  template?: string;
  variables?: Record<string, any>;
  attachments?: Array<{
    filename: string;
    data: Buffer | string;
    contentType?: string;
  }>;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  tags?: string[];
}

@Injectable()
export class MailgunService {
  private readonly logger = new Logger(MailgunService.name);
  private mailgunClient: any;
  private domain: string;
  private fromEmail: string;
  private fromName: string;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('MAILGUN_API_KEY');

    // Only initialize Mailgun client if API key is provided
    if (apiKey) {
      const mailgun = new Mailgun(FormData);

      this.mailgunClient = mailgun.client({
        username: 'api',
        key: apiKey,
        url:
          this.configService.get<string>('MAILGUN_EU_REGION') === 'true'
            ? 'https://api.eu.mailgun.net'
            : 'https://api.mailgun.net',
      });

      this.domain = this.configService.get<string>('MAILGUN_DOMAIN', '');
      this.fromEmail = this.configService.get<string>(
        'MAILGUN_FROM_EMAIL',
        'noreply@example.com',
      );
      this.fromName = this.configService.get<string>(
        'MAILGUN_FROM_NAME',
        'Smart City GSP',
      );
    } else {
      this.logger.warn(
        'Mailgun API key not configured. Email sending is disabled.',
      );
      this.mailgunClient = null;
      this.domain = '';
      this.fromEmail = 'noreply@example.com';
      this.fromName = 'Smart City GSP';
    }
  }

  /**
   * Send email using Mailgun API
   */
  async sendEmail(options: EmailOptions): Promise<any> {
    if (!this.mailgunClient) {
      this.logger.warn('Email not sent - Mailgun is not configured');
      return { id: 'mock-id', message: 'Email service not configured' };
    }

    try {
      const messageData: any = {
        from: `${this.fromName} <${this.fromEmail}>`,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
      };

      // Add text or HTML content
      if (options.text) {
        messageData.text = options.text;
      }
      if (options.html) {
        messageData.html = options.html;
      }

      // Add template if specified
      if (options.template) {
        messageData.template = options.template;
        if (options.variables) {
          messageData['h:X-Mailgun-Variables'] = JSON.stringify(
            options.variables,
          );
        }
      }

      // Add optional fields
      if (options.cc) {
        messageData.cc = Array.isArray(options.cc)
          ? options.cc.join(', ')
          : options.cc;
      }
      if (options.bcc) {
        messageData.bcc = Array.isArray(options.bcc)
          ? options.bcc.join(', ')
          : options.bcc;
      }
      if (options.replyTo) {
        messageData['h:Reply-To'] = options.replyTo;
      }
      if (options.tags && options.tags.length > 0) {
        messageData['o:tag'] = options.tags;
      }

      // Add attachments if any
      if (options.attachments && options.attachments.length > 0) {
        messageData.attachment = options.attachments.map((att) => ({
          filename: att.filename,
          data: att.data,
          contentType: att.contentType,
        }));
      }

      const result = await this.mailgunClient.messages.create(
        this.domain,
        messageData,
      );

      this.logger.log(
        `Email sent successfully to ${options.to}. Message ID: ${result.id}`,
      );

      return result;
    } catch (error) {
      this.logger.error(`Failed to send email: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Send bulk emails (up to 1000 recipients)
   */
  async sendBulkEmail(
    recipients: Array<{ email: string; variables?: Record<string, any> }>,
    subject: string,
    template: string,
    globalVariables?: Record<string, any>,
  ): Promise<any> {
    if (!this.mailgunClient) {
      this.logger.warn('Bulk email not sent - Mailgun is not configured');
      return { id: 'mock-id', message: 'Email service not configured' };
    }

    try {
      const recipientVariables: Record<string, any> = {};
      const toList: string[] = [];

      recipients.forEach((recipient) => {
        toList.push(recipient.email);
        if (recipient.variables) {
          recipientVariables[recipient.email] = recipient.variables;
        }
      });

      const messageData: any = {
        from: `${this.fromName} <${this.fromEmail}>`,
        to: toList.join(', '),
        subject: subject,
        template: template,
        'recipient-variables': JSON.stringify(recipientVariables),
      };

      if (globalVariables) {
        messageData['h:X-Mailgun-Variables'] = JSON.stringify(globalVariables);
      }

      const result = await this.mailgunClient.messages.create(
        this.domain,
        messageData,
      );

      this.logger.log(
        `Bulk email sent to ${recipients.length} recipients. Message ID: ${result.id}`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to send bulk email: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Validate email address using Mailgun validation API
   */
  async validateEmail(email: string): Promise<any> {
    if (!this.mailgunClient) {
      this.logger.warn('Email validation skipped - Mailgun is not configured');
      return { result: 'deliverable', risk: 'low' };
    }

    try {
      const result = await this.mailgunClient.validate.get(email);
      return result;
    } catch (error) {
      this.logger.error(`Failed to validate email ${email}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get email events/logs
   */
  async getEvents(options?: {
    begin?: string;
    end?: string;
    limit?: number;
    event?: string;
  }): Promise<any> {
    if (!this.mailgunClient) {
      this.logger.warn('Cannot get events - Mailgun is not configured');
      return { items: [], pages: {} };
    }

    try {
      const result = await this.mailgunClient.events.get(
        this.domain,
        options || {},
      );
      return result;
    } catch (error) {
      this.logger.error(`Failed to get events: ${error.message}`);
      throw error;
    }
  }
}
