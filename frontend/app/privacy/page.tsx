import type { ReactNode } from "react";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen px-6 py-12 max-w-2xl mx-auto text-white/90">
      <h1 className="text-2xl font-bold text-white mb-2">Privacy Policy</h1>
      <p className="text-xs text-white/50 mb-8">Last updated: May 2, 2026</p>

      <Section title="1. Overview">
        TrueLink (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) is an independent project. This
        Privacy Policy explains what information we collect when you use
        TrueLink, how we use it, and your rights. By using TrueLink you agree
        to this policy.
      </Section>

      <Section title="2. Information We Collect">
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Account information:</strong> your email address, provided
            via Google Sign-In.
          </li>
          <li>
            <strong>Profile data:</strong> first name, last name, profile photo,
            gender, dating preferences, and intent.
          </li>
          <li>
            <strong>Messages:</strong> the content of conversations you have
            within the app.
          </li>
          <li>
            <strong>Device identifier:</strong> an anonymous ID associated with
            your device for session management.
          </li>
        </ul>
      </Section>

      <Section title="3. How We Use Your Information">
        <ul className="list-disc pl-5 space-y-1">
          <li>To create and manage your account.</li>
          <li>To display your profile to potential matches.</li>
          <li>
            To generate AI-powered conversation responses via our language model
            provider.
          </li>
          <li>To compute conversation mood analysis.</li>
          <li>To maintain the security and integrity of the service.</li>
        </ul>
      </Section>

      <Section title="4. Third-Party Services">
        We share limited data with the following third parties:
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li>
            <strong>Google OAuth</strong> — used for authentication. Your use of
            Google Sign-In is governed by{" "}
            <a
              href="https://policies.google.com/privacy"
              className="underline text-white/70"
              target="_blank"
              rel="noreferrer"
            >
              Google&apos;s Privacy Policy
            </a>
            .
          </li>
          <li>
            <strong>Groq, Inc.</strong> — our AI language model provider.
            Message history may be sent to Groq&apos;s API to generate replies.
            Groq&apos;s processing is governed by their own privacy policy.
          </li>
        </ul>
        We do not sell your personal data to any third party.
      </Section>

      <Section title="5. Data Retention">
        We retain your data for as long as your account is active. You may
        request deletion of your account and associated data at any time by
        contacting us (see Section 8).
      </Section>

      <Section title="6. Security">
        We implement reasonable technical measures to protect your data.
        However, no internet transmission is fully secure, and we cannot
        guarantee absolute security.
      </Section>

      <Section title="7. Children's Privacy">
        TrueLink is intended for users aged 18 and older. We do not knowingly
        collect data from anyone under 18.
      </Section>

      <Section title="8. Contact">
        For questions or data requests, contact us at:{" "}
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
