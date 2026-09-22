import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL as string });
const prisma = new PrismaClient({ adapter });

const OPENING_BALANCE_CENTS = 100_000;
const GLOBAL_CATEGORIES = ['Alimentação', 'Transporte', 'Salário', 'Lazer'];

async function ensureGlobalCategory(name: string) {
  const existing = await prisma.category.findFirst({ where: { userId: null, name } });
  return existing ?? prisma.category.create({ data: { name } });
}

async function openAccount(input: { userId: string; number: string; branch: string }) {
  const existing = await prisma.account.findUnique({ where: { number: input.number } });
  if (existing) return existing;

  return prisma.$transaction(async (tx) => {
    const account = await tx.account.create({
      data: {
        number: input.number,
        branch: input.branch,
        type: 'CHECKING',
        balanceCents: OPENING_BALANCE_CENTS,
        userId: input.userId,
      },
    });

    await tx.transaction.create({
      data: {
        accountId: account.id,
        type: 'DEPOSIT',
        direction: 'CREDIT',
        amountCents: OPENING_BALANCE_CENTS,
        balanceAfterCents: OPENING_BALANCE_CENTS,
        description: 'Depósito de abertura',
      },
    });

    return account;
  });
}

async function main() {
  for (const name of GLOBAL_CATEGORIES) {
    await ensureGlobalCategory(name);
  }

  const alice = await prisma.user.upsert({
    where: { email: 'alice@example.com' },
    update: {},
    create: { name: 'Alice', email: 'alice@example.com', document: '11111111111' },
  });

  const bob = await prisma.user.upsert({
    where: { email: 'bob@example.com' },
    update: {},
    create: { name: 'Bob', email: 'bob@example.com', document: '22222222222' },
  });

  const from = await openAccount({ userId: alice.id, number: '0001-1', branch: '0001' });
  const to = await openAccount({ userId: bob.id, number: '0002-9', branch: '0001' });

  console.log(`fromAccountId=${from.id}`);
  console.log(`toAccountId=${to.id}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());