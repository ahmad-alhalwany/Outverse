import React from 'react';
import { api } from '@/api/client';
import { WorldStatsScreen } from './WorldScreenKit';

export default function AchievementsScreen() {
  return (
    <WorldStatsScreen
      title="Achievements"
      subtitle="Milestones"
      tone="vault"
      heroTitle="Profile achievements"
      heroBody="Achievements pulled from your profile, with a quick path to your world passport."
      load={() => api.getMe()}
      linkLabel="Open Passport"
      onLink={(navigation) => navigation.navigate('Passport')}
    />
  );
}
