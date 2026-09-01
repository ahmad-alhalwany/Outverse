import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '@/hooks/useTheme';
import { useLocale } from '@/i18n/LocaleProvider';
import { WorldBackdrop, WorldHeader } from '@/components/world/WorldChrome';

export type LegalPage = 'privacy' | 'terms' | 'about' | 'faq';

type Section = { title: string; body: string };

function legalCopy(page: LegalPage, t: (key: string) => string): { title: string; updated: string; sections: Section[] } {
  if (page === 'terms') {
    return {
      title: t('legal.termsTitle'),
      updated: t('legal.termsUpdated'),
      sections: [
        { title: t('legal.sections.intro'), body: t('legal.termsIntro') },
        { title: t('legal.sections.acceptance'), body: t('legal.termsAcceptance') },
        { title: t('legal.sections.accounts'), body: t('legal.termsAccounts') },
        { title: t('legal.sections.conduct'), body: t('legal.termsConduct') },
        { title: t('legal.sections.content'), body: t('legal.termsContent') },
        { title: t('legal.sections.copyright'), body: t('legal.termsCopyright') },
        { title: t('legal.sections.termination'), body: t('legal.termsTermination') },
        { title: t('legal.sections.disclaimer'), body: t('legal.termsDisclaimer') },
        { title: t('legal.sections.liability'), body: t('legal.termsLiability') },
        { title: t('legal.sections.governingLaw'), body: t('legal.termsGoverningLaw') },
        { title: t('legal.sections.changes'), body: t('legal.termsChanges') },
      ],
    };
  }
  if (page === 'about') {
    return {
      title: t('about.title'),
      updated: t('about.updated'),
      sections: [
        { title: t('about.sections.intro'), body: t('about.intro') },
        { title: t('about.sections.features'), body: t('about.features') },
        { title: t('about.sections.pricing'), body: t('about.pricing') },
      ],
    };
  }
  if (page === 'faq') {
    return {
      title: t('faq.title'),
      updated: t('faq.updated'),
      sections: [
        { title: t('faq.sections.free'), body: t('faq.free') },
        { title: t('faq.sections.coins'), body: t('faq.coins') },
        { title: t('faq.sections.bazaarVsShop'), body: t('faq.bazaarVsShop') },
        { title: t('faq.sections.sell'), body: t('faq.sell') },
        { title: t('faq.sections.subscriptions'), body: t('faq.subscriptions') },
        { title: t('faq.sections.communities'), body: t('faq.communities') },
        { title: t('faq.sections.contact'), body: t('faq.contact') },
      ],
    };
  }
  return {
    title: t('legal.privacyTitle'),
    updated: t('legal.privacyUpdated'),
    sections: [
      { title: t('legal.sections.intro'), body: t('legal.privacyIntro') },
      { title: t('legal.sections.infoCollect'), body: t('legal.privacyCollect') },
      { title: t('legal.sections.infoUse'), body: t('legal.privacyUse') },
      { title: t('legal.sections.infoShare'), body: t('legal.privacyShare') },
      { title: t('legal.sections.cookies'), body: t('legal.privacyCookies') },
      { title: t('legal.sections.dataRights'), body: `${t('legal.privacyRights')}\n\n${t('legal.privacyRightsDetail')}` },
      { title: t('legal.sections.dataRetention'), body: t('legal.privacyRetention') },
      { title: t('legal.sections.dataSecurity'), body: t('legal.privacySecurity') },
      { title: t('legal.sections.children'), body: t('legal.privacyChildren') },
      { title: t('legal.sections.international'), body: t('legal.privacyInternational') },
      { title: t('legal.sections.contact'), body: t('legal.privacyContact') },
    ],
  };
}

export default function LegalScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { colors } = useTheme();
  const { t } = useLocale();
  const page = (route.params?.page || 'privacy') as LegalPage;
  const copy = useMemo(() => legalCopy(page, t), [page, t]);

  return (
    <WorldBackdrop>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <WorldHeader title={copy.title} subtitle={copy.updated} onBack={() => navigation.goBack()} />
        <ScrollView contentContainerStyle={styles.body}>
          {copy.sections.map((section) => (
            <View
              key={section.title}
              style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <Text style={[styles.heading, { color: colors.text }]}>{section.title}</Text>
              <Text style={[styles.para, { color: colors.textSecondary }]}>{section.body}</Text>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </WorldBackdrop>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { paddingHorizontal: 16, paddingBottom: 48, gap: 12 },
  card: { borderWidth: 1, borderRadius: 18, padding: 16 },
  heading: { fontSize: 16, fontWeight: '800', marginBottom: 8 },
  para: { fontSize: 14, lineHeight: 22 },
});
