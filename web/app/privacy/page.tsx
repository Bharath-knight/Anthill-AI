export const metadata = {
  title: 'Privacy Policy | Anthill',
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-sm leading-6 text-gray-700">
      <h1 className="mb-6 text-2xl font-semibold text-gray-950">Privacy Policy</h1>

      <p className="mb-4">
        Anthill helps users capture job postings from their browser and save them
        to their Anthill dashboard.
      </p>

      <h2 className="mb-2 mt-8 text-base font-semibold text-gray-950">Information We Collect</h2>
      <p className="mb-4">
        When you click the Anthill extension&apos;s capture button, Anthill sends
        the current page URL to the Anthill web app. The Anthill backend may fetch
        and process the job posting page content to extract job details such as
        company, role, location, deadline, and source link.
      </p>
      <p className="mb-4">
        Anthill also stores job records, research notes, tasks, and account
        information that you create or save in the app.
      </p>

      <h2 className="mb-2 mt-8 text-base font-semibold text-gray-950">How We Use Information</h2>
      <p className="mb-4">
        We use this information only to provide Anthill&apos;s job capture,
        organization, tracking, and matching features.
      </p>

      <h2 className="mb-2 mt-8 text-base font-semibold text-gray-950">Data Sharing</h2>
      <p className="mb-4">
        We do not sell user data. We do not use user data for advertising,
        creditworthiness, or lending decisions. Data may be processed by service
        providers used to operate Anthill, including hosting, database, and AI API
        providers.
      </p>

      <h2 className="mb-2 mt-8 text-base font-semibold text-gray-950">User Control</h2>
      <p className="mb-4">
        The extension captures a page only after you click the capture button.
        You can remove the extension from your browser at any time.
      </p>

      <h2 className="mb-2 mt-8 text-base font-semibold text-gray-950">Contact</h2>
      <p>
        For privacy questions or support, contact the Anthill publisher using the
        contact email listed on the Chrome Web Store listing.
      </p>

      <p className="mt-8 text-xs text-gray-400">Last updated: May 7, 2026</p>
    </main>
  )
}
