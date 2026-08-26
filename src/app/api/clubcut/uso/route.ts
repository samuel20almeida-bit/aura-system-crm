import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { lerEnvio } from "@/lib/clubcut";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * A porta por onde o uso do ClubCut entra no CRM.
 *
 * É o único ponto do sistema que aceita escrita sem sessão de usuário, então
 * a ordem aqui é deliberada: token primeiro, formato depois, banco por
 * último. Nada toca o Supabase antes de o token conferir.
 *
 * `nodejs` e não `edge`: `timingSafeEqual` é do runtime do Node.
 */
export const runtime = "nodejs";
// O envio traz números novos toda noite; guardar resposta aqui não faz
// sentido nenhum e mascararia falha de sincronismo.
export const dynamic = "force-dynamic";

/**
 * Comparação de tempo constante. Um `===` vaza, pelo tempo de resposta, o
 * tamanho do prefixo acertado — com um endpoint público e tentativas
 * ilimitadas, isso é um caminho real para descobrir o token caractere a
 * caractere.
 */
function tokenConfere(recebido: string, esperado: string): boolean {
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  // `timingSafeEqual` estoura se os tamanhos diferem; comparar o tamanho
  // antes vaza só o comprimento, que não ajuda a adivinhar o conteúdo.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const esperado = process.env.CLUBCUT_SYNC_TOKEN;
  if (!esperado) {
    console.error("[clubcut] CLUBCUT_SYNC_TOKEN não está definido — envio recusado");
    // 503 e não 401: o problema é nosso, não de quem chamou, e o n8n deve
    // tratar como "tente de novo depois", não como "minha credencial mudou".
    return NextResponse.json({ erro: "sincronizador não configurado" }, { status: 503 });
  }

  const cabecalho = request.headers.get("authorization") ?? "";
  const enviado = cabecalho.startsWith("Bearer ") ? cabecalho.slice(7) : "";
  if (!enviado || !tokenConfere(enviado, esperado)) {
    return NextResponse.json({ erro: "token inválido" }, { status: 401 });
  }

  let bruto: unknown;
  try {
    bruto = await request.json();
  } catch {
    return NextResponse.json({ erro: "corpo não é JSON válido" }, { status: 400 });
  }

  const leitura = lerEnvio(bruto);
  if (!leitura.ok) {
    return NextResponse.json({ erro: leitura.erro }, { status: 400 });
  }
  const { saloes, uso } = leitura.envio;

  // Mesmo tratamento do token ausente, e pelo mesmo motivo: falta de
  // configuração é problema nosso, não do chamador. Sem o `try`, a exceção
  // viraria um 500 genérico e o n8n registraria "erro do servidor" em vez de
  // "ainda não configurado".
  let supabase: ReturnType<typeof createServiceClient>;
  try {
    supabase = createServiceClient();
  } catch (e) {
    console.error("[clubcut] sincronizador sem configuração:", e);
    return NextResponse.json({ erro: "sincronizador não configurado" }, { status: 503 });
  }
  // Um carimbo só para o envio inteiro: linhas do mesmo POST com horários
  // diferentes por milissegundos sugeririam uma ordem que não existe.
  const agora = new Date().toISOString();

  // Os salões primeiro, sempre: a chave estrangeira de `clubcut_uso_diario`
  // aponta para cá, e um salão novo que aparecesse só no uso derrubaria o
  // envio inteiro.
  if (saloes.length > 0) {
    const { error } = await supabase.from("clubcut_saloes").upsert(
      saloes.map((s) => ({ ...s, sincronizado_em: agora })),
      { onConflict: "salon_id" }
    );
    if (error) {
      console.error("[clubcut] falha ao gravar salões:", error);
      return NextResponse.json({ erro: "falha ao gravar salões" }, { status: 500 });
    }
  }

  if (uso.length > 0) {
    // `onConflict` na chave composta é o que torna o reenvio seguro: mandar
    // a mesma janela duas vezes sobrescreve, não duplica. É o que permite ao
    // n8n reprocessar os últimos dias sem coordenação nenhuma com o CRM.
    // `recebido_em` explícito: no upsert que ATUALIZA, o `default now()` da
    // coluna não roda, e a linha ficaria com a data do primeiro envio para
    // sempre — um reprocessamento pareceria dado velho.
    const { error } = await supabase
      .from("clubcut_uso_diario")
      .upsert(
        uso.map((u) => ({ ...u, recebido_em: agora })),
        { onConflict: "salon_id,dia" }
      );
    if (error) {
      console.error("[clubcut] falha ao gravar uso:", error);
      return NextResponse.json({ erro: "falha ao gravar uso" }, { status: 500 });
    }
  }

  return NextResponse.json({ saloes: saloes.length, uso: uso.length });
}
