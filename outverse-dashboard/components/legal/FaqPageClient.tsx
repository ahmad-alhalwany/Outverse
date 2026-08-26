'use client';

import LegalLayout from '@/components/legal/LegalLayout';
import { useLocale } from '@/components/LocaleProvider';

export default function FaqPageClient() {
  const { t, locale } = useLocale();
  const updated = locale === 'ar' ? '26 أغسطس 2026' : 'August 26, 2026';

  return (
    <LegalLayout
      title={t('faq.title')}
      updatedLabel={t('faq.updated')}
      updatedDate={updated}
      backLabel={t('legal.backHome')}
      related={[{ href: '/about', label: t('about.title') }]}
      sections={[
        { id: 'free', title: t('faq.sections.free'), body: <p>{t('faq.free')}</p> },
        { id: 'coins', title: t('faq.sections.coins'), body: <p>{t('faq.coins')}</p> },
        { id: 'bazaarVsShop', title: t('faq.sections.bazaarVsShop'), body: <p>{t('faq.bazaarVsShop')}</p> },
        { id: 'sell', title: t('faq.sections.sell'), body: <p>{t('faq.sell')}</p> },
        { id: 'subscriptions', title: t('faq.sections.subscriptions'), body: <p>{t('faq.subscriptions')}</p> },
        { id: 'communities', title: t('faq.sections.communities'), body: <p>{t('faq.communities')}</p> },
        { id: 'contact', title: t('faq.sections.contact'), body: <p>{t('faq.contact')}</p> },
      ]}
    />
  );
}
