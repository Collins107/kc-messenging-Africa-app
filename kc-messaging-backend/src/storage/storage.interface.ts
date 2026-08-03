import { Readable } from 'stream';

export interface StorageResult {
  storageKey: string;
  url?: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface StorageProvider {
  save(file: Express.Multer.File): Promise<StorageResult>;
  getStream(storageKey: string): Promise<Readable>;
  delete(storageKey: string): Promise<void>;
}
