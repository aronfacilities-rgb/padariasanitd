-- Correção defensiva para bases em que a migration de peso variável ainda não foi aplicada.
-- Não remove dados nem altera produtos existentes.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS tipo_venda TEXT NOT NULL DEFAULT 'UN',
  ADD COLUMN IF NOT EXISTS plu TEXT,
  ADD COLUMN IF NOT EXISTS preco_kg NUMERIC(12,2);

CREATE INDEX IF NOT EXISTS idx_products_tipo_venda ON public.products(tipo_venda);
CREATE INDEX IF NOT EXISTS idx_products_plu ON public.products(plu);

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_plu_unique
  ON public.products(plu)
  WHERE plu IS NOT NULL AND ativo = true;

NOTIFY pgrst, 'reload schema';
