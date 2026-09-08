-- Exclusao de movimentos financeiros do caixa: somente Administrador.
GRANT DELETE ON public.financial_entries TO authenticated;

DROP POLICY IF EXISTS "admin_delete_financial_entries" ON public.financial_entries;
CREATE POLICY "admin_delete_financial_entries"
ON public.financial_entries
FOR DELETE TO authenticated
USING (public.has_permission(auth.uid(), 'caixa_exclusao'));

-- A exclusao do movimento deve ficar disponivel apenas para a funcao admin.
UPDATE public.role_permissions
SET permitido = (role = 'admin')
WHERE permission = 'caixa_exclusao';
