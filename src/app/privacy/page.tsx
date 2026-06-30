import type { Metadata } from "next";
import { framework } from "@/content/framework";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `How ${framework.domain} and the truce software handle your data.`,
};

const CONTACT = "privacy@truce.audio";
const UPDATED = "June 30, 2026";

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <header className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--cyan)]">
          Legal
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-[var(--cream)]">
          Privacy Policy
        </h1>
        <p className="mt-3 text-[var(--fg-muted)]">Last updated: {UPDATED}</p>
      </header>

      <div className="prose-doc">
        <p>
          This policy explains how the {framework.domain} website and the truce
          software (the framework, the <code>cargo truce</code> command-line
          tool, and the audio plugins and apps built with it) handle your
          information. The short version: truce does not collect personal data.
        </p>

        <h2>The software</h2>
        <p>
          truce is an open-source framework for building audio plugins, and the
          plugins and apps produced with it run entirely on your own device.
          They do <strong>not</strong> collect, transmit, or sell personal
          information. Specifically, the software:
        </p>
        <ul>
          <li>contains no analytics, telemetry, tracking, or advertising;</li>
          <li>
            makes no network connections of its own to report usage, and
            requires no account, login, or registration;
          </li>
          <li>
            processes your audio, MIDI, and project data locally, in the host
            application (your DAW), and does not send it anywhere.
          </li>
        </ul>
        <p>
          Any data a plugin stores - presets, saved state - lives in your
          project or on your filesystem under your control. A third party who
          builds their own plugin with truce is responsible for the privacy
          practices of that product.
        </p>

        <h2>The website</h2>
        <p>
          {framework.domain} is a static documentation and showcase site. It
          sets no cookies and runs no analytics or tracking scripts. Like
          essentially all websites, our hosting provider automatically records
          standard technical request logs (such as IP address, browser type,
          and the page requested) to serve the site and protect it from abuse.
          We do not use these logs to identify individuals or build profiles,
          and we do not combine them with any other information.
        </p>

        <h2>Third-party services</h2>
        <p>
          We rely on a few external services, each governed by its own privacy
          policy:
        </p>
        <ul>
          <li>
            <strong>Cloudflare</strong> hosts and delivers the website (request
            logs and security, as above).
          </li>
          <li>
            <strong>GitHub</strong> hosts the source code and release downloads;
            visiting or downloading from GitHub is subject to GitHub&rsquo;s
            privacy policy.
          </li>
          <li>
            <strong>Apple</strong> distributes any truce-built apps offered
            through the App Store; installation and any analytics there are
            governed by Apple&rsquo;s privacy policy, not ours.
          </li>
        </ul>

        <h2>Data we do not collect</h2>
        <p>
          We do not sell, rent, or share personal information. We do not run
          advertising or behavioral tracking, and we do not knowingly collect
          information from children. The software is not directed to children
          under 13.
        </p>

        <h2>Changes</h2>
        <p>
          If this policy changes, we will update it on this page and revise the
          &ldquo;Last updated&rdquo; date above. Material changes will be noted
          in the project changelog.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about this policy or your privacy can be sent to{" "}
          <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
        </p>
      </div>
    </article>
  );
}
