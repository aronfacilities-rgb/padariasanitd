-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin','gerente','caixa','atendente','funcionario');
CREATE TYPE public.command_status AS ENUM ('aberta','em_consumo','aguardando_pagamento','finalizada','cancelada');
CREATE TYPE public.payment_method AS ENUM ('dinheiro','pix','debito','credito','fiado','outros');
CREATE TYPE public.movement_type AS ENUM ('entrada','saida');
CREATE TYPE public.time_record_type AS ENUM ('entrada','inicio_intervalo','retorno_intervalo','saida');

-- ============ HELPERS ============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL DEFAULT '',
  cpf TEXT,
  telefone TEXT,
  email TEXT,
  cargo TEXT,
  admissao DATE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_manager(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','gerente'));
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.is_operator(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','gerente','caixa','atendente'));
$$;

-- primeiro usuario cadastrado torna-se admin
CREATE OR REPLACE FUNCTION public.assign_initial_role()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'funcionario')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER profiles_initial_role AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.assign_initial_role();

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "staff_read_profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_own_profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "update_own_or_manager" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id OR public.is_manager(auth.uid()));

CREATE POLICY "read_roles" ON public.user_roles FOR SELECT TO authenticated USING (true);

-- ============ CATEGORIAS / PRODUTOS ============
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_read_categories" ON public.categories FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "manager_write_categories" ON public.categories FOR ALL TO authenticated
  USING (public.is_manager(auth.uid())) WITH CHECK (public.is_manager(auth.uid()));

CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  codigo_interno TEXT,
  codigo_barras TEXT,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  unidade TEXT NOT NULL DEFAULT 'UN',
  preco_venda NUMERIC(12,2) NOT NULL DEFAULT 0,
  custo NUMERIC(12,2) NOT NULL DEFAULT 0,
  estoque_atual NUMERIC(12,3) NOT NULL DEFAULT 0,
  estoque_minimo NUMERIC(12,3) NOT NULL DEFAULT 0,
  ncm TEXT, cfop TEXT, cst TEXT,
  aliquota NUMERIC(6,2),
  foto_url TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_products_category ON public.products(category_id);
CREATE INDEX idx_products_codigo_barras ON public.products(codigo_barras);
CREATE INDEX idx_products_ativo ON public.products(ativo);
GRANT SELECT, INSERT, UPDATE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER products_updated_at BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "staff_read_products" ON public.products FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "manager_insert_products" ON public.products FOR INSERT TO authenticated WITH CHECK (public.is_manager(auth.uid()));
CREATE POLICY "operator_update_products" ON public.products FOR UPDATE TO authenticated
  USING (public.is_operator(auth.uid())) WITH CHECK (public.is_operator(auth.uid()));

-- ============ ESTOQUE ============
CREATE TABLE public.inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  tipo public.movement_type NOT NULL,
  quantidade NUMERIC(12,3) NOT NULL,
  custo NUMERIC(12,2),
  motivo TEXT,
  fornecedor TEXT,
  observacao TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_inv_mov_product ON public.inventory_movements(product_id);
CREATE INDEX idx_inv_mov_created ON public.inventory_movements(created_at);
GRANT SELECT, INSERT ON public.inventory_movements TO authenticated;
GRANT ALL ON public.inventory_movements TO service_role;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_read_inv" ON public.inventory_movements FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "operator_insert_inv" ON public.inventory_movements FOR INSERT TO authenticated WITH CHECK (public.is_operator(auth.uid()));

CREATE OR REPLACE FUNCTION public.apply_inventory_movement()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.tipo = 'entrada' THEN
    UPDATE public.products SET estoque_atual = estoque_atual + NEW.quantidade WHERE id = NEW.product_id;
  ELSE
    UPDATE public.products SET estoque_atual = estoque_atual - NEW.quantidade WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER inv_mov_apply AFTER INSERT ON public.inventory_movements
FOR EACH ROW EXECUTE FUNCTION public.apply_inventory_movement();

-- ============ CLIENTES (FIADO) ============
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  telefone TEXT,
  observacao TEXT,
  limite_credito NUMERIC(12,2) NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER customers_updated_at BEFORE UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "staff_read_customers" ON public.customers FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "operator_insert_customers" ON public.customers FOR INSERT TO authenticated WITH CHECK (public.is_operator(auth.uid()));
CREATE POLICY "operator_update_customers" ON public.customers FOR UPDATE TO authenticated
  USING (public.is_operator(auth.uid())) WITH CHECK (public.is_operator(auth.uid()));

-- ============ CAIXA ============
CREATE TABLE public.cash_registers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  valor_inicial NUMERIC(12,2) NOT NULL DEFAULT 0,
  aberto_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  aberto_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  fechado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  fechado_em TIMESTAMPTZ,
  valor_esperado NUMERIC(12,2),
  valor_informado NUMERIC(12,2),
  diferenca NUMERIC(12,2),
  observacao TEXT,
  status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','fechado'))
);
GRANT SELECT, INSERT, UPDATE ON public.cash_registers TO authenticated;
GRANT ALL ON public.cash_registers TO service_role;
ALTER TABLE public.cash_registers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_read_cash" ON public.cash_registers FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "operator_insert_cash" ON public.cash_registers FOR INSERT TO authenticated WITH CHECK (public.is_operator(auth.uid()));
CREATE POLICY "operator_update_cash" ON public.cash_registers FOR UPDATE TO authenticated
  USING (public.is_operator(auth.uid()) AND status = 'aberto') WITH CHECK (public.is_operator(auth.uid()));

