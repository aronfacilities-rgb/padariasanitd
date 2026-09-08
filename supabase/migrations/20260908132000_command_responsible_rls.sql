-- Garante que a identificação do responsável pela abertura de comanda
-- continue vinculada ao usuário autenticado e não possa ser forjada pela UI.

CREATE OR REPLACE FUNCTION public.set_command_responsible()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.aberto_por := auth.uid();
  ELSIF TG_OP = 'UPDATE' AND NEW.aberto_por IS DISTINCT FROM OLD.aberto_por THEN
    NEW.aberto_por := OLD.aberto_por;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS commands_set_responsible ON public.commands;
CREATE TRIGGER commands_set_responsible
BEFORE INSERT OR UPDATE ON public.commands
FOR EACH ROW EXECUTE FUNCTION public.set_command_responsible();

REVOKE EXECUTE ON FUNCTION public.set_command_responsible() FROM PUBLIC;
