import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Minus, Plus, Printer, Search, Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Cupom, CupomPrintArea, type CupomData } from "@/components/cupom";
import { brl, num } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_painel/pdv")({
  head: () => ({
    meta: [
      { title: "PDV — Padaria Santiago" },
      {
        name: "description",
        content:
          "Ponto de venda da Padaria Santiago: importe comandas, receba em dinheiro, Pix, cartão ou fiado.",
      },
      { property: "og:title", content: "PDV — Padaria Santiago" },
      { property: "og:description", content: "Venda rápida com recebimento e troco automático." },
    ],
  }),
  component: PdvPage,
});

type Produto = {
  id: string;
  nome: string;
  preco_venda: number;
  unidade: string;
  codigo_interno: string | null;
  codigo_barras: string | null;
};

type Linha = {
  productId: string | null;
  nome: string;
  quantidade: number;
  preco: number;
};

type Forma = "dinheiro" | "pix" | "debito" | "credito" | "fiado";

const FORMAS: { valor: Forma; label: string }[] = [
  { valor: "dinheiro", label: "Dinheiro" },
  { valor: "pix", label: "Pix" },
  { valor: "debito", label: "Débito" },
  { valor: "credito", label: "Crédito" },
  { valor: "fiado", label: "Fiado" },
];

type EmpresaConfig = {
  nome?: string;
  cnpj?: string | null;
  endereco?: string | null;
  telefone?: string | null;
};

