DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='products' AND policyname='operator_insert_products') THEN
    CREATE POLICY "operator_insert_products" ON public.products FOR INSERT TO authenticated WITH CHECK (public.is_operator(auth.uid()));
  END IF;
END $$;