import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';
import { RealtimeModule } from './realtime/realtime.module';

function validateEnv(env: Record<string, any>) {
  const required = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'CORS_ORIGIN'];
  for (const key of required) {
    if (!env[key]) throw new Error(`${key} is required`);
  }
  return env;
}

@Module({
  imports: [
    // Validate required env vars at startup so the app fails fast when something is missing
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // Throttler expects an object with ttl in seconds and limit
    ThrottlerModule.forRoot({ ttl: 60, limit: 20 }), // guards OTP send endpoint from abuse
    PrismaModule,
    AuthModule,
    ChatModule,
    RealtimeModule,
  ],
})
export class AppModule {}
