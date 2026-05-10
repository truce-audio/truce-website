import { ImageResponse } from "next/og";
import { getPlugin, plugins } from "@/content/plugins";
import { framework } from "@/content/framework";

export const dynamic = "force-static";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export function generateStaticParams() {
  return plugins.map((p) => ({ slug: p.slug }));
}

export default async function Image({
  params,
}: {
  params: { slug: string };
}) {
  const plugin = getPlugin(params.slug);
  const name = plugin?.name ?? "Plugin";
  const tagline = plugin?.tagline ?? "";
  const formats = plugin?.formats.join(" · ") ?? "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px",
          background: "linear-gradient(135deg, #0a0a0a 0%, #1a0a2e 100%)",
          color: "#fafafa",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 26,
            color: "#a78bfa",
          }}
        >
          <span>{framework.domain}</span>
          <span style={{ color: "#737373" }}>Plugin</span>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 24,
          }}
        >
          <div
            style={{
              fontSize: 92,
              fontWeight: 600,
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
            }}
          >
            {name}
          </div>
          <div
            style={{
              fontSize: 30,
              color: "#a3a3a3",
              maxWidth: 980,
              lineHeight: 1.4,
            }}
          >
            {tagline}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 22,
            color: "#737373",
            letterSpacing: "0.05em",
          }}
        >
          {formats}
        </div>
      </div>
    ),
    { ...size },
  );
}
