import { IsArray, IsOptional, IsString, ArrayMinSize } from 'class-validator';

export class CreateConversationDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  participantIds: string[]; // other users' ids; the caller is added automatically

  @IsOptional()
  @IsString()
  title?: string;
}

export class SendMessageDto {
  @IsString()
  body: string;
}
