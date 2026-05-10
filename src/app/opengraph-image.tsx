import { ImageResponse } from "next/og";
import { framework } from "@/content/framework";

export const dynamic = "force-static";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = `${framework.domain} — ${framework.tagline}`;

export default function Image() {
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
          backgroundColor: "#1a0b2e",
          backgroundImage:
            "radial-gradient(900px 500px at 90% 10%, rgba(20,240,224,0.18), transparent 60%), radial-gradient(900px 500px at 0% 100%, rgba(255,45,123,0.22), transparent 60%)",
          color: "#f0e4d0",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 28 }}>
          <svg width="40" height="40" viewBox="0 0 64 64">
            <path
              d="M 8 32 C 14 16, 22 16, 32 32 C 42 48, 50 48, 56 32"
              fill="none"
              stroke="#FF2D7B"
              strokeWidth="6"
              strokeLinecap="round"
            />
            <path
              d="M 8 32 C 14 48, 22 48, 32 32 C 42 16, 50 16, 56 32"
              fill="none"
              stroke="#14F0E0"
              strokeWidth="6"
              strokeLinecap="round"
            />
            <circle cx="32" cy="32" r="3" fill="#F0E4D0" />
          </svg>
          <span style={{ display: "flex", color: "#14f0e0" }}>{framework.domain}</span>
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
              fontWeight: 700,
              letterSpacing: "-0.03em",
              lineHeight: 1.02,
              maxWidth: 980,
              color: "#f0e4d0",
            }}
          >
            {framework.tagline}
          </div>
          <div
            style={{
              fontSize: 28,
              color: "#b8a9c9",
              maxWidth: 900,
              lineHeight: 1.4,
            }}
          >
            CLAP, VST3, LV2, AU, AAX, and standalone — from a single Rust crate.
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
