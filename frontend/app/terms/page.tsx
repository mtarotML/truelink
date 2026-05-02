import type { ReactNode } from "react";

export default function TermsPage() {
  return (
    <main className="min-h-screen px-6 py-12 max-w-2xl mx-auto text-white/90">
      <h1 className="text-2xl font-bold text-white mb-2">Terms of Use</h1>
      <p className="text-xs text-white/50 mb-8">Last updated: May 2, 2026</p>

      <Section title="1. Acceptance">
        By accessing or using TrueLink you agree to these Terms of Use. If you
        do not agree, do not use the service.
      </Section>

      <Section title="2. Eligibility">
        You must be at least 18 years old to use TrueLink. By using the app you
        represent that you meet this requirement.
      </Section>

      <Section title="3. Your Account">
        <ul className="list-disc pl-5 space-y-1">
          <li>
            You are responsible for maintaining the confidentiality of your
            account.
          </li>
          <li>
            You agree to provide accurate and truthful profile information.
          </li>
          <li>
            You may not impersonate any person or create a misleading profile.
          </li>
          <li>
            One account per person — multiple accounts are not permitted.
          </li>
        </ul>
      </Section>

      <Section title="4. Acceptable Use">
        You agree not to:
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li>Harass, threaten, or harm other users.</li>
          <li>Post or transmit illegal, offensive, or explicit content.</li>
          <li>
            Attempt to reverse-engineer, scrape, or abuse the service.
          </li>
          <li>Use the service for commercial solicitation or spam.</li>
        </ul>
      </Section>

      <Section title="5. AI-Generated Content">
        Some profiles on TrueLink may include AI-generated responses. These are
        clearly designated as fictive and exist solely for demonstration
        purposes. You acknowledge that interactions with these profiles are not
        with real people.
      </Section>

      <Section title="6. Content You Post">
        You retain ownership of content you submit (messages, photos). By
        posting content you grant TrueLink a limited, non-exclusive license to
        store and display it as necessary to operate the service. You are solely
        responsible for the content you post.
      </Section>

      <Section title="7. Termination">
        We reserve the right to suspend or terminate your account at any time,
        with or without notice, for violations of these Terms or for any other
        reason at our sole discretion.
      </Section>

      <Section title="8. Disclaimer of Warranties">
        TrueLink is provided &ldquo;as is&rdquo; without warranties of any kind. We do not
        guarantee that the service will be uninterrupted, error-free, or that
        any matches will result in meaningful connections.
      </Section>

      <Section title="9. Limitation of Liability">
        To the maximum extent permitted by law, TrueLink shall not be liable
        for any indirect, incidental, or consequential damages arising out of
        your use of the service.
      </Section>

      <Section title="10. Governing Law">
        These Terms are governed by the laws of the United States. Any disputes
        shall be resolved in the applicable courts of the United States.
      </Section>

      <Section title="11. Changes to These Terms">
        We may update these Terms at any time. Continued use of TrueLink after
        changes are posted constitutes your acceptance of the revised Terms.
      </Section>

      <Section title="12. Contact">
        Questions? Reach us at:{" "}
        <a
          href="mailto:martintarot53@gmail.com"
          className="underline text-white/70"
        >
          martintarot53@gmail.com
        </a>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-white mb-2">{title}</h2>
      <div className="text-sm text-white/70 space-y-2 leading-relaxed">
        {children}
      </div>
    </section>
  );
}
