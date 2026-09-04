import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowDownCircle, ArrowUpCircle } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { brl, dateTime, num } from "@/lib/format";
import { EmptyState, PageHeader, StatCard } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_painel/estoque")({
  head: () => ({
    meta: [
      { title: "Estoque — Padaria Santiago" },
      {
        name: "description",
        content:
          "Entradas, baixas e histórico de movimentações de estoque dos produtos da Padaria Santiago.",
      },
      { property: "og:title", content: "Estoque — Padaria Santiago" },
      { property: "og:description", content: "Controle de estoque com alerta de itens em falta." },
    ],
  }),
  component: EstoquePage,
});

type Produto = {
  id: string;
  nome: string;
  unidade: string;
  custo: number;
  estoque_atual: number;
  estoque_minimo: number;
};

type Movimento = {
  id: string;
  product_id: string;
  tipo: "entrada" | "saida";
  quantidade: number;
  custo: number | null;
  motivo: string | null;
  fornecedor: string | null;
  observacao: string | null;
  created_at: string;
};

function EstoquePage() {
  const qc = useQueryClient();
  const [tipo, setTipo] = useState<"entrada" | "saida" | null>(null);

  const produtos = useQuery({
    queryKey: ["produtos-estoque"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, nome, unidade, custo, estoque_atual, estoque_minimo")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Produto[];
    },
  });

  const movimentos = useQuery({
    queryKey: ["movimentos-estoque"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_movements")
        .select(
          "id, product_id, tipo, quantidade, custo, motivo, fornecedor, observacao, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return (data ?? []) as Movimento[];
    },
  });

  const nomes = useMemo(() => {
    const map = new Map<string, string>();
    (produtos.data ?? []).forEach((p) => map.set(p.id, p.nome));
    return map;
  }, [produtos.data]);

  const registrar = useMutation({
    mutationFn: async (input: {
      product_id: string;
      tipo: "entrada" | "saida";
      quantidade: number;
      custo: number | null;
      motivo: string | null;
      fornecedor: string | null;
      observacao: string | null;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("inventory_movements")
        .insert({ ...input, user_id: userData.user?.id ?? null });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Movimentação registrada");
      setTipo(null);
      void qc.invalidateQueries({ queryKey: ["produtos-estoque"] });
      void qc.invalidateQueries({ queryKey: ["produtos"] });
      void qc.invalidateQueries({ queryKey: ["movimentos-estoque"] });
    },
    onError: (e: Error) => toast.error("Erro ao registrar", { description: e.message }),
  });

  const baixos = (produtos.data ?? []).filter(
    (p) => Number(p.estoque_minimo) > 0 && Number(p.estoque_atual) <= Number(p.estoque_minimo),
  );
  const valorEstoque = (produtos.data ?? []).reduce(
    (s, p) => s + Number(p.estoque_atual) * Number(p.custo),
    0,
  );

  return (
    <>
      <PageHeader
        title="Estoque"
        description="Registre compras, perdas e acompanhe o histórico de cada produto."
        actions={
          <div className="flex gap-2">
            <Button className="h-11" onClick={() => setTipo("entrada")}>
              <ArrowDownCircle className="size-4" /> Entrada
            </Button>
            <Button variant="outline" className="h-11" onClick={() => setTipo("saida")}>
              <ArrowUpCircle className="size-4" /> Baixa
            </Button>
          </div>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatCard label="Produtos ativos" value={String(produtos.data?.length ?? 0)} />
        <StatCard
          label="Itens em falta"
          value={String(baixos.length)}
          tone={baixos.length > 0 ? "danger" : "default"}
        />
        <StatCard label="Valor em estoque (custo)" value={brl(valorEstoque)} />
      </div>

      <Tabs defaultValue="posicao">
        <TabsList>
          <TabsTrigger value="posicao">Posição atual</TabsTrigger>
          <TabsTrigger value="historico">Movimentações</TabsTrigger>
        </TabsList>

        <TabsContent value="posicao" className="mt-4">
          {produtos.isLoading ? (
            <Skeleton className="h-40 rounded-xl" />
          ) : (produtos.data ?? []).length === 0 ? (
            <EmptyState
              title="Nenhum produto ativo"
              description="Cadastre produtos para controlar o estoque."
            />
          ) : (
            <div className="panel divide-y divide-border">
              {(produtos.data ?? []).map((p) => {
                const baixo =
                  Number(p.estoque_minimo) > 0 &&
                  Number(p.estoque_atual) <= Number(p.estoque_minimo);
                return (
                  <div key={p.id} className="flex items-center gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{p.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        mínimo {num(p.estoque_minimo, 2)} {p.unidade}
                      </p>
                    </div>
                    {baixo ? <Badge variant="destructive">Repor</Badge> : null}
                    <span className="numeric w-28 text-right font-semibold">
                      {num(p.estoque_atual, 2)} {p.unidade}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="historico" className="mt-4">
          {movimentos.isLoading ? (
            <Skeleton className="h-40 rounded-xl" />
          ) : (movimentos.data ?? []).length === 0 ? (
            <EmptyState
              title="Sem movimentações"
              description="As entradas e baixas de estoque aparecem aqui."
            />
          ) : (
            <div className="panel divide-y divide-border">
              {(movimentos.data ?? []).map((m) => (
                <div key={m.id} className="flex flex-wrap items-center gap-3 p-4">
                  <Badge variant={m.tipo === "entrada" ? "default" : "secondary"}>
                    {m.tipo === "entrada" ? "Entrada" : "Baixa"}
                  </Badge>
                  <div className="min-w-40 flex-1">
                    <p className="font-medium">{nomes.get(m.product_id) ?? "Produto removido"}</p>
                    <p className="text-xs text-muted-foreground">
                      {dateTime(m.created_at)}
                      {m.motivo ? ` · ${m.motivo}` : ""}
                      {m.fornecedor ? ` · ${m.fornecedor}` : ""}
                    </p>
                  </div>
                  <span className="numeric font-semibold">
                    {m.tipo === "entrada" ? "+" : "−"}
                    {num(m.quantidade, 2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!tipo} onOpenChange={(v) => !v && setTipo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">
              {tipo === "entrada" ? "Entrada de estoque" : "Baixa de estoque"}
            </DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!tipo) return;
              const f = new FormData(e.currentTarget);
              const productId = String(f.get("product_id") ?? "");
              const quantidade = Number(f.get("quantidade") ?? 0);
              if (!productId || quantidade <= 0) {
                toast.error("Selecione o produto e informe a quantidade");
                return;
              }
              registrar.mutate({
                product_id: productId,
                tipo,
                quantidade,
                custo: f.get("custo") ? Number(f.get("custo")) : null,
                motivo: String(f.get("motivo") ?? "") || null,
                fornecedor: String(f.get("fornecedor") ?? "") || null,
                observacao: String(f.get("observacao") ?? "") || null,
              });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="product_id">Produto</Label>
              <Select name="product_id">
                <SelectTrigger id="product_id" className="h-12">
                  <SelectValue placeholder="Selecione o produto" />
                </SelectTrigger>
                <SelectContent>
                  {(produtos.data ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="quantidade">Quantidade</Label>
                <Input
                  id="quantidade"
                  name="quantidade"
                  type="number"
                  step="0.001"
                  min="0"
                  className="numeric h-12"
                  autoFocus
                  required
                />
              </div>
              {tipo === "entrada" ? (
                <div className="space-y-2">
                  <Label htmlFor="custo">Custo unitário</Label>
                  <Input
                    id="custo"
                    name="custo"
                    type="number"
                    step="0.01"
                    min="0"
                    className="numeric h-12"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="motivo">Motivo</Label>
                  <Input id="motivo" name="motivo" placeholder="Perda, quebra, consumo interno" />
                </div>
              )}
            </div>
            {tipo === "entrada" ? (
              <div className="space-y-2">
                <Label htmlFor="fornecedor">Fornecedor</Label>
                <Input id="fornecedor" name="fornecedor" />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="observacao">Observação</Label>
              <Textarea id="observacao" name="observacao" />
            </div>
            <DialogFooter>
              <Button type="submit" className="h-12 w-full" disabled={registrar.isPending}>
                {registrar.isPending ? "Registrando..." : "Registrar movimentação"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
