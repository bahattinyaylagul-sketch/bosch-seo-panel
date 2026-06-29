import type { TranslationStatus, ExecutionStatus } from "@/lib/types";
import { STATUS_LABELS_TR, EXEC_STATUS_LABELS_TR } from "@/lib/types";

const TRANSLATION_COLORS: Record<TranslationStatus, string> = {
  draft: "bg-surface-muted text-ink-body border-surface-border",
  translated: "bg-bosch-blue/10 text-bosch-blue border-bosch-blue/30",
  approved: "bg-bosch-green/10 text-bosch-green border-bosch-green/30",
};

const EXEC_COLORS: Record<ExecutionStatus, string> = {
  todo: "bg-surface-muted text-ink-body border-surface-border",
  in_progress: "bg-bosch-blue/10 text-bosch-blue border-bosch-blue/30",
  done: "bg-bosch-green/10 text-bosch-green border-bosch-green/30",
};

export function StatusBadge({ status }: { status: TranslationStatus }) {
  return (
    <span
      className={`inline-block rounded-bosch border px-2 py-0.5 text-xs ${TRANSLATION_COLORS[status]}`}
    >
      {STATUS_LABELS_TR[status]}
    </span>
  );
}

export function ExecBadge({ status }: { status: ExecutionStatus }) {
  return (
    <span
      className={`inline-block rounded-bosch border px-2 py-0.5 text-xs ${EXEC_COLORS[status]}`}
    >
      {EXEC_STATUS_LABELS_TR[status]}
    </span>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-body">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-surface-muted border border-surface-border rounded-bosch ${className}`}>
      {children}
    </div>
  );
}
