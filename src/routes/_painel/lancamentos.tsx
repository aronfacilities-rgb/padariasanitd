import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDownCircle, ArrowUpCircle, Trash2 } from "lucide-react";
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
    meta: [
      { title: "Lançamentos — Padaria Santiago" },
    ],
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

function LancamentosPage() {
  const [tipo, setTipo] = useState<"entrada" | "saida">("entrada");
  const [aba, setAba] = useState("novo");
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");

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
    }
  });

  const historico = useQuery({
    queryKey: ["lancamentos-historico"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_entries")
        .select("id, tipo, categoria, valor, forma_pagamento, descricao, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    }
  });

  const registrar = useMutation({
    mutationFn: async (dados: { categoria: string; valor: number; forma_pagamento: string; descricao: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const payload: any = {
        tipo,
        categoria: dados.categoria,
        valor: dados.valor,
        forma_pagamento: dados.forma_pagamento,
        descricao: dados.descricao || null,
        user_id: user?.id,
      };
      
      if (dados.forma_pagamento === "dinheiro" && caixa.data?.id) {
        payload.cash_register_id = caixa.data.id;
      }
      
      const { error } = await supabase.from("financial_entries").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lançamento registrado com sucesso");
      void qc.invalidateQueries({ queryKey: ["lancamentos-historico"] });
      void qc.invalidateQueries({ queryKey: ["caixa-movimentos-do-dia"] });
      void qc.invalidateQueries({ queryKey: ["caixa-movimento"] });
      setAba("historico");
    },
    onError: (e: Error) => {
      toast.error("Erro ao registrar lançamento", { description: e.message });
    }
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
    onError: (e: Error) => toast.error("Não foi possível excluir", { description: e.message })
  });

  const confirmarExclusao = (m: any) => {
    if (isAdmin && window.confirm(`Deseja realmente excluir o lançamento de ${m.categoria} no valor de ${brl(m.valor)}?`)) {
      excluir.mutate(m.id);
    }
  };

  const categorias = tipo === "entrada" ? CATEGORIAS_ENTRADA : CATEGORIAS_SAIDA;

  return (
    <>
      <PageHeader
        title="Lançamentos"
        description="Registro de entradas e saídas financeiras e visualização do histórico."
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
                const f = new FormData(e.currentTarget);
                registrar.mutate({
                  categoria: String(f.get("categoria")),
                  valor: Number(f.get("valor") ?? 0),
                  forma_pagamento: String(f.get("forma_pagamento")),
                  descricao: String(f.get("descricao") ?? ""),
                });
                e.currentTarget.reset();
              }}
              className="space-y-6"
            >
              <div className="flex gap-4">
                <Button
                  type="button"
                  variant={tipo === "entrada" ? "default" : "outline"}
                  className="flex-1 border-primary/20"
                  onClick={() => setTipo("entrada")}
                >
                  <ArrowUpCircle className="mr-2 size-4" />
                  Entrada
                </Button>
                <Button
                  type="button"
                  variant={tipo === "saida" ? "destructive" : "outline"}
                  className="flex-1 border-destructive/20"
                  onClick={() => setTipo("saida")}
                >
                  <ArrowDownCircle className="mr-2 size-4" />
                  Saída
                </Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="categoria">Categoria</Label>
                  <Select name="categoria" required defaultValue={categorias[0] ?? ""}>
                    <SelectTrigger id="categoria">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {categorias.map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="forma_pagamento">Forma de Pagamento</Label>
                  <Select name="forma_pagamento" required defaultValue="dinheiro">
                    <SelectTrigger id="forma_pagamento">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {FORMAS_PAGAMENTO.map(f => (
                        <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="valor">Valor (R$)</Label>
                <Input
                  id="valor"
                  name="valor"
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="numeric h-12 text-lg font-medium"
                  placeholder="0,00"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição / Observação</Label>
                <Textarea 
                  id="descricao" 
                  name="descricao" 
                  placeholder="Detalhes opcionais sobre o lançamento..."
                  className="resize-none"
                />
              </div>

              <div className="pt-2">
                <Button type="submit" className="w-full h-11" disabled={registrar.isPending}>
                  {registrar.isPending ? "Registrando..." : "Confirmar Lançamento"}
                </Button>
              </div>
            </form>
          </div>
        </TabsContent>

        <TabsContent value="historico">
          <div className="panel overflow-hidden">
            <div className="p-4 border-b border-border">
              <h2 className="font-display text-lg font-semibold">Últimos Registros</h2>
            </div>
            
            {historico.isLoading ? (
              <div className="p-4 space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : historico.data?.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <p>Nenhum lançamento registrado.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {historico.data?.map(l => {
                  const ehEntrada = l.tipo === "entrada";
                  return (
                    <div key={l.id} className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors">
                      <div className={`p-2 rounded-full shrink-0 ${ehEntrada ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
                        {ehEntrada ? <ArrowUpCircle className="size-5" /> : <ArrowDownCircle className="size-5" />}
                      </div>
                      
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{l.categoria}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {l.descricao ? `${l.descricao} • ` : ""}
                          <span className="capitalize">{l.forma_pagamento.replace('_', ' ')}</span> • {dateTime(l.created_at)}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <p className={`font-semibold numeric ${ehEntrada ? "text-primary" : "text-destructive"}`}>
                          {ehEntrada ? "+" : "-"} {brl(Number(l.valor))}
                        </p>
                      </div>

                      {isAdmin && (
                        <div className="shrink-0 pl-2">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => confirmarExclusao(l)}
                            disabled={excluir.isPending}
                            title="Excluir Lançamento"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}
