import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Search } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { brl, num } from "@/lib/format";
import { EmptyState, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_painel/produtos")({
  head: () => ({
    meta: [
      { title: "Produtos — Padaria Santiago" },
      {
        name: "description",
        content:
          "Cadastro de produtos da Padaria Santiago: preço, custo, estoque, códigos e dados fiscais.",
      },
      { property: "og:title", content: "Produtos — Padaria Santiago" },
      { property: "og:description", content: "Cadastro e consulta de produtos da padaria." },
    ],
  }),
  component: ProdutosPage,
});

const UNIDADES = ["UN", "KG", "G", "L", "ML", "CX", "PCT"];

type Produto = {
  id: string;
  nome: string;
  codigo_interno: string | null;
  codigo_barras: string | null;
  category_id: string | null;
  unidade: string;
  preco_venda: number;
  custo: number;
  estoque_atual: number;
  estoque_minimo: number;
  ncm: string | null;
  cfop: string | null;
  cst: string | null;
  aliquota: number | null;
  ativo: boolean;
};

type Categoria = { id: string; nome: string };

type ProdutoInput = {
  nome: string;
  codigo_interno: string | null;
  codigo_barras: string | null;
  category_id: string | null;
  unidade: string;
  preco_venda: number;
  custo: number;
  estoque_minimo: number;
  ncm: string | null;
  cfop: string | null;
  cst: string | null;
  aliquota: number | null;
};

