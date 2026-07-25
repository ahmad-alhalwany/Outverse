import React from 'react';
import { api } from '@/api/client';
import { WorldStatsScreen } from './WorldScreenKit';

export default function SimulatorScreen() {
  return (
    <WorldStatsScreen
      title="Simulator"
      subtitle="Personal analytics"
      tone="lab"
      heroTitle="Your current Cosmory model"
      heroBody="Mobile cards for analytics/me data used by the web simulator."
      load={() => api.getMeAnalytics()}
    />
  );
}
