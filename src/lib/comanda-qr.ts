/**
 * Formato único do QR code das comandas físicas.
 * O leitor de código de barras/QR se comporta como teclado: ele "digita" o
 * conteúdo lido e envia Enter. Por isso o payload é curto, sem acentos e
 * sem caracteres que dependam de layout de teclado.
 */
const PREFIXO = "COMANDA-";

export function comandaQrPayload(numero: number): string {
  return `${PREFIXO}${numero}`;
}

/**
 * Extrai o número da comanda de um texto lido pelo leitor.
 * Aceita o payload oficial ("COMANDA-12"), variações com dois pontos/espaço
 * e também um número puro digitado à mão. Retorna null quando não reconhece.
 */
export function parseComandaQr(texto: string): number | null {
  const limpo = texto.trim().toUpperCase();
  if (!limpo) return null;
  const match = limpo.match(/^(?:COMANDA[-:\s#]*)?(\d{1,9})$/);
  if (!match?.[1]) return null;
  const numero = Number(match[1]);
  return Number.isInteger(numero) && numero > 0 ? numero : null;
}
