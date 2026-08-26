import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.types";
import { getSupabaseEnv } from "./env";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const { url: supabaseUrl, anonKey } = getSupabaseEnv();

  const supabase = createServerClient<Database>(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAuthRoute = path.startsWith("/login");
  const isPublicAsset = path.startsWith("/_next") || path.startsWith("/favicon");
  // O sincronizador do ClubCut não tem usuário POR DEFINIÇÃO: quem chama é o
  // n8n, de madrugada, e a autenticação dele é o token conferido dentro do
  // próprio handler. Sem esta exceção o POST viraria um 307 para /login e o
  // envio sumiria em silêncio — com 200 na resposta, que é o pior jeito de
  // falhar. Prefixo estreito de propósito: não é "/api", é esta rota.
  const isSincronizador = path.startsWith("/api/clubcut/");

  if (!user && !isAuthRoute && !isPublicAsset && !isSincronizador) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    return NextResponse.redirect(redirectUrl);
  }

  if (user && isAuthRoute) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/hoje";
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}
