# Aura Studio — Sistema de gestão interna

Sistema interno da Aura Studio para os dois fundadores gerenciarem projetos,
clientes, horas e metas em um só lugar. Construído a partir do mockup do
Claude Design, com Next.js (App Router) + Supabase.

## Módulos

- **Início** — visão do dia: tarefas, horas da semana, faturamento, o que precisa de atenção
- **Kanban** — quadro de tarefas (por cliente ou interno), com detalhe, subtarefas, comentários e timer
- **Horas & rentabilidade** — timer, registro manual, consumo por cliente/pessoa, exportação CSV
- **Metas** — metas trimestrais por área com progresso
- **CRM** — clientes, pipeline de negócios e faturas
- **Playbooks** — processos documentados; os executáveis geram tarefas reais no Kanban

## Stack

- Next.js 16 (App Router, Server Actions) + TypeScript + Tailwind v4
- Supabase (Postgres + Auth) — projeto `aura-studio-interno` (região `sa-east-1`)
- Acesso restrito: só e-mails na tabela `allowed_emails` conseguem criar conta

## Rodando localmente

```bash
npm install
npm run dev
```

Crie um `.env.local` (não versionado) com:

```
NEXT_PUBLIC_SUPABASE_URL=https://pknooqhosbieqgjzwtww.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable/anon key do projeto no painel do Supabase>
```

## Primeiro acesso

1. Abra `/login` e clique em "Primeiro acesso? Criar conta".
2. Cadastre-se com o e-mail que já está autorizado (`samuel20almeida@gmail.com`).
   O Supabase envia um e-mail de confirmação — confirme antes de entrar.
3. Para liberar o acesso do Saymon, adicione o e-mail dele na tabela
   `allowed_emails` (painel do Supabase → Table Editor, ou SQL:
   `insert into allowed_emails (email, note) values ('email-do-saymon@...', 'Fundador');`).
   Depois ele segue o mesmo fluxo de "Criar conta".

## Deploy

O projeto está pronto para deploy na Vercel (ou similar):

1. Importe este repositório.
2. Configure as variáveis de ambiente `NEXT_PUBLIC_SUPABASE_URL` e
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` (mesmos valores do `.env.local`).
3. Para a tela `/operacao` receber o uso do ClubCut, configure também
   `SUPABASE_SERVICE_ROLE_KEY` e `CLUBCUT_SYNC_TOKEN` — as duas só são
   usadas pela rota de sincronização, e o resto do app funciona sem elas.
   Ver `docs/clubcut-sync.md`.
4. Deploy. Sem passos de build adicionais.

## Banco de dados

As migrations SQL estão em `supabase/migrations/`, aplicadas em ordem no
projeto Supabase `aura-studio-interno`. O workspace começa vazio — sem
clientes, tarefas ou dados de exemplo — pronto para os dados reais da
Aura.
