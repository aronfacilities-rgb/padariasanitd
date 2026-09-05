import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Minus, Plus, Search, Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { brl, num, timeOnly } from "@/lib/format";
import { EmptyState, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_painel/comandas")({
  head: () => ({
    meta: [
      { title: "Comandas — Padaria Santiago" },
      {
        name: "description",
        content:
          "Abra comandas, lance itens pelo celular e envie para pagamento no caixa da Padaria Santiago.",
      },
      { property: "og:title", content: "Comandas — Padaria Santiago" },
      { property: "og:description", content: "Comandas abertas e lançamento de itens em tempo real." },
    ],
  }),
  component: ComandasPage,
});

type Status = "aberta" | "em_consumo" | "aguardando_pagamento" | "finalizada" | "cancelada";

type Comanda = {
  id: string;
  numero: number;
  status: Status;
  total: number;
  observacao: string | null;
  created_at: string;
};

type Item = {
  id: string;
  nome: string;
  quantidade: number;
  preco_unitario: number;
  observacao: string | null;
};

type ProdutoBusca = {
  id: string;
  nome: string;
  preco_venda: number;
  unidade: string;
  codigo_interno: string | null;
  codigo_barras: string | null;
};

const STATUS_LABEL: Record<Status, string> = {
  aberta: "Aberta",
  em_consumo: "Em consumo",
  aguardando_pagamento: "Aguardando pagamento",
  finalizada: "Finalizada",
  cancelada: "Cancelada",
};

