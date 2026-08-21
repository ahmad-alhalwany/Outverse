import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Cosmory collects, uses, and protects your data.',
};

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
