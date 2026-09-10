import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Archive, ArrowRightLeft, BarChart3, ClipboardList, CreditCard, LayoutDashboard, Loader2, LogOut, Menu, Package, Settings, ShieldCheck, ShoppingCart, Users, Wallet, Scale } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROLE_LABEL, useAuth, type AppRole } from "@/lib/auth";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export const Route = createFileRoute("/_painel")({ component: PainelLayout });

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; roles?: AppRole[] };

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "gerente"] },
  { to: "/comandas", label: "Comandas", icon: ClipboardList, roles: ["admin", "gerente", "caixa", "atendente"] },
  { to: "/pdv", label: "PDV", icon: ShoppingCart, roles: ["admin", "gerente", "caixa"] },
  { to: "/caixa", label: "Caixa", icon: Wallet, roles: ["admin", "gerente", "caixa"] },
  { to: "/produtos", label: "Produtos", icon: Package, roles: ["admin", "gerente", "atendente"] },
  { to: "/estoque", label: "Estoque", icon: Archive, roles: ["admin", "gerente", "caixa"] },
  { to: "/lancamentos", label: "Lançamentos", icon: ArrowRightLeft, roles: ["admin", "gerente", "caixa"] },
  { to: "/clientes", label: "Clientes", icon: Users, roles: ["admin", "gerente", "atendente"] },
  { to: "/fiado", label: "Fiado", icon: CreditCard, roles: ["admin", "gerente", "caixa"] },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3, roles: ["admin", "gerente"] },
  { to: "/balanca", label: "Balança", icon: Scale, roles: ["admin"] },
  { to: "/configuracoes", label: "Configurações", icon: Settings, roles: ["admin"] },
];

const MOBILE_KEYS = ["/comandas", "/pdv", "/produtos", "/clientes"];
const ATENDENTE_ALLOWED_ROUTES = ["/comandas", "/produtos", "/clientes"];

function PainelLayout() {
  const { session, loading, profile, roles, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!loading && !session) void navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  useEffect(() => {
    if (loading || !session || !roles.includes("atendente")) return;
    const allowed = ATENDENTE_ALLOWED_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
    if (!allowed) void navigate({ to: "/comandas", replace: true });
  }, [loading, session, roles, pathname, navigate]);

  const visible = NAV.filter((item) => !item.roles || item.roles.some((r) => roles.includes(r)));
  const mobileItems = visible.filter((i) => MOBILE_KEYS.includes(i.to)).slice(0, 4);

  if (loading || !session) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
  if (!roles.length) return <div className="flex min-h-screen items-center justify-center px-6"><div className="panel max-w-md p-8 text-center"><ShieldCheck className="mx-auto size-8 text-muted-foreground" /><h1 className="mt-4 font-display text-xl">Acesso aguardando liberação</h1><p className="mt-2 text-sm text-muted-foreground">Sua conta foi criada, mas ainda não possui permissões. Peça à administração para liberar seu perfil de acesso.</p><Button variant="outline" className="mt-6" onClick={() => void signOut()}>Sair</Button></div></div>;

  const NavLinks = ({ onNavigate }: { onNavigate?: () => void }) => <nav className="space-y-1">{visible.map((item) => { const active = pathname.startsWith(item.to); return <Link key={item.to} to={item.to} onClick={onNavigate} className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors", active ? "bg-sidebar-primary text-sidebar-primary-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground")}><item.icon className="size-4.5 shrink-0" />{item.label}</Link>; })}</nav>;

  return <div className="min-h-screen bg-background"><aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-sidebar p-4 lg:flex"><div className="flex items-center gap-3 px-2 pb-6 pt-2"><Logo className="h-16 rounded-lg bg-card p-1.5" /><div className="text-sidebar-foreground"><p className="font-display text-base leading-tight">Padaria Santiago</p><p className="text-[11px] text-sidebar-foreground/60">Gestão e PDV</p></div></div><div className="flex-1 overflow-y-auto"><NavLinks /></div><div className="mt-4 rounded-xl bg-sidebar-accent/40 p-1"><div className="flex items-center gap-3 p-2"><div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary/20 text-sidebar-primary-foreground"><Users className="size-4.5" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-sidebar-accent-foreground">{profile?.nome || "Funcionário"}</p><p className="truncate text-[11px] text-sidebar-foreground/60">{roles.map((r) => ROLE_LABEL[r]).join(" · ")}</p></div></div><Button variant="ghost" size="sm" className="w-full justify-start gap-2 rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" onClick={() => void signOut()}><LogOut className="size-4" /> Sair</Button></div></aside><header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-card/95 px-4 py-3 backdrop-blur lg:hidden"><div className="flex items-center gap-2"><Logo className="h-9" /><p className="font-display text-base">Padaria Santiago</p></div><Sheet open={menuOpen} onOpenChange={setMenuOpen}><SheetTrigger asChild><Button variant="outline" size="icon" aria-label="Abrir menu"><Menu className="size-5" /></Button></SheetTrigger><SheetContent side="right" className="w-72 bg-sidebar p-4"><SheetTitle className="px-2 font-display text-base text-sidebar-foreground">Menu</SheetTitle><div className="mt-4 max-h-[70vh] overflow-y-auto"><NavLinks onNavigate={() => setMenuOpen(false)} /></div><Button variant="ghost" className="mt-4 w-full justify-start text-sidebar-foreground/80" onClick={() => void signOut()}><LogOut className="size-4" /> Sair</Button></SheetContent></Sheet></header><main className="pb-24 lg:pb-10 lg:pl-64"><div className="mx-auto max-w-7xl px-4 py-5 lg:px-8 lg:py-8"><Outlet /></div></main><nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-card lg:hidden">{mobileItems.map((item) => { const active = pathname.startsWith(item.to); return <Link key={item.to} to={item.to} className={cn("flex flex-1 flex-col items-center gap-1 py-3 text-[11px] font-medium", active ? "text-primary" : "text-muted-foreground")}><item.icon className="size-5" />{item.label}</Link>; })}<button type="button" onClick={() => setMenuOpen(true)} className="flex flex-1 flex-col items-center gap-1 py-3 text-[11px] font-medium text-muted-foreground"><Menu className="size-5" />Mais</button></nav></div>;
}
