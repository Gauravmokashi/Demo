import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ACME Salary Dashboard',
  description: 'Global salary management dashboard for HR operations.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
