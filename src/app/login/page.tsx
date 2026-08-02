"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AuraLogo } from "@/components/ui/AuraLogo";
import { Button } from "@/components/ui/Button";

type Mode = "login" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    const supabase = createClient();

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) {
        setError(error.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : error.message);
        return;
      }
      router.push("/inicio");
      router.refresh();
      return;
    }

    const { data, error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) {
      setError(
        error.message.includes("not authorized") || error.message.includes("Database error")
          ? "Este e-mail não está autorizado a criar uma conta no Aura Studio."
          : error.message
      );
      return;
    }
    if (data.session) {
      router.push("/inicio");
      router.refresh();
      return;
    }
    setNotice("Conta criada! Verifique seu e-mail para confirmar antes de entrar.");
    setMode("login");
  }

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-bone px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-2">
          <AuraLogo size={28} />
          <span className="text-xl font-semibold">aura</span>
        </div>

        <div className="rounded-xl border border-border bg-surface p-7 shadow-[0_1px_3px_rgba(30,30,28,.06)]">
          <h1 className="text-lg font-medium">
            {mode === "login" ? "Entrar" : "Criar sua conta"}
          </h1>
          <p className="mt-1 text-[13px] text-muted">
            {mode === "login"
              ? "Acesso restrito aos fundadores da Aura Studio."
              : "Só e-mails autorizados pelos fundadores podem criar conta."}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3.5">
            <div className="flex flex-col gap-1.5">
              <label className="label" htmlFor="email">E-MAIL</label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-lg border border-border bg-bone px-3 py-2.5 text-sm outline-none focus:border-accent"
                placeholder="voce@auastudio.com"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="label" htmlFor="password">SENHA</label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-lg border border-border bg-bone px-3 py-2.5 text-sm outline-none focus:border-accent"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="rounded-lg bg-red-tint px-3 py-2 text-[12.5px] text-red">{error}</p>
            )}
            {notice && (
              <p className="rounded-lg bg-accent-tint px-3 py-2 text-[12.5px] text-accent">{notice}</p>
            )}

            <Button type="submit" disabled={loading} className="mt-1 w-full">
              {loading ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar conta"}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setError(null);
              setNotice(null);
            }}
            className="mt-5 w-full text-center font-mono text-[11.5px] text-muted hover:text-ink"
          >
            {mode === "login" ? "Primeiro acesso? Criar conta →" : "← Já tenho conta"}
          </button>
        </div>
      </div>
    </div>
  );
}
