-- Produtos de peso variável e integração com etiquetas EAN-13 da balança.
-- A migration é aditiva: não remove nem altera dados existentes.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS tipo_venda TEXT NOT NULL DEFAULT 'UN',
  ADD COLUMN IF NOT EXISTS plu TEXT,
  ADD COLUMN IF NOT EXISTS preco_kg NUMERIC(12,2);

ALTER TABLE public.command_items
  ADD COLUMN IF NOT EXISTS plu TEXT,
  ADD COLUMN IF NOT EXISTS codigo_etiqueta TEXT,
  ADD COLUMN IF NOT EXISTS peso NUMERIC(12,3),
  ADD COLUMN IF NOT EXISTS preco_kg NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS valor_etiqueta NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS valor_calculado NUMERIC(12,2);

ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS plu TEXT,
  ADD COLUMN IF NOT EXISTS codigo_etiqueta TEXT,
  ADD COLUMN IF NOT EXISTS peso NUMERIC(12,3),
  ADD COLUMN IF NOT EXISTS preco_kg NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS valor_etiqueta NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS valor_calculado NUMERIC(12,2);

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_plu_unique
  ON public.products(plu)
  WHERE plu IS NOT NULL AND ativo = true;

CREATE INDEX IF NOT EXISTS idx_products_tipo_venda ON public.products(tipo_venda);
CREATE INDEX IF NOT EXISTS idx_products_plu ON public.products(plu);

-- Configuração inicial da balança. As posições ficam no banco para poderem ser alteradas
-- futuramente sem trocar a lógica do frontend.
UPDATE public.system_settings
SET pdv = jsonb_set(
  COALESCE(pdv, '{}'::jsonb),
  '{balanca}',
  '{"ativo":true,"prefixo":"2","tipo_codigo":"EAN-13","plu_inicio":1,"plu_digitos":5,"variavel_inicio":6,"variavel_digitos":6,"variavel_tipo":"VALOR","casas_decimais":2,"digito_verificador_posicao":12,"validar_digito_verificador":true,"tolerancia_centavos":2}'::jsonb,
  true
)
WHERE id = 'default';

-- Garante configuração mesmo em bases onde a linha default ainda não exista.
INSERT INTO public.system_settings (id, pdv)
VALUES ('default', '{"balanca":{"ativo":true,"prefixo":"2","tipo_codigo":"EAN-13","plu_inicio":1,"plu_digitos":5,"variavel_inicio":6,"variavel_digitos":6,"variavel_tipo":"VALOR","casas_decimais":2,"digito_verificador_posicao":12,"validar_digito_verificador":true,"tolerancia_centavos":2}}'::jsonb)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.validar_ean13(_codigo TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  _base TEXT;
  _soma INTEGER := 0;
  _i INTEGER;
  _digito INTEGER;
BEGIN
  IF _codigo IS NULL OR _codigo !~ '^\d{13}$' THEN RETURN false; END IF;
  _base := substr(_codigo, 1, 12);
  FOR _i IN 1..12 LOOP
    _soma := _soma + substring(_base, _i, 1)::integer * CASE WHEN _i % 2 = 0 THEN 3 ELSE 1 END;
  END LOOP;
  _digito := (10 - (_soma % 10)) % 10;
  RETURN _digito = substring(_codigo, 13, 1)::integer;
END;
$$;

CREATE OR REPLACE FUNCTION public.interpretar_codigo_balanca(_codigo TEXT)
RETURNS TABLE (
  valido BOOLEAN,
  mensagem TEXT,
  codigo TEXT,
  tipo TEXT,
  prefixo TEXT,
  plu TEXT,
  valor_etiqueta NUMERIC,
  valor_inteiro INTEGER,
  casas_decimais INTEGER,
  digito_verificador INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cfg JSONB;
  _codigo_limpo TEXT := regexp_replace(COALESCE(_codigo, ''), '\\s+', '', 'g');
  _prefixo TEXT;
  _plu_inicio INTEGER;
  _plu_digitos INTEGER;
  _var_inicio INTEGER;
  _var_digitos INTEGER;
  _casas INTEGER;
  _dv_pos INTEGER;
  _validar_dv BOOLEAN;
  _valor_raw TEXT;
  _valor_int INTEGER;
  _dv INTEGER;
BEGIN
  SELECT COALESCE(pdv->'balanca', '{}'::jsonb) INTO _cfg
  FROM public.system_settings WHERE id = 'default';

  _prefixo := COALESCE(_cfg->>'prefixo', '2');
  _plu_inicio := COALESCE((_cfg->>'plu_inicio')::integer, 1);
  _plu_digitos := COALESCE((_cfg->>'plu_digitos')::integer, 5);
  _var_inicio := COALESCE((_cfg->>'variavel_inicio')::integer, 6);
  _var_digitos := COALESCE((_cfg->>'variavel_digitos')::integer, 6);
  _casas := COALESCE((_cfg->>'casas_decimais')::integer, 2);
  _dv_pos := COALESCE((_cfg->>'digito_verificador_posicao')::integer, 12);
  _validar_dv := COALESCE((_cfg->>'validar_digito_verificador')::boolean, true);

  IF _codigo_limpo !~ '^\d{13}$' THEN
    RETURN QUERY SELECT false, 'Código de barras inválido ou incompatível com o padrão configurado.', _codigo_limpo, 'EAN-13 / Peso variável', NULL::TEXT, NULL::TEXT, NULL::NUMERIC, NULL::INTEGER, _casas, NULL::INTEGER;
    RETURN;
  END IF;
  IF substr(_codigo_limpo, 1, length(_prefixo)) <> _prefixo THEN
    RETURN QUERY SELECT false, 'Código de barras incompatível com o prefixo da balança.', _codigo_limpo, 'EAN-13 / Peso variável', _prefixo, NULL::TEXT, NULL::NUMERIC, NULL::INTEGER, _casas, NULL::INTEGER;
    RETURN;
  END IF;
  IF _validar_dv AND NOT public.validar_ean13(_codigo_limpo) THEN
    RETURN QUERY SELECT false, 'Código de barras inválido ou incompatível com o padrão configurado.', _codigo_limpo, 'EAN-13 / Peso variável', _prefixo, NULL::TEXT, NULL::NUMERIC, NULL::INTEGER, _casas, NULL::INTEGER;
    RETURN;
  END IF;

  _valor_raw := substr(_codigo_limpo, _var_inicio + 1, _var_digitos);
  _valor_int := _valor_raw::integer;
  _dv := substr(_codigo_limpo, _dv_pos + 1, 1)::integer;

  RETURN QUERY SELECT true, 'Código válido', _codigo_limpo, 'EAN-13 / Peso variável', _prefixo,
    substr(_codigo_limpo, _plu_inicio + 1, _plu_digitos),
    (_valor_int::numeric / power(10, _casas)), _valor_int, _casas, _dv;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validar_ean13(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.interpretar_codigo_balanca(TEXT) TO authenticated;
