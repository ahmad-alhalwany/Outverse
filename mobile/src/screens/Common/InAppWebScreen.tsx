import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import * as SecureStore from 'expo-secure-store';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/auth/AuthContext';
import { WorldBackdrop, WorldHeader } from '@/components/world/WorldChrome';
import { prepareCallMedia } from '@/lib/webrtc';

function safeHttpUrl(value: unknown): string | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol === 'https:' || url.protocol === 'http:') return url.toString();
  } catch {
    return null;
  }
  return null;
}

function authBootstrapScript(token: string | null, user: unknown): string {
  const tokenJs = JSON.stringify(token || '');
  const userJs = user ? JSON.stringify(JSON.stringify(user)) : 'null';
  return `
    (function () {
      try {
        var token = ${tokenJs};
        if (token) {
          localStorage.setItem('cosonova_token', token);
          localStorage.setItem('outverse_token', token);
        }
        var user = ${userJs};
        if (user) {
          localStorage.setItem('cosonova_user', user);
          localStorage.setItem('outverse_user', user);
        }
      } catch (e) {}
    })();
    true;
  `;
}

export default function InAppWebScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { colors } = useTheme();
  const { user } = useAuth();
  const title = String(route.params?.title || '');
  const media = Boolean(route.params?.media);
  const url = useMemo(() => safeHttpUrl(route.params?.url), [route.params?.url]);
  const [progress, setProgress] = useState(0);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (media) await prepareCallMedia();
      const next = await SecureStore.getItemAsync('auth_token').catch(() => null);
      if (!cancelled) {
        setToken(next);
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [media]);

  const injected = useMemo(() => authBootstrapScript(token, user), [token, user]);

  return (
    <WorldBackdrop>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <WorldHeader title={title} onBack={() => navigation.goBack()} />
        {progress > 0 && progress < 1 ? (
          <View style={[styles.barTrack, { backgroundColor: colors.borderLight }]}>
            <View style={[styles.barFill, { width: `${Math.round(progress * 100)}%`, backgroundColor: colors.primary }]} />
          </View>
        ) : null}
        {url && ready ? (
          <WebView
            source={{ uri: url }}
            startInLoadingState
            javaScriptEnabled
            domStorageEnabled
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            allowsFullscreenVideo
            mediaCapturePermissionGrantType="grant"
            injectedJavaScriptBeforeContentLoaded={injected}
            renderLoading={() => (
              <View style={styles.loading}>
                <ActivityIndicator color={colors.primary} />
              </View>
            )}
            onLoadProgress={(event) => setProgress(event.nativeEvent.progress)}
            style={styles.web}
          />
        ) : (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        )}
      </SafeAreaView>
    </WorldBackdrop>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  web: { flex: 1, backgroundColor: 'transparent' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  barTrack: { height: 2, width: '100%' },
  barFill: { height: 2 },
});
