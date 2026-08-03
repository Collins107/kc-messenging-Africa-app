import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

// Namespace matches the frontend's single shared socket.io-client connection to /realtime
@WebSocketGateway({ namespace: '/realtime', cors: { origin: true, credentials: true } })
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  constructor(
    private jwt: JwtService,
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    // Frontend sends the access token in the handshake auth payload, e.g.
    // io(`${url}/realtime`, { auth: { token: accessToken } })
    const token =
      (client.handshake.auth?.token as string) ||
      (client.handshake.headers['authorization'] as string)?.replace('Bearer ', '');

    if (!token) {
      client.disconnect();
      return;
    }

    try {
      const payload = await this.jwt.verifyAsync(token, {
        secret: this.config.get('JWT_ACCESS_SECRET'),
      });
      client.data.userId = payload.sub;
      client.data.deviceId = payload.deviceId;

      // Join a personal room so we can push to a user across all their conversations/devices
      client.join(`user:${payload.sub}`);

      // Join rooms for every conversation this user participates in
      const conversations = await this.prisma.conversationParticipant.findMany({
        where: { userId: payload.sub },
        select: { conversationId: true },
      });
      conversations.forEach((c) => client.join(`conversation:${c.conversationId}`));
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    // Sockets auto-leave rooms on disconnect; nothing else to clean up here.
  }

  @SubscribeMessage('typing:start')
  onTypingStart(@ConnectedSocket() client: Socket, @MessageBody() data: { conversationId: string }) {
    client.to(`conversation:${data.conversationId}`).emit('typing:update', {
      conversationId: data.conversationId,
      userId: client.data.userId,
      typing: true,
    });
  }

  @SubscribeMessage('typing:stop')
  onTypingStop(@ConnectedSocket() client: Socket, @MessageBody() data: { conversationId: string }) {
    client.to(`conversation:${data.conversationId}`).emit('typing:update', {
      conversationId: data.conversationId,
      userId: client.data.userId,
      typing: false,
    });
  }

  // Called by ChatController after a message is persisted via REST
  emitNewMessage(conversationId: string, message: unknown) {
    this.server.to(`conversation:${conversationId}`).emit('message:new', message);
  }
}
