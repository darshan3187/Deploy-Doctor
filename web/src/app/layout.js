import './globals.css';

export const metadata = {
  title: 'Deploy Doctor — Instant Zerops YAML & Deployment Readiness',
  description: 'Scan any repository, Dockerfile, or ZIP archive. Get an instant deployment readiness score, risk report, and production-ready zerops.yaml.',
  keywords: ['Zerops', 'Deployment', 'zerops.yaml', 'DevOps', 'Cloud PaaS', 'Docker', 'Node.js', 'Python', 'Go'],
  icons: {
    icon: '/logo.webp',
    shortcut: '/logo.webp',
    apple: '/logo.webp',
  },
  openGraph: {
    title: 'Deploy Doctor — Instant Zerops YAML Generator',
    description: 'Automated deployment readiness and risk auditing for Zerops Cloud.',
    type: 'website',
    images: [{ url: '/logo.webp' }],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#090d16] text-slate-100 antialiased selection:bg-blue-500 selection:text-white min-h-screen flex flex-col">
        {children}
      </body>
    </html>
  );
}
