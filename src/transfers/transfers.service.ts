import { 
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service'
import { CreateTransferDto } from './dto/create-transfer.dto';

type LockedAccount = { 
    id: string;
    balanceCents: number;
    status: 'ACTIVE' | 'BLOCKED' | 'CLOSED';
};

@Injectable()
export class TransfersService { 
    constructor(private readonly prisma: PrismaService) {}

    async create(dto: CreateTransferDto) { 
        if (dto.fromAccountId === dto.toAccountId) { 
            throw new BadRequestException('Origem e destino devem ser contas diferentes');
        }

        const replay = await this.findByIdempotencyKey(dto.idempotencyKey);
        if (replay) { 
            return replay;
        }

        try { 
            return await this.prisma.$transaction(async (tx) => { 
                const accounts = await this.lockAccounts(tx, [dto.fromAccountId, dto.toAccountId]);
                const from = accounts.get(dto.fromAccountId);
                const to = accounts.get(dto.toAccountId);

                if (!from || !to) { 
                    throw new NotFoundException('Conta não encontrada');
                }
                if (from.status !== 'ACTIVE' || to.status !== 'ACTIVE') { 
                    throw new  BadRequestException('Conta inativa');
                }
                if (from.balanceCents < dto.amountCents) { 
                    throw new ConflictException('Saldo insuficiente');
                }

                const fromBalance = from.balanceCents - dto.amountCents;
                const toBalance = to.balanceCents + dto.amountCents;

                const transfer = await tx.transfer.create({
                    data: { 
                        idempotencyKey: dto.idempotencyKey,
                        fromAccountId: from.id,
                        toAccountId: to.id,
                        amountCents: dto.amountCents,
                        status: 'COMPLETED',
                    }
                })

                await tx.account.update({
                    where: { id: from.id },
                    data: { balanceCents: fromBalance },
                });
                await tx.account.update({
                    where: { id: to.id },
                    data: { balanceCents: toBalance },
                });

                await tx.transaction.createMany({
                    data: [
                        {
                            accountId: from.id,
                            transferId: transfer.id,
                            type: 'TRANSFER',
                            direction: 'DEBIT',
                            amountCents: dto.amountCents,
                            balanceAfterCents: fromBalance,
                            description: dto.description,
                        },
                        {
                            accountId: to.id,
                            transferId: transfer.id,
                            type: 'TRANSFER',
                            direction: 'CREDIT',
                            amountCents: dto.amountCents,
                            balanceAfterCents: toBalance,
                            description: dto.description,
                        },
                    ],
                });

                return tx.transfer.findUniqueOrThrow({
                    where: { id: transfer.id },
                    include: { entries: true },
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
        return this.prisma.transfer.findUnique({
            where: { idempotencyKey },
            include: { entries: true },
        });
    }

    private async lockAccounts(tx: Prisma.TransactionClient, ids: string[]) {
        const rows = await tx.$queryRaw<LockedAccount[]>(Prisma.sql`
            SELECT id, balance_cents AS "balanceCents", status
            FROM accounts
            WHERE id IN (${Prisma.join(ids)})
            ORDER BY id
            FOR UPDATE
            `);
            return new Map(rows.map((row) => [row.id, row]));
    }
}