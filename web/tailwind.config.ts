import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: 'var(--brand)',
          foreground: 'var(--brand-foreground)',
        },
        status: {
          saved: 'var(--status-saved)',
          'saved-bg': 'var(--status-saved-bg)',
          applied: 'var(--status-applied)',
          'applied-bg': 'var(--status-applied-bg)',
          interview: 'var(--status-interview)',
          'interview-bg': 'var(--status-interview-bg)',
          offer: 'var(--status-offer)',
          'offer-bg': 'var(--status-offer-bg)',
          rejected: 'var(--status-rejected)',
          'rejected-bg': 'var(--status-rejected-bg)',
        },
      },
    },
  },
  plugins: [],
}
export default config
