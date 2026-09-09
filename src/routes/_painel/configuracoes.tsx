import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Barcode, Info, Loader2, Pencil, Printer, Save, Trash2, UserPlus } from "lucide-react";
import JsBarcode from "jsbarcode";

import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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

type ComandaLabel = {
  numero: number;
  codigo: string;
};

type Employee = {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  cargo: string | null;
  ativo: boolean;
  roles: string[];
};

const employeeRoles = ["admin", "gerente", "caixa", "atendente"] as const;

/**
 * Desenha o código de barras CODE128 em um canvas e devolve a imagem.
 */
function gerarCodigoBarras(codigo: string): string {
  if (typeof document === "undefined") return "";
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
        description="Dados da empresa, gestão de funcionários e cadastro de comandas."
      />
      <Tabs defaultValue="funcionarios">
        <TabsList>
          <TabsTrigger value="funcionarios">Funcionários</TabsTrigger>
          <TabsTrigger value="comandas">Cadastro de Comandas</TabsTrigger>
          <TabsTrigger value="empresa">Empresa</TabsTrigger>
        </TabsList>
        <TabsContent value="funcionarios" className="mt-4">
          <Funcionarios />
        </TabsContent>
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

function Funcionarios() {
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cargo, setCargo] = useState("");
  const [senha, setSenha] = useState("");
  const [role, setRole] = useState<(typeof employeeRoles)[number]>("atendente");
  const [editing, setEditing] = useState<Employee | null>(null);

  const employees = useQuery({
    queryKey: ["funcionarios"],
    queryFn: async () => {
      const [{ data: profiles, error: profilesError }, { data: roles, error: rolesError }] = await Promise.all([
        supabase.from("profiles").select("id, nome, email, telefone, cargo, ativo").order("nome"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (profilesError) throw profilesError;
      if (rolesError) throw rolesError;
      return (profiles ?? []).map((profile) => ({
        ...profile,
        roles: (roles ?? []).filter((item) => item.user_id === profile.id).map((item) => String(item.role)),
      })) as Employee[];
    },
  });

  const limpar = () => {
    setNome(""); setEmail(""); setTelefone(""); setCargo(""); setSenha(""); setRole("atendente"); setEditing(null);
  };

  async function salvarFuncionario() {
    if (editing) {
      const { error: profileError } = await supabase.from("profiles").update({ nome, telefone: telefone || null, cargo: cargo || null }).eq("id", editing.id);
      if (profileError) throw profileError;
      const { error: roleDeleteError } = await supabase.from("user_roles").delete().eq("user_id", editing.id);
      if (roleDeleteError) throw roleDeleteError;
      const { error: roleError } = await supabase.from("user_roles").insert({ user_id: editing.id, role: role as never });
      if (roleError) throw roleError;
      toast.success("Funcionário atualizado");
    } else {
      if (!email.trim() || senha.length < 6 || !nome.trim()) throw new Error("Informe nome, e-mail e uma senha com pelo menos 6 caracteres.");
      const { data, error: authError } = await supabase.auth.signUp({ email: email.trim(), password: senha });
      if (authError) throw authError;
      if (!data.user) throw new Error("Não foi possível criar a conta.");
      const { error: profileError } = await supabase.from("profiles").upsert({ id: data.user.id, nome, email: email.trim(), telefone: telefone || null, cargo: cargo || null, ativo: true });
      if (profileError) throw profileError;
      const { error: roleError } = await supabase.from("user_roles").insert({ user_id: data.user.id, role: role as never });
      if (roleError) throw roleError;
      toast.success("Funcionário cadastrado", { description: "A conta já está ativa e pode entrar com a senha informada." });
    }
    limpar();
    await qc.invalidateQueries({ queryKey: ["funcionarios"] });
  }

  async function excluir(employee: Employee) {
    if (!window.confirm(`Tem certeza que deseja EXCLUIR o funcionário ${employee.nome}? Isso pode não ser possível se houver transações vinculadas.`)) {
      return;
    }
    await supabase.from("user_roles").delete().eq("user_id", employee.id);
    const { error } = await supabase.from("profiles").delete().eq("id", employee.id);
    if (error) {
      toast.error("Não foi possível excluir", { description: "Esse usuário possui registros associados ou vínculos imutáveis. Tente desativá-lo." });
      return;
    }
    toast.success("Funcionário excluído permanentemente.");
    if (editing?.id === employee.id) limpar();
    await qc.invalidateQueries({ queryKey: ["funcionarios"] });
  }

  async function alternarAtivo(employee: Employee) {
    const { error } = await supabase.from("profiles").update({ ativo: !employee.ativo }).eq("id", employee.id);
    if (error) { toast.error("Não foi possível alterar o status", { description: error.message }); return; }
    toast.success(employee.ativo ? "Funcionário desativado" : "Funcionário ativado");
    await qc.invalidateQueries({ queryKey: ["funcionarios"] });
  }

  function editar(employee: Employee) {
    setEditing(employee); setNome(employee.nome); setEmail(employee.email ?? ""); setTelefone(employee.telefone ?? ""); setCargo(employee.cargo ?? ""); setRole((employee.roles[0] as (typeof employeeRoles)[number]) || "atendente");
  }

  return (
    <div className="space-y-4">

      <div className="panel space-y-3 p-4">
        <div className="flex items-center gap-2">
          <UserPlus className="size-5 text-primary" />
          <h2 className="font-display text-lg font-semibold">
            {editing ? "Editar funcionário" : "Cadastrar funcionário"}
          </h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label htmlFor="funcionario-nome">Nome</Label>
            <Input id="funcionario-nome" value={nome} onChange={(event) => setNome(event.target.value)} />
          </div>
          <div>
            <Label htmlFor="funcionario-email">E-mail</Label>
            <Input id="funcionario-email" type="email" value={email} disabled={Boolean(editing)} onChange={(event) => setEmail(event.target.value)} />
          </div>
          <div>
            <Label htmlFor="funcionario-telefone">Telefone</Label>
            <Input id="funcionario-telefone" value={telefone} onChange={(event) => setTelefone(event.target.value)} />
          </div>
          <div>
            <Label htmlFor="funcionario-cargo">Cargo</Label>
            <Input id="funcionario-cargo" value={cargo} onChange={(event) => setCargo(event.target.value)} />
          </div>
          {!editing && (
            <div>
              <Label htmlFor="funcionario-senha">Senha inicial</Label>
              <Input id="funcionario-senha" type="password" value={senha} onChange={(event) => setSenha(event.target.value)} placeholder="Mínimo de 6 caracteres" />
            </div>
          )}
          <div>
            <Label htmlFor="funcionario-nivel">Nível de acesso</Label>
            <select id="funcionario-nivel" value={role} onChange={(event) => setRole(event.target.value as (typeof employeeRoles)[number])} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="admin">Administrador</option>
              <option value="gerente">Gerente</option>
              <option value="caixa">Caixa</option>
              <option value="atendente">Atendente</option>
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void salvarFuncionario().catch((error: Error) => toast.error("Não foi possível salvar", { description: error.message }))}>
            {editing ? <Pencil className="size-4" /> : <UserPlus className="size-4" />}
            {editing ? "Salvar alterações" : "Cadastrar funcionário"}
          </Button>
          {editing && <Button variant="outline" onClick={limpar}>Cancelar</Button>}
        </div>
      </div>
      
      <div className="panel overflow-x-auto p-4">
        <h2 className="font-display text-lg font-semibold">Funcionários cadastrados</h2>
        {employees.isLoading ? (
          <Skeleton className="mt-4 h-40 rounded-xl" />
        ) : employees.data?.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Nenhum funcionário cadastrado.</p>
        ) : (
          <table className="mt-4 w-full min-w-[700px] text-left text-sm">
            <thead className="border-b border-border">
              <tr>
                <th className="px-3 py-3">Nome</th>
                <th className="px-3 py-3">Contato</th>
                <th className="px-3 py-3">Cargo</th>
                <th className="px-3 py-3">Acesso</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {employees.data?.map((employee) => (
                <tr key={employee.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-3 font-medium">{employee.nome || "Sem nome"}</td>
                  <td className="px-3 py-3">{employee.email || employee.telefone || "—"}</td>
                  <td className="px-3 py-3">{employee.cargo || "—"}</td>
                  <td className="px-3 py-3">{employee.roles.join(", ") || "Sem acesso"}</td>
                  <td className="px-3 py-3">{employee.ativo ? "Ativo" : "Inativo"}</td>
                  <td className="flex gap-1 px-3 py-2">
                    <Button variant="ghost" size="icon" onClick={() => editar(employee)} aria-label={`Editar ${employee.nome}`}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => void excluir(employee)} aria-label={`Excluir ${employee.nome}`}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => void alternarAtivo(employee)}>
                      {employee.ativo ? "Desativar" : "Ativar"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function CadastroComandas() {
  const qc = useQueryClient();
  const [de, setDe] = useState("1");
  const [ate, setAte] = useState("20");

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

  const labels = useQuery({
    queryKey: ["comanda-labels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comanda_labels")
        .select("numero, codigo")
        .order("numero");
      if (error) throw error;
      return (data ?? []) as ComandaLabel[];
    },
  });

  const cadastrar = useMutation({
    mutationFn: async () => {
      const inicio = Number(de);
      const fim = Number(ate || de);
      if (!Number.isInteger(inicio) || inicio < 1) {
        throw new Error("Informe um número de comanda válido.");
      }
      if (!Number.isInteger(fim) || fim < inicio) {
        throw new Error("O número final deve ser maior ou igual ao inicial.");
      }
      if (fim - inicio + 1 > 200) {
        throw new Error("Cadastre no máximo 200 etiquetas por vez.");
      }
      const existentes = new Set((labels.data ?? []).map((l) => l.numero));
      const novos = [];
      for (let n = inicio; n <= fim; n += 1) {
        if (!existentes.has(n)) novos.push({ numero: n, codigo: comandaCodigo(n) });
      }
      if (novos.length === 0) {
        throw new Error("Essa faixa já está cadastrada.");
      }
      const { error } = await supabase.from("comanda_labels").insert(novos);
      if (error) throw error;
      return novos.length;
    },
    onSuccess: (quantidade) => {
      toast.success(`${quantidade} etiqueta(s) cadastrada(s) definitivamente`);
      void qc.invalidateQueries({ queryKey: ["comanda-labels"] });
    },
    onError: (error: Error) => {
      toast.error("Não foi possível cadastrar", { description: error.message });
    },
  });

  function imprimir(lista: ComandaLabel[]) {
    if (lista.length === 0) return;
    const janela = window.open("", "_blank", "width=900,height=700");
    if (!janela) {
      toast.error("Libere as janelas pop-up do navegador para imprimir.");
      return;
    }
    const nome = empresa.data?.nome || "Padaria Santiago";
    const cards = lista
      .map(
        (e) => `<div class="etiqueta">
            <div class="info"><span class="loja">${nome}</span><span class="num">COMANDA ${e.numero}</span></div>
            <img src="${gerarCodigoBarras(e.codigo)}" alt="Codigo de barras da comanda ${e.numero}" />
          </div>`,
      )
      .join("");
    janela.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" />
      <title>Etiquetas de comanda</title>
      <style>
        @page { size: A4; margin: 8mm; }
        * { box-sizing: border-box; }
        body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #000; background: #fff; }
        .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 4mm; }
        .etiqueta { border: 1px dashed #999; border-radius: 3mm; padding: 3mm; text-align: center; page-break-inside: avoid; }
        .etiqueta img { width: 100%; height: auto; display: block; }
        .info { margin-bottom: 1mm; display: flex; flex-direction: column; gap: 1mm; }
        .loja { font-size: 8pt; }
        .num { font-size: 12pt; font-weight: 700; letter-spacing: .5px; }
      </style></head><body><div class="grid">${cards}</div>
      <script>window.onload = function () { window.focus(); window.print(); };<\/script>
      </body></html>`);
    janela.document.close();
  }

  const cadastradas = labels.data ?? [];

  return (
    <div className="space-y-4">
      <div className="panel p-4">
        <h2 className="font-display text-lg font-semibold">Cadastrar comandas físicas</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Informe a faixa de números (ex.: 1 a 20). As etiquetas ficam registradas para sempre e o
          código impresso nunca muda nem expira. Cole cada etiqueta na comanda: ao passar o leitor
          no caixa, tudo que foi lançado naquela comanda aparece no PDV com o valor a cobrar.
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
          <Button className="h-11" onClick={() => cadastrar.mutate()} disabled={cadastrar.isPending}>
            {cadastrar.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Barcode className="size-4" />
            )}
            Cadastrar etiquetas
          </Button>
        </div>
      </div>

      <div className="panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-base font-semibold">
            Etiquetas cadastradas ({cadastradas.length})
          </h3>
          <Button
            variant="outline"
            onClick={() => imprimir(cadastradas)}
            disabled={cadastradas.length === 0}
          >
            <Printer className="size-4" /> Imprimir todas
          </Button>
        </div>
        {labels.isLoading ? (
          <Skeleton className="mt-4 h-40 rounded-xl" />
        ) : cadastradas.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Nenhuma etiqueta cadastrada ainda. Cadastre a faixa acima para começar.
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {cadastradas.map((e) => (
              <div key={e.numero} className="rounded-xl border border-border p-3 text-center">
                <p className="numeric text-sm font-semibold">COMANDA {e.numero}</p>
                <img
                  src={gerarCodigoBarras(e.codigo)}
                  alt={`Código de barras da comanda ${e.numero}`}
                  className="mx-auto mt-2 w-full max-w-[240px] rounded-md bg-white p-1"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2"
                  onClick={() => imprimir([e])}
                >
                  <Printer className="size-4" /> Imprimir esta
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
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
