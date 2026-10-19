import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UploadService implements OnModuleInit {
  private readonly logger = new Logger(UploadService.name);
  private minioClient: Minio.Client | null = null;
  private bucketName: string;
  private isConfigured: boolean = false;

  constructor(private configService: ConfigService) {
    const endpoint = this.configService.get<string>('MINIO_ENDPOINT');
    const port = parseInt(this.configService.get<string>('MINIO_PORT'));
    const useSSL = this.configService.get<string>('MINIO_USE_SSL') === 'true';
    const accessKey = this.configService.get<string>('MINIO_ACCESS_KEY');
    const secretKey = this.configService.get<string>('MINIO_SECRET_KEY');
    this.bucketName = this.configService.get<string>('MINIO_BUCKET_NAME');

    if (!endpoint) {
      this.logger.warn('MINIO_ENDPOINT not configured — file upload will be unavailable.');
      return;
    }

    // Every uploaded file here is health data: exam results, prescriptions,
    // medical reports, credentialing documents. Plain HTTP would send both
    // the file bytes and the presigned URL's signature in the clear. This
    // can't hard-fail: local dev and docker-compose legitimately run MinIO on
    // HTTP, and refusing to start would break those. So it's loud instead —
    // production is the only place where this combination is a real problem.
    if (!useSSL && this.configService.get<string>('NODE_ENV') === 'production') {
      this.logger.error(
        `MINIO_USE_SSL is not enabled while NODE_ENV=production — uploads and presigned ` +
          `URLs for ${endpoint} are travelling over plain HTTP. Set MINIO_USE_SSL=true.`,
      );
    }

    try {
      this.minioClient = new Minio.Client({
        endPoint: endpoint,
        port: port,
        useSSL: useSSL,
        accessKey: accessKey,
        secretKey: secretKey,
        pathStyle: true,
      });
      this.isConfigured = true;
    } catch (error) {
      this.logger.error(`Failed to initialize MinIO client: ${error.message}`);
    }
  }

  async onModuleInit() {
    if (!this.isConfigured || !this.minioClient) {
      this.logger.warn('MinIO not configured — skipping bucket initialization.');
      return;
    }

    try {
      const bucketExists = await this.minioClient.bucketExists(this.bucketName);
      if (!bucketExists) {
        await this.minioClient.makeBucket(this.bucketName, 'us-east-1');
        this.logger.log(`Bucket ${this.bucketName} created successfully`);
      } else {
        this.logger.log(`Bucket ${this.bucketName} already exists`);
      }
      // Deliberately does NOT set a public-read bucket policy anymore: every
      // file is served through a short-lived presigned URL (getPresignedUrl)
      // or a scoped document-access token instead of a permanent public link.
      // On Cloudflare R2, a bucket's "Public Development URL" (the pub-*.r2.dev
      // host behind MINIO_PUBLIC_URL) is a toggle in the Cloudflare dashboard,
      // not something this SDK's setBucketPolicy call controls — disabling
      // that toggle for the production bucket is a required manual step to
      // actually close public access, independent of this code change.
    } catch (error) {
      this.logger.error(`Error initializing MinIO: ${error.message}`);
    }
  }

  /**
   * Recovers the raw object key (e.g. "prescriptions/uuid.pdf") from a URL
   * previously returned by uploadFile(), regardless of which branch built it
   * (MINIO_PUBLIC_URL host-only, or protocol://host/bucket/key fallback).
   */
  private extractObjectKey(storedUrl: string): string | null {
    try {
      const { pathname } = new URL(storedUrl);
      const prefix = `/${this.bucketName}/`;
      const path = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname.slice(1);
      return path || null;
    } catch {
      return null;
    }
  }

  /** True when object storage is usable. Lets callers fail fast when it is not. */
  get isAvailable(): boolean {
    return this.isConfigured && !!this.minioClient;
  }

  async uploadFile(file: Express.Multer.File, folder: string = 'images'): Promise<string> {
    if (!this.isConfigured || !this.minioClient) {
      this.logger.warn('MinIO not configured — upload skipped, returning empty URL.');
      return '';
    }

    try {
      const fileExtension = file.originalname.split('.').pop();
      const fileName = `${folder}/${uuidv4()}.${fileExtension}`;
      const metaData = {
        'Content-Type': file.mimetype,
      };

      await this.minioClient.putObject(this.bucketName, fileName, file.buffer, file.size, metaData);

      // Use public URL if configured (e.g. Cloudflare R2 public dev URL or custom domain)
      // Otherwise fall back to the S3-compatible endpoint URL
      const publicUrl = this.configService.get<string>('MINIO_PUBLIC_URL');
      if (publicUrl) {
        const base = publicUrl.replace(/\/+$/, '');
        return `${base}/${fileName}`;
      }

      const endpoint = this.configService.get<string>('MINIO_ENDPOINT');
      const port = parseInt(this.configService.get<string>('MINIO_PORT'));
      const useSSL = this.configService.get<string>('MINIO_USE_SSL') === 'true';
      const protocol = useSSL ? 'https' : 'http';

      const isStandardPort = (useSSL && port === 443) || (!useSSL && port === 80);
      const hostWithPort = isStandardPort ? endpoint : `${endpoint}:${port}`;
      const fileUrl = `${protocol}://${hostWithPort}/${this.bucketName}/${fileName}`;
      return fileUrl;
    } catch (error) {
      this.logger.error(`Error uploading file: ${error.message}`);
      throw error;
    }
  }

  async deleteFile(fileUrl: string): Promise<void> {
    if (!this.isConfigured || !this.minioClient) {
      this.logger.warn('MinIO not configured — delete skipped.');
      return;
    }

    try {
      const fileName = this.extractObjectKey(fileUrl);
      if (fileName) {
        await this.minioClient.removeObject(this.bucketName, fileName);
        this.logger.log(`File ${fileName} deleted successfully`);
      }
    } catch (error) {
      this.logger.error(`Error deleting file: ${error.message}`);
      throw error;
    }
  }

  /**
   * Builds a time-limited URL for a file previously stored via uploadFile(),
   * valid for `expirySeconds` (default 5 minutes). This is the only way
   * callers should hand a document URL to a client from now on — never the
   * permanent URL returned by uploadFile()/stored as `documentUrl`.
   */
  async getPresignedUrl(storedUrl: string, expirySeconds: number = 300): Promise<string | null> {
    if (!this.isConfigured || !this.minioClient) {
      this.logger.warn('MinIO not configured — cannot sign URL.');
      return null;
    }

    const objectKey = this.extractObjectKey(storedUrl);
    if (!objectKey) {
      this.logger.error(`Could not extract object key from stored URL: ${storedUrl}`);
      return null;
    }

    try {
      return await this.minioClient.presignedGetObject(this.bucketName, objectKey, expirySeconds);
    } catch (error) {
      this.logger.error(`Error signing URL for ${objectKey}: ${error.message}`);
      return null;
    }
  }
}
