import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { LocalStorage, S3Storage, createStorage } from './storage';

describe('Storage Port & Adapters', () => {
  const testUploadsDir = path.resolve(process.cwd(), 'data', 'test-uploads');

  beforeEach(() => {
    if (fs.existsSync(testUploadsDir)) {
      fs.rmSync(testUploadsDir, { recursive: true, force: true });
    }
  });

  describe('LocalStorage', () => {
    it('performs round-trip put, getUrl, and delete on local filesystem', async () => {
      const storage = new LocalStorage(testUploadsDir, 'http://localhost:40001');
      const testBuffer = Buffer.from('Hello architecture storage', 'utf-8');
      const fileKey = 'avatars/user-123.txt';

      // 1. Put
      const url = await storage.put(fileKey, testBuffer, 'text/plain');
      expect(url).toBe('http://localhost:40001/uploads/avatars/user-123.txt');

      // 2. Verify file on disk
      const writtenPath = path.join(testUploadsDir, 'avatars', 'user-123.txt');
      expect(fs.existsSync(writtenPath)).toBe(true);
      expect(fs.readFileSync(writtenPath, 'utf-8')).toBe('Hello architecture storage');

      // 3. GetUrl
      const fetchedUrl = await storage.getUrl(fileKey);
      expect(fetchedUrl).toBe('http://localhost:40001/uploads/avatars/user-123.txt');

      // 4. Delete
      await storage.delete(fileKey);
      expect(fs.existsSync(writtenPath)).toBe(false);
    });

    it('sanitizes keys to prevent path traversal outside uploads directory', async () => {
      const storage = new LocalStorage(testUploadsDir, 'http://localhost:40001');
      const testBuffer = Buffer.from('malicious attempt', 'utf-8');
      const maliciousKey = '../../evil.txt';

      await storage.put(maliciousKey, testBuffer);

      // Should be sanitized inside testUploadsDir, never in parent directory
      const evilPath = path.join(testUploadsDir, 'evil.txt');
      expect(fs.existsSync(evilPath)).toBe(true);
      expect(fs.existsSync(path.resolve(testUploadsDir, '..', 'evil.txt'))).toBe(false);
    });
  });

  describe('S3Storage', () => {
    it('dispatches PutObjectCommand and DeleteObjectCommand via S3 client', async () => {
      const mockClient = {
        send: vi.fn().mockResolvedValue({}),
      };

      const storage = new S3Storage(
        {
          bucket: 'my-production-bucket',
          region: 'eu-west-1',
          endpoint: 'https://s3.custom-endpoint.com',
        },
        mockClient as any
      );

      const buffer = Buffer.from('PDF invoice content', 'utf-8');
      const key = 'invoices/inv-001.pdf';

      // 1. Put
      const url = await storage.put(key, buffer, 'application/pdf');
      expect(url).toBe('https://s3.custom-endpoint.com/my-production-bucket/invoices/inv-001.pdf');
      expect(mockClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Bucket: 'my-production-bucket',
            Key: 'invoices/inv-001.pdf',
            Body: buffer,
            ContentType: 'application/pdf',
          }),
        })
      );

      // 2. Delete
      await storage.delete(key);
      expect(mockClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Bucket: 'my-production-bucket',
            Key: 'invoices/inv-001.pdf',
          }),
        })
      );
    });

    it('requires S3_BUCKET when instantiated', () => {
      expect(() => new S3Storage({ bucket: '' })).toThrow('S3_BUCKET is required for S3Storage');
    });
  });

  describe('createStorage Factory', () => {
    it('returns LocalStorage by default when STORAGE_DRIVER is unset or local', () => {
      const storage = createStorage();
      expect(storage).toBeInstanceOf(LocalStorage);
    });
  });
});
