# Credenciais Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Novo módulo "Credenciais" — uma aba na coluna lateral com uma
lista de senhas/chaves de acesso (internas da Aura Studio e de clientes),
com CRUD completo e a senha mascarada por padrão na tela.

**Architecture:** Duas tabelas novas no Supabase (`credenciais` e o
catálogo `credencial_categorias`, mesmo formato de `task_areas`), lidas e
escritas em texto simples — sem criptografia, decisão explícita registrada
no spec. Módulo Server Component + Client Component seguindo exatamente o
padrão já usado em Kanban/Metas/Playbooks: `src/lib/data/credenciais.ts`
(leitura), `src/lib/actions/credenciais.ts` (`"use server"`, escrita),
`src/app/(app)/credenciais/page.tsx` (busca os dados, monta a página),
`src/components/credenciais/CredenciaisClient.tsx` (lista + filtro +
exclusão) e `src/components/credenciais/CredentialModal.tsx` (criar/editar,
com cadastro inline de categoria nova).

**Tech Stack:** Next.js App Router, Supabase (Postgres + RLS), React
Server/Client Components, Tailwind.

## Global Constraints

- Todo texto visível ao usuário em pt-BR.
- Nunca usar o prefixo Tailwind `motion-safe:`.
- Nenhum dado fictício em nenhum lugar do código.
- Banco único, sem separação dev/prod.
- Toda escrita ao banco a partir de um componente cliente envolvida em
  `beginMutation()` / `finally { end() }` de `@/lib/realtime/mutation-gate`.
