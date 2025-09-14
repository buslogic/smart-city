import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { EmailTemplatesService } from './email-templates.service';
import { CreateEmailTemplateDto } from './dto/create-email-template.dto';
import { UpdateEmailTemplateDto } from './dto/update-email-template.dto';
import { TestEmailTemplateDto } from './dto/test-email-template.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@ApiTags('Email Templates')
@ApiBearerAuth()
@Controller('email-templates')
@UseGuards(JwtAuthGuard)
export class EmailTemplatesController {
  constructor(private readonly emailTemplatesService: EmailTemplatesService) {}

  @Post()
  @RequirePermissions('settings.email_templates:create')
  @ApiOperation({ summary: 'Create new email template' })
  create(@Body() createEmailTemplateDto: CreateEmailTemplateDto, @Request() req) {
    return this.emailTemplatesService.create(createEmailTemplateDto, req.user.id);
  }

  @Get()
  @RequirePermissions('settings.email_templates:view')
  @ApiOperation({ summary: 'Get all email templates' })
  findAll(@Query('category') category?: string, @Query('isActive') isActive?: string) {
    return this.emailTemplatesService.findAll({
      category,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    });
  }

  @Get(':id')
  @RequirePermissions('settings.email_templates:view')
  @ApiOperation({ summary: 'Get email template by ID' })
  findOne(@Param('id') id: string) {
    return this.emailTemplatesService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('settings.email_templates:update')
  @ApiOperation({ summary: 'Update email template' })
  update(
    @Param('id') id: string,
    @Body() updateEmailTemplateDto: UpdateEmailTemplateDto,
    @Request() req
  ) {
    return this.emailTemplatesService.update(id, updateEmailTemplateDto, req.user.id);
  }

  @Delete(':id')
  @RequirePermissions('settings.email_templates:delete')
  @ApiOperation({ summary: 'Delete email template' })
  remove(@Param('id') id: string) {
    return this.emailTemplatesService.remove(id);
  }

  @Post(':id/test')
  @RequirePermissions('settings.email_templates:test')
  @ApiOperation({ summary: 'Test email template' })
  testTemplate(@Param('id') id: string, @Body() testDto: TestEmailTemplateDto) {
    return this.emailTemplatesService.testTemplate(id, testDto.testEmail);
  }

  @Post(':id/toggle-active')
  @RequirePermissions('settings.email_templates:update')
  @ApiOperation({ summary: 'Toggle template active status' })
  toggleActive(@Param('id') id: string, @Request() req) {
    return this.emailTemplatesService.toggleActive(id, req.user.id);
  }
}