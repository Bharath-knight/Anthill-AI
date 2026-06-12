import Link from 'next/link'

export const metadata = {
  title: 'Privacy Policy | Anthill',
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-text2 text-sm leading-7">
      <Link
        href="/items"
        className="inline-flex items-center gap-2 mb-8 text-text3 hover:text-text transition-colors"
      >
        <span className="w-6 h-6 rounded-md bg-accent text-bg grid place-items-center font-bold text-xs">
          A
        </span>
        <span className="font-medium">Anthill</span>
      </Link>

      <h1 className="text-3xl font-bold tracking-tight text-text mb-2">Privacy Policy</h1>
      <p className="text-xs font-mono text-text3 mb-8">Last updated: May 7, 2026</p>

      <p className="mb-6">
        Anthill helps users capture job postings from their browser and save them to their Anthill
        dashboard.
      </p>

      <h2 className="text-lg font-semibold text-text mt-10 mb-3">Information we collect</h2>
      <p className="mb-4">
        When you click the Anthill extension&apos;s capture button, Anthill sends the current page
        URL to the Anthill web app. The Anthill backend may fetch and process the job posting page
        content to extract job details such as company, role, location, deadline, and source link.
      </p>
      <p className="mb-4">
        Anthill also stores job records, research notes, tasks, and account information that you
        create or save in the app.
      </p>

      <h2 className="text-lg font-semibold text-text mt-10 mb-3">How we use information</h2>
      <p className="mb-4">
        We use this information only to provide Anthill&apos;s job capture, organization, tracking,
        and matching features.
      </p>

      <h2 className="text-lg font-semibold text-text mt-10 mb-3">Data sharing</h2>
      <p className="mb-4">
        We do not sell user data. We do not use user data for advertising, creditworthiness, or
        lending decisions. Data may be processed by service providers used to operate Anthill,
        including hosting, database, and AI API providers.
      </p>

      <h2 className="text-lg font-semibold text-text mt-10 mb-3">User control</h2>
      <p className="mb-4">
        The extension captures a page only after you click the capture button. You can remove the
        extension from your browser at any time.
      </p>

      <h2 className="text-lg font-semibold text-text mt-10 mb-3">Contact</h2>
      <p>
        For privacy questions or support, contact the Anthill publisher using the contact email
        listed on the Chrome Web Store listing.
      </p>
    </main>
  )
}
