export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    const missing = [
      !url && "NEXT_PUBLIC_SUPABASE_URL",
      !anonKey && "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    ]
      .filter(Boolean)
      .join(" e ");
    throw new Error(
      `Configuração do Supabase ausente: ${missing} não ${
        missing.includes(" e ") ? "estão definidas" : "está definida"
      }. Configure essa(s) variável(is) de ambiente (ex: Vercel → Project Settings → Environment Variables) e faça um novo deploy.`
    );
  }

  return { url, anonKey };
}
