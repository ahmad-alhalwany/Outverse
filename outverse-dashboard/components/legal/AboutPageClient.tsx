'use client';

import LegalLayout from '@/components/legal/LegalLayout';
import { useLocale } from '@/components/LocaleProvider';

export default function AboutPageClient() {
  const { t, locale } = useLocale();
  const updated = locale === 'ar' ? '26 أغسطس 2026' : 'August 26, 2026';

  return (
    <LegalLayout
      title={t('about.title')}
      updatedLabel={t('about.updated')}
      updatedDate={updated}
      backLabel={t('legal.backHome')}
      related={[{ href: '/faq', label: t('faq.title') }]}
      sections={[
        { id: 'intro', title: t('about.sections.intro'), body: <p>{t('about.intro')}</p> },
        { id: 'features', title: t('about.sections.features'), body: <p>{t('about.features')}</p> },
        { id: 'pricing', title: t('about.sections.pricing'), body: <p>{t('about.pricing')}</p> },
      ]}
    />
  );
}
