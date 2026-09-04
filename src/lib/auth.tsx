import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "gerente" | "caixa" | "atendente" | "funcionario";

export type Profile = {
  id: string;
  nome: string;
  cargo: string | null;
  telefone: string | null;
  email: string | null;
  ativo: boolean;
};

type AuthState = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: AppRole[];
  hasRole: (...roles: AppRole[]) => boolean;
  isManager: boolean;
  isOperator: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  async function load(userId: string) {
    const [{ data: prof }, { data: roleRows }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, nome, cargo, telefone, email, ativo")
        .eq("id", userId)
        .maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    setProfile((prof as Profile | null) ?? null);
    setRoles(((roleRows ?? []) as { role: AppRole }[]).map((r) => r.role));
  }

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (!s) {
        setProfile(null);
        setRoles([]);
      }
    });

    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session) await load(data.session.user.id);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) return;
    void load(session.user.id);
  }, [session?.user?.id]);

  const value: AuthState = {
    loading,
    session,
    user: session?.user ?? null,
    profile,
    roles,
    hasRole: (...check) => check.some((r) => roles.includes(r)),
    isManager: roles.includes("admin") || roles.includes("gerente"),
    isOperator:
      roles.includes("admin") ||
      roles.includes("gerente") ||
      roles.includes("caixa") ||
      roles.includes("atendente"),
    refresh: async () => {
      if (session?.user) await load(session.user.id);
    },
    signOut: async () => {
      await supabase.auth.signOut();
      setProfile(null);
      setRoles([]);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de AuthProvider");
  return ctx;
}

export const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Administrador",
  gerente: "Gerente",
  caixa: "Caixa",
  atendente: "Atendente",
  funcionario: "Funcionário",
};
