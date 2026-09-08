import JsBarcode from "jsbarcode";

import { brl } from "@/lib/format";

export type EtiquetaProduto = {
  nome: string;
  codigo: string | null;
  codigoBarras: string | null;
  preco: number | null;
};

/**
 * Desenha o código de barras em um canvas e devolve a imagem PNG.
 * EAN-13 quando o código tem 13 dígitos; CODE128 nos demais casos, para
 * aceitar códigos com letras. Devolve "" quando o código é inválido ou quando
 * não há navegador (renderização no servidor).
 */
function imagemCodigo(codigo: string): string {
  if (typeof document === "undefined") return "";
  try {
    const canvas = document.createElement("canvas");
    const somenteDigitos = /^\d{13}$/.test(codigo);
    JsBarcode(canvas, codigo, {
      format: somenteDigitos ? "EAN13" : "CODE128",
      width: 2,
      height: 60,
      displayValue: true,
      fontSize: 14,
      textMargin: 2,
      margin: 4,
      background: "#ffffff",
      lineColor: "#000000",
    });
    return canvas.toDataURL("image/png");
  } catch {
    return "";
  }
}

function escapar(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Abre uma janela isolada com as etiquetas em folha A4 (3 colunas) e dispara a
 * impressão. Janela própria porque a página do sistema já tem regras de
 * impressão dedicadas ao cupom de 80 mm.
 */
export function imprimirEtiquetasProduto(
  lista: EtiquetaProduto[],
  loja: string,
): { ok: boolean; motivo?: "sem-janela" | "vazio" } {
  if (lista.length === 0) return { ok: false, motivo: "vazio" };
  const janela = window.open("", "_blank", "width=900,height=700");
  if (!janela) return { ok: false, motivo: "sem-janela" };

  const cards = lista
    .map((p) => {
      const codigo = p.codigoBarras || p.codigo || "";
      const imagem = codigo ? imagemCodigo(codigo) : "";
      return `<div class="etiqueta">
        <span class="loja">${escapar(loja)}</span>
        <span class="nome">${escapar(p.nome)}</span>
        ${p.codigo ? `<span class="cod">Cód. ${escapar(p.codigo)}</span>` : ""}
        ${p.preco !== null ? `<span class="preco">${escapar(brl(p.preco))}</span>` : ""}
        ${imagem ? `<img src="${imagem}" alt="Código de barras ${escapar(codigo)}" />` : `<span class="cod">${escapar(codigo)}</span>`}
      </div>`;
    })
    .join("");

  janela.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" />
    <title>Etiquetas de produto</title>
    <style>
      @page { size: A4; margin: 6mm; }
      * { box-sizing: border-box; }
      body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #000; background: #fff; }
      .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3mm; }
      .etiqueta { display: flex; flex-direction: column; align-items: center; gap: 0.5mm;
        border: 1px dashed #999; border-radius: 2mm; padding: 2mm; text-align: center;
        page-break-inside: avoid; }
      .etiqueta img { width: 100%; height: auto; display: block; margin-top: 1mm; }
      .loja { font-size: 7pt; }
      .nome { font-size: 9pt; font-weight: 700; line-height: 1.15; }
      .cod { font-size: 7pt; }
      .preco { font-size: 13pt; font-weight: 700; }
    </style></head><body><div class="grid">${cards}</div>
    <script>window.onload = function () { window.focus(); window.print(); };<\/script>
    </body></html>`);
  janela.document.close();
  return { ok: true };
}
