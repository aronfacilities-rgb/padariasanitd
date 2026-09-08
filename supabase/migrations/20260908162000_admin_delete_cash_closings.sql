-- Exclusão de fechamentos do caixa: somente Administrador.
-- O fechamento é um registro de cash_registers; exclusão também remove
-- os movimentos vinculados somente se as FKs existentes permitirem a operação.

GRANT DELETE ON public.cash_registers TO authenticated;

DROP POLICY IF EXISTS "admin_delete_cash_registers" ON public.cash_registers;
CREATE POLICY "admin_delete_cash_registers"
ON public.cash_registers FOR DELETE TO authenticated
USING (public.has_permission(auth.uid(), 'caixa_exclusao'));

UPDATE public.role_permissions
SET permitido = (role = 'admin')
WHERE permission = 'caixa_exclusao';
