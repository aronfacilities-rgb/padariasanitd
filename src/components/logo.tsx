import logoAsset from "@/assets/logo-santiago.png.asset.json";
import { cn } from "@/lib/utils";

/**
 * Logotipo oficial da Padaria Santiago.
 * Servido pelo CDN de assets, então funciona igual na tela e na impressão.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <img
      src={logoAsset.url}
      alt="Padaria Santiago"
      className={cn("h-10 w-auto object-contain", className)}
      loading="eager"
      decoding="sync"
    />
  );
}
