import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateConversationDto, SendMessageDto } from './dto';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@UseGuards(JwtAuthGuard)
@Controller('conversations')
export class ChatController {
  constructor(private chat: ChatService, private realtime: RealtimeGateway) {}

  @Get()
  list(@Req() req: any) {
    return this.chat.listConversations(req.user.id);
  }

  @Post()
  create(@Req() req: any, @Body() dto: CreateConversationDto) {
    return this.chat.createOrOpen(req.user.id, dto.participantIds, dto.title);
  }

  @Get(':id')
  get(@Req() req: any, @Param('id') id: string) {
    return this.chat.getConversation(req.user.id, id);
  }

  @Get(':id/messages')
  messages(
    @Req() req: any,
    @Param('id') id: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.chat.getMessages(req.user.id, id, cursor, limit ? parseInt(limit, 10) : undefined);
  }

  @Post(':id/messages')
  async send(@Req() req: any, @Param('id') id: string, @Body() dto: SendMessageDto) {
    const message = await this.chat.sendMessage(req.user.id, id, dto.body);
    // Fan out over the same gateway the frontend listens to for "message:new"
    this.realtime.emitNewMessage(id, message);
    return message;
  }

  @Post(':id/read')
  markRead(@Req() req: any, @Param('id') id: string) {
    return this.chat.markRead(req.user.id, id);
  }
}
