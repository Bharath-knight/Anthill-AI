import Link from 'next/link'

export const metadata = {
  title: 'Privacy Policy | Anthill',
}

const SECTIONS = [
  {
    heading: 'Information We Collect',
    body: [
      "When you click the Anthill extension's capture button, Anthill sends the current page URL to the Anthill web app. The Anthill backend may fetch and process the job posting page content to extract job details such as company, role, location, deadline, and source link.",
      'Anthill also stores job records, research notes, tasks, and account information that you create or save in the app.',
    ],
  },
  {
    heading: 'How We Use Information',
    body: [
      "We use this information only to provide Anthill's job capture, organization, tracking, and matching features.",
    ],
  },
  {
    heading: 'Data Sharing',
    body: [
      'We do not sell user data. We do not use user data for advertising, creditworthiness, or lending decisions. Data may be processed by service providers used to operate Anthill, including hosting, database, and AI API providers.',
    ],
  },
  {
    heading: 'User Control',
    body: [
      'The extension captures a page only after you click the capture button. You can remove the extension from your browser at any time.',
    ],
  },
  {
    heading: 'Contact',
    body: [
      'For privacy questions or support, contact the Anthill publisher using the contact email listed on the Chrome Web Store listing.',
    ],
  },
]

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-6">
          <Link href="/items" className="flex items-center gap-2.5">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden="true">
                <path
                  d="M12 3l7 4v6c0 4-3 6.5-7 8-4-1.5-7-4-7-8V7l7-4z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="text-[15px] font-semibold tracking-tight">Anthill</span>
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Privacy Policy</h1>
        <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
          Anthill helps users capture job postings from their browser and save them to their Anthill
          dashboard.
        </p>

        <div className="mt-10 flex flex-col gap-8">
          {SECTIONS.map((section) => (
            <section key={section.heading}>
              <h2 className="text-lg font-semibold tracking-tight">{section.heading}</h2>
              <div className="mt-2 flex flex-col gap-3">
                {section.body.map((paragraph, i) => (
                  <p key={i} className="leading-relaxed text-muted-foreground">
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <p className="mt-12 text-xs text-muted-foreground">Last updated: May 7, 2026</p>
      </article>
    </main>
  )
}
