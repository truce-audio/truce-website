import { highlight } from "@/lib/highlight";
import { CopyButton } from "./CopyButton";

type CodeBlockProps = {
  code: string;
  lang: string;
  copy?: boolean;
};

export async function CodeBlock({ code, lang, copy = true }: CodeBlockProps) {
  const html = await highlight(code, lang);

  return (
    <div className="relative group">
      {copy && (
        <div className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <CopyButton text={code} />
        </div>
      )}
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
