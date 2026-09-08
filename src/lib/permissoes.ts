import { supabase } from "@/integrations/supabase/client";

export async function temPermissao(permission: string) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return false;

  const { data, error } = await supabase.rpc("has_permission", {
    _user_id: userData.user.id,
    _permission: permission,
  });

  if (error) return false;
  return Boolean(data);
}
