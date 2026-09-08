import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, CreditCard, Package, Wallet } from "lucide-react";
import { useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_painel/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios — Padaria Santiago" },
      { name: "description", content: "Relatórios de vendas, caixa, produtos e fiado por período." },
    ],
  }),
  component: RelatoriosPage,
});

type ReportData = {
  sales: Array<{ id: string; numero: number; total: number; status: string; created_at: string }>;
  cashRegisters: Array<{ id: string; valor_inicial: number; valor_esperado: number | null; valor_informado: number | null; diferenca: number | null; status: string; aberto_em: string; fechado_em: string | null }>;
  products: Array<{ id: string; nome: string; estoque_atual: number; estoque_minimo: number; preco_venda: number; ativo: boolean }>;
  receivables: Array<{ id: string; customer_id: string; valor: number; valor_pago: number; vencimento: string | null; status: string }>;
};

const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const dateTime = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));

function RelatoriosPage() {
  const today = new Date().toISOString().slice(0, 10);
  const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const [de, setDe] = useState(firstDay);
  const [ate, setAte] = useState(today);

  const report = useQuery({
    queryKey: ["relatorios", de, ate],
    queryFn: async (): Promise<ReportData> => {
      const inicio = `${de}T00:00:00.000Z`;
      const fim = `${ate}T23:59:59.999Z`;
      const [sales, cashRegisters, products, receivables] = await Promise.all([
        supabase.from("sales").select("id, numero, total, status, created_at").gte("created_at", inicio).lte("created_at", fim).order("created_at", { ascending: false }),
        supabase.from("cash_registers").select("id, valor_inicial, valor_esperado, valor_informado, diferenca, status, aberto_em, fechado_em").gte("aberto_em", inicio).lte("aberto_em", fim).order("aberto_em", { ascending: false }),
        supabase.from("products").select("id, nome, estoque_atual, estoque_minimo, preco_venda, ativo").order("nome"),
        supabase.from("accounts_receivable").select("id, customer_id, valor, valor_pago, vencimento, status").or(`vencimento.gte.${de},vencimento.lte.${ate}`).order("vencimento"),
      ]);
      for (const result of [sales, cashRegisters, products, receivables]) {
        if (result.error) throw result.error;
      }
      return {
        sales: (sales.data ?? []) as ReportData["sales"],
        cashRegisters: (cashRegisters.data ?? []) as ReportData["cashRegisters"],
        products: (products.data ?? []) as ReportData["products"],
        receivables: (receivables.data ?? []) as ReportData["receivables"],
      };
    },
  });

  const data = report.data;
  const totalVendas = data?.sales.reduce((sum, sale) => sum + Number(sale.total), 0) ?? 0;
  const totalCaixa = data?.cashRegisters.reduce((sum, cash) => sum + Number(cash.valor_informado ?? cash.valor_esperado ?? 0), 0) ?? 0;
  const totalFiado = data?.receivables.reduce((sum, item) => sum + Math.max(Number(item.valor) - Number(item.valor_pago), 0), 0) ?? 0;
  const produtosBaixoEstoque = data?.products.filter((product) => product.ativo && Number(product.estoque_atual) <= Number(product.estoque_minimo)) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Relatórios" description="Acompanhe os resultados do negócio por período." />
      <div className="panel grid gap-4 p-4 sm:grid-cols-2 lg:max-w-2xl">
        <div>
          <Label htmlFor="relatorio-de">Período inicial</Label>
          <Input id="relatorio-de" type="date" value={de} onChange={(event) => setDe(event.target.value)} />
        </div>
        <div>
          <Label htmlFor="relatorio-ate">Período final</Label>
          <Input id="relatorio-ate" type="date" value={ate} onChange={(event) => setAte(event.target.value)} />
        </div>
      </div>

      {report.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-xl" />)}</div>
      ) : report.isError ? (
        <div className="panel p-6 text-sm text-destructive">Não foi possível carregar os relatórios. Tente novamente.</div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard title="Vendas no período" value={money(totalVendas)} detail={`${data?.sales.length ?? 0} venda(s)`} icon={BarChart3} />
            <MetricCard title="Movimentação de caixa" value={money(totalCaixa)} detail={`${data?.cashRegisters.length ?? 0} abertura(s)`} icon={Wallet} />
            <MetricCard title="Saldo em fiado" value={money(totalFiado)} detail={`${data?.receivables.length ?? 0} registro(s)`} icon={CreditCard} />
            <MetricCard title="Baixo estoque" value={String(produtosBaixoEstoque.length)} detail="produto(s) no limite mínimo" icon={Package} />
          </div>
          <Tabs defaultValue="vendas" className="space-y-4">
            <TabsList className="flex h-auto flex-wrap justify-start">
              <TabsTrigger value="vendas">Vendas</TabsTrigger>
              <TabsTrigger value="caixa">Caixa</TabsTrigger>
              <TabsTrigger value="produtos">Produtos</TabsTrigger>
              <TabsTrigger value="fiado">Fiado</TabsTrigger>
            </TabsList>
            <TabsContent value="vendas"><ReportTable headers={["Número", "Data", "Status", "Total"]} rows={(data?.sales ?? []).map((sale) => [String(sale.numero), dateTime(sale.created_at), sale.status, money(Number(sale.total))])} empty="Nenhuma venda encontrada no período." /></TabsContent>
            <TabsContent value="caixa"><ReportTable headers={["Abertura", "Status", "Esperado", "Informado", "Diferença"]} rows={(data?.cashRegisters ?? []).map((cash) => [dateTime(cash.aberto_em), cash.status, money(Number(cash.valor_esperado ?? 0)), money(Number(cash.valor_informado ?? 0)), money(Number(cash.diferenca ?? 0))])} empty="Nenhuma movimentação de caixa encontrada no período." /></TabsContent>
            <TabsContent value="produtos"><ReportTable headers={["Produto", "Estoque atual", "Mínimo", "Preço de venda", "Situação"]} rows={(data?.products ?? []).map((product) => [product.nome, String(product.estoque_atual), String(product.estoque_minimo), money(Number(product.preco_venda)), Number(product.estoque_atual) <= Number(product.estoque_minimo) ? "Baixo estoque" : "Normal"])} empty="Nenhum produto cadastrado." /></TabsContent>
            <TabsContent value="fiado"><ReportTable headers={["Vencimento", "Status", "Valor", "Pago", "Em aberto"]} rows={(data?.receivables ?? []).map((item) => [item.vencimento ? new Intl.DateTimeFormat("pt-BR").format(new Date(`${item.vencimento}T12:00:00`)) : "Sem vencimento", item.status, money(Number(item.valor)), money(Number(item.valor_pago)), money(Math.max(Number(item.valor) - Number(item.valor_pago), 0))])} empty="Nenhum registro de fiado encontrado no período." /></TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

function MetricCard({ title, value, detail, icon: Icon }: { title: string; value: string; detail: string; icon: typeof BarChart3 }) {
  return <Card><CardHeader className="flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle><Icon className="size-5 text-primary" /></CardHeader><CardContent><p className="font-display text-2xl font-bold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></CardContent></Card>;
}

function ReportTable({ headers, rows, empty }: { headers: string[]; rows: string[][]; empty: string }) {
  if (rows.length === 0) return <div className="panel p-8 text-center text-sm text-muted-foreground">{empty}</div>;
  return <div className="panel overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="border-b border-border bg-muted/40"><tr>{headers.map((header) => <th key={header} className="px-4 py-3 font-semibold">{header}</th>)}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={rowIndex} className="border-b border-border last:border-0">{row.map((cell, cellIndex) => <td key={cellIndex} className="px-4 py-3">{cell}</td>)}</tr>)}</tbody></table></div>;
}
