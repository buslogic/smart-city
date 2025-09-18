import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';

export interface UploadedFile {
  key: string;
  url: string;
  size: number;
  contentType: string;
}

export interface FileUploadOptions {
  folder?: string;
  fileName?: string;
  contentType?: string;
  isPublic?: boolean;
  metadata?: Record<string, string>;
}

@Injectable()
export class SpacesService {
  private readonly logger = new Logger(SpacesService.name);
  private s3Client: S3Client;
  private bucketName: string;
  private region: string;
  private endpoint: string;
  private cdnEndpoint?: string;

  constructor(private configService: ConfigService) {
    this.region = this.configService.get('DO_SPACES_REGION', 'fra1');
    this.bucketName = this.configService.get(
      'DO_SPACES_BUCKET',
      'smart-city-storage',
    );
    this.endpoint = `https://${this.region}.digitaloceanspaces.com`;
    this.cdnEndpoint = this.configService.get('DO_SPACES_CDN_ENDPOINT');

    const accessKeyId = this.configService.get('DO_SPACES_ACCESS_KEY');
    const secretAccessKey = this.configService.get('DO_SPACES_SECRET_KEY');

    if (!accessKeyId || !secretAccessKey) {
      this.logger.warn('DigitalOcean Spaces credentials not configured');
    }

    this.s3Client = new S3Client({
      endpoint: this.endpoint,
      region: this.region,
      credentials: {
        accessKeyId: accessKeyId || '',
        secretAccessKey: secretAccessKey || '',
      },
    });
  }

  /**
   * Upload fajla na DigitalOcean Spaces
   */
  async uploadFile(
    buffer: Buffer,
    options: FileUploadOptions = {},
  ): Promise<UploadedFile> {
    const {
      folder = 'uploads',
      fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}`,
      contentType = 'application/octet-stream',
      isPublic = false,
      metadata = {},
    } = options;

    const key = `${folder}/${fileName}`;

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        ACL: isPublic ? 'public-read' : 'private',
        Metadata: metadata,
      });

      await this.s3Client.send(command);

      const url = this.getFileUrl(key, isPublic);

      this.logger.log(`File uploaded successfully: ${key}`);

      return {
        key,
        url,
        size: buffer.length,
        contentType,
      };
    } catch (error) {
      this.logger.error('Error uploading file:', error);
      throw error;
    }
  }

  /**
   * Upload stream-a na DigitalOcean Spaces
   */
  async uploadStream(
    stream: Readable,
    options: FileUploadOptions = {},
  ): Promise<UploadedFile> {
    const {
      folder = 'uploads',
      fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}`,
      contentType = 'application/octet-stream',
      isPublic = false,
      metadata = {},
    } = options;

    const key = `${folder}/${fileName}`;

    try {
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      return this.uploadFile(buffer, {
        ...options,
        fileName: key.split('/').pop(),
      });
    } catch (error) {
      this.logger.error('Error uploading stream:', error);
      throw error;
    }
  }

  /**
   * Generiše signed URL za privatne fajlove
   */
  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const url = await getSignedUrl(this.s3Client, command, { expiresIn });
      return url;
    } catch (error) {
      this.logger.error('Error generating signed URL:', error);
      throw error;
    }
  }

  /**
   * Generiše signed URL za upload
   */
  async getUploadSignedUrl(
    key: string,
    contentType: string,
    expiresIn = 3600,
  ): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        ContentType: contentType,
      });

      const url = await getSignedUrl(this.s3Client, command, { expiresIn });
      return url;
    } catch (error) {
      this.logger.error('Error generating upload signed URL:', error);
      throw error;
    }
  }

  /**
   * Download fajla sa Spaces
   */
  async downloadFile(key: string): Promise<Buffer> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.s3Client.send(command);
      const stream = response.Body as Readable;

      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      return Buffer.concat(chunks);
    } catch (error) {
      this.logger.error('Error downloading file:', error);
      throw error;
    }
  }

  /**
   * Brisanje fajla sa Spaces
   */
  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      this.logger.log(`File deleted successfully: ${key}`);
    } catch (error) {
      this.logger.error('Error deleting file:', error);
      throw error;
    }
  }

  /**
   * Brisanje više fajlova odjednom
   */
  async deleteFiles(keys: string[]): Promise<void> {
    if (keys.length === 0) return;

    try {
      const command = new DeleteObjectsCommand({
        Bucket: this.bucketName,
        Delete: {
          Objects: keys.map((key) => ({ Key: key })),
        },
      });

      await this.s3Client.send(command);
      this.logger.log(`${keys.length} files deleted successfully`);
    } catch (error) {
      this.logger.error('Error deleting files:', error);
      throw error;
    }
  }

  /**
   * Lista fajlova u određenom folderu
   */
  async listFiles(prefix?: string, maxKeys = 1000): Promise<any[]> {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: prefix,
        MaxKeys: maxKeys,
      });

      const response = await this.s3Client.send(command);
      return response.Contents || [];
    } catch (error) {
      this.logger.error('Error listing files:', error);
      throw error;
    }
  }

  /**
   * Proverava da li fajl postoji
   */
  async fileExists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      return true;
    } catch (error) {
      if (error.name === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Generiše URL za fajl
   */
  private getFileUrl(key: string, isPublic: boolean): string {
    if (isPublic && this.cdnEndpoint) {
      return `${this.cdnEndpoint}/${key}`;
    }
    return `${this.endpoint}/${this.bucketName}/${key}`;
  }

  /**
   * Validacija tipa fajla
   */
  validateFileType(mimetype: string, allowedTypes: string[]): boolean {
    return allowedTypes.some((type) => {
      if (type.endsWith('*')) {
        return mimetype.startsWith(type.slice(0, -1));
      }
      return mimetype === type;
    });
  }

  /**
   * Generisanje jedinstvenog imena fajla
   */
  generateFileName(originalName: string, prefix?: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    const extension = originalName.split('.').pop();
    const baseName = prefix || originalName.split('.').slice(0, -1).join('.');

    return `${baseName}-${timestamp}-${random}.${extension}`;
  }
}
