import {
  Controller,
  Post,
  Delete,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Req,
  Res,
  Get,
  Param,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import type { Response } from 'express';
import { SpacesService } from '../../spaces/spaces.service';
import { ConfigService } from '@nestjs/config';
import { SpacesPathHelper } from '../../common/helpers/spaces-path.helper';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('uploads')
@Controller('uploads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class UploadsController {
  private readonly logger = new Logger(UploadsController.name);
  private readonly isProduction: boolean;

  constructor(
    private spacesService: SpacesService,
    private configService: ConfigService,
  ) {
    this.isProduction = this.configService.get('NODE_ENV') === 'production';

    // Kreiraj uploads folder samo u development
    if (!this.isProduction) {
      const uploadPath = join(process.cwd(), 'uploads', 'avatars');
      if (!existsSync(uploadPath)) {
        mkdirSync(uploadPath, { recursive: true });
        this.logger.log('Created local uploads directory');
      }
    } else {
      this.logger.log('Using DigitalOcean Spaces for file storage');
    }
  }

  @Post('avatar')
  @ApiOperation({ summary: 'Upload avatar slike' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: process.env.NODE_ENV === 'production'
        ? undefined // Koristi memory storage za Spaces
        : diskStorage({
            destination: join(process.cwd(), 'uploads', 'avatars'),
            filename: (req, file, cb) => {
              const uniqueName = `${uuidv4()}${extname(file.originalname)}`;
              cb(null, uniqueName);
            },
          }),
      fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extName = allowedTypes.test(
          extname(file.originalname).toLowerCase(),
        );
        const mimeType = allowedTypes.test(file.mimetype);

        if (extName && mimeType) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Samo slike su dozvoljene'), false);
        }
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    }),
  )
  async uploadAvatar(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('Fajl nije prosleđen');
    }

    try {
      // Production - koristi DigitalOcean Spaces
      if (this.isProduction) {
        const fileName = this.spacesService.generateFileName(
          file.originalname,
          'avatar',
        );

        // Uzmi company code iz env varijable i generiši folder path
        const companyCode = this.configService.get('COMPANY_CODE', 'default');
        const folder = SpacesPathHelper.getFolderPath(companyCode, 'avatars');

        const uploadResult = await this.spacesService.uploadFile(
          file.buffer,
          {
            folder, // npr. "litas/avatars"
            fileName,
            contentType: file.mimetype,
            isPublic: true, // Avatar slike su javne
          },
        );

        this.logger.log(`Avatar uploaded to Spaces: ${uploadResult.key}`);

        return {
          success: true,
          file: {
            url: uploadResult.url,
            key: uploadResult.key,
            filename: fileName,
            originalName: file.originalname,
            size: uploadResult.size,
          },
        };
      }
      // Development - koristi lokalni storage
      else {
        const url = `/uploads/avatars/${file.filename}`;

        return {
          success: true,
          file: {
            url,
            filename: file.filename,
            originalName: file.originalname,
            size: file.size,
          },
        };
      }
    } catch (error) {
      this.logger.error('Failed to upload avatar:', error);
      throw new BadRequestException('Greška pri upload-u slike');
    }
  }

  @Post('company-logo')
  @ApiOperation({ summary: 'Upload company logo' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: process.env.NODE_ENV === 'production'
        ? undefined // Koristi memory storage za Spaces
        : diskStorage({
            destination: join(process.cwd(), 'uploads', 'company-logos'),
            filename: (req, file, cb) => {
              const uniqueName = `logo-${Date.now()}${extname(file.originalname)}`;
              cb(null, uniqueName);
            },
          }),
      fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|svg/;
        const extName = allowedTypes.test(
          extname(file.originalname).toLowerCase(),
        );
        const mimeType = allowedTypes.test(file.mimetype);

        if (extName && mimeType) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Samo slike su dozvoljene (JPEG, PNG, GIF, SVG)'), false);
        }
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    }),
  )
  async uploadCompanyLogo(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('Fajl nije prosleđen');
    }

    // Kreiraj folder za company logos u development
    if (!this.isProduction) {
      const uploadPath = join(process.cwd(), 'uploads', 'company-logos');
      if (!existsSync(uploadPath)) {
        mkdirSync(uploadPath, { recursive: true });
      }
    }

    try {
      // Production - koristi DigitalOcean Spaces
      if (this.isProduction) {
        const fileName = this.spacesService.generateFileName(
          file.originalname,
          'company-logo',
        );

        // Uzmi company code iz env varijable i generiši folder path
        const companyCode = this.configService.get('COMPANY_CODE', 'default');
        const folder = SpacesPathHelper.getFolderPath(companyCode, 'company-logos');

        const uploadResult = await this.spacesService.uploadFile(
          file.buffer,
          {
            folder, // npr. "litas/company-logos"
            fileName,
            contentType: file.mimetype,
            isPublic: true, // Company logo je javan
          },
        );

        this.logger.log(`Company logo uploaded to Spaces: ${uploadResult.key}`);

        return {
          success: true,
          file: {
            url: uploadResult.url,
            key: uploadResult.key,
            filename: fileName,
            originalName: file.originalname,
            size: uploadResult.size,
          },
        };
      }
      // Development - koristi lokalni storage
      else {
        const url = `/uploads/company-logos/${file.filename}`;

        return {
          success: true,
          file: {
            url,
            filename: file.filename,
            originalName: file.originalname,
            size: file.size,
          },
        };
      }
    } catch (error) {
      this.logger.error('Failed to upload company logo:', error);
      throw new BadRequestException('Greška pri upload-u logotipa');
    }
  }

  @Delete('avatar/:filename')
  @ApiOperation({ summary: 'Briši avatar sliku' })
  async deleteAvatar(@Param('filename') filename: string) {
    try {
      if (this.isProduction) {
        // Za Spaces, filename može biti key ili samo filename
        let key: string;
        if (filename.includes('/')) {
          // Ako je već kompletan path, koristi ga
          key = filename;
        } else {
          // Generiši path sa company code-om
          const companyCode = this.configService.get('COMPANY_CODE', 'default');
          key = SpacesPathHelper.getFilePath(companyCode, 'avatars', filename);
        }

        await this.spacesService.deleteFile(key);

        this.logger.log(`Avatar deleted from Spaces: ${key}`);
      } else {
        // Lokalno brisanje
        const filePath = join(process.cwd(), 'uploads', 'avatars', filename);

        if (existsSync(filePath)) {
          unlinkSync(filePath);
        }
      }

      return {
        success: true,
        message: 'Avatar uspešno obrisan',
      };
    } catch (error) {
      this.logger.error('Failed to delete avatar:', error);
      throw new BadRequestException('Greška pri brisanju slike');
    }
  }

  @Get('avatars/:filename')
  @ApiOperation({ summary: 'Serviraj avatar sliku' })
  async getAvatar(@Param('filename') filename: string, @Res() res: Response) {
    try {
      if (this.isProduction) {
        // Na produkciji, redirect na Spaces CDN URL
        let key: string;
        if (filename.includes('/')) {
          // Ako je već kompletan path, koristi ga
          key = filename;
        } else {
          // Generiši path sa company code-om
          const companyCode = this.configService.get('COMPANY_CODE', 'default');
          key = SpacesPathHelper.getFilePath(companyCode, 'avatars', filename);
        }

        // Generiši signed URL ako fajl nije javan
        // ili jednostavno redirect na CDN
        const cdnEndpoint = this.configService.get('DO_SPACES_CDN_ENDPOINT');
        const bucket = this.configService.get('DO_SPACES_BUCKET');

        if (cdnEndpoint) {
          return res.redirect(`${cdnEndpoint}/${key}`);
        } else {
          // Fallback na signed URL
          const signedUrl = await this.spacesService.getSignedUrl(key, 3600);
          return res.redirect(signedUrl);
        }
      } else {
        // Lokalno serviranje
        const filePath = join(process.cwd(), 'uploads', 'avatars', filename);

        if (!existsSync(filePath)) {
          return res.status(404).json({ message: 'Slika nije pronađena' });
        }

        return res.sendFile(filePath);
      }
    } catch (error) {
      this.logger.error('Failed to get avatar:', error);
      return res.status(404).json({ message: 'Slika nije pronađena' });
    }
  }
}