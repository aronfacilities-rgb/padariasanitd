import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Barcode, Loader2, Printer, Save } from "lucide-react";
import JsBarcode from "jsbarcode";

import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { comandaCodigo } from "@/lib/comanda-codigo";

export const Route = createFileRoute("/_painel/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — Padaria Santiago" },
      {
        name: "description",
        content:
          "Ajuste os dados da empresa e imprima etiquetas com QR code para identificar cada comanda da Padaria Santiago.",
      },
      { property: "og:title", content: "Configurações — Padaria Santiago" },
      {
        property: "og:description",
        content: "Dados da empresa e cadastro de comandas com etiquetas QR code.",
      },
    ],
  }),
  component: ConfiguracoesPage,
});

type EmpresaConfig = {
  nome?: string | null;
  cnpj?: string | null;
  endereco?: string | null;
  telefone?: string | null;
};

type Etiqueta = {
  numero: number;
  codigo: string;
  dataUrl: string;
};

/**
 * Desenha o código de barras CODE128 em um canvas e devolve a imagem.
 * CODE128 aceita letras e números, então cabe o código completo "CMD000012"
 * e qualquer leitor comum de caixa consegue ler.
 */
function gerarCodigoBarras(codigo: string): string {
  const canvas = document.createElement("canvas");
  JsBarcode(canvas, codigo, {
    format: "CODE128",
    width: 2,
    height: 70,
    displayValue: true,
    fontSize: 16,
    textMargin: 2,
    margin: 6,
    background: "#ffffff",
    lineColor: "#000000",
  });
  return canvas.toDataURL("image/png");
}

function ConfiguracoesPage() {
  return (
    <>
      <PageHeader
        title="Configurações"
        description="Dados da empresa e cadastro de comandas com etiquetas QR code."
      />
      <Tabs defaultValue="comandas">
        <TabsList>
          <TabsTrigger value="comandas">Cadastro de Comandas</TabsTrigger>
          <TabsTrigger value="empresa">Empresa</TabsTrigger>
        </TabsList>
        <TabsContent value="comandas" className="mt-4">
          <CadastroComandas />
        </TabsContent>
        <TabsContent value="empresa" className="mt-4">
          <DadosEmpresa />
        </TabsContent>
      </Tabs>
    </>
  );
}

