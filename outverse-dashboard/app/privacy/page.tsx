'use client';

import LegalLayout from '@/components/legal/LegalLayout';
import { useLocale } from '@/components/LocaleProvider';

export default function PrivacyPage() {
  const { t, locale } = useLocale();
  const updated = locale === 'ar' ? '29 يونيو 2026' : 'June 29, 2026';

  return (
    <LegalLayout
      title={t('legal.privacyTitle')}
      updatedLabel={t('legal.privacyUpdated')}
      updatedDate={updated}
      backLabel={t('legal.backHome')}
      related={[{ href: '/terms', label: t('legal.termsTitle') }]}
      sections={[
        {
          id: 'intro',
          title: t('legal.sections.intro'),
          body: <p>{t('legal.privacyIntro')}</p>,
        },
        {
          id: 'info-collect',
          title: t('legal.sections.infoCollect'),
          body: <p>{t('legal.privacyCollect')}</p>,
        },
        {
          id: 'info-use',
          title: t('legal.sections.infoUse'),
          body: <p>{t('legal.privacyUse')}</p>,
        },
        {
          id: 'info-share',
          title: t('legal.sections.infoShare'),
          body: <p>{t('legal.privacyShare')}</p>,
        },
        {
          id: 'cookies',
          title: t('legal.sections.cookies'),
          body: <p>{t('legal.privacyCookies')}</p>,
        },
        {
          id: 'data-rights',
          title: t('legal.sections.dataRights'),
          body: (
            <div>
              <p>{t('legal.privacyRights')}</p>
              <p className="text-sm" style={{ marginTop: 8, opacity: 0.85 }}>
                {t('legal.privacyRightsDetail')}
              </p>
            </div>
          ),
        },
        {
          id: 'data-retention',
          title: t('legal.sections.dataRetention'),
          body: <p>{t('legal.privacyRetention')}</p>,
        },
        {
          id: 'data-security',
          title: t('legal.sections.dataSecurity'),
          body: <p>{t('legal.privacySecurity')}</p>,
        },
        {
          id: 'children',
          title: t('legal.sections.children'),
          body: <p>{t('legal.privacyChildren')}</p>,
        },
        {
          id: 'international',
          title: t('legal.sections.international'),
          body: <p>{t('legal.privacyInternational')}</p>,
        },
        {
          id: 'contact',
          title: t('legal.sections.contact'),
          body: <p>{t('legal.privacyContact')}</p>,
        },
      ]}
    />
  );
}
