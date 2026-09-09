CREATE OR REPLACE FUNCTION public.admin_delete_cash_closing(_cash_register_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas o Administrador pode apagar fechamentos do caixa.';
  END IF;

  UPDATE public.financial_entries SET cash_register_id = NULL WHERE cash_register_id = _cash_register_id;
  UPDATE public.sales SET cash_register_id = NULL WHERE cash_register_id = _cash_register_id;
  UPDATE public.receivable_payments SET cash_register_id = NULL WHERE cash_register_id = _cash_register_id;

  DELETE FROM public.cash_registers WHERE id = _cash_register_id AND status = 'fechado';
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_cash_closing(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_cash_closing(uuid) TO authenticated;