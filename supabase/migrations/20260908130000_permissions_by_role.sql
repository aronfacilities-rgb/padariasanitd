-- ============ PERMISSÕES POR FUNÇÃO ============
-- Base para controle de acesso por módulo/ação sem remover a autorização
-- já existente por app_role. A administração poderá configurar estes valores
-- pela tela de Configurações em uma etapa posterior.

CREATE TABLE public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL,
  permission TEXT NOT NULL,
  permitido BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (role, permission)
);

CREATE INDEX idx_role_permissions_role ON public.role_permissions(role);
CREATE INDEX idx_role_permissions_permission ON public.role_permissions(permission);

GRANT SELECT ON public.role_permissions TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id UUID, _permission TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role = ur.role
    WHERE ur.user_id = _user_id
      AND rp.permission = _permission
      AND rp.permitido = true
  );
$$;

REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated;

CREATE TRIGGER role_permissions_updated_at
BEFORE UPDATE ON public.role_permissions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Leitura para usuários autenticados: a aplicação precisa saber quais
-- permissões a própria função possui. Alterações ficam restritas à gerência.
CREATE POLICY "staff_read_role_permissions"
ON public.role_permissions FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));

CREATE POLICY "manager_insert_role_permissions"
ON public.role_permissions FOR INSERT TO authenticated
WITH CHECK (public.is_manager(auth.uid()));

CREATE POLICY "manager_update_role_permissions"
ON public.role_permissions FOR UPDATE TO authenticated
USING (public.is_manager(auth.uid()))
WITH CHECK (public.is_manager(auth.uid()));

CREATE POLICY "manager_delete_role_permissions"
ON public.role_permissions FOR DELETE TO authenticated
USING (public.is_manager(auth.uid()));

-- ============ PADRÕES INICIAIS ============
-- Os módulos abaixo preservam o comportamento atual do sistema e deixam
-- explícitas as permissões que serão configuráveis na administração.
INSERT INTO public.role_permissions (role, permission)
SELECT r.role, p.permission
FROM unnest(enum_range(NULL::public.app_role)) AS r(role)
CROSS JOIN (
  VALUES
    ('dashboard'),
    ('comandas'),
    ('pdv'),
    ('caixa'),
    ('caixa_edicao'),
    ('caixa_exclusao'),
    ('produtos'),
    ('estoque'),
    ('entradas'),
    ('saidas'),
    ('fiado'),
    ('clientes'),
    ('funcionarios'),
    ('relatorios'),
    ('configuracoes')
) AS p(permission)
ON CONFLICT (role, permission) DO NOTHING;

-- Regras de menor privilégio para ações administrativas sensíveis.
UPDATE public.role_permissions
SET permitido = (role IN ('admin', 'gerente'))
WHERE permission IN ('caixa_edicao', 'caixa_exclusao', 'funcionarios', 'relatorios', 'configuracoes');

UPDATE public.role_permissions
SET permitido = (role IN ('admin', 'gerente', 'caixa', 'atendente'))
WHERE permission IN ('comandas');

UPDATE public.role_permissions
SET permitido = (role IN ('admin', 'gerente', 'caixa'))
WHERE permission IN ('pdv', 'caixa', 'estoque', 'entradas', 'saidas', 'fiado');

UPDATE public.role_permissions
SET permitido = (role IN ('admin', 'gerente', 'caixa', 'atendente', 'funcionario'))
WHERE permission IN ('produtos', 'clientes');

UPDATE public.role_permissions
SET permitido = (role IN ('admin', 'gerente'))
WHERE permission = 'dashboard';
