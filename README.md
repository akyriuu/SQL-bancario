# sql-bancario

Um núcleo bancário transacional em NestJS e PostgreSQL. Movimenta dinheiro entre contas sem perder, duplicar ou inventar um centavo.

É o miolo de um banco: as operações de depósito, saque e transferência, mais a leitura de saldo e extrato. Não tem tela, não tem login, não tem produto financeiro em cima. Tem o que é difícil de acertar, que é garantir que o saldo continue certo quando duas pessoas mexem na mesma conta ao mesmo tempo e quando o cliente reenvia a mesma requisição por causa de uma queda de rede.

## O que faz

Deposita, saca e transfere entre contas, e devolve saldo e extrato paginado. São cinco endpoints:

```
POST /deposits              depósito em conta
POST /withdrawals           saque, barra se não houver saldo
POST /transfers             transferência entre duas contas
GET  /accounts/:id/balance  saldo atual
GET  /accounts/:id/statement extrato paginado, filtrável por tipo e categoria
```

Toda escrita exige uma `idempotencyKey`. Se a mesma chave chegar duas vezes, a segunda devolve o resultado da primeira em vez de movimentar dinheiro de novo.

## Sobre

Cinco endpoints, cinco tabelas, duas migrations. O que faz o projeto existir não é o tamanho, é o que está embaixo.

**Nenhuma escrita passa por fora de uma transação.** As três operações de escrita travam a conta com `SELECT ... FOR UPDATE` antes de ler o saldo, dentro de uma única transação do Postgres. Transferência trava as duas contas numa query só, ordenadas por `id` — por conta dessa ordenação, uma transferência de A para B e outra de B para A acontecendo ao mesmo tempo não travam uma na outra.

**Requisição repetida não duplica dinheiro.** Existe índice único na chave de idempotência em `transfers` e em `transactions`. Quando duas requisições idênticas correm juntas, o Postgres segura o segundo `INSERT` até a primeira commitar; a perdedora captura o erro de violação, relê e devolve o registro da vencedora. Testado: dois `POST /deposits` com a mesma chave retornam o mesmo `id` e o saldo sobe uma vez só.

**O saldo não consegue ficar negativo, nem que o código deixe.** São quatro CHECK constraints no banco — saldo não negativo, valores sempre positivos, origem diferente de destino. Se um bug futuro passar pela validação da aplicação, o Postgres recusa.

**O histórico não pode ser reescrito.** Um trigger bloqueia `UPDATE` e `DELETE` na tabela de lançamentos. Estorno vira lançamento novo, compensatório. Por isso o extrato de hoje conta a mesma história que contava ontem.

**Dinheiro é inteiro, em centavos.** Nada de `Float` ou `Decimal`: 21 índices e todas as comparações de saldo trabalham sobre `Int`, sem arredondamento binário no meio.

Cada lançamento guarda o saldo resultante da conta naquele momento, então dá para auditar qualquer linha do extrato sem resomar o razão desde a abertura.


## Arquitetura e fluxos

1. Arquitetura Geral 

<img width="1642" height="813" alt="arqgeral" src="https://github.com/user-attachments/assets/7f6254b0-f8bd-4303-9091-3c7485a020cd" />

2. Fluxo de depósito e saque

<img width="427" height="922" alt="fluxoSaqueDep" src="https://github.com/user-attachments/assets/2132f17c-48b0-452b-a179-2f710bc6c8bb" />

3. Fluxo de transferência (dois locks em ordem determinística)

<img width="600" height="928" alt="image" src="https://github.com/user-attachments/assets/5733a5fa-e37f-4592-a4ad-3102b5edd33b" />

4. Idempotência como máquina de estados

<img width="667" height="689" alt="image" src="https://github.com/user-attachments/assets/27b2f59d-9d7a-4aab-bc13-6ff296dff191" />

5. Extrato paginado por cursor

<img width="1731" height="397" alt="image" src="https://github.com/user-attachments/assets/ce7aa2b4-952f-4e97-98a8-836e23161f38" />

6. Modelo de dados

<img width="1464" height="398" alt="image" src="https://github.com/user-attachments/assets/2d06fe26-fbe1-47ad-aaf7-63618693adfc" />

7. Ciclo de desenvolvimento Prisma

<img width="1241" height="796" alt="image" src="https://github.com/user-attachments/assets/793173d2-40fd-4cbb-b0f8-af8b35d8a757" />






## Rodando

Precisa de Docker e Node.

```bash
docker compose up -d      # Postgres 17 na porta 5437
npm install
cp .env.example .env
npx prisma migrate dev    # cria as tabelas
npx prisma generate       # gera o client
npx prisma db seed        # 2 contas com R$ 1.000 cada
npm run start:dev
```

O seed imprime os IDs das contas no final. Use-os direto no corpo das requisições.

Conferindo que funcionou:

```bash
curl http://localhost:3000/accounts/<ID>/balance
```

## Por dentro

Prisma 7 com driver adapter (`@prisma/adapter-pg`), o que significa que o client fala com o Postgres pelo `pg` puro, sem engine binária.

O extrato pagina por cursor, não por `offset`. Numa tabela que só recebe inserção, offset escorrega: chega lançamento novo, a página desloca e o cliente vê registro repetido. O cursor ancora na linha, e a consulta cai direto no índice composto de conta e data.

As regras que moram no banco — os CHECKs, o trigger, o índice parcial de categorias globais — foram escritas à mão dentro da migration inicial, porque o Prisma não modela nenhuma delas. Se você criar migrations novas, gere com `--create-only` e leia o SQL antes de aplicar.

## Stack

NestJS 12 · Prisma 7.10 · PostgreSQL 17 · TypeScript 6 · Jest 30 · oxlint
