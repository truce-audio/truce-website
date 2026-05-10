import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: "#ff2d7b",
          fg: "#0c0518",
          muted: "#ff7aaa",
        },
        cyan: {
          DEFAULT: "#14f0e0",
          muted: "#5cf6ec",
        },
        cream: {
          DEFAULT: "#f0e4d0",
        },
      },
      fontFamily: {
        // Match the SVG wordmark's font stack. On macOS / iOS this resolves
        // to Helvetica Neue; on Windows / Android it falls back to Arial.
        sans: ['"Helvetica Neue"', "Helvetica", "Arial", "sans-serif"],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
