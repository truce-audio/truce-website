export function TitleWithCode({
  text,
  codeClassName = "rounded bg-[var(--bg-code)] px-1 py-px font-mono text-[0.85em] text-[var(--cream)]",
}: {
  text: string;
  codeClassName?: string;
}) {
  const parts = text.split("`");
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <code key={i} className={codeClassName}>
            {part}
          </code>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}
