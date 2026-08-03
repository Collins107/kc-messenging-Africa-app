import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwt: JwtService, private config: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const authHeader: string | undefined = req.headers['authorization'];
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    if (!token) throw new UnauthorizedException('Missing access token');

    try {
      const payload = await this.jwt.verifyAsync(token, {
        secret: this.config.get('JWT_ACCESS_SECRET'),
      });
      req.user = { id: payload.sub, deviceId: payload.deviceId };
      return true;
    } catch {
      // 401 here is what triggers the frontend's single-flight /auth/refresh retry
      throw new UnauthorizedException('Access token expired or invalid');
    }
  }
}

// Shared helper for the Socket.io gateway to verify the same JWT on connection.
export function verifySocketToken(jwt: JwtService, config: ConfigService, token: string) {
  return jwt.verifyAsync(token, { secret: config.get('JWT_ACCESS_SECRET') });
}
