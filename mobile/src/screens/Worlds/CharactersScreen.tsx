import React from 'react';
import { api } from '@/api/client';
import { WorldListScreen } from './WorldScreenKit';

export default function CharactersScreen() {
  return (
    <WorldListScreen
      title="Characters"
      subtitle="Summons"
      tone="lab"
      heroTitle="Summoned characters"
      heroBody="Browse characters and trigger a summon action when the backend supports it."
      load={() => api.getCharacters()}
      emptyText="No characters yet"
      actions={[
        {
          label: 'Summon',
          run: (row) => api.summonCharacter(row.id),
        },
      ]}
    />
  );
}
