import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  BadRequestException,
  NotFoundException,
  UseGuards,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { SpacesService } from './spaces.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

interface FileUploadDto {
  folder?: string;
  isPublic?: boolean;
  metadata?: Record<string, string>;
}

@ApiTags('Spaces')
@Controller('spaces')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class SpacesController {
  constructor(private readonly spacesService: SpacesService) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload jednog fajla' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        folder: {
          type: 'string',
          description: 'Folder gde će fajl biti sačuvan',
          default: 'uploads',
        },
        isPublic: {
          type: 'boolean',
          description: 'Da li je fajl javno dostupan',
          default: false,
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB max
      },
    }),
  )
  @RequirePermissions('files:upload')
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() uploadDto: FileUploadDto,
  ) {
    if (!file) {
      throw new BadRequestException('Fajl nije prosleđen');
    }

    // Validacija tipa fajla
    const allowedTypes = [
      'image/*',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
    ];

    if (!this.spacesService.validateFileType(file.mimetype, allowedTypes)) {
      throw new BadRequestException('Tip fajla nije dozvoljen');
    }

    const fileName = this.spacesService.generateFileName(file.originalname);

    const result = await this.spacesService.uploadFile(file.buffer, {
      folder: uploadDto.folder || 'uploads',
      fileName,
      contentType: file.mimetype,
      isPublic: uploadDto.isPublic || false,
      metadata: {
        originalName: file.originalname,
        uploadedAt: new Date().toISOString(),
        ...uploadDto.metadata,
      },
    });

    return {
      success: true,
      file: result,
    };
  }

  @Post('upload-multiple')
  @ApiOperation({ summary: 'Upload više fajlova odjednom' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
        folder: {
          type: 'string',
          description: 'Folder gde će fajlovi biti sačuvani',
          default: 'uploads',
        },
        isPublic: {
          type: 'boolean',
          description: 'Da li su fajlovi javno dostupni',
          default: false,
        },
      },
    },
  })
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB po fajlu
      },
    }),
  )
  @RequirePermissions('files:upload')
  async uploadMultipleFiles(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() uploadDto: FileUploadDto,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Fajlovi nisu prosleđeni');
    }

    const uploadPromises = files.map((file) => {
      const fileName = this.spacesService.generateFileName(file.originalname);

      return this.spacesService.uploadFile(file.buffer, {
        folder: uploadDto.folder || 'uploads',
        fileName,
        contentType: file.mimetype,
        isPublic: uploadDto.isPublic || false,
        metadata: {
          originalName: file.originalname,
          uploadedAt: new Date().toISOString(),
          ...uploadDto.metadata,
        },
      });
    });

    const results = await Promise.all(uploadPromises);

    return {
      success: true,
      files: results,
    };
  }

  @Get('signed-url/*key')
  @ApiOperation({ summary: 'Generiše signed URL za privatni fajl' })
  @RequirePermissions('files:read')
  async getSignedUrl(
    @Param('key') key: string,
    @Query('expiresIn') expiresIn?: number,
  ) {
    const exists = await this.spacesService.fileExists(key);
    if (!exists) {
      throw new NotFoundException('Fajl nije pronađen');
    }

    const url = await this.spacesService.getSignedUrl(key, expiresIn || 3600);

    return {
      success: true,
      url,
      expiresIn: expiresIn || 3600,
    };
  }

  @Get('upload-url')
  @ApiOperation({
    summary: 'Generiše signed URL za direktan upload sa frontend-a',
  })
  @RequirePermissions('files:upload')
  async getUploadUrl(
    @Query('key') key: string,
    @Query('contentType') contentType: string,
    @Query('expiresIn') expiresIn?: number,
  ) {
    if (!key || !contentType) {
      throw new BadRequestException('Key i contentType su obavezni');
    }

    const url = await this.spacesService.getUploadSignedUrl(
      key,
      contentType,
      expiresIn || 3600,
    );

    return {
      success: true,
      url,
      key,
      expiresIn: expiresIn || 3600,
    };
  }

  @Get('download/*key')
  @ApiOperation({ summary: 'Download fajla' })
  @RequirePermissions('files:read')
  async downloadFile(
    @Param('key') key: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const exists = await this.spacesService.fileExists(key);
    if (!exists) {
      throw new NotFoundException('Fajl nije pronađen');
    }

    const buffer = await this.spacesService.downloadFile(key);
    const fileName = key.split('/').pop();

    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    });

    return new StreamableFile(buffer);
  }

  @Get('list')
  @ApiOperation({ summary: 'Lista fajlova u folderu' })
  @RequirePermissions('files:read')
  async listFiles(
    @Query('prefix') prefix?: string,
    @Query('maxKeys') maxKeys?: number,
  ) {
    const files = await this.spacesService.listFiles(prefix, maxKeys || 100);

    return {
      success: true,
      files: files.map((file) => ({
        key: file.Key,
        size: file.Size,
        lastModified: file.LastModified,
        etag: file.ETag,
      })),
      count: files.length,
    };
  }

  @Delete('*key')
  @ApiOperation({ summary: 'Brisanje fajla' })
  @RequirePermissions('files:delete')
  async deleteFile(@Param('key') key: string) {
    const exists = await this.spacesService.fileExists(key);
    if (!exists) {
      throw new NotFoundException('Fajl nije pronađen');
    }

    await this.spacesService.deleteFile(key);

    return {
      success: true,
      message: 'Fajl je uspešno obrisan',
    };
  }

  @Post('delete-multiple')
  @ApiOperation({ summary: 'Brisanje više fajlova' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        keys: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
      },
    },
  })
  @RequirePermissions('files:delete')
  async deleteMultipleFiles(@Body('keys') keys: string[]) {
    if (!keys || keys.length === 0) {
      throw new BadRequestException('Lista ključeva je obavezna');
    }

    await this.spacesService.deleteFiles(keys);

    return {
      success: true,
      message: `${keys.length} fajlova je uspešno obrisano`,
    };
  }

  @Get('exists/*key')
  @ApiOperation({ summary: 'Proverava da li fajl postoji' })
  @RequirePermissions('files:read')
  async checkFileExists(@Param('key') key: string) {
    const exists = await this.spacesService.fileExists(key);

    return {
      success: true,
      exists,
    };
  }
}
