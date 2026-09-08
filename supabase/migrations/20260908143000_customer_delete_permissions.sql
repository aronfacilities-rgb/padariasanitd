-- Clientes podem ser excluídos por usuários operacionais.
-- A integridade do fiado continua protegida por accounts_receivable ON DELETE RESTRICT.
GRANT DELETE ON public.customers TO authenticated;

CREATE POLICY "operator_delete_customers"
ON public.customers FOR DELETE TO authenticated
USING (public.is_operator(auth.uid()));
