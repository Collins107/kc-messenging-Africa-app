import { IsString, Matches, Length, IsOptional } from 'class-validator';

export class SendOtpDto {
  @IsString()
  @Matches(/^\+[1-9]\d{6,14}$/, { message: 'phone must be E.164 format, e.g. +2348012345678' })
  phone: string;
}

export class VerifyOtpDto {
  @IsString()
  @Matches(/^\+[1-9]\d{6,14}$/)
  phone: string;

  @IsString()
  @Length(4, 8)
  code: string;

  // Frontend generates/stores this per-install and sends it on every auth call
  @IsString()
  deviceId?: string;

  @IsOptional()
  @IsString()
  platform?: string;
}

export class RefreshDto {
  @IsString()
  refreshToken: string;

  @IsString()
  deviceId: string;
}
