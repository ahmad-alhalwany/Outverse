import React from 'react';
import { useRoute } from '@react-navigation/native';
import { api } from '@/api/client';
import { WorldListScreen } from './WorldScreenKit';

export default function SoundScreen() {
  const route = useRoute<any>();
  const musicTrack = route.params?.music_track || route.params?.musicTrack || route.params?.trackId;

  if (!musicTrack) {
    return (
      <WorldListScreen
        title="Sound"
        subtitle="Tracks"
        tone="live"
        heroTitle="Pick a sound"
        heroBody="Choose a track to see reels using its music_track id."
        load={() => api.getReelMusic()}
        emptyText="No tracks yet"
        onPressRow={(row, navigation) => navigation.navigate('Sound', { music_track: row.id })}
        rowSubtitle={(row) => row.artist || row.description || ''}
      />
    );
  }

  return (
    <WorldListScreen
      title="Sound"
      subtitle={`Track ${musicTrack}`}
      tone="live"
      heroTitle="Reels using this sound"
      heroBody="A focused feed filtered by the music_track parameter."
      load={() => api.getReelsByMusicTrack(musicTrack)}
      emptyText="No reels for this sound yet"
      rowTitle={(row) => row.caption || row.title || `Reel ${row.id}`}
      rowSubtitle={(row) => row.user?.username ? `@${row.user.username}` : ''}
      onPressRow={(_, navigation) => navigation.navigate('Reels')}
    />
  );
}
