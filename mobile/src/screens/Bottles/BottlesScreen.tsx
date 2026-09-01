import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { api } from '@/api/client';
import { useTheme } from '@/hooks/useTheme';
import { useLocale } from '@/i18n/LocaleProvider';
import { WorldBackdrop, WorldHeader } from '@/components/world/WorldChrome';
import { reverseGeocodeLabel, searchLocation, searchLocationSuggestions } from '@/lib/geocode';
import { emotionMeta } from '@/lib/profileEmotions';
import {
  asBottleDashboard,
  asBottleMarkers,
  asBottles,
  axiosStatus,
  markerToBottle,
  useBottlesPalette,
  type BottleDashboard,
  type BottleLocation,
  type BottleMarker,
  type BottleRow,
} from '@/lib/bottles';
import BottlesMap from './BottlesMap';
import {
  BottleListCard,
  BottleModalShell,
  BottlePreviewBody,
  CatchBottleBody,
  EmotionChip,
  MoodInsights,
  MoodTimeline,
  ThrowBottleForm,
} from './bottleParts';

export default function BottlesScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { isDark } = useTheme();
  const C = useBottlesPalette(isDark);
  const { t, locale } = useLocale();

  const [markers, setMarkers] = useState<BottleMarker[]>([]);
  const [recent, setRecent] = useState<BottleRow[]>([]);
  const [mine, setMine] = useState<BottleRow[]>([]);
  const [caught, setCaught] = useState<BottleRow[]>([]);
  const [dashboard, setDashboard] = useState<BottleDashboard | null>(null);
  const [placeLabels, setPlaceLabels] = useState<Record<number, string>>({});
  const [tab, setTab] = useState<'vault' | 'catches'>('vault');
  const [emotionFilter, setEmotionFilter] = useState('all');
  const [includeExpired, setIncludeExpired] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const [throwOpen, setThrowOpen] = useState(false);
  const [catchOpen, setCatchOpen] = useState(false);
  const [pickMode, setPickMode] = useState(false);
  const [pickedLocation, setPickedLocation] = useState<BottleLocation | null>(null);
  const [message, setMessage] = useState('');
  const [emotion, setEmotion] = useState('mystery');
  const [placeQuery, setPlaceQuery] = useState('');
  const [suggestions, setSuggestions] = useState<{ lat: number; lng: number; zoom: number; label: string }[]>([]);
  const [locating, setLocating] = useState(false);
  const [searchingPlace, setSearchingPlace] = useState(false);
  const [throwing, setThrowing] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const [polishNote, setPolishNote] = useState('');
  const [throwError, setThrowError] = useState('');
  const [throwDone, setThrowDone] = useState(false);

  const [catching, setCatching] = useState(false);
  const [caughtBottle, setCaughtBottle] = useState<BottleRow | null>(null);
  const [catchError, setCatchError] = useState('');

  const [preview, setPreview] = useState<BottleRow | null>(null);
  const [previewMissing, setPreviewMissing] = useState(false);
  const [opening, setOpening] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    setLoadError(false);
    try {
      const filter = { emotion: emotionFilter, active: !includeExpired };
      const [mapRows, recentRows, mineRows, caughtRows, dash] = await Promise.all([
        api.getBottlesMap().catch(() => []),
        api.getBottles().catch(() => []),
        api.getMyBottles(filter).catch(() => []),
        api.getCaughtBottles({ emotion: emotionFilter }).catch(() => []),
        api.getBottlesDashboard().catch(() => null),
      ]);
      setMarkers(asBottleMarkers(mapRows, t));
      setRecent(asBottles(recentRows));
      setMine(asBottles(mineRows));
      setCaught(asBottles(caughtRows));
      setDashboard(dash ? asBottleDashboard(dash) : null);
    } catch {
      setLoadError(true);
    } finally {
      setRefreshing(false);
    }
  }, [emotionFilter, includeExpired, t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    if (route.params?.compose || route.params?.idea_id) {
      if (route.params?.idea_id) {
        setMessage(t('bottles.ideaSparkPrefix', { id: route.params.idea_id }));
      }
      setThrowOpen(true);
    }
  }, [route.params?.compose, route.params?.idea_id, t]);

  useEffect(() => {
    const id = Number(route.params?.bottle || route.params?.bottleId || 0);
    if (!id) return;
    const hit = recent.find((b) => b.id === id) || mine.find((b) => b.id === id);
    if (hit) {
      setPreview(hit);
      setPreviewMissing(false);
      return;
    }
    const marker = markers.find((m) => m.id === id);
    if (marker) {
      setPreview(markerToBottle(marker));
      setPreviewMissing(false);
      return;
    }
    void api
      .getBottle(id)
      .then((data) => {
        const rows = asBottles([data]);
        if (rows[0]) setPreview(rows[0]);
        else setPreviewMissing(true);
      })
      .catch(() => setPreviewMissing(true));
  }, [route.params?.bottle, route.params?.bottleId, recent, mine, markers]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next: Record<number, string> = {};
      for (const b of recent.slice(0, 8)) {
        if (b.location_lat == null || b.location_lng == null) continue;
        const label = await reverseGeocodeLabel(b.location_lat, b.location_lng);
        if (label) next[b.id] = label;
        if (cancelled) return;
      }
      if (!cancelled) setPlaceLabels((prev) => ({ ...prev, ...next }));
    })();
    return () => {
      cancelled = true;
    };
  }, [recent]);

  const openPreview = (bottle: BottleRow) => {
    setPreview(bottle);
    setPreviewMissing(false);
    if (bottle.location_lat != null && bottle.location_lng != null) {
      setFlyTarget({ lat: bottle.location_lat, lng: bottle.location_lng, zoom: 12 });
    }
  };

  const handleGps = async () => {
    setLocating(true);
    setThrowError('');
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        setThrowError(t('bottles.gpsError'));
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      const label =
        (await reverseGeocodeLabel(pos.coords.latitude, pos.coords.longitude)) || t('bottles.myLocationFallback');
      setPickedLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, label });
    } catch {
      setThrowError(t('bottles.gpsError'));
    } finally {
      setLocating(false);
    }
  };

  const handleSearchPlace = async () => {
    setSearchingPlace(true);
    setThrowError('');
    const hits = await searchLocationSuggestions(placeQuery, 5);
    setSearchingPlace(false);
    setSuggestions(hits);
    if (!hits.length) setThrowError(t('bottles.noPlacesFound'));
  };

  const handleMapSearch = async () => {
    const hit = await searchLocation(searchQuery);
    if (hit) setFlyTarget(hit);
  };

  const handlePolish = async () => {
    if (!message.trim()) return;
    setPolishing(true);
    setPolishNote('');
    try {
      const result = await api.polishTone(message.trim(), 'bottle', locale);
      if (result.polished) setMessage(result.polished);
      if (result.note) setPolishNote(result.note);
      if (result.error) setThrowError(result.error);
    } catch {
      setThrowError(t('common.actionFailed'));
    } finally {
      setPolishing(false);
    }
  };

  const handleThrow = async () => {
    if (!message.trim()) {
      setThrowError(t('bottles.writeMessageFirst'));
      return;
    }
    if (!pickedLocation) {
      setThrowError(t('bottles.chooseLocationFirst'));
      return;
    }
    setThrowing(true);
    setThrowError('');
    try {
      await api.throwBottle({
        message: message.trim(),
        emotion_type: emotion,
        location_lat: pickedLocation.lat,
        location_lng: pickedLocation.lng,
      });
      setThrowDone(true);
      setMessage('');
      setPickedLocation(null);
      await load(true);
      setTimeout(() => {
        setThrowOpen(false);
        setThrowDone(false);
      }, 1400);
    } catch {
      setThrowError(t('bottles.bottleSlippedAway'));
    } finally {
      setThrowing(false);
    }
  };

  const handleCatchRandom = async () => {
    setCatching(true);
    setCatchError('');
    try {
      const data = await api.catchBottle();
      setCaughtBottle(asBottles([data])[0] || null);
      await load(true);
    } catch (error) {
      setCaughtBottle(null);
      setCatchError(axiosStatus(error) === 404 ? t('bottles.seaEmpty') : t('bottles.couldNotReachVoid'));
    } finally {
      setCatching(false);
    }
  };

  const handleCatchPreview = async () => {
    if (!preview) return;
    setOpening(true);
    try {
      await api.catchBottle(preview.id);
      setPreview(null);
      await load(true);
    } catch (error) {
      if (axiosStatus(error) === 404) {
        setPreview(null);
        await load(true);
      } else {
        setPreview(null);
        setCatchOpen(true);
      }
    } finally {
      setOpening(false);
    }
  };

  const handleDelete = (id: number) => {
    Alert.alert(t('bottles.deleteBottleLabel'), t('bottles.confirmDeleteBottle'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          void api.deleteBottle(id).then(() => load(true)).catch(() => undefined);
        },
      },
    ]);
  };

  const currentMood = dashboard?.current_mood ? emotionMeta(dashboard.current_mood) : null;
  const list = tab === 'vault' ? mine : caught;

  return (
    <WorldBackdrop tone="vault">
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <WorldHeader
          title={t('bottles.title')}
          subtitle={t('vault.bottlesTitle')}
          tone="vault"
          onBack={() => navigation.goBack()}
        />
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={C.brown} />
          }
        >
          <View style={[styles.searchWrap, { backgroundColor: C.white, borderColor: C.line }]}>
            <Ionicons name="location-outline" size={16} color={C.text2} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t('bottles.searchLocationPlaceholder')}
              placeholderTextColor={C.text2}
              style={[styles.search, { color: C.text }]}
              onSubmitEditing={() => void handleMapSearch()}
            />
            <Pressable onPress={() => void handleMapSearch()}>
              <Ionicons name="search" size={16} color={C.brown} />
            </Pressable>
          </View>

          {loadError ? (
            <Pressable onPress={() => void load()} style={[styles.errorBanner, { backgroundColor: C.card2 }]}>
              <Text style={[styles.errorText, { color: C.text }]}>{t('bottles.loadError')}</Text>
              <Text style={[styles.retry, { color: C.brown }]}>{t('bottles.retry')}</Text>
            </Pressable>
          ) : null}

          {pickMode ? (
            <View style={[styles.pickBanner, { backgroundColor: C.card }]}>
              <Text style={[styles.pickText, { color: C.text }]}>{t('bottles.pickOnMap')}</Text>
              <Pressable
                onPress={() => {
                  setPickMode(false);
                  setThrowOpen(true);
                }}
              >
                <Text style={[styles.retry, { color: C.brown }]}>{t('common.cancel')}</Text>
              </Pressable>
            </View>
          ) : null}

          <BottlesMap
            C={C}
            markers={markers}
            pickMode={pickMode}
            pickPreview={pickedLocation}
            flyTarget={flyTarget}
            emptyLabel={t('bottles.noDriftingBottles')}
            onPressMarker={(marker) => openPreview(markerToBottle(marker))}
            onPickLocation={async (lat, lng) => {
              const label = (await reverseGeocodeLabel(lat, lng)) || `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
              setPickedLocation({ lat, lng, label });
              setFlyTarget({ lat, lng, zoom: 14 });
              setPickMode(false);
              setThrowOpen(true);
            }}
          />
          {markers.length > 0 ? (
            <Text style={[styles.mapHint, { color: C.text2 }]}>
              {markers.length === 1
                ? t('bottles.driftingBottlesOne', { count: markers.length })
                : t('bottles.driftingBottlesMany', { count: markers.length })}
            </Text>
          ) : null}

          <View style={styles.actions}>
            <Pressable onPress={() => setThrowOpen(true)} style={[styles.actionBtn, { backgroundColor: C.brownDk }]}>
              <Ionicons name="paper-plane-outline" size={16} color="#fff" />
              <Text style={styles.actionText}>{t('bottles.throwBottleBtn')}</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setCaughtBottle(null);
                setCatchError('');
                setCatchOpen(true);
              }}
              style={[styles.actionBtn, { backgroundColor: C.white, borderColor: C.line, borderWidth: 1 }]}
            >
              <Ionicons name="water-outline" size={16} color={C.brown} />
              <Text style={[styles.actionText, { color: C.brown }]}>{t('bottles.catchBottleBtn')}</Text>
            </Pressable>
          </View>

          <View style={[styles.stats, { backgroundColor: C.white, borderColor: C.line }]}>
            <Text style={[styles.statsText, { color: C.text2 }]}>
              {t('bottles.currentMood')}{' '}
              {currentMood ? `${currentMood.emoji} ${t(currentMood.labelKey)}` : '—'}
            </Text>
            <Text style={[styles.statsText, { color: C.text }]}>
              {dashboard?.thrown ?? 0} {t('bottles.bottlesThrown')} · {dashboard?.caught ?? 0}{' '}
              {t('bottles.bottlesCaught')}
            </Text>
          </View>

          <View style={[styles.tabs, { backgroundColor: C.card2 }]}>
            {(['vault', 'catches'] as const).map((key) => (
              <Pressable
                key={key}
                onPress={() => setTab(key)}
                style={[styles.tab, tab === key && { backgroundColor: C.white }]}
              >
                <Text style={[styles.tabText, { color: tab === key ? C.brown : C.text2 }]}>
                  {key === 'vault' ? t('bottles.myVaultTab') : t('bottles.myCatchesTab')}
                </Text>
              </Pressable>
            ))}
          </View>

          {tab === 'vault' ? (
            <Pressable onPress={() => setIncludeExpired((v) => !v)} style={styles.expired}>
              <Ionicons name={includeExpired ? 'checkbox' : 'square-outline'} size={18} color={C.brown} />
              <Text style={[styles.expiredText, { color: C.text2 }]}>{t('bottles.includeExpired')}</Text>
            </Pressable>
          ) : null}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            <Pressable
              onPress={() => setEmotionFilter('all')}
              style={[styles.allChip, { borderColor: C.line, backgroundColor: emotionFilter === 'all' ? C.brown : C.white }]}
            >
              <Text style={{ color: emotionFilter === 'all' ? '#fff' : C.text2, fontWeight: '800', fontSize: 12 }}>
                {t('bottles.allEmotions')}
              </Text>
            </Pressable>
            {['joy', 'hope', 'calm', 'love', 'sad', 'lonely', 'anxious', 'nostalgic', 'mystery'].map((key) => (
              <EmotionChip
                key={key}
                emotionKey={key}
                active={emotionFilter === key}
                t={t}
                onPress={() => setEmotionFilter(key)}
              />
            ))}
          </ScrollView>

          <Text style={[styles.section, { color: C.text }]}>
            {tab === 'vault' ? t('bottles.myBottlesTitle') : t('bottles.myCatchesTitle')}
          </Text>
          {list.length === 0 ? (
            <Text style={[styles.empty, { color: C.text2 }]}>
              {tab === 'vault' ? t('bottles.noBottlesMatch') : t('bottles.noCatchesMatch')}
            </Text>
          ) : (
            list.map((bottle) => (
              <BottleListCard
                key={`${tab}-${bottle.id}`}
                C={C}
                t={t}
                bottle={bottle}
                place={placeLabels[bottle.id]}
                onPress={() => openPreview(bottle)}
                onDelete={tab === 'vault' ? () => handleDelete(bottle.id) : undefined}
              />
            ))
          )}

          <Text style={[styles.section, { color: C.text }]}>{t('bottles.recentBottlesTitle')}</Text>
          {recent.length === 0 ? (
            <Text style={[styles.empty, { color: C.text2 }]}>{t('bottles.noDriftingBottles')}</Text>
          ) : (
            recent.map((bottle) => (
              <BottleListCard
                key={`recent-${bottle.id}`}
                C={C}
                t={t}
                bottle={bottle}
                place={placeLabels[bottle.id] || (bottle.location_lat != null ? t('bottles.onMap') : undefined)}
                onPress={() => openPreview(bottle)}
              />
            ))
          )}

          {dashboard ? (
            <>
              <MoodTimeline C={C} t={t} timeline={dashboard.timeline} />
              <MoodInsights C={C} t={t} dashboard={dashboard} />
            </>
          ) : null}
        </ScrollView>

        <BottleModalShell
          visible={throwOpen && !pickMode}
          C={C}
          onClose={() => {
            setThrowOpen(false);
            setThrowDone(false);
          }}
        >
          <ThrowBottleForm
            C={C}
            t={t}
            message={message}
            setMessage={setMessage}
            emotion={emotion}
            setEmotion={setEmotion}
            location={pickedLocation}
            locating={locating}
            searchingPlace={searchingPlace}
            placeQuery={placeQuery}
            setPlaceQuery={setPlaceQuery}
            suggestions={suggestions}
            polishNote={polishNote}
            error={throwError}
            throwing={throwing}
            polishing={polishing}
            done={throwDone}
            onGps={() => void handleGps()}
            onPickMap={() => {
              setThrowOpen(false);
              setPickMode(true);
            }}
            onSearch={() => void handleSearchPlace()}
            onPickSuggestion={(hit) => {
              setPickedLocation({ lat: hit.lat, lng: hit.lng, label: hit.label });
              setSuggestions([]);
              setPlaceQuery(hit.label);
              setFlyTarget(hit);
            }}
            onClearLocation={() => setPickedLocation(null)}
            onPolish={() => void handlePolish()}
            onThrow={() => void handleThrow()}
          />
        </BottleModalShell>

        <BottleModalShell visible={catchOpen} C={C} onClose={() => setCatchOpen(false)}>
          <CatchBottleBody
            C={C}
            t={t}
            catching={catching}
            caught={caughtBottle}
            error={catchError}
            onCatch={() => void handleCatchRandom()}
          />
        </BottleModalShell>

        <BottleModalShell
          visible={Boolean(preview) || previewMissing}
          C={C}
          onClose={() => {
            setPreview(null);
            setPreviewMissing(false);
          }}
        >
          <BottlePreviewBody
            C={C}
            t={t}
            bottle={preview}
            missing={previewMissing}
            placeLabel={preview ? placeLabels[preview.id] : undefined}
            opening={opening}
            onCatch={() => void handleCatchPreview()}
            onShare={() => {
              if (!preview) return;
              void Share.share({ message: `https://cosonova.com/bottles?bottle=${preview.id}` });
            }}
          />
        </BottleModalShell>
      </SafeAreaView>
    </WorldBackdrop>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 48 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  search: { flex: 1, paddingVertical: 10, fontSize: 14 },
  errorBanner: { borderRadius: 14, padding: 12, marginBottom: 12 },
  errorText: { fontSize: 13, fontWeight: '700' },
  retry: { fontSize: 13, fontWeight: '800', marginTop: 4 },
  pickBanner: {
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickText: { fontSize: 13, fontWeight: '800' },
  mapHint: { fontSize: 12, textAlign: 'center', marginTop: 8, marginBottom: 12 },
  actions: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  actionBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  actionText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  stats: { borderWidth: 1, borderRadius: 16, padding: 12, marginBottom: 12, gap: 4 },
  statsText: { fontSize: 13, fontWeight: '600' },
  tabs: { flexDirection: 'row', borderRadius: 999, padding: 4, marginBottom: 10 },
  tab: { flex: 1, borderRadius: 999, paddingVertical: 8, alignItems: 'center' },
  tabText: { fontSize: 12, fontWeight: '800' },
  expired: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  expiredText: { fontSize: 12, fontWeight: '600' },
  filters: { gap: 8, paddingBottom: 12 },
  allChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  section: { fontSize: 16, fontWeight: '800', marginBottom: 8, marginTop: 6 },
  empty: { fontSize: 13, marginBottom: 12 },
});
