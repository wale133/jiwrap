import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Jiwrap | Custom Printing & Packaging',
  description: 'Custom printing, packaging and branded essentials for growing businesses across Nigeria.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
