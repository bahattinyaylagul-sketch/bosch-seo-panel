import { PageHeader } from "@/components/ui";

export default function SoonModule({
  title,
  description,
  intro,
  features,
  note,
}: {
  title: string;
  description: string;
  intro: string;
  features: string[];
  note?: string;
}) {
  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        action={
          <span className="rounded-bosch bg-surface-muted border border-surface-border px-2.5 py-1 text-xs text-ink-body">
            Yakında
          </span>
        }
      />
      <div className="max-w-3xl">
        <p className="text-sm text-ink-body leading-relaxed mb-5">{intro}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {features.map((f, i) => (
            <div key={i} className="flex items-start gap-2.5 border border-surface-border rounded-bosch p-3">
              <span className="mt-1 inline-block h-2 w-2 rounded-full bg-bosch-blue shrink-0" />
              <span className="text-sm text-ink">{f}</span>
            </div>
          ))}
        </div>
        {note && (
          <p className="mt-5 text-xs text-ink-body bg-surface-muted border border-surface-border rounded-bosch p-3 leading-relaxed">
            {note}
          </p>
        )}
      </div>
    </div>
  );
}
