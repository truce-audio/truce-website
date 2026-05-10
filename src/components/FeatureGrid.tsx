import { features } from "@/content/framework";

export function FeatureGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {features.map((f) => (
        <div
          key={f.title}
          className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-5"
        >
          <h3 className="font-semibold mb-2">{f.title}</h3>
          <p className="text-sm text-[var(--fg-muted)] leading-relaxed">{f.body}</p>
        </div>
      ))}
    </div>
  );
}
