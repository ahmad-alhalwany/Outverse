import React from 'react';
import { api } from '@/api/client';
import { WorldListScreen } from './WorldScreenKit';

export default function DrawStudioScreen() {
  return (
    <WorldListScreen
      title="Draw Studio"
      subtitle="Sessions"
      tone="lab"
      heroTitle="Sketch sessions"
      heroBody="Create lightweight draw sessions. Stroke editing can arrive later."
      load={() => api.getDrawSessions()}
      createLabel="Create session"
      createPlaceholder="Session title"
      createPayload={(text) => ({ title: text, strokes: [] })}
      create={(payload) => api.createDrawSession(payload)}
      emptyText="No draw sessions yet"
    />
  );
}
