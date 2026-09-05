import { cn } from "@/lib/utils";

/**
 * Logotipo oficial da Padaria Santiago.
 * Atualizado para buscar a nova versão com o 'S' e o ramo de trigo.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <img
      src="/uploads/2.png"
      alt="Padaria Santiago"
      className={cn("h-10 w-auto object-contain", className)}
      loading="eager"
      decoding="sync"
    />
  );
}
