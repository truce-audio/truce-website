import { formatMatrix, formats, platforms } from "@/content/framework";

export function FormatMatrix() {
  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
      <table className="w-full text-sm">
        <thead className="bg-[var(--bg-elevated)] text-left">
          <tr>
            <th className="px-4 py-3 font-medium">Format</th>
            {platforms.map((p) => (
              <th key={p} className="px-4 py-3 font-medium">
                {p}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {formats.map((f) => (
            <tr key={f} className="border-t border-[var(--border)]">
              <td className="px-4 py-3 font-medium">{f}</td>
              {platforms.map((p) => (
                <td key={p} className="px-4 py-3 text-[var(--fg-muted)]">
                  {formatMatrix[f][p] ? (
                    <span className="text-[var(--fg)]">Yes</span>
                  ) : (
                    <span aria-label="Not supported">—</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
