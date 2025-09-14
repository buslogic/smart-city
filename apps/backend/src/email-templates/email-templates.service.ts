import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmailTemplateDto } from './dto/create-email-template.dto';
import { UpdateEmailTemplateDto } from './dto/update-email-template.dto';
import { MailService } from '../mail/mail.service';

@Injectable()
export class EmailTemplatesService {
  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
  ) {}

  async create(createEmailTemplateDto: CreateEmailTemplateDto, userId: number) {
    // Check if slug already exists
    const existing = await this.prisma.emailTemplate.findUnique({
      where: { slug: createEmailTemplateDto.slug },
    });

    if (existing) {
      throw new ConflictException(`Template with slug '${createEmailTemplateDto.slug}' already exists`);
    }

    return this.prisma.emailTemplate.create({
      data: {
        ...createEmailTemplateDto,
        createdBy: userId,
      },
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  }

  async findAll(filters?: { category?: string; isActive?: boolean }) {
    const where: any = {};

    if (filters?.category) {
      where.category = filters.category;
    }

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    return this.prisma.emailTemplate.findMany({
      where,
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        updater: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: [
        { category: 'asc' },
        { name: 'asc' },
      ],
    });
  }

  async findOne(id: string) {
    const template = await this.prisma.emailTemplate.findUnique({
      where: { id },
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        updater: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!template) {
      throw new NotFoundException(`Email template with ID '${id}' not found`);
    }

    return template;
  }

  async update(id: string, updateEmailTemplateDto: UpdateEmailTemplateDto, userId: number) {
    const template = await this.prisma.emailTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException(`Email template with ID '${id}' not found`);
    }

    // Check if new slug already exists (if slug is being changed)
    if (updateEmailTemplateDto.slug && updateEmailTemplateDto.slug !== template.slug) {
      const existing = await this.prisma.emailTemplate.findUnique({
        where: { slug: updateEmailTemplateDto.slug },
      });

      if (existing) {
        throw new ConflictException(`Template with slug '${updateEmailTemplateDto.slug}' already exists`);
      }
    }

    return this.prisma.emailTemplate.update({
      where: { id },
      data: {
        ...updateEmailTemplateDto,
        updatedBy: userId,
      },
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        updater: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  }

  async remove(id: string) {
    const template = await this.prisma.emailTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException(`Email template with ID '${id}' not found`);
    }

    await this.prisma.emailTemplate.delete({
      where: { id },
    });

    return { message: 'Email template deleted successfully' };
  }

  async testTemplate(id: string, testEmail: string) {
    const template = await this.prisma.emailTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException(`Email template with ID '${id}' not found`);
    }

    const result = await this.mailService.testEmailTemplate(template.slug, testEmail);

    return {
      message: `Test email sent successfully to ${testEmail}`,
      messageId: result.id,
    };
  }

  async toggleActive(id: string, userId: number) {
    const template = await this.prisma.emailTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException(`Email template with ID '${id}' not found`);
    }

    return this.prisma.emailTemplate.update({
      where: { id },
      data: {
        isActive: !template.isActive,
        updatedBy: userId,
      },
      include: {
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        updater: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  }

  async findBySlug(slug: string) {
    const template = await this.prisma.emailTemplate.findUnique({
      where: { slug },
    });

    if (!template) {
      throw new NotFoundException(`Email template with slug '${slug}' not found`);
    }

    return template;
  }
}