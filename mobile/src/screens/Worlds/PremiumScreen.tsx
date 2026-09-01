import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/api/client';
import { useTheme } from '@/hooks/useTheme';
import { useLocale } from '@/i18n/LocaleProvider';
import { WorldBackdrop, WorldHeader } from '@/components/world/WorldChrome';
import { openInAppWeb } from '@/lib/nav';
import {
  asPremiumPlans,
  formatPlanPrice,
  mySubscriptionTier,
  PREMIUM_FEATURE_CARDS,
  usePremiumPalette,
  type PremiumPlan,
} from '@/lib/premium';

export default function PremiumScreen() {
  const navigation = useNavigation<any>();
  const { isDark } = useTheme();
  const C = usePremiumPalette(isDark);
  const { t } = useLocale();

  const [plans, setPlans] = useState<PremiumPlan[]>([]);
  const [activePlan, setActivePlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [plansError, setPlansError] = useState(false);
  const [busyTier, setBusyTier] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const checkoutTierRef = useRef<string | null>(null);

  const loadMe = useCallback(async () => {
    try {
      const data = await api.getMySubscription();
      setActivePlan(mySubscriptionTier(data));
      return mySubscriptionTier(data);
    } catch {
      return null;
    }
  }, []);

  const loadPlans = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setPlansError(false);
    try {
      const [rows, after] = await Promise.all([api.getSubscriptionPlans(), loadMe()]);
      setPlans(asPremiumPlans(rows));
      if (checkoutTierRef.current && after && after !== checkoutTierRef.current) {
        setSuccess(true);
        checkoutTierRef.current = null;
      }
    } catch {
      setPlans([]);
      setPlansError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadMe]);

  useFocusEffect(
    useCallback(() => {
      void loadPlans();
    }, [loadPlans]),
  );

  const choosePlan = async (plan: PremiumPlan) => {
    if (busyTier || activePlan === plan.tier) return;
    setBusyTier(plan.tier);
    setError('');
    setSuccess(false);
    checkoutTierRef.current = activePlan || '__none__';
    try {
      const result = await api.startPlanCheckout(plan.tier);
      const url = result?.checkout_url || result?.url;
      if (!url) {
        setError(t('premium.checkoutError'));
        return;
      }
      openInAppWeb(navigation, plan.name || t('nav.premium'), url);
    } catch (err) {
      const data = (err as { response?: { data?: { error?: string; detail?: string } } })?.response?.data;
      setError(data?.error || data?.detail || t('premium.checkoutError'));
    } finally {
      setBusyTier(null);
    }
  };

  return (
    <WorldBackdrop tone="default">
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <WorldHeader
          title={t('nav.premium')}
          subtitle={t('premium.choosePlan')}
          tone="default"
          onBack={() => navigation.goBack()}
        />

        {loading && plans.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator color={C.brown} />
            <Text style={[styles.hint, { color: C.text2 }]}>{t('premium.loading')}</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.content}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => void loadPlans(true)} tintColor={C.brown} />
            }
          >
            <View style={[styles.hero, { backgroundColor: C.card, borderColor: C.line }]}>
              <Ionicons name="sparkles" size={32} color={C.brownDk} />
              <Text style={[styles.heroTitle, { color: C.text }]}>{t('premium.title')}</Text>
              <Text style={[styles.heroBody, { color: C.text2 }]}>{t('premium.subtitle')}</Text>
              {activePlan ? (
                <View style={[styles.activeBadge, { backgroundColor: C.brown }]}>
                  <Text style={styles.activeBadgeText}>{t('premium.activePlan', { tier: activePlan })}</Text>
                </View>
              ) : null}
            </View>

            {success ? (
              <View style={[styles.banner, { backgroundColor: C.card2 }]}>
                <Text style={[styles.bannerText, { color: C.brownDk }]}>{t('premium.checkoutSuccess')}</Text>
              </View>
            ) : null}
            {error ? (
              <View style={[styles.banner, { backgroundColor: C.card2 }]}>
                <Text style={[styles.bannerText, { color: '#c0392b' }]}>{error}</Text>
              </View>
            ) : null}

            {PREMIUM_FEATURE_CARDS.map((card) => (
              <View key={card.titleKey} style={[styles.feature, { backgroundColor: C.white, borderColor: C.line }]}>
                <Ionicons name="star" size={20} color={C.brown} />
                <Text style={[styles.featureTitle, { color: C.text }]}>{t(card.titleKey)}</Text>
                <Text style={[styles.featureDesc, { color: C.text2 }]}>{t(card.descKey)}</Text>
              </View>
            ))}

            <Text style={[styles.sectionTitle, { color: C.text }]}>{t('premium.choosePlan')}</Text>

            {plansError ? (
              <View style={[styles.empty, { backgroundColor: C.card2, borderColor: C.line }]}>
                <Text style={[styles.hint, { color: C.text2 }]}>{t('premium.loadError')}</Text>
                <Pressable onPress={() => void loadPlans()} style={[styles.retry, { backgroundColor: C.brownDk }]}>
                  <Text style={styles.retryText}>{t('common.tryAgain')}</Text>
                </Pressable>
              </View>
            ) : plans.length === 0 ? (
              <View style={[styles.empty, { backgroundColor: C.card2, borderColor: C.line }]}>
                <Text style={[styles.hint, { color: C.text2 }]}>{t('premium.notConfigured')}</Text>
              </View>
            ) : (
              plans.map((plan) => {
                const recommended = plan.is_recommended;
                const current = activePlan === plan.tier;
                const busy = busyTier === plan.tier;
                const disabled = busy || current;
                const fg = recommended ? '#fff' : C.text;
                const muted = recommended ? 'rgba(255,255,255,0.85)' : C.text2;
                return (
                  <View
                    key={plan.tier}
                    style={[
                      styles.plan,
                      {
                        backgroundColor: recommended ? C.brown : C.white,
                        borderColor: C.line,
                      },
                    ]}
                  >
                    {recommended ? (
                      <Text style={[styles.recommended, { color: muted }]}>{t('premium.recommended')}</Text>
                    ) : null}
                    <Text style={[styles.planName, { color: fg }]}>{plan.name}</Text>
                    <Text style={[styles.planPrice, { color: fg }]}>
                      {formatPlanPrice(plan.price_usd)}
                      <Text style={[styles.planPeriod, { color: muted }]}>/{t('premium.perMonth')}</Text>
                    </Text>
                    {plan.features.map((feature) => (
                      <View key={feature} style={styles.featureRow}>
                        <Ionicons name="checkmark" size={16} color={fg} />
                        <Text style={[styles.featureItem, { color: fg }]}>{feature}</Text>
                      </View>
                    ))}
                    <Pressable
                      onPress={() => void choosePlan(plan)}
                      disabled={disabled}
                      style={[
                        styles.cta,
                        {
                          backgroundColor: recommended ? '#fff' : C.brownDk,
                          opacity: disabled ? 0.65 : 1,
                        },
                      ]}
                    >
                      <Text style={[styles.ctaText, { color: recommended ? C.brownDk : '#fff' }]}>
                        {current
                          ? t('premium.currentPlan')
                          : busy
                            ? t('premium.redirecting')
                            : t('premium.choosePlanCta')}
                      </Text>
                    </Pressable>
                  </View>
                );
              })
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </WorldBackdrop>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 10 },
  hint: { fontSize: 13, textAlign: 'center' },
  content: { paddingHorizontal: 16, paddingBottom: 48 },
  hero: {
    borderRadius: 28,
    borderWidth: 1,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  heroTitle: { fontSize: 24, fontWeight: '800', textAlign: 'center', marginTop: 10 },
  heroBody: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 8 },
  activeBadge: { marginTop: 12, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
  activeBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  banner: { borderRadius: 16, padding: 14, marginBottom: 12 },
  bannerText: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  feature: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 10 },
  featureTitle: { fontSize: 15, fontWeight: '800', marginTop: 8 },
  featureDesc: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center', marginTop: 10, marginBottom: 14 },
  empty: { borderRadius: 18, borderWidth: 1, padding: 28, alignItems: 'center', gap: 12 },
  retry: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  retryText: { color: '#fff', fontWeight: '800' },
  plan: { borderRadius: 18, borderWidth: 1, padding: 18, marginBottom: 12 },
  recommended: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6 },
  planName: { fontSize: 18, fontWeight: '800' },
  planPrice: { fontSize: 28, fontWeight: '800', marginTop: 4, marginBottom: 12 },
  planPeriod: { fontSize: 14, fontWeight: '500' },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  featureItem: { flex: 1, fontSize: 13, lineHeight: 18 },
  cta: { marginTop: 8, borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
  ctaText: { fontWeight: '800', fontSize: 15 },
});
