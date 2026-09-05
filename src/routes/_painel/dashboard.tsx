import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, ClipboardList, Receipt, TrendingUp, Wallet } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { brl, num } from "@/lib/format";
import { Logo } from "@/components/logo";
import { PageHeader, StatCard } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_painel/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Padaria Santiago" },
      {
        name: "description",
        content:
          "Visão geral da padaria: vendas do dia, ticket médio, comandas abertas, caixa, fiado e estoque baixo.",
      },
      { property: "og:title", content: "Dashboard — Padaria Santiago" },
      { property: "og:description", content: "Acompanhe vendas, caixa, fiado e estoque." },
    ],
  }),
  component: Dashboard,
});

type Periodo = "hoje" | "ontem" | "semana" | "mes";

const PERIODOS: { key: Periodo; label: string }[] = [
  { key: "hoje", label: "Hoje" },
  { key: "ontem", label: "Ontem" },
  { key: "semana", label: "Semana" },
  { key: "mes", label: "Mês" },
];

function rangeFor(periodo: Periodo): { from: Date; to: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (periodo === "hoje") return { from: start, to: now };
  if (periodo === "ontem") {
    const from = new Date(start);
    from.setDate(from.getDate() - 1);
    return { from, to: start };
  }
  if (periodo === "semana") {
    const from = new Date(start);
    from.setDate(from.getDate() - 6);
    return { from, to: now };
  }
  return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
}

type SaleRow = { id: string; total: number; created_at: string };
type PaymentRow = { forma: string; valor: number; created_at: string };
type ItemRow = { nome: string; quantidade: number; total: number; created_at: string };

