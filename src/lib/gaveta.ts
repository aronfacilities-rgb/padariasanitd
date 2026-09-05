/**
 * Abertura da gaveta de dinheiro (Bematech) a partir do navegador.
 *
 * A caixa de impressão do navegador (`window.print()`) só envia a imagem da
 * página: não há como embutir comandos ESC/POS nela. Para acionar a gaveta é
 * preciso falar direto com a impressora pela porta serial/USB usando a
 * Web Serial API (Chrome/Edge no desktop).
 *
 * Comandos enviados (ambos são aceitos pelas Bematech MP-*):
 *  - ESC 118 n   -> comando legado Bematech de acionamento da gaveta
 *  - ESC p m t1 t2 -> comando ESC/POS padrão de "drawer kick"
 */

/** Tipos mínimos da Web Serial API (ainda ausentes na lib padrão do TS). */
interface SerialPortLike {
  readonly writable: WritableStream<Uint8Array> | null;
  open(options: { baudRate: number }): Promise<void>;
}

interface SerialLike {
  getPorts(): Promise<SerialPortLike[]>;
  requestPort(): Promise<SerialPortLike>;
}

function serialApi(): SerialLike | null {
  const nav = navigator as Navigator & { serial?: SerialLike };
  return nav.serial ?? null;
}

/** Porta já autorizada pelo operador, reaproveitada nas próximas vendas. */
let portaAutorizada: SerialPortLike | null = null;


const COMANDOS = new Uint8Array([
  0x1b, 0x76, 0x32, // ESC v 50 (Bematech)
  0x1b, 0x70, 0x00, 0x19, 0xfa, // ESC p 0 25 250 (ESC/POS)
]);

export type ResultadoGaveta =
  | { ok: true }
  | { ok: false; motivo: "sem-suporte" | "sem-permissao" | "falha" };

function temWebSerial(): boolean {
  return typeof navigator !== "undefined" && "serial" in navigator;
}

/** Indica se o navegador atual consegue acionar a gaveta. */
export function gavetaDisponivel(): boolean {
  return temWebSerial();
}

async function obterPorta(): Promise<SerialPort | null> {
  if (portaAutorizada) return portaAutorizada;

  const serial = navigator.serial;
  const jaAutorizadas = await serial.getPorts();
  if (jaAutorizadas.length > 0) {
    portaAutorizada = jaAutorizadas[0] ?? null;
    if (portaAutorizada) return portaAutorizada;
  }

  // Primeira vez: o navegador exige um gesto do usuário para escolher a porta.
  portaAutorizada = await serial.requestPort();
  return portaAutorizada;
}

/**
 * Envia o comando de abertura da gaveta. Deve ser chamado a partir de um
 * clique do operador (requisito da Web Serial API).
 */
export async function abrirGaveta(): Promise<ResultadoGaveta> {
  if (!temWebSerial()) return { ok: false, motivo: "sem-suporte" };

  try {
    const porta = await obterPorta();
    if (!porta) return { ok: false, motivo: "sem-permissao" };

    if (!porta.writable) {
      await porta.open({ baudRate: 9600 });
    }

    const writer = porta.writable?.getWriter();
    if (!writer) return { ok: false, motivo: "falha" };

    try {
      await writer.write(COMANDOS);
    } finally {
      writer.releaseLock();
    }

    return { ok: true };
  } catch (erro) {
    // `NotFoundError` = o operador fechou o seletor de portas sem escolher.
    if (erro instanceof DOMException && erro.name === "NotFoundError") {
      return { ok: false, motivo: "sem-permissao" };
    }
    portaAutorizada = null;
    return { ok: false, motivo: "falha" };
  }
}
