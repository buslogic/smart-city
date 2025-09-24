import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompanyInfoDto, UpdateCompanyInfoDto } from './dto/company-info.dto';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async getCompanyInfo() {
    const companyInfo = await this.prisma.companyInfo.findFirst();
    return companyInfo;
  }

  async createOrUpdateCompanyInfo(data: CreateCompanyInfoDto | UpdateCompanyInfoDto) {
    const existing = await this.prisma.companyInfo.findFirst();

    if (existing) {
      // Update existing record
      return this.prisma.companyInfo.update({
        where: { id: existing.id },
        data: {
          companyName: data.companyName,
          taxId: data.taxId,
          address: data.address,
          phone: data.phone,
          email: data.email,
          bankAccount: data.bankAccount,
          bankName: data.bankName,
          website: data.website || null,
          logo: data.logo || null,
          updatedAt: new Date(),
        },
      });
    } else {
      // Create new record
      return this.prisma.companyInfo.create({
        data: {
          companyName: data.companyName,
          taxId: data.taxId,
          address: data.address,
          phone: data.phone,
          email: data.email,
          bankAccount: data.bankAccount,
          bankName: data.bankName,
          website: data.website || null,
          logo: data.logo || null,
        },
      });
    }
  }

  async deleteCompanyInfo() {
    const existing = await this.prisma.companyInfo.findFirst();

    if (!existing) {
      throw new NotFoundException('Company info not found');
    }

    return this.prisma.companyInfo.delete({
      where: { id: existing.id },
    });
  }
}