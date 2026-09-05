import { brl, dateTime, num } from "@/lib/format";

/** Linha impressa no cupom. */
export interface CupomItem {
  nome: string;
  quantidade: number;
  preco: number;
}

export interface CupomData {
  numero: number;
  emitidoEm: string;
  itens: CupomItem[];
  subtotal: number;
  desconto: number;
  total: number;
  forma: string;
  recebido: number;
  troco: number;
  cliente?: string | null;
  operador?: string | null;
  empresa: {
    nome: string;
    cnpj?: string | null;
    endereco?: string | null;
    telefone?: string | null;
  };
}

const LABEL_FORMA: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "Pix",
  debito: "Cartão de débito",
  credito: "Cartão de crédito",
  fiado: "Fiado (a prazo)",
  outros: "Outros",
};

/**
 * Cupom não fiscal (comprovante de venda) formatado para bobina 80mm.
 * Renderizado na tela e reaproveitado na impressão via `#cupom-print`.
 */
export function Cupom({ data }: { data: CupomData }) {
  return (
    <div className="mx-auto w-full max-w-[320px] bg-card px-4 py-4 text-foreground">

      <header className="text-center">
        <p className="font-display text-base font-semibold uppercase">{data.empresa.nome}</p>
        {data.empresa.cnpj ? (
          <p className="numeric text-[11px] text-muted-foreground">CNPJ {data.empresa.cnpj}</p>
        ) : null}
        {data.empresa.endereco ? (
          <p className="text-[11px] text-muted-foreground">{data.empresa.endereco}</p>
        ) : null}
        {data.empresa.telefone ? (
          <p className="numeric text-[11px] text-muted-foreground">{data.empresa.telefone}</p>
        ) : null}
        <p className="mt-2 text-[11px] font-medium uppercase tracking-wide">
          Cupom não fiscal
        </p>
      </header>

      <div className="my-2 border-t border-dashed border-border" />

      <div className="numeric flex justify-between text-[11px]">
        <span>Venda #{data.numero}</span>
        <span>{dateTime(data.emitidoEm)}</span>
      </div>
      {data.operador ? (
        <p className="text-[11px] text-muted-foreground">Operador: {data.operador}</p>
      ) : null}
      {data.cliente ? (
        <p className="text-[11px] text-muted-foreground">Cliente: {data.cliente}</p>
      ) : null}

      <div className="my-2 border-t border-dashed border-border" />

      <ul className="space-y-1">
        {data.itens.map((item, index) => (
          <li key={`${item.nome}-${index}`} className="text-[12px]">
            <p className="font-medium">{item.nome}</p>
            <div className="numeric flex justify-between text-muted-foreground">
              <span>
                {num(item.quantidade, 3)} × {brl(item.preco)}
              </span>
              <span className="font-semibold text-foreground">
                {brl(item.quantidade * item.preco)}
              </span>
            </div>
          </li>
        ))}
      </ul>

      <div className="my-2 border-t border-dashed border-border" />

      <dl className="numeric space-y-1 text-[12px]">
        <Row termo="Subtotal" valor={brl(data.subtotal)} />
        {data.desconto > 0 ? <Row termo="Desconto" valor={`- ${brl(data.desconto)}`} /> : null}
        <Row termo="TOTAL" valor={brl(data.total)} destaque />
        <Row termo="Forma" valor={LABEL_FORMA[data.forma] ?? data.forma} />
        {data.forma === "dinheiro" ? (
          <>
            <Row termo="Recebido" valor={brl(data.recebido)} />
            <Row termo="TROCO" valor={brl(data.troco)} destaque />
          </>
        ) : null}
      </dl>

      <div className="my-2 border-t border-dashed border-border" />

      <p className="text-center text-[11px] text-muted-foreground">
        Obrigado pela preferência! Volte sempre.
      </p>
      <p className="text-center text-[10px] text-muted-foreground">
        Documento sem valor fiscal.
      </p>
    </div>
  );
}

function Row({
  termo,
  valor,
  destaque = false,
}: {
  termo: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <div className={destaque ? "flex justify-between text-sm font-semibold" : "flex justify-between"}>
      <dt className={destaque ? "" : "text-muted-foreground"}>{termo}</dt>
      <dd>{valor}</dd>
    </div>
  );
}
