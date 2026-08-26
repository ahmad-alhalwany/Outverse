import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Log In',
  description: 'Sign in to Cosonova to continue your creative journey.',
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
