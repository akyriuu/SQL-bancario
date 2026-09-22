import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ListEntriesDto } from './dto/list-entries.dto';

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async getBalance(accountId: string) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      select: { id: true, number: true, branch: true, status: true, balanceCents: true },
    });

    if (!account) {
      throw new NotFoundException('Conta não encontrada');
    }
    return account;
  }

  async listEntries(accountId: string, query: ListEntriesDto) {
    await this.ensureExists(accountId);

    const rows = await this.prisma.transaction.findMany({
      where: {
        accountId,
        type: query.type,
        direction: query.direction,
        categoryId: query.categoryId,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
      include: { category: { select: { id: true, name: true } } },
    });

    const hasMore = rows.length > query.limit;
    const entries = hasMore ? rows.slice(0, query.limit) : rows;

    return {
      entries,
      nextCursor: hasMore ? entries[entries.length - 1].id : null,
    };
  }

  private async ensureExists(id: string) {
    const account = await this.prisma.account.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!account) {
      throw new NotFoundException('Conta não encontrada');
    }
  }
}