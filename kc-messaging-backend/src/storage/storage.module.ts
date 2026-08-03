import { Global, Module } from '@nestjs/common';
import { LocalStorageProvider } from './providers/local.provider';

export const STORAGE_PROVIDER = 'STORAGE_PROVIDER';

@Global()
@Module({
  providers: [
    {
      provide: STORAGE_PROVIDER,
      useClass: LocalStorageProvider,
    },
  ],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}
