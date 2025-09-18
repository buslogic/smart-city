import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailgunService } from './mailgun.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    private prisma: PrismaService,
    private mailgunService: MailgunService,
    private configService: ConfigService,
  ) {}

  /**
   * Send email using template from database
   */
  async sendTemplatedEmail(
    to: string | string[],
    templateSlug: string,
    variables: Record<string, any>,
    options?: {
      cc?: string | string[];
      bcc?: string | string[];
      replyTo?: string;
      attachments?: Array<{
        filename: string;
        data: Buffer | string;
        contentType?: string;
      }>;
    },
  ) {
    // Get template from database
    const template = await this.prisma.emailTemplate.findUnique({
      where: { slug: templateSlug },
    });

    if (!template) {
      throw new NotFoundException(
        `Email template with slug '${templateSlug}' not found`,
      );
    }

    if (!template.isActive) {
      throw new Error(`Email template '${templateSlug}' is not active`);
    }

    // Replace variables in subject and body
    let subject = template.subject;
    let body = template.body;
    let bodyHtml = template.bodyHtml;

    Object.keys(variables).forEach((key) => {
      const value = variables[key];
      const regex = new RegExp(`{{${key}}}`, 'g');
      subject = subject.replace(regex, value);
      body = body.replace(regex, value);
      if (bodyHtml) {
        bodyHtml = bodyHtml.replace(regex, value);
      }
    });

    // Send email
    const result = await this.mailgunService.sendEmail({
      to,
      subject,
      text: body,
      html: bodyHtml || undefined,
      cc: options?.cc,
      bcc: options?.bcc,
      replyTo: options?.replyTo,
      attachments: options?.attachments,
      tags: [template.category, templateSlug],
    });

    // Update template usage stats
    await this.prisma.emailTemplate.update({
      where: { id: template.id },
      data: {
        usageCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });

    this.logger.log(`Email sent using template '${templateSlug}' to ${to}`);

    return result;
  }

  /**
   * Send welcome email to new user
   */
  async sendWelcomeEmail(user: {
    email: string;
    firstName: string;
    lastName: string;
    temporaryPassword?: string;
  }) {
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3011';

    const variables = {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      password: user.temporaryPassword || '(molimo promenite lozinku)',
      registrationDate: new Date().toLocaleDateString('sr-RS'),
      loginUrl: frontendUrl,
    };

    return this.sendTemplatedEmail(user.email, 'welcome-email', variables);
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(user: {
    email: string;
    firstName: string;
    resetToken: string;
  }) {
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3011';
    const resetUrl = `${frontendUrl}/reset-password?token=${user.resetToken}`;

    const variables = {
      firstName: user.firstName,
      email: user.email,
      resetUrl,
      expirationHours: '24',
    };

    return this.sendTemplatedEmail(user.email, 'password-reset', variables);
  }

  /**
   * Send custom email without template
   */
  async sendCustomEmail(
    to: string | string[],
    subject: string,
    body: string,
    options?: {
      html?: string;
      cc?: string | string[];
      bcc?: string | string[];
      replyTo?: string;
      attachments?: Array<{
        filename: string;
        data: Buffer | string;
        contentType?: string;
      }>;
    },
  ) {
    return this.mailgunService.sendEmail({
      to,
      subject,
      text: body,
      html: options?.html,
      cc: options?.cc,
      bcc: options?.bcc,
      replyTo: options?.replyTo,
      attachments: options?.attachments,
    });
  }

  /**
   * Test email template with sample data
   */
  async testEmailTemplate(templateSlug: string, testEmail: string) {
    const template = await this.prisma.emailTemplate.findUnique({
      where: { slug: templateSlug },
    });

    if (!template) {
      throw new NotFoundException(
        `Email template with slug '${templateSlug}' not found`,
      );
    }

    // Create sample variables
    const sampleVariables: Record<string, any> = {};
    if (template.variables && Array.isArray(template.variables)) {
      (template.variables as string[]).forEach((variable) => {
        sampleVariables[variable] = `[${variable}]`;
      });
    }

    // Add some default sample values
    sampleVariables.firstName = 'Test';
    sampleVariables.lastName = 'Korisnik';
    sampleVariables.email = testEmail;
    sampleVariables.registrationDate = new Date().toLocaleDateString('sr-RS');
    sampleVariables.loginUrl = 'http://localhost:3011';
    sampleVariables.resetUrl =
      'http://localhost:3011/reset-password?token=test-token';
    sampleVariables.expirationHours = '24';
    sampleVariables.password = 'Test123!';

    return this.sendTemplatedEmail(testEmail, templateSlug, sampleVariables);
  }
}