function ComandasPage() {
  const qc = useQueryClient();
  const [abrindo, setAbrindo] = useState(false);
  const [selecionada, setSelecionada] = useState<string | null>(null);

  const comandas = useQuery({
    queryKey: ["comandas-abertas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commands")
        .select("id, numero, status, total, observacao, created_at")
        .in("status", ["aberta", "em_consumo", "aguardando_pagamento"])
        .order("numero");
      if (error) throw error;
      return (data ?? []) as Comanda[];
    },
    refetchInterval: 15000,
  });

  const abrir = useMutation({
    mutationFn: async (input: { numero: number; observacao: string | null }) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("commands")
        .insert({
          numero: input.numero,
          observacao: input.observacao,
          aberto_por: userData.user?.id ?? null,
          status: "aberta",
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      toast.success("Comanda aberta");
      setAbrindo(false);
      setSelecionada(id);
      void qc.invalidateQueries({ queryKey: ["comandas-abertas"] });
    },
    onError: (e: Error) => toast.error("Não foi possível abrir", { description: e.message }),
  });

  const total = useMemo(
    () => (comandas.data ?? []).reduce((s, c) => s + Number(c.total), 0),
    [comandas.data],
  );

  return (
    <>
      <PageHeader
        title="Comandas"
        description="Lance os pedidos direto do celular. O caixa recebe na hora."
        actions={
          <Dialog open={abrindo} onOpenChange={setAbrindo}>
            <DialogTrigger asChild>
              <Button className="h-11">
                <Plus className="size-4" /> Abrir comanda
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display">Abrir comanda</DialogTitle>
              </DialogHeader>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  const numero = Number(f.get("numero"));
                  if (!numero) {
                    toast.error("Informe o número da comanda");
                    return;
                  }
                  abrir.mutate({
                    numero,
                    observacao: String(f.get("observacao") ?? "") || null,
                  });
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="numero">Número da comanda</Label>
                  <Input
                    id="numero"
                    name="numero"
                    type="number"
                    inputMode="numeric"
                    min="1"
                    className="numeric h-12 text-lg"
                    autoFocus
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="observacao">Cliente / mesa (opcional)</Label>
                  <Input id="observacao" name="observacao" placeholder="Ex.: Mesa 3 — Dona Marta" />
                </div>
                <DialogFooter>
                  <Button type="submit" className="h-11" disabled={abrir.isPending}>
                    {abrir.isPending ? "Abrindo..." : "Abrir comanda"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="panel mb-4 flex items-center justify-between p-4">
        <p className="text-sm text-muted-foreground">
          {comandas.data?.length ?? 0} comanda(s) em andamento
        </p>
        <p className="numeric text-lg font-semibold">{brl(total)}</p>
      </div>

      {comandas.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : (comandas.data ?? []).length === 0 ? (
        <EmptyState
          title="Nenhuma comanda aberta"
          description="Toque em “Abrir comanda” para começar a lançar os pedidos."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(comandas.data ?? []).map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelecionada(c.id)}
              className={cn(
                "panel p-4 text-left transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                c.status === "aguardando_pagamento" && "border-primary",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="numeric font-display text-2xl font-semibold">#{c.numero}</span>
                <Badge variant={c.status === "aguardando_pagamento" ? "default" : "secondary"}>
                  {STATUS_LABEL[c.status]}
                </Badge>
              </div>
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {c.observacao ?? "Sem identificação"}
              </p>
              <div className="mt-3 flex items-end justify-between">
                <span className="text-xs text-muted-foreground">
                  aberta às {timeOnly(c.created_at)}
                </span>
                <span className="numeric text-lg font-semibold">{brl(c.total)}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      <ComandaSheet id={selecionada} onClose={() => setSelecionada(null)} />
    </>
  );
}

function ComandaSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");

  const comanda = useQuery({
    queryKey: ["comanda", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commands")
        .select("id, numero, status, total, observacao, created_at")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as Comanda;
    },
  });

  const itens = useQuery({
    queryKey: ["comanda-itens", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("command_items")
        .select("id, nome, quantidade, preco_unitario, observacao")
        .eq("command_id", id!)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as Item[];
    },
  });

  const produtos = useQuery({
    queryKey: ["produtos-ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, nome, preco_venda, unidade, codigo_interno, codigo_barras")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as ProdutoBusca[];
    },
  });

  function invalidar() {
    void qc.invalidateQueries({ queryKey: ["comanda", id] });
    void qc.invalidateQueries({ queryKey: ["comanda-itens", id] });
    void qc.invalidateQueries({ queryKey: ["comandas-abertas"] });
  }

  const adicionar = useMutation({
    mutationFn: async (p: ProdutoBusca) => {
      const { data: userData } = await supabase.auth.getUser();
      const existente = (itens.data ?? []).find((i) => i.nome === p.nome);
      if (existente) {
        const { error } = await supabase
          .from("command_items")
          .update({ quantidade: Number(existente.quantidade) + 1 })
          .eq("id", existente.id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from("command_items").insert({
        command_id: id!,
        product_id: p.id,
        nome: p.nome,
        quantidade: 1,
        preco_unitario: p.preco_venda,
        user_id: userData.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: invalidar,
    onError: (e: Error) => toast.error("Erro ao lançar item", { description: e.message }),
  });

  const alterarQtd = useMutation({
    mutationFn: async ({ item, delta }: { item: Item; delta: number }) => {
      const nova = Number(item.quantidade) + delta;
      if (nova <= 0) {
        const { error } = await supabase.from("command_items").delete().eq("id", item.id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase
        .from("command_items")
        .update({ quantidade: nova })
        .eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: invalidar,
    onError: (e: Error) => toast.error("Erro ao atualizar", { description: e.message }),
  });

  const definirQtd = useMutation({
    mutationFn: async ({ item, valor }: { item: Item; valor: number }) => {
      if (!Number.isFinite(valor) || valor <= 0) {
        const { error } = await supabase.from("command_items").delete().eq("id", item.id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase
        .from("command_items")
        .update({ quantidade: valor })
        .eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: invalidar,
    onError: (e: Error) => toast.error("Erro ao atualizar", { description: e.message }),
  });

  const remover = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from("command_items").delete().eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item removido");
      invalidar();
    },
    onError: (e: Error) => toast.error("Erro ao remover", { description: e.message }),
  });

  const mudarStatus = useMutation({
    mutationFn: async (status: Status) => {
      const { error } = await supabase.from("commands").update({ status }).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: (_d, status) => {
      toast.success(
        status === "cancelada" ? "Comanda cancelada" : "Comanda enviada para o caixa",
      );
      invalidar();
      onClose();
    },
    onError: (e: Error) => toast.error("Erro ao atualizar", { description: e.message }),
  });

  const salvarObs = useMutation({
    mutationFn: async (observacao: string) => {
      const { error } = await supabase
        .from("commands")
        .update({ observacao: observacao || null })
        .eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Observação salva");
      invalidar();
    },
    onError: (e: Error) => toast.error("Erro ao salvar", { description: e.message }),
  });

  const sugestoes = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return (produtos.data ?? []).slice(0, 12);
    return (produtos.data ?? [])
      .filter(
        (p) =>
          p.nome.toLowerCase().includes(termo) ||
          (p.codigo_interno ?? "").toLowerCase().includes(termo) ||
          (p.codigo_barras ?? "").toLowerCase().includes(termo),
      )
      .slice(0, 12);
  }, [produtos.data, busca]);

  return (
    <Sheet open={!!id} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="border-b border-border p-4">
          <SheetTitle className="font-display text-xl">
            Comanda #{comanda.data?.numero ?? "—"}
          </SheetTitle>
          <p className="text-sm text-muted-foreground">
            {comanda.data?.observacao ?? "Sem identificação"}
          </p>
        </SheetHeader>

        <div className="border-b border-border p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar produto para lançar"
              className="h-12 pl-9"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {sugestoes.map((p) => (
              <Button
                key={p.id}
                variant="outline"
                size="sm"
                className="h-10"
                onClick={() => adicionar.mutate(p)}
              >
                {p.nome}
                <span className="numeric text-muted-foreground">{brl(p.preco_venda)}</span>
              </Button>
            ))}
            {produtos.isLoading ? <Skeleton className="h-10 w-40" /> : null}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {itens.isLoading ? (
            <Skeleton className="h-24 rounded-xl" />
          ) : (itens.data ?? []).length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum item lançado ainda.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {(itens.data ?? []).map((i) => (
                <li key={i.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{i.nome}</p>
                    <p className="numeric text-xs text-muted-foreground">
                      {num(i.quantidade, 2)} × {brl(i.preco_unitario)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Diminuir"
                      onClick={() => alterarQtd.mutate({ item: i, delta: -1 })}
                    >
                      <Minus className="size-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Aumentar"
                      onClick={() => alterarQtd.mutate({ item: i, delta: 1 })}
                    >
                      <Plus className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Remover item"
                      onClick={() => remover.mutate(i.id)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                  <span className="numeric w-20 text-right font-semibold">
                    {brl(Number(i.quantidade) * Number(i.preco_unitario))}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-6 space-y-2">
            <Label htmlFor="obs-comanda">Observações</Label>
            <Textarea
              id="obs-comanda"
              defaultValue={comanda.data?.observacao ?? ""}
              onBlur={(e) => {
                if (e.target.value !== (comanda.data?.observacao ?? "")) {
                  salvarObs.mutate(e.target.value);
                }
              }}
              placeholder="Cliente, mesa, pedido especial..."
            />
          </div>
        </div>

        <div className="space-y-3 border-t border-border p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="numeric font-display text-2xl font-semibold">
              {brl(comanda.data?.total ?? 0)}
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              className="h-12"
              disabled={(itens.data ?? []).length === 0 || mudarStatus.isPending}
              onClick={() => mudarStatus.mutate("aguardando_pagamento")}
            >
              Enviar para o caixa
            </Button>
            <Button
              variant="outline"
              className="h-12"
              disabled={mudarStatus.isPending}
              onClick={() => mudarStatus.mutate("cancelada")}
            >
              Cancelar comanda
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
