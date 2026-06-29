export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="h-6 w-48 rounded-bosch bg-surface-muted mb-3" />
      <div className="h-4 w-80 rounded-bosch bg-surface-muted mb-6" />
      <div className="border border-surface-border rounded-bosch overflow-hidden">
        <div className="h-10 bg-surface-muted" />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-12 border-t border-surface-border bg-white" />
        ))}
      </div>
    </div>
  );
}
