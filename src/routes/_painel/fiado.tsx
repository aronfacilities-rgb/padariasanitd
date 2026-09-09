import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, CreditCard, Search } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";

type Customer = { id: string; nome: string; telefone: string | null; limite_credito: number; ativo: boolean };
type Receivable = { id: string; customer_id: string; sale_id: string | null; valor: number; valor_pago: number; vencimento: string | null; status: string; created_at: string; observacao: string | null };

type Payment = { id: string; receivable_id: string; valor: number; forma: string; created_at: string };

export const Route = createFileRoute("/_painel/fiado")({ component: FiadoPage });

function moeda(v: number) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function data(v: string | null) { return v ? new Date(`${v}T12:00:00`).toLocaleDateString("pt-BR") : "—"; }

function FiadoPage() {
  const { isOperator } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Receivable | null>(null);
  const [payment, setPayment] = useState<{ valor: string; forma: "dinheiro" | "pix" | "debito" | "credito" | "fiado" | "outros" }>({ valor: "", forma: "dinheiro" });

  const customers = useQuery({ queryKey: ["clientes-fiado"], queryFn: async () => {
    const { data, error } = await supabase.from("customers").select("id,nome,telefone,limite_credito,ativo").eq("ativo", true).order("nome");
    if (error) throw error; return (data ?? []) as Customer[];
  }});
  const receivables = useQuery({ queryKey: ["fiado-contas"], queryFn: async () => {
    const { data, error } = await supabase.from("accounts_receivable").select("id,customer_id,sale_id,valor,valor_pago,vencimento,status,created_at,observacao").order("created_at", { ascending: false });
    if (error) throw error; return (data ?? []) as Receivable[];
  }});

  const names = useMemo(() => new Map((customers.data ?? []).map(c => [c.id, c.nome])), [customers.data]);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (receivables.data ?? []).filter(r => !term || (names.get(r.customer_id) ?? "").toLowerCase().includes(term));
  }, [receivables.data, names, search]);
  const totalAberto = (receivables.data ?? []).reduce((s, r) => s + Math.max(0, Number(r.valor) - Number(r.valor_pago)), 0);
  const vencido = (receivables.data ?? []).reduce((s, r) => s + (r.vencimento && r.status !== "pago" && r.vencimento < new Date().toISOString().slice(0,10) ? Math.max(0, Number(r.valor) - Number(r.valor_pago)) : 0), 0);

  const pay = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Selecione uma conta.");
      const valor = Number(payment.valor.replace(",", "."));
      const saldo = Number(selected.valor) - Number(selected.valor_pago);
      if (!valor || valor <= 0) throw new Error("Informe um valor válido.");
      if (valor > saldo + 0.001) throw new Error("O pagamento não pode ser maior que o saldo em aberto.");
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("receivable_payments").insert({ receivable_id: selected.id, valor, forma: payment.forma, user_id: userData.user?.id ?? null });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Pagamento registrado e saldo atualizado."); setSelected(null); setPayment({ valor: "", forma: "dinheiro" }); void qc.invalidateQueries({ queryKey: ["fiado-contas"] }); },
    onError: (e: Error) => toast.error("Não foi possível registrar", { description: e.message }),
  });

  return <>
    <PageHeader title="Fiado / Contas a receber" description="Acompanhe débitos, pagamentos, vencimentos e saldo de cada cliente." />
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3"><div className="panel p-4"><p className="text-xs text-muted-foreground">Total em aberto</p><p className="mt-1 text-xl font-semibold numeric">{moeda(totalAberto)}</p></div><div className="panel p-4"><p className="text-xs text-muted-foreground">Vencido</p><p className="mt-1 text-xl font-semibold numeric">{moeda(vencido)}</p></div><div className="panel p-4"><p className="text-xs text-muted-foreground">Contas</p><p className="mt-1 text-xl font-semibold numeric">{filtered.length}</p></div></div>
      <div className="panel p-4"><div className="relative max-w-md"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar cliente..." value={search} onChange={e => setSearch(e.target.value)} /></div></div>
      <div className="panel overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="border-b bg-muted/30"><tr><th className="px-4 py-3 text-left">Cliente</th><th className="px-4 py-3 text-left">Lançamento</th><th className="px-4 py-3 text-left">Vencimento</th><th className="px-4 py-3 text-right">Valor</th><th className="px-4 py-3 text-right">Saldo</th><th className="px-4 py-3 text-center">Status</th><th className="px-4 py-3 text-right">Ação</th></tr></thead><tbody>{filtered.map(r => { const saldo = Math.max(0, Number(r.valor) - Number(r.valor_pago)); const atrasada = r.vencimento && r.status !== "pago" && r.vencimento < new Date().toISOString().slice(0,10); return <tr key={r.id} className="border-b last:border-0"><td className="px-4 py-3 font-medium">{names.get(r.customer_id) ?? "Cliente"}</td><td className="px-4 py-3">{data(r.created_at)}</td><td className="px-4 py-3">{data(r.vencimento)}</td><td className="px-4 py-3 text-right numeric">{moeda(Number(r.valor))}</td><td className="px-4 py-3 text-right numeric font-semibold">{moeda(saldo)}</td><td className="px-4 py-3 text-center"><Badge variant={r.status === "pago" ? "default" : atrasada ? "destructive" : "secondary"}>{atrasada ? "Vencido" : r.status}</Badge></td><td className="px-4 py-3 text-right">{isOperator && saldo > 0 ? <Button size="sm" variant="outline" onClick={() => setSelected(r)}><CreditCard className="size-4" /> Receber</Button> : r.status === "pago" ? <CheckCircle2 className="ml-auto size-4 text-muted-foreground" /> : null}</td></tr>; })}</tbody></table></div>{!receivables.isLoading && filtered.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">Nenhuma conta a receber encontrada.</p>}</div>
    </div>
    <Dialog open={Boolean(selected)} onOpenChange={v => !v && setSelected(null)}><DialogContent><DialogHeader><DialogTitle>Registrar pagamento</DialogTitle></DialogHeader>{selected && <div className="space-y-4"><div className="rounded-lg bg-muted/40 p-3"><p className="text-sm font-medium">{names.get(selected.customer_id) ?? "Cliente"}</p><p className="mt-1 text-sm text-muted-foreground">Saldo: <strong className="numeric">{moeda(Number(selected.valor) - Number(selected.valor_pago))}</strong></p></div><div><Label htmlFor="pagamento-valor">Valor recebido</Label><Input id="pagamento-valor" inputMode="decimal" placeholder="0,00" value={payment.valor} onChange={e => setPayment({ ...payment, valor: e.target.value })} /></div><div><Label>Forma de pagamento</Label><Select value={payment.forma} onValueChange={forma => setPayment({ ...payment, forma: forma as typeof payment.forma })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="dinheiro">Dinheiro</SelectItem><SelectItem value="pix">PIX</SelectItem><SelectItem value="debito">Débito</SelectItem><SelectItem value="credito">Crédito</SelectItem><SelectItem value="outros">Outros</SelectItem></SelectContent></Select></div><Button className="w-full" onClick={() => pay.mutate()} disabled={pay.isPending}>{pay.isPending ? "Registrando..." : "Confirmar recebimento"}</Button></div>}</DialogContent></Dialog>
  </>;
}
