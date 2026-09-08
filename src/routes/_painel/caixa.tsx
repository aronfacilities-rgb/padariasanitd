import { createFileRoute } from "@tanstack/react-router";
import { CaixaPage } from "@/components/caixa-page";

export const Route = createFileRoute("/_painel/caixa")({
  head: () => ({
    meta: [
      { title: "Caixa — Padaria Santiago" },
      { name: "description", content: "Abertura e fechamento de caixa da Padaria Santiago com conferência de valores e diferença." },
      { property: "og:title", content: "Caixa — Padaria Santiago" },
      { property: "og:description", content: "Controle de abertura, sangria e fechamento do caixa." },
    ],
  }),
  component: CaixaPage,
});
