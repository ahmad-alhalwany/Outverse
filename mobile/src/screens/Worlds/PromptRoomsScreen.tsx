import React from 'react';
import { api } from '@/api/client';
import { WorldListScreen } from './WorldScreenKit';

export default function PromptRoomsScreen() {
  return (
    <WorldListScreen
      title="Prompt Rooms"
      subtitle="Chat"
      tone="live"
      heroTitle="Prompt-led rooms"
      heroBody="Browse prompt rooms and open them in the existing room chat."
      load={() => api.getPromptRooms()}
      emptyText="No prompt rooms yet"
      rowTitle={(row) => row.name || row.question_text || 'Prompt room'}
      rowSubtitle={(row) => row.question_text || row.description || ''}
      onPressRow={(row, navigation) => navigation.navigate('Room', { roomId: row.id, roomName: row.name || row.question_text })}
    />
  );
}
