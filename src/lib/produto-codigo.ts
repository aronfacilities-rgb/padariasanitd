/**
 * Códigos de produto.
 *
 * O sistema gera um código interno curto e sequencial ("P00001") quando o
 * usuário não informa nenhum. A partir desse código também é possível gerar um
 * código de barras EAN-13 válido usando o prefixo 200, reservado para uso
 * interno da loja (não conflita com códigos de fabricantes).
 */

const PREFIXO_INTERNO = "P";
const DIGITOS_INTERNO = 5;

/** Extrai o número de um código interno gerado pelo sistema ("P00012" → 12). */
function numeroDoCodigo(codigo: string | null | undefined): number | null {
  if (!codigo) return null;
  const match = codigo.trim().toUpperCase().match(/^P(\d{1,9})$/);
  if (!match?.[1]) return null;
  const numero = Number(match[1]);
  return Number.isInteger(numero) ? numero : null;
}

/** Próximo código interno livre, olhando os códigos já cadastrados. */
export function proximoCodigoInterno(existentes: (string | null)[]): string {
  let maior = 0;
  for (const codigo of existentes) {
    const numero = numeroDoCodigo(codigo);
    if (numero !== null && numero > maior) maior = numero;
  }
  return `${PREFIXO_INTERNO}${String(maior + 1).padStart(DIGITOS_INTERNO, "0")}`;
}

/** Dígito verificador do EAN-13 (soma ponderada 1/3). */
function digitoEan13(base12: string): number {
  let soma = 0;
  for (let i = 0; i < 12; i += 1) {
    const digito = Number(base12[i]);
    soma += i % 2 === 0 ? digito : digito * 3;
  }
  return (10 - (soma % 10)) % 10;
}

/**
 * Gera um EAN-13 de uso interno a partir de qualquer código.
 * Usa apenas os dígitos do código informado; se não houver dígitos suficientes,
 * completa com zeros à esquerda.
 */
export function gerarEan13(codigo: string): string {
  const digitos = codigo.replace(/\D/g, "").slice(-9).padStart(9, "0");
  const base = `200${digitos}`;
  return `${base}${digitoEan13(base)}`;
}

/** Confere se um texto lido pelo leitor parece um código de barras válido. */
export function limparCodigoBarras(texto: string): string {
  return texto.trim().replace(/\s+/g, "");
}
