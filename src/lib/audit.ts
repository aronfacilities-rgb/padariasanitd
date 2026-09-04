import { supabase } from "@/integrations/supabase/client";

export async function logAudit(params: {
  acao: string;
  entidade?: string;
  registroId?: string;
  dadosAnteriores?: unknown;
  dadosNovos?: unknown;
}) {
  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id;
  if (!userId) return;
  await supabase.from("audit_logs").insert({
    user_id: userId,
    acao: params.acao,
    entidade: params.entidade ?? null,
    registro_id: params.registroId ?? null,
    dados_anteriores: (params.dadosAnteriores ?? null) as never,
    dados_novos: (params.dadosNovos ?? null) as never,
  });
}
