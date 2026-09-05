import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Logo } from "@/components/logo";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Padaria Santiago" },
      {
        name: "description",
        content:
          "Acesso ao sistema de gestão da Padaria Santiago: comandas, PDV, caixa, estoque e ponto digital.",
      },
      { property: "og:title", content: "Entrar — Padaria Santiago" },
      {
        property: "og:description",
        content: "Acesso restrito à equipe da Padaria Santiago.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [lembrar, setLembrar] = useState(true);

  useEffect(() => {
    if (!loading && session) void navigate({ to: "/dashboard" });
  }, [loading, session, navigate]);

  async function entrar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: String(form.get("email") ?? "").trim(),
      password: String(form.get("senha") ?? ""),
    });
    setBusy(false);
    if (error) {
      toast.error("Não foi possível entrar", { description: error.message });
      return;
    }
    if (lembrar) localStorage.setItem("santiago:ultimo-usuario", String(form.get("email") ?? ""));
    toast.success("Bem-vindo à Padaria Santiago");
    await router.invalidate();
    void navigate({ to: "/dashboard" });
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden flex-col justify-between bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-3">
          <Logo className="h-24 rounded-xl bg-card p-2" />
          <div>
            <p className="font-display text-lg leading-tight">Padaria Santiago</p>
            <p className="text-xs text-sidebar-foreground/70">Gestão, comandas e PDV</p>
          </div>
        </div>
        <div className="max-w-md space-y-4">
          <h1 className="font-display text-4xl leading-tight">
            Do balcão ao caixa, tudo no mesmo lugar.
          </h1>
          <p className="text-sm text-sidebar-foreground/75">
            Abra comandas pelo celular, feche a venda no caixa, controle estoque, fiado, ponto e
            relatórios com rastreabilidade completa.
          </p>
        </div>
        <p className="text-xs text-sidebar-foreground/60">Acesso restrito à equipe.</p>
      </section>

      <section className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Logo className="h-12" />
            <p className="font-display text-lg">Padaria Santiago</p>
          </div>

          <h2 className="font-display text-2xl">Acessar o sistema</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Use o e-mail e a senha cadastrados pela administração.
          </p>

          <form onSubmit={entrar} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-email">Usuário / e-mail</Label>
              <Input
                id="login-email"
                name="email"
                type="email"
                autoComplete="username"
                required
                className="h-12"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-senha">Senha</Label>
              <Input
                id="login-senha"
                name="senha"
                type="password"
                autoComplete="current-password"
                required
                className="h-12"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Checkbox
                checked={lembrar}
                onCheckedChange={(v) => setLembrar(v === true)}
                aria-label="Lembrar acesso"
              />
              Lembrar acesso
            </label>
            <Button type="submit" className="h-12 w-full text-base" disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : "Entrar"}
            </Button>
          </form>
        </div>
      </section>
    </main>
  );
}
