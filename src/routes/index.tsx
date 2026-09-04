import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Croissant, Loader2 } from "lucide-react";

import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Padaria Santiago — Gestão, Comandas e PDV" },
      {
        name: "description",
        content:
          "Sistema da Padaria Santiago para comandas no celular, PDV rápido, caixa, estoque, fiado, ponto digital e relatórios.",
      },
      { property: "og:title", content: "Padaria Santiago — Gestão, Comandas e PDV" },
      {
        property: "og:description",
        content: "Gestão completa da padaria: comandas, PDV, caixa, estoque, fiado e ponto.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const { loading, session, isManager } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      void navigate({ to: "/auth" });
      return;
    }
    void navigate({ to: isManager ? "/dashboard" : "/comandas" });
  }, [loading, session, isManager, navigate]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
        <Croissant className="size-7" />
      </span>
      <h1 className="font-display text-2xl">Padaria Santiago</h1>
      <Loader2 className="size-5 animate-spin text-muted-foreground" />
    </main>
  );
}
