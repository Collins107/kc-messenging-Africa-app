import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash, randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  private hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  // Parse TTL strings like '15m', '30d', '3600s', '1h' into milliseconds.
  private parseTtlToMs(ttl: string | undefined, fallbackMs = 30 * 24 * 60 * 60 * 1000) {
    if (!ttl) return fallbackMs;
    const m = ttl.match(/^(\d+)(ms|s|m|h|d)?$/i);
    if (!m) return fallbackMs;
    const n = parseInt(m[1], 10);
    const unit = (m[2] || 's').toLowerCase();
    switch (unit) {
      case 'ms':
        return n;
      case 's':
        return n * 1000;
      case 'm':
        return n * 60 * 1000;
      case 'h':
        return n * 60 * 60 * 1000;
      case 'd':
        return n * 24 * 60 * 60 * 1000;
      default:
        return fallbackMs;
    }
  }

  // --- OTP ---

  async sendOtp(phone: string) {
    const code = String(randomInt(0, 999999)).padStart(6, '0');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await this.prisma.otpCode.create({
      data: { phone, codeHash: this.hash(code), expiresAt },
    });

    if (this.config.get('OTP_DEV_MODE') === 'true') {
      // eslint-disable-next-line no-console
      console.log(`[dev] OTP for ${phone}: ${code}`);
    } else {
      // Wire up your SMS provider (e.g. Termii, Africa's Talking, Twilio) here.
      // await this.smsProvider.send(phone, `Your KC Messaging code is ${code}`);
    }

    return { sent: true, expiresInSeconds: 300 };
  }

  async verifyOtp(phone: string, code: string, deviceId: string | undefined, platform?: string) {
    const otp = await this.prisma.otpCode.findFirst({
      where: { phone, consumed: false },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp || otp.expiresAt < new Date()) {
      throw new BadRequestException('OTP expired or not found, request a new code');
    }
    if (otp.attempts >= 5) {
      throw new BadRequestException('Too many attempts, request a new code');
    }
    if (otp.codeHash !== this.hash(code)) {
      await this.prisma.otpCode.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Incorrect code');
    }

    await this.prisma.otpCode.update({
      where: { id: otp.id },
      data: { consumed: true },
    });

    const user = await this.prisma.user.upsert({
      where: { phone },
      update: { lastSeenAt: new Date() },
      create: { phone },
    });

    const device = deviceId
      ? await this.prisma.device.upsert({
          where: { id: deviceId },
          update: { userId: user.id, platform },
          create: { id: deviceId, userId: user.id, platform },
        })
      : await this.prisma.device.create({ data: { userId: user.id, platform } });

    return this.issueTokens(user.id, device.id);
  }

  // --- Tokens ---

  private async issueTokens(userId: string, deviceId: string) {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, deviceId },
      {
        secret: this.config.get('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get('JWT_ACCESS_TTL') ?? '15m',
      },
    );

    const refreshToken = await this.jwt.signAsync(
      { sub: userId, deviceId },
      {
        secret: this.config.get('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get('JWT_REFRESH_TTL') ?? '30d',
      },
    );

    // Derive DB expiry from JWT_REFRESH_TTL so DB expiry matches token expiry.
    const refreshTtlEnv = this.config.get('JWT_REFRESH_TTL') as string | undefined;
    const expiresMs = this.parseTtlToMs(refreshTtlEnv, 30 * 24 * 60 * 60 * 1000);
    const expiresAt = new Date(Date.now() + expiresMs);

    await this.prisma.refreshToken.create({
      data: {
        tokenHash: this.hash(refreshToken),
        userId,
        deviceId,
        expiresAt,
      },
    });

    return { accessToken, refreshToken, deviceId };
  }

  // Single-flight friendly: rotates refresh token, revokes the old one.
  async refresh(refreshToken: string, deviceId: string) {
    let payload: { sub: string; deviceId: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.deviceId !== deviceId) {
      throw new UnauthorizedException('Device mismatch');
    }

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hash(refreshToken) },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token no longer valid');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(payload.sub, deviceId);
  }

  async logout(userId: string, deviceId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, deviceId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { loggedOut: true };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    return {
      id: user.id,
      phone: user.phone,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
    };
  }
}
