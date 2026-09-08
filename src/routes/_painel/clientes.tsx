import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Eye, Pencil, Plus, Search, Trash2, X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_painel/clientes")({ component: ClientesPage });

type Customer = {
  id: string;
  nome: string;
  telefone: string | null;
  observacao: string | null;
  limite_credito: number;
  ativo: boolean;
  created_at: string;
};

type Receivable = {
  id: string;
  valor: number;
  valor_pago: number;
  vencimento: string | null;
  status: string;
  created_at: string;
  sale_id: string | null;
};

function moeda(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function ClientesPage() {
  const { isOperator, isManager } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState<Customer | null>(null);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState({ nome: "", telefone: "", limite_credito: "0", observacao: "" });

  const customers = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("id,nome,telefone,observacao,limite_credito,ativo,created_at").order("nome");
      if (error) throw error;
      return (data ?? []) as Customer[];
    },
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return customers.data ?? [];
    return (customers.data ?? []).filter((c) => c.nome.toLowerCase().includes(term) || (c.telefone ?? "").toLowerCase().includes(term));
  }, [customers.data, search]);

  const save = useMutation({
    mutationFn: async () => {
      const nome = form.nome.trim();
      if (!nome) throw new Error("Informe o nome do cliente.");
      const payload = { nome, telefone: form.telefone.trim() || null, observacao: form.observacao.trim() || null, limite_credito: Number(form.limite_credito.replace(",", ".")) || 0 };
      if (editing) {
        const { error } = await supabase.from("customers").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("customers").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Cliente atualizado." : "Cliente cadastrado.");
      setOpen(false); setEditing(null); void qc.invalidateQueries({ queryKey: ["clientes"] });
    },
    onError: (e: Error) => toast.error("Não foi possível salvar", { description: e.message }),
  });

  const toggleActive = useMutation({
    mutationFn: async (customer: Customer) => {
      const { error } = await supabase.from("customers").update({ ativo: !customer.ativo }).eq("id", customer.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Status do cliente atualizado."); void qc.invalidateQueries({ queryKey: ["clientes"] }); },
    onError: (e: Error) => toast.error("Não foi possível alterar o status", { description: e.message }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Cliente excluído."); void qc.invalidateQueries({ queryKey: ["clientes"] }); },
    onError: (e: Error) => toast.error("Não foi possível excluir", { description: "Clientes com fiado registrado não podem ser removidos. Inative o cadastro ou quite os débitos primeiro." }),
  });

  function novo() {
    setEditing(null); setForm({ nome: "", telefone: "", limite_credito: "0", observacao: "" }); setOpen(true);
  }
  function editar(c: Customer) {
    setEditing(c); setForm({ nome: c.nome, telefone: c.telefone ?? "", limite_credito: String(c.limite_credito ?? 0), observacao: c.observacao ?? "" }); setOpen(true);
  }

  return (
    <>
      <PageHeader title="Clientes" description="Cadastro, histórico e controle de crédito dos clientes." />
      <div className="space-y-4">
        <div className="panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-md"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar por nome ou telefone..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          {isOperator && <Button onClick={novo}><Plus className="size-4" /> Novo cliente</Button>}
        </div>
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="border-b bg-muted/30"><tr><th className="px-4 py-3 text-left">Cliente</th><th className="px-4 py-3 text-left">Telefone</th><th className="px-4 py-3 text-right">Limite</th><th className="px-4 py-3 text-center">Status</th><th className="px-4 py-3 text-right">Ações</th></tr></thead>
            <tbody>{filtered.map((c) => <tr key={c.id} className="border-b last:border-0"><td className="px-4 py-3 font-medium">{c.nome}</td><td className="px-4 py-3 text-muted-foreground">{c.telefone || "—"}</td><td className="px-4 py-3 text-right numeric">{moeda(c.limite_credito)}</td><td className="px-4 py-3 text-center"><Badge variant={c.ativo ? "default" : "secondary"}>{c.ativo ? "Ativo" : "Inativo"}</Badge></td><td className="px-4 py-3"><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" onClick={() => setDetails(c)} title="Ver histórico"><Eye className="size-4" /></Button>{isOperator && <Button variant="ghost" size="icon" onClick={() => editar(c)} title="Editar"><Pencil className="size-4" /></Button>}{isOperator && <Button variant="ghost" size="icon" onClick={() => toggleActive.mutate(c)} title={c.ativo ? "Inativar" : "Ativar"}><X className="size-4" /></Button>}{isManager && <Button variant="ghost" size="icon" onClick={() => remove.mutate(c.id)} title="Excluir"><Trash2 className="size-4" /></Button>}</div></td></tr>)}</tbody>
          </table></div>
          {!customers.isLoading && filtered.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">Nenhum cliente encontrado.</p>}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>{editing ? "Editar cliente" : "Novo cliente"}</DialogTitle></DialogHeader><div className="space-y-4"><div><Label htmlFor="cliente-nome">Nome *</Label><Input id="cliente-nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div><div><Label htmlFor="cliente-telefone">Telefone</Label><Input id="cliente-telefone" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></div><div><Label htmlFor="cliente-limite">Limite de crédito</Label><Input id="cliente-limite" inputMode="decimal" value={form.limite_credito} onChange={(e) => setForm({ ...form, limite_credito: e.target.value })} /></div><div><Label htmlFor="cliente-obs">Observação</Label><Textarea id="cliente-obs" value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} /></div><Button className="w-full" onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Salvando..." : "Salvar cliente"}</Button></div></DialogContent></Dialog>

      <CustomerHistory customer={details} onClose={() => setDetails(null)} />
    </>
  );
}

function CustomerHistory({ customer, onClose }: { customer: Customer | null; onClose: () => void }) {
  const history = useQuery({
    queryKey: ["cliente-historico", customer?.id],
    enabled: Boolean(customer),
    queryFn: async () => {
      if (!customer) return [] as Receivable[];
      const { data, error } = await supabase.from("accounts_receivable").select("id,valor,valor_pago,vencimento,status,created_at,sale_id").eq("customer_id", customer.id).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Receivable[];
    },
  });
  const aberto = (history.data ?? []).reduce((sum, r) => sum + Math.max(0, Number(r.valor) - Number(r.valor_pago)), 0);
  return <Dialog open={Boolean(customer)} onOpenChange={(v) => !v && onClose()}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Histórico — {customer?.nome}</DialogTitle></DialogHeader>{customer && <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Limite</p><p className="numeric font-semibold">{moeda(customer.limite_credito)}</p></div><div className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Em aberto</p><p className="numeric font-semibold">{moeda(aberto)}</p></div><div className="rounded-lg bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Lançamentos</p><p className="numeric font-semibold">{history.data?.length ?? 0}</p></div></div><div className="max-h-72 overflow-y-auto rounded-lg border"><table className="w-full text-sm"><thead className="border-b bg-muted/30"><tr><th className="px-3 py-2 text-left">Data</th><th className="px-3 py-2 text-right">Valor</th><th className="px-3 py-2 text-right">Pago</th><th className="px-3 py-2 text-center">Status</th></tr></thead><tbody>{(history.data ?? []).map((r) => <tr key={r.id} className="border-b last:border-0"><td className="px-3 py-2">{new Date(r.created_at).toLocaleDateString("pt-BR")}</td><td className="px-3 py-2 text-right numeric">{moeda(Number(r.valor))}</td><td className="px-3 py-2 text-right numeric">{moeda(Number(r.valor_pago))}</td><td className="px-3 py-2 text-center">{r.status}</td></tr>)}</tbody></table></div></div>}</DialogContent></Dialog>;
}
