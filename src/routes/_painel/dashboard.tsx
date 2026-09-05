import { createFileRoute } from "@tanstack/react-router";
import { 
  ArrowDownRight, 
  ArrowUpRight, 
  Briefcase, 
  Calendar, 
  CheckCircle, 
  CheckCircle2, 
  CircleDashed, 
  Clock, 
  CreditCard, 
  FileText, 
  MoreHorizontal, 
  PlayCircle, 
  Search 
} from "lucide-react";
import {
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid,
  PieChart, 
  Pie, 
  Cell
} from "recharts";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_painel/dashboard")({
  head: () => ({
    meta: [
      { title: "Project Dashboard — Workspace" },
      { name: "description", content: "Gestão unificada de projetos, tarefas e saúde financeira." },
    ],
  }),
  component: DashboardSaaS,
});

// --- DADOS MOCKADOS PARA APRESENTAÇÃO COMERCIAL ---
const REVENUE_DATA = [
  { name: "Jan", revenue: 45000, expenses: 32000 },
  { name: "Fev", revenue: 52000, expenses: 34000 },
  { name: "Mar", revenue: 48000, expenses: 31000 },
  { name: "Abr", revenue: 61000, expenses: 36000 },
  { name: "Mai", revenue: 59000, expenses: 38000 },
  { name: "Jun", revenue: 75000, expenses: 42000 },
];

const STATUS_DATA = [
  { name: "Em Andamento", value: 45, color: "#3B82F6" }, // Azul elétrico
  { name: "Concluídos", value: 35, color: "#10B981" }, // Verde
  { name: "Atrasados", value: 20, color: "#F97316" }, // Laranja
];

const TASKS = [
  { id: 1, title: "Wireframing principal", project: "App Mobile", status: "done" },
  { id: 2, title: "Reunião de kickoff", project: "SaaS Dashboard", status: "in_progress" },
  { id: 3, title: "Revisão de copy", project: "Site Institucional", status: "pending" },
  { id: 4, title: "Exportar assets", project: "App Mobile", status: "pending" },
];

const PROJECTS = [
  { id: 1, name: "SaaS Dashboard", client: "Acme Corp", progress: 75, status: "active" },
  { id: 2, name: "App Mobile", client: "Globex", progress: 40, status: "delayed" },
  { id: 3, name: "E-commerce", client: "Stark Ind.", progress: 100, status: "completed" },
];

const INVOICES = [
  { id: "#INV-2041", amount: "$3,450.00", status: "paid", client: "Acme Corp" },
  { id: "#INV-2042", amount: "$1,200.00", status: "pending", client: "Globex" },
  { id: "#INV-2043", amount: "$850.00", status: "overdue", client: "Stark Ind." },
];

// --- ESTILOS COMPARTILHADOS ---
const cardClass = "relative overflow-hidden bg-card/70 backdrop-blur-3xl border border-border/60 shadow-[0_8px_30px_rgb(0,0,0,0.03)] rounded-[2rem] p-7 flex flex-col transition-all hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)]";

