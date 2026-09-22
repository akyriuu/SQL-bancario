import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
  } from '@nestjs/common';
  import { Prisma } from '../generated/prisma/client';
  import { PrismaService } from '../prisma/prisma.service';
  import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
  
  type LockedAccount = {
    id: string;
    balanceCents: number;
    status: 'ACTIVE' | 'BLOCKED' | 'CLOSED';
  };
  
  @Injectable()
  export class WithdrawalsService {
    constructor(private readonly prisma: PrismaService) {}
  
    async create(dto: CreateWithdrawalDto) {
      const replay = await this.findByIdempotencyKey(dto.idempotencyKey);
      if (replay) {
        return replay;
      }
  
      try {
        return await this.prisma.$transaction(async (tx) => {
          const account = await this.lockAccount(tx, dto.accountId);
  
          if (!account) {
            throw new NotFoundException('Conta não encontrada');
          }
          if (account.status !== 'ACTIVE') {
            throw new BadRequestException('Conta inativa');
          }
          if (account.balanceCents < dto.amountCents) {
            throw new ConflictException('Saldo insuficiente');
          }
  
          const balanceAfter = account.balanceCents - dto.amountCents;
  
          await tx.account.update({
            where: { id: account.id },
            data: { balanceCents: balanceAfter },
          });
  
          return tx.transaction.create({
            data: {
              idempotencyKey: dto.idempotencyKey,
              accountId: account.id,
              type: 'WITHDRAWAL',
              direction: 'DEBIT',
              amountCents: dto.amountCents,
              balanceAfterCents: balanceAfter,
              categoryId: dto.categoryId,
              description: dto.description,
            },
          });
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          const concurrent = await this.findByIdempotencyKey(dto.idempotencyKey);
          if (concurrent) {
            return concurrent;
          }
        }
        throw error;
      }
    }
  
    findByIdempotencyKey(idempotencyKey: string) {
      return this.prisma.transaction.findUnique({ where: { idempotencyKey } });
    }
  
    private async lockAccount(tx: Prisma.TransactionClient, id: string) {
      const [account] = await tx.$queryRaw<LockedAccount[]>(Prisma.sql`
        SELECT id, balance_cents AS "balanceCents", status
        FROM accounts
        WHERE id = ${id}
        FOR UPDATE
      `);
      return account;
    }
  }