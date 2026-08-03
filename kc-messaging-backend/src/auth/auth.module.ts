import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController, UsersController } from './auth.controller';
import { JwtAuthGuard } from './jwt-auth.guard';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET') || 'change-me-access',
        signOptions: { expiresIn: config.get<string>('JWT_ACCESS_TTL') || '15m' },
      }),
    }),
  ],
  controllers: [AuthController, UsersController],
  providers: [AuthService, JwtAuthGuard],
  exports: [AuthService, JwtAuthGuard, JwtModule],
})
export class AuthModule {}