function DashboardSaaS() {
  return (
    <div className="mx-auto max-w-7xl animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out space-y-8 pb-12">
      
      {/* CABEÇALHO SUPERIOR */}
      <header className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="font-display text-4xl font-bold tracking-tight text-foreground">
            Project Dashboard
          </h1>
          <p className="text-base text-muted-foreground">
            Visão geral inteligente de projetos, acompanhamento financeiro e entregas.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/70" />
            <Input 
              placeholder="Pesquisar em tudo..." 
              className="w-full pl-10 rounded-full bg-card/60 border-border/80 shadow-sm h-11 focus-visible:ring-1 focus-visible:ring-primary/30"
            />
          </div>
          <Button variant="outline" className="rounded-full h-11 px-5 shadow-sm bg-card/50 border-border/80 text-foreground/80 hover:bg-card/90">
            <Calendar className="mr-2 size-4" />
            Este Mês
          </Button>
        </div>
      </header>

      {/* VISÃO GERAL (CARDS) */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          title="Receita Total" 
          value="$ 124.500" 
          change="+15%" 
          trend="up" 
          icon={CreditCard} 
          bgIcon="bg-blue-500/10 text-blue-600" 
        />
        <StatCard 
          title="Projetos Ativos" 
          value="12" 
          change="+2" 
          trend="up" 
          icon={Briefcase} 
          bgIcon="bg-emerald-500/10 text-emerald-600" 
        />
        <StatCard 
          title="Horas Registradas" 
          value="342h" 
          change="-5%" 
          trend="down" 
          icon={Clock} 
          bgIcon="bg-orange-500/10 text-orange-600" 
        />
        <StatCard 
          title="Tarefas Concluídas" 
          value="148" 
          change="+12%" 
          trend="up" 
          icon={CheckCircle} 
          bgIcon="bg-purple-500/10 text-purple-600" 
        />
      </div>

      {/* GRÁFICOS PRINCIPAIS */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Receita vs Despesas */}
        <div className={`lg:col-span-2 ${cardClass}`}>
          <div className="mb-6 flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="font-display text-lg font-semibold text-foreground">
                Receita vs. Despesas
              </h3>
              <p className="text-sm text-muted-foreground">Desempenho financeiro ao longo de 2024</p>
            </div>
            <MoreHorizontal className="size-5 text-muted-foreground/50 transition-colors hover:text-foreground cursor-pointer" />
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={REVENUE_DATA} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" strokeOpacity={0.6} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
                  tickFormatter={(val) => `$${val / 1000}k`}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.1)' }}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, undefined]}
                />
                <Line 
                  type="monotone" 
                  dataKey="revenue" 
                  name="Receita" 
                  stroke="#3B82F6" 
                  strokeWidth={3} 
                  dot={false} 
                  activeDot={{ r: 6, strokeWidth: 0, fill: "#3B82F6" }}
                />
                <Line 
                  type="monotone" 
                  dataKey="expenses" 
                  name="Despesas" 
                  stroke="#F97316" 
                  strokeWidth={3} 
                  dot={false} 
                  activeDot={{ r: 6, strokeWidth: 0, fill: "#F97316" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status dos Projetos */}
        <div className={cardClass}>
           <div className="mb-6 flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold text-foreground">
              Status dos Projetos
            </h3>
            <MoreHorizontal className="size-5 text-muted-foreground/50 cursor-pointer" />
          </div>
          <div className="relative flex-1 flex items-center justify-center">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={STATUS_DATA}
                  innerRadius={70}
                  outerRadius={90}
                  paddingAngle={4}
                  dataKey="value"
                  stroke="none"
                >
                  {STATUS_DATA.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px -5px rgba(0,0,0,0.1)' }}
                  itemStyle={{ fontWeight: 500 }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center Label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-display font-bold">12</span>
              <span className="text-xs text-muted-foreground font-medium">Projetos Totais</span>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 px-2">
            {STATUS_DATA.map((item) => (
              <div key={item.name} className="flex flex-col items-center gap-1 text-center">
                <div className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-[10px] font-medium uppercase text-muted-foreground">{item.name}</span>
                <span className="text-sm font-semibold">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* LINHA INFERIOR (LISTAS) */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Visão Geral Projetos */}
        <div className={cardClass}>
          <div className="mb-5 flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold text-foreground">Projetos</h3>
            <Button variant="ghost" size="icon" className="size-8">
              <Search className="size-4" />
            </Button>
          </div>
          <div className="space-y-5">
            {PROJECTS.map((proj) => (
              <div key={proj.id} className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold leading-none">{proj.name}</p>
                    <p className="text-xs text-muted-foreground">{proj.client}</p>
                  </div>
                  <Badge 
                    variant="outline"
                    className={`rounded-lg px-2 text-[10px] uppercase tracking-wider font-semibold border-0 ${
                      proj.status === 'active' ? 'bg-blue-500/10 text-blue-600' : 
                      proj.status === 'completed' ? 'bg-emerald-500/10 text-emerald-600' :
                      'bg-orange-500/10 text-orange-600'
                    }`}
                  >
                    {proj.status === 'active' ? 'Ativo' : proj.status === 'completed' ? 'Finalizado' : 'Atrasado'}
                  </Badge>
                </div>
                <div className="flex items-center gap-3">
                  <Progress value={proj.progress} className="h-1.5" />
                  <span className="text-xs font-semibold w-8 text-right">{proj.progress}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Minhas Tarefas */}
        <div className={cardClass}>
          <div className="mb-5 flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold text-foreground">Minhas Tarefas</h3>
            <Button variant="ghost" size="sm" className="text-xs text-primary">Ver Todas</Button>
          </div>
          <div className="space-y-1">
            {TASKS.map((task) => (
              <div key={task.id} className="group flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-muted/50">
                <button className="mt-0.5 shrink-0 text-muted-foreground hover:text-emerald-500 transition-colors cursor-pointer">
                  {task.status === "done" ? (
                    <CheckCircle2 className="size-5 text-emerald-500" />
                  ) : task.status === "in_progress" ? (
                    <PlayCircle className="size-5 text-blue-500" />
                  ) : (
                    <CircleDashed className="size-5" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${task.status === 'done' ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                    {task.title}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">{task.project}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Faturas (Invoices) */}
        <div className={cardClass}>
          <div className="mb-5 flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold text-foreground">Faturas</h3>
            <Button variant="ghost" size="icon" className="size-8">
              <FileText className="size-4" />
            </Button>
          </div>
          <div className="space-y-4">
            {INVOICES.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between border-b border-border/50 pb-3 last:border-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted/40">
                    <span className="text-xs font-bold text-muted-foreground">
                      {inv.id.replace("#INV-", "")}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium leading-none">{inv.client}</p>
                    <p className="text-xs text-muted-foreground mt-1">{inv.id}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{inv.amount}</p>
                  <p className={`text-[11px] font-medium mt-0.5 ${
                    inv.status === 'paid' ? 'text-emerald-500' :
                    inv.status === 'pending' ? 'text-muted-foreground' :
                    'text-rose-500'
                  }`}>
                    {inv.status === 'paid' ? 'Pago' : inv.status === 'pending' ? 'Pendente' : 'Em Atraso'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- COMPONENTES AUXILIARES ---
function StatCard({
  title,
  value,
  change,
  trend,
  icon: Icon,
  bgIcon
}: {
  title: string;
  value: string;
  change: string;
  trend: "up" | "down";
  icon: React.ElementType;
  bgIcon: string;
}) {
  return (
    <div className={cardClass}>
      <div className="flex items-center gap-4 pb-4">
        <div className={`flex size-11 items-center justify-center rounded-[14px] ${bgIcon}`}>
          <Icon className="size-5" />
        </div>
        <p className="text-sm font-medium text-muted-foreground/90">{title}</p>
      </div>
      <div className="mt-auto">
        <p className="font-display text-[2rem] font-bold tracking-tight text-foreground">
          {value}
        </p>
        <div className="mt-2 flex items-center gap-1.5 text-[13px]">
          <div className={`flex items-center px-1.5 py-0.5 rounded gap-1 font-semibold ${
            trend === "up" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
          }`}>
            {trend === "up" ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            {change}
          </div>
          <span className="text-muted-foreground ml-1">vs período pass.</span>
        </div>
      </div>
    </div>
  );
}
