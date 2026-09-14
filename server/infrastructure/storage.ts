import fs from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { logger } from './observability';
import {
  APP_URL,
  STORAGE_DRIVER,
  S3_BUCKET,
  S3_REGION,
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  S3_ENDPOINT,
} from '../config/index';

// ============================================================================
// Storage PORT + adapters.
//
// Clean Architecture: Services and controllers interact exclusively through
// the `Storage` port interface. `LocalStorage` serves dev and testing
// (persists to data/uploads/ and serves statically via /uploads).
// `S3Storage` serves production uploads to AWS S3, Cloudflare R2, MinIO, etc.
// ============================================================================

export interface Storage {
  put(key: string, buffer: Buffer, mimeType?: string): Promise<string>;
  getUrl(key: string): Promise<string>;
  delete(key: string): Promise<void>;
}

export class LocalStorage implements Storage {
  private baseDir: string;
  private appUrl: string;

  constructor(baseDir = path.resolve(process.cwd(), 'data', 'uploads'), appUrl = APP_URL) {
    this.baseDir = baseDir;
    this.appUrl = appUrl.replace(/\/+$/, '');
  }

  private resolvePath(key: string): string {
    // Sanitize key to prevent path traversal
    const safeKey = key.replace(/^(\.\.(\/|\\|$))+/, '');
    return path.join(this.baseDir, safeKey);
  }

  async put(key: string, buffer: Buffer, _mimeType?: string): Promise<string> {
    const filePath = this.resolvePath(key);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, buffer);
    logger.debug('[storage:local] wrote file', { key, size: buffer.length });
    return this.getUrl(key);
  }

  async getUrl(key: string): Promise<string> {
    const safeKey = key.replace(/^\/+/, '');
    return `${this.appUrl}/uploads/${safeKey}`;
  }

  async delete(key: string): Promise<void> {
    const filePath = this.resolvePath(key);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logger.debug('[storage:local] deleted file', { key });
    }
  }
}

export interface S3StorageOptions {
  bucket?: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  endpoint?: string;
}

export class S3Storage implements Storage {
  private client: S3Client;
  private bucket: string;
  private region: string;
  private endpoint?: string;

  constructor(opts?: S3StorageOptions, customClient?: S3Client) {
    this.bucket = opts?.bucket ?? S3_BUCKET;
    this.region = opts?.region ?? S3_REGION;
    this.endpoint = opts?.endpoint ?? S3_ENDPOINT;

    if (!this.bucket) {
      throw new Error('S3_BUCKET is required for S3Storage');
    }

    if (customClient) {
      this.client = customClient;
    } else {
      const accessKeyId = opts?.accessKeyId ?? AWS_ACCESS_KEY_ID;
      const secretAccessKey = opts?.secretAccessKey ?? AWS_SECRET_ACCESS_KEY;
      const hasCredentials = Boolean(accessKeyId && secretAccessKey);

      this.client = new S3Client({
        region: this.region,
        endpoint: this.endpoint || undefined,
        credentials: hasCredentials
          ? { accessKeyId, secretAccessKey }
          : undefined,
      });
    }
  }

  async put(key: string, buffer: Buffer, mimeType?: string): Promise<string> {
    const safeKey = key.replace(/^\/+/, '');
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: safeKey,
        Body: buffer,
        ContentType: mimeType,
      })
    );
    logger.info('[storage:s3] uploaded object', { bucket: this.bucket, key: safeKey });
    return this.getUrl(safeKey);
  }

  async getUrl(key: string): Promise<string> {
    const safeKey = key.replace(/^\/+/, '');
    if (this.endpoint) {
      const cleanEndpoint = this.endpoint.replace(/\/+$/, '');
      return `${cleanEndpoint}/${this.bucket}/${safeKey}`;
    }
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${safeKey}`;
  }

  async delete(key: string): Promise<void> {
    const safeKey = key.replace(/^\/+/, '');
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: safeKey,
      })
    );
    logger.info('[storage:s3] deleted object', { bucket: this.bucket, key: safeKey });
  }
}

/**
 * Storage factory respecting STORAGE_DRIVER setting.
 * When STORAGE_DRIVER === 's3' and S3_BUCKET is configured, instantiates S3Storage.
 * Defaults to LocalStorage (data/uploads/).
 */
export function createStorage(): Storage {
  if (STORAGE_DRIVER === 's3' && S3_BUCKET) {
    return new S3Storage();
  }
  return new LocalStorage();
}
