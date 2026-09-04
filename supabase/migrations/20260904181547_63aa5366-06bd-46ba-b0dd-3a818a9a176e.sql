REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_initial_role() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_inventory_movement() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalc_command_total() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_receivable_payment() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_manager(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_operator(uuid) FROM anon;