import type { User } from '@/types';

export function displayName(user?: Partial<User> | null, fallback = 'Traveler') {
  if (!user) return fallback;
  const full = `${user.first_name || ''} ${user.last_name || ''}`.trim();
  return (user.display_name || full || user.username || fallback).trim() || fallback;
}