function CadastroComandas() {
  const [de, setDe] = useState("1");
  const [ate, setAte] = useState("1");
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([]);
  const [gerando, setGerando] = useState(false);

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

  async function gerar() {
    const inicio = Number(de);
    const fim = Number(ate || de);
    if (!Number.isInteger(inicio) || inicio < 1) {
      toast.error("Informe um número de comanda válido.");
      return;
    }
    if (!Number.isInteger(fim) || fim < inicio) {
      toast.error("O número final deve ser maior ou igual ao inicial.");
      return;
    }
    if (fim - inicio + 1 > 200) {
      toast.error("Gere no máximo 200 etiquetas por vez.");
      return;
    }
    setGerando(true);
    try {
      const lista: Etiqueta[] = [];
      for (let n = inicio; n <= fim; n += 1) {
        const codigo = comandaCodigo(n);
        lista.push({ numero: n, codigo, dataUrl: gerarCodigoBarras(codigo) });
      }
      setEtiquetas(lista);
    } catch (error) {
      toast.error("Não foi possível gerar as etiquetas", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setGerando(false);
    }
  }

  /**
   * Imprime em uma janela isolada: a página do sistema já usa regras de
   * impressão dedicadas ao cupom de 80 mm, então uma janela própria evita
   * conflito de estilos e permite folha A4 com várias etiquetas.
   */
  function imprimir() {
    if (etiquetas.length === 0) return;
    const janela = window.open("", "_blank", "width=900,height=700");
    if (!janela) {
      toast.error("Libere as janelas pop-up do navegador para imprimir.");
      return;
    }
    const nome = empresa.data?.nome || "Padaria Santiago";
    const cards = etiquetas
      .map(
        (e) => `<div class="etiqueta">
            <div class="info"><span class="loja">${nome}</span><span class="num">COMANDA ${e.numero}</span></div>
            <img src="${e.dataUrl}" alt="Codigo de barras da comanda ${e.numero}" />
          </div>`,
      )
      .join("");
    janela.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" />
      <title>Etiquetas de comanda</title>
      <style>
        @page { size: A4; margin: 8mm; }
        * { box-sizing: border-box; }
        body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #000; background: #fff; }
        .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4mm; }
        .etiqueta { border: 1px dashed #999; border-radius: 3mm; padding: 3mm; text-align: center; page-break-inside: avoid; }
        .etiqueta img { width: 100%; height: auto; display: block; }
        .info { margin-top: 2mm; display: flex; flex-direction: column; gap: 1mm; }
        .loja { font-size: 8pt; }
        .num { font-size: 12pt; font-weight: 700; letter-spacing: .5px; }
      </style></head><body><div class="grid">${cards}</div>
      <script>window.onload = function () { window.focus(); window.print(); };<\/script>
      </body></html>`);
    janela.document.close();
  }

  return (
    <div className="space-y-4">
      <div className="panel p-4">
        <h2 className="font-display text-lg font-semibold">Etiquetas com código de barras</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Informe a faixa de números das comandas físicas. Cada etiqueta traz o código completo
          (ex.: CMD000012). Cole em cada comanda: ao passar o leitor no caixa, a comanda é aberta
          automaticamente no PDV.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div>
            <Label htmlFor="comanda-de">Número inicial</Label>
            <Input
              id="comanda-de"
              inputMode="numeric"
              value={de}
              onChange={(e) => setDe(e.target.value.replace(/\D/g, ""))}
            />
          </div>
          <div>
            <Label htmlFor="comanda-ate">Número final</Label>
            <Input
              id="comanda-ate"
              inputMode="numeric"
              value={ate}
              onChange={(e) => setAte(e.target.value.replace(/\D/g, ""))}
            />
          </div>
          <Button className="h-11" onClick={() => void gerar()} disabled={gerando}>
            {gerando ? <Loader2 className="size-4 animate-spin" /> : <Barcode className="size-4" />}
            Gerar etiquetas
          </Button>
        </div>
      </div>

      {etiquetas.length > 0 ? (
        <div className="panel p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-base font-semibold">
              {etiquetas.length} etiqueta{etiquetas.length > 1 ? "s" : ""} pronta
              {etiquetas.length > 1 ? "s" : ""}
            </h3>
            <Button variant="outline" onClick={imprimir}>
              <Printer className="size-4" /> Imprimir etiquetas
            </Button>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {etiquetas.map((e) => (
              <div key={e.numero} className="rounded-xl border border-border p-3 text-center">
                <img
                  src={e.dataUrl}
                  alt={`Código de barras da comanda ${e.numero}`}
                  className="mx-auto w-full max-w-[240px] rounded-md bg-white p-1"
                />
                <p className="numeric mt-2 text-sm font-semibold">COMANDA {e.numero}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DadosEmpresa() {
  const qc = useQueryClient();
  const [form, setForm] = useState<EmpresaConfig | null>(null);

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

  const valores: EmpresaConfig = form ?? empresa.data ?? {};

  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("system_settings")
        .update({ empresa: valores as never })
        .eq("id", "default");
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dados da empresa salvos");
      void qc.invalidateQueries({ queryKey: ["config-empresa"] });
    },
    onError: (error: Error) => {
      toast.error("Erro ao salvar", { description: error.message });
    },
  });

  if (empresa.isLoading) {
    return <Skeleton className="h-64 rounded-xl" />;
  }

  return (
    <div className="panel max-w-2xl space-y-3 p-4">
      <h2 className="font-display text-lg font-semibold">Dados da empresa</h2>
      {(
        [
          ["nome", "Nome da empresa"],
          ["cnpj", "CNPJ"],
          ["endereco", "Endereço"],
          ["telefone", "Telefone"],
        ] as const
      ).map(([campo, label]) => (
        <div key={campo}>
          <Label htmlFor={`empresa-${campo}`}>{label}</Label>
          <Input
            id={`empresa-${campo}`}
            value={valores[campo] ?? ""}
            onChange={(e) => setForm({ ...valores, [campo]: e.target.value })}
          />
        </div>
      ))}
      <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
        {salvar.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        Salvar
      </Button>
    </div>
  );
}
