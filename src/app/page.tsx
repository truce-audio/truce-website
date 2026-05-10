import Link from "next/link";
import { CodeBlock } from "@/components/CodeBlock";
import { FeatureGrid } from "@/components/FeatureGrid";
import { FormatMatrix } from "@/components/FormatMatrix";
import { PluginCard } from "@/components/PluginCard";
import { framework, minimalExample, quickStart } from "@/content/framework";
import { plugins } from "@/content/plugins";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-6">
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
        description="Smoothed parameter, GPU-rendered knob, CLAP + VST3 + standalone. The truce::plugin! macro generates every format export, GUI, and state serialization."
      >
        <CodeBlock code={minimalExample} lang="rust" />
      </Section>

      <Section
        title="Built with truce"
        eyebrow="Plugins"
        description="Open-source plugins built on the framework."
      >
        <div className="grid gap-6 sm:grid-cols-2">
          {plugins.map((p) => (
            <PluginCard key={p.slug} plugin={p} />
          ))}
        </div>
        <div className="mt-6">
          <Link
            href="/plugins"
            className="text-sm font-medium text-accent-muted hover:underline"
          >
            View all plugins →
          </Link>
        </div>
      </Section>
    </div>
  );
}

function Hero() {
  return (
    <section className="py-16 sm:py-24 grid gap-12 lg:grid-cols-[1.05fr_1fr] lg:items-center">
      <div>
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 64 64" className="h-9 w-9" aria-hidden="true">
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
          <span className="font-mono text-sm tracking-wider text-[var(--cream)]">
            truce<span className="text-[var(--cyan)]">::</span>audio
            <span className="text-[var(--cyan)]">::</span>plugin
          </span>
        </div>

        <h1 className="mt-6 text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05] text-[var(--cream)]">
          {framework.tagline}
        </h1>
        <p className="mt-6 text-lg text-[var(--fg-muted)] leading-relaxed max-w-xl">
          {framework.description}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/docs/guide/install"
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
    <section className="py-12 sm:py-16 border-t border-[var(--border)]">
      <div className="mb-8 max-w-2xl">
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
