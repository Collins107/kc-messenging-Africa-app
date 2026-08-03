import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';
import { RealtimeModule } from './realtime/realtime.module';
import { StorageModule } from './storage/storage.module';
import { MediaModule } from './media/media.module';
import * as Joi from 'joi';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().uri().required(),
        JWT_ACCESS_SECRET: Joi.string().min(16).required(),
        JWT_REFRESH_SECRET: Joi.string().min(16).required(),
        JWt_REFRESH_SECRET: Joi.string().min(16).required(),
        CORS_ORIGIN: Joi.string().required(),
        PORT: Joi.number().default(3000),
        OTP_DEV_MODE: Joi.string().valid('true', 'false').default('true'),
      }),
    }),
    ThrottlerModule.forRoot({ ttl: 60, limit: 20 }),
    PrismaModule,
    AuthModule,
    ChatModule,
    RealtimeModule,
    StorageModule,
    MediaModule,
  ],
})
export class AppModule {}
