-- A interface já possui a ação de exclusão, mas a política original
-- de products não concedia DELETE ao usuário autenticado.
GRANT DELETE ON public.products TO authenticated;

CREATE POLICY "manager_delete_products"
ON public.products FOR DELETE TO authenticated
USING (public.is_manager(auth.uid()));
