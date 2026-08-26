import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * O cliente de SERVIÇO: escreve sem sessão de usuário e passa por cima da
 * RLS. Existe por um motivo só — o sincronizador do ClubCut escreve à noite,
 * quando não há ninguém logado, e as políticas deste banco exigem
 * `auth.uid() is not null`.
 *
 * REGRA: só `src/app/api/clubcut/uso/route.ts` importa este módulo, e só
 * depois de conferir o token do envio. Tudo o mais usa `server.ts`, que
 * carrega a sessão de quem está na tela e continua sujeito à RLS. Um segundo
 * importador aqui é sinal de que alguém está contornando a RLS por
 * conveniência, não por necessidade.
 *
 * A chave nunca chega ao navegador: o nome não tem o prefixo
 * `NEXT_PUBLIC_`, então o Next se recusa a embutí-la no pacote do cliente.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    const faltando = [!url && "NEXT_PUBLIC_SUPABASE_URL", !serviceKey && "SUPABASE_SERVICE_ROLE_KEY"]
      .filter(Boolean)
      .join(" e ");
    throw new Error(
      `Configuração do sincronizador ausente: ${faltando}. Defina em Vercel → Project Settings → Environment Variables.`
    );
  }

  return createSupabaseClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
