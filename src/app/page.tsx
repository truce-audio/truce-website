import Link from "next/link";
import { CodeBlock } from "@/components/CodeBlock";
import { FeatureGrid } from "@/components/FeatureGrid";
import { FormatMatrix } from "@/components/FormatMatrix";
import { framework, minimalExample, quickStart } from "@/content/framework";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <Hero />

      <Section
        title="Capabilities"
        eyebrow="Overview"
        description="One Rust codebase compiles to seven plugin formats. Hot reload, declarative params, cross-platform installers, automated validation."
      >
        <FeatureGrid />
      </Section>

      <Section
        title="Format support"
        eyebrow="Compatibility"
        description="CLAP and VST3 ship as defaults. VST2, LV2, AU, and AAX are opt-in per plugin via Cargo features."
      >
        <FormatMatrix />
      </Section>

      <Section
        title="A complete plugin"
        eyebrow="Example"
        description="Smoothed parameter, built-in knob, CLAP + VST3 + standalone. The truce::plugin! macro generates every format export, GUI, and state serialization."
      >
        <CodeBlock code={minimalExample} lang="rust" />
      </Section>
    </div>
  );
}

function Hero() {
  return (
    <section className="py-6 sm:py-10 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[1.05fr_1fr] lg:items-center">
      <div>
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05] text-[var(--cream)]">
          {framework.tagline}
        </h1>
        <p className="mt-4 text-lg text-[var(--fg-muted)] leading-relaxed max-w-xl">
          {framework.description}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/docs/"
            className="inline-flex items-center rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-fg hover:opacity-90 transition-opacity"
          >
            Get started
          </Link>
          <a
            href={framework.github}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center rounded-md border border-[var(--border-strong)] px-4 py-2.5 text-sm font-medium hover:bg-[var(--bg-elevated)] transition-colors"
          >
            View on GitHub
          </a>
        </div>
      </div>

      <div className="relative">
        <div className="absolute inset-0 -z-10 rounded-2xl bg-gradient-to-br from-[rgba(255,45,123,0.16)] via-transparent to-[rgba(20,240,224,0.14)] blur-2xl" />
        <CodeBlock code={quickStart} lang="bash" />
      </div>
    </section>
  );
}

function Section({
  title,
  eyebrow,
  description,
  children,
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="py-7 sm:py-9 border-t border-[var(--border)]">
      <div className="mb-5 max-w-2xl">
        {eyebrow && (
          <p className="text-sm font-medium text-accent-muted mb-3">{eyebrow}</p>
        )}
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">{title}</h2>
        {description && (
          <p className="mt-3 text-[var(--fg-muted)] leading-relaxed">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}
