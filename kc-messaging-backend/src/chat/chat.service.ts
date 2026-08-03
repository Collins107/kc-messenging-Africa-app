import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  async listConversations(userId: string) {
    const rows = await this.prisma.conversationParticipant.findMany({
      where: { userId },
      include: {
        conversation: {
          include: {
            participants: { include: { user: true } },
            messages: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
        },
      },
      orderBy: { conversation: { updatedAt: 'desc' } },
    });

    return rows.map((r) => ({
      id: r.conversation.id,
      isGroup: r.conversation.isGroup,
      title: r.conversation.title,
      participants: r.conversation.participants.map((p) => ({
        id: p.user.id,
        phone: p.user.phone,
        displayName: p.user.displayName,
        avatarUrl: p.user.avatarUrl,
      })),
      lastMessage: r.conversation.messages[0] ?? null,
      lastReadAt: r.lastReadAt,
      updatedAt: r.conversation.updatedAt,
    }));
  }

  // Opens an existing 1:1 conversation if one exists, otherwise creates it.
  async createOrOpen(userId: string, participantIds: string[], title?: string) {
    const allIds = Array.from(new Set([userId, ...participantIds]));
    const isGroup = allIds.length > 2;

    if (!isGroup) {
      const existing = await this.prisma.conversation.findFirst({
        where: {
          isGroup: false,
          participants: { every: { userId: { in: allIds } } },
          AND: allIds.map((id) => ({ participants: { some: { userId: id } } })),
        },
        include: { participants: true },
      });
      if (existing && existing.participants.length === allIds.length) {
        return this.getConversation(userId, existing.id);
      }
    }

    const conversation = await this.prisma.conversation.create({
      data: {
        isGroup,
        title,
        participants: { create: allIds.map((id) => ({ userId: id })) },
      },
      include: { participants: { include: { user: true } } },
    });

    return conversation;
  }

  async getConversation(userId: string, conversationId: string) {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!participant) throw new ForbiddenException('Not a participant');

    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { participants: { include: { user: true } } },
    });
    if (!conversation) throw new NotFoundException();
    return conversation;
  }

  async getMessages(userId: string, conversationId: string, cursor?: string, limit = 30) {
    await this.assertParticipant(userId, conversationId);

    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    return messages.reverse();
  }

  async sendMessage(userId: string, conversationId: string, body: string) {
    await this.assertParticipant(userId, conversationId);

    const message = await this.prisma.message.create({
      data: { conversationId, senderId: userId, body },
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return message;
  }

  async markRead(userId: string, conversationId: string) {
    await this.assertParticipant(userId, conversationId);
    await this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: new Date() },
    });
    return { ok: true };
  }

  private async assertParticipant(userId: string, conversationId: string) {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!participant) throw new ForbiddenException('Not a participant');
  }
}
