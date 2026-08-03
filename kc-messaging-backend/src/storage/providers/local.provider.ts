import { Injectable, Logger } from '@nestjs/common';
import { StorageProvider, StorageResult } from '../storage.interface';
import { promises as fsPromises, createReadStream } from 'fs';
import { join } from 'path';
import { Readable } from 'stream';
import { randomUUID } from 'crypto';

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? 'uploads';

@Injectable()
export class LocalStorageProvider implements StorageProvider {
  private logger = new Logger(LocalStorageProvider.name);

  private async ensureUploadDir() {
    try {
      await fsPromises.mkdir(UPLOAD_DIR, { recursive: true });
    } catch (err) {
      this.logger.error('Could not create upload dir', err as any);
      throw err;
    }
  }

  async save(file: Express.Multer.File): Promise<StorageResult> {
    await this.ensureUploadDir();
    const ext = file.originalname.includes('.') ? file.originalname.split('.').pop() : '';
    const id = `${Date.now()}-${randomUUID()}${ext ? '.' + ext : ''}`;
    const dest = join(UPLOAD_DIR, id);
    // file.buffer is available when using memory storage in multer (FileInterceptor default)
    await fsPromises.writeFile(dest, file.buffer);
    const url = `/uploads/${id}`; // served by static middleware
    return {
      storageKey: id,
      url,
      filename: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    };
  }

  async getStream(storageKey: string): Promise<Readable> {
    const path = join(UPLOAD_DIR, storageKey);
    await fsPromises.access(path);
    return createReadStream(path);
  }

  async delete(storageKey: string): Promise<void> {
    const path = join(UPLOAD_DIR, storageKey);
    try {
      await fsPromises.unlink(path);
    } catch {
      // ignore missing file
    }
  }
}
