import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Barcode, Camera, Pencil, Plus, Printer, Search, Trash2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { brl, num } from "@/lib/format";
import { proximoCodigoInterno, gerarEan13, limparCodigoBarras } from "@/lib/produto-codigo";
import { imprimirEtiquetasProduto } from "@/lib/etiqueta-produto";
import { EmptyState, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_painel/produtos")({
  head: () => ({ meta: [
    { title: "Produtos — Padaria Santiago" },
    { name: "description", content: "Cadastro de produtos da Padaria Santiago: preço, custo, estoque e códigos." },
  ]}),
  component: ProdutosPage,
});

const UNIDADES = ["UN", "KG", "G", "L", "ML", "CX", "PCT"];

type Produto = {
  id: string; nome: string; codigo_interno: string | null; codigo_barras: string | null;
  category_id: string | null; unidade: string; preco_venda: number; preco_kg: number | null;
  tipo_venda: string; plu: string | null; custo: number; estoque_atual: number; estoque_minimo: number;
  ncm: string | null; cfop: string | null; cst: string | null; aliquota: number | null; ativo: boolean;
};
type Categoria = { id: string; nome: string };
type ProdutoInput = {
  nome: string; codigo_interno: string | null; codigo_barras: string | null; category_id: string | null;
  unidade: string; preco_venda: number; preco_kg: number | null; tipo_venda: string; plu: string | null;
  custo: number; estoque_minimo: number; ncm: string | null; cfop: string | null; cst: string | null; aliquota: number | null;
};
type BarcodeDetectorLike = { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>> };
type BarcodeDetectorConstructorLike = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

function getBarcodeDetector(): BarcodeDetectorConstructorLike | null {
  return (globalThis as unknown as { BarcodeDetector?: BarcodeDetectorConstructorLike }).BarcodeDetector ?? null;
}

function ScannerDialog({ open, onOpenChange, onDetected }: { open: boolean; onOpenChange: (v: boolean) => void; onDetected: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null); const streamRef = useRef<MediaStream | null>(null);
  const [manual, setManual] = useState(""); const [cameraAtiva, setCameraAtiva] = useState(false); const [cameraErro, setCameraErro] = useState("");
  useEffect(() => {
    if (!open) { streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null; setCameraAtiva(false); setCameraErro(""); setManual(""); return; }
    const Detector = getBarcodeDetector();
    if (!Detector || !navigator.mediaDevices?.getUserMedia) { setCameraErro("Seu navegador não oferece leitura por câmera. Use um leitor USB ou digite o código."); return; }
    let ativo = true; let timer: number | undefined;
    void navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false }).then((stream) => {
      if (!ativo) { stream.getTracks().forEach((t) => t.stop()); return; }
      streamRef.current = stream; if (videoRef.current) { videoRef.current.srcObject = stream; void videoRef.current.play(); }
      setCameraAtiva(true); let detector: BarcodeDetectorLike;
      try { detector = new Detector({ formats: ["ean_13", "ean_8", "code_128", "upc_a", "upc_e"] }); } catch { setCameraErro("O navegador não conseguiu inicializar o leitor de código por câmera."); return; }
      const detectar = async () => { if (!ativo || !videoRef.current) return; try { const r = await detector.detect(videoRef.current); const code = r.find((x) => x.rawValue)?.rawValue; if (code) { onDetected(limparCodigoBarras(code)); onOpenChange(false); return; } } catch {} timer = window.setTimeout(() => void detectar(), 350); };
      timer = window.setTimeout(() => void detectar(), 500);
    }).catch(() => setCameraErro("Não foi possível acessar a câmera. Verifique a permissão do navegador."));
    return () => { ativo = false; if (timer) window.clearTimeout(timer); streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null; };
  }, [open, onDetected, onOpenChange]);
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle className="font-display">Ler código de barras</DialogTitle></DialogHeader><div className="space-y-4"><div className="overflow-hidden rounded-xl border bg-muted"><video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline /></div>{cameraAtiva ? <p className="text-center text-sm text-muted-foreground">Aponte a câmera para o código de barras.</p> : null}{cameraErro ? <p className="text-sm text-muted-foreground">{cameraErro}</p> : null}<form onSubmit={(e) => { e.preventDefault(); const c = limparCodigoBarras(manual); if (c) { onDetected(c); onOpenChange(false); } }} className="flex gap-2"><Input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Digite ou use um leitor USB" autoFocus /><Button type="submit">Usar código</Button></form></div></DialogContent></Dialog>;
}