function Dashboard() {
  const [periodo, setPeriodo] = useState<Periodo>("hoje");
  const { from, to } = useMemo(() => rangeFor(periodo), [periodo]);
  const mesInicio = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
  }, []);

  const vendas = useQuery({
    queryKey: ["dash-vendas", from.toISOString(), to.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("id, total, created_at")
        .eq("status", "finalizada")
        .gte("created_at", from.toISOString())
        .lte("created_at", to.toISOString());
      if (error) throw error;
      return (data ?? []) as SaleRow[];
    },
  });

  const vendasMes = useQuery({
    queryKey: ["dash-vendas-mes", mesInicio],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("id, total, created_at")
        .eq("status", "finalizada")
        .gte("created_at", mesInicio);
      if (error) throw error;
      return (data ?? []) as SaleRow[];
    },
  });

  const pagamentos = useQuery({
    queryKey: ["dash-pagamentos", from.toISOString(), to.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("forma, valor, created_at")
        .gte("created_at", from.toISOString())
        .lte("created_at", to.toISOString());
      if (error) throw error;
      return (data ?? []) as PaymentRow[];
    },
  });

  const itens = useQuery({
    queryKey: ["dash-itens", from.toISOString(), to.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sale_items")
        .select("nome, quantidade, total, created_at")
        .gte("created_at", from.toISOString())
        .lte("created_at", to.toISOString());
      if (error) throw error;
      return (data ?? []) as ItemRow[];
    },
  });

  const comandasAbertas = useQuery({
    queryKey: ["dash-comandas-abertas"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("commands")
        .select("id", { count: "exact", head: true })
        .in("status", ["aberta", "em_consumo", "aguardando_pagamento"]);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const fiado = useQuery({
    queryKey: ["dash-fiado"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts_receivable")
        .select("valor, valor_pago, vencimento, status")
        .neq("status", "pago");
      if (error) throw error;
      return (data ?? []) as {
        valor: number;
        valor_pago: number;
        vencimento: string | null;
        status: string;
      }[];
    },
  });

  const caixa = useQuery({
    queryKey: ["dash-caixa"],
    queryFn: async () => {
      const { data: reg, error } = await supabase
        .from("cash_registers")
        .select("id, valor_inicial, aberto_em")
        .eq("status", "aberto")
        .order("aberto_em", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!reg) return null;
      const [{ data: pays }, { data: entries }] = await Promise.all([
        supabase.from("payments").select("forma, valor, sale_id").gte("created_at", reg.aberto_em),
        supabase
          .from("financial_entries")
          .select("tipo, valor, forma_pagamento")
          .eq("cash_register_id", reg.id),
      ]);
      const dinheiroVendas = (pays ?? [])
        .filter((p) => p.forma === "dinheiro")
        .reduce((s, p) => s + Number(p.valor), 0);
      const entradas = (entries ?? [])
        .filter((e) => e.tipo === "entrada" && e.forma_pagamento === "dinheiro")
        .reduce((s, e) => s + Number(e.valor), 0);
      const saidas = (entries ?? [])
        .filter((e) => e.tipo === "saida" && e.forma_pagamento === "dinheiro")
        .reduce((s, e) => s + Number(e.valor), 0);
      return {
        total: Number(reg.valor_inicial) + dinheiroVendas + entradas - saidas,
      };
    },
  });

  const estoqueBaixo = useQuery({
    queryKey: ["dash-estoque-baixo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, nome, estoque_atual, estoque_minimo")
        .eq("ativo", true);
      if (error) throw error;
      return (data ?? []).filter(
        (p) => Number(p.estoque_atual) <= Number(p.estoque_minimo) && Number(p.estoque_minimo) > 0,
      );
    },
  });

  const totalPeriodo = (vendas.data ?? []).reduce((s, v) => s + Number(v.total), 0);
  const totalMes = (vendasMes.data ?? []).reduce((s, v) => s + Number(v.total), 0);
  const qtdVendas = (vendas.data ?? []).length;
  const ticket = qtdVendas > 0 ? totalPeriodo / qtdVendas : 0;
  const produtosVendidos = (itens.data ?? []).reduce((s, i) => s + Number(i.quantidade), 0);
  const fiadoAberto = (fiado.data ?? []).reduce(
    (s, f) => s + (Number(f.valor) - Number(f.valor_pago)),
    0,
  );
  const hojeStr = new Date().toISOString().slice(0, 10);
  const fiadoVencido = (fiado.data ?? [])
    .filter((f) => f.vencimento && f.vencimento < hojeStr)
    .reduce((s, f) => s + (Number(f.valor) - Number(f.valor_pago)), 0);

  const vendasPorDia = useMemo(() => {
    const map = new Map<string, number>();
    for (const v of vendasMes.data ?? []) {
      const dia = v.created_at.slice(0, 10);
      map.set(dia, (map.get(dia) ?? 0) + Number(v.total));
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dia, total]) => ({ dia: dia.slice(8, 10) + "/" + dia.slice(5, 7), total }));
  }, [vendasMes.data]);

  const formas = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of pagamentos.data ?? []) {
      map.set(p.forma, (map.get(p.forma) ?? 0) + Number(p.valor));
    }
    return [...map.entries()].map(([forma, valor]) => ({ forma, valor }));
  }, [pagamentos.data]);

  const topProdutos = useMemo(() => {
    const map = new Map<string, number>();
    for (const i of itens.data ?? []) {
      map.set(i.nome, (map.get(i.nome) ?? 0) + Number(i.quantidade));
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([nome, quantidade]) => ({ nome, quantidade }));
  }, [itens.data]);

  const chartColors = [
    "var(--color-chart-1)",
    "var(--color-chart-2)",
    "var(--color-chart-3)",
    "var(--color-chart-4)",
    "var(--color-chart-5)",
  ];

  const carregando = vendas.isLoading || vendasMes.isLoading;

  return (
    <>
      <div className="mb-4 flex justify-center lg:justify-start">
        <Logo className="h-16" />
      </div>
      <PageHeader
        title="Dashboard"
        description="Resumo da operação da padaria."
        actions={
          <div className="flex flex-wrap gap-2">
            {PERIODOS.map((p) => (
              <Button
                key={p.key}
                size="sm"
                variant={periodo === p.key ? "default" : "outline"}
                onClick={() => setPeriodo(p.key)}
              >
                {p.label}
              </Button>
            ))}
          </div>
        }
      />

      {carregando ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Vendas do período"
            value={brl(totalPeriodo)}
            hint={`${qtdVendas} venda(s)`}
            tone="success"
            icon={<TrendingUp className="size-4" />}
          />
          <StatCard label="Vendas do mês" value={brl(totalMes)} icon={<Receipt className="size-4" />} />
          <StatCard label="Ticket médio" value={brl(ticket)} />
          <StatCard
            label="Comandas abertas"
            value={num(comandasAbertas.data ?? 0, 0)}
            icon={<ClipboardList className="size-4" />}
            tone="info"
          />
          <StatCard label="Produtos vendidos" value={num(produtosVendidos, 2)} />
          <StatCard label="Fiado em aberto" value={brl(fiadoAberto)} tone="warning" />
          <StatCard label="Fiado vencido" value={brl(fiadoVencido)} tone="danger" />
          <StatCard
            label="Caixa atual"
            value={caixa.data ? brl(caixa.data.total) : "Caixa fechado"}
            icon={<Wallet className="size-4" />}
          />
        </div>
      )}

      {(estoqueBaixo.data?.length ?? 0) > 0 ? (
        <div className="panel mt-4 flex items-start gap-3 border-warning/40 bg-warning/10 p-4">
          <AlertTriangle className="mt-0.5 size-5 text-warning" />
          <div>
            <p className="font-medium">
              {estoqueBaixo.data?.length} produto(s) com estoque baixo
            </p>
            <p className="text-sm text-muted-foreground">
              {estoqueBaixo.data
                ?.slice(0, 6)
                .map((p) => `${p.nome} (${num(p.estoque_atual, 2)})`)
                .join(" · ")}
            </p>
          </div>
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="panel p-4 lg:col-span-2">
          <p className="font-display text-base">Vendas por dia (mês atual)</p>
          <div className="mt-4 h-64">
            {vendasPorDia.length === 0 ? (
              <p className="pt-16 text-center text-sm text-muted-foreground">
                Nenhuma venda registrada neste mês.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={vendasPorDia}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="dia" fontSize={12} stroke="var(--color-muted-foreground)" />
                  <YAxis fontSize={12} stroke="var(--color-muted-foreground)" />
                  <Tooltip formatter={(v: number) => brl(v)} />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke="var(--color-chart-1)"
                    strokeWidth={2.5}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="panel p-4">
          <p className="font-display text-base">Formas de pagamento</p>
          <div className="mt-4 h-64">
            {formas.length === 0 ? (
              <p className="pt-16 text-center text-sm text-muted-foreground">
                Sem pagamentos no período.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={formas} dataKey="valor" nameKey="forma" outerRadius={90} label>
                    {formas.map((_, i) => (
                      <Cell key={i} fill={chartColors[i % chartColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => brl(v)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="panel p-4 lg:col-span-3">
          <p className="font-display text-base">Produtos mais vendidos no período</p>
          <div className="mt-4 h-64">
            {topProdutos.length === 0 ? (
              <p className="pt-16 text-center text-sm text-muted-foreground">
                Nenhum produto vendido no período.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProdutos}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="nome" fontSize={12} stroke="var(--color-muted-foreground)" />
                  <YAxis fontSize={12} stroke="var(--color-muted-foreground)" />
                  <Tooltip />
                  <Bar dataKey="quantidade" fill="var(--color-chart-2)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