function PdvPage() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const [cupom, setCupom] = useState<CupomData | null>(null);
  const [busca, setBusca] = useState("");
  const [carrinho, setCarrinho] = useState<Linha[]>([]);
  const [desconto, setDesconto] = useState(0);
  const [comandaId, setComandaId] = useState<string | null>(null);
  const [pagando, setPagando] = useState(false);
  const [forma, setForma] = useState<Forma>("dinheiro");
  const [recebido, setRecebido] = useState("");
  const [clienteId, setClienteId] = useState("");

  /**
   * Aciona a gaveta antes de abrir a caixa de impressão do navegador.
   * O comando ESC/POS só chega à Bematech pela porta serial/USB, então em
   * navegadores sem Web Serial apenas avisamos e seguimos com a impressão.
   */
  async function imprimirEAbrirGaveta() {
    const resultado = await abrirGaveta();
    if (!resultado.ok) {
      if (resultado.motivo === "sem-suporte") {
        toast.info("Abertura automática da gaveta só funciona no Chrome ou Edge do computador.");
      } else if (resultado.motivo === "sem-permissao") {
        toast.info("Selecione a impressora Bematech na janela do navegador para abrir a gaveta.");
      } else {
        toast.error("Não foi possível abrir a gaveta. Verifique o cabo da impressora.");
      }
    }
    window.print();
  }


  const caixa = useQuery({
    queryKey: ["caixa-aberto"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_registers")
        .select("id, valor_inicial, aberto_em")
        .eq("status", "aberto")
        .order("aberto_em", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
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
      return (data ?? []) as Produto[];
    },
  });

  const comandas = useQuery({
    queryKey: ["comandas-para-caixa"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commands")
        .select("id, numero, total, observacao")
        .in("status", ["aberta", "em_consumo", "aguardando_pagamento"])
        .order("numero");
      if (error) throw error;
      return (data ?? []) as { id: string; numero: number; total: number; observacao: string | null }[];
    },
    refetchInterval: 15000,
  });

  const clientes = useQuery({
    queryKey: ["clientes-ativos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as { id: string; nome: string }[];
    },
  });

  const empresa = useQuery({
    queryKey: ["config-empresa"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_settings")
        .select("empresa")
        .eq("id", "default")
        .maybeSingle();
      if (error) throw error;
      return (data?.empresa ?? {}) as EmpresaConfig;
    },
    staleTime: 5 * 60 * 1000,
  });

  const subtotal = useMemo(
    () => carrinho.reduce((s, l) => s + l.quantidade * l.preco, 0),
    [carrinho],
  );
  const total = Math.max(0, subtotal - desconto);
  const troco = forma === "dinheiro" ? Math.max(0, Number(recebido || 0) - total) : 0;

  function addProduto(p: Produto) {
    setCarrinho((atual) => {
      const idx = atual.findIndex((l) => l.productId === p.id);
      if (idx >= 0) {
        const copia = [...atual];
        copia[idx] = { ...copia[idx]!, quantidade: copia[idx]!.quantidade + 1 };
        return copia;
      }
      return [
        ...atual,
        { productId: p.id, nome: p.nome, quantidade: 1, preco: Number(p.preco_venda) },
      ];
    });
  }

  async function importarComanda(id: string) {
    const { data, error } = await supabase
      .from("command_items")
      .select("product_id, nome, quantidade, preco_unitario")
      .eq("command_id", id);
    if (error) {
      toast.error("Erro ao importar comanda", { description: error.message });
      return;
    }
    setCarrinho(
      (data ?? []).map((i) => ({
        productId: i.product_id,
        nome: i.nome,
        quantidade: Number(i.quantidade),
        preco: Number(i.preco_unitario),
      })),
    );
    setComandaId(id);
    toast.success("Comanda importada para o PDV");
  }

  const finalizar = useMutation({
    mutationFn: async () => {
      if (!caixa.data) throw new Error("Abra o caixa antes de vender.");
      if (carrinho.length === 0) throw new Error("Nenhum item na venda.");
      if (forma === "fiado" && !clienteId) throw new Error("Selecione o cliente do fiado.");
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id ?? null;

      const { data: venda, error: vendaErro } = await supabase
        .from("sales")
        .insert({
          cash_register_id: caixa.data.id,
          command_id: comandaId,
          customer_id: forma === "fiado" ? clienteId : null,
          subtotal,
          desconto,
          total,
          status: "finalizada",
          user_id: userId,
        })
        .select("id, numero")
        .single();
      if (vendaErro) throw vendaErro;

      const { error: itensErro } = await supabase.from("sale_items").insert(
        carrinho.map((l) => ({
          sale_id: venda.id,
          product_id: l.productId,
          nome: l.nome,
          quantidade: l.quantidade,
          preco_unitario: l.preco,
          total: l.quantidade * l.preco,
        })),
      );
      if (itensErro) throw itensErro;

      const { error: pagErro } = await supabase.from("payments").insert({
        sale_id: venda.id,
        forma,
        valor: total,
        valor_recebido: forma === "dinheiro" ? Number(recebido || total) : total,
        troco: forma === "dinheiro" ? troco : 0,
      });
      if (pagErro) throw pagErro;

      const baixas = carrinho.filter((l) => l.productId);
      if (baixas.length > 0) {
        const { error: estoqueErro } = await supabase.from("inventory_movements").insert(
          baixas.map((l) => ({
            product_id: l.productId!,
            tipo: "saida" as const,
            quantidade: l.quantidade,
            motivo: "venda",
            observacao: `Venda #${venda.numero}`,
            user_id: userId,
          })),
        );
        if (estoqueErro) throw estoqueErro;
      }

      if (forma === "fiado") {
        const { error: fiadoErro } = await supabase.from("accounts_receivable").insert({
          customer_id: clienteId,
          sale_id: venda.id,
          valor: total,
          valor_pago: 0,
          status: "aberto",
          user_id: userId,
        });
        if (fiadoErro) throw fiadoErro;
      }

      if (comandaId) {
        const { error: cmdErro } = await supabase
          .from("commands")
          .update({ status: "finalizada" })
          .eq("id", comandaId);
        if (cmdErro) throw cmdErro;
      }

      // Snapshot da venda para o cupom, montado antes de limpar o carrinho.
      const comprovante: CupomData = {
        numero: venda.numero as number,
        emitidoEm: new Date().toISOString(),
        itens: carrinho.map((l) => ({
          nome: l.nome,
          quantidade: l.quantidade,
          preco: l.preco,
        })),
        subtotal,
        desconto,
        total,
        forma,
        recebido: forma === "dinheiro" ? Number(recebido || total) : total,
        troco: forma === "dinheiro" ? troco : 0,
        cliente:
          forma === "fiado"
            ? ((clientes.data ?? []).find((c) => c.id === clienteId)?.nome ?? null)
            : null,
        operador: profile?.nome ?? null,
        empresa: {
          nome: empresa.data?.nome ?? "Padaria Santiago",
          cnpj: empresa.data?.cnpj ?? null,
          endereco: empresa.data?.endereco ?? null,
          telefone: empresa.data?.telefone ?? null,
        },
      };
      return comprovante;
    },
    onSuccess: (comprovante) => {
      toast.success(`Venda #${comprovante.numero} finalizada`, {
        description: `Total ${brl(comprovante.total)}`,
      });
      setCupom(comprovante);
      setCarrinho([]);
      setDesconto(0);
      setComandaId(null);
      setRecebido("");
      setClienteId("");
      setPagando(false);
      void qc.invalidateQueries({ queryKey: ["comandas-para-caixa"] });
      void qc.invalidateQueries({ queryKey: ["comandas-abertas"] });
      void qc.invalidateQueries({ queryKey: ["produtos"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error("Não foi possível finalizar", { description: e.message }),
  });

  const sugestoes = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return (produtos.data ?? []).slice(0, 18);
    return (produtos.data ?? [])
      .filter(
        (p) =>
          p.nome.toLowerCase().includes(termo) ||
          (p.codigo_interno ?? "").toLowerCase().includes(termo) ||
          (p.codigo_barras ?? "").toLowerCase().includes(termo),
      )
      .slice(0, 18);
  }, [produtos.data, busca]);

  return (
    <>
      <PageHeader
        title="PDV"
        description="Venda balcão, importação de comandas e recebimento com troco."
      />

      {!caixa.isLoading && !caixa.data ? (
        <div className="panel mb-4 flex flex-wrap items-center justify-between gap-3 border-destructive/40 p-4">
          <p className="text-sm">
            O caixa está fechado. Abra o caixa para registrar vendas.
          </p>
          <Button asChild variant="outline" className="h-11">
            <Link to="/caixa">Ir para o caixa</Link>
          </Button>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="space-y-4">
          <div className="panel p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar produto ou bipar código de barras"
                className="h-12 pl-9"
              />
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {produtos.isLoading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 rounded-xl" />
                  ))
                : sugestoes.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => addProduto(p)}
                      className="panel flex flex-col items-start p-3 text-left transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="line-clamp-2 text-sm font-medium">{p.nome}</span>
                      <span className="numeric text-sm text-muted-foreground">
                        {brl(p.preco_venda)} / {p.unidade}
                      </span>
                    </button>
                  ))}
            </div>
          </div>

          <div className="panel p-4">
            <h2 className="font-display text-lg font-semibold">Comandas aguardando</h2>
            {(comandas.data ?? []).length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Nenhuma comanda em aberto.</p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {(comandas.data ?? []).map((c) => (
                  <Button
                    key={c.id}
                    variant={comandaId === c.id ? "default" : "outline"}
                    className="h-11"
                    onClick={() => void importarComanda(c.id)}
                  >
                    #{c.numero}
                    <span className="numeric">{brl(c.total)}</span>
                  </Button>
                ))}
              </div>
            )}
          </div>
        </section>

        <aside className="panel flex flex-col p-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)]">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Venda atual</h2>
            {comandaId ? <Badge variant="secondary">Comanda importada</Badge> : null}
          </div>

          <div className="mt-3 flex-1 overflow-y-auto">
            {carrinho.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Adicione produtos para iniciar a venda.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {carrinho.map((l, idx) => (
                  <li key={`${l.nome}-${idx}`} className="flex items-center gap-2 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{l.nome}</p>
                      <p className="numeric text-xs text-muted-foreground">
                        {num(l.quantidade, 2)} × {brl(l.preco)}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Diminuir"
                      onClick={() =>
                        setCarrinho((a) =>
                          a
                            .map((x, i) => (i === idx ? { ...x, quantidade: x.quantidade - 1 } : x))
                            .filter((x) => x.quantidade > 0),
                        )
                      }
                    >
                      <Minus className="size-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Aumentar"
                      onClick={() =>
                        setCarrinho((a) =>
                          a.map((x, i) => (i === idx ? { ...x, quantidade: x.quantidade + 1 } : x)),
                        )
                      }
                    >
                      <Plus className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Remover"
                      onClick={() => setCarrinho((a) => a.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                    <span className="numeric w-20 text-right text-sm font-semibold">
                      {brl(l.quantidade * l.preco)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-4 space-y-3 border-t border-border pt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="numeric">{brl(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="desconto" className="text-sm text-muted-foreground">
                Desconto
              </Label>
              <Input
                id="desconto"
                type="number"
                step="0.01"
                min="0"
                value={desconto || ""}
                onChange={(e) => setDesconto(Number(e.target.value || 0))}
                className="numeric h-10 w-28 text-right"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="numeric font-display text-3xl font-semibold">{brl(total)}</span>
            </div>
            <Button
              className="h-14 w-full text-base"
              disabled={carrinho.length === 0 || !caixa.data}
              onClick={() => setPagando(true)}
            >
              Receber pagamento
            </Button>
          </div>
        </aside>
      </div>

      <Dialog open={pagando} onOpenChange={setPagando}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Recebimento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg bg-muted p-3">
              <span className="text-sm text-muted-foreground">Total a receber</span>
              <span className="numeric text-2xl font-semibold">{brl(total)}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {FORMAS.map((f) => (
                <Button
                  key={f.valor}
                  variant={forma === f.valor ? "default" : "outline"}
                  className={cn("h-12")}
                  onClick={() => setForma(f.valor)}
                >
                  {f.label}
                </Button>
              ))}
            </div>

            {forma === "dinheiro" ? (
              <div className="space-y-2">
                <Label htmlFor="recebido">Valor recebido</Label>
                <Input
                  id="recebido"
                  type="number"
                  step="0.01"
                  min="0"
                  value={recebido}
                  onChange={(e) => setRecebido(e.target.value)}
                  className="numeric h-12 text-lg"
                  autoFocus
                />
                <div className="flex items-center justify-between rounded-lg border border-border bg-accent/40 p-3">
                  <span className="text-sm font-medium">Troco para o cliente</span>
                  <span className="numeric font-display text-2xl font-semibold">{brl(troco)}</span>
                </div>
                {Number(recebido || 0) > 0 && Number(recebido) < total ? (
                  <p className="text-sm text-destructive">
                    Valor recebido menor que o total ({brl(total)}).
                  </p>
                ) : null}
              </div>
            ) : null}

            {forma === "fiado" ? (
              <div className="space-y-2">
                <Label htmlFor="cliente">Cliente</Label>
                <Select value={clienteId} onValueChange={setClienteId}>
                  <SelectTrigger id="cliente" className="h-12">
                    <SelectValue placeholder="Selecione o cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {(clientes.data ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              className="h-12 w-full"
              disabled={finalizar.isPending}
              onClick={() => finalizar.mutate()}
            >
              {finalizar.isPending ? "Finalizando..." : "Confirmar venda"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cupom !== null} onOpenChange={(aberto) => !aberto && setCupom(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Cupom da venda</DialogTitle>
          </DialogHeader>
          {cupom ? <Cupom data={cupom} /> : null}
          <DialogFooter className="gap-2 sm:flex-col">
            <Button className="h-12 w-full" onClick={imprimirEAbrirGaveta}>
              <Printer className="size-4" />
              Imprimir cupom e abrir gaveta
            </Button>

            <Button
              variant="outline"
              className="h-12 w-full"
              onClick={() => setCupom(null)}
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CupomPrintArea data={cupom} />
    </>
  );
}
