-- Exclusão de fechamentos do caixa: somente Administrador.
-- Usa uma função SECURITY DEFINER para que o botão consiga remover o
-- fechamento mesmo quando as políticas RLS da tabela bloquearem o DELETE direto.

GRANT DELETE ON public.cash_registers TO authenticated;

DROP POLICY IF EXISTS "admin_delete_cash_registers" ON public.cash_registers;
CREATE POLICY "admin_delete_cash_registers"
ON public.cash_registers FOR DELETE TO authenticated
USING (public.has_permission(auth.uid(), 'caixa_exclusao'));

UPDATE public.role_permissions
SET permitido = (role = 'admin')
WHERE permission = 'caixa_exclusao';

CREATE OR REPLACE FUNCTION public.admin_delete_cash_closing(_cash_register_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_permission(auth.uid(), 'caixa_exclusao') THEN
    RAISE EXCEPTION 'Apenas o Administrador pode apagar fechamentos do caixa.';
  END IF;

  DELETE FROM public.cash_registers
  WHERE id = _cash_register_id
    AND status = 'fechado';

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_cash_closing(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_cash_closing(UUID) TO authenticated;
