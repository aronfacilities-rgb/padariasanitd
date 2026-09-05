/**
 * Formato único do código de barras das comandas físicas.
 * O leitor se comporta como teclado: ele "digita" o conteúdo lido e envia
 * Enter. Por isso o código é curto, em CODE128, sem acentos e sem
 * caracteres que dependam de layout de teclado.
 *
 * Formato completo: CMD + número com 6 dígitos (ex.: CMD000012).
 */
const PREFIXO = "CMD";
const DIGITOS = 6;

export function comandaCodigo(numero: number): string {
  return `${PREFIXO}${String(numero).padStart(DIGITOS, "0")}`;
}

/**
 * Extrai o número da comanda de um texto lido pelo leitor.
 * Aceita o código oficial ("CMD000012"), variações antigas com "COMANDA-12"
 * e também um número puro digitado à mão. Retorna null quando não reconhece.
 */
export function parseComandaCodigo(texto: string): number | null {
  const limpo = texto.trim().toUpperCase();
  if (!limpo) return null;
  const match = limpo.match(/^(?:COMANDA|CMD)?[-:\s#]*(\d{1,9})$/);
  if (!match?.[1]) return null;
  const numero = Number(match[1]);
  return Number.isInteger(numero) && numero > 0 ? numero : null;
}
