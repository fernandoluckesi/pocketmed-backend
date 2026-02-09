import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UploadService implements OnModuleInit {
  private readonly logger = new Logger(UploadService.name);
  private minioClient: Minio.Client;
  private bucketName: string;

  constructor(private configService: ConfigService) {
    const endpoint = this.configService.get<string>('MINIO_ENDPOINT');
    const port = parseInt(this.configService.get<string>('MINIO_PORT'));
    const useSSL = this.configService.get<string>('MINIO_USE_SSL') === 'true';
    const accessKey = this.configService.get<string>('MINIO_ACCESS_KEY');
    const secretKey = this.configService.get<string>('MINIO_SECRET_KEY');
    this.bucketName = this.configService.get<string>('MINIO_BUCKET_NAME');

    this.minioClient = new Minio.Client({
      endPoint: endpoint,
      port: port,
      useSSL: useSSL,
      accessKey: accessKey,
      secretKey: secretKey,
    });
  }

  async onModuleInit() {
    try {
      const bucketExists = await this.minioClient.bucketExists(this.bucketName);
      if (!bucketExists) {
        await this.minioClient.makeBucket(this.bucketName, 'us-east-1');
        this.logger.log(`Bucket ${this.bucketName} created successfully`);

        const policy = {
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: { AWS: ['*'] },
              Action: ['s3:GetObject'],
              Resource: [`arn:aws:s3:::${this.bucketName}/*`],
            },
          ],
        };

        await this.minioClient.setBucketPolicy(this.bucketName, JSON.stringify(policy));
        this.logger.log(`Bucket ${this.bucketName} policy set to public read`);
      } else {
        this.logger.log(`Bucket ${this.bucketName} already exists`);
      }
    } catch (error) {
      this.logger.error(`Error initializing MinIO: ${error.message}`);
    }
  }

  async uploadFile(file: Express.Multer.File, folder: string = 'images'): Promise<string> {
    try {
      const fileExtension = file.originalname.split('.').pop();
      const fileName = `${folder}/${uuidv4()}.${fileExtension}`;
      const metaData = {
        'Content-Type': file.mimetype,
      };

      await this.minioClient.putObject(this.bucketName, fileName, file.buffer, file.size, metaData);

      const endpoint = this.configService.get<string>('MINIO_ENDPOINT');
      const port = this.configService.get<string>('MINIO_PORT');
      const useSSL = this.configService.get<string>('MINIO_USE_SSL') === 'true';
      const protocol = useSSL ? 'https' : 'http';

      const fileUrl = `${protocol}://${endpoint}:${port}/${this.bucketName}/${fileName}`;
      return fileUrl;
    } catch (error) {
      this.logger.error(`Error uploading file: ${error.message}`);
      throw error;
    }
  }

  async deleteFile(fileUrl: string): Promise<void> {
    try {
      const fileName = fileUrl.split(`/${this.bucketName}/`)[1];
      if (fileName) {
        await this.minioClient.removeObject(this.bucketName, fileName);
        this.logger.log(`File ${fileName} deleted successfully`);
      }
    } catch (error) {
      this.logger.error(`Error deleting file: ${error.message}`);
      throw error;
    }
  }
}
