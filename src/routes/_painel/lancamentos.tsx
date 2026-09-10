import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDownCircle, ArrowUpCircle, Search, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { brl, dateTime } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_painel/lancamentos")({
  head: () => ({
    meta: [{ title: "Lançamentos — Padaria Santiago" }],
  }),
  component: LancamentosPage,
});

const CATEGORIAS_ENTRADA = ["Suprimento de Caixa", "Pagamento de Cliente", "Troco", "Outras Entradas"];
const CATEGORIAS_SAIDA = ["Sangria de Caixa", "Pagamento de Fornecedor", "Despesa Alimentação", "Despesa Material", "Vale Funcionário", "Outras Saídas"];
const FORMAS_PAGAMENTO = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "pix", label: "PIX" },
  { value: "cartao_debito", label: "Cartão de Débito" },
  { value: "cartao_credito", label: "Cartão de Crédito" },
];

type Tipo = "entrada" | "saida";

type Lancamento = {
  id: string;
  tipo: Tipo;
  categoria: string;
  valor: number;
  forma_pagamento: string;
  descricao: string | null;
  created_at: string;
};

function LancamentosPage() {
  const [tipo, setTipo] = useState<Tipo>("entrada");
  const [aba, setAba] = useState("novo");
  const [categoria, setCategoria] = useState(CATEGORIAS_ENTRADA[0]);
  const [formaPagamento, setFormaPagamento] = useState("dinheiro");
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [busca, setBusca] = useState("");
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");

  const categorias = tipo === "entrada" ? CATEGORIAS_ENTRADA : CATEGORIAS_SAIDA;

  const caixa = useQuery({
    queryKey: ["caixa-aberto"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_registers")
        .select("id")
        .eq("status", "aberto")
        .order("aberto_em", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error && error.code !== "PGRST116") throw error;
      return data ?? null;
    },
  });

  const historico = useQuery({
    queryKey: ["lancamentos-historico"],
    queryFn: async (): Promise<Lancamento[]> => {
      const { data, error } = await supabase
        .from("financial_entries")
        .select("id, tipo, categoria, valor, forma_pagamento, descricao, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Lancamento[];
    },
  });

  const registrar = useMutation({
    mutationFn: async () => {
      const valorNumerico = Number(valor.replace(",", "."));
      if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) {
        throw new Error("Informe um valor maior que zero.");
      }
      if (!categoria) throw new Error("Selecione uma categoria.");
      if (!formaPagamento) throw new Error("Selecione a forma de pagamento.");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessão do usuário não encontrada.");

      const payload: {
        tipo: Tipo;
        categoria: string;
        valor: number;
        forma_pagamento: string;
        descricao: string | null;
        user_id: string;
        cash_register_id?: string;
      } = {
        tipo,
        categoria,
        valor: valorNumerico,
        forma_pagamento: formaPagamento,
        descricao: descricao.trim() || null,
        user_id: user.id,
      };

      if (caixa.data?.id && formaPagamento === "dinheiro") {
        payload.cash_register_id = caixa.data.id;
      }

      const { error } = await supabase.from("financial_entries").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${tipo === "entrada" ? "Entrada" : "Saída"} registrada com sucesso`);
      setValor("");
      setDescricao("");
      void qc.invalidateQueries({ queryKey: ["lancamentos-historico"] });
      void qc.invalidateQueries({ queryKey: ["caixa-movimentos-do-dia"] });
      void qc.invalidateQueries({ queryKey: ["caixa-movimento"] });
      setAba("historico");
    },
    onError: (e: Error) => {
      toast.error("Erro ao registrar lançamento", { description: e.message });
    },
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      if (!isAdmin) throw new Error("Apenas administradores podem excluir lançamentos.");
      const { error } = await supabase.from("financial_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lançamento excluído com sucesso");
      void qc.invalidateQueries({ queryKey: ["lancamentos-historico"] });
      void qc.invalidateQueries({ queryKey: ["caixa-movimentos-do-dia"] });
      void qc.invalidateQueries({ queryKey: ["caixa-movimento"] });
    },
    onError: (e: Error) => toast.error("Não foi possível excluir", { description: e.message }),
  });

  const registrosFiltrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase();
    if (!termo) return historico.data ?? [];
    return (historico.data ?? []).filter((l) =>
      [l.categoria, l.descricao ?? "", l.forma_pagamento, l.tipo]
        .join(" ")
        .toLocaleLowerCase()
        .includes(termo),
    );
  }, [busca, historico.data]);

  const totalEntradas = registrosFiltrados
    .filter((l) => l.tipo === "entrada")
    .reduce((sum, l) => sum + Number(l.valor), 0);
  const totalSaidas = registrosFiltrados
    .filter((l) => l.tipo === "saida")
    .reduce((sum, l) => sum + Number(l.valor), 0);

  const alterarTipo = (novoTipo: Tipo) => {
    setTipo(novoTipo);
    setCategoria(novoTipo === "entrada" ? CATEGORIAS_ENTRADA[0] : CATEGORIAS_SAIDA[0]);
  };

  const confirmarExclusao = (l: Lancamento) => {
    if (isAdmin && window.confirm(`Deseja realmente excluir o lançamento de ${l.categoria} no valor de ${brl(Number(l.valor))}?`)) {
      excluir.mutate(l.id);
    }
  };

  return (
    <>
      <PageHeader
        title="Lançamentos"
        description="Registre entradas e saídas e consulte o histórico financeiro."
      />

      <Tabs value={aba} onValueChange={setAba} className="mt-6">
        <TabsList className="mb-4 grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="novo">Novo Lançamento</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="novo" className="space-y-4">
          <div className="panel max-w-xl p-5">
            <h2 className="mb-6 font-display text-lg font-semibold">Detalhes do Movimento</h2>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                registrar.mutate();
              }}
              className="space-y-6"
            >
              <div className="flex gap-4">
                <Button
                  type="button"
                  variant={tipo === "entrada" ? "default" : "outline"}
                  className="flex-1 border-primary/20"
                  onClick={() => alterarTipo("entrada")}
                >
                  <ArrowUpCircle className="mr-2 size-4" /> Entrada
                </Button>
                <Button
                  type="button"
                  variant={tipo === "saida" ? "destructive" : "outline"}
                  className="flex-1 border-destructive/20"
                  onClick={() => alterarTipo("saida")}
                >
                  <ArrowDownCircle className="mr-2 size-4" /> Saída
                </Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="categoria">Categoria</Label>
                  <Select value={categoria} onValueChange={setCategoria}>
                    <SelectTrigger id="categoria"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {categorias.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="forma_pagamento">Forma de Pagamento</Label>
                  <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                    <SelectTrigger id="forma_pagamento"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {FORMAS_PAGAMENTO.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="valor">Valor (R$)</Label>
                <Input
                  id="valor"
                  type="text"
                  inputMode="decimal"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  className="numeric h-12 text-lg font-medium"
                  placeholder="0,00"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição / Observação</Label>
                <Textarea
                  id="descricao"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Detalhes opcionais sobre o lançamento..."
                  className="resize-none"
                />
              </div>

              <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                {formaPagamento === "dinheiro"
                  ? caixa.data
                    ? "Este lançamento em dinheiro será vinculado automaticamente ao caixa aberto."
                    : "Não há caixa aberto. O lançamento será registrado sem vínculo com um caixa." 
                  : "Como não é dinheiro, o lançamento fica registrado no histórico financeiro sem alterar o saldo físico do caixa."}
              </div>

              <Button type="submit" className="h-11 w-full" disabled={registrar.isPending}>
                {registrar.isPending ? "Registrando..." : `Confirmar ${tipo === "entrada" ? "Entrada" : "Saída"}`}
              </Button>
            </form>
          </div>
        </TabsContent>

        <TabsContent value="historico">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="panel p-4"><p className="text-sm text-muted-foreground">Entradas</p><p className="mt-1 text-xl font-semibold text-primary numeric">{brl(totalEntradas)}</p></div>
              <div className="panel p-4"><p className="text-sm text-muted-foreground">Saídas</p><p className="mt-1 text-xl font-semibold text-destructive numeric">{brl(totalSaidas)}</p></div>
              <div className="panel p-4"><p className="text-sm text-muted-foreground">Saldo dos registros</p><p className="mt-1 text-xl font-semibold numeric">{brl(totalEntradas - totalSaidas)}</p></div>
            </div>

            <div className="panel overflow-hidden">
              <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                <div><h2 className="font-display text-lg font-semibold">Histórico financeiro</h2><p className="text-sm text-muted-foreground">Últimos {historico.data?.length ?? 0} lançamentos.</p></div>
                <div className="relative w-full sm:max-w-xs">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar lançamento..." className="pl-9" />
                </div>
              </div>

              {historico.isLoading ? (
                <div className="space-y-3 p-4"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>
              ) : registrosFiltrados.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">Nenhum lançamento encontrado.</div>
              ) : (
                <div className="divide-y divide-border">
                  {registrosFiltrados.map((l) => {
                    const ehEntrada = l.tipo === "entrada";
                    return (
                      <div key={l.id} className="flex items-center gap-3 p-4 transition-colors hover:bg-muted/50 sm:gap-4">
                        <div className={`shrink-0 rounded-full p-2 ${ehEntrada ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
                          {ehEntrada ? <ArrowUpCircle className="size-5" /> : <ArrowDownCircle className="size-5" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{l.categoria}</p>
                          <p className="truncate text-sm text-muted-foreground">
                            {l.descricao ? `${l.descricao} • ` : ""}
                            <span className="capitalize">{String(l.forma_pagamento).replace(/_/g, " ")}</span> • {dateTime(l.created_at)}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className={`font-semibold numeric ${ehEntrada ? "text-primary" : "text-destructive"}`}>{ehEntrada ? "+" : "-"} {brl(Number(l.valor))}</p>
                        </div>
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => confirmarExclusao(l)}
                            disabled={excluir.isPending}
                            title="Excluir lançamento"
                            aria-label="Excluir lançamento"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}
