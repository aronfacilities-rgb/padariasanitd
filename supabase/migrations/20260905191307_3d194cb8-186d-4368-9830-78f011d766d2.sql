CREATE TABLE public.comanda_labels (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  numero integer NOT NULL UNIQUE,
  codigo text NOT NULL UNIQUE,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.comanda_labels TO authenticated;
GRANT ALL ON public.comanda_labels TO service_role;

ALTER TABLE public.comanda_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipe pode ver as etiquetas cadastradas"
ON public.comanda_labels FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));

CREATE POLICY "Gerencia pode cadastrar etiquetas"
ON public.comanda_labels FOR INSERT TO authenticated
WITH CHECK (public.is_manager(auth.uid()));