function ProdutosPage() {
  const { isManager } = useAuth(); const qc = useQueryClient();
  const [busca, setBusca] = useState(""); const [soAtivos, setSoAtivos] = useState(true); const [editando, setEditando] = useState<Produto | null>(null); const [aberto, setAberto] = useState(false); const [scannerAberto, setScannerAberto] = useState(false);
  const produtos = useQuery({ queryKey: ["produtos"], queryFn: async () => { const { data, error } = await supabase.from("products").select("id,nome,codigo_interno,codigo_barras,category_id,unidade,preco_venda,preco_kg,tipo_venda,plu,custo,estoque_atual,estoque_minimo,ncm,cfop,cst,aliquota,ativo").order("nome"); if (error) throw error; return (data ?? []) as Produto[]; } });
  const categorias = useQuery({ queryKey: ["categorias"], queryFn: async () => { const { data, error } = await supabase.from("categories").select("id,nome").eq("ativo", true).order("nome"); if (error) throw error; return (data ?? []) as Categoria[]; } });
  const salvar = useMutation({ mutationFn: async ({ id, dados }: { id: string | null; dados: ProdutoInput }) => { const q = id ? supabase.from("products").update(dados).eq("id", id) : supabase.from("products").insert(dados); const { error } = await q; if (error) throw error; }, onSuccess: () => { toast.success("Produto salvo"); setAberto(false); setEditando(null); void qc.invalidateQueries({ queryKey: ["produtos"] }); }, onError: (e: Error) => toast.error("Erro ao salvar", { description: e.message }) });
  const alternarStatus = useMutation({ mutationFn: async (p: Produto) => { const { error } = await supabase.from("products").update({ ativo: !p.ativo }).eq("id", p.id); if (error) throw error; }, onSuccess: () => { toast.success("Status atualizado"); void qc.invalidateQueries({ queryKey: ["produtos"] }); }, onError: (e: Error) => toast.error("Erro ao atualizar", { description: e.message }) });
  const excluir = useMutation({ mutationFn: async (p: Produto) => { const { error } = await supabase.from("products").delete().eq("id", p.id); if (error) throw error; }, onSuccess: () => { toast.success("Produto excluído"); void qc.invalidateQueries({ queryKey: ["produtos"] }); }, onError: (e: Error) => toast.error("Não foi possível excluir", { description: e.message }) });
  const lista = useMemo(() => { const termo = busca.trim().toLowerCase(); return (produtos.data ?? []).filter((p) => (!soAtivos || p.ativo) && (!termo || p.nome.toLowerCase().includes(termo) || (p.codigo_interno ?? "").toLowerCase().includes(termo) || (p.codigo_barras ?? "").includes(termo) || (p.plu ?? "").includes(termo))); }, [produtos.data, busca, soAtivos]);
  const codigoDetectado = useCallback((codigo: string) => setBusca(codigo), []);
  function imprimir(p: Produto) { const r = imprimirEtiquetasProduto([{ nome: p.nome, codigo: p.codigo_interno, codigoBarras: p.codigo_barras, preco: p.tipo_venda === "PESO" ? (p.preco_kg ?? 0) : p.preco_venda }], "Padaria Santiago"); if (!r.ok) toast.error("Não foi possível preparar a etiqueta"); }
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget); const nome = String(f.get("nome") ?? "").trim(); if (!nome) { toast.error("Informe o nome do produto"); return; }
    const tipo = String(f.get("tipo_venda") ?? "UN"); const codigoInformado = String(f.get("codigo_interno") ?? "").trim(); const codigoInterno = codigoInformado || proximoCodigoInterno((produtos.data ?? []).map((p) => p.codigo_interno)); const barras = limparCodigoBarras(String(f.get("codigo_barras") ?? ""));
    const precoKg = tipo === "PESO" ? Number(f.get("preco_kg") ?? 0) : null; const plu = tipo === "PESO" ? (String(f.get("plu") ?? "").replace(/\D/g, "").padStart(6, "0") || null) : null;
    if (tipo === "PESO" && (!plu || plu.length !== 6)) { toast.error("Informe o PLU com 6 dígitos para o produto de peso."); return; }
    if (tipo === "PESO" && !(Number(precoKg) > 0)) { toast.error("Informe o preço por kg do produto de peso."); return; }
    salvar.mutate({ id: editando?.id ?? null, dados: { nome, codigo_interno: codigoInterno, codigo_barras: barras || gerarEan13(codigoInterno), category_id: String(f.get("category_id") ?? "") !== "sem" ? String(f.get("category_id") ?? "") || null : null, unidade: tipo === "PESO" ? "KG" : String(f.get("unidade") ?? "UN"), preco_venda: tipo === "PESO" ? Number(precoKg ?? 0) : Number(f.get("preco_venda") ?? 0), preco_kg: precoKg, tipo_venda: tipo, plu, custo: Number(f.get("custo") ?? 0), estoque_minimo: Number(f.get("estoque_minimo") ?? 0), ncm: String(f.get("ncm") ?? "") || null, cfop: String(f.get("cfop") ?? "") || null, cst: String(f.get("cst") ?? "") || null, aliquota: f.get("aliquota") ? Number(f.get("aliquota")) : null } });
  }
  return <><PageHeader title="Produtos" description="Cadastro, preços, estoque e códigos dos produtos." actions={isManager ? <Button className="h-11" onClick={() => { setEditando(null); setAberto(true); }}><Plus className="size-4" /> Novo produto</Button> : null} />
    <div className="panel mb-4 flex flex-wrap items-center gap-3 p-4"><div className="relative min-w-56 flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, código, PLU ou código de barras" className="h-11 pl-9" /></div><Button variant="outline" className="h-11" onClick={() => setScannerAberto(true)}><Barcode className="size-4" /> Ler código</Button><label className="flex items-center gap-2 px-1 text-sm"><Switch checked={soAtivos} onCheckedChange={setSoAtivos} /> Somente ativos</label></div>
    {produtos.isLoading ? <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div> : lista.length === 0 ? <EmptyState title="Nenhum produto encontrado" description="Cadastre os produtos da padaria para usar nas comandas e no PDV." /> : <div className="panel divide-y divide-border">{lista.map((p) => <div key={p.id} className="flex flex-wrap items-center gap-3 p-4"><div className="min-w-40 flex-1"><p className="font-medium">{p.nome}</p><p className="text-xs text-muted-foreground">{p.tipo_venda === "PESO" ? `PLU ${p.plu ?? "—"} · ${p.unidade}` : `${p.codigo_interno ? `Cód. ${p.codigo_interno} · ` : ""}${p.codigo_barras ? `EAN ${p.codigo_barras} · ` : ""}${p.unidade}`}</p></div><div className="numeric text-right"><p className="font-semibold">{brl(p.tipo_venda === "PESO" ? (p.preco_kg ?? 0) : p.preco_venda)}</p><p className="text-xs text-muted-foreground">{p.tipo_venda === "PESO" ? "por kg" : `custo ${brl(p.custo)}`}</p></div><div className="w-28 text-right"><p className="numeric font-medium">{num(p.estoque_atual, 3)}</p><p className="text-xs text-muted-foreground">mín. {num(p.estoque_minimo, 2)}</p></div>{p.tipo_venda === "PESO" ? <Badge>PESO</Badge> : null}{!p.ativo ? <Badge variant="secondary">Inativo</Badge> : null}{isManager ? <div className="flex gap-2"><Button variant="outline" size="icon" aria-label={`Editar ${p.nome}`} onClick={() => { setEditando(p); setAberto(true); }}><Pencil className="size-4" /></Button><Button variant="outline" size="icon" onClick={() => imprimir(p)}><Printer className="size-4" /></Button><Button variant="outline" size="sm" onClick={() => alternarStatus.mutate(p)}>{p.ativo ? "Inativar" : "Ativar"}</Button><Button variant="outline" size="icon" onClick={() => { if (window.confirm(`Excluir o produto “${p.nome}”?`)) excluir.mutate(p); }}><Trash2 className="size-4" /></Button></div> : null}</div>)}</div>}
    <Dialog open={aberto} onOpenChange={(v) => { setAberto(v); if (!v) setEditando(null); }}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle className="font-display">{editando ? "Editar produto" : "Novo produto"}</DialogTitle></DialogHeader><form key={editando?.id ?? "novo"} onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2 sm:col-span-2"><Label htmlFor="nome">Nome</Label><Input id="nome" name="nome" defaultValue={editando?.nome ?? ""} required autoFocus /></div>
      <div className="space-y-2"><Label>Tipo de venda</Label><Select name="tipo_venda" defaultValue={editando?.tipo_venda === "PESO" ? "PESO" : "UN"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="UN">Unidade</SelectItem><SelectItem value="PESO">Peso</SelectItem></SelectContent></Select></div>
      <div className="space-y-2"><Label htmlFor="plu">PLU {editando?.tipo_venda === "PESO" ? "(6 dígitos)" : ""}</Label><Input id="plu" name="plu" defaultValue={editando?.plu ?? ""} placeholder="Ex.: 00600" inputMode="numeric" /></div>
      <div className="space-y-2"><Label htmlFor="preco_kg">Preço por kg</Label><Input id="preco_kg" name="preco_kg" type="number" step="0.01" min="0" defaultValue={editando?.preco_kg ?? ""} placeholder="Somente para PESO" /></div>
      <div className="space-y-2"><Label htmlFor="preco_venda">Preço de venda</Label><Input id="preco_venda" name="preco_venda" type="number" step="0.01" min="0" defaultValue={editando?.preco_venda ?? 0} disabled={editando?.tipo_venda === "PESO"} /></div>
      <div className="space-y-2"><Label htmlFor="unidade">Unidade</Label><Select name="unidade" defaultValue={editando?.unidade ?? "UN"}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{UNIDADES.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2"><Label htmlFor="codigo_interno">Código interno</Label><Input id="codigo_interno" name="codigo_interno" defaultValue={editando?.codigo_interno ?? ""} placeholder="Automático se vazio" /></div>
      <div className="space-y-2"><Label htmlFor="codigo_barras">Código de barras</Label><div className="flex gap-2"><Input id="codigo_barras" name="codigo_barras" defaultValue={editando?.codigo_barras ?? ""} placeholder="Automático se vazio" /><Button type="button" variant="outline" size="icon" onClick={() => setScannerAberto(true)}><Camera className="size-4" /></Button></div></div>
      <div className="space-y-2"><Label>Categoria</Label><Select name="category_id" defaultValue={editando?.category_id ?? "sem"}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent><SelectItem value="sem">Sem categoria</SelectItem>{(categorias.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2"><Label htmlFor="custo">Custo</Label><Input id="custo" name="custo" type="number" step="0.01" min="0" defaultValue={editando?.custo ?? 0} /></div>
      <div className="space-y-2"><Label htmlFor="estoque_minimo">Estoque mínimo</Label><Input id="estoque_minimo" name="estoque_minimo" type="number" step="0.001" min="0" defaultValue={editando?.estoque_minimo ?? 0} /></div>
      <div className="rounded-xl border bg-muted/30 p-3 sm:col-span-2"><p className="text-sm font-medium">Balança</p><p className="mt-1 text-xs text-muted-foreground">Produtos PESO usam o PLU e o preço por kg. O valor final da etiqueta não é cadastrado como preço.</p></div>
      <DialogFooter className="sm:col-span-2"><Button type="submit" className="h-11" disabled={salvar.isPending}>{salvar.isPending ? "Salvando..." : "Salvar produto"}</Button></DialogFooter>
    </form></DialogContent></Dialog>
    <ScannerDialog open={scannerAberto} onOpenChange={setScannerAberto} onDetected={codigoDetectado} />
  </>;
}