function ProdutosPage() {
  const { isManager, isOperator } = useAuth();
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [soAtivos, setSoAtivos] = useState(true);
  const [editando, setEditando] = useState<Produto | null>(null);
  const [aberto, setAberto] = useState(false);

  const produtos = useQuery({
    queryKey: ["produtos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(
          "id, nome, codigo_interno, codigo_barras, category_id, unidade, preco_venda, custo, estoque_atual, estoque_minimo, ncm, cfop, cst, aliquota, ativo",
        )
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Produto[];
    },
  });

  const categorias = useQuery({
    queryKey: ["categorias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Categoria[];
    },
  });

  const salvar = useMutation({
    mutationFn: async ({ id, dados }: { id: string | null; dados: ProdutoInput }) => {
      if (id) {
        const { error } = await supabase.from("products").update(dados).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert(dados);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Produto salvo");
      setAberto(false);
      setEditando(null);
      void qc.invalidateQueries({ queryKey: ["produtos"] });
    },
    onError: (e: Error) => toast.error("Erro ao salvar", { description: e.message }),
  });

  const alternarStatus = useMutation({
    mutationFn: async (p: Produto) => {
      const { error } = await supabase
        .from("products")
        .update({ ativo: !p.ativo })
        .eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status atualizado");
      void qc.invalidateQueries({ queryKey: ["produtos"] });
    },
    onError: (e: Error) => toast.error("Erro ao atualizar", { description: e.message }),
  });

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (produtos.data ?? []).filter((p) => {
      if (soAtivos && !p.ativo) return false;
      if (!termo) return true;
      return (
        p.nome.toLowerCase().includes(termo) ||
        (p.codigo_interno ?? "").toLowerCase().includes(termo) ||
        (p.codigo_barras ?? "").toLowerCase().includes(termo)
      );
    });
  }, [produtos.data, busca, soAtivos]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const nome = String(f.get("nome") ?? "").trim();
    if (!nome) {
      toast.error("Informe o nome do produto");
      return;
    }
    const categoria = String(f.get("category_id") ?? "");
    salvar.mutate({
      id: editando?.id ?? null,
      dados: {
        nome,
        codigo_interno: String(f.get("codigo_interno") ?? "") || null,
        codigo_barras: String(f.get("codigo_barras") ?? "") || null,
        category_id: categoria && categoria !== "sem" ? categoria : null,
        unidade: String(f.get("unidade") ?? "UN"),
        preco_venda: Number(f.get("preco_venda") ?? 0),
        custo: Number(f.get("custo") ?? 0),
        estoque_minimo: Number(f.get("estoque_minimo") ?? 0),
        ncm: String(f.get("ncm") ?? "") || null,
        cfop: String(f.get("cfop") ?? "") || null,
        cst: String(f.get("cst") ?? "") || null,
        aliquota: f.get("aliquota") ? Number(f.get("aliquota")) : null,
      },
    });
  }

  return (
    <>
      <PageHeader
        title="Produtos"
        description="Cadastro, preços, estoque e dados fiscais dos produtos."
        actions={
          isManager ? (
            <Dialog
              open={aberto}
              onOpenChange={(v) => {
                setAberto(v);
                if (!v) setEditando(null);
              }}
            >
              <DialogTrigger asChild>
                <Button className="h-11">
                  <Plus className="size-4" /> Novo produto
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle className="font-display">
                    {editando ? "Editar produto" : "Novo produto"}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="nome">Nome</Label>
                    <Input id="nome" name="nome" defaultValue={editando?.nome ?? ""} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="codigo_interno">Código interno</Label>
                    <Input
                      id="codigo_interno"
                      name="codigo_interno"
                      defaultValue={editando?.codigo_interno ?? ""}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="codigo_barras">Código de barras</Label>
                    <Input
                      id="codigo_barras"
                      name="codigo_barras"
                      defaultValue={editando?.codigo_barras ?? ""}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category_id">Categoria</Label>
                    <Select name="category_id" defaultValue={editando?.category_id ?? "sem"}>
                      <SelectTrigger id="category_id">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sem">Sem categoria</SelectItem>
                        {(categorias.data ?? []).map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="unidade">Unidade</Label>
                    <Select name="unidade" defaultValue={editando?.unidade ?? "UN"}>
                      <SelectTrigger id="unidade">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {UNIDADES.map((u) => (
                          <SelectItem key={u} value={u}>
                            {u}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="preco_venda">Preço de venda</Label>
                    <Input
                      id="preco_venda"
                      name="preco_venda"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={editando?.preco_venda ?? 0}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="custo">Custo</Label>
                    <Input
                      id="custo"
                      name="custo"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={editando?.custo ?? 0}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="estoque_minimo">Estoque mínimo</Label>
                    <Input
                      id="estoque_minimo"
                      name="estoque_minimo"
                      type="number"
                      step="0.001"
                      min="0"
                      defaultValue={editando?.estoque_minimo ?? 0}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ncm">NCM</Label>
                    <Input id="ncm" name="ncm" defaultValue={editando?.ncm ?? ""} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cfop">CFOP</Label>
                    <Input id="cfop" name="cfop" defaultValue={editando?.cfop ?? ""} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cst">CST / CSOSN</Label>
                    <Input id="cst" name="cst" defaultValue={editando?.cst ?? ""} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="aliquota">Alíquota (%)</Label>
                    <Input
                      id="aliquota"
                      name="aliquota"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={editando?.aliquota ?? ""}
                    />
                  </div>
                  <DialogFooter className="sm:col-span-2">
                    <Button type="submit" className="h-11" disabled={salvar.isPending}>
                      {salvar.isPending ? "Salvando..." : "Salvar produto"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          ) : null
        }
      />

      <div className="panel mb-4 flex flex-wrap items-center gap-4 p-4">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, código ou código de barras"
            className="h-11 pl-9"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={soAtivos} onCheckedChange={setSoAtivos} /> Somente ativos
        </label>
      </div>

      {produtos.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : lista.length === 0 ? (
        <EmptyState
          title="Nenhum produto encontrado"
          description="Cadastre os produtos da padaria para usar nas comandas e no PDV."
        />
      ) : (
        <div className="panel divide-y divide-border">
          {lista.map((p) => {
            const baixo = Number(p.estoque_minimo) > 0 && Number(p.estoque_atual) <= Number(p.estoque_minimo);
            return (
              <div key={p.id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-40 flex-1">
                  <p className="font-medium">{p.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.codigo_interno ? `Cód. ${p.codigo_interno} · ` : ""}
                    {p.codigo_barras ? `EAN ${p.codigo_barras} · ` : ""}
                    {p.unidade}
                  </p>
                </div>
                <div className="numeric text-right">
                  <p className="font-semibold">{brl(p.preco_venda)}</p>
                  <p className="text-xs text-muted-foreground">custo {brl(p.custo)}</p>
                </div>
                <div className="w-28 text-right">
                  <p className={`numeric font-medium ${baixo ? "text-destructive" : ""}`}>
                    {num(p.estoque_atual, 2)}
                  </p>
                  <p className="text-xs text-muted-foreground">mín. {num(p.estoque_minimo, 2)}</p>
                </div>
                {!p.ativo ? <Badge variant="secondary">Inativo</Badge> : null}
                {baixo ? <Badge variant="destructive">Estoque baixo</Badge> : null}
                {isManager ? (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label={`Editar ${p.nome}`}
                      onClick={() => {
                        setEditando(p);
                        setAberto(true);
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => alternarStatus.mutate(p)}
                      disabled={!isOperator}
                    >
                      {p.ativo ? "Inativar" : "Ativar"}
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