- Senha e chave são guardadas em **texto simples, sem criptografia** —
  decisão explícita do usuário, registrada em
  `docs/superpowers/specs/2026-08-22-credenciais-design.md` ("Decisão de
  segurança"). Não implemente nenhuma forma de cifra, hashing ou ofuscação
  do campo `senha` — isso contradiria a decisão tomada.
- RLS de `credenciais` e `credencial_categorias`: mesma política
  `authenticated_full_access` usada em todas as tabelas do projeto (`for
  all using (auth.uid() is not null) with check (auth.uid() is not
  null)`).
- Este projeto não tem infraestrutura de teste de componente React — a
  verificação de cada task é 100% pelos 4 comandos (`npm test`, `npx tsc
  --noEmit`, `npm run lint`, `npm run build`), nunca "visualmente
  confirmado" (não há navegador disponível nesta sessão).

---

### Task 1: Migração, leitura de dados e Server Actions

**Files:**
- Create: `supabase/migrations/0019_credenciais.sql`
- Create: `src/lib/data/credenciais.ts`
- Create: `src/lib/actions/credenciais.ts`

**Interfaces:**
- Consumes: nada (esta é a primeira task do plano).
- Produces:
  - `listCredentials()`: retorna `Promise<CredentialWithRelations[]>`,
    cada item com `id`, `nome`, `categoria_id`, `cliente_id`, `usuario`,
    `senha`, `url`, `notas`, `criado_em`, `atualizado_em`,
    `categoria: { id, nome } | null`, `cliente: { id, name } | null`.
    Lança (`throw`) em erro de consulta — é o conteúdo principal da
    página, um erro aqui deve acionar o `error.tsx` do grupo `(app)`, não
    aparecer como lista vazia.
  - `listCredentialCategories()`: retorna `Promise<{ id: string; nome:
    string }[]>`, devolve `[]` em erro (mesmo padrão de `listTaskAreas`
    em `src/lib/data/tasks.ts:28-34`) — é dado auxiliar para um `<Select>`
    de formulário, não o conteúdo principal da tela.
  - `createCredential(input)`, `updateCredential(id, input)`,
    `deleteCredential(id)`, `createCredentialCategory(nome)` — assinaturas
    exatas abaixo, no Step 3.

**Nota para quem for executar esta task:** depois que você terminar e
reportar, o controlador da sessão aplica a migração ao banco real via
Supabase MCP e regenera `src/lib/supabase/database.types.ts` antes de
qualquer outra task começar — isso não é papel desta task. É esperado que
`npx tsc --noEmit` reclame de `credenciais`/`credencial_categorias` "não
reconhecidas" no tipo `Database` até isso acontecer; se isso acontecer,
não é um bug seu, é a ordem normal do processo.

- [ ] **Step 1: Criar a migração**

Crie `supabase/migrations/0019_credenciais.sql`:

```sql
-- Catálogo de categorias de credencial (mesmo formato de task_areas,
-- 0018_task_areas.sql) e a tabela de credenciais em si — senhas e chaves
-- de acesso, internas da Aura Studio ou de clientes. Guardadas em texto
-- simples: decisão registrada em
-- docs/superpowers/specs/2026-08-22-credenciais-design.md ("Decisão de
-- segurança") — só Samuel e Saymon têm acesso ao CRM, e criptografia foi
-- explicitamente descartada.
create table public.credencial_categorias (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  position integer not null default 0,
  criado_em timestamptz not null default now()
);

alter table public.credencial_categorias enable row level security;
create policy "authenticated_full_access" on public.credencial_categorias
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

insert into public.credencial_categorias (nome, position) values
  ('Hospedagem', 0),
  ('E-mail', 1),
  ('Domínio', 2),
  ('API', 3),
  ('Financeiro', 4),
  ('Outro', 5)
on conflict do nothing;

create table public.credenciais (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  categoria_id uuid not null references public.credencial_categorias(id),
  -- Nulo = credencial interna da Aura Studio; preenchido = credencial de
  -- um cliente específico.
  cliente_id uuid references public.clients(id) on delete set null,
  usuario text,
  senha text,
  url text,
  notas text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index credenciais_categoria_idx on public.credenciais (categoria_id);
create index credenciais_cliente_idx on public.credenciais (cliente_id);

alter table public.credenciais enable row level security;
create policy "authenticated_full_access" on public.credenciais
  for all using (auth.uid() is not null) with check (auth.uid() is not null);
```

Não rode esta migração contra o banco — só crie o arquivo. Quem aplica ao
banco real é o controlador da sessão, entre esta task e a próxima (ver a
nota acima).

- [ ] **Step 2: Criar a leitura de dados**

Crie `src/lib/data/credenciais.ts`:

```ts
import { createClient } from "@/lib/supabase/server";

export async function listCredentials() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("credenciais")
    .select("*, categoria:credencial_categorias(id, nome), cliente:clients(id, name)")
    .order("nome");
  if (error) throw error;
  return data;
}

export type CredentialWithRelations = Awaited<ReturnType<typeof listCredentials>>[number];

export async function listCredentialCategories() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("credencial_categorias")
    .select("id, nome")
    .order("position");
  return data ?? [];
}
```

- [ ] **Step 3: Criar as Server Actions**

Crie `src/lib/actions/credenciais.ts`:

```ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type CredentialInput = {
  nome: string;
  categoriaId: string;
  clienteId: string | null;
  usuario: string | null;
  senha: string | null;
  url: string | null;
  notas: string | null;
};

export async function createCredential(input: CredentialInput) {
  const supabase = await createClient();
  const { error } = await supabase.from("credenciais").insert({
    nome: input.nome,
    categoria_id: input.categoriaId,
    cliente_id: input.clienteId,
    usuario: input.usuario,
    senha: input.senha,
    url: input.url,
    notas: input.notas,
  });
  if (error) throw error;
  revalidatePath("/credenciais");
}

export async function updateCredential(id: string, input: CredentialInput) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("credenciais")
    .update({
      nome: input.nome,
      categoria_id: input.categoriaId,
      cliente_id: input.clienteId,
      usuario: input.usuario,
      senha: input.senha,
      url: input.url,
      notas: input.notas,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/credenciais");
}

export async function deleteCredential(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("credenciais").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/credenciais");
}

export async function createCredentialCategory(nome: string) {
  const supabase = await createClient();
  const nomeAparado = nome.trim();

  // Reaproveita uma categoria já existente com o mesmo nome (ignorando
  // maiúsculas/minúsculas e espaço nas pontas) em vez de duplicar — mesmo
  // padrão de createTaskArea em src/lib/actions/tasks.ts.
  const { data: existente } = await supabase
    .from("credencial_categorias")
    .select("id, nome")
    .ilike("nome", nomeAparado)
    .maybeSingle();
  if (existente) return existente;

  const { data: maxPos } = await supabase
    .from("credencial_categorias")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("credencial_categorias")
    .insert({ nome: nomeAparado, position: (maxPos?.position ?? 0) + 1 })
    .select("id, nome")
    .single();
  if (error) throw error;

  revalidatePath("/credenciais");
  return data;
}
```

- [ ] **Step 4: Verificação**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run build`
Expected: `npm test`, `npm run lint` e `npm run build` limpos. `npx tsc
--noEmit` pode acusar erros de tipo mencionando `credenciais` ou
`credencial_categorias` como tabelas não reconhecidas — isso é esperado
(ver a nota no topo desta task) e não bloqueia o Step 5.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0019_credenciais.sql src/lib/data/credenciais.ts src/lib/actions/credenciais.ts
git commit -m "feat: catálogo de Credenciais — migração, leitura e Server Actions"
```

---

### Task 2: Página, aba na sidebar, lista e formulário

**Files:**
- Create: `src/app/(app)/credenciais/page.tsx`
- Create: `src/components/credenciais/CredenciaisClient.tsx`
- Create: `src/components/credenciais/CredentialModal.tsx`
- Modify: `src/components/layout/Sidebar.tsx`

**Interfaces:**
- Consumes: `listCredentials`, `CredentialWithRelations`,
  `listCredentialCategories` (de `src/lib/data/credenciais.ts`),
  `createCredential`, `updateCredential`, `deleteCredential`,
  `createCredentialCategory` (de `src/lib/actions/credenciais.ts`) — todos
  da Task 1. `listClientsLite` de `src/lib/data/tasks.ts` (já existe,
  retorna `{ id, name, color, code_prefix }[]`, filtrado por clientes
  ativos).
- Produces: nada — última task do plano.

**Nota para quem for executar esta task:** a migração da Task 1 já deve
ter sido aplicada ao banco pelo controlador da sessão antes desta task
começar — `npx tsc --noEmit` deve compilar limpo contra `credenciais` e
`credencial_categorias` normalmente aqui. Se ainda aparecer erro de tipo
"não reconhecida", pare e avise — a migração não foi aplicada ainda, e não
é papel desta task aplicá-la.

- [ ] **Step 1: Página `/credenciais`**

Crie `src/app/(app)/credenciais/page.tsx`:

```tsx
import { PageBody } from "@/components/layout/PageBody";
import { CredenciaisClient } from "@/components/credenciais/CredenciaisClient";
import { listCredentials, listCredentialCategories } from "@/lib/data/credenciais";
import { listClientsLite } from "@/lib/data/tasks";

export default async function CredenciaisPage() {
  const [credentials, categories, clients] = await Promise.all([
    listCredentials(),
    listCredentialCategories(),
    listClientsLite(),
  ]);

  return (
    <PageBody>
      <CredenciaisClient credentials={credentials} categories={categories} clients={clients} />
    </PageBody>
  );
}
```

- [ ] **Step 2: `CredentialModal` — criar/editar, com cadastro inline de categoria**

Crie `src/components/credenciais/CredentialModal.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/Overlay";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { createCredential, updateCredential, createCredentialCategory } from "@/lib/actions/credenciais";
import { beginMutation } from "@/lib/realtime/mutation-gate";
import type { CredentialWithRelations } from "@/lib/data/credenciais";

type CategoriaLite = { id: string; nome: string };
type ClientLite = { id: string; name: string; color: string; code_prefix: string };

export function CredentialModal({
  credential,
  categories,
  clients,
  onClose,
}: {
  credential: CredentialWithRelations | null;
  categories: CategoriaLite[];
  clients: ClientLite[];
  onClose: () => void;
}) {
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();
  const [nome, setNome] = useState(credential?.nome ?? "");
  const [categoriasDisponiveis, setCategoriasDisponiveis] = useState(categories);
  const [categoriaId, setCategoriaId] = useState(
    credential?.categoria_id ?? categoriasDisponiveis[0]?.id ?? ""
  );
  const [mostrandoNovaCategoria, setMostrandoNovaCategoria] = useState(false);
  const [novaCategoriaNome, setNovaCategoriaNome] = useState("");
  const [criandoCategoria, startCategoriaTransition] = useTransition();
  const [erroCategoria, setErroCategoria] = useState<string | null>(null);
  const [clienteId, setClienteId] = useState(credential?.cliente_id ?? "");
  const [usuario, setUsuario] = useState(credential?.usuario ?? "");
  const [senha, setSenha] = useState(credential?.senha ?? "");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [url, setUrl] = useState(credential?.url ?? "");
  const [notas, setNotas] = useState(credential?.notas ?? "");

  function handleAddCategoria() {
    if (criandoCategoria || !novaCategoriaNome.trim()) return;
    setErroCategoria(null);
    startCategoriaTransition(async () => {
      const end = beginMutation();
      try {
        const nova = await createCredentialCategory(novaCategoriaNome.trim());
        setCategoriasDisponiveis((atual) =>
          atual.some((c) => c.id === nova.id) ? atual : [...atual, nova]
        );
        setCategoriaId(nova.id);
        setNovaCategoriaNome("");
        setMostrandoNovaCategoria(false);
      } catch {
        setErroCategoria("Não foi possível criar a categoria. Tente de novo.");
      } finally {
        end();
      }
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim() || !categoriaId) return;
    const dados = {
      nome: nome.trim(),
      categoriaId,
      clienteId: clienteId || null,
      usuario: usuario.trim() || null,
      senha: senha.trim() || null,
      url: url.trim() || null,
      notas: notas.trim() || null,
    };
    startTransition(async () => {
      const end = beginMutation();
      try {
        if (credential) {
          await updateCredential(credential.id, dados);
        } else {
          await createCredential(dados);
        }
        onClose();
      } catch {
        notify(
          "error",
          credential
            ? "Não foi possível salvar a credencial. Tente novamente."
            : "Não foi possível criar a credencial. Tente novamente."
        );
      } finally {
        end();
      }
    });
  }

  return (
    <Modal onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3.5 p-5.5">
        <h2 className="text-base font-medium">{credential ? "Editar credencial" : "Nova credencial"}</h2>

        <Field label="NOME">
          <Input
            autoFocus
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Hospedagem do site, Painel do cliente X…"
            required
          />
        </Field>

        <Field label="CATEGORIA">
          {mostrandoNovaCategoria ? (
            <div className="flex flex-col gap-1.5">
              <div className="flex gap-2">
                <Input
                  autoFocus
                  value={novaCategoriaNome}
                  onChange={(e) => setNovaCategoriaNome(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddCategoria();
                    }
                  }}
                  placeholder="Nome da nova categoria"
                />
                <Button
                  type="button"
                  disabled={criandoCategoria || !novaCategoriaNome.trim()}
                  onClick={handleAddCategoria}
                >
                  {criandoCategoria ? "Adicionando…" : "Adicionar"}
                </Button>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMostrandoNovaCategoria(false);
                  setNovaCategoriaNome("");
                  setErroCategoria(null);
                }}
                className="self-start text-[12px] text-faint hover:text-ink"
              >
                Cancelar e voltar à lista
              </button>
              {erroCategoria && <p className="text-[12px] text-red">{erroCategoria}</p>}
            </div>
          ) : (
            <Select
              value={categoriaId}
              onChange={(e) => {
                if (e.target.value === "__nova__") {
                  setMostrandoNovaCategoria(true);
                } else {
                  setCategoriaId(e.target.value);
                }
              }}
            >
              {categoriasDisponiveis.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
              <option value="__nova__">+ Nova categoria…</option>
            </Select>
          )}
        </Field>

        <Field label="CLIENTE VINCULADO">
          <Select value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
            <option value="">Nenhum (interna)</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="USUÁRIO">
            <Input value={usuario} onChange={(e) => setUsuario(e.target.value)} />
          </Field>
          <Field label="SENHA">
            <div className="flex gap-2">
              <Input
                type={mostrarSenha ? "text" : "password"}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="flex-1"
              />
              <Button type="button" variant="ghost" onClick={() => setMostrarSenha((v) => !v)}>
                {mostrarSenha ? "Ocultar" : "Mostrar"}
              </Button>
            </div>
          </Field>
        </div>

        <Field label="URL">
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
        </Field>

        <Field label="NOTAS">
          <Textarea rows={3} value={notas} onChange={(e) => setNotas(e.target.value)} />
        </Field>

        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending || mostrandoNovaCategoria}>
            {pending ? "Salvando…" : credential ? "Salvar" : "Criar credencial"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
```

Repare que o botão de submit já sai com `disabled={pending ||
mostrandoNovaCategoria}` e o input de nova categoria já sai com
`onKeyDown` interceptando Enter — não simplifique isso removendo essas
duas partes. Elas existem para evitar dois bugs já encontrados e
corrigidos num módulo irmão (`NewTaskModal.tsx`, campo Área do Kanban):
Enter no campo de categoria nova submetendo o formulário inteiro com a
categoria errada, e o botão principal ficando clicável enquanto o painel
de categoria nova está aberto e sem `<Select>` visível.

- [ ] **Step 3: `CredenciaisClient` — lista, filtro por categoria e exclusão**

Crie `src/components/credenciais/CredenciaisClient.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { Tag } from "@/components/ui/Tag";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { PageHeader } from "@/components/layout/PageBody";
import { useToast } from "@/components/ui/Toast";
import { deleteCredential } from "@/lib/actions/credenciais";
import { beginMutation } from "@/lib/realtime/mutation-gate";
import { CredentialModal } from "./CredentialModal";
import type { CredentialWithRelations } from "@/lib/data/credenciais";

type CategoriaLite = { id: string; nome: string };
type ClientLite = { id: string; name: string; color: string; code_prefix: string };

function CredentialCard({
  credential,
  onEdit,
}: {
  credential: CredentialWithRelations;
  onEdit: () => void;
}) {
  const { notify } = useToast();
  const [revelado, setRevelado] = useState(false);
  const [pending, startTransition] = useTransition();

  function excluir() {
    if (!confirm("Excluir credencial?")) return;
    startTransition(async () => {
      const end = beginMutation();
      try {
        await deleteCredential(credential.id);
      } catch {
        notify("error", "Não foi possível excluir a credencial. Tente novamente.");
      } finally {
        end();
      }
    });
  }

  return (
    <Card className="flex flex-col gap-2 p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[14px] font-medium">{credential.nome}</span>
        <Tag tone="neutral">{credential.categoria?.nome ?? "—"}</Tag>
      </div>
      <div className="text-[12px] text-muted">
        {credential.cliente ? credential.cliente.name : "Interna"}
      </div>
      {credential.usuario && (
        <div className="text-[13px]">
          <span className="text-faint">usuário: </span>
          {credential.usuario}
        </div>
      )}
      {credential.senha && (
        <div className="flex items-center gap-2 text-[13px]">
          <span className="text-faint">senha: </span>
          <span className="font-mono">{revelado ? credential.senha : "••••••••"}</span>
          <button
            type="button"
            onClick={() => setRevelado((r) => !r)}
            className="text-[11px] text-accent hover:underline"
          >
            {revelado ? "Ocultar" : "Mostrar"}
          </button>
        </div>
      )}
      {credential.url && (
        <a
          href={credential.url}
          target="_blank"
          rel="noreferrer"
          className="truncate text-[12px] text-accent hover:underline"
        >
          {credential.url}
        </a>
      )}
      {credential.notas && <div className="text-[12px] text-muted">{credential.notas}</div>}
      <div className="mt-1 flex items-center justify-end gap-3">
        <button type="button" onClick={onEdit} className="font-mono text-[11px] text-faint hover:text-accent">
          editar
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={excluir}
          className="font-mono text-[11px] text-faint hover:text-red"
        >
          excluir
        </button>
      </div>
    </Card>
  );
}

export function CredenciaisClient({
  credentials,
  categories,
  clients,
}: {
  credentials: CredentialWithRelations[];
  categories: CategoriaLite[];
  clients: ClientLite[];
}) {
  const [categoriaFiltro, setCategoriaFiltro] = useState("");
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<CredentialWithRelations | null>(null);

  const filtradas = categoriaFiltro
    ? credentials.filter((c) => c.categoria_id === categoriaFiltro)
    : credentials;

  return (
    <>
      <PageHeader
        title="Credenciais"
        actions={
          <>
            <Select
              value={categoriaFiltro}
              onChange={(e) => setCategoriaFiltro(e.target.value)}
              className="w-auto"
            >
              <option value="">Todas as categorias</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </Select>
            <Button
              onClick={() => {
                setEditando(null);
                setModalAberto(true);
              }}
            >
              + Nova credencial
            </Button>
          </>
        }
      />

      <div className="grid flex-1 grid-cols-1 gap-3 overflow-y-auto scrollbar-thin md:grid-cols-2 lg:grid-cols-3">
        {filtradas.map((cred) => (
          <CredentialCard
            key={cred.id}
            credential={cred}
            onEdit={() => {
              setEditando(cred);
              setModalAberto(true);
            }}
          />
        ))}
        {filtradas.length === 0 && (
          <div className="col-span-full flex flex-1 items-center justify-center rounded-xl border border-dashed border-border p-10 text-center text-[13px] text-faint">
            Nenhuma credencial cadastrada ainda.
          </div>
        )}
      </div>

      {modalAberto && (
        <CredentialModal
          credential={editando}
          categories={categories}
          clients={clients}
          onClose={() => setModalAberto(false)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 4: Nova aba na sidebar**

Em `src/components/layout/Sidebar.tsx`, troque:

```tsx
const businessItems: NavItem[] = [
  { href: "/painel", label: "Painel", icon: PainelIcon },
  { href: "/metas", label: "Metas", icon: TargetIcon },
  { href: "/playbooks", label: "Playbooks", icon: PlaybookIcon },
];
```

por:

```tsx
const businessItems: NavItem[] = [
  { href: "/painel", label: "Painel", icon: PainelIcon },
  { href: "/metas", label: "Metas", icon: TargetIcon },
  { href: "/playbooks", label: "Playbooks", icon: PlaybookIcon },
  { href: "/credenciais", label: "Credenciais", icon: CredentialsIcon },
];
```

E troque:

```tsx
function LogoutIcon() {
```

por:

```tsx
function CredentialsIcon() {
  return (
    <svg {...iconProps()}>
      <circle cx="5.4" cy="8" r="2.6" />
      <path d="M7.8 8h6M11 8v2.4M13 8v3.2" />
    </svg>
  );
}
function LogoutIcon() {
```

(ou seja, adicione a função `CredentialsIcon` logo antes de `LogoutIcon`,
sem remover nada que já existe).

- [ ] **Step 5: Verificação completa**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run build`
Expected: os quatro comandos limpos (169 testes — esta task não adiciona
nem remove teste, é módulo de UI sem infraestrutura de teste de
componente neste projeto). Confirme que a migração da Task 1 já foi
aplicada (o controlador da sessão faz isso entre as tasks) — se `tsc`
falhar por `credenciais`/`credencial_categorias` não existirem no tipo
`Database`, é sinal de que esse passo ainda não aconteceu.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/credenciais/page.tsx" src/components/credenciais/CredenciaisClient.tsx src/components/credenciais/CredentialModal.tsx src/components/layout/Sidebar.tsx
git commit -m "feat: módulo Credenciais — página, aba na sidebar, lista e formulário"
```