CREATE TABLE public.financial_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo public.movement_type NOT NULL,
  categoria TEXT NOT NULL,
  valor NUMERIC(12,2) NOT NULL,
  forma_pagamento public.payment_method NOT NULL DEFAULT 'dinheiro',
  descricao TEXT,
  cash_register_id UUID REFERENCES public.cash_registers(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_fin_entries_caixa ON public.financial_entries(cash_register_id);
CREATE INDEX idx_fin_entries_created ON public.financial_entries(created_at);
GRANT SELECT, INSERT ON public.financial_entries TO authenticated;
GRANT ALL ON public.financial_entries TO service_role;
ALTER TABLE public.financial_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_read_fin" ON public.financial_entries FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "operator_insert_fin" ON public.financial_entries FOR INSERT TO authenticated WITH CHECK (public.is_operator(auth.uid()));

-- ============ COMANDAS ============
CREATE TABLE public.commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero INTEGER NOT NULL,
  status public.command_status NOT NULL DEFAULT 'aberta',
  observacao TEXT,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  aberto_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_commands_numero_aberta ON public.commands(numero)
  WHERE status IN ('aberta','em_consumo','aguardando_pagamento');
GRANT SELECT, INSERT, UPDATE ON public.commands TO authenticated;
GRANT ALL ON public.commands TO service_role;
ALTER TABLE public.commands ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER commands_updated_at BEFORE UPDATE ON public.commands
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "staff_read_commands" ON public.commands FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "operator_insert_commands" ON public.commands FOR INSERT TO authenticated WITH CHECK (public.is_operator(auth.uid()));
CREATE POLICY "operator_update_commands" ON public.commands FOR UPDATE TO authenticated
  USING (public.is_operator(auth.uid())) WITH CHECK (public.is_operator(auth.uid()));

CREATE TABLE public.command_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  command_id UUID NOT NULL REFERENCES public.commands(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  quantidade NUMERIC(12,3) NOT NULL DEFAULT 1,
  preco_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
  observacao TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_command_items_command ON public.command_items(command_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.command_items TO authenticated;
GRANT ALL ON public.command_items TO service_role;
ALTER TABLE public.command_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_read_command_items" ON public.command_items FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "operator_write_command_items" ON public.command_items FOR ALL TO authenticated
  USING (public.is_operator(auth.uid())) WITH CHECK (public.is_operator(auth.uid()));

CREATE OR REPLACE FUNCTION public.recalc_command_total()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _cmd UUID;
BEGIN
  _cmd := COALESCE(NEW.command_id, OLD.command_id);
  UPDATE public.commands c
     SET total = COALESCE((SELECT SUM(quantidade * preco_unitario) FROM public.command_items WHERE command_id = _cmd), 0)
   WHERE c.id = _cmd;
  RETURN NULL;
END; $$;
CREATE TRIGGER command_items_recalc AFTER INSERT OR UPDATE OR DELETE ON public.command_items
FOR EACH ROW EXECUTE FUNCTION public.recalc_command_total();

-- ============ VENDAS ============
CREATE SEQUENCE public.sales_numero_seq;
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero BIGINT NOT NULL DEFAULT nextval('public.sales_numero_seq'),
  command_id UUID REFERENCES public.commands(id) ON DELETE SET NULL,
  cash_register_id UUID REFERENCES public.cash_registers(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  desconto NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'finalizada' CHECK (status IN ('finalizada','cancelada')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sales_created ON public.sales(created_at);
CREATE INDEX idx_sales_caixa ON public.sales(cash_register_id);
GRANT SELECT, INSERT, UPDATE ON public.sales TO authenticated;
GRANT ALL ON public.sales TO service_role;
GRANT USAGE ON SEQUENCE public.sales_numero_seq TO authenticated, service_role;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_read_sales" ON public.sales FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "operator_insert_sales" ON public.sales FOR INSERT TO authenticated WITH CHECK (public.is_operator(auth.uid()));
CREATE POLICY "manager_update_sales" ON public.sales FOR UPDATE TO authenticated
  USING (public.is_manager(auth.uid())) WITH CHECK (public.is_manager(auth.uid()));

CREATE TABLE public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  quantidade NUMERIC(12,3) NOT NULL DEFAULT 1,
  preco_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sale_items_sale ON public.sale_items(sale_id);
CREATE INDEX idx_sale_items_product ON public.sale_items(product_id);
GRANT SELECT, INSERT ON public.sale_items TO authenticated;
GRANT ALL ON public.sale_items TO service_role;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_read_sale_items" ON public.sale_items FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "operator_insert_sale_items" ON public.sale_items FOR INSERT TO authenticated WITH CHECK (public.is_operator(auth.uid()));

CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  forma public.payment_method NOT NULL,
  valor NUMERIC(12,2) NOT NULL,
  valor_recebido NUMERIC(12,2),
  troco NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_sale ON public.payments(sale_id);
GRANT SELECT, INSERT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_read_payments" ON public.payments FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "operator_insert_payments" ON public.payments FOR INSERT TO authenticated WITH CHECK (public.is_operator(auth.uid()));

-- ============ FIADO ============
CREATE TABLE public.accounts_receivable (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  valor NUMERIC(12,2) NOT NULL,
  valor_pago NUMERIC(12,2) NOT NULL DEFAULT 0,
  vencimento DATE,
  status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','parcial','pago')),
  observacao TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ar_customer ON public.accounts_receivable(customer_id);
CREATE INDEX idx_ar_status ON public.accounts_receivable(status);
GRANT SELECT, INSERT, UPDATE ON public.accounts_receivable TO authenticated;
GRANT ALL ON public.accounts_receivable TO service_role;
ALTER TABLE public.accounts_receivable ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER ar_updated_at BEFORE UPDATE ON public.accounts_receivable
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "staff_read_ar" ON public.accounts_receivable FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "operator_insert_ar" ON public.accounts_receivable FOR INSERT TO authenticated WITH CHECK (public.is_operator(auth.uid()));
CREATE POLICY "operator_update_ar" ON public.accounts_receivable FOR UPDATE TO authenticated
  USING (public.is_operator(auth.uid())) WITH CHECK (public.is_operator(auth.uid()));

CREATE TABLE public.receivable_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receivable_id UUID NOT NULL REFERENCES public.accounts_receivable(id) ON DELETE CASCADE,
  valor NUMERIC(12,2) NOT NULL,
  forma public.payment_method NOT NULL DEFAULT 'dinheiro',
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  cash_register_id UUID REFERENCES public.cash_registers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_rp_receivable ON public.receivable_payments(receivable_id);
GRANT SELECT, INSERT ON public.receivable_payments TO authenticated;
GRANT ALL ON public.receivable_payments TO service_role;
ALTER TABLE public.receivable_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_read_rp" ON public.receivable_payments FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "operator_insert_rp" ON public.receivable_payments FOR INSERT TO authenticated WITH CHECK (public.is_operator(auth.uid()));

CREATE OR REPLACE FUNCTION public.apply_receivable_payment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.accounts_receivable a
     SET valor_pago = LEAST(a.valor, a.valor_pago + NEW.valor),
         status = CASE
           WHEN a.valor_pago + NEW.valor >= a.valor THEN 'pago'
           WHEN a.valor_pago + NEW.valor > 0 THEN 'parcial'
           ELSE 'aberto' END
   WHERE a.id = NEW.receivable_id;
  RETURN NEW;
END; $$;
CREATE TRIGGER rp_apply AFTER INSERT ON public.receivable_payments
FOR EACH ROW EXECUTE FUNCTION public.apply_receivable_payment();

-- ============ PONTO DIGITAL ============
CREATE TABLE public.time_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo public.time_record_type NOT NULL,
  registrado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  dispositivo TEXT,
  observacao TEXT,
  editado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  motivo_edicao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_time_records_user ON public.time_records(user_id, registrado_em);
GRANT SELECT, INSERT, UPDATE ON public.time_records TO authenticated;
GRANT ALL ON public.time_records TO service_role;
ALTER TABLE public.time_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_own_or_manager_time" ON public.time_records FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_manager(auth.uid()));
CREATE POLICY "insert_own_time" ON public.time_records FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_staff(auth.uid()));
CREATE POLICY "manager_update_time" ON public.time_records FOR UPDATE TO authenticated
  USING (public.is_manager(auth.uid())) WITH CHECK (public.is_manager(auth.uid()));

-- ============ AUDITORIA / CONFIGURACOES ============
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  acao TEXT NOT NULL,
  entidade TEXT,
  registro_id TEXT,
  dados_anteriores JSONB,
  dados_novos JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_created ON public.audit_logs(created_at);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manager_read_audit" ON public.audit_logs FOR SELECT TO authenticated USING (public.is_manager(auth.uid()));
CREATE POLICY "staff_insert_audit" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.system_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  empresa JSONB NOT NULL DEFAULT '{}'::jsonb,
  pdv JSONB NOT NULL DEFAULT '{}'::jsonb,
  fiscal JSONB NOT NULL DEFAULT '{}'::jsonb,
  caixa JSONB NOT NULL DEFAULT '{}'::jsonb,
  fiado JSONB NOT NULL DEFAULT '{"limite_padrao": 200, "vencimento_dias": 30}'::jsonb,
  backup JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.system_settings TO authenticated;
GRANT ALL ON public.system_settings TO service_role;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER settings_updated_at BEFORE UPDATE ON public.system_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "staff_read_settings" ON public.system_settings FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "admin_write_settings" ON public.system_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.system_settings (id, empresa) VALUES ('default', '{"nome":"Padaria Santiago"}'::jsonb);

INSERT INTO public.categories (nome) VALUES ('Padaria'), ('Salgados'), ('Bebidas'), ('Confeitaria'), ('Mercearia');