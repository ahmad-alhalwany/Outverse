import React from 'react';
import { useRoute } from '@react-navigation/native';
import { api } from '@/api/client';
import { useLocale } from '@/i18n/LocaleProvider';
import { WorldListScreen } from './WorldScreenKit';

export default function SoundScreen() {
  const route = useRoute<any>();
  const { t } = useLocale();
  const musicTrack = route.params?.music_track || route.params?.musicTrack || route.params?.trackId;

  if (!musicTrack) {
    return (
      <WorldListScreen
        title={t('mobile.originalSignal')}
        subtitle={t('mobile.signalTracks')}
        tone="live"
        heroTitle={t('mobile.signalTracks')}
        heroBody={t('mobile.chooseTrack')}
        load={() => api.getReelMusic()}
        emptyText={t('mobile.noTracks')}
        onPressRow={(row, navigation) => navigation.navigate('Sound', { music_track: row.id })}
        rowSubtitle={(row) => row.artist || row.description || ''}
      />
    );
  }

  return (
    <WorldListScreen
      title={t('mobile.originalSignal')}
      subtitle={t('mobile.trackLabel', { id: musicTrack })}
      tone="live"
      heroTitle={t('mobile.pulsesUsingSound')}
      heroBody={t('mobile.pulsesUsingSoundBody')}
      load={() => api.getReelsByMusicTrack(musicTrack)}
      emptyText={t('mobile.noReelsForSound')}
      rowTitle={(row) => row.caption || row.title || t('mobile.liveN', { id: row.id })}
      rowSubtitle={(row) => row.user?.username ? `@${row.user.username}` : ''}
      onPressRow={(_, navigation) => navigation.navigate('Reels')}
    />
  );
}
