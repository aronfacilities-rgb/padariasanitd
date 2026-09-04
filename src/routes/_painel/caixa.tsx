import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { LockKeyhole, Unlock } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { brl, dateTime } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { EmptyState, PageHeader, StatCard } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_painel/caixa")({
  head: () => ({
    meta: [
      { title: "Caixa — Padaria Santiago" },
      {
        name: "description",
        content:
          "Abertura e fechamento de caixa da Padaria Santiago com conferência de valores e diferença.",
      },
      { property: "og:title", content: "Caixa — Padaria Santiago" },
      { property: "og:description", content: "Controle de abertura, sangria e fechamento do caixa." },
    ],
  }),
  component: CaixaPage,
});

type Caixa = {
  id: string;
  status: string;
  valor_inicial: number;
  valor_esperado: number | null;
  valor_informado: number | null;
  diferenca: number | null;
  observacao: string | null;
  aberto_em: string;
  fechado_em: string | null;
};

function CaixaPage() {
  const qc = useQueryClient();
  const { isManager } = useAuth();
  const [abrindo, setAbrindo] = useState(false);
  const [fechando, setFechando] = useState(false);

  const caixa = useQuery({
    queryKey: ["caixa-aberto"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_registers")
        .select(
          "id, status, valor_inicial, valor_esperado, valor_informado, diferenca, observacao, aberto_em, fechado_em",
        )
        .eq("status", "aberto")
        .order("aberto_em", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as Caixa | null;
    },
  });

  const historico = useQuery({
    queryKey: ["caixa-historico"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_registers")
        .select(
          "id, status, valor_inicial, valor_esperado, valor_informado, diferenca, observacao, aberto_em, fechado_em",
        )
        .eq("status", "fechado")
        .order("fechado_em", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as Caixa[];
    },
  });

  const caixaId = caixa.data?.id ?? null;

  const movimento = useQuery({
    queryKey: ["caixa-movimento", caixaId],
    enabled: !!caixaId,
    queryFn: async () => {
      const [vendas, entradas, recebimentos] = await Promise.all([
        supabase.from("sales").select("id, total").eq("cash_register_id", caixaId!),
        supabase
          .from("financial_entries")
          .select("tipo, valor, forma_pagamento")
          .eq("cash_register_id", caixaId!),
        supabase.from("receivable_payments").select("valor, forma").eq("cash_register_id", caixaId!),
      ]);
      if (vendas.error) throw vendas.error;
      if (entradas.error) throw entradas.error;
      if (recebimentos.error) throw recebimentos.error;

      const saleIds = (vendas.data ?? []).map((v) => v.id);
      let pagamentos: { forma: string; valor: number }[] = [];
      if (saleIds.length > 0) {
        const { data, error } = await supabase
          .from("payments")
          .select("forma, valor")
          .in("sale_id", saleIds);
        if (error) throw error;
        pagamentos = (data ?? []) as { forma: string; valor: number }[];
      }
      return {
        vendasTotal: (vendas.data ?? []).reduce((s, v) => s + Number(v.total), 0),
        pagamentos,
        lancamentos: (entradas.data ?? []) as {
          tipo: string;
          valor: number;
          forma_pagamento: string;
        }[],
        recebimentos: (recebimentos.data ?? []) as { valor: number; forma: string }[],
      };
    },
  });

  const resumo = useMemo(() => {
    const m = movimento.data;
    const inicial = Number(caixa.data?.valor_inicial ?? 0);
    if (!m) {
      return { inicial, dinheiro: inicial, vendas: 0, entradas: 0, saidas: 0, esperado: inicial };
    }
    const dinheiroVendas = m.pagamentos
      .filter((p) => p.forma === "dinheiro")
      .reduce((s, p) => s + Number(p.valor), 0);
    const dinheiroRecebidos = m.recebimentos
      .filter((r) => r.forma === "dinheiro")
      .reduce((s, r) => s + Number(r.valor), 0);
    const entradas = m.lancamentos
      .filter((l) => l.tipo === "entrada")
      .reduce((s, l) => s + Number(l.valor), 0);
    const saidas = m.lancamentos
      .filter((l) => l.tipo === "saida")
      .reduce((s, l) => s + Number(l.valor), 0);
    const dinheiroEntradas = m.lancamentos
      .filter((l) => l.tipo === "entrada" && l.forma_pagamento === "dinheiro")
      .reduce((s, l) => s + Number(l.valor), 0);
    const dinheiroSaidas = m.lancamentos
      .filter((l) => l.tipo === "saida" && l.forma_pagamento === "dinheiro")
      .reduce((s, l) => s + Number(l.valor), 0);
    return {
      inicial,
      vendas: m.vendasTotal,
      entradas,
      saidas,
      dinheiro: inicial + dinheiroVendas + dinheiroRecebidos + dinheiroEntradas - dinheiroSaidas,
      esperado: inicial + dinheiroVendas + dinheiroRecebidos + dinheiroEntradas - dinheiroSaidas,
    };
  }, [movimento.data, caixa.data]);

  const abrir = useMutation({
    mutationFn: async (input: { valor: number; observacao: string | null }) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("cash_registers").insert({
        valor_inicial: input.valor,
        observacao: input.observacao,
        status: "aberto",
        aberto_por: userData.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Caixa aberto");
      setAbrindo(false);
      void qc.invalidateQueries({ queryKey: ["caixa-aberto"] });
    },
    onError: (e: Error) => toast.error("Erro ao abrir o caixa", { description: e.message }),
  });

  const fechar = useMutation({
    mutationFn: async (input: { informado: number; observacao: string | null }) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("cash_registers")
        .update({
          status: "fechado",
          fechado_em: new Date().toISOString(),
          fechado_por: userData.user?.id ?? null,
          valor_esperado: resumo.esperado,
          valor_informado: input.informado,
          diferenca: input.informado - resumo.esperado,
          observacao: input.observacao,
        })
        .eq("id", caixaId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Caixa fechado");
      setFechando(false);
      void qc.invalidateQueries({ queryKey: ["caixa-aberto"] });
      void qc.invalidateQueries({ queryKey: ["caixa-historico"] });
    },
    onError: (e: Error) => toast.error("Erro ao fechar o caixa", { description: e.message }),
  });

  return (
    <>
      <PageHeader
        title="Caixa"
        description="Abertura, conferência e fechamento do caixa do dia."
        actions={
          caixa.isLoading ? null : caixa.data ? (
            <Button className="h-11" onClick={() => setFechando(true)}>
              <LockKeyhole className="size-4" /> Fechar caixa
            </Button>
          ) : (
            <Button className="h-11" onClick={() => setAbrindo(true)}>
              <Unlock className="size-4" /> Abrir caixa
            </Button>
          )
        }
      />

      {caixa.isLoading ? (
        <Skeleton className="h-32 rounded-xl" />
      ) : caixa.data ? (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Valor inicial" value={brl(resumo.inicial)} />
            <StatCard label="Vendas no caixa" value={brl(resumo.vendas)} tone="success" />
            <StatCard label="Entradas / Saídas" value={`${brl(resumo.entradas)} / ${brl(resumo.saidas)}`} />
            <StatCard
              label="Dinheiro esperado"
              value={brl(resumo.esperado)}
              hint="Conferir na gaveta ao fechar"
            />
          </div>
          <div className="panel p-4">
            <p className="text-sm text-muted-foreground">
              Caixa aberto em {dateTime(caixa.data.aberto_em)}
            </p>
            {caixa.data.observacao ? (
              <p className="mt-1 text-sm">{caixa.data.observacao}</p>
            ) : null}
          </div>
        </>
      ) : (
        <EmptyState
          title="Caixa fechado"
          description="Abra o caixa informando o valor inicial em dinheiro para liberar o PDV."
        />
      )}

      {isManager ? (
        <section className="mt-6">
          <h2 className="mb-3 font-display text-lg font-semibold">Últimos fechamentos</h2>
          {historico.isLoading ? (
            <Skeleton className="h-24 rounded-xl" />
          ) : (historico.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum fechamento registrado.</p>
          ) : (
            <div className="panel divide-y divide-border">
              {(historico.data ?? []).map((h) => {
                const dif = Number(h.diferenca ?? 0);
                return (
                  <div key={h.id} className="flex flex-wrap items-center gap-3 p-4">
                    <div className="min-w-40 flex-1">
                      <p className="font-medium">{dateTime(h.fechado_em ?? h.aberto_em)}</p>
                      <p className="text-xs text-muted-foreground">
                        aberto em {dateTime(h.aberto_em)}
                      </p>
                    </div>
                    <div className="numeric text-right text-sm">
                      <p>esperado {brl(h.valor_esperado ?? 0)}</p>
                      <p className="text-muted-foreground">informado {brl(h.valor_informado ?? 0)}</p>
                    </div>
                    <Badge variant={dif === 0 ? "secondary" : dif > 0 ? "default" : "destructive"}>
                      {dif === 0 ? "Conferido" : `${dif > 0 ? "Sobra" : "Falta"} ${brl(Math.abs(dif))}`}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      <Dialog open={abrindo} onOpenChange={setAbrindo}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Abrir caixa</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              abrir.mutate({
                valor: Number(f.get("valor") ?? 0),
                observacao: String(f.get("observacao") ?? "") || null,
              });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="valor">Valor inicial em dinheiro</Label>
              <Input
                id="valor"
                name="valor"
                type="number"
                step="0.01"
                min="0"
                className="numeric h-12 text-lg"
                autoFocus
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="observacao">Observação</Label>
              <Textarea id="observacao" name="observacao" placeholder="Ex.: troco conferido" />
            </div>
            <DialogFooter>
              <Button type="submit" className="h-12 w-full" disabled={abrir.isPending}>
                {abrir.isPending ? "Abrindo..." : "Abrir caixa"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={fechando} onOpenChange={setFechando}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Fechar caixa</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              fechar.mutate({
                informado: Number(f.get("informado") ?? 0),
                observacao: String(f.get("observacao") ?? "") || null,
              });
            }}
          >
            <div className="flex items-center justify-between rounded-lg bg-muted p-3">
              <span className="text-sm text-muted-foreground">Dinheiro esperado</span>
              <span className="numeric text-xl font-semibold">{brl(resumo.esperado)}</span>
            </div>
            <div className="space-y-2">
              <Label htmlFor="informado">Dinheiro contado na gaveta</Label>
              <Input
                id="informado"
                name="informado"
                type="number"
                step="0.01"
                min="0"
                className="numeric h-12 text-lg"
                autoFocus
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="obs-fechamento">Observação do fechamento</Label>
              <Textarea id="obs-fechamento" name="observacao" />
            </div>
            <DialogFooter>
              <Button type="submit" className="h-12 w-full" disabled={fechar.isPending}>
                {fechar.isPending ? "Fechando..." : "Confirmar fechamento"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
