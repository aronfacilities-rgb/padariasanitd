export type BalancaConfig = {
  ativo: boolean;
  prefixo: string;
  tipo_codigo: "EAN-13" | string;
  plu_inicio: number;
  plu_digitos: number;
  variavel_inicio: number;
  variavel_digitos: number;
  variavel_tipo: "PESO" | "VALOR" | string;
  casas_decimais: number;
  digito_verificador_posicao: number;
  validar_digito_verificador: boolean;
  tolerancia_centavos: number;
};

export type ProdutoPeso = {
  id: string;
  nome: string;
  tipo_venda: string;
  unidade: string;
  plu: string | null;
  preco_kg: number | null;
  ativo: boolean;
};

export type LeituraBalanca = {
  codigo: string;
  tipo: "peso_variavel";
  prefixo: string;
  plu: string;
  valorEtiqueta: number | null;
  peso: number | null;
  precoKg: number | null;
  valorCalculado: number | null;
  validado: boolean;
  mensagem: string;
};

export const BALANCA_PADRAO: BalancaConfig = {
  ativo: true,
  prefixo: "2",
  tipo_codigo: "EAN-13",
  plu_inicio: 1,
  plu_digitos: 6,
  variavel_inicio: 7,
  variavel_digitos: 5,
  variavel_tipo: "VALOR",
  casas_decimais: 2,
  digito_verificador_posicao: 12,
  validar_digito_verificador: true,
  tolerancia_centavos: 2,
};

export function normalizarBalancaConfig(value: unknown): BalancaConfig {
  const v = (value && typeof value === "object" ? value : {}) as Partial<BalancaConfig>;
  return {
    ativo: v.ativo ?? BALANCA_PADRAO.ativo,
    prefixo: String(v.prefixo ?? BALANCA_PADRAO.prefixo),
    tipo_codigo: v.tipo_codigo ?? BALANCA_PADRAO.tipo_codigo,
    plu_inicio: Number(v.plu_inicio ?? BALANCA_PADRAO.plu_inicio),
    plu_digitos: Number(v.plu_digitos ?? BALANCA_PADRAO.plu_digitos),
    variavel_inicio: Number(v.variavel_inicio ?? BALANCA_PADRAO.variavel_inicio),
    variavel_digitos: Number(v.variavel_digitos ?? BALANCA_PADRAO.variavel_digitos),
    variavel_tipo: v.variavel_tipo ?? BALANCA_PADRAO.variavel_tipo,
    casas_decimais: Number(v.casas_decimais ?? BALANCA_PADRAO.casas_decimais),
    digito_verificador_posicao: Number(v.digito_verificador_posicao ?? BALANCA_PADRAO.digito_verificador_posicao),
    validar_digito_verificador: v.validar_digito_verificador ?? BALANCA_PADRAO.validar_digito_verificador,
    tolerancia_centavos: Number(v.tolerancia_centavos ?? BALANCA_PADRAO.tolerancia_centavos),
  };
}

export function limparCodigoBalanca(value: string): string {
  return value.trim().replace(/\s+/g, "").replace(/\r|\n/g, "");
}

export function validarEan13(codigo: string): boolean {
  if (!/^\d{13}$/.test(codigo)) return false;
  let soma = 0;
  for (let i = 0; i < 12; i += 1) soma += Number(codigo[i]) * (i % 2 === 0 ? 1 : 3);
  return ((10 - (soma % 10)) % 10) === Number(codigo[12]);
}

export function interpretarCodigoBalanca(codigoBruto: string, cfgInput: BalancaConfig): LeituraBalanca | null {
  const cfg = normalizarBalancaConfig(cfgInput);
  if (!cfg.ativo) return null;
  const codigo = limparCodigoBalanca(codigoBruto);
  if (cfg.tipo_codigo !== "EAN-13" || !/^\d{13}$/.test(codigo)) return null;
  if (!codigo.startsWith(cfg.prefixo)) return null;
  if (cfg.validar_digito_verificador && !validarEan13(codigo)) {
    return { codigo, tipo: "peso_variavel", prefixo: cfg.prefixo, plu: "", valorEtiqueta: null, peso: null, precoKg: null, valorCalculado: null, validado: false, mensagem: "Código de barras inválido ou incompatível com o padrão configurado." };
  }
  const plu = codigo.slice(cfg.plu_inicio, cfg.plu_inicio + cfg.plu_digitos);
  const raw = codigo.slice(cfg.variavel_inicio, cfg.variavel_inicio + cfg.variavel_digitos);
  const inteiro = Number(raw);
  if (!Number.isInteger(inteiro)) return { codigo, tipo: "peso_variavel", prefixo: cfg.prefixo, plu, valorEtiqueta: null, peso: null, precoKg: null, valorCalculado: null, validado: false, mensagem: "Campo variável inválido." };
  const valor = inteiro / 10 ** cfg.casas_decimais;
  return { codigo, tipo: "peso_variavel", prefixo: cfg.prefixo, plu, valorEtiqueta: cfg.variavel_tipo === "VALOR" ? valor : null, peso: cfg.variavel_tipo === "PESO" ? valor : null, precoKg: null, valorCalculado: null, validado: true, mensagem: "Código válido" };
}

export function completarLeituraComProduto(leitura: LeituraBalanca, produto: ProdutoPeso, toleranciaCentavos: number): LeituraBalanca {
  const precoKg = produto.preco_kg == null ? null : Number(produto.preco_kg);
  let peso = leitura.peso;
  let valorCalculado: number | null = null;
  let validado = leitura.validado;

  if (leitura.valorEtiqueta != null && precoKg != null && precoKg > 0) {
    peso = leitura.valorEtiqueta / precoKg;
    valorCalculado = Math.round(peso * precoKg * 100) / 100;
    validado = Math.abs(valorCalculado - leitura.valorEtiqueta) * 100 <= toleranciaCentavos;
  } else if (leitura.peso != null && precoKg != null) {
    valorCalculado = Math.round(leitura.peso * precoKg * 100) / 100;
    validado = leitura.valorEtiqueta == null || Math.abs(valorCalculado - leitura.valorEtiqueta) * 100 <= toleranciaCentavos;
  }

  return { ...leitura, peso: peso == null ? null : Math.round(peso * 1000) / 1000, precoKg, valorCalculado, validado, mensagem: validado ? "Valor validado" : "Atenção: o valor da etiqueta não corresponde ao preço cadastrado do produto." };
}
