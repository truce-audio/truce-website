import type { Metadata } from "next";
import { PluginCard } from "@/components/PluginCard";
import { plugins } from "@/content/plugins";

export const metadata: Metadata = {
  title: "Plugins",
  description: "Open-source audio plugins built with the truce framework.",
};

export default function PluginsPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-12 sm:py-16">
      <header className="max-w-2xl mb-10">
        <p className="text-sm font-medium text-accent-muted mb-3">Plugins</p>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
          Built with truce
        </h1>
        <p className="mt-3 text-[var(--fg-muted)] leading-relaxed">
          Open-source audio plugins built on the truce framework. Every plugin ships
          as CLAP, VST3, and standalone at minimum, with optional LV2, AU, and AAX
          builds.
        </p>
      </header>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {plugins.map((p) => (
          <PluginCard key={p.slug} plugin={p} />
        ))}
      </div>
    </div>
  );
}
