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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import type { Response } from 'express';

@ApiTags('uploads')
@Controller('uploads')
@ApiBearerAuth()
export class UploadsController {
  constructor() {
    // Kreiraj uploads folder ako ne postoji
    const uploadPath = join(process.cwd(), 'uploads', 'avatars');
    if (!existsSync(uploadPath)) {
      mkdirSync(uploadPath, { recursive: true });
    }
  }

  @Post('avatar')
  @ApiOperation({ summary: 'Upload avatar slike (lokalno u development)' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
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

    // Vrati relativnu putanju za pristup slici
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

  @Delete('avatar/:filename')
  @ApiOperation({ summary: 'Briši avatar sliku' })
  async deleteAvatar(@Param('filename') filename: string) {
    const filePath = join(process.cwd(), 'uploads', 'avatars', filename);

    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }

    return {
      success: true,
      message: 'Avatar uspešno obrisan',
    };
  }

  @Get('avatars/:filename')
  @ApiOperation({ summary: 'Serviraj avatar sliku' })
  async getAvatar(@Param('filename') filename: string, @Res() res: Response) {
    const filePath = join(process.cwd(), 'uploads', 'avatars', filename);

    if (!existsSync(filePath)) {
      return res.status(404).json({ message: 'Slika nije pronađena' });
    }

    return res.sendFile(filePath);
  }
}
