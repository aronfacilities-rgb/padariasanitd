import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1.5">
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-base text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>
      ) : null}
    </header>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "success" | "warning" | "danger" | "info";
  icon?: ReactNode;
}) {
  const tones = {
    default: { text: "text-foreground", bg: "bg-primary/10 text-primary" },
    success: { text: "text-success", bg: "bg-success/15 text-success" },
    warning: { text: "text-warning", bg: "bg-warning/15 text-warning" },
    danger: { text: "text-destructive", bg: "bg-destructive/15 text-destructive" },
    info: { text: "text-info", bg: "bg-info/15 text-info" },
  };

  const t = tones[tone];

  return (
    <div className="panel flex flex-col justify-between p-5 transition-all duration-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className={cn("numeric font-display text-3xl font-bold tracking-tight", t.text)}>
            {value}
          </p>
        </div>
        {icon ? (
          <div className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", t.bg)}>
            {icon}
          </div>
        ) : null}
      </div>
      {hint ? (
        <p className="mt-4 text-xs font-medium text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-card/40 p-12 text-center transition-colors hover:bg-card/70">
      <div className="space-y-2">
        <p className="font-display text-xl font-semibold text-foreground">{title}</p>
        {description ? (
          <p className="mx-auto max-w-sm text-base text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
