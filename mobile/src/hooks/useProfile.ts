import { useState, useCallback } from 'react';
import api from '../api/client';
import type { User } from '../types';

interface ProfileState extends User {
  is_following?: boolean;
}

export function useProfile() {
  const [profile, setProfile] = useState<ProfileState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchByUsername = useCallback(async (username: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getProfile(username);
      setProfile(data);
    } catch (e: any) {
      setError(e?.message || 'User not found');
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleFollow = useCallback(
    async (userId: string) => {
      setProfile((prev) => {
        if (!prev) return prev;
        const wasFollowing = !!prev.is_following;
        return {
          ...prev,
          is_following: !wasFollowing,
          followers_count: prev.followers_count + (wasFollowing ? -1 : 1),
        };
      });
      // Read current state for the API call
      const wasFollowing = !!profile?.is_following;
      try {
        if (wasFollowing) await api.unfollowUser(userId);
        else await api.followUser(userId);
      } catch {
        // Revert optimistic update
        setProfile((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            is_following: wasFollowing,
            followers_count: prev.followers_count + (wasFollowing ? 1 : -1),
          };
        });
      }
    },
    [profile?.is_following]
  );

  return { profile, loading, error, fetchByUsername, toggleFollow, setProfile };
}